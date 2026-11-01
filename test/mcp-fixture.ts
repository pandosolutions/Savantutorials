import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { copyFile } from 'node:fs/promises';
const server = new McpServer({ name: 'fixture-editor', version: '1.0.0' });
server.registerTool('copy_video', { inputSchema: { input: z.string(), output: z.string() } }, async ({ input, output }) => {
  await copyFile(input, output);
  return { content: [{ type: 'text', text: 'copied' }] };
});
await server.connect(new StdioServerTransport());
