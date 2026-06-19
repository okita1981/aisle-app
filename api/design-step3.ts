import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = { maxDuration: 120 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── システムプロンプト（STEP5 + STEP6 + サマリ） ──────────────────────

const DESIGN_STEP3_SYSTEM_PROMPT = `あなたはAisle出現設計エンジン（出現評価）です。
STEP4（構文接続順）の結果と各SB-IDの情報を受け取り、
STEP5（勝因接続マトリクス）・STEP6（出現構造評価）・サマリを生成してください。

【K-ID一覧（出現阻害要因）】
K-01 意味競合 K-02 主語構造競合 K-03 出典競合 K-04 構文的上位互換
K-05 情報飽和競合 K-06 プロンプト整合度競合 K-07 外部要因量的優位
K-08 対象粒度不一致競合 K-09 FAQ・定義構文との誤競合 K-10 出現対象誤認競合

【E-ID一覧（外部補完要因）】
E-01 媒体掲載（ニュース・PR） E-02 専門サイト・辞書系言及 E-03 出典付き事例・実績
E-04 FAQ構造/Schema連携 E-05 SNS・UGCでの話題性 E-06 被リンク・SEOドメイン強度
E-07 ランキング/比較記事 E-08 クローラビリティの最適化 E-09 複数出典の交差構造
E-10 情報の更新頻度・鮮度 E-11 エンティティ出現済情報 E-12 ナビゲーション構造/回遊性
E-13 引用可能性（クオート構造）

【出力形式（必ずこのJSONのみ返す）】
{
  "step5": [
    {
      "sbId": "AISLE-XX-XX-A",
      "mId": "M-05",
      "kId": "K-03",
      "winningEId": "E-03",
      "winningFactor": "競合は出典付き事例・実績ページを持ち、信頼性の根拠を外部から調達している",
      "gapToAisle": "Aisle側では実績や事例の参照可能性が不足しており、信頼構造の外部的裏付けが弱い",
      "reproducibility": "高",
      "requiredAction": "導入事例・検証ログ・出典付き実績ページを整備し、引用可能な信頼構造を構築する",
      "comment": "出典競合という阻害要因に対して、競合が持つ実績引用力を再現することが最優先"
    }
  ],
  "step6": [
    {
      "sbId": "AISLE-XX-XX-A",
      "mId": "M-05",
      "tId": "T-07-5",
      "aId": "A-05",
      "reachability": "○",
      "mainKId": "K-03",
      "improvementLever": "引用可能な導入事例を整備し、信頼形成構文の外部根拠を強化する",
      "semanticFit": "◎",
      "connectionFit": "◎",
      "comment": "意味適合・接続整合は高いが、出典根拠の不足が出現到達性を下げている"
    }
  ],
  "summary": {
    "overallImpression": "全体的な評価",
    "keyBun": "注目構文の説明",
    "complementNeeds": "補完要否の説明",
    "implementationProposal": "実装提案"
  }
}

ルール:
- step5は「勝因接続マトリクス」です。各SB-IDに対して、競合・出現構文がどの外部的勝因構造（E-ID）を持っていたかを分析し、Aisle側との差分・再現方針を示してください（全SB-ID必須）。
  E-IDは「補完候補（足りないから足すもの）」ではなく、以下の3段階で扱います：
  1. winningEId: 競合・出現構文の外部的勝因（GPT空間で出現した側が持っていたE-ID）
  2. gapToAisle: Aisle側との差分（自社が欠いている外部構造の具体的説明）
  3. requiredAction: Aisle側で再現・代替・回避すべき実装方針
  K-IDとE-IDは表裏一体です。K-ID＝自社の敗因 / E-ID＝競合の勝因として接続してください。
  reproducibilityは「高 | 中 | 低」で、競合の勝因構造をAisleが再現できる現実性を評価します。
- step6は「出現構造評価マトリクス」です。各SB-IDを以下の3軸で評価してください（全SB-ID必須）。
  ① reachability（出現到達性）: ◎/○/△/× の4段階で評価する。
    ◎ = 意味接点・接続順・外部勝因が整っており、出現構造として非常に強い
    ○ = 主要構造は成立しているが、一部の勝因要素不足あり
    △ = 意味適合はあるが、阻害要因が強く出現しづらい
    × = 問いとの接続性が弱く、出現構造として成立していない
  ② mainKId（主阻害要因）: 最も重要な阻害要因K-IDを1つ選ぶ。阻害なし・到達性◎の場合は「なし」とする。
  ③ improvementLever（改善レバー）: 最優先で改善すべきことを具体的な自然文で1〜2文記述する。
    良い例: 「引用可能な導入事例を整備し、信頼形成構文の外部根拠を強化する」
    良い例: 「専門家・業界人からの言及機会を増やし、第三者評価構文を強化する」
    避けるべき例: 「PRを増やす」「SNSを頑張る」など抽象的・汎用的な表現
  semanticFit（意味的適合度）: ◎/○/△ で評価
  connectionFit（接続整合性）: ◎/○/△ で評価
  STEP4の分析結果を踏まえて、各SB-IDの改善レバーを具体化してください。
- カテゴリ吸収リスクへの注意：step6の評価・improvementLeverを記述する際、商材が既存カテゴリの一例として埋もれていないかを確認してください。特にP-02・P-03など比較型・カテゴリ近接型の問いでは、商材固有の立ち位置が出現構造に反映されているかを評価軸に加えてください。
- 重要：comment・winningFactor・gapToAisle・requiredAction・improvementLever・overallImpression・keyBun・complementNeeds・implementationProposalなどクライアントに表示されるテキストフィールドには、ID記号（A-01、E-03、AISLE-01-01-A、M-07、K-01などの英数字コード）を一切含めないこと。IDはsbId・mId・tId・aId・kId・winningEId・mainKIdなどの専用フィールドにのみ記載する。数値目標（出現率○%向上など）も記載せず、定性的な表現のみ使用すること。
- 【JSON出力必須ルール・厳守】
  ① 出力はJSON本体のみ。前置き・説明文・マークダウンコードブロック（\`\`\`json 等）は一切含めないこと。
  ② JSON文字列値（"..." の中身）にダブルクォーテーション（"）を含めないこと。引用が必要な場合は全角の「」または『』を使うこと。
  ③ JSON文字列値に改行文字（実際の改行、\\nエスケープ含む）を含めないこと。文を区切る場合は「。」や「／」を使うこと。
  ④ JSON文字列値にバックスラッシュ（\\）を単独で含めないこと。
  ⑤ 上記を守らないとJSON parseエラーになり、出力が破棄される。`;

// ── JSONクリーニング ──────────────────────────────────────────────────

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  cleaned = cleaned.trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

// ── プロンプト注入テキストのサニタイズ ────────────────────────────────

function sanitizeForPrompt(text: string | undefined | null): string {
  if (!text || text === '—') return text ?? '—';
  return text
    .replace(/"/g, '「')
    .replace(/\\/g, '／')
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/  +/g, ' ')
    .trim();
}

// ── E-ID観測データ型 ──────────────────────────────────────────────────

interface EIdObservation {
  pId: string;
  competitorEntity: string;
  entityType: string;
  replacementRole: string;
  winningEId: string;
  controlType: string;
  winningFactor: string;
  evidenceText: string;
  gapToAisle: string;
  implementationDirection: string;
  relatedKId: string;
  comment: string;
}

function buildEIdObservationText(eIdMatrix?: EIdObservation[]): string {
  if (!eIdMatrix || eIdMatrix.length === 0) return '';
  const lines = eIdMatrix.map((row, i) => {
    const entity    = sanitizeForPrompt(row.competitorEntity);
    const eType     = sanitizeForPrompt(row.entityType);
    const role      = sanitizeForPrompt(row.replacementRole);
    const winEId    = sanitizeForPrompt(row.winningEId);
    const ctrl      = sanitizeForPrompt(row.controlType);
    const factor    = sanitizeForPrompt(row.winningFactor);
    const gap       = sanitizeForPrompt(row.gapToAisle);
    const direction = sanitizeForPrompt(row.implementationDirection);
    const relKId    = sanitizeForPrompt(row.relatedKId);
    const parts = [
      `【観測${i + 1}】競合：${entity}（${eType}）`,
      `  役割：${role}`,
      `  勝因E-ID：${winEId}　制御区分：${ctrl}`,
      `  勝因説明：${factor}`,
      `  Aisleとの差分：${gap}`,
      `  推奨方針：${direction}`,
      `  関連敗因：${relKId}`,
    ];
    if (row.evidenceText && row.evidenceText !== '—') {
      const evidence = sanitizeForPrompt(row.evidenceText).slice(0, 120);
      parts.push(`  根拠テキスト：${evidence}`);
    }
    return parts.join('\n');
  });
  return `
【2層観測：E-ID競合勝因データ】
以下は2層で観測された競合勝因（E-ID）です。
step5では、この観測結果を優先して参照してください。
E-IDは補完候補ではなく、競合がGPT空間で選ばれた理由です。
各SB-IDに対して、競合勝因を再現・代替・回避のいずれで扱うべきかを判断してください。
観測E-IDが存在する場合、創作で別のE-IDを作らず、観測E-IDを優先してください。
観測データが不足する場合のみ、K-IDから理論的に推定してください。

${lines.join('\n\n')}
`;
}

// ── K-ID補足ビルダー ─────────────────────────────────────────────────

const K_ID_DEFINITIONS: Record<string, string> = {
  'K-01': '意味競合：競合が同じ意味領域・問いの文脈でより自然に出現し、自社商材が意味的に押し出された状態',
  'K-02': '主語構造競合：競合側の主語が明確で出現されやすい一方、自社商材の主語構造が曖昧で出現しづらい状態',
  'K-03': '出典競合：競合側に出典・事例・ランキング・比較記事などの参照根拠があり、自社商材が根拠不足で出現しづらい状態',
  'K-04': '構造的上位互換競合：競合側の説明構造・情報密度・カテゴリ整理が優れており、自社商材よりGPTが回答に組み込みやすい状態',
  'K-05': '情報飽和競合：類似カテゴリの競合情報が多く存在し、GPTが既存の有名候補を優先して自社商材が埋もれる状態',
  'K-06': 'プロンプト整合度競合：問いの意図に対して競合の方が自然に接続し、自社商材が問いの期待形式とズレて出現しづらい状態',
  'K-07': '外部要因量的優位：競合側の露出量・言及量・被リンク・SNS・メディア掲載などが多く、物量で自社商材が押し出される状態',
  'K-08': '対象粒度不一致競合：問いが求める対象粒度と自社商材の認識粒度が一致せず、出現対象として選ばれにくい状態',
  'K-09': 'FAQ・定義構文との誤競合：自社商材が企業・サービス候補としてではなく、一般用語・定義説明の文脈に吸収され候補として出現しづらい状態',
  'K-10': '出現対象誤認競合：GPTが紹介すべき対象を誤認し、自社商材ではなく関連概念・親カテゴリ・別企業を出してしまう状態',
};

function buildKIdInstructions(kIdScoreMap?: Record<string, string>): string {
  if (!kIdScoreMap || Object.keys(kIdScoreMap).length === 0) return '';
  const allObserved = Object.entries(kIdScoreMap)
    .map(([kId, score]) => `  ${score} ${kId}（${K_ID_DEFINITIONS[kId] ?? kId}）`);
  if (allObserved.length === 0) return '';
  return `
【競争敗因分析（K-ID）の診断結果】
以下はこの商材が競合に対してAIに出現できない主な敗因です（重要度の高い順）。
${allObserved.join('\n')}

step5の勝因接続マトリクス生成時は、これらK-IDが示す敗因に対して競合がどのE-ID構造で勝っているかを優先的に分析し、再現・代替・回避の方針を示してください。`;
}

function buildAnalysisModeInstruction(analysisMode?: string): string {
  if (analysisMode === 'success_observation') {
    return `
【分析モード：出現維持・強化】
このP-IDはすでに出現しているため、非出現補正として扱わない。目的は出現の維持・強化であり、現在の出現構造をより安定して説明・再現できる観点で評価する。
- K-IDによる敗因補正ではなく、出現を支えている意味接点・主語構造・文脈接続を尊重すること
- step5（勝因接続マトリクス）は「なぜ出現できているか」の成功観測として整理する
- step6（出現構造評価）では、出現を安定・強化するための改善レバーを示すこと
`;
  }
  if (analysisMode === 'forced_mention_observation') {
    return `
【分析モード：強制出現型】
このP-IDはプロンプト内に対象商材名が含まれる強制出現型である。
競争敗因ではなく、説明構造・比較軸・ポジショニングの明確化を目的に設計する。
step5は競合との対抗ではなく、自社の説明構造がどう機能しているかの観測として記述する。
`;
  }
  if (analysisMode === 'non_appearance_analysis' || analysisMode === 'partial_appearance_analysis') {
    return `
【分析モード：非出現/部分出現分析】
このP-IDは非出現または部分出現のため、K-ID/E-IDを競争敗因・競合勝因として扱い、step5では再現・代替・回避の設計に接続する。
`;
  }
  return '';
}

// ── API呼び出し ──────────────────────────────────────────────────────

async function callDesignStep3Api(
  companyName: string,
  productCategory: string,
  productDescription: string,
  pId: string,
  pLabel: string,
  promptText: string,
  step4: unknown,
  step3Slim: unknown,
  kIdScoreMap?: Record<string, string>,
  eIdMatrix?: EIdObservation[],
  analysisMode?: string,
) {
  const kIdInstructions = buildKIdInstructions(kIdScoreMap);
  const eIdObservationText = buildEIdObservationText(eIdMatrix);
  const analysisModeInstruction = buildAnalysisModeInstruction(analysisMode);

  // step3は sbId/mId/tId/aId のみ（afterTextはSTEP5/6では不要）
  type Step3SlimRow = { sbId?: string; mId?: string; tId?: string; aId?: string; [k: string]: unknown };
  const step3ForPrompt = Array.isArray(step3Slim)
    ? (step3Slim as Step3SlimRow[]).map(r => ({ sbId: r.sbId, mId: r.mId, tId: r.tId, aId: r.aId }))
    : step3Slim;

  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}
説明文: ${productDescription}
${kIdInstructions}
${analysisModeInstruction}
${eIdObservationText}
【P-ID情報】
P-ID: ${pId}
プロンプトタイプ: ${pLabel}
プロンプト文: 「${promptText}」

【STEP4の設計結果（参照情報）】
${JSON.stringify(step4, null, 2)}

【STEP3のSB-ID一覧（参照情報）】
${JSON.stringify(step3ForPrompt, null, 2)}

上記のSTEP4の結果を踏まえて、STEP5（勝因接続マトリクス）・STEP6（出現構造評価）・サマリを生成してください。
JSONで返答してください。`;

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

  const sbCount = Array.isArray(step3Slim) ? (step3Slim as unknown[]).length : 0;
  console.log(`[design-step3] pId=${pId} input_chars=${userContent.length} sb_count=${sbCount}`);

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: DESIGN_STEP3_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(100000),
    });
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[design-step3] fetch failed: ${errMsg}`);
    throw new Error(`Anthropic APIへの接続に失敗しました: ${errMsg}`);
  }

  let anthropicRaw = '';
  try {
    anthropicRaw = await resp.text();
  } catch {
    throw new Error(`Anthropic APIの応答読み取りに失敗しました（HTTP ${resp.status}）`);
  }
  let data: { content?: Array<{ text: string }>; error?: { message: string }; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    data = JSON.parse(anthropicRaw) as typeof data;
  } catch {
    console.error('[design-step3] Anthropic returned non-JSON:', resp.status, anthropicRaw.slice(0, 200));
    throw new Error(`Anthropic APIが不正なレスポンスを返しました（HTTP ${resp.status}）。しばらく待ってから再試行してください。`);
  }
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const rawText = (data.content?.[0]?.text ?? '').trim();
  const MAX_TOKENS_S3 = 8192;
  const outputTokensS3 = data.usage?.output_tokens ?? 0;
  const isTruncatedS3 = outputTokensS3 >= MAX_TOKENS_S3;
  console.log(`[design-step3] output_chars=${rawText.length} input_tokens=${data.usage?.input_tokens ?? 'n/a'} output_tokens=${outputTokensS3} max_tokens=${MAX_TOKENS_S3} truncated=${isTruncatedS3}`);
  const cleanedText = cleanJson(rawText);
  try {
    return JSON.parse(cleanedText);
  } catch (parseErr) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error(`[design-step3] JSON parse failed: ${errMsg}`);
    console.error(`[design-step3] truncated=${isTruncatedS3} output_tokens=${outputTokensS3}/${MAX_TOKENS_S3}`);
    const CHUNK = 800;
    for (let i = 0; i < rawText.length; i += CHUNK) {
      console.error(`[design-step3] raw[${i}-${Math.min(i + CHUNK, rawText.length)}]: ${rawText.slice(i, i + CHUNK)}`);
    }
    throw new Error(`LLM出力のJSON解析に失敗しました: ${errMsg}${isTruncatedS3 ? ' ※max_tokens到達による途中切れの可能性あり' : ''}`);
  }
}

// ── ハンドラ ─────────────────────────────────────────────────────────

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
      companyName: string;
      productCategory: string;
      productDescription: string;
      pId: string;
      pLabel: string;
      promptText: string;
      step4: unknown;
      step3Slim: unknown;
      kIdScoreMap?: Record<string, string>;
      eIdMatrix?: EIdObservation[];
      analysisMode?: string;
    };
    const { companyName, productCategory, productDescription, pId, pLabel, promptText, step4, step3Slim, kIdScoreMap, eIdMatrix, analysisMode } = body;

    if (!promptText) throw new Error('プロンプト文が必要です');

    const result = await callDesignStep3Api(companyName, productCategory, productDescription, pId, pLabel, promptText, step4, step3Slim, kIdScoreMap, eIdMatrix, analysisMode);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
