import { config } from 'dotenv';
import { run } from '../src/studio.ts';
import type { Ask } from '../src/claude.ts';
config({ override: true, quiet: true });
process.env.ANTHROPIC_API_KEY = 'preflight-mock-no-provider-calls';
process.env.CLAUDE_MODEL = 'mock';
process.env.OUTPUT_DIR = 'test-output/staging-preflight';
const answers: unknown[] = [
  { title: 'Explore demo jobs', introduction: 'A synthetic staging preview.', actionIds: ['overview', 'browse'] },
  { actionId: 'overview', reason: 'Show feed' }, { actionId: 'browse', reason: 'Show listings' },
  { passed: true, issues: [], summary: 'MOCK REVIEW: technical preflight only; no AI quality review performed.' },
];
const ask: Ask = async (_prompt, schema) => schema.parse(answers.shift());
await run(['job-feed'], ask);
