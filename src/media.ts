import { spawn } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
export type Segment = { start: number; end: number; narration: string };
export function subtitles(segments: Segment[]) {
  let cursor = 0;
  const stamp = (s: number) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23).replace('.', ',');
  return segments.map((s, i) => {
    const start = cursor; cursor += s.end - s.start;
    return `${i + 1}\n${stamp(start)} --> ${stamp(cursor)}\n${s.narration.replace(/[\r\n]+/g, ' ')}\n`;
  }).join('\n');
}
export function command(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${executable} timed out`)); }, 120_000);
    child.stdout.on('data', data => { output = (output + data).slice(-20000); });
    child.stderr.on('data', () => {});
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(`${executable} failed (${code})`)); });
  });
}
export async function render(source: string, output: string, ffmpeg: string, ffprobe: string, segments: Segment[]) {
  if (!segments.length || segments.some(s => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start)) throw new Error('Invalid edit segments');
  const captionPath = output + '.srt';
  await writeFile(captionPath, subtitles(segments));
  const cuts = segments.map((s, i) => `[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}]`).join(';');
  const join = segments.map((_, i) => `[v${i}]`).join('');
  const filter = `${cuts};${join}concat=n=${segments.length}:v=1:a=0,fps=30,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2[out]`;
  await command(ffmpeg, ['-y', '-i', source, '-i', captionPath, '-filter_complex', filter, '-map', '[out]', '-map', '1:0', '-an', '-c:v', 'libx264', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
  return probeVideo(output, ffprobe);
}
export async function probeVideo(output: string, ffprobe: string) {
  const probe = JSON.parse(await command(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
  if (!probe.streams?.some((s: { codec_name: string; width: number; height: number }) => s.codec_name === 'h264' && s.width === 1440 && s.height === 900) || !(Number(probe.format?.duration) > 0) || !(await stat(output)).size) throw new Error('Rendered video failed media validation');
  return { duration: Number(probe.format.duration), bytes: (await stat(output)).size };
}
