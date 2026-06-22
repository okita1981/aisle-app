/**
 * Evidence KV シーダー
 * 使い方: node scripts/seed-evidence.mjs [clientSlug]
 * 省略時は "aisle" として投入する
 *
 * 前提: .env.local に KV_REST_API_URL と KV_REST_API_TOKEN が設定されていること
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// .env.local から環境変数を読み込む
function loadEnv() {
  const envPath = resolve(__dir, '../.env.local');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn('[seed] .env.local が見つかりません。環境変数から読み込みます。');
  }
}

loadEnv();

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error('[seed] KV_REST_API_URL または KV_REST_API_TOKEN が未設定です');
  process.exit(1);
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
  const data = await res.json();
  const result = data.result;
  if (typeof result === 'string') {
    try { return JSON.parse(result); } catch { return result; }
  }
  return result;
}

// ── Aisle 自社 Evidence（high confidence のみ）──────────────────────────

const AISLE_EVIDENCE = [
  {
    type: 'case',
    title: 'Aisle自社 Phase0〜4 パイロット実装',
    description: 'Aisle自身がPhase0〜4を通して自社の出現設計を設計・実装した自社実装例。問い別ページを app.aisle-aio.ai/aisle/questions/ として公開中。',
    entityRole: '自社実装例',
    value: null,
    tags: ['自社実装例', 'Phase0-4', '問い別ページ', 'パイロット'],
  },
  {
    type: 'case',
    title: 'RefBase 公開Reference例（recommendation-001）',
    description: 'refbase.ai/reference/aisle/recommendation-001 として公開済みのAI参照向け構造化知識ページ。FAQPage JSON-LD / BreadcrumbList付きの公開Reference実例。',
    entityRole: '公開Reference例',
    value: null,
    tags: ['公開Reference例', 'JSON-LD', 'FAQPage', 'RefBase'],
  },
  {
    type: 'case',
    title: 'Aisle → RefBase 保存・取得ループ（本番稼働）',
    description: 'Aisleで問い別ページを生成した直後にsaveToRefBase()を経由してRefBaseのKVに自動保存・refbase.ai上で公開されるループが本番環境で稼働している実装例。',
    entityRole: '本番稼働実装例',
    value: null,
    tags: ['本番稼働', '自動保存', 'KVループ', 'RefBase', 'saveToRefBase'],
  },
  {
    type: 'method',
    title: '出現設計5フェーズ（Phase0〜4）プロセス',
    description: 'Phase0（P-ID分類）→ Phase1（K-ID因果分析）→ Phase2（M-ID出現設計）→ Phase3（突合診断）→ Phase4（実装・ページ生成）の体系的プロセス。各フェーズがAPIとして実装済み。',
    entityRole: '設計・実装プロセス',
    value: null,
    tags: ['P-ID分類', 'K-ID診断', 'M-ID設計', '5フェーズ', '出現設計'],
  },
  {
    type: 'method',
    title: 'Evidence収集・スコアリングによる選択手法',
    description: 'case / client / credential / media など10タイプのEvidenceを収集し、TYPE_BASE_SCOREとP-IDウェイトにより問い別に最適なEvidenceを自動選択・優先化する独自手法。実装済み。',
    entityRole: 'Evidence選択手法',
    value: null,
    tags: ['Evidence収集', 'P-IDウェイト', '自動選択', 'スコアリング'],
  },
  {
    type: 'method',
    title: '評価軸抽出（evaluationAxes）による問い分析',
    description: '問いとプロダクトカテゴリから「AIが回答時に使う評価軸」「関連語彙」「期待される回答形式」を自動抽出し、Evidence選択とAfter構文生成に反映させる分析手法。実装済み。',
    entityRole: '問い分析手法',
    value: null,
    tags: ['評価軸抽出', '問い分析', 'keyTerms', 'primaryAxes'],
  },
  {
    type: 'method',
    title: '問い別ページ自動生成パイプライン',
    description: 'P-IDに応じた回答構造（answer / evidencePoints / scope / differentiation / faq）をClaudeが生成し、JSON-LD付きHTMLとしてVercel KVへ自動保存・公開するパイプライン。実装済み。',
    entityRole: 'ページ生成パイプライン',
    value: null,
    tags: ['自動生成', 'Claude API', 'JSON-LD', 'パイプライン', '問い別ページ'],
  },
  {
    type: 'feature',
    title: 'RefBase — AI参照知識基盤（refbase.ai）',
    description: '企業・サービスの問い別回答・Evidence・FAQをAIが取得・参照しやすい構造化ページとして公開する専用プラットフォーム。llms.txt対応・Entity/Referenceの2層構造で公開中。',
    entityRole: 'AI参照知識基盤',
    value: null,
    tags: ['RefBase', 'AI参照', '知識基盤', 'Entity', 'Reference', 'llms.txt'],
  },
  {
    type: 'feature',
    title: 'RefBase Reference ページ構造（5セクション + JSON-LD）',
    description: 'answer / evidencePoints / scope / differentiation / faq の5セクション構成。FAQPage + BreadcrumbList JSON-LDを付与。AIが問いへの回答として直接引用できる構造で公開。',
    entityRole: 'AI引用最適化構造',
    value: null,
    tags: ['5セクション', 'FAQPage JSON-LD', 'AI引用', 'Reference構造'],
  },
  {
    type: 'feature',
    title: 'AI向けEntityページ（refbase.ai/entity/{id}）',
    description: '企業単位のEntityハブページ。全Referenceへのリンク・企業カテゴリ・更新日を構造化して公開。AIが企業の全問い別回答を一覧で取得できる設計。JSON API対応。',
    entityRole: 'EntityハブページMT',
    value: null,
    tags: ['Entityページ', '全Reference一覧', 'JSON API', 'ハブ'],
  },
  {
    type: 'feature',
    title: 'llms.txt — AI向けコンテンツインデックス（2箇所公開）',
    description: 'app.aisle-aio.ai/llms.txt と refbase.ai/llms.txt の両方で公開。AIクローラーが全コンテンツのURL・目的・更新日を把握できる形式で索引化済み。',
    entityRole: 'AIクローラー対応',
    value: null,
    tags: ['llms.txt', 'AIクローラー', '2箇所公開', 'インデックス'],
  },
  {
    type: 'feature',
    title: 'P-ID × K-ID × M-ID 設計フレームワーク',
    description: '問いの型（P-ID: 6種）× 阻害要因（K-ID: 10種）× 意味接点（M-ID: 13種）の3軸構造。AIが特定の問いに答える際の出現阻害要因を特定し設計方針を導く独自フレームワーク。',
    entityRole: '独自設計フレームワーク',
    value: null,
    tags: ['P-ID 6種', 'K-ID 10種', 'M-ID 13種', '3軸構造', 'フレームワーク'],
  },
  {
    type: 'feature',
    title: 'ChatGPT / Claude / Gemini / Perplexity 横断出現設計',
    description: '設計対象AIを4エンジン（OpenAI / Anthropic / Google / Perplexity）に設定。各エンジンのRAG・引用・回答生成の違いを踏まえた出現設計・Seed・Test Modeを横断対応。',
    entityRole: '4エンジン対応',
    value: null,
    tags: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', '4エンジン', '横断対応'],
  },
  {
    type: 'comparison',
    title: 'SEO vs AI出現設計 — 設計対象の構造的違い',
    description: 'SEOが人間の検索行動（クリック・ランキング）に最適化するのに対し、AI出現設計はAIの生成プロセス（引用・推薦・文脈統合）に最適化する。設計対象・成功指標・評価軸が根本的に異なる。',
    entityRole: 'SEO比較・差別化軸',
    value: null,
    tags: ['SEO比較', 'AI生成プロセス', '設計対象の違い', '差別化'],
  },
  {
    type: 'comparison',
    title: 'コンサル提案書型 vs 設計・実装一体型インフラ',
    description: '従来のコンサルは「提案書の納品で終わる」のに対し、Aisleは設計結果を直接公開ページとして実装するインフラ型。成果物はHTMLページ・RefBase Reference・llms.txtとして公開される。',
    entityRole: 'インフラ型の差別化',
    value: null,
    tags: ['インフラ型', '設計実装一体', '公開物あり', 'コンサル比較'],
  },
];

// ── 実行 ────────────────────────────────────────────────────────────────

const clientSlug = process.argv[2] ?? 'aisle';
const kvKey = `evidence:${clientSlug}`;

console.log(`\n[seed-evidence] clientSlug: ${clientSlug}`);
console.log(`[seed-evidence] KV key: ${kvKey}`);
console.log(`[seed-evidence] 件数: ${AISLE_EVIDENCE.length} 件\n`);

// 既存データ確認
const existing = await kvGet(kvKey);
if (existing) {
  console.log(`[seed-evidence] 既存データあり（${existing.length} 件）→ 上書きします`);
} else {
  console.log('[seed-evidence] 既存データなし → 新規登録します');
}

await kvSet(kvKey, AISLE_EVIDENCE);

// 確認読み込み
const saved = await kvGet(kvKey);
console.log(`\n[seed-evidence] ✅ 保存完了: ${saved?.length ?? 0} 件`);
console.log('[seed-evidence] 内訳:');
const counts = {};
for (const e of saved ?? []) counts[e.type] = (counts[e.type] ?? 0) + 1;
for (const [type, n] of Object.entries(counts).sort()) {
  console.log(`  ${type.padEnd(12)} ${n} 件`);
}
