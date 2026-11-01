import 'dotenv/config';
import { run } from './studio.ts';
run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
