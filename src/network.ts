import type { BrowserContext } from 'playwright';
export async function guardNetwork(context: BrowserContext, origin: string, postPaths: string[] = []) {
  let blocked = 0;
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    const safe = url.origin === origin && (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || (req.method() === 'POST' && postPaths.includes(url.pathname)));
    if (!safe) blocked++;
    await (safe ? route.continue() : route.abort());
  });
  await context.routeWebSocket('**/*', socket => { blocked++; socket.close(); });
  return { get blocked() { return blocked; } };
}
