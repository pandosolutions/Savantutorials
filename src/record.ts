import "dotenv/config";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

const routes: Record<string,string> = {
  "job-feed": "/talent/jobs",
  applications: "/talent/applications",
  coach: "/talent/coach",
};
const scene = process.argv[2];
if (!scene || !(scene in routes)) {
  throw new Error("Supported scenes: " + Object.keys(routes).join(", "));
}
const base = process.env.STAGING_BASE_URL;
if (!base) throw new Error("STAGING_BASE_URL required");
const origin = new URL(base);
if (origin.protocol !== "https:" || /^(www\.)?savantalent\.com$/.test(origin.hostname)) {
  throw new Error("Only isolated HTTPS staging environments are allowed");
}
if (!process.env.TALENT_EMAIL || !process.env.TALENT_PASSWORD) {
  throw new Error("Synthetic Talent account credentials required");
}
const dir = path.resolve("output", scene);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
try {
  await page.goto(new URL("/login", base).toString(), { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(process.env.TALENT_EMAIL);
  await page.getByLabel(/password/i).fill(process.env.TALENT_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.goto(new URL(routes[scene], base).toString(), { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const heading = page.getByRole("heading").first();
  if (!(await heading.isVisible())) throw new Error("Scene heading not found");
  if (scene === "applications") {
    const select = page.getByRole("combobox", { name: /application progress/i }).first();
    if (await select.count()) await select.focus(); // do not mutate status
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(dir, "thumbnail.png") });
} finally {
  await context.close();
  await browser.close();
}
const recordings = (await readdir(dir)).filter(f => f.endsWith(".webm"));
if (!recordings.length) throw new Error("No browser recording produced");
const source = path.join(dir, recordings.at(-1)!);
const output = path.join(dir, scene + ".mp4");
const ff = spawnSync("ffmpeg", ["-y", "-i", source, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
if (ff.status !== 0) throw new Error("FFmpeg render failed");
console.log("Rendered:", output);
