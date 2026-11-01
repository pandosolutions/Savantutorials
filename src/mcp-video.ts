import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const settings = z.object({ command: z.string().min(1), args: z.array(z.string()).default([]), tool: z.string().min(1), arguments: z.record(z.string(), z.unknown()) }).strict();
export async function editWithMcp(configFile: string, input: string, output: string) {
  const cfg = settings.parse(JSON.parse(await readFile(configFile, 'utf8')));
  const expand = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replaceAll('{{input}}', input).replaceAll('{{output}}', output);
    if (Array.isArray(value)) return value.map(expand);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v)]));
    return value;
  };
  const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args, stderr: 'ignore', env: { PATH: process.env.PATH || '', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) } });
  const client = new Client({ name: 'savant-tutorial-studio', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 15000 });
    const { tools } = await client.listTools({}, { timeout: 15000 });
    if (!tools.some(t => t.name === cfg.tool)) throw new Error(`Configured MCP editor tool is unavailable: ${cfg.tool}`);
    const result = await client.callTool({ name: cfg.tool, arguments: expand(cfg.arguments) as Record<string, unknown> }, undefined, { timeout: 120000 });
    if (result.isError) throw new Error('MCP video tool reported failure');
    // Caller validates the actual file, never a success claim in a tool response.
  } finally { await client.close(); await transport.close(); }
}
