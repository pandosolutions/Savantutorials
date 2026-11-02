import { decisionSchema, planSchema, reviewSchema, validatePlan, type Scene } from './contracts.ts';
import type { Ask } from './claude.ts';
import type { Page } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function perform(page: Page, action: Scene['actions'][number]) {
  if (action.kind === 'focus') {
    const target = page.locator(action.selector);
    if (await target.count() !== 1 || !await target.isVisible()) throw new Error(`Target unavailable: ${action.id}`);
    await target.focus();
  } else if (action.kind === 'navigate') {
    const link = page.locator(action.selector);
    if (await link.count() !== 1 || !await link.isVisible() || await link.evaluate(el => el.tagName) !== 'A') throw new Error('Navigation requires one visible anchor');
    const href = await link.getAttribute('href');
    if (!href) throw new Error('Navigation link has no href');
    const target = new URL(href, page.url());
    if (target.origin !== new URL(page.url()).origin || target.username || target.password) throw new Error('Navigation leaves staging');
    await page.goto(target.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: action.heading, exact: true }).waitFor({ state: 'visible' });
  } else if (action.kind === 'scroll') await page.mouse.wheel(0, action.pixels);
  await page.waitForTimeout(1400);
}
export async function direct(page: Page, scene: Scene, ask: Ask, dir: string, recordingStart = performance.now()) {
  const opening = await page.screenshot();
  const plan = validatePlan(await ask(`Plan a short tutorial for ${JSON.stringify(scene)}. Return {title,introduction,actionIds}. Use only declared actions supported by this opening screenshot.`, planSchema, [opening]), scene);
  await writeFile(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
  const remaining = new Set(plan.actionIds);
  const evidence: { id: string; narration: string; screenshot: string; start: number; end: number }[] = [];
  const frames: Buffer[] = [];
  while (remaining.size) {
    const shot = await page.screenshot();
    const decision = await ask(`Choose the next action from remaining IDs ${JSON.stringify([...remaining])}. Scene: ${JSON.stringify(scene)}. Plan: ${JSON.stringify(plan)}. Return {actionId,reason}.`, decisionSchema, [shot]);
    if (!remaining.has(decision.actionId)) throw new Error('Agent selected an unavailable action');
    const action = scene.actions.find(a => a.id === decision.actionId)!;
    const start = (performance.now() - recordingStart) / 1000;
    await perform(page, action);
    // Keep each caption on screen long enough to read.
    await page.waitForTimeout(Math.max(0, action.narration.length * 55 - 1400));
    const frame = await page.screenshot();
    const screenshot = `${String(evidence.length + 1).padStart(2, '0')}-${action.id}.png`;
    await writeFile(path.join(dir, screenshot), frame);
    frames.push(frame);
    evidence.push({ id: action.id, narration: action.narration, screenshot, start, end: (performance.now() - recordingStart) / 1000 });
    remaining.delete(action.id);
  }
  const review = await ask(`Review this tutorial against its declared features and narration. Scene: ${JSON.stringify(scene)}. Plan: ${JSON.stringify(plan)}. Evidence in frame order: ${JSON.stringify(evidence)}. Fail if any narration is unsupported, private information is visible, or an error/login page appears. Return {passed,issues,summary}. This is a visual check, not proof of absence of private data.`, reviewSchema, frames);
  await writeFile(path.join(dir, 'review.json'), JSON.stringify(review, null, 2));
  await writeFile(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  if (!review.passed || review.issues.length) throw new Error('AI review failed; inspect review.json');
  return { plan, evidence, review };
}
