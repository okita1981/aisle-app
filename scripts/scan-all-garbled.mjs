import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dir, '../.env.local');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  const raw = json.result;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      const once = JSON.parse(raw);
      if (typeof once === 'string') return JSON.parse(once);
      return once;
    } catch { return raw; }
  }
  return raw;
}

function hasGarbledText(str) {
  if (!str) return false;
  if (str.includes('�')) return true;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0xD800 && code <= 0xDFFF) return true;
  }
  return false;
}

const lines = [];
const clientSlugs = (await kvGet('refbase:index:all')) ?? [];
lines.push(`scan target clientSlugs: ${clientSlugs.join(', ')}`);

let issueCount = 0;

for (const clientSlug of clientSlugs) {
  const refIndex = (await kvGet(`refbase:index:${clientSlug}`)) ?? [];
  for (const questionSlug of refIndex) {
    const ref = await kvGet(`refbase:ref:${clientSlug}/${questionSlug}`);
    if (!ref) {
      lines.push(`  [MISSING] ${clientSlug}/${questionSlug} refbase:ref not found`);
      issueCount++;
      continue;
    }
    const fields = [
      ['promptText', ref.promptText],
      ['answer', ref.answer],
      ['scope', ref.scope],
      ['differentiation', ref.differentiation],
    ];
    for (const [name, val] of fields) {
      if (hasGarbledText(val)) {
        lines.push(`  [GARBLED] ${clientSlug}/${questionSlug}.${name}: "${(val || '').slice(0, 60)}"`);
        issueCount++;
      }
    }
    (ref.evidencePoints || []).forEach((e, i) => {
      if (hasGarbledText(e)) {
        lines.push(`  [GARBLED] ${clientSlug}/${questionSlug}.evidencePoints[${i}]: "${e.slice(0, 60)}"`);
        issueCount++;
      }
    });
    (ref.faq || []).forEach((f, i) => {
      if (hasGarbledText(f.question)) {
        lines.push(`  [GARBLED] ${clientSlug}/${questionSlug}.faq[${i}].question`);
        issueCount++;
      }
      if (hasGarbledText(f.answer)) {
        lines.push(`  [GARBLED] ${clientSlug}/${questionSlug}.faq[${i}].answer`);
        issueCount++;
      }
    });
    (ref.sourceEvidence || []).forEach((s, i) => {
      if (hasGarbledText(s.title) || hasGarbledText(s.description)) {
        lines.push(`  [GARBLED] ${clientSlug}/${questionSlug}.sourceEvidence[${i}]`);
        issueCount++;
      }
    });
  }

  // entity自体もチェック
  const entity = await kvGet(`refbase:company:${clientSlug}`);
  if (entity) {
    if (hasGarbledText(entity.name) || hasGarbledText(entity.category)) {
      lines.push(`  [GARBLED] entity ${clientSlug}: name/category`);
      issueCount++;
    }
  }
}

lines.push(`\n=== TOTAL ISSUES (true U+FFFD / lone surrogate): ${issueCount} ===`);

writeFileSync(resolve(__dir, '../../scan-garbled-result.txt'), lines.join('\n'), 'utf8');
console.log('done, see scan-garbled-result.txt, issueCount=' + issueCount);
