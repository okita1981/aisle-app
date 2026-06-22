import { readFileSync } from 'fs';
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

function charCodes(str, n = 30) {
  return [...str.slice(0, n)].map(c => c.codePointAt(0).toString(16)).join(' ');
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

const ref = await kvGet('refbase:ref:aisle/recommendation-002');
const qIndex = await kvGet('page-question-index:aisle');
const html = await kvGet('page:question:aisle/recommendation-002');

console.log('=== refbase:ref:aisle/recommendation-002 ===');
console.log('promptText:', JSON.stringify(ref.promptText));
console.log('  hasGarbledText:', hasGarbledText(ref.promptText));
console.log('  codepoints:', charCodes(ref.promptText));
console.log('answer (先頭80文字):', JSON.stringify(ref.answer.slice(0, 80)));
console.log('  hasGarbledText:', hasGarbledText(ref.answer));
console.log('faq[0].question:', JSON.stringify(ref.faq[0]?.question));
console.log('  hasGarbledText:', hasGarbledText(ref.faq[0]?.question ?? ''));

console.log('\n=== page-question-index:aisle (recommendation-002のエントリ) ===');
const qEntry = qIndex.find(e => e.questionSlug === 'recommendation-002');
console.log('promptText:', JSON.stringify(qEntry?.promptText));
console.log('  hasGarbledText:', hasGarbledText(qEntry?.promptText ?? ''));
console.log('  codepoints:', charCodes(qEntry?.promptText ?? ''));

console.log('\n=== page:question:aisle/recommendation-002 (HTML) ===');
const titleMatch = html.match(/<title>([^<]*)<\/title>/);
console.log('title:', titleMatch ? JSON.stringify(titleMatch[1]) : 'NOT FOUND');
console.log('  hasGarbledText:', hasGarbledText(titleMatch?.[1] ?? ''));
const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/);
console.log('h1:', h1Match ? JSON.stringify(h1Match[1]) : 'NOT FOUND');
