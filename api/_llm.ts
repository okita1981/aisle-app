/**
 * _llm.ts — LLM呼び出し共通ユーティリティ
 *
 * フォールバック順序:
 *   1. claude-sonnet-4-6
 *   2. claude-haiku-4-5-20251001
 *   3. gemini-2.5-flash（GEMINI_API_KEY が設定されている場合のみ）
 *
 * 次のモデルへフォールバックする条件:
 *   - HTTP 429 (レートリミット)
 *   - レスポンスが { または [ で始まらない（非JSONエラーメッセージ）
 *   - その他の HTTP エラー / 例外
 */

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  cleaned = cleaned.trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
};

interface ModelConfig {
  type: 'anthropic' | 'gemini';
  label: string;
  model: string;
}

function buildModelList(): ModelConfig[] {
  const list: ModelConfig[] = [
    { type: 'anthropic', label: 'claude-sonnet-4-6', model: 'claude-sonnet-4-6' },
    { type: 'anthropic', label: 'claude-haiku-4-5-20251001', model: 'claude-haiku-4-5-20251001' },
  ];
  if (process.env.GEMINI_API_KEY) {
    list.push({ type: 'gemini', label: 'gemini-2.5-flash', model: 'gemini-2.5-flash' });
  }
  return list;
}

async function tryAnthropic(
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    console.error('[llm] ANTHROPIC_API_KEY が未設定です');
    return null;
  }

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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(50000),
    });

    if (resp.status === 429) {
      console.error('[llm] HTTP 429 on', model, ': rate limit');
      return null;
    }
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[llm] HTTP', resp.status, 'on', model, ':', errText.slice(0, 200));
      return null;
    }

    const data = await resp.json() as {
      content?: Array<{ type: string; text: string }>;
      error?: { message: string };
    };
    if (data.error) {
      console.error('[llm] API error on', model, ':', data.error.message);
      return null;
    }

    const text = (data.content?.[0]?.text ?? '').trim();
    if (!text.startsWith('{') && !text.startsWith('[')) {
      console.error('[llm] Non-JSON on', model, ':', text.slice(0, 200));
      return null;
    }

    return text;
  } catch (e) {
    console.error('[llm] Exception on', model, ':', e);
    return null;
  }
}

async function tryGemini(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  if (!apiKey) return null;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(50000),
    },
  );

  if (resp.status === 429) {
    console.error('[llm] 429 rate limit: gemini-2.5-flash');
    return null;
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error(`[llm] HTTP ${resp.status} on gemini-2.5-flash: ${errText.slice(0, 200)}`);
    return null;
  }

  const data = await resp.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  const cleaned = cleanJson(raw);
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    console.error('[llm] Non-JSON response from gemini-2.5-flash:', raw.slice(0, 200));
    return null;
  }
  return cleaned;
}

/**
 * フォールバック付きLLM呼び出し。
 * 成功したモデルのテキストを返す。全モデル失敗時はエラーをthrow。
 */
export async function callWithFallback(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<string> {
  const models = buildModelList();

  for (const cfg of models) {
    try {
      let text: string | null = null;

      if (cfg.type === 'anthropic') {
        text = await tryAnthropic(cfg.model, systemPrompt, userContent, maxTokens);
      } else {
        text = await tryGemini(systemPrompt, userContent, maxTokens);
      }

      if (text === null) continue; // 次のモデルへ

      // JSONで始まらない場合はエラーメッセージとみなしてスキップ
      if (!text.startsWith('{') && !text.startsWith('[')) {
        console.error(`[llm] Non-JSON response from ${cfg.label}: ${text.slice(0, 200)}`);
        continue;
      }

      console.info(`[llm] Success: ${cfg.label}`);
      return text;
    } catch (e) {
      console.error(`[llm] Exception on ${cfg.label}:`, e);
      continue;
    }
  }

  throw new Error('全モデルでの生成に失敗しました（Sonnet / Haiku / Gemini）');
}
