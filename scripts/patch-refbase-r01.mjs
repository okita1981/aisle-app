/**
 * R-01 パッチスクリプト
 * 対象: refbase:ref:aisle/{slug} の pageUrl を RefBase URL に修正
 *       recommendation-001 の promptText も正常値に修正
 *
 * 使い方: node scripts/patch-refbase-r01.mjs
 *
 * 前提: .env.local に KV_REST_API_URL と KV_REST_API_TOKEN が設定されていること
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dir, '../.env.local');
  try {
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
  } catch {
    console.error('.env.local が見つかりません');
    process.exit(1);
  }
}

loadEnv();

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error('KV_REST_API_URL または KV_REST_API_TOKEN が未設定です');
  process.exit(1);
}

const REFBASE_BASE = 'https://www.refbase.ai';

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  const raw = json.result;
  if (raw === null || raw === undefined) return null;
  // @vercel/kv は JSON.stringify してから保存するため、REST API では string が返る。
  // 過去の実装で二重 stringify になっていた場合は三重エンコードになっているため、
  // 文字列の場合は 2 回パースして元のオブジェクトを取り出す。
  if (typeof raw === 'string') {
    try {
      const once = JSON.parse(raw);
      if (typeof once === 'string') return JSON.parse(once); // 三重エンコード対応
      return once;
    } catch { return raw; }
  }
  return raw;
}

async function kvSet(key, value) {
  // single stringify で保存 → kv.get<T>() が 1 回 JSON.parse して object を返せる形式
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
  return res.ok;
}

// promptText の U+FFFD チェック
function countBad(str) {
  return [...str].filter(c => c === '�').length;
}

// パッチ対象
const PATCHES = [
  {
    slug: 'recommendation-001',
    // page-question-index から確認済みの正常テキスト
    correctPromptText: 'AIの回答に自社を出したい場合はどこに相談すればいいですか？',
  },
  {
    slug: 'citation-001',
    correctPromptText: null, // 再生成で修正予定
  },
  {
    slug: 'why-recommended-001',
    correctPromptText: null, // 再生成で修正予定
  },
];

for (const patch of PATCHES) {
  const key = `refbase:ref:aisle/${patch.slug}`;
  console.log(`\n--- ${patch.slug} ---`);

  const ref = await kvGet(key);
  if (!ref) {
    console.log('  ⚠ データなし。スキップ。');
    continue;
  }

  const badCount = countBad(ref.promptText);
  console.log(`  現状 promptText (${ref.promptText.length}文字, bad=${badCount}): ${ref.promptText.slice(0, 60)}`);
  console.log(`  現状 pageUrl: ${ref.pageUrl}`);

  const newPageUrl = `${REFBASE_BASE}/reference/aisle/${patch.slug}`;
  const updated = {
    ...ref,
    pageUrl: newPageUrl,
    ...(patch.correctPromptText ? { promptText: patch.correctPromptText } : {}),
  };

  console.log(`  → pageUrl: ${newPageUrl}`);
  if (patch.correctPromptText) {
    console.log(`  → promptText: ${patch.correctPromptText}`);
  } else {
    console.log(`  → promptText: 変更なし (再生成で修正予定)`);
  }

  const ok = await kvSet(key, updated);
  console.log(`  ${ok ? '✓ 保存完了' : '✗ 保存失敗'}`);
}

console.log('\n=== パッチ完了 ===');
console.log('citation-001 と why-recommended-001 の promptText は Aisle APP から update モードで再生成してください。');
