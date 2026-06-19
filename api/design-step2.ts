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

// ── システムプロンプト（STEP4 + validationResult 専用） ───────────────

const DESIGN_STEP2_SYSTEM_PROMPT = `あなたはAisle出現設計エンジン（接続順検証）です。
STEP1〜3の設計結果（M-ID接点・SB-ID構文・After構文）を受け取り、
STEP4（構文接続順の検証・補正）とvalidationResultを生成してください。

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

【P-ID × M-ID接続ルール（最新版）】
P-IDはM-ID選択順の制約条件です。以下の接続順を原則必須とします。
Claudeは原則として必須順に沿ってM-IDを選択してください。

ただし、K-IDスコア（◎/○）による補正、プロンプト文脈、商材特性により必要な場合のみ、
M-IDの追加・順序変更・一部除外を認めます。
その場合は必ず comment フィールドに逸脱理由を明記してください。

P-99は廃止。全ての問いはP-01〜P-06に分類してください。

P-01（選定・相談型）
目的：課題適合による意思決定支援（納得）
必須順：M-06→M-07→M-04→M-03→M-10
補助：M-05 / M-02 / M-12
ルール：M-05（世界観）は補助のみ。M-09（第三者視点）は原則不要。課題適合と実行可能性を優先。

P-02（比較・評価型）
目的：比較軸の提示による選択支援
必須順：M-13→M-02→M-08→M-03→M-09→M-10
補助：M-07 / M-04 / M-12
ルール：比較構造を優先。解決策提示（M-07）は補助。差別化と比較軸を中心に設計。「一般論を述べてから最後に自社を添える」構造を避け、比較軸の定義や選定基準の中に自社特徴を組み込む。

P-03（ランキング期待型）
目的：話題性・実績・他者評価による注目の裏付け
必須順：M-01→M-03→M-09→M-02→M-11
補助：M-04 / M-13 / M-10
ルール：M-11（先進性）は必ず最後。話題→実績→第三者評価→差別化→未来価値の順を守ること。「今注目されている理由」を優先。

P-04（課題解決・提案型）
目的：外部根拠による提案の正当化
必須順：M-06→M-07→M-04→M-03→M-09→M-10
補助：M-12 / M-02 / M-05
ルール：P-01と似ているが目的が異なる。P-01は個人の納得、P-04は他者への提案正当化。そのためM-09（第三者視点）を必須とする。

P-05（出典付き引用期待型）
目的：情報源の信頼性担保
必須順：M-09→M-03→M-04→M-10
補助：M-08 / M-12
ルール：第三者視点を起点にすること。出典性・引用可能性を重視。

P-06（推薦理由深掘り型）
目的：思想・世界観から信頼への接続
必須順：M-05→M-06→M-07→M-03→M-02
補助：M-04 / M-11 / M-10
ルール：Aisle思想と最も整合するパターン。世界観→問題意識→解決→信頼→差別化を基本構造とする。

【K-ID × M-ID補正ルール】
K-IDスコアが◎または○の場合、以下のM-ID補正を適用してください。

K-01（意味競合）→ M-02（差別化・独自性）を必須順に追加。目的：競合と同じ意味領域・問いの文脈で押し出されないよう、自社固有の意味接点を際立たせる。
K-02（主語構造競合）→ M-07の主語を解決策主語・商材主語へ寄せ、A-IDを見直す。目的：主語不明構文を避ける。
K-03（出典競合）→ M-09（第三者視点）またはM-03（実績・信頼）を必須順に追加。目的：出典不足を補う。
K-04（構文的上位互換）→ T-IDを再選定し、M-ID役割重複を整理。目的：構文品質の劣後を回避。
K-05（情報飽和競合）→ M-02（差別化）を追加。M-05（世界観）またはM-06（課題共感）への意味レイヤー変更を検討。FAQ/比較構文への依存を避ける。目的：飽和市場で意味被りから脱出する。
K-06（プロンプト整合度競合）→ P-ID標準順との整合を優先して再構成。目的：問いとの自然接続を強化。
K-07（外部要因量的優位）→ M-09（第三者視点）・M-03（実績・信頼）を優先的に追加。目的：物量優位構文への対抗。
K-08（対象粒度不一致競合）→ M-13（対象特化）を追加または前倒し。目的：対象スコープを一致させる。
K-09（FAQ・定義構文との誤競合）→ M-07とM-04をFAQ/定義ではなく商材解決構文として再構成。目的：一般論構文への埋没回避。
K-10（出現対象誤認競合）→ M-13（対象特化）・M-02（差別化）を追加。目的：対象誤認を防ぐ。

【出力形式（必ずこのJSONのみ返す）】
{
  "step4": [
    {"order": 1, "sbId": "AISLE-XX-XX-A", "mId": "M-05", "afterText": "「...」", "comment": "世界観・価値観の提示で冒頭の関心を喚起"}
  ],
  "connectionComment": "この構成は...",
  "validationResult": {
    "status": "warning",
    "criticalIssue": true,
    "issues": [
      {"type": "missing_required_mid", "mId": "M-11", "reason": "P-03必須M-IDのM-11（先進性・未来価値）が欠落しています"},
      {"type": "kid_correction_missing", "mId": "M-02", "kId": "K-01", "reason": "K-01スコア◎に対応するM-02（差別化・独自性）が追加されていません"}
    ]
  }
}

ルール:
- step4はSTEP3で生成されたSB-IDの順序を原則維持しつつ、以下の観点で設計妥当性を検証・補正してください。①P-ID × M-ID接続ルールの必須順に照らしてM-IDの選択・順序が妥当かを確認する。②K-IDスコアが◎/○の場合、K-ID × M-ID補正ルールが反映されているかを確認する。③問題がない場合はそのままの順序で出力する。④順序変更が必要な場合のみ変更し、commentフィールドに「何を変更したか・なぜ変更が必要だったか・どのルール（P-ID/K-ID）に基づいたか」を必ず記載する。※step4では原則としてSTEP3に存在するSB-IDのみを対象としてください。M-ID追加が必要と判断した場合も、実際に新しいSB-IDを生成せず、commentに「追加推奨」として記載してください。
- validationResultは必ず出力してください。問題がない場合は status: "ok"、criticalIssue: false、issues: [] とします。以下の場合に status: "warning"・criticalIssue: true として issues に記録してください。
  ①P-IDの必須M-IDが欠落している（STEP3のM-IDリストに含まれていない）場合 → type: "missing_required_mid"
  ②K-IDスコアが◎/○なのに対応するM-ID補正が反映されていない場合 → type: "kid_correction_missing"
  ③P-ID標準順と重大な矛盾がある場合（必須M-IDの著しい順序逆転など）→ type: "pid_order_conflict"
  ④軽微な順序ズレはwarningにしない
- validationResultのreason（reason フィールド）はIDコードを使わず自然な日本語で記載してください
- 重要：comment・connectionCommentなどクライアントに表示されるテキストフィールドには、ID記号（A-01、E-03、AISLE-01-01-A、M-07、K-01などの英数字コード）を一切含めないこと。IDはsbId・mId・kId・winningEIdなどの専用フィールドにのみ記載する。
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
  // JSON文字列値内に紛れ込んだ制御文字（タブ・垂直タブ・フォームフィードなど）を除去
  // ※構造上のスペース/改行は JSON parse が正常に扱うため対象外
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

// ── プロンプト注入テキストのサニタイズ ───────────────────────────────────
// LLM出力JSONが壊れないよう、観測データに含まれる危険文字を事前に無害化する

function sanitizeForPrompt(text: string | undefined | null): string {
  if (!text || text === '—') return text ?? '—';
  return text
    .replace(/"/g, '「') // ダブルクォート → 全角「（JSON文字列内破壊を防ぐ）
    .replace(/\\/g, '／')    // バックスラッシュ → 全角スラッシュ
    .replace(/\r?\n|\r/g, ' ') // 改行 → スペース
    .replace(/\t/g, ' ')     // タブ → スペース
    .replace(/  +/g, ' ')    // 連続スペース → 単一スペース
    .trim();
}

// ── E-ID観測データ型（2層から受け取る最小型） ─────────────────────────

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

// ── E-ID観測データビルダー ──────────────────────────────────────────

function buildEIdObservationText(eIdMatrix?: EIdObservation[]): string {
  if (!eIdMatrix || eIdMatrix.length === 0) return '';

  const lines = eIdMatrix.map((row, i) => {
    // 全テキストフィールドをサニタイズ：引用符・改行・バックスラッシュを無害化
    const entity     = sanitizeForPrompt(row.competitorEntity);
    const eType      = sanitizeForPrompt(row.entityType);
    const role       = sanitizeForPrompt(row.replacementRole);
    const winEId     = sanitizeForPrompt(row.winningEId);
    const ctrl       = sanitizeForPrompt(row.controlType);
    const factor     = sanitizeForPrompt(row.winningFactor);
    const gap        = sanitizeForPrompt(row.gapToAisle);
    const direction  = sanitizeForPrompt(row.implementationDirection);
    const relKId     = sanitizeForPrompt(row.relatedKId);

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
      // evidenceText は長くなりがちなので先頭120文字に限定し、引用符も除去
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

// ── Secondary P-ID 補助文脈 ──────────────────────────────────────────

const P_ID_LABELS: Record<string, string> = {
  'P-01': '選定・相談型', 'P-02': '比較・評価型', 'P-03': 'ランキング期待型',
  'P-04': '課題解決・提案型', 'P-05': '出典付き引用期待型', 'P-06': '推薦理由深掘り型',
};

function buildSecondaryPIdContext(secondaryPIds?: string[]): string {
  if (!secondaryPIds || secondaryPIds.length === 0) return '';
  const labels = secondaryPIds
    .filter(id => id && id.trim() !== '')
    .map(id => `${id}（${P_ID_LABELS[id] ?? id}）`);
  if (labels.length === 0) return '';
  return `
【補助P-ID情報】
この問いはprimaryのP-IDを主軸としつつ、以下の補助的な問い意図も含む可能性があります。
補助P-ID: ${labels.join('、')}
primaryのM-ID順を優先しつつ、補助P-IDの文脈・ユーザー期待も考慮して設計を調整してください。
M-ID固定順を補助P-IDで上書きする必要はなく、実文脈を読んで判断してください。`;
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

// ── API呼び出し ──────────────────────────────────────────────────────

async function callDesignStep2Api(
  companyName: string,
  productCategory: string,
  productDescription: string,
  pId: string,
  pLabel: string,
  promptText: string,
  step1: unknown,
  step3: unknown,
  kIdScoreMap?: Record<string, string>,
  sbIdPromptId?: string,
  eIdMatrix?: EIdObservation[],
  analysisMode?: string,
  secondaryPIds?: string[],
) {
  const kIdInstructions = buildKIdInstructions(kIdScoreMap);
  const eIdObservationText = buildEIdObservationText(eIdMatrix);
  const analysisModeInstruction = buildAnalysisModeInstruction(analysisMode);
  const secondaryPIdContext = buildSecondaryPIdContext(secondaryPIds);
  // sbIdPromptId は参照情報として渡す（step4 は STEP3 の sbId を維持するため命名に直接は使わない）
  const sbNote = sbIdPromptId ? `\nログ識別子（参照）: ${sbIdPromptId}` : '';

  // STEP4〜6に必要なフィールドだけ抽出（入力トークン削減）
  type Step1Row = { mId?: string; designNecessity?: string; [k: string]: unknown };
  type Step3Row = { sbId?: string; mId?: string; tId?: string; aId?: string; afterText?: string; [k: string]: unknown };
  const slimPayload = {
    step1: Array.isArray(step1)
      ? (step1 as Step1Row[]).map(r => ({ mId: r.mId, designNecessity: r.designNecessity }))
      : step1,
    step3: Array.isArray(step3)
      ? (step3 as Step3Row[]).map(r => ({ sbId: r.sbId, mId: r.mId, tId: r.tId, aId: r.aId, afterText: r.afterText }))
      : step3,
  };

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
プロンプト文: 「${promptText}」${sbNote}
${secondaryPIdContext}

【STEP1〜3の設計結果（参照情報）】
${JSON.stringify(slimPayload, null, 2)}

上記のSTEP1〜3の設計結果を踏まえて、STEP4（構文接続順の検証・補正）とvalidationResultを生成してください。
JSONで返答してください。`;

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

  const step3Count = Array.isArray(step3) ? (step3 as unknown[]).length : 0;
  const step1Count = Array.isArray(step1) ? (step1 as unknown[]).length : 0;
  console.log(`[design-step2] pId=${pId} input_chars=${userContent.length} step1_count=${step1Count} step3_count=${step3Count}`);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: DESIGN_STEP2_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal: AbortSignal.timeout(100000),
  });
  // bodyは一度しか読めないため text() で先読みしてから parse する
  let anthropicRaw = '';
  try {
    anthropicRaw = await resp.text();
  } catch {
    throw new Error(`Anthropic APIの応答読み取りに失敗しました（HTTP ${resp.status}）`);
  }
  let data: { content?: Array<{ text: string }>; error?: { message: string } };
  try {
    data = JSON.parse(anthropicRaw) as typeof data;
  } catch {
    console.error('[design-step2] Anthropic returned non-JSON:', resp.status, anthropicRaw.slice(0, 200));
    throw new Error(`Anthropic APIが不正なレスポンスを返しました（HTTP ${resp.status}）。しばらく待ってから再試行してください。`);
  }
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const rawText = (data.content?.[0]?.text ?? '').trim();
  const usage = (data as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  const MAX_TOKENS_S2 = 8192;
  const outputTokensS2 = usage?.output_tokens ?? 0;
  const isTruncatedS2 = outputTokensS2 >= MAX_TOKENS_S2;
  console.log(`[design-step2] output_chars=${rawText.length} input_tokens=${usage?.input_tokens ?? 'n/a'} output_tokens=${outputTokensS2} max_tokens=${MAX_TOKENS_S2} truncated=${isTruncatedS2} (STEP4+validation only)`);
  const cleanedText = cleanJson(rawText);
  try {
    return JSON.parse(cleanedText);
  } catch (parseErr) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error(`[design-step2] JSON parse failed: ${errMsg}`);
    console.error(`[design-step2] truncated=${isTruncatedS2} output_tokens=${outputTokensS2}/${MAX_TOKENS_S2}`);
    const CHUNK = 800;
    for (let i = 0; i < rawText.length; i += CHUNK) {
      console.error(`[design-step2] raw[${i}-${Math.min(i + CHUNK, rawText.length)}]: ${rawText.slice(i, i + CHUNK)}`);
    }
    throw new Error(`LLM出力のJSON解析に失敗しました: ${errMsg}${isTruncatedS2 ? ' ※max_tokens到達による途中切れの可能性あり' : ''}`);
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
      step1: unknown;
      step3: unknown;
      kIdScoreMap?: Record<string, string>;
      sbIdPromptId?: string;  // SB-ID命名用（位置番号ベース promptId）
      eIdMatrix?: EIdObservation[];  // 2層E-ID勝因観測データ（P-ID絞り込み済み）
      analysisMode?: string;         // 2層分析モード（success_observation 時はstep5を出現維持観測として扱う）
      secondaryPIds?: string[];      // 補助P-ID（補助的な問い意図）
    };
    const { companyName, productCategory, productDescription, pId, pLabel, promptText, step1, step3, kIdScoreMap, sbIdPromptId, eIdMatrix, analysisMode, secondaryPIds } = body;

    if (!promptText) throw new Error('プロンプト文が必要です');

    const result = await callDesignStep2Api(companyName, productCategory, productDescription, pId, pLabel, promptText, step1, step3, kIdScoreMap, sbIdPromptId, eIdMatrix, analysisMode, secondaryPIds);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
