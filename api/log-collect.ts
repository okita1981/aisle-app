import type { IncomingMessage, ServerResponse } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── 型定義 ────────────────────────────────────────────────────

const ALLOWED_MODELS = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'] as const;
const DEFAULT_MODEL  = 'gpt-4.1';

interface BatchRequest {
  promptGroup: string;
  promptId: string;
  promptText: string;
  trialNumbers: number[];   // このバッチで実行する試行番号の配列（最大10件）
  model?: string;
  companyName: string;
  category: string;
  keywords?: string[];      // 出現判定キーワード（未指定時はcompanyNameで判定）
}

interface TrialResult {
  trialNo: number;
  appeared: boolean;
  answer: string;
  reason: string;
  source: string;
}

// ── プロンプトテンプレート ─────────────────────────────────────

const SYSTEM_PROMPT = 'あなたは優秀なアシスタントです。';

function buildUserPrompt(promptText: string): string {
  return `以下のプロンプトに対して、ChatGPTとして自然かつ汎用的に出力してください。
【プロンプト】${promptText}

回答はJSON形式で以下のキーで返してください：
- answer: 回答本文
- reason: 出力理由
- source: 出典分類（わからない場合は「不明」）`;
}

// ── OpenAI API 呼び出し ───────────────────────────────────────

async function callOpenAI(
  promptText: string,
  model: string,
): Promise<{ answer: string; reason: string; source: string }> {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) throw new Error('OPENAI_API_KEY が環境変数に設定されていません');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(promptText) },
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI API error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { answer?: string; reason?: string; source?: string };
  return {
    answer: parsed.answer ?? '',
    reason: parsed.reason ?? '',
    source: parsed.source ?? '不明',
  };
}

// ── ハンドラ ──────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as BatchRequest;
    const { promptText, trialNumbers, companyName, keywords } = body;
    // 許可モデルのみ受け付け、未指定・不正値はデフォルト
    const model = ALLOWED_MODELS.includes(body.model as typeof ALLOWED_MODELS[number])
      ? body.model as string
      : DEFAULT_MODEL;

    if (!promptText || !trialNumbers || trialNumbers.length === 0) {
      throw new Error('必須パラメータが不足しています');
    }

    // 有効なキーワード一覧（空文字除去）
    const effectiveKeywords = keywords && keywords.length > 0
      ? keywords.filter(k => k.length > 0)
      : [];

    const callOne = async (trialNo: number): Promise<TrialResult> => {
      try {
        const result = await callOpenAI(promptText, model);
        const appeared = effectiveKeywords.length > 0
          ? effectiveKeywords.some(k => result.answer.includes(k))
          : companyName.length > 0 && result.answer.includes(companyName);
        return { trialNo, appeared, ...result };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { trialNo, appeared: false, answer: '', reason: `エラー: ${msg.slice(0, 100)}`, source: '不明' };
      }
    };

    // バッチ内は並列実行
    const results = await Promise.all(trialNumbers.map(callOne));

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, results }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
