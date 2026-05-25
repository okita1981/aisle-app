import type { IncomingMessage, ServerResponse } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── システムプロンプト ────────────────────────────────────────────────

const SYSTEM_PROMPT = `以下の問いをP-01〜P-06に分類してください。

P-01：選定・相談型（どうすればいい？どこに頼む？）
P-02：比較・評価型（何が違う？どっちがいい？）
P-03：ランキング期待型（今注目は？人気は？）
P-04：課題解決・提案型（課題を解決したい・提案したい）
P-05：出典付き引用期待型（根拠・データ・出典が欲しい）
P-06：推薦理由深掘り型（なぜ？理由・背景を知りたい）

最も強いP-IDを1つ（primary）、補助P-IDを最大2つ（secondary）、判定理由（reason）をJSONで返してください。

JSONのみ返し、前後の説明は不要です。`;

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as { promptText: string };
    const { promptText } = body;
    if (!promptText) throw new Error('promptText が必要です');

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
        model: 'claude-haiku-4-20250514',
        max_tokens: 256,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText }],
      }),
    });

    const data = await resp.json() as {
      content?: Array<{ text: string }>;
      error?: { message: string };
    };
    if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);

    const text = (data.content?.[0]?.text ?? '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSONを取得できませんでした');

    const parsed = JSON.parse(match[0]) as {
      primary?: string;
      secondary?: string[];
      reason?: string;
    };

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      primary: parsed.primary ?? 'P-01',
      secondary: Array.isArray(parsed.secondary) ? parsed.secondary : [],
      reason: parsed.reason ?? '',
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
