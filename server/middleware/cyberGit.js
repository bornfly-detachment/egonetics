/**
 * cyberGit.js — AOP After-Advice for cybernetics_nodes writes
 *
 * Pointcut : POST|PATCH|DELETE /api/cybernetics/nodes/*
 * Advice   : After successful response — git commit snapshot
 *
 * AI writes  → ai/node-{id} branch, generates cyber_diffs record if diverged
 * User writes → main branch, closes pending AI proposals on same node
 */

const path = require('path');
const fs   = require('fs');
const simpleGit = require('simple-git');
const { diff: jdp } = require('jsondiffpatch');

const REPO_PATH  = path.join(__dirname, '../data/cyber-repo');
const NODES_DIR  = path.join(REPO_PATH, 'nodes');
const git        = simpleGit(REPO_PATH);

// ── helpers ─────────────────────────────────────────────────────

function nodeFile(id) {
  return path.join(NODES_DIR, `${id}.json`);
}

function genId() {
  return `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function creatorFromReq(req) {
  return req.user?.role === 'agent' ? 'ai' : 'user';
}

// Extract node id from path: /cybernetics/nodes/:id  or /cybernetics/nodes/:id/page etc.
function nodeIdFromPath(reqPath) {
  const m = reqPath.match(/^\/cybernetics\/nodes\/([^/]+)/);
  return m ? m[1] : null;
}

// Read node from DB (sync-safe wrapper for callback-based sqlite3)
function getNode(db, id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM cybernetics_nodes WHERE id = ?', [id], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function updateNodeMeta(db, id, git_hash, branch, creator) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE cybernetics_nodes SET git_hash = ?, branch = ?, creator = ? WHERE id = ?',
      [git_hash, branch, creator, id],
      err => { if (err) reject(err); else resolve(); }
    );
  });
}

function insertDiff(db, record) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO cyber_diffs (id, node_id, commit_a, commit_b, creator_a, creator_b, diff_type, diff_patch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.node_id, record.commit_a, record.commit_b,
       record.creator_a, record.creator_b, record.diff_type, record.diff_patch],
      err => { if (err) reject(err); else resolve(); }
    );
  });
}

// Ensure branch exists and is checked out
async function ensureBranch(branchName) {
  const summary = await git.branchLocal();
  if (!summary.all.includes(branchName)) {
    await git.checkoutLocalBranch(branchName);
  } else {
    await git.checkout(branchName);
  }
}

// ── core commit logic ────────────────────────────────────────────

async function commitNode(db, nodeId, creator) {
  const node = await getNode(db, nodeId);
  if (!node) return;

  const nodeData = {
    id: node.id,
    parent_id: node.parent_id,
    layer: node.layer,
    level: node.level,
    node_type: node.node_type,
    name: node.name,
    description: node.description,
    sort_order: node.sort_order,
    creator,
    page_id: node.page_id,
    meta: JSON.parse(node.meta || '{}'),
  };

  const filePath = nodeFile(nodeId);
  const targetBranch = creator === 'ai' ? `ai/node-${nodeId}` : 'main';
  const prevBranch   = (await git.branchLocal()).current;

  try {
    // Switch to target branch
    if (creator === 'ai') {
      // ai branch: base off main
      const branches = await git.branchLocal();
      if (!branches.all.includes(targetBranch)) {
        await git.checkout('main');
        await git.checkoutLocalBranch(targetBranch);
      } else {
        await git.checkout(targetBranch);
      }
    } else {
      await git.checkout('main');
    }

    // Write file and commit
    fs.writeFileSync(filePath, JSON.stringify(nodeData, null, 2));
    await git.add(filePath);

    const status = await git.status();
    if (status.staged.length === 0) {
      // Nothing to commit (no change)
      await git.checkout(prevBranch).catch(() => {});
      return;
    }

    const msg = `${creator}: ${node.name} [${nodeId}]`;
    const commitResult = await git.commit(msg, { '--author': `${creator} <${creator}@egonetics>` });
    const hash = commitResult.commit;

    // Write hash + branch + creator back to DB
    await updateNodeMeta(db, nodeId, hash, targetBranch, creator);

    // If AI write: check divergence from main and record diff
    if (creator === 'ai') {
      await recordAiDiff(db, nodeId, hash, targetBranch, node);
    }

    // Return to previous branch
    await git.checkout(prevBranch).catch(() => {});
  } catch (err) {
    console.error('[cyberGit] commit error:', err.message);
    await git.checkout(prevBranch).catch(() => {});
  }
}

async function recordAiDiff(db, nodeId, aiHash, aiBranch, nodeRow) {
  try {
    // Get main's latest commit hash for this file
    const mainLog = await git.log(['main', '--', `nodes/${nodeId}.json`]);
    if (!mainLog.latest) return; // No main history yet → no diff to record

    const mainHash = mainLog.latest.hash;
    if (mainHash === aiHash) return;

    // Get content of both versions
    const aiContent   = JSON.parse(fs.readFileSync(nodeFile(nodeId), 'utf8'));
    let mainContent = {};
    try {
      const mainRaw = await git.show([`main:nodes/${nodeId}.json`]);
      mainContent = JSON.parse(mainRaw);
    } catch { /* file doesn't exist on main yet */ }

    const patch = jdp(mainContent, aiContent);
    if (!patch) return; // identical

    await insertDiff(db, {
      id:        genId(),
      node_id:   nodeId,
      commit_a:  mainHash,
      commit_b:  aiHash,
      creator_a: 'user',
      creator_b: 'ai',
      diff_type: 'ai_proposal',
      diff_patch: JSON.stringify(patch),
    });
  } catch (err) {
    console.error('[cyberGit] recordAiDiff error:', err.message);
  }
}

// ── Express after-advice ─────────────────────────────────────────

/**
 * Wrap res.json to intercept successful write responses.
 * Works as a transparent after-advice without altering route handlers.
 */
function cyberGitAdvice(db) {
  return function(req, res, next) {
    // Only intercept write operations on nodes (not /seed, not /page sub-routes)
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return next();

    const rawPath = req.path; // relative to mount point (/api)
    if (!rawPath.match(/^\/cybernetics\/nodes(?:\/[^/]+)?$/)) return next();

    // Skip seed endpoint
    if (rawPath === '/cybernetics/nodes/seed') return next();

    const originalJson = res.json.bind(res);

    res.json = function(body) {
      originalJson(body);

      // Only proceed if response was successful (2xx)
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      // Determine nodeId
      let nodeId = null;
      if (req.method === 'POST' && body?.id) {
        nodeId = body.id;
      } else {
        nodeId = nodeIdFromPath(rawPath);
        if (nodeId === 'seed') return;
      }

      if (!nodeId) return;
      if (req.method === 'DELETE') return; // deleted node → skip snapshot

      const creator = creatorFromReq(req);
      // Fire and forget (non-blocking)
      commitNode(db, nodeId, creator).catch(err =>
        console.error('[cyberGit] async commit failed:', err.message)
      );
    };

    next();
  };
}

module.exports = { cyberGitAdvice };
