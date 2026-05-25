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

// ── 型定義 ───────────────────────────────────────────────────────────

interface PatternTableItem {
  difficultyType: string;
  description: string;
  count: number;
  measures: string;
}

interface ReconcileResult {
  detailReport: unknown[];
  matrixReport: unknown[];
  patternTable: PatternTableItem[];
  overallSummary: string;
}

// ── システムプロンプト ────────────────────────────────────────────────

const RECONCILE_SYSTEM_PROMPT = `あなたはAisle補正突合エンジン（4層）です。
2層で観測された競争敗因（K-ID）と競合勝因（E-ID）に対して、3層の出現設計が十分応答しているかを評価してください。

【役割の定義】
これは理論と実観測の独立比較ではありません。未知のギャップを新たに発見する工程でもなく、補正済み設計の充足性を確認する工程です。
K-ID/E-IDに対して設計が弱い場合は、補正不足として指摘してください。
設計が十分な場合は、実装優先度と出現到達性を評価してください。

【補正充足性確認の定義】
3層で設計されたAfter構文（SB-ID × M-ID × 意味接点テキスト）が、2層で観測されたK-ID敗因・E-ID勝因に対して
十分に応答しているかを構文単位で照合し、補正強度（設計強度・出現到達性・実装優先度）を評価する工程。

【出現困難要因分類（4タイプ）】
- 接続欠落：After構文の意味接点語彙と実出力ログの語彙が意味的に繋がっていない（語彙・概念の橋渡し断絶）
- 主語浮き：After構文の主語構造がプロンプトの期待主語と合っておらず、AIが別主語にルーティングする
- 意味競合：After構文のキーワードが競合エンティティ・他社語彙に埋もれ、自社構文が選択されない
- 構文分断：After構文内の意味の流れが途切れており、AIがコヒーレントな意味単位として認識できない

【到達可能性スコア】
- 高：構造的問題は軽微で、小さな補強・調整で出現が見込める
- 中：困難要因は特定できるが、複数施策の組み合わせが必要
- 低：根本的な構造問題があり、意味空間補強・再設計なしには出現が見込めない

【出力フォーマット（JSONのみ）】
{
  "detailReport": [
    {
      "pId": "P-01-01",
      "promptText": "プロンプト文",
      "sbId": "AISLE-01-01-A",
      "mId": "M-01",
      "afterText": "After構文テキスト（照合対象・省略可）",
      "appeared": false,
      "difficultyType": "接続欠落",
      "difficultyDetail": "After構文の意味接点「〜」が実出力ログの語彙「〜」と意味的に繋がっていない。主語構造競合も複合している",
      "reachabilityScore": "低",
      "guideline": "FAQページから語彙的接続を確保し、外部出典補完との連携で出現を補強する"
    }
  ],
  "matrixReport": [
    {
      "sbId": "AISLE-01-01-A",
      "mId": "M-01",
      "reachabilityScore": "低",
      "mainDifficultyType": "接続欠落",
      "affectedPIds": "P-01-01, P-01-02",
      "guideline": "意味空間補強＋出典接続＋導線設計が必要",
      "priority": "高"
    }
  ],
  "patternTable": [
    {
      "difficultyType": "接続欠落",
      "description": "意味接点語彙が実出力ログと断絶しているケース",
      "count": 3,
      "measures": "語彙的接続強化・外部出典補完の活用・意味連鎖構文の追加"
    }
  ],
  "overallSummary": "K-ID/E-IDへの補正充足性の総合評価。補正強度・出現到達性・実装優先度の観点からの改善指針（200字程度）"
}

【診断ルール】
- detailReportは「P-ID × SB-ID」の全組み合わせを列挙する（P-IDごとにそのP-IDのSB-IDすべてを評価）
- appeared：2層の当該P-IDの出現率が50%以上→true、50%未満→false
- difficultyType：appeared=trueの場合は「なし」とし、difficultyDetailとguidelineには強化・維持の指針を記述
- difficultyTypeはK-ID・出力本文要約・阻害構造を参照して4タイプから1つ選ぶ（最も支配的な要因）
- matrixReportはSB-ID単位で集約（複数P-IDに同じSB-IDが出現する場合は統合し、最低スコアを採用）
- patternTableは実データから導出される4タイプ別対応パターン（実際に出現したタイプのみ記述、3〜5件）
- overallSummaryはこのP-IDにおける補正充足性の総合評価（K-ID/E-IDへの応答強度）と、設計強度・出現到達性・実装優先度の観点からの改善指針を具体的に記述
- 重要：difficultyDetail・guideline・overallSummary・description・measuresなどクライアントに表示されるテキストフィールドには、ID記号（A-01、E-03、AISLE-01-01-A、M-07、K-01などの英数字コード）を一切含めないこと。IDはpId・sbId・mId・difficultyType・reachabilityScoreなどの専用フィールドにのみ記載する。数値目標（出現率○%向上など）も記載せず、定性的な表現のみ使用すること。
- JSONのみ返す（説明文・前置き不要）`;

// ── 1件のP-ID分だけAPIを呼ぶ ─────────────────────────────────────────

async function callReconcileApiForPId(
  companyName: string,
  productCategory: string,
  phase1Item: unknown,
  phase2Item: unknown,
): Promise<ReconcileResult> {
  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【2層診断データ（実出現ログ・C-ID・K-ID・阻害構造）】
${JSON.stringify(phase1Item, null, 2)}

【3層設計データ（After構文 SB-ID × M-ID × 意味接点テキスト）】
${JSON.stringify(phase2Item, null, 2)}

上記の2層診断データ（K-ID敗因・E-ID勝因・阻害構造）に対して、
3層After構文（SB-ID × M-ID × 意味接点テキスト）が十分応答しているかを構文単位で評価してください。
補正不足がある場合は補正不足として指摘し、補正が十分な場合は実装優先度と出現到達性を評価してください。
なお、出現困難要因（接続欠落/主語浮き/意味競合/構文分断）の分類も合わせて行ってください。
JSONで返答してください。`;

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: RECONCILE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const text = (data.content?.[0]?.text ?? '').trim();
  return JSON.parse(cleanJson(text)) as ReconcileResult;
}

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    // 1リクエスト = 1 P-ID（ループはフロントエンド側で管理）
    const body = JSON.parse(await readBody(req)) as {
      companyName: string;
      productCategory: string;
      phase1Item: unknown;
      phase2Item: unknown;
    };
    const { companyName, productCategory, phase1Item, phase2Item } = body;

    if (!phase2Item) throw new Error('phase2Item が未指定です');

    const result = await callReconcileApiForPId(companyName, productCategory, phase1Item, phase2Item);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
