#!/usr/bin/env node
/**
 * tests/api-test.js
 * Egonetics API Integration Tests
 *
 * Tests all major API endpoints against the running backend (localhost:3002).
 * Uses real imported data (memory sessions, tasks, kanban).
 *
 * Run: node tests/api-test.js
 * Requires: backend running (`cd server && npm run dev`)
 */

const BASE = 'http://localhost:3002/api';

// ── Helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, ok: r.ok, data: json };
}

const get    = (path)        => req('GET',    path);
const post   = (path, body)  => req('POST',   path, body);
const patch  = (path, body)  => req('PATCH',  path, body);
const put    = (path, body)  => req('PUT',    path, body);
const del    = (path)        => req('DELETE', path);

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
    results.push({ ok: true, label });
  } else {
    console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
    results.push({ ok: false, label, detail });
  }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ── Tests ──────────────────────────────────────────────────

// Track created IDs for cleanup
const created = { tasks: [], agents: [], relations: [], milestones: [], collections: [], entries: [] };

async function testHealth() {
  section('Health Check');
  const r = await get('/health').catch(() => ({ ok: false, data: {} }));
  assert('GET /api/health returns 200', r.ok, JSON.stringify(r.data));
}

// ── Memory API ──────────────────────────────────────────────

async function testMemory() {
  section('Memory API');

  // List sessions
  const r1 = await get('/memory/sessions');
  assert('GET /memory/sessions → 200', r1.ok, r1.status);
  assert('GET /memory/sessions → { sessions, total }', Array.isArray(r1.data?.sessions), JSON.stringify(r1.data).slice(0, 80));

  const sessions = r1.data?.sessions || [];
  console.log(`     Found ${sessions.length} memory sessions`);

  if (sessions.length > 0) {
    const s = sessions[0];
    console.log(`     Testing with session: ${s.id}`);

    // Get session
    const r2 = await get(`/memory/sessions/${s.id}`);
    assert('GET /memory/sessions/:id → 200', r2.ok, r2.status);

    // Get rounds (lazy load)
    const r3 = await get(`/memory/sessions/${s.id}/rounds`);
    assert('GET /memory/sessions/:id/rounds → 200', r3.ok, r3.status);
    assert('GET /memory/sessions/:id/rounds → { rounds }', Array.isArray(r3.data?.rounds));
    console.log(`     Found ${r3.data?.rounds?.length || 0} rounds in session`);

    if (r3.data?.rounds?.length > 0) {
      const round = r3.data.rounds[0];
      const r4 = await get(`/memory/rounds/${round.id}/steps`);
      assert('GET /memory/rounds/:id/steps → 200', r4.ok, r4.status);
      assert('GET /memory/rounds/:id/steps → { steps }', Array.isArray(r4.data?.steps));
      console.log(`     Found ${r4.data?.steps?.length || 0} steps in round`);
    }

    // Annotate session
    const r5 = await patch(`/memory/sessions/${s.id}/annotate`, {
      annotation_title: '[Test] Annotated Session',
      annotation_summary: 'Auto-generated test annotation'
    });
    assert('PATCH /memory/sessions/:id/annotate → 200', r5.ok, JSON.stringify(r5.data));

    // Post annotation note
    const r6 = await post(`/memory/sessions/${s.id}/annotations`, {
      type: 'note',
      content: 'Test note from integration tests',
      tags: ['test', 'auto']
    });
    assert('POST /memory/sessions/:id/annotations → 200', r6.ok, JSON.stringify(r6.data));

    // Get annotations
    const r7 = await get(`/memory/sessions/${s.id}/annotations`);
    assert('GET /memory/sessions/:id/annotations → 200', r7.ok, r7.status);
    assert('GET /memory/sessions/:id/annotations → { annotations }', Array.isArray(r7.data?.annotations));
  } else {
    console.log('     ⚠  No sessions found — skipping session sub-tests');
    console.log('     Tip: Import a JSONL file first: POST /api/memory/import { filePath: "..." }');
  }

  // Test 404 for non-existent session
  const r8 = await get('/memory/sessions/nonexistent-id-xyz');
  assert('GET /memory/sessions/bad-id → 404', r8.status === 404);
}

// ── Tasks API ───────────────────────────────────────────────

async function testTasks() {
  section('Tasks API');

  // List
  const r1 = await get('/tasks');
  assert('GET /tasks → 200', r1.ok, r1.status);
  assert('GET /tasks → { tasks }', Array.isArray(r1.data?.tasks));
  console.log(`     Found ${r1.data?.tasks?.length || 0} tasks`);

  // Create
  const r2 = await post('/tasks', {
    name: '[Test] Integration Test Task',
    icon: '🧪',
    column_id: 'planned',
    priority: 'medium',
    tags: JSON.stringify(['test']),
  });
  assert('POST /tasks → 201', r2.status === 201, JSON.stringify(r2.data));
  const taskId = r2.data?.id;
  if (taskId) created.tasks.push(taskId);

  if (taskId) {
    // Get task
    const r3 = await get(`/tasks/${taskId}`);
    assert('GET /tasks/:id → 200', r3.ok, r3.status);
    assert('GET /tasks/:id → has id', r3.data?.id === taskId);

    // Update
    const r4 = await put(`/tasks/${taskId}`, {
      name: '[Test] Updated Task Name',
      priority: 'high',
    });
    assert('PUT /tasks/:id → 200', r4.ok, JSON.stringify(r4.data));

    // Add property definition
    const r5 = await post(`/tasks/${taskId}/properties/definitions`, {
      name: 'Status',
      type: 'select',
      options: ['todo', 'in_progress', 'done'],
    });
    assert('POST /tasks/:id/properties/definitions → 200', r5.ok, JSON.stringify(r5.data));

    // Set property value
    const r6 = await put(`/tasks/${taskId}/properties/Status`, { value: 'in_progress' });
    assert('PUT /tasks/:id/properties/:name → 200', r6.ok, JSON.stringify(r6.data));

    // Create version
    const r7 = await post(`/tasks/${taskId}/versions`, {
      content: '<p>Test content version 1</p>',
      content_plain: 'Test content version 1',
    });
    assert('POST /tasks/:id/versions → 200', r7.ok, JSON.stringify(r7.data));

    // Get versions
    const r8 = await get(`/tasks/${taskId}/versions`);
    assert('GET /tasks/:id/versions → 200', r8.ok, r8.status);
    assert('GET /tasks/:id/versions → { versions }', Array.isArray(r8.data?.versions));
  }
}

// ── Kanban API ──────────────────────────────────────────────

async function testKanban() {
  section('Kanban API');

  // Get full kanban state
  const r1 = await get('/kanban');
  assert('GET /kanban → 200', r1.ok, r1.status);
  assert('GET /kanban → { columns, tasks }', Array.isArray(r1.data?.columns) && Array.isArray(r1.data?.tasks));
  console.log(`     Columns: ${r1.data?.columns?.length || 0}, Tasks: ${r1.data?.tasks?.length || 0}`);

  const columns = r1.data?.columns || [];
  const colIds = columns.map(c => c.id);

  // Create kanban task
  const r2 = await post('/kanban/tasks', {
    name: '[Test] Kanban Task',
    icon: '📌',
    columnId: colIds[0] || 'planned',
    priority: 'urgent',
    sortOrder: 9999,
  });
  assert('POST /kanban/tasks → 201', r2.status === 201, JSON.stringify(r2.data));
  const kanbanTaskId = r2.data?.id;
  if (kanbanTaskId) created.tasks.push(kanbanTaskId);

  if (kanbanTaskId) {
    // Get single kanban task
    const r3 = await get(`/kanban/tasks/${kanbanTaskId}`);
    assert('GET /kanban/tasks/:id → 200', r3.ok, r3.status);
    assert('GET /kanban/tasks/:id → has name', !!r3.data?.name);

    // Patch task
    const r4 = await patch(`/kanban/tasks/${kanbanTaskId}`, {
      columnId: colIds[1] || 'in-progress',
    });
    assert('PATCH /kanban/tasks/:id → 200', r4.ok, JSON.stringify(r4.data));

    // Bulk update tasks
    if (r1.data?.tasks?.length > 0) {
      const bulkPayload = r1.data.tasks.slice(0, 2).map(t => ({
        id: t.id,
        columnId: t.columnId,
        sortOrder: t.sortOrder,
        status: t.status,
        priority: t.priority,
      }));
      const r5 = await put('/kanban/tasks', bulkPayload);
      assert('PUT /kanban/tasks (bulk) → 200', r5.ok, JSON.stringify(r5.data));
    }
  }

  // Columns
  if (columns.length > 0) {
    const r6 = await post('/kanban/columns', {
      id: `test-col-${Date.now()}`,
      label: 'Test Column',
    });
    assert('POST /kanban/columns → 200', r6.ok, JSON.stringify(r6.data));
    if (r6.data?.id) {
      const r7 = await del(`/kanban/columns/${r6.data.id}`);
      assert('DELETE /kanban/columns/:id → 200', r7.ok, JSON.stringify(r7.data));
    }
  }
}

// ── Chronicle API ──────────────────────────────────────────

async function testChronicle() {
  section('Chronicle API');

  // Main timeline
  const r1 = await get('/chronicle');
  assert('GET /chronicle → 200', r1.ok, r1.status);
  assert('GET /chronicle → { entries, milestones }', r1.data?.entries !== undefined && r1.data?.milestones !== undefined);
  console.log(`     Timeline: ${r1.data?.entries?.length || 0} entries, ${r1.data?.milestones?.length || 0} milestones`);

  // Create manual entry
  const r2 = await post('/chronicle/entries', {
    type: 'task',
    source_id: `test-src-${Date.now()}`,
    title: '[Test] Chronicle Entry',
    summary: 'Auto-generated by integration test',
    start_time: new Date().toISOString(),
  });
  assert('POST /chronicle/entries → 200', r2.ok, JSON.stringify(r2.data));
  const entryId = r2.data?.id;
  if (entryId) created.entries.push(entryId);

  if (entryId) {
    // Get entry
    const r3 = await get(`/chronicle/entries/${entryId}`);
    assert('GET /chronicle/entries/:id → 200', r3.ok, r3.status);

    // Add annotation
    const r4 = await post(`/chronicle/entries/${entryId}/annotations`, {
      content: 'Test annotation V1'
    });
    assert('POST /chronicle/entries/:id/annotations → 200', r4.ok, JSON.stringify(r4.data));

    // Get annotations
    const r5 = await get(`/chronicle/entries/${entryId}/annotations`);
    assert('GET /chronicle/entries/:id/annotations → 200', r5.ok, r5.status);
    assert('GET /chronicle/entries/:id/annotations → { annotations }', Array.isArray(r5.data?.annotations));
  }

  // Milestones
  const r6 = await get('/chronicle/milestones');
  assert('GET /chronicle/milestones → 200', r6.ok, r6.status);
  assert('GET /chronicle/milestones → { milestones }', Array.isArray(r6.data?.milestones));

  const r7 = await post('/chronicle/milestones', {
    title: '[Test] Milestone',
    description: 'Test milestone for integration tests',
  });
  assert('POST /chronicle/milestones → 200', r7.ok, JSON.stringify(r7.data));
  const msId = r7.data?.id;
  if (msId) created.milestones.push(msId);

  if (msId) {
    // Update milestone
    const r8 = await patch(`/chronicle/milestones/${msId}`, {
      description: 'Updated description'
    });
    assert('PATCH /chronicle/milestones/:id → 200', r8.ok, JSON.stringify(r8.data));

    // Assign entry to milestone
    if (entryId) {
      const r9 = await patch(`/chronicle/entries/${entryId}`, { milestone_id: msId });
      assert('PATCH /chronicle/entries/:id (assign to milestone) → 200', r9.ok, JSON.stringify(r9.data));
    }

    // Publish milestone (this locks everything)
    const r10 = await post(`/chronicle/milestones/${msId}/publish`, {});
    assert('POST /chronicle/milestones/:id/publish → 200', r10.ok, JSON.stringify(r10.data));

    // Try to re-publish (should 409)
    const r11 = await post(`/chronicle/milestones/${msId}/publish`, {});
    assert('POST /chronicle/milestones/:id/publish (already published) → 409', r11.status === 409);
  }

  // Collections
  const r12 = await get('/chronicle/collections');
  assert('GET /chronicle/collections → 200', r12.ok, r12.status);
  assert('GET /chronicle/collections → { collections }', Array.isArray(r12.data?.collections));

  const r13 = await post('/chronicle/collections', {
    name: '[Test] Collection',
    description: 'Test collection',
    cover_icon: '🧪',
  });
  assert('POST /chronicle/collections → 200', r13.ok, JSON.stringify(r13.data));
  const colId = r13.data?.id;
  if (colId) created.collections.push(colId);

  if (colId) {
    // Get collection
    const r14 = await get(`/chronicle/collections/${colId}`);
    assert('GET /chronicle/collections/:id → 200', r14.ok, r14.status);

    // Update position
    const r15 = await patch(`/chronicle/collections/${colId}`, {
      position_x: 200, position_y: 150
    });
    assert('PATCH /chronicle/collections/:id → 200', r15.ok, JSON.stringify(r15.data));

    // Add entry to collection
    if (entryId) {
      const r16 = await post(`/chronicle/collections/${colId}/items`, { entry_id: entryId });
      assert('POST /chronicle/collections/:id/items → 200', r16.ok, JSON.stringify(r16.data));

      // Remove entry from collection
      const r17 = await del(`/chronicle/collections/${colId}/items/${entryId}`);
      assert('DELETE /chronicle/collections/:id/items/:entryId → 200', r17.ok, JSON.stringify(r17.data));
    }

    // Delete collection
    const r18 = await del(`/chronicle/collections/${colId}`);
    assert('DELETE /chronicle/collections/:id → 200', r18.ok, JSON.stringify(r18.data));
    created.collections = created.collections.filter(id => id !== colId);
  }
}

// ── Agents API ─────────────────────────────────────────────

async function testAgents() {
  section('Agents API');

  // List
  const r1 = await get('/agents');
  assert('GET /agents → 200', r1.ok, r1.status);
  assert('GET /agents → { agents }', Array.isArray(r1.data?.agents));
  console.log(`     Found ${r1.data?.agents?.length || 0} agents`);

  // Create agent
  const r2 = await post('/agents', {
    name: '[Test] LifeCore Agent',
    type: 'claude_code',
    model: 'claude-sonnet-4-6',
    role: 'orchestrator',
    description: 'Test orchestrator agent',
    position_x: 100,
    position_y: 100,
  });
  assert('POST /agents → 201', r2.status === 201, JSON.stringify(r2.data));
  const agent1Id = r2.data?.id;
  if (agent1Id) created.agents.push(agent1Id);

  const r2b = await post('/agents', {
    name: '[Test] Worker Agent',
    type: 'tool',
    role: 'worker',
    position_x: 320,
    position_y: 100,
  });
  assert('POST /agents (worker) → 201', r2b.status === 201, JSON.stringify(r2b.data));
  const agent2Id = r2b.data?.id;
  if (agent2Id) created.agents.push(agent2Id);

  if (agent1Id) {
    // Get agent
    const r3 = await get(`/agents/${agent1Id}`);
    assert('GET /agents/:id → 200', r3.ok, r3.status);

    // Update agent position
    const r4 = await patch(`/agents/${agent1Id}`, {
      position_x: 150,
      position_y: 200,
      status: 'running',
    });
    assert('PATCH /agents/:id → 200', r4.ok, JSON.stringify(r4.data));

    // Send message
    const r5 = await post('/agents/messages', {
      from_id: null,
      to_id: agent1Id,
      content: 'Hello from integration test!',
      type: 'message',
    });
    assert('POST /agents/messages → 201', r5.status === 201, JSON.stringify(r5.data));

    // Get messages
    const r6 = await get(`/agents/${agent1Id}/messages`);
    assert('GET /agents/:id/messages → 200', r6.ok, r6.status);
    assert('GET /agents/:id/messages → { messages }', Array.isArray(r6.data?.messages));
    assert('GET /agents/:id/messages → has test message', r6.data?.messages?.some(m => m.content.includes('integration test')));

    // Create relation
    if (agent2Id) {
      const r7 = await post('/agents/relations', {
        from_agent: agent1Id,
        to_agent: agent2Id,
        type: 'sequential',
      });
      assert('POST /agents/relations → 201', r7.status === 201, JSON.stringify(r7.data));
      const relId = r7.data?.id;
      if (relId) created.relations.push(relId);

      // Get relations
      const r8 = await get('/agents/relations');
      assert('GET /agents/relations → 200', r8.ok, r8.status);
      assert('GET /agents/relations → { relations }', Array.isArray(r8.data?.relations));

      // Delete relation
      if (relId) {
        const r9 = await del(`/agents/relations/${relId}`);
        assert('DELETE /agents/relations/:id → 200', r9.ok, JSON.stringify(r9.data));
        created.relations = created.relations.filter(id => id !== relId);
      }
    }
  }

  // 404 for non-existent
  const r10 = await get('/agents/nonexistent-xyz');
  assert('GET /agents/bad-id → 404', r10.status === 404);
}

// ── Pages API ──────────────────────────────────────────────

async function testPages() {
  section('Pages API');

  const r1 = await get('/pages');
  assert('GET /pages → 200', r1.ok, r1.status);
  // Pages route returns raw array (not wrapped in { pages: [] })
  assert('GET /pages → array', Array.isArray(r1.data));
  console.log(`     Found ${r1.data?.length || 0} pages`);
}

// ── Cleanup ────────────────────────────────────────────────

async function cleanup() {
  section('Cleanup');

  let cleaned = 0;
  for (const id of created.tasks) {
    await del(`/tasks/${id}`).catch(() => {});
    await del(`/kanban/tasks/${id}`).catch(() => {});
    cleaned++;
  }
  for (const id of created.agents) {
    await del(`/agents/${id}`).catch(() => {});
    cleaned++;
  }
  for (const id of created.milestones) {
    // Published milestones can't be deleted, just skip
    await del(`/chronicle/milestones/${id}`).catch(() => {});
    cleaned++;
  }
  for (const id of created.entries) {
    await del(`/chronicle/entries/${id}`).catch(() => {});
    cleaned++;
  }
  console.log(`  🧹 Cleaned up ${cleaned} test resources`);
}

// ── Runner ─────────────────────────────────────────────────

async function run() {
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│  Egonetics API Integration Tests                     │');
  console.log('│  Backend: http://localhost:3002                       │');
  console.log('└─────────────────────────────────────────────────────┘');

  try {
    await testHealth();
    await testMemory();
    await testTasks();
    await testKanban();
    await testChronicle();
    await testAgents();
    await testPages();
    await cleanup();
  } catch (err) {
    console.error('\n❌ Test runner crashed:', err.message);
    failed++;
  }

  const total = passed + failed;
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Failed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`   - ${r.label}${r.detail ? ' (' + r.detail + ')' : ''}`));
  }
  console.log('══════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run();
