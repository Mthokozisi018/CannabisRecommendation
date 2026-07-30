import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

const allowedTextExtensions = new Set([
  "", ".css", ".env", ".example", ".html", ".js", ".json", ".jsx",
  ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt", ".yaml", ".yml"
]);
const checks = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Supabase-style JWT", pattern: /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/ },
  { name: "credentialed PostgreSQL URL", pattern: /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@/i },
  {
    name: "populated server secret assignment",
    pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|CSRF_SECRET|SESSION_SIGNING_SECRET|RATE_LIMIT_KEY_SECRET)[ \t]*=[ \t]*(?!(?:your[-_]|replace|example|placeholder|changeme|<))[^\s#]{16,}/i
  }
];

const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: process.cwd(), encoding: "utf8" }
);
const files = output.split(/\r?\n/).filter(Boolean);
const findings = [];

for (const relativePath of files) {
  const extension = extname(relativePath).toLowerCase();
  if (!allowedTextExtensions.has(extension)) continue;
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) continue;
  if (statSync(absolutePath).size > 1_000_000) continue;
  const content = readFileSync(absolutePath, "utf8");
  for (const check of checks) {
    if (check.pattern.test(content)) findings.push(`${relativePath}: ${check.name}`);
  }
}

if (findings.length > 0) {
  console.error(`Secret scan failed (${findings.length} potential finding${findings.length === 1 ? "" : "s"}). Values are intentionally not printed.`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed for ${files.length} tracked and pending files.`);
}
