import { z } from 'zod';
export function stagingOrigin(base: string, allowed: string): string {
  const url = new URL(base);
  const production = /(^|\.)savantalent\.com$/i.test(url.hostname) && !/^staging\./i.test(url.hostname);
  if (url.protocol !== 'https:' || url.username || url.password || production || url.origin !== allowed || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an isolated HTTPS staging origin and set STAGING_ALLOWED_ORIGIN to that exact origin');
  return url.origin;
}
export function config(env = process.env) {
  const required = (name: string) => { if (!env[name]) throw new Error(`${name} required`); return env[name]!; };
  return {
    origin: stagingOrigin(required('STAGING_BASE_URL'), required('STAGING_ALLOWED_ORIGIN')),
    email: required('TALENT_EMAIL'), password: required('TALENT_PASSWORD'),
    model: required('CLAUDE_MODEL'), apiKey: required('ANTHROPIC_API_KEY'),
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg', ffprobe: env.FFPROBE_PATH || 'ffprobe',
    loginPath: env.LOGIN_PATH || '/login', authenticatedSelector: required('AUTHENTICATED_SELECTOR'),
    loginPostPaths: z.array(z.string().startsWith('/')).parse(JSON.parse(env.LOGIN_POST_PATHS || '[]')),
    outputDir: env.OUTPUT_DIR || 'output',
  };
}
export type Config = ReturnType<typeof config>;
