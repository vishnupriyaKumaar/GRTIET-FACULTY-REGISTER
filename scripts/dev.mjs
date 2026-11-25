// npm run dev : starts the local test database server and the web app together
import { spawn } from 'node:child_process';
const run = (args) => spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
const api = run(['scripts/dev-api.mjs']);
const web = run(['node_modules/vite/bin/vite.js', ...process.argv.slice(2)]);
const stop = () => { api.kill(); web.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
web.on('exit', stop);
