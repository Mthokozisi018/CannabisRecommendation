import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const env={...process.env};
for(const name of readdirSync('.').filter(n=>n==='.env'||n.startsWith('.env.'))){for(const line of readFileSync(name,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);if(match)env[match[1]]='';}}
for(const key of Object.keys(env))if(/SUPABASE|SENTRY|UPSTASH|REDIS|VERCEL|DATABASE_URL/.test(key))env[key]='';
env.CI='';env.NEXT_TELEMETRY_DISABLED='1';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:'inherit'});child.on('exit',code=>process.exit(code??1));
