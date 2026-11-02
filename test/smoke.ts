import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { direct, perform } from '../src/agent.ts';
import { sceneSchema } from '../src/contracts.ts';
import { render } from '../src/media.ts';
import type { Ask } from '../src/claude.ts';
import { guardNetwork } from '../src/network.ts';
import { createServer } from 'node:http';

// Real Chromium capture and real FFmpeg; Claude responses are mocked, no paid calls.
const dir = path.resolve('test-output', `smoke-${Date.now()}`);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const received: string[] = [];
  const server = createServer((req, res) => { received.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'text/html'); res.end('<h1>Network fixture</h1>'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    const origin = `http://127.0.0.1:${address.port}`;
    const guarded = await browser.newContext({ serviceWorkers: 'block' });
    const guard = await guardNetwork(guarded, origin, ['/login']);
    const probe = await guarded.newPage(); await probe.goto(origin);
    await probe.evaluate(async () => {
      await fetch('/login', { method: 'POST' });
      await fetch('/submit', { method: 'POST' }).catch(() => {});
      await fetch('/login', { method: 'DELETE' }).catch(() => {});
      await fetch('https://outside.test').catch(() => {});
    });
    assert.ok(received.includes('POST /login'));
    assert.ok(!received.some(r => r === 'POST /submit' || r === 'DELETE /login'));
    assert.equal(guard.blocked, 3);
    await guarded.close();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  const start = performance.now();
  await page.route('https://staging.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Jobs</h1><input aria-label="Search jobs"><a href="https://outside.test">Bad link</a><p>Demo Engineer</p><div style="height:1200px;background:linear-gradient(white,lightblue)">Synthetic tutorial fixture</div>' }));
  await page.goto('https://staging.test/jobs');
  const scene = sceneSchema.parse({ id: 'demo', title: 'Demo jobs', route: '/jobs', heading: 'Jobs', actions: [{ id: 'overview', kind: 'observe', narration: 'Browse synthetic jobs.' }, { id: 'search', kind: 'focus', selector: 'input', narration: 'Find the job search field.' }] });
  const replies: unknown[] = [{ title: 'Demo jobs', introduction: 'A synthetic demo', actionIds: ['overview', 'search'] }, { actionId: 'overview', reason: 'Start with overview' }, { actionId: 'search', reason: 'Show search' }, { passed: true, issues: [], summary: 'Synthetic demo passed' }];
  const ask: Ask = async (_prompt, schema) => schema.parse(replies.shift());
  const result = await direct(page, scene, ask, dir, start);
  assert.equal(result.evidence.length, 2);
  await assert.rejects(perform(page, { id: 'bad', kind: 'navigate', selector: 'a', heading: 'X', narration: 'X' }), /leaves staging/);
  // Test that a rejected QA review cannot produce a successful result.
  const failingReplies: unknown[] = [{ title: 'Demo', introduction: 'Demo', actionIds: ['overview'] }, { actionId: 'overview', reason: 'Look' }, { passed: false, issues: ['Unsupported feature'], summary: 'Rejected' }];
  const failDir = path.join(dir, 'failed'); await mkdir(failDir);
  const failingAsk: Ask = async (_prompt, schema) => schema.parse(failingReplies.shift());
  await assert.rejects(direct(page, scene, failingAsk, failDir), /AI review failed/);
  assert.equal(JSON.parse(await readFile(path.join(failDir, 'review.json'), 'utf8')).passed, false);
  const video = page.video()!;
  await context.close();
  const media = await render(await video.path(), path.join(dir, 'demo.mp4'), process.env.FFMPEG_PATH || 'ffmpeg', process.env.FFPROBE_PATH || 'ffprobe', result.evidence);
  assert.ok(media.duration > 1 && media.bytes > 1000);
  console.log(JSON.stringify({ status: 'passed', dir, ...media }));
} finally { await browser.close(); }
