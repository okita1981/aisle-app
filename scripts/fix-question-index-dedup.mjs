/**
 * page-question-index:{clientSlug} の重複・幽霊エントリを補正するスクリプト
 *
 * 背景: questionSlug採番が「既存件数+1」方式だったため、削除→再追加のタイミングで
 * 既存slugと衝突し、page-question-index に同一questionSlugが複数行（別promptText）で
 * 残ってしまうケースが発生していた（recommendation-002の重複等）。
 *
 * このスクリプトは：
 *   1. refbase:index:all から全clientSlugを走査
 *   2. 各clientSlugの page-question-index と refbase:index の整合性を検査
 *   3. page-question-index内の重複questionSlugを検出し、
 *      実体（refbase:ref:{clientSlug}/{questionSlug}）のpromptTextと一致する1件だけを残す
 *   4. page-question-index にあるが refbase:ref に実体が無いエントリ（幽霊）を検出（ログのみ、削除はしない）
 *   5. refbase:index にあるが page-question-index に無いエントリを検出（ログのみ）
 *   6. 補正前後の状態をログ出力し、変更があった場合のみ page-question-index を書き戻す
 *
 * 使い方: node scripts/fix-question-index-dedup.mjs           （dry-run: 検査のみ、書き込みしない）
 *         node scripts/fix-question-index-dedup.mjs --apply   （実際に書き戻す）
 *
 * 前提: .env.local に KV_REST_API_URL と KV_REST_API_TOKEN が設定されていること
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

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

async function kvSet(key, value) {
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

console.log(APPLY ? '=== 補正モード（書き込みあり） ===' : '=== dry-run モード（検査のみ・書き込みなし） ===');

const clientSlugs = (await kvGet('refbase:index:all')) ?? [];
console.log(`対象 clientSlug: ${clientSlugs.length}件 [${clientSlugs.join(', ')}]\n`);

for (const clientSlug of clientSlugs) {
  console.log(`--- clientSlug=${clientSlug} ---`);

  const qIndex = (await kvGet(`page-question-index:${clientSlug}`)) ?? [];
  const refIndex = (await kvGet(`refbase:index:${clientSlug}`)) ?? [];

  // 1. page-question-index 内の questionSlug 重複を検出
  const bySlug = new Map();
  for (const entry of qIndex) {
    if (!bySlug.has(entry.questionSlug)) bySlug.set(entry.questionSlug, []);
    bySlug.get(entry.questionSlug).push(entry);
  }
  const duplicated = [...bySlug.entries()].filter(([, list]) => list.length > 1);

  if (duplicated.length === 0) {
    console.log('  重複なし。');
  }

  const correctedEntries = [];
  let changed = false;

  for (const [slug, entries] of bySlug) {
    if (entries.length === 1) {
      correctedEntries.push(entries[0]);
      continue;
    }

    // 重複あり: 実体（refbase:ref）の promptText と一致するものを正とする
    console.log(`  ⚠ 重複検出: ${slug} (${entries.length}件)`);
    entries.forEach((e, i) => console.log(`     [${i}] promptText="${e.promptText.slice(0, 50)}" generatedAt=${e.generatedAt}`));

    const actualRef = await kvGet(`refbase:ref:${clientSlug}/${slug}`);
    let survivor = null;

    if (actualRef) {
      survivor = entries.find(e => e.promptText === actualRef.promptText);
    }
    if (!survivor) {
      // 実体と一致するものが無い場合は generatedAt が最新のものを残す（最も保守的な選択）
      survivor = entries.reduce((latest, e) => (e.generatedAt > latest.generatedAt ? e : latest));
      console.log(`     → 実体と一致するエントリなし。最新(generatedAt)を採用: promptText="${survivor.promptText.slice(0, 50)}"`);
    } else {
      console.log(`     → 実体と一致するエントリを採用: promptText="${survivor.promptText.slice(0, 50)}"`);
    }

    correctedEntries.push(survivor);
    changed = true;
  }

  // 2. page-question-index にあるが refbase:ref に実体が無い（幽霊）エントリ検出
  for (const entry of correctedEntries) {
    const actualRef = await kvGet(`refbase:ref:${clientSlug}/${entry.questionSlug}`);
    if (!actualRef) {
      console.log(`  ⚠ 幽霊エントリ（実体なし、削除はしません）: ${entry.questionSlug}`);
    }
  }

  // 3. refbase:index にあるが page-question-index に無いエントリ検出
  const qSlugs = new Set(correctedEntries.map(e => e.questionSlug));
  for (const slug of refIndex) {
    if (!qSlugs.has(slug)) {
      console.log(`  ⚠ refbase:index にあるが page-question-index に無い: ${slug}`);
    }
  }

  if (changed) {
    console.log(`  → page-question-index:${clientSlug} を ${qIndex.length}件 → ${correctedEntries.length}件 に補正`);
    if (APPLY) {
      const ok = await kvSet(`page-question-index:${clientSlug}`, correctedEntries);
      console.log(`  ${ok ? '✓ 書き込み完了' : '✗ 書き込み失敗'}`);
    } else {
      console.log('  (dry-runのため書き込みはスキップ)');
    }
  }

  console.log('');
}

console.log('=== 検査完了 ===');
if (!APPLY) {
  console.log('実際に補正を反映するには --apply を付けて再実行してください。');
}
