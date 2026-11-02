import type { BrowserContext } from 'playwright';
export async function guardNetwork(context: BrowserContext, origin: string, postPaths: string[] = [], stagingApiOrigin?: string) {
  let blocked = 0;
  const blockedRequests: string[] = [];
  const staticOrigins = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://accounts.google.com', 'https://ssl.gstatic.com']);
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(req.method());
    const local = url.origin === origin && (read || (req.method() === 'POST' && postPaths.includes(url.pathname)));
    // Explicit background session/last-active operations and the read-only ratings RPC.
    const apiPost = ['/auth/v1/token', '/rest/v1/rpc/touch_last_active', '/rest/v1/rpc/employer_rating_inputs'];
    const api = stagingApiOrigin && url.origin === stagingApiOrigin && (read || (req.method() === 'POST' && apiPost.includes(url.pathname)));
    const asset = read && staticOrigins.has(url.origin) && !req.isNavigationRequest();
    const safe = local || api || asset;
    if (!safe) { blocked++; blockedRequests.push(`${req.method()} ${url.origin}${url.pathname}`); }
    await (safe ? route.continue() : route.abort());
  });
  await context.routeWebSocket('**/*', socket => {
    const url = new URL(socket.url());
    // Keep optional staging notifications disconnected; no socket messages are forwarded.
    const optionalNotifications = stagingApiOrigin && url.protocol === 'wss:' && url.host === new URL(stagingApiOrigin).host && url.pathname === '/realtime/v1/websocket';
    if (!optionalNotifications) { blocked++; blockedRequests.push(`WEBSOCKET ${url.origin}${url.pathname}`); }
    socket.close();
  });
  return { get blocked() { return blocked; }, blockedRequests };
}
