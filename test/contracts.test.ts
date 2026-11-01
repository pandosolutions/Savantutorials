import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagingOrigin } from '../src/config.ts';
import { sceneSchema, validatePlan } from '../src/contracts.ts';
import { subtitles } from '../src/media.ts';
import { claude } from '../src/claude.ts';
import { z } from 'zod';
const scene = sceneSchema.parse({ id: 'demo', title: 'Demo', route: '/demo', heading: 'Demo', actions: [{ id: 'look', kind: 'observe', narration: 'Look here.' }] });
test('staging origin rejects production, credentials, paths, and origin confusion', () => {
  for (const url of ['http://staging.test', 'https://savantalent.com', 'https://www.savantalent.com', 'https://api.savantalent.com', 'https://user:pass@staging.test', 'https://staging.test/path', 'https://staging.test?x=1']) assert.throws(() => stagingOrigin(url, new URL(url).origin));
  assert.throws(() => stagingOrigin('https://staging.test.attacker.test', 'https://staging.test'));
  assert.equal(stagingOrigin('https://staging.test', 'https://staging.test'), 'https://staging.test');
});
test('planner cannot inject undeclared actions or replay an action', () => {
  assert.throws(() => validatePlan({ title: 'X', introduction: 'X', actionIds: ['submit'] }, scene));
  assert.throws(() => validatePlan({ title: 'X', introduction: 'X', actionIds: ['look', 'look'] }, scene));
  assert.equal(validatePlan({ title: 'X', introduction: 'X', actionIds: ['look'] }, scene).actionIds[0], 'look');
});
test('scene rejects traversal, unbounded scrolling and duplicate IDs', () => {
  assert.throws(() => sceneSchema.parse({ ...scene, route: '//attacker.test' }));
  assert.throws(() => sceneSchema.parse({ ...scene, actions: [...scene.actions, ...scene.actions] }));
  assert.throws(() => sceneSchema.parse({ ...scene, actions: [{ id: 'scroll', kind: 'scroll', pixels: 99999, narration: 'X' }] }));
});
test('captions follow edited timeline, excluding planning pauses', () => {
  const result = subtitles([{ start: 10, end: 12, narration: 'First' }, { start: 90, end: 93, narration: 'Second' }]);
  assert.match(result, /00:00:00,000 --> 00:00:02,000/);
  assert.match(result, /00:00:02,000 --> 00:00:05,000/);
});
test('Claude transport validates JSON and rejects truncated responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":true}' }] }));
    assert.deepEqual(await claude('test', 'test')('test', z.object({ ok: z.boolean() })), { ok: true });
    globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'max_tokens', content: [] }));
    await assert.rejects(claude('test', 'test')('test', z.object({ ok: z.boolean() })), /incomplete/);
  } finally { globalThis.fetch = original; }
});
