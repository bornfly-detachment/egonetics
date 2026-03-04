/**
 * import-jsonl.js
 * 双格式 JSONL 解析器：OpenClaw + Claude Code
 * 导入到 memory.db (sessions/rounds/steps 新 schema)
 *
 * 用法：
 *   node import-jsonl.js <file.jsonl>  [--db path/to/memory.db]
 *   require('./import-jsonl').importFile(filePath, db)  ← 供路由调用
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ── ID 生成 ────────────────────────────────────────────────

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── 格式识别 ────────────────────────────────────────────────

/**
 * 识别 JSONL 来源格式
 * @returns 'openclaw' | 'claude_code' | 'unknown'
 */
function detectFormat(records) {
  for (const r of records.slice(0, 10)) {
    // OpenClaw: 顶层 type:"session" + cwd 含 .openclaw
    if (r.type === 'session' && r.cwd) return 'openclaw';
    // OpenClaw: model_change 记录
    if (r.type === 'model_change') return 'openclaw';
    // OpenClaw: message.provider 为非 Anthropic
    if (r.type === 'message' && r.message?.provider &&
        !r.message.provider.includes('anthropic')) return 'openclaw';

    // Claude Code: 含 isSidechain 或 gitBranch 字段
    if ('isSidechain' in r || 'gitBranch' in r) return 'claude_code';
    // Claude Code: 顶层 type 直接为 user/assistant/tool
    if (['user', 'assistant', 'tool'].includes(r.type) && r.uuid) return 'claude_code';
  }
  // 再扫一遍更宽松地判断
  for (const r of records) {
    if (r.type === 'message' && r.parentId !== undefined) return 'openclaw';
    if (r.parentUuid !== undefined) return 'claude_code';
  }
  return 'unknown';
}

// ── 时间戳解析 ─────────────────────────────────────────────

function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime() || 0;
}

// ── OpenClaw 解析 ──────────────────────────────────────────

function parseOpenClaw(records, sourceFile) {
  // 1. Session 元信息
  const sessionRec = records.find(r => r.type === 'session');
  const sessionId = sessionRec?.id || path.basename(sourceFile, '.jsonl');

  // 2. 只处理 type:"message" 记录
  const msgRecs = records
    .filter(r => r.type === 'message')
    .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));

  if (msgRecs.length === 0) {
    return { session: null, rounds: [], steps: [] };
  }

  const model = msgRecs.find(r => r.message?.role === 'assistant')?.message?.model || null;
  const timestamps = msgRecs.map(r => r.timestamp).filter(Boolean);
  const startedAt = timestamps[0] || null;
  const endedAt   = timestamps[timestamps.length - 1] || null;

  // 统计 token（所有 assistant 消息累加）
  let totalInput = 0, totalOutput = 0;
  for (const r of msgRecs) {
    if (r.message?.role === 'assistant') {
      const u = r.message.usage || {};
      totalInput  += (u.input  || u.prompt_tokens     || 0);
      totalOutput += (u.output || u.completion_tokens || 0);
    }
  }

  const session = {
    id: sessionId,
    agent_name: 'openclaw',
    agent_type: 'openclaw',
    model,
    source_file: sourceFile,
    token_input: totalInput,
    token_output: totalOutput,
    started_at: startedAt,
    ended_at: endedAt,
  };

  // 3. 按 user 切分 Round，assistant/toolResult 归入当前 round
  const rounds = [];
  const steps  = [];
  let curRound = null;
  let roundNum = 0;
  let stepNum  = 0;

  for (const r of msgRecs) {
    const msg  = r.message || {};
    const role = msg.role;

    if (role === 'user') {
      // 新轮次
      roundNum++;
      stepNum = 0;
      const userText = (msg.content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text || '')
        .join('\n');

      curRound = {
        id: genId('rnd'),
        session_id: sessionId,
        round_num: roundNum,
        user_input: userText,
        started_at: r.timestamp || null,
        ended_at: null,
        duration_ms: 0,
        token_input: 0,
        token_output: 0,
      };
      rounds.push(curRound);
      continue;
    }

    if (!curRound) continue; // 忽略 round 前的 assistant/toolResult

    if (role === 'assistant') {
      const content = msg.content || [];
      const usage   = msg.usage || {};
      const u_in    = usage.input  || usage.prompt_tokens     || 0;
      const u_out   = usage.output || usage.completion_tokens || 0;

      curRound.token_input  += u_in;
      curRound.token_output += u_out;

      for (const part of content) {
        stepNum++;
        if (part.type === 'thinking') {
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'thinking',
            tool_name: null,
            content: JSON.stringify({ text: part.thinking || part.text || '' }),
            duration_ms: 0,
          });
        } else if (part.type === 'toolCall') {
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'tool_call',
            tool_name: part.name || null,
            content: JSON.stringify({ name: part.name, arguments: part.arguments || {} }),
            duration_ms: 0,
          });
        } else if (part.type === 'text' && part.text) {
          // 最终输出
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'response',
            tool_name: null,
            content: JSON.stringify({ text: part.text }),
            duration_ms: 0,
          });
        }
      }
      curRound.ended_at = r.timestamp || curRound.ended_at;
    }

    if (role === 'toolResult') {
      stepNum++;
      const toolText = (msg.content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text || '')
        .join('\n');

      steps.push({
        id: genId('stp'),
        round_id: curRound.id,
        step_num: stepNum,
        type: 'tool_result',
        tool_name: msg.toolName || msg.tool_name || null,
        content: JSON.stringify({ output: toolText }),
        duration_ms: 0,
      });
      curRound.ended_at = r.timestamp || curRound.ended_at;
    }
  }

  // 计算 round duration
  for (const round of rounds) {
    if (round.started_at && round.ended_at) {
      round.duration_ms = Math.max(0, toMs(round.ended_at) - toMs(round.started_at));
    }
  }

  // 总 session duration
  session.duration_ms = rounds.reduce((s, r) => s + r.duration_ms, 0);

  return { session, rounds, steps };
}

// ── Claude Code 解析 ────────────────────────────────────────

function parseClaudeCode(records, sourceFile) {
  // 1. Session 元信息
  const sessionId = records.find(r => r.sessionId)?.sessionId
                 || path.basename(sourceFile, '.jsonl');

  const sorted = [...records].sort((a, b) => {
    const ta = a.timestamp ? toMs(a.timestamp) : 0;
    const tb = b.timestamp ? toMs(b.timestamp) : 0;
    return ta - tb;
  });

  // 过滤记录：只保留有效的对话记录
  const mainRecords = sorted.filter(r => {
    // 跳过旁链
    if (r.isSidechain) return false;
    // 跳过文件快照记录
    if (r.type === 'file-history-snapshot') return false;
    // 跳过进度记录
    if (r.type === 'progress') return false;
    // 跳过队列操作记录
    if (r.type === 'queue-operation') return false;
    // 跳过系统错误记录
    if (r.type === 'system' && r.subtype === 'api_error') return false;
    // 跳过元消息
    if (r.isMeta) return false;
    // 必须有 type 字段
    if (!r.type) return false;
    return true;
  });

  // 预处理：合并连续的 assistant 消息（Claude Code 会把 thinking/tool_use/text 分成多条记录）
  const mergedRecords = [];
  for (let i = 0; i < mainRecords.length; i++) {
    const r = mainRecords[i];

    if (r.type === 'assistant') {
      // 找到所有连续的 assistant 消息
      let j = i + 1;
      const contents = [...(r.message?.content || [])];
      let lastTimestamp = r.timestamp;
      let totalUsage = { ...(r.message?.usage || {}) };

      while (j < mainRecords.length && mainRecords[j].type === 'assistant') {
        const nextRec = mainRecords[j];
        const nextContent = nextRec.message?.content || [];
        contents.push(...nextContent);
        lastTimestamp = nextRec.timestamp;
        // 累加 usage
        const nextUsage = nextRec.message?.usage || {};
        totalUsage.input_tokens = (totalUsage.input_tokens || 0) + (nextUsage.input_tokens || 0);
        totalUsage.output_tokens = (totalUsage.output_tokens || 0) + (nextUsage.output_tokens || 0);
        totalUsage.cache_read_input_tokens = (totalUsage.cache_read_input_tokens || 0) + (nextUsage.cache_read_input_tokens || 0);
        j++;
      }

      // 创建合并后的记录
      mergedRecords.push({
        ...r,
        timestamp: lastTimestamp,
        message: {
          ...r.message,
          content: contents,
          usage: totalUsage,
        },
      });

      i = j - 1; // 跳过已合并的记录
    } else {
      mergedRecords.push(r);
    }
  }

  // 再过滤：处理 user 消息
  const filteredRecords = [];
  for (let i = 0; i < mergedRecords.length; i++) {
    const r = mergedRecords[i];
    if (r.type === 'user') {
      const content = r.message?.content;
      let text = '';
      if (Array.isArray(content)) {
        // 过滤掉 <ide_opened_file> 这类消息，只保留真正的用户输入
        const textParts = content.filter(c => c.type === 'text' && c.text);
        const realUserParts = textParts.filter(c =>
          !c.text.startsWith('<ide_opened_file>') &&
          !c.text.includes('<local-command-caveat>') &&
          !c.text.includes('<command-name>') &&
          !c.text.includes('<local-command-stdout>')
        );
        if (realUserParts.length === 0) {
          // 没有真正的用户输入，但如果有 tool_result，保留作为 tool_result
          const hasToolResult = content.some(c => c.type === 'tool_result');
          if (!hasToolResult) continue;
        }
        text = realUserParts.map(c => c.text || '').join('\n');
      } else if (typeof content === 'string') {
        text = content;
      }
      // 跳过空消息（但保留有 tool_result 的）
      const hasToolResult = Array.isArray(content) && content.some(c => c.type === 'tool_result');
      if (!text.trim() && !hasToolResult) {
        continue;
      }
    }
    filteredRecords.push(r);
  }

  if (filteredRecords.length === 0) {
    return { session: null, rounds: [], steps: [] };
  }

  const model = filteredRecords.find(r => r.type === 'assistant')?.message?.model || null;
  const timestamps = filteredRecords.map(r => r.timestamp).filter(Boolean);
  const startedAt = timestamps[0] || null;
  const endedAt   = timestamps[timestamps.length - 1] || null;

  let totalInput = 0, totalOutput = 0;
  for (const r of filteredRecords) {
    if (r.type === 'assistant') {
      const u = r.message?.usage || {};
      totalInput  += (u.input_tokens  || u.input  || u.cache_read_input_tokens || 0);
      totalOutput += (u.output_tokens || u.output || 0);
    }
  }

  const session = {
    id: sessionId,
    agent_name: 'claude_code',
    agent_type: 'claude_code',
    model,
    source_file: sourceFile,
    token_input: totalInput,
    token_output: totalOutput,
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: 0,
  };

  const rounds = [];
  const steps  = [];
  let curRound = null;
  let roundNum = 0;
  let stepNum  = 0;

  for (const r of filteredRecords) {
    // 检查是否是真正的 user 消息（有 text 内容，非 tool_result）
    const isRealUserMessage = r.type === 'user' && (() => {
      const content = r.message?.content;
      if (Array.isArray(content)) {
        const hasRealText = content.some(c =>
          c.type === 'text' && c.text &&
          !c.text.startsWith('<ide_opened_file>') &&
          !c.text.includes('<local-command-caveat>')
        );
        return hasRealText;
      }
      return typeof content === 'string' && content.trim();
    })();

    // 检查是否是 tool_result
    const isToolResult = r.type === 'tool' ||
      (r.type === 'user' && r.message?.content && Array.isArray(r.message.content) &&
       r.message.content.some(c => c.type === 'tool_result'));

    if (isRealUserMessage) {
      // 新轮次
      roundNum++;
      stepNum = 0;
      const content = r.message?.content;
      const userText = Array.isArray(content)
        ? content.filter(c => c.type === 'text' && c.text &&
            !c.text.startsWith('<ide_opened_file>') &&
            !c.text.includes('<local-command-caveat>')
          ).map(c => c.text || '').join('\n')
        : (typeof content === 'string' ? content : '');

      if (!userText.trim()) continue; // 跳过空用户消息

      curRound = {
        id: genId('rnd'),
        session_id: sessionId,
        round_num: roundNum,
        user_input: userText,
        started_at: r.timestamp || null,
        ended_at: null,
        duration_ms: r.durationMs || 0,
        token_input: 0,
        token_output: 0,
      };
      rounds.push(curRound);
      continue;
    }

    if (!curRound) continue;

    if (r.type === 'assistant') {
      const content = r.message?.content || [];
      const usage   = r.message?.usage   || {};
      curRound.token_input  += (usage.input_tokens  || usage.cache_read_input_tokens || 0);
      curRound.token_output += (usage.output_tokens || 0);
      const durationMs = r.durationMs || 0;

      // 处理 content 可能是字符串的情况（虽然少见）
      const parts = Array.isArray(content) ? content : [];

      for (const part of parts) {
        if (!part) continue;
        stepNum++;
        if (part.type === 'thinking') {
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'thinking',
            tool_name: null,
            content: JSON.stringify({ text: part.thinking || part.text || '' }),
            duration_ms: durationMs,
          });
        } else if (part.type === 'tool_use') {
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'tool_call',
            tool_name: part.name || null,
            content: JSON.stringify({ name: part.name, arguments: part.input || {} }),
            duration_ms: 0,
          });
        } else if (part.type === 'text' && part.text) {
          steps.push({
            id: genId('stp'),
            round_id: curRound.id,
            step_num: stepNum,
            type: 'response',
            tool_name: null,
            content: JSON.stringify({ text: part.text }),
            duration_ms: durationMs,
          });
        }
      }
      curRound.ended_at = r.timestamp || curRound.ended_at;
    }

    if (isToolResult) {
      stepNum++;
      const content = r.message?.content || [];
      const outputText = Array.isArray(content)
        ? content.filter(c => c.type === 'tool_result' || c.type === 'text')
                 .map(c => {
                   if (c.type === 'tool_result') {
                     return Array.isArray(c.content)
                       ? c.content.filter(x => x.type === 'text').map(x => x.text).join('\n')
                       : String(c.content || '');
                   }
                   return c.text || '';
                 })
                 .join('\n')
        : String(content);

      steps.push({
        id: genId('stp'),
        round_id: curRound.id,
        step_num: stepNum,
        type: 'tool_result',
        tool_name: null,
        content: JSON.stringify({ output: outputText }),
        duration_ms: 0,
      });
      curRound.ended_at = r.timestamp || curRound.ended_at;
    }
  }

  // 过滤掉没有 steps 的 round
  const validRounds = [];
  for (const round of rounds) {
    const roundSteps = steps.filter(s => s.round_id === round.id);
    if (roundSteps.length > 0) {
      validRounds.push(round);
    }
  }

  // 重新编号 round_num
  validRounds.forEach((round, idx) => {
    round.round_num = idx + 1;
  });

  // round duration
  for (const round of validRounds) {
    if (round.started_at && round.ended_at) {
      round.duration_ms = Math.max(0, toMs(round.ended_at) - toMs(round.started_at));
    }
  }
  session.duration_ms = validRounds.reduce((s, r) => s + r.duration_ms, 0);

  // 只保留有效 round 的 steps
  const validStepRoundIds = new Set(validRounds.map(r => r.id));
  const validSteps = steps.filter(s => validStepRoundIds.has(s.round_id));

  if (validRounds.length === 0) {
    return { session: null, rounds: [], steps: [] };
  }

  return { session, rounds: validRounds, steps: validSteps };
}

// ── DB 写入 ────────────────────────────────────────────────

function insertIntoDb(db, parsed) {
  return new Promise((resolve, reject) => {
    const { session, rounds, steps } = parsed;
    if (!session) return reject(new Error('没有解析到会话数据'));

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // 检查是否已导入
      db.get('SELECT id FROM sessions WHERE id = ?', [session.id], (err, existing) => {
        if (err) { db.run('ROLLBACK'); return reject(err); }
        if (existing) { db.run('ROLLBACK'); return reject(new Error(`会话 ${session.id} 已存在`)); }

        // 插入 session
        db.run(
          `INSERT INTO sessions
             (id, agent_name, agent_type, model, source_file,
              token_input, token_output, duration_ms, started_at, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [session.id, session.agent_name, session.agent_type, session.model, session.source_file,
           session.token_input, session.token_output, session.duration_ms,
           session.started_at, session.ended_at],
          (err) => { if (err) { db.run('ROLLBACK'); return reject(err); } }
        );

        // 插入 rounds
        for (const r of rounds) {
          db.run(
            `INSERT INTO rounds
               (id, session_id, round_num, user_input, started_at, ended_at,
                duration_ms, token_input, token_output)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [r.id, r.session_id, r.round_num, r.user_input, r.started_at, r.ended_at,
             r.duration_ms, r.token_input, r.token_output],
            (err) => { if (err) console.warn('round insert warn:', err.message); }
          );
        }

        // 插入 steps
        for (const s of steps) {
          db.run(
            `INSERT INTO steps (id, round_id, step_num, type, tool_name, content, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.round_id, s.step_num, s.type, s.tool_name, s.content, s.duration_ms],
            (err) => { if (err) console.warn('step insert warn:', err.message); }
          );
        }

        // 写入 event
        db.run(
          `INSERT INTO events (id, type, source, ref_id, title, content)
           VALUES (?, 'memory.session_imported', 'memory', ?, ?, '{}')`,
          [genId('evt'), session.id, `导入: ${path.basename(session.source_file || 'unknown')}`]
        );

        db.run('COMMIT', (err) => {
          if (err) { db.run('ROLLBACK'); return reject(err); }
          resolve({
            session_id: session.id,
            rounds_count: rounds.length,
            steps_count: steps.length,
            format: session.agent_type,
          });
        });
      });
    });
  });
}

// ── 主入口 ─────────────────────────────────────────────────

/**
 * importFile(filePath, db) — 供路由模块调用
 * @param {string} filePath 绝对路径
 * @param {sqlite3.Database} db memory.db 实例
 * @returns Promise<{ session_id, rounds_count, steps_count, format }>
 */
async function importFile(filePath, db) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(l => l.trim());

  const records = [];
  for (const line of lines) {
    try { records.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }

  if (records.length === 0) throw new Error('JSONL 文件为空或格式错误');

  const format = detectFormat(records);
  console.log(`📂 检测到格式: ${format} (${records.length} 条记录)`);

  let parsed;
  if (format === 'openclaw') {
    parsed = parseOpenClaw(records, filePath);
  } else if (format === 'claude_code') {
    parsed = parseClaudeCode(records, filePath);
  } else {
    // 尝试 OpenClaw 解析作为默认
    console.warn('⚠️  未识别格式，尝试 OpenClaw 解析');
    parsed = parseOpenClaw(records, filePath);
  }

  return insertIntoDb(db, parsed);
}

// ── CLI 入口 ───────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => !a.startsWith('--'));
  const dbArg = args.find((a, i) => args[i - 1] === '--db') ||
                path.join(__dirname, '..', 'data', 'memory.db');

  if (!fileArg) {
    console.error('用法: node import-jsonl.js <file.jsonl> [--db path/to/memory.db]');
    process.exit(1);
  }

  const db = new sqlite3.Database(dbArg, (err) => {
    if (err) { console.error('数据库打开失败:', err.message); process.exit(1); }
  });

  importFile(path.resolve(fileArg), db)
    .then(result => {
      console.log('✅ 导入成功:', result);
      db.close();
    })
    .catch(err => {
      console.error('❌ 导入失败:', err.message);
      db.close();
      process.exit(1);
    });
}

module.exports = { importFile, detectFormat };
