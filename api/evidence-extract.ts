import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = { maxDuration: 60 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── HTMLからテキスト抽出（fetch-url.ts と同じロジック） ──────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'").replace(/&hellip;/g, '...')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Evidence抽出システムプロンプト ───────────────────────────────

const EVIDENCE_SYSTEM_PROMPT = `あなたはEvidence抽出エンジンです。
与えられたテキストから、AIが推薦理由として引用できる根拠を抽出し、構造化JSONで返してください。

【重要原則】
- テキスト中に明示的に記載されている事実のみを抽出すること
- 推測・補完・架空の情報は絶対に生成しないこと
- 見つからないカテゴリは空配列を返すのではなく、そのitemを生成しないこと
- 1つの事実は1つのitemとして独立させること
- 営業的表現・曖昧な形容詞（「高品質」「豊富な実績」等）のみのitemは生成しないこと

【typeの定義と判断基準】
- case: 具体的な制作・支援・開発・提供の実績。プロジェクト名や案件名があるもの
- client: 取引・契約・利用の実績がある顧客・企業・ブランド名
- feature: 商品・サービス・会社の特徴・機能・強み・成分・仕様
- metric: 数値で表された実績・効果・規模（本数・件数・率・点数など）
- credential: 受賞・認定・資格・認証・特許など第三者による評価の記録
- review: ユーザー・顧客・読者・利用者による評価・口コミ・評判
- media: ニュース・雑誌・ウェブメディア・TV等への掲載・取材・紹介
- method: 自社独自の制作手法・プロセス・フレームワーク・アプローチ
- availability: 対応地域・業種・時間帯・価格帯・提供形態などの提供条件
- comparison: 他社・他商品との比較優位・差別化ポイント
- other: 上記に当てはまらないが引用価値があると判断した根拠

【confidenceの判断基準】
- high: 固有名詞・数値・固有の事実名がテキスト中に明記されている（数値は「500本以上」等の具体的な記載がある場合のみ）
- medium: 具体性はあるが一部曖昧な表現が含まれる
- low: 抽象的または推測を含む

【needsVerificationの判断基準】
- true: テキストに明記はあるが、外部参照・照合が必要な数値・認定・受賞・メディア掲載など
- false: テキスト上で完結しており追加確認不要な事実

【insufficientTypesについて】
テキストを調査した結果、以下のtypeの根拠が不足または見つからなかった場合は "insufficientTypes" 配列に追記してください。
不足typeの例: credential（受賞・認証が見当たらない）、media（掲載実績が見当たらない）、metric（数値実績が見当たらない）、client（顧客名が見当たらない）

【出力形式（JSONのみ、前置き・説明不要）】
{
  "items": [
    {
      "id": "ev-001",
      "type": "case",
      "title": "Monster Strike PRO TOUR 2024 オープニング映像",
      "description": "モバイルeスポーツ大会のオープニングCG映像を制作",
      "entityRole": "ゲーム映像実績",
      "value": "2024",
      "tags": ["CG", "eスポーツ", "ゲーム映像", "MIXI"],
      "confidence": "high",
      "needsVerification": false,
      "verificationNote": ""
    }
  ],
  "insufficientTypes": ["credential", "media"]
}`;

// ── JSONクリーニング ──────────────────────────────────────────────

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

// ── Claude でEvidence抽出 ────────────────────────────────────────

const MAX_INPUT_CHARS = 5000;

async function extractWithClaude(
  rawText: string,
  companyName: string,
  sourceLabel: string,
): Promise<{
  items: Array<{
    id: string; type: string; title: string; description: string;
    entityRole: string; value?: string; tags: string[]; confidence?: string;
    needsVerification?: boolean; verificationNote?: string;
  }>;
  insufficientTypes: string[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

  const userContent = `【対象テキスト】
抽出元: ${sourceLabel}${companyName ? `\n企業・商材名: ${companyName}` : ''}

${rawText.slice(0, MAX_INPUT_CHARS)}

上記のテキストからEvidence候補をJSONで返してください。`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: EVIDENCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  let raw = '';
  try { raw = await resp.text(); } catch { throw new Error('Anthropic APIの応答読み取りに失敗しました'); }

  let apiData: { content?: Array<{ text: string }>; error?: { message: string } };
  try { apiData = JSON.parse(raw) as typeof apiData; } catch {
    throw new Error(`Anthropic APIが不正なレスポンスを返しました（HTTP ${resp.status}）`);
  }
  if (!resp.ok) throw new Error(apiData.error?.message ?? `Claude API error ${resp.status}`);

  const rawText2 = (apiData.content?.[0]?.text ?? '').trim();
  const cleaned = cleanJson(rawText2);
  const parsed = JSON.parse(cleaned) as { items?: unknown[]; insufficientTypes?: unknown[] };
  return {
    items: (parsed.items ?? []) as Array<{
      id: string; type: string; title: string; description: string;
      entityRole: string; value?: string; tags: string[]; confidence?: string;
      needsVerification?: boolean; verificationNote?: string;
    }>,
    insufficientTypes: Array.isArray(parsed.insufficientTypes)
      ? (parsed.insufficientTypes as string[]).filter(t => typeof t === 'string')
      : [],
  };
}

// ── ハンドラ ─────────────────────────────────────────────────────

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
      url?: string;
      rawText?: string;
      sourceLabel: string;
      companyName?: string;
    };
    const { url, rawText, sourceLabel, companyName = '' } = body;

    if (!url && !rawText) throw new Error('url または rawText が必要です');

    let textToExtract = rawText ?? '';
    let rawLength = textToExtract.length;
    let resolvedUrl = url ?? '';

    if (url) {
      // URLからHTMLを取得してテキスト化
      let parsed: URL;
      try { parsed = new URL(url.trim()); } catch { throw new Error('有効なURLを入力してください'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('http / https のURLのみ対応しています');

      const pageResp = await fetch(url.trim(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AisleBot/1.0; +https://aisle-aio.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!pageResp.ok) throw new Error(`ページの取得に失敗しました（HTTP ${pageResp.status}）`);

      const contentType = pageResp.headers.get('content-type') ?? '';
      if (!contentType.includes('html') && !contentType.includes('text')) {
        throw new Error('HTMLページ以外のコンテンツには対応していません');
      }

      const html = await pageResp.text();
      textToExtract = stripHtml(html);
      rawLength = textToExtract.length;
      resolvedUrl = url.trim();

      if (textToExtract.length < 50) {
        throw new Error('テキストを取得できませんでした。JavaScriptで動的に生成されるページには対応していません');
      }
    }

    const { items: rawItems, insufficientTypes } = await extractWithClaude(textToExtract, companyName, sourceLabel);

    // idの重複・型の正規化・sourceUrl/sourceType付与・needsVerification/sourceVerified付与
    const VALID_TYPES = new Set(['case','client','feature','metric','credential','review','media','method','availability','comparison','other']);
    const items = rawItems.map((item, i) => {
      const confidence = (['high','medium','low'].includes(item.confidence ?? '') ? item.confidence : 'medium') as 'high' | 'medium' | 'low';
      // confidence が high 以外なら自動で needsVerification=true
      const needsVerification = item.needsVerification === true || confidence !== 'high';
      const sourceVerified = confidence === 'high' && !needsVerification;
      return {
        id: item.id || `ev-${String(i + 1).padStart(3, '0')}`,
        type: VALID_TYPES.has(item.type) ? item.type : 'other',
        title: item.title || '',
        description: item.description || '',
        entityRole: item.entityRole || '',
        ...(item.value !== undefined ? { value: item.value } : {}),
        tags: Array.isArray(item.tags) ? item.tags : [],
        sourceUrl: resolvedUrl || undefined,
        sourceType: url ? 'official_site' as const : 'manual' as const,
        confidence,
        needsVerification,
        ...(item.verificationNote ? { verificationNote: item.verificationNote } : {}),
        sourceVerified,
        status: 'pending' as const,
        sourceLabel,
      };
    });

    console.log(`[evidence-extract] source=${sourceLabel} rawLength=${rawLength} items=${items.length} insufficientTypes=${insufficientTypes.join(',') || 'none'}`);
    res.end(JSON.stringify({ ok: true, items, insufficientTypes, rawLength }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[evidence-extract] error:', message);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
