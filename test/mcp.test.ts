import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { editWithMcp } from '../src/mcp-video.ts';
test('MCP editor discovers a real stdio tool and expands input/output paths', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'savant-mcp-'));
  try {
    const input = path.join(dir, 'source.txt'); const output = path.join(dir, 'edited.txt');
    await writeFile(input, 'synthetic media');
    const cfg = path.join(dir, 'config.json');
    const settings = { command: process.execPath, args: ['--import', 'tsx', path.resolve('test/mcp-fixture.ts')], tool: 'copy_video', arguments: { input: '{{input}}', output: '{{output}}' } };
    await writeFile(cfg, JSON.stringify(settings));
    await editWithMcp(cfg, input, output);
    assert.equal(await readFile(output, 'utf8'), 'synthetic media');
    await writeFile(cfg, JSON.stringify({ ...settings, tool: 'nonexistent' }));
    await assert.rejects(editWithMcp(cfg, input, output), /unavailable/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
