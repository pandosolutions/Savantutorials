import { config } from 'dotenv';
// Explicit local credentials take precedence over stale desktop environment values.
config({ override: true, quiet: true });
import { run } from './studio.ts';
run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
