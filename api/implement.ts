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

// ── JSONクリーニング ──────────────────────────────────────────────────

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

// ── システムプロンプト ────────────────────────────────────────────────

const IMPLEMENT_SYSTEM_PROMPT = `あなたはAisle実装設計エンジン（フェーズ④）です。
突合診断の結果を受け取り、出現率向上のための具体的な実装設計を行ってください。

【実装設計の目的】
突合診断で特定された「出現しにくさの構造要因」を解消するために、
構文の設置位置・他構文との連携補強・主語やテンプレートの調整などの実装施策を導出する。

【E-ID一覧（外部補完要因）】
E-01 媒体掲載（ニュース・PR） E-02 専門サイト・辞書系言及 E-03 出典付き事例・実績
E-04 FAQ構造/Schema連携 E-05 SNS・UGCでの話題性 E-06 被リンク・SEOドメイン強度
E-07 ランキング/比較記事 E-08 クローラビリティの最適化 E-09 複数出典の交差構造
E-10 情報の更新頻度・鮮度 E-11 エンティティ出現済情報 E-12 ナビゲーション構造/回遊性
E-13 引用可能性（クオート構造）

【優先度の判断基準】
- 高：出現困難度「高」かつ外部補強必要度「高」→ 意味空間補強＋出典接続＋導線設計が必要
- 中：出現あり or 困難度「中」→ 掲載位置調整／主語再設計が有効
- 低：出現困難度「低」or 構文スコアが低い → 軽微な調整 or 採用見送り検討

【出力形式（必ずこのJSONのみ返す）】
{
  "planRows": [
    {
      "sbId": "AISLE-01-01-A",
      "priority": "高",
      "action": "FAQページに専門性訴求の構文を設置し、出典接続構文と連携させる",
      "targetPage": "FAQページ / サービス概要ページ",
      "eIdRequired": "FAQ構造/Schema連携、出典付き事例・実績",
      "expectedEffect": "「AIでマーケティング支援をする会社は？」への出現率向上が見込まれる",
      "connectionSyntax": "AISLE-01-01-B（比較構文）と連携し意味ネットワークを補強"
    }
  ],
  "prioritySummary": "実装全体の優先順序と期待効果の総括コメント（200字程度）"
}

【ルール】
- 選択されたSB-IDすべてに対してplanRowを1件ずつ生成する
- actionは具体的なページ設置・コンテンツ追加・構文連携を明記する
- targetPageはサービスサイトの一般的なページ名で記述する（トップ/FAQ/サービス概要/事例紹介/ブログ等）
- eIdRequiredフィールドには外部接点の説明名を記載すること。IDコード（E-01、E-04等）は一切含めないこと。上記「E-ID一覧」の括弧内の日本語名をそのまま使い、読点（、）で区切ること。括弧内の表記（例：出典付き事例・実績、SNS・UGCでの話題性）は中黒や括弧ごと維持し、絶対に分解・簡略化しないこと。正しい例：「出典付き事例・実績、FAQ構造/Schema連携、媒体掲載（ニュース・PR）」。誤った例：「E-03（出典付き事例・実績）・E-04（FAQ構造/Schema連携）」
- expectedEffectは対象プロンプトへの出現改善効果を定性・定量で記述する
- connectionSyntaxは連携推奨の他SB-IDを記述する（なければ「単独実装」）
- prioritySummaryは高優先度から順に実装するロードマップ的な内容にする
- 重要：action・expectedEffect・prioritySummaryなどクライアントに表示されるテキストフィールドには、ID記号（A-01、E-03、AISLE-01-01-A、M-07、K-01などの英数字コード）を一切含めないこと。IDはsbId・eIdRequired・connectionSyntaxなどの専用フィールドにのみ記載する。数値目標（出現率○%向上など）も記載せず、定性的な表現のみ使用すること。
- JSONのみ返す（説明文・前置き不要）`;

// ── API呼び出し ──────────────────────────────────────────────────────

async function callImplementApi(
  apiKey: string,
  companyName: string,
  productCategory: string,
  selectedItems: unknown[],
) {
  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【実装対象SB-ID（突合診断より）】
${JSON.stringify(selectedItems, null, 2)}

上記のSB-IDについて、出現率向上のための実装設計を行ってください。
JSONで返答してください。`;

  const signal = AbortSignal.timeout(55000);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: IMPLEMENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal,
  });

  const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const text = data.content?.[0]?.text ?? '';
  return JSON.parse(cleanJson(text));
}

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as {
      companyName: string;
      productCategory: string;
      selectedItems: unknown[];
    };
    const { companyName, productCategory, selectedItems } = body;
    const apiKey = getApiKey();

    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が環境変数に設定されていません');
    if (!selectedItems || selectedItems.length === 0) throw new Error('実装対象SB-IDが選択されていません');

    const result = await callImplementApi(apiKey, companyName, productCategory, selectedItems);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
