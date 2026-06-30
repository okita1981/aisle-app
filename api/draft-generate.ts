/**
 * /api/draft-generate — S3-1
 *
 * Authoring Workbench「Generate」ステップ本体。
 * 1リクエスト = 1 instanceId に対する1回の生成試行（Draft 1件）。
 * 同一 instanceId に対して複数回呼び出せば、複数 Draft（複数LLM・複数試行）が
 * フロント側に並存できる設計（Question Instance : Draft = 1 : N）。
 *
 * KV書き込み: なし。Reference / page系 / QI の保存は一切行わない。
 * Coverage Gate / Question Instance 解決は /api/qi-resolve が担当済みである前提で、
 * 既に解決済みの instanceId / promptText を入力として受け取るのみ。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type {
  ChildPageNarrative,
  Draft,
  DraftGenerateRequest,
  DraftGenerateResponse,
  EvidenceItemInput,
} from './_draft-types.js';

export const config = { maxDuration: 60 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_MODEL = 'claude-sonnet-4-6';

// ── 認可（coverage-report.ts と同一方針） ───────────────────────────────────
function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

// ── Evidence Tier 分類（page-generate.ts と同一ロジック） ──────────────────

const T2_SOURCE_TYPES = new Set(['media_mention', 'award', 'review_platform', 'external_db']);

function classifyEvidenceTier(item: EvidenceItemInput): 'T1' | 'T2' | 'T3' {
  const isVerified = item.confidence === 'high' && item.needsVerification !== true;
  if (!isVerified) return 'T3';
  return item.sourceType && T2_SOURCE_TYPES.has(item.sourceType) ? 'T2' : 'T1';
}

function splitEvidenceByTier(items: EvidenceItemInput[]): {
  verified: EvidenceItemInput[];
  needsVerification: EvidenceItemInput[];
} {
  const verified: EvidenceItemInput[] = [];
  const needsVerification: EvidenceItemInput[] = [];
  for (const item of items) {
    const tier = classifyEvidenceTier(item);
    if (tier === 'T1' || tier === 'T2') verified.push(item);
    else needsVerification.push(item);
  }
  return { verified, needsVerification };
}

const EVIDENCE_TYPE_BASE_SCORE: Record<string, number> = {
  case:         4,
  client:       3,
  credential:   3,
  media:        3,
  metric:       2,
  comparison:   2,
  method:       2,
  feature:      1,
  availability: 1,
  review:       1,
  other:        0,
};

function sortEvidenceByPriority(items: EvidenceItemInput[]): EvidenceItemInput[] {
  return [...items].sort(
    (a, b) => (EVIDENCE_TYPE_BASE_SCORE[b.type] ?? 0) - (EVIDENCE_TYPE_BASE_SCORE[a.type] ?? 0),
  );
}

// ── FAQ guidance per P-ID（page-generate.ts と同一） ───────────────────────

const FAQ_GUIDANCE_MAP: Record<string, string> = {
  'P-01': '選定基準・候補の条件・比較軸・検討の進め方・注意点',
  'P-02': '比較の切り口・違いの見つけ方・用途別の向き不向き・導入前の確認事項',
  'P-03': '選定基準・候補の条件・カテゴリ間の違い・検討の注意点',
  'P-04': '課題の起点・解決策の選び方・向いているケース・導入前の整理',
  'P-05': '根拠の種類・信頼性の判断軸・情報の使い分け・候補の見極め方',
  'P-06': '推薦の条件・候補になる理由・比較軸・注意すべき観点',
};

// ── Claude API で回答ナラティブ生成（page-generate.ts callClaudeForChildPage 相当） ──

async function callClaudeForDraft(
  promptText: string,
  promptTypeId: string,
  companyName: string,
  productCategory: string,
  model: string,
  adoptedEvidence: EvidenceItemInput[],
): Promise<ChildPageNarrative | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const base = promptTypeId.split('-').slice(0, 2).join('-');
  const faqGuidance = FAQ_GUIDANCE_MAP[base] ?? '選定基準・候補の条件・比較軸・検討の進め方';

  const systemPrompt = `あなたは「問いへの回答設計」の専門家です。
与えられた「問い」に対して、読者が自然に読める回答ページのコンテンツを生成してください。

【ページの目的】
このページは対象商材の宣伝ではありません。
問いを受けた読者が自然に読める「回答記事」として構成してください。
対象商材はその問いの文脈で候補として自然に登場させてください。

【商材タイプの判定と語彙の使い分け（必ず行うこと）】
productCategoryの語彙から商材タイプを推定し、語彙・比較軸・FAQ設計を合わせてください。
- 無形サービス（コンサル・支援・代行）：「対応範囲」「アプローチの違い」「提供できるかどうか」
- SaaS・ツール：「機能」「連携可否」「料金体系」「サポート」
- 有形商品：「品質」「スペック」「価格帯」「入手しやすさ」
- 店舗・施設：「立地」「対応可能な状況」「雰囲気」「予約・利用条件」
- BtoB専門サービス：「対象業界」「規模感」「導入プロセス」「実績の種類」
該当するタイプの言葉を使い、無関係な語彙は使わないこと。

【answerフィールドの生成ルール】
- 問いに対する直接の回答を3〜5文で書く
- まず「この問いでは〜という条件を満たす候補が挙がる」と述べ、続けて対象商材がその条件にどう該当するかを自然に含める
- 診断レポート的な見出し語（「判断軸は」「条件に該当するのは」等）は文中でも使わない
- 「〜は優れています」「〜はおすすめです」等のPR調は禁止
- 条件適合型の語法を使うこと：「〜できる会社が候補になります」「〜という点で該当します」

【evidencePointsフィールドの生成ルール（最重要）】
- 採用済みEvidence（後述）が提供された場合は最優先で使用する
- 固有名詞（会社名・ブランド名・人名）、数値（件数・年数・割合・金額）、具体的な事例を優先する
- 抽象的な強みの説明は除外する
Evidenceがない場合は参考素材から最も具体的な情報を抽出する。2〜4項目を配列で生成すること。

【scopeフィールド】
どんな相談・用途・状況にこの商材が向いているかを1〜2文で。PR調禁止・条件適合型で書く。

【differentiationフィールド】
productCategoryと問い文脈に応じた比較対象との違いを1〜2文で。

【FAQ生成ルール】
5件。質問文は「この問いを受け取った人が自然に抱く疑問」として書く。
各FAQ回答は「①一般論 ②条件 ③対象商材が該当する場合の説明」の3段構成で2〜3文。
PR調・断定的推薦・商談誘導は禁止。
FAQテーマの方向性：${faqGuidance}

【禁止表現】
- 「〜は優れています」「〜はおすすめです」「〜は人気です」「〜は注目されています」
- 「〜は推薦されています」「〜は業界トップです」「圧倒的」「卓越した」

【内部用語（絶対に使わない）】
K-ID・E-ID・M-ID・P-ID・After構文・出現設計・補正済み

【出力フォーマット（JSONのみ・前置き不要）】
{
  "answer": "問いへの統合回答（3〜5文）",
  "evidencePoints": ["具体的実績1", "具体的実績2"],
  "scope": "向いている相談・用途（1〜2文）",
  "differentiation": "他の選択肢との違い（1〜2文）",
  "faq": [
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材（2〜3文、PR調禁止）"},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."}
  ]
}`;

  const sortedEvidence = adoptedEvidence.length > 0 ? sortEvidenceByPriority(adoptedEvidence) : [];

  const evidenceSection = sortedEvidence.length > 0
    ? `\n【採用済みEvidence（以下の優先順で evidencePoints に使用すること）】
優先度：case（実績案件）> client（顧客名）= credential（受賞）= media（メディア掲載）> metric（数値）> feature（機能・特徴）
case / client / credential / media が存在する場合は必ず先に出すこと。metric の数値は有効だが単体の主役にしない。feature は case/client がある場合は補足に回すこと。
${sortedEvidence.map(e => {
        const val = e.value ? ` (${e.value})` : '';
        return `- [${e.type}] ${e.title}${val}: ${e.description}`;
      }).join('\n')}\n`
    : '';

  const userContent = `【対象商材】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【対象の問い】
${promptText}
${evidenceSection}
JSONのみで返してください。`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
    const text = (data.content?.find(c => c.type === 'text')?.text ?? '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as ChildPageNarrative;
  } catch (err) {
    console.error('[draft-generate] callClaudeForDraft failed:', err);
    return null;
  }
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies DraftGenerateResponse));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as DraftGenerateRequest;
    const {
      instanceId,
      clientSlug,
      companyName,
      productCategory,
      promptTypeId,
      promptText,
      adoptedEvidence = [],
      model = DEFAULT_MODEL,
      attemptNumber = 1,
    } = body;

    if (!clientSlug || !SLUG_PATTERN.test(clientSlug)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid clientSlug' } satisfies DraftGenerateResponse));
      return;
    }
    if (!instanceId || !promptTypeId || !promptText) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'instanceId / promptTypeId / promptText is required' } satisfies DraftGenerateResponse));
      return;
    }

    const { verified } = splitEvidenceByTier(adoptedEvidence);

    const narrative = await callClaudeForDraft(
      promptText,
      promptTypeId,
      companyName,
      productCategory,
      model,
      verified,
    );

    if (!narrative) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Claude生成に失敗しました' } satisfies DraftGenerateResponse));
      return;
    }

    const draft: Draft = {
      draftId: randomUUID(),
      instanceId,
      clientSlug,
      promptTypeId,
      promptText,
      generator: {
        model,
        generatedAt: new Date().toISOString(),
        attemptNumber,
      },
      narrative,
      sourceEvidence: verified,
    };

    // KV書き込みなし。Draftを返すのみ。
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, draft } satisfies DraftGenerateResponse));
  } catch (err) {
    console.error('[draft-generate]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies DraftGenerateResponse));
  }
}
