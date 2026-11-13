import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads `.env` and `.env.local` in CLI/worker scripts using Node 22 native loader
 * or simple fallback parser without extra package dependency.
 */
export function loadEnvFiles(): void {
  const cwd = process.cwd();
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFiles();

