import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = { maxDuration: 30 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SYSTEM_PROMPT = `あなたはAI検索の評価軸抽出エンジンです。
与えられた問いと商材情報をもとに、AIが回答を構成する際に使う評価軸・語彙を抽出してください。

【重要原則】
評価軸は「問いの文脈 × 商材カテゴリ」の交点で決まります。
同じ「おすすめを教えて」という問いでも、商材が映像制作会社ならCG技術・実績が軸になり、
SaaSならROI・機能比較が軸になります。

primaryAxes は「AIがこの問いに回答するとき、何を根拠に候補を選ぶか」を表します。
問い中の具体的な技術語・ジャンル語を必ず含めてください。

evidenceHints は「この評価軸を裏付けるために探すべき根拠の種類」を指定します。
例: 「CGを使った制作実績リスト」「受賞歴・アワード」「主要クライアント名」

【出力形式（JSONのみ、前置き不要）】
{
  "primaryAxes": ["評価軸（15字以内）", ...（3〜5個）],
  "keyTerms": ["問いに含まれる検索語・関連語"（3〜8個）],
  "expectedAnswerFormat": "AIがこの問いに返す回答の型（例: 制作会社の技術比較リスト）",
  "pIdAlignment": "この評価軸がP-IDと整合している理由（1文）",
  "evidenceHints": ["探すべき根拠の種類（例: CG制作実績）"（2〜4個）]
}`;

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as {
      promptText: string;
      pId: string;
      pLabel: string;
      companyName: string;
      productCategory: string;
      productDescription: string;
    };
    const { promptText, pId, pLabel, companyName, productCategory, productDescription } = body;
    if (!promptText) throw new Error('promptText が必要です');

    const userContent = `【問い】
「${promptText}」

【P-ID情報】
P-ID: ${pId}（${pLabel}）

【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}
説明文: ${productDescription || '（未入力）'}

上記の問いと商材情報をもとに、評価軸をJSONで返してください。`;

    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    let raw = '';
    try { raw = await resp.text(); } catch { throw new Error('Anthropic APIの応答読み取りに失敗しました'); }

    let apiData: { content?: Array<{ text: string }>; error?: { message: string } };
    try { apiData = JSON.parse(raw) as typeof apiData; } catch {
      throw new Error(`Anthropic APIが不正なレスポンスを返しました（HTTP ${resp.status}）`);
    }
    if (!resp.ok) throw new Error(apiData.error?.message ?? `Claude API error ${resp.status}`);

    const rawText = (apiData.content?.[0]?.text ?? '').trim();
    const cleaned = cleanJson(rawText);
    const data = JSON.parse(cleaned) as {
      primaryAxes: string[];
      keyTerms: string[];
      expectedAnswerFormat: string;
      pIdAlignment: string;
      evidenceHints?: string[];
    };

    console.log(`[evaluate-axes] pId=${pId} axes=${data.primaryAxes?.length ?? 0}`);
    res.end(JSON.stringify({ ok: true, data }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[evaluate-axes] error:', message);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
