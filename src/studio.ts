import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { config } from './config.ts';
import { sceneSchema } from './contracts.ts';
import { claude } from './claude.ts';
import { direct } from './agent.ts';
import { command, render, probeVideo } from './media.ts';
import { editWithMcp } from './mcp-video.ts';
import { guardNetwork } from './network.ts';
export async function run(args: string[]) {
  const id = args[0];
  if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('Usage: npm run record -- <scene-id>');
  const scene = sceneSchema.parse(JSON.parse(await readFile(path.resolve('scenes', `${id}.json`), 'utf8')));
  if (scene.id !== id) throw new Error('Scene ID does not match filename');
  const cfg = config();
  await command(cfg.ffmpeg, ['-version']);
  await command(cfg.ffprobe, ['-version']);
  const dir = path.resolve(cfg.outputDir, `${id}-${Date.now()}-${randomUUID().slice(0, 8)}`);
  await mkdir(dir, { recursive: true });
  const report: Record<string, unknown> = { scene: id, status: 'running', startedAt: new Date().toISOString(), privacyReviewRequired: true };
  const save = () => writeFile(path.join(dir, 'run.json'), JSON.stringify(report, null, 2));
  await save();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const login = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    await guardNetwork(login, cfg.origin, cfg.loginPostPaths);
    const page = await login.newPage();
    try {
    await page.goto(new URL(cfg.loginPath, cfg.origin).href);
    await page.getByLabel(/email/i).fill(cfg.email);
    await page.getByLabel(/password/i).fill(cfg.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.locator(cfg.authenticatedSelector).waitFor({ state: 'visible', timeout: 20000 });
    } catch { throw new Error('Authentication failed; verify synthetic credentials, login selectors and authentication POST paths'); }
    const storageState = await login.storageState();
    await login.close();
    const context = await browser.newContext({ storageState, serviceWorkers: 'block', acceptDownloads: false,
      viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
    const network = await guardNetwork(context, cfg.origin);
    const capture = await context.newPage();
    capture.setDefaultTimeout(10000);
    capture.on('dialog', dialog => { void dialog.dismiss(); });
    const video = capture.video()!;
    const recordingStart = performance.now();
    let result: Awaited<ReturnType<typeof direct>>;
    try {
      const target = new URL(scene.route, cfg.origin);
      if (target.origin !== cfg.origin) throw new Error('Scene leaves staging');
      await capture.goto(target.href, { waitUntil: 'domcontentloaded' });
      await capture.getByRole('heading', { name: scene.heading, exact: true }).waitFor({ state: 'visible' });
      result = await direct(capture, scene, claude(cfg.apiKey, cfg.model), dir, recordingStart);
      if (network.blocked) throw new Error('Blocked network activity; review staging dependencies before capture');
    } finally { await context.close(); }
    const media = await render(await video.path(), path.join(dir, 'candidate.mp4'), cfg.ffmpeg, cfg.ffprobe, result.evidence);
    if (process.env.MCP_VIDEO_CONFIG) {
      await editWithMcp(process.env.MCP_VIDEO_CONFIG, path.join(dir, 'candidate.mp4'), path.join(dir, 'mcp-edited.mp4'));
      report.externalMedia = await probeVideo(path.join(dir, 'mcp-edited.mp4'), cfg.ffprobe);
      // External edits require fresh visual review; never auto-publish them.
      report.externalEdit = 'mcp-edited.mp4';
      report.externalEditReviewRequired = true;
    }
    await rename(path.join(dir, 'candidate.mp4'), path.join(dir, `${id}.mp4`));
    await rename(path.join(dir, 'candidate.mp4.srt'), path.join(dir, `${id}.srt`));
    Object.assign(report, { status: 'complete', media, output: `${id}.mp4` });
  } catch (error) {
    Object.assign(report, { status: 'failed', error: error instanceof Error ? error.message : 'Unknown failure' });
    throw error;
  } finally {
    await browser?.close();
    report.finishedAt = new Date().toISOString();
    await save();
    console.log(`Run report: ${path.join(dir, 'run.json')}`);
  }
}
