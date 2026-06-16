import type { IncomingMessage, ServerResponse } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function getApiKey(): string {
  return process.env.ANTHROPIC_API_KEY ?? '';
}

// ── 型定義 ────────────────────────────────────────────────────────────

type PIdGroup = {
  pId: string;
  promptTypeId: string;         // P-01-01 → P-01
  promptText: string;           // 元のプロンプト文
  appearedFalseOutputs: string[]; // appeared=false の出力本文（分析主軸）
  appearedTrueOutputs: string[];  // appeared=true の出力本文（参考情報）
};

// ── システムプロンプト ────────────────────────────────────────────────

const COMPETITOR_SYSTEM_PROMPT = `あなたはAisle競合出現構造分析エンジンです。
「対象商材が出なかったとき（appeared_false）、代わりに何が・どの構文で出たか」を観測するのが分析の目的です。

【最重要：元プロンプト文を必ず参照してください】
各P-IDには元のプロンプト文（promptText）が含まれています。
そのプロンプトへの回答として「何が競合として出現したか」を分析してください。
プロンプトが「会社」「企業」を問うている場合、ツール（SaaS）単体を会社競合と混同しないでください。

【分析の主軸と参考情報】
- appeared_false出力（対象商材が出なかった回答）→ 主軸として分析
- appeared_true出力（対象商材が出た回答）→ 参考情報として活用

【entityType分類（必ず1つ付与）】
- company: コンサルティング会社・マーケティング会社・代理店など法人
- service: 特定企業が提供するサービス・ソリューション名
- tool: SaaSツール・プラットフォーム・ソフトウェア単体（Jasper, Copy.ai, ChatGPT等）
- media: メディア・情報サイト・ニュースソース・レポート機関
- concept: 概念・技術・手法名（「生成AI」「AIマーケティング」等）

【replacementRole分類（必ず1つ付与）】
- 代替候補: 対象商材の代わりに推薦されたもの
- 比較対象: 比較軸として言及されたもの
- 一般例: 「例えば〜」「〜など」として列挙されたもの
- 権威参照: 出典・信頼根拠として引用されたもの
- ツール例: 関連ツールとして紹介されたもの（会社競合ではない）

【appearedContext分類（必ず1つ付与）】
- appeared_false: appeared_false出力のみに登場（自社が出なかった回答）
- appeared_true: appeared_true出力のみに登場（自社も出た回答）
- mixed: 両方の出力に登場

【プロンプト別の分析注意事項】
- P-03（ランキング期待型・会社/企業を問う）: toolを会社競合と扱わない。toolはreplacementRole="ツール例"として記録
- P-01（選定・相談型）: 相談対象として出てきた会社・サービスを抽出
- P-02（比較・評価型）: 比較軸として言及されたものを抽出
- P-05（出典・解説型）: メディア・統計機関などの権威参照が主となる
- promptTextに「会社」「企業」が含まれる場合: entityType=companyを優先

【出力フォーマット（必ずこのJSONのみ返す）】
{
  "entityRanking": [
    {
      "rank": 1,
      "entity": "エンティティ名",
      "count": 15,
      "pIds": ["P-03"],
      "dominantStructure": "〜として推薦される構文の説明",
      "entityType": "company",
      "appearedContext": "appeared_false",
      "whyItAppeared": "実績・事例紹介型の構文で信頼根拠として機能している",
      "replacementRole": "代替候補"
    }
  ],
  "entityByPId": {
    "P-03": [
      {
        "rank": 1,
        "entity": "エンティティ名",
        "count": 8,
        "pIds": ["P-03"],
        "dominantStructure": "「〜として紹介される」という推薦構文",
        "entityType": "company",
        "appearedContext": "appeared_false",
        "whyItAppeared": "話題性・認知型の構文で代替候補として出現",
        "replacementRole": "代替候補",
        "promptText": "今注目されている生成AIマーケティング会社を教えてください",
        "promptTypeId": "P-03"
      }
    ]
  },
  "vocabPatterns": [
    {
      "patternType": "推薦型",
      "example": "「〜として注目されている〇〇」",
      "count": 12,
      "kIdHint": "K-01（意味競合）: 信頼形成型の構文でナレーター視点が支配的"
    }
  ],
  "summariesByPId": {
    "P-03": "このP-IDでは〜が代替候補として出現。entityTypeはcompanyとtoolが混在。appeared_false出力で自社の代わりに〜が推薦されており、K-06（情報飽和競合）が主因と推定。"
  }
}

ルール:
- entityRankingは全P-ID横断で出現頻度上位10件（頻度順）
- entityByPIdは各P-IDの上位5件（promptText・promptTypeIdを含める）
- vocabPatternsは実際に多く出現している3〜5パターン
- summariesByPIdは各P-IDについて100〜150字程度（entityType・replacementRole・K-IDとの対応を明示）
- appeared_false出力を主軸として分析（appeared_true出力は参考）
- 固有名詞として明確に識別できるものだけを抽出（「一般企業」「複数社」などは除外）
- JSONのみ返す（説明文・前置き不要）`;

// ── ユーザープロンプト生成 ────────────────────────────────────────────

function buildUserPrompt(pIdGroups: PIdGroup[], kIdSummary: string): string {
  const sections = pIdGroups.map(g => {
    const falseSection = g.appearedFalseOutputs.length > 0
      ? g.appearedFalseOutputs.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '（なし）';
    const trueSection = g.appearedTrueOutputs.length > 0
      ? g.appearedTrueOutputs.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '（なし）';

    return `[${g.pId}] promptTypeId: ${g.promptTypeId}
元のプロンプト: 「${g.promptText || '（不明）'}」

【appeared_false出力 — 分析主軸（対象商材が出なかった回答）】
${falseSection}

【appeared_true出力 — 参考情報（対象商材が出た回答）】
${trueSection}`;
  }).join('\n\n---\n\n');

  return `以下のP-ID別GPT出力本文を分析してください。
appeared_false（対象商材が出なかった回答）を主軸に、何が代わりに出現したかを特定してください。

${sections}

【参考: 2層診断のK-ID情報】
${kIdSummary || '（未取得）'}

JSONで返答してください。`;
}

// ── Claude API呼び出し ────────────────────────────────────────────────

async function callCompetitorApi(
  apiKey: string,
  pIdGroups: PIdGroup[],
  kIdSummary: string,
) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: COMPETITOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(pIdGroups, kIdSummary) }],
    }),
  });
  const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const text = data.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as {
      pIdGroups: PIdGroup[];
      kIdSummary: string;
    };
    const { pIdGroups, kIdSummary } = body;
    const apiKey = getApiKey();

    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が環境変数に設定されていません');
    if (!pIdGroups?.length) throw new Error('pIdGroupsが空です');

    const result = await callCompetitorApi(apiKey, pIdGroups, kIdSummary ?? '');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
