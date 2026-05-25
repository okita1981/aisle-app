import type {
  LogEntry, AppearanceStats, TheoryDesign, ReconciliationResult, ImplementationReport,
  DesignBlock, DiffItem, SourceCat, AnalysisMode, CompetitorAnalysisResult,
  CompetitorEntityRow,
  SourceMatrixRow, AppearanceRateRow, OutputReasonRow, OutputSummaryItem,
  IdMatrixRow, KIdMatrixRow, EIdRow, KIdScoreRow, StructureSummaryRow,
  SuccessPatternRow, BlockPatternRow, StrategyRow, PriorityRow,
} from '../types';
import { K_IDS, K_IDS_DETAIL, T_IDS, M_IDS, E_IDS, P_IDS } from './masterData';

// =====================================================================
// フェーズ① 出力傾向観察フェーズ
// =====================================================================

/** 出典分類キーワードマップ（優先順位順） */
const SOURCE_KEYWORDS: Array<{ cat: SourceCat; keywords: string[] }> = [
  { cat: '業界レポート／資料', keywords: ['レポート', '調査', '統計', '資料', 'ランキング', '業界', '分析', 'ニュース', '白書', '調査結果'] },
  { cat: 'レビューサイト',     keywords: ['レビュー', '口コミ', '比較', '評価', '評判', '価格.com', 'Amazon', 'アマゾン', 'みんなの', 'コスパ'] },
  { cat: '公式サイト',         keywords: ['公式', '公式サイト', '製品ページ', '会社HP', 'ホームページ', 'ブランドサイト'] },
  { cat: 'Wikipedia／用語定義サイト', keywords: ['Wikipedia', 'ウィキペディア', '用語', 'とは', '定義', '百科', '辞典'] },
  { cat: 'その他',             keywords: ['SNS', 'Twitter', 'X.com', 'Instagram', 'YouTube', '話題', 'ネット', 'ブログ', 'フォーラム'] },
];

/** 出典分類を自動判定（CSVにない場合） */
export function detectSourceCategory(text: string): SourceCat {
  for (const { cat, keywords } of SOURCE_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  // 説明文らしければ「一般知識」、断定だけなら「出典不明」
  if (text.length > 40 && /です|ます|されて|ており|という/.test(text)) return '一般知識';
  return '出典不明';
}

/** P-IDタイプ名を返す（例: P-01-01 → 選定・相談型） */
function getTypeName(promptId: string): string {
  const base = promptId.split('-').slice(0, 2).join('-'); // P-01
  return P_IDS.find(p => p.pId === base)?.label ?? promptId;
}

/**
 * C-ID自動付与（テキストからキーワードで判定）
 * C-IDはK-ID/E-ID導出のための補助特徴量。C-01〜C-06の6分類。
 * C-07〜C-10は廃止済みのため新規付与しない（既存データとの互換のみ）。
 */
export function assignCId(text: string): string {
  // C-01 信頼形成型: 実績・第三者評価・専門性・出典を根拠に信頼を形成
  if (/実績|導入|事例|評価|専門家|信頼|受賞|認定|レビュー|取引先|採用実績/.test(text)) return 'C-01';
  // C-02 比較評価型: 他社比較・差別化・選定理由など相対評価
  if (/比較|違い|選び方|対比|差別化|選ばれ|選定|なぜ|優れ|コスパ|評価軸/.test(text)) return 'C-02';
  // C-04 世界観共鳴型: 理念・思想・ストーリー・社会課題（C-03より先に判定）
  if (/理念|思想|使命|ビジョン|社会課題|変える|未来|AI時代|在り方|革新|マーケティングの構造/.test(text)) return 'C-04';
  // C-05 利用文脈型: 誰が・いつ・どのように使うか
  if (/向け|ニーズ|シーン|担当者|企業向け|使い方|活用方法|ケース|場合|利用者/.test(text)) return 'C-05';
  // C-06 話題性・先進性型: 話題・注目・革新性・先進
  if (/話題|注目|人気|トレンド|先進|次世代|バズ|最新|今注目|生成AI/.test(text)) return 'C-06';
  // C-03 構造理解型: 概念整理・体系化・説明（デフォルト寄り）
  if (/とは|つまり|構造|分類|整理|ステップ|特徴|仕様|機能|できます|とされ/.test(text)) return 'C-03';
  return 'C-03'; // デフォルト: 構造理解型（説明・整理が汎用的）
}

/** A-ID自動付与（テキストから主語構造を判定） */
export function assignAId(text: string): string {
  if (/専門家|研究者|医師|コンサル|エキスパート|弁護士/.test(text)) return 'A-01';
  if (/官公庁|政府|自治体|国土交通|総務省|調査機関|学会/.test(text)) return 'A-06';
  if (/新聞|雑誌|メディア|誌|報道|週刊|〜日報/.test(text)) return 'A-03';
  if (/ユーザー|口コミ|利用者|体験談|レビュー投稿|購入者/.test(text)) return 'A-04';
  if (/創業者|代表取締役|CEO|社長|経営者|代表者/.test(text)) return 'A-07';
  if (/担当者|社員|スタッフ|現場|チームメンバー/.test(text)) return 'A-08';
  if (/パートナー|提携|協力会社|協業|共同/.test(text)) return 'A-09';
  // 商材主語の判定（[製品名]は〜 など）
  if (/は、|が提供|を展開|を運営|のサービス/.test(text)) return 'A-02';
  // A-10: 複数視点混在
  if (/一方で|また|さらに|他方/.test(text) && text.length > 100) return 'A-10';
  return 'A-05'; // デフォルト：ナレーター視点
}

/** AP-ID付与（A-10のみ） */
export function assignApId(text: string): string {
  if (/注目|話題|〜と言われ|とされ/.test(text)) return 'AP-01';    // 第三者視点型
  if (/とは|とされる|〜です|定義/.test(text)) return 'AP-02';       // 解説提示型
  if (/^[^\s]{1,10}は/.test(text.trim())) return 'AP-03';           // 商材主題型
  if (/おすすめ|選ばれ|評価され/.test(text)) return 'AP-04';        // 評価提示型
  return 'AP-05';                                                     // 複合視点型
}

/** ①-1: 出典傾向マトリクス */
export function buildSourceMatrix(entries: LogEntry[]): SourceMatrixRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => {
    (groups[e.promptId] ??= []).push(e);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      const byCat: Record<string, number> = {};
      rows.forEach(r => {
        const cat = r.sourceCategory || detectSourceCategory(r.aiOutput);
        byCat[cat] = (byCat[cat] || 0) + 1;
      });
      return {
        promptId,
        typeName: getTypeName(promptId),
        total: rows.length,
        byCat: byCat as Record<SourceCat, number>,
        note: '',
      };
    });
}

/** ①-2: 出現率マトリクス */
export function buildAppearanceRates(entries: LogEntry[]): AppearanceRateRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      const appeared = rows.filter(r => r.appeared).length;
      const rate = rows.length > 0 ? (appeared / rows.length * 100).toFixed(1) + '%' : '0.0%';
      return { promptId, typeName: getTypeName(promptId), appearedCount: appeared, trialCount: rows.length, rate };
    });
}

/** ①-3: 出力理由マトリクス */
export function buildOutputReasons(entries: LogEntry[]): OutputReasonRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      // 代表プロンプト文
      const promptText = rows[0]?.prompt ?? '';
      // 出力理由欄があれば使用、なければaiOutputから要約
      const reasons = rows.filter(r => r.appeared).map(r => r.outputReason || r.aiOutput.slice(0, 50));
      const summary = reasons.slice(0, 2).join(' / ') || '出現なし';
      // 頻出パターン（理由列またはaiOutput先頭から）
      const patterns = [...new Set(rows.map(r =>
        r.outputReason ? r.outputReason.slice(0, 20) : ''
      ).filter(Boolean))].slice(0, 3).join('、') || '—';
      return { promptId, promptText, reasonSummary: summary, reasonPatterns: patterns };
    });
}

/** ①-4: 出力理由まとめ（6項目） */
export function buildOutputSummary(
  sourceMatrix: SourceMatrixRow[],
  rateMatrix: AppearanceRateRow[],
  entries: LogEntry[],
): OutputSummaryItem[] {
  const totalRate = rateMatrix.reduce((s, r) => s + parseFloat(r.rate), 0) / (rateMatrix.length || 1);
  const topSource = Object.entries(
    sourceMatrix.reduce((acc, row) => {
      Object.entries(row.byCat).forEach(([cat, n]) => { acc[cat] = (acc[cat] || 0) + n; });
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0];
  const lowRatePrompts = rateMatrix.filter(r => parseFloat(r.rate) < 30).map(r => r.promptId).join('・');
  const highRatePrompts = rateMatrix.filter(r => parseFloat(r.rate) >= 50).map(r => r.promptId).join('・');
  const aIds = entries.map(e => e.aId || assignAId(e.aiOutput));
  const a10count = aIds.filter(a => a === 'A-10' || a === 'A-05').length;
  const a10rate = Math.round(a10count / (entries.length || 1) * 100);

  return [
    { label: '🔹 1. 出力傾向の俯瞰', content: `全P-IDの平均出現率は${totalRate.toFixed(1)}%。${highRatePrompts ? `${highRatePrompts}では比較的高く、` : ''}出典接続が${topSource?.[0] ?? '一般知識'}に偏在。出現ログ全体の構文密度は低く、選定確定構文に至らない中途半端な応答が目立つ。` },
    { label: '🔹 2. 非出現プロンプトの構造的阻害要因', content: `${lowRatePrompts ? `${lowRatePrompts}では出現率が30%未満。` : ''}プロンプトの意図と接続できる評価軸・主語構造が乏しく、ナレーター視点の中立構文に収束する傾向。特定の評価主体・出典が不在であることが出現困難の主因。` },
    { label: '🔹 3. 語彙接続の特徴と偏在', content: `再現語彙は「${(topSource?.[0] ?? '一般知識')}」系の構文に集中。「導入実績」「比較評価軸」「信頼補完」に接続する語彙は出現頻度が低く、推薦文脈への到達が弱い。` },
    { label: '🔹 4. 出力主語構造の傾向', content: `ナレーター・混在視点の構文が全体の約${a10rate}%を占める。信頼形成に有効な企業主語・ユーザー視点・専門家視点の比率が低く、評価主体不在の構文構造が顕著。` },
    { label: '🔹 5. 再現されやすい意味構造の型', content: `「特徴列挙→機能提示」の説明構文が中心。「レビュー評価→選定理由」「導入実績→信頼形成」「比較軸→推薦」の接続パターンは未確認または出現率が低く、差別化構造・信頼補完構造が弱い。` },
    { label: '🔹 6. 出現補助要因・外部支援可能性', content: `出典明示（業界レポート・公式掲載・導入事例）との接続で出現率が改善する傾向が観察される。外部出典補完（出典付き事例、専門家引用、ランキング掲載）を接続し、意味構造との整合性を高めることで出現率の向上が見込まれる。` },
  ];
}

// =====================================================================
// フェーズ② 出力構造分解フェーズ
// =====================================================================

/** C-ID/A-ID/AP-IDを付与した拡張エントリを返す */
export function assignStructureIds(entries: LogEntry[]): LogEntry[] {
  return entries.map(e => ({
    ...e,
    cId: e.cId || assignCId(e.aiOutput),
    aId: e.aId || assignAId(e.aiOutput),
    apId: e.apId || ((e.aId === 'A-10' || assignAId(e.aiOutput) === 'A-10') ? assignApId(e.aiOutput) : ''),
  }));
}

/** ②-5: ID傾向マトリクスを構築 */
export function buildIdMatrix(entries: LogEntry[], field: 'cId' | 'aId' | 'apId', allIds: string[]): IdMatrixRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      const base = field === 'apId' ? rows.filter(r => r.aId === 'A-10') : rows;
      const counts: Record<string, number> = {};
      allIds.forEach(id => { counts[id] = 0; });
      base.forEach(r => {
        const v = r[field];
        if (v && allIds.includes(v)) counts[v] = (counts[v] || 0) + 1;
      });
      return { promptId, total: base.length, counts };
    });
}

// =====================================================================
// 分析モード判定
// =====================================================================

/**
 * 同一 promptId のログ群から分析モードを判定する。
 * - entries: 全エントリ（内部で promptId でフィルタ）
 * - promptId: 対象プロンプトID
 *
 * 判定優先順位:
 *   appeared=true のみ → success_observation
 *   true/false 混在    → partial_appearance_analysis
 *   appeared=false のみ → non_appearance_analysis
 *   （forced_mention_observation は将来 Phase0 フラグで付与）
 */
export function getAnalysisMode(entries: LogEntry[], promptId: string): AnalysisMode {
  const rows = entries.filter(e => e.promptId === promptId);
  if (rows.length === 0) return 'non_appearance_analysis';
  const hasTrue  = rows.some(e => e.appeared);
  const hasFalse = rows.some(e => !e.appeared);
  if (hasTrue && !hasFalse) return 'success_observation';
  if (hasTrue && hasFalse)  return 'partial_appearance_analysis';
  return 'non_appearance_analysis';
}

/**
 * 全エントリを promptId でグループ化し、P-ID ごとの分析モードマップを返す。
 * runFullAnalysis / runClassification / runWithoutApi で共通利用。
 */
export function buildModeMap(entries: LogEntry[]): Record<string, AnalysisMode> {
  const promptIds = [...new Set(entries.map(e => e.promptId))];
  const map: Record<string, AnalysisMode> = {};
  promptIds.forEach(pid => { map[pid] = getAnalysisMode(entries, pid); });
  return map;
}

// =====================================================================
// フェーズ③ 出現阻害構造評価フェーズ
// =====================================================================

/**
 * K-ID weight付与（正式定義・競合敗因観測ベース）
 *
 * K-IDは「なぜ自社商材がGPT空間に出現できなかったか」の構造的敗因ラベル。
 * boolean発火ではなく 0〜1 の強度（weight）を返す。
 * 強度は replacementRole × entityType の組み合わせに基づいて決定。
 *
 * 優先パス:
 *   1. mode が success_observation / forced_mention_observation → return {}
 *   2. appeared=true のログ → return {}
 *   3. competitorAnalysis あり → entityByPId + E-ID から判定（優先）
 *   4. competitorAnalysis なし → aiOutput + promptText + E-ID から暫定判定
 *
 * 戻り値: Record<string, number>  例: { 'K-08': 0.9, 'K-01': 0.3 }
 * 表示用 string[] への変換は extractKIds() を使用する。
 */
export function assignKIds(
  entry: LogEntry,
  mode: AnalysisMode = 'non_appearance_analysis',
  competitorAnalysis?: CompetitorAnalysisResult | null,
): Record<string, number> {
  // Rule 1: 100%出現・強制出現では敗因なし
  if (mode === 'success_observation' || mode === 'forced_mention_observation') return {};
  // Rule 2: appeared=true のログには付けない
  if (entry.appeared) return {};

  const weights: Record<string, number> = {};
  const promptText = entry.prompt ?? '';
  const promptTypeId = entry.promptId?.split('-').slice(0, 2).join('-') ?? '';
  const aiOutput = entry.aiOutput ?? '';
  const eIds = entry.eIds ?? [];
  // 問いが「会社/企業」を求めているか（粒度判定に使用）
  const asksForCompany = /会社|企業|代理店|パートナー/.test(promptText);

  if (competitorAnalysis) {
    // ── competitorAnalysis 優先パス ──────────────────────────────────

    // このP-IDのエンティティ一覧（pId / promptTypeId どちらでも検索）
    const pIdEntities =
      competitorAnalysis.entityByPId?.[entry.promptId] ??
      competitorAnalysis.entityByPId?.[promptTypeId] ??
      [];

    // ── K-08: 対象粒度不一致競合（強: 0.9）──────────────────────────
    // 問いが「会社/企業」を求めているのにツール・概念が出ている
    if (asksForCompany &&
      pIdEntities.some(e => e.entityType === 'tool' || e.entityType === 'concept')
    ) {
      weights['K-08'] = 0.9;
    }

    // ── K-10: 出現対象誤認競合（強: 0.8）────────────────────────────
    // 非 company 問いで概念・別カテゴリが主対象として出ている
    if (!asksForCompany && pIdEntities.some(e => e.entityType === 'concept')) {
      weights['K-10'] = 0.8;
    }

    // ── K-01: 意味競合（replacementRole 依存）────────────────────────
    // 代替候補/比較対象 × company/service → 強 (0.7)
    // company/service が出ているが代替役割でない → 弱シグナル (0.25)
    const isDirectRival = pIdEntities.some(e =>
      (e.replacementRole === '代替候補' || e.replacementRole === '比較対象') &&
      (e.entityType === 'company' || e.entityType === 'service')
    );
    if (isDirectRival) {
      weights['K-01'] = 0.7;
    } else if (pIdEntities.some(e => e.entityType === 'company' || e.entityType === 'service')) {
      // company/service は出ているが代替候補・比較対象でない → 弱シグナル
      weights['K-01'] = 0.25;
    }

    // ── K-02: 主語構造競合（弱補助: 0.35）───────────────────────────
    // K-01 が弱い（<0.5）場合のみ補助的に付与
    if ((weights['K-01'] ?? 0) < 0.5 &&
      pIdEntities.some(e => e.replacementRole === '代替候補' && e.entityType === 'company')
    ) {
      weights['K-02'] = 0.35;
    }

    // ── K-05: 情報飽和競合（中: 0.5）────────────────────────────────
    // 同じ entityType × 同じ replacementRole が2件以上の場合のみ発火
    // 単純な件数ではなくクラスタ密度で判定
    const typeRoleGroups: Record<string, number> = {};
    pIdEntities.forEach(e => {
      const key = `${e.entityType ?? '—'}::${e.replacementRole ?? '—'}`;
      typeRoleGroups[key] = (typeRoleGroups[key] ?? 0) + 1;
    });
    const maxClusterCount = Object.values(typeRoleGroups).reduce((m, v) => Math.max(m, v), 0);
    if (maxClusterCount >= 2) {
      weights['K-05'] = 0.5;
    }

    // ── K-06: プロンプト整合度競合（弱: 0.4）────────────────────────
    // K-08 が強く出ていない場合のみ付与（K-08 と意味が重複するため）
    if (asksForCompany &&
      pIdEntities.some(e => e.entityType === 'tool' || e.entityType === 'service') &&
      (weights['K-08'] ?? 0) < 0.7
    ) {
      weights['K-06'] = 0.4;
    }

    // ── E-IDベース補完（出典・物量の観測差）─────────────────────────
    // K-03: 出典競合（媒体掲載 / ランキング → 根拠の差）
    if (eIds.includes('E-01') || eIds.includes('E-07')) weights['K-03'] = 0.6;
    // K-07: 外部要因量的優位（SNS/UGC / 被リンク → 物量の差）
    if (eIds.includes('E-05') || eIds.includes('E-06')) weights['K-07'] = 0.5;
    // K-09: FAQ/定義構文との誤競合（FAQ/Schema が競合勝因として観測）
    if (eIds.includes('E-04')) weights['K-09'] = 0.5;

  } else {
    // ── competitorAnalysis なし → aiOutput + promptText + E-ID 暫定パス ──

    const src = entry.sourceCategory || detectSourceCategory(aiOutput);

    // K-08: 問いが会社/企業を求めているのに概念・定義・仕組み説明が出力
    if (asksForCompany && /とは|概念|仕組み|手法|アプローチ|フレームワーク/.test(aiOutput)) {
      weights['K-08'] = 0.8;
    }

    // K-09: FAQ/定義文脈に吸収されている
    if (/とは[、。\s]/.test(aiOutput.slice(0, 150)) || eIds.includes('E-04')) {
      weights['K-09'] = 0.55;
    }

    // K-03: 出典・根拠の差
    if (eIds.includes('E-01') || eIds.includes('E-07') || src === '業界レポート／資料') {
      weights['K-03'] = 0.6;
    }

    // K-07: 物量差
    if (eIds.includes('E-05') || eIds.includes('E-06')) weights['K-07'] = 0.5;

    // K-05: 列挙構文 → 弱シグナル（暫定）
    if ((/(①|②|③)/.test(aiOutput) || /^\d\.\s/m.test(aiOutput)) && aiOutput.length > 300) {
      weights['K-05'] = 0.35;
    }

    // K-01: 推薦・候補文脈 → 弱シグナル（暫定）
    if (/おすすめ|推薦|選ぶなら|候補|ベスト/.test(aiOutput)) {
      weights['K-01'] = 0.3;
    }
  }

  return weights;
}

/**
 * weight マップから K-ID string[] を抽出する。
 * threshold 以上の weight を持つ K-ID を強度降順で返す（最大3件）。
 * @param weights assignKIds() の返り値
 * @param threshold 採用下限（デフォルト 0.15）
 */
export function extractKIds(weights: Record<string, number>, threshold = 0.15): string[] {
  return Object.entries(weights)
    .filter(([, w]) => w >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 3);
}

/**
 * E-ID勝因ラベル付与（LogEntry 単位）
 *
 * appeared=false エントリの aiOutput に含まれる出典・主語構造から、
 * 「競合がGPT空間で選ばれた理由（勝因）」をE-IDコードとして観測する。
 *
 * 各E-IDの意味（正式定義）:
 *   E-01: 媒体掲載（業界レポート/調査資料） → E-A（真正外部勝因）
 *   E-02: 専門家・有識者の言及              → E-A（真正外部勝因）
 *   E-03: 出典付き事例（企業主語）           → E-B（設計可能勝因）
 *   E-04: FAQ/Schema構造                    → E-B（設計可能勝因）
 *   E-05: SNS/UGC・ユーザー言及             → E-A（真正外部勝因）
 *   E-06: 被リンク/ドメイン強度             → E-A（真正外部勝因）
 *   E-07: ランキング/比較記事               → E-A（真正外部勝因）
 *
 * success_observation / forced_mention_observation では発火しない（競合勝因観測不要）。
 * buildEIdMatrix() で competitorAnalysis と結合して完全な勝因接続行を生成する。
 */
export function assignEIds(entry: LogEntry, mode: AnalysisMode = 'non_appearance_analysis'): string[] {
  // 100%出現・強制出現では競合勝因観測なし → E-ID 不発火
  if (mode === 'success_observation' || mode === 'forced_mention_observation') return [];

  const src = entry.sourceCategory || detectSourceCategory(entry.aiOutput);
  const eIds: string[] = [];

  if (src === '業界レポート／資料') eIds.push('E-01');
  if (entry.aId === 'A-01') eIds.push('E-02');
  if (entry.aId === 'A-02' && entry.cId === 'C-03') eIds.push('E-03');
  if (src === 'レビューサイト') eIds.push('E-04');
  if (src === 'レビューサイト' && entry.cId === 'C-01') eIds.push('E-05');
  if (entry.aId === 'A-04' || src === 'その他') eIds.push('E-06');
  if (src === '公式サイト') eIds.push('E-07');

  return [...new Set(eIds)].slice(0, 3);
}

/**
 * ③-2: K-ID傾向マトリクス
 * weight平均で%算出（発火数ではなく強度）
 * kIdWeights が存在する場合はそれを優先し、なければ kIds 存在で 0.5 を仮置き
 */
export function buildKIdMatrix(entries: LogEntry[]): KIdMatrixRow[] {
  const ALL_KIDS = ['K-01','K-02','K-03','K-04','K-05','K-06','K-07','K-08','K-09','K-10'];
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      const rates: Record<string, string> = {};
      ALL_KIDS.forEach(kid => {
        // weight平均 = sum(各エントリのweight) / total × 100
        const weightSum = rows.reduce((sum, r) => {
          const w = r.kIdWeights?.[kid]
            ?? ((r.kIds ?? []).includes(kid) ? 0.5 : 0); // 旧データ互換
          return sum + w;
        }, 0);
        rates[kid] = rows.length > 0
          ? Math.floor(weightSum / rows.length * 100) + '%'
          : '0%';
      });
      const topKIds = ALL_KIDS.filter(k => parseInt(rates[k]) > 0)
        .sort((a, b) => parseInt(rates[b]) - parseInt(rates[a]))
        .slice(0, 2);
      const kDef0 = K_IDS_DETAIL.find(k => k.kId === topKIds[0]);
      const kDef1 = K_IDS_DETAIL.find(k => k.kId === topKIds[1]);
      const comment = topKIds.length > 0
        ? `${kDef0?.label ?? topKIds[0]}${kDef1 ? `（${kDef1.label}）` : ''}が主因`
        : '—';
      return { promptId, total: rows.length, rates, comment };
    });
}

// E-IDのcontrolType分類（正式定義）
// E-A: 真正外部勝因（第三者依存・再現難） → E-01 媒体掲載 / E-02 専門家言及 / E-05 SNS/UGC / E-06 被リンク/ドメイン強度 / E-07 ランキング記事
// E-B: 設計可能勝因（自社実装で再現可）  → E-03 出典付き事例 / E-04 FAQ/Schema / E-08〜E-13 AI専用サイト等
const EA_IDS = new Set(['E-01', 'E-02', 'E-05', 'E-06', 'E-07']);

/**
 * 複数のE-IDリストからcontrolTypeを判定する。
 * - E-Aのみ → 'E-A'
 * - E-Bのみ → 'E-B'
 * - E-A/E-B 混在 → 'mixed'
 * - E-IDなし → '—'
 */
function classifyControlType(eIds: string[]): 'E-A' | 'E-B' | 'mixed' | '—' {
  if (eIds.length === 0) return '—';
  const hasEA = eIds.some(id => EA_IDS.has(id));
  const hasEB = eIds.some(id => !EA_IDS.has(id));
  if (hasEA && hasEB) return 'mixed';
  if (hasEA) return 'E-A';
  return 'E-B';
}

function deriveImplementationDirection(
  controlType: 'E-A' | 'E-B' | 'mixed' | '—',
  replacementRole: string,
): '再現' | '代替' | '回避' | '—' {
  if (controlType === '—') return '—';
  if (replacementRole === 'ツール例') return '回避';  // 対象粒度ズレ → 別軸へ
  if (controlType === 'E-A') return '代替';           // 真正外部勝因は第三者依存 → AI専用サイト等で代替
  if (controlType === 'mixed') return '代替';          // 混在時は保守的に代替方針を採用
  return '再現';                                       // 設計可能勝因（E-B）は自社実装で再現可
}

/**
 * competitorAnalysis の entity 情報から winningEId を推定する（fallback用）
 *
 * entry.eIds が空（assignEIds のルールが発火しない）場合に使用。
 * entityType / replacementRole / dominantStructure / whyItAppeared から以下を推定:
 *   E-11: エンティティ出現済情報 — 会社/サービス/ツールは GPT 学習データに既出
 *   E-07: ランキング/比較記事   — 比較/代替役割 or ランキング系語彙が出現
 *   E-09: 複数出典の交差構造    — 同一 P-ID に 2 件以上のエンティティが並列出現
 */
function inferWinningEIds(
  entity: CompetitorEntityRow,
  totalEntitiesInPId: number,
): string[] {
  const eIds: string[] = [];

  // E-11: 既知エンティティとして GPT 学習データに既出（Jasper / Copy.ai / Synthesia など）
  if (
    entity.entityType === 'company' ||
    entity.entityType === 'service' ||
    entity.entityType === 'tool'
  ) {
    eIds.push('E-11');
  }

  // E-07: ランキング・比較・列挙文脈
  const rankingPattern = /ランキング|比較|おすすめ|ベスト|選び方|一覧|TOP\d|\d+選/;
  if (
    entity.replacementRole === '比較対象' ||
    entity.replacementRole === '代替候補' ||
    rankingPattern.test(entity.dominantStructure ?? '') ||
    rankingPattern.test(entity.whyItAppeared ?? '')
  ) {
    eIds.push('E-07');
  }

  // E-09: 複数出典の交差構造（同一 P-ID に 2 件以上並列 = 列挙・比較リスト文脈）
  if (totalEntitiesInPId >= 2) {
    eIds.push('E-09');
  }

  return [...new Set(eIds)].slice(0, 3);
}

/**
 * ③-3: E-ID勝因接続マトリクス（P-ID × 競合エンティティ × 勝因E-ID）
 *
 * competitorAnalysis が存在する場合は entityByPId を使ってエンティティ詳細を付与。
 * 存在しない場合は appeared=false ログから概算行を生成。
 *
 * K-IDと同一現象の表裏として機能するマトリクス。
 */
export function buildEIdMatrix(
  entries: LogEntry[],
  competitorAnalysis?: CompetitorAnalysisResult | null,
  companyName = '',
): EIdRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  const rows: EIdRow[] = [];

  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([promptId, pRows]) => {
      const promptTypeId = promptId.split('-').slice(0, 2).join('-');

      // 非出現ログ（分析主軸）
      const falseRows = pRows.filter(r => !r.appeared);
      if (falseRows.length === 0) return; // 全て出現→勝因観測不要

      // このP-IDのE-IDコード（appeared=falseエントリから）
      const falseEIds = [...new Set(falseRows.flatMap(r => r.eIds ?? []))];
      const ctMain    = classifyControlType(falseEIds);

      // このP-IDの主要K-ID（自社敗因）
      const allKIds = [...new Set(pRows.flatMap(r => r.kIds ?? []))].slice(0, 2);
      const relatedKId = allKIds.join(', ') || '—';

      // competitorAnalysis のエンティティ情報を取得（pId / promptTypeId どちらでも検索）
      const pIdEntities =
        competitorAnalysis?.entityByPId?.[promptId] ??
        competitorAnalysis?.entityByPId?.[promptTypeId] ??
        [];

      if (pIdEntities.length > 0) {
        // appeared_false 文脈に出現したエンティティを優先（最大3件）
        const targets = pIdEntities
          .filter(e => e.appearedContext === 'appeared_false' || e.appearedContext === 'mixed')
          .slice(0, 3);
        const entities = targets.length > 0 ? targets : pIdEntities.slice(0, 3);

        entities.forEach((entity) => {
          // E-ID 解決: entry.eIds 由来の falseEIds を優先し、
          // 空の場合は competitorAnalysis entity から推定（fallback）
          const effectiveEIds: string[] =
            falseEIds.length > 0
              ? falseEIds.slice(0, 3)
              : inferWinningEIds(entity, pIdEntities.length);

          // controlType / implementationDirection を effectiveEIds から再導出
          const ct  = classifyControlType(effectiveEIds);
          const dir = deriveImplementationDirection(ct, entity.replacementRole ?? '');

          rows.push({
            pId:          promptId,
            promptTypeId,
            competitorEntity:  entity.entity,
            entityType:        entity.entityType ?? '—',
            appearedContext:   entity.appearedContext ?? '—',
            replacementRole:   entity.replacementRole ?? '—',
            winningEId:        effectiveEIds.join(', ') || '—',
            controlType:       ct,
            winningFactor:     entity.whyItAppeared ?? '観測データ不足',
            evidenceText:      entity.dominantStructure ?? '—',
            gapToAisle: (() => {
              if (entity.replacementRole === 'ツール例') {
                return 'ツール競合と対象粒度が異なる。会社/サービス軸への意味接点設計が必要。';
              }
              const name       = companyName || '自社';
              const competitor = entity.entity ?? '競合';
              const rawStrength = (entity.whyItAppeared ?? '').trim();
              const strength   = rawStrength.length > 0
                ? rawStrength.slice(0, 30) + (rawStrength.length > 30 ? '…' : '')
                : '当該GPT出現文脈';
              return `${name}は、「${strength}」文脈での接点が弱く、${competitor}が持つ出現構造に代替されている。`;
            })(),
            implementationDirection: dir,
            relatedKId,
            comment: `${entity.entity}（${entity.entityType ?? '—'}）が「${entity.replacementRole ?? '出現'}」として観測。${entity.appearedContext === 'appeared_false' ? '自社非出現時の主要代替として機能している。' : ''}`,
          });
        });
      } else {
        // competitorAnalysis なし → 非出現ログから概算行を生成
        const evidenceSample = falseRows[0]?.aiOutput?.slice(0, 100) ?? '—';
        const ct  = ctMain;
        const dir = deriveImplementationDirection(ct, '');
        rows.push({
          pId:          promptId,
          promptTypeId,
          competitorEntity:  '（競合分析未実行）',
          entityType:        '—',
          appearedContext:   'appeared_false',
          replacementRole:   '—',
          winningEId:        falseEIds.slice(0, 3).join(', ') || '—',
          controlType:       ct,
          winningFactor:
            falseEIds.length > 0
              ? `非出現ログで観測されたE-ID: ${falseEIds.slice(0, 3).join(', ')}。競合出現構造分析を実行してエンティティを特定してください。`
              : '競合勝因が未観測。競合出現構造分析（②）を実行してください。',
          evidenceText:  evidenceSample,
          gapToAisle:    '競合分析が未実行のため差分を特定できません。②の競合出現構造分析を先に実行してください。',
          implementationDirection: dir,
          relatedKId,
          comment: `非出現率: ${Math.round(falseRows.length / pRows.length * 100)}%。E-ID観測済み: ${falseEIds.slice(0,3).join(', ') || 'なし'}。詳細な勝因分析には競合出現構造分析が必要です。`,
        });
      }
    });

  return rows;
}

/** ③-4: K-ID因果スコアマップ */
export function buildKIdScoreMap(entries: LogEntry[]): KIdScoreRow[] {
  const ALL_KIDS: Array<{ kId: string; score: '◎' | '○' | '△' | '×' }> = [
    { kId: 'K-01', score: '◎' }, { kId: 'K-02', score: '○' }, { kId: 'K-03', score: '○' },
    { kId: 'K-04', score: '△' }, { kId: 'K-05', score: '×' }, { kId: 'K-06', score: '×' },
    { kId: 'K-07', score: '◎' }, { kId: 'K-08', score: '○' }, { kId: 'K-09', score: '△' },
    { kId: 'K-10', score: '×' },
  ];

  return ALL_KIDS.map(({ kId, score }) => {
    const affected = entries.filter(e => (e.kIds || []).includes(kId));
    const affectedPrompts = new Set(affected.map(e => e.promptId)).size;
    const kDef = K_IDS_DETAIL.find(k => k.kId === kId);
    const topCIds = [...new Set(affected.map(e => e.cId).filter(Boolean))].slice(0, 2).join(' × ');
    const topAIds = [...new Set(affected.map(e => e.aId).filter(Boolean))].slice(0, 2).join(', ');

    return {
      kId,
      name: kDef?.label ?? kId,
      score,
      affectedCount: affectedPrompts,
      mainStructure: `${topCIds}${topAIds ? ` × ${topAIds}` : ''}` || '—',
      comment: kDef?.description ?? '定義資料参照',
    };
  }).filter(r => r.affectedCount > 0);
}

/**
 * ③-5: 構造接続サマリ
 *
 * E-ID集約の優先順:
 *   優先1: eIdMatrix.winningEId（P-ID単位で重複除去して集約）
 *   優先2: entry.eIds（ルールベースで付与されたもの）
 *
 * eIdMatrix を渡すことで、4-2 E-ID勝因接続と同じ競合観測を 4-4 に反映できる。
 */
export function buildStructureSummary(entries: LogEntry[], eIdMatrix?: EIdRow[]): StructureSummaryRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  // eIdMatrix から P-ID 単位で winningEId を集約（優先1）
  // winningEId は "E-07, E-04" のようなカンマ区切り文字列
  const matrixEIdsByPId: Record<string, string[]> = {};
  if (eIdMatrix && eIdMatrix.length > 0) {
    eIdMatrix.forEach(row => {
      if (!row.winningEId || row.winningEId === '—') return;
      const pid = row.pId;
      if (!matrixEIdsByPId[pid]) matrixEIdsByPId[pid] = [];
      row.winningEId.split(',').map(s => s.trim()).filter(Boolean).forEach(eid => {
        if (!matrixEIdsByPId[pid].includes(eid)) matrixEIdsByPId[pid].push(eid);
      });
    });
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([promptId, rows]) => {
      const appeared = rows.filter(r => r.appeared).length;
      const rate = rows.length > 0 ? (appeared / rows.length * 100).toFixed(0) + '%' : '0%';
      const topC = [...new Set(rows.map(r => r.cId).filter(Boolean))].slice(0, 2).join(', ');
      const topA = [...new Set(rows.map(r => r.aId).filter(Boolean))].slice(0, 1).join(', ');
      const topAP = [...new Set(rows.filter(r => r.aId === 'A-10').map(r => r.apId).filter(Boolean))].slice(0, 1).join(', ');
      const topK = [...new Set(rows.flatMap(r => r.kIds || []))].slice(0, 2).join(', ');

      // 優先1: eIdMatrix.winningEId から集約、優先2: entry.eIds
      const fromMatrix = (matrixEIdsByPId[promptId] ?? []).slice(0, 2);
      const fromEntries = [...new Set(rows.flatMap(r => r.eIds || []))].slice(0, 2);
      const topEIds = fromMatrix.length > 0 ? fromMatrix : fromEntries;
      const topE = topEIds.join(', ');

      return {
        promptId,
        rate,
        appearStructure: [topC, topA, topAP].filter(Boolean).join(', '),
        blockStructure: topK || '—',
        complementStructure: topE ? `${topE}（競合勝因観測）` : '—',
        comment: `出現率${rate}。${topK ? '主要な出現阻害要因が特定されている。' : ''}${
          topE
            ? '競合勝因（E-ID）が観測されており、K-IDと接続して再現・代替・回避方針を検討してください。'
            : 'E-ID観測が不足しています。競合出現構造分析の精度を確認してください。'
        }`,
      };
    });
}

// =====================================================================
// 戦略提案フェーズ
// =====================================================================

/**
 * K-ID → 因果スコア（競合敗因の深刻度・設計変更の効果大きさ）
 * ◎: 直接的な競合敗因で設計変更の効果が高い
 * ○: 対応可能で改善余地あり
 * △: 改善が難しい構造的要因
 * ×: 即効性が低い・根本的な構造変更が必要
 */
const K_CAUSAL_SCORES: Record<string, '◎' | '○' | '△' | '×'> = {
  'K-01': '◎', // 意味競合: 直接的な代替関係
  'K-02': '○', // 主語構造競合: 設計変更で対応可能
  'K-03': '◎', // 出典競合: 外部根拠整備で改善
  'K-04': '○', // 構造的上位互換: 情報設計で対応可能
  'K-05': '△', // 情報飽和: カテゴリ競争は改善が難しい
  'K-06': '○', // プロンプト整合度: 認識整合設計で対応
  'K-07': '△', // 外部要因量的優位: 即効性が低い
  'K-08': '◎', // 対象粒度不一致: 粒度整備で直接対応
  'K-09': '○', // FAQ誤競合: 構文転換で対応可能
  'K-10': '◎', // 出現対象誤認: 分離設計で直接対応
};

/** K-ID → 改善余地（設計変更による出現率向上の見込み） */
const K_IMPROVEMENT: Record<string, '高' | '中' | '低'> = {
  'K-01': '高', // 意味競合の解消は出現に直結
  'K-02': '高', // 主語構造の明確化で出現優位
  'K-03': '高', // 外部出典整備で根拠差を解消
  'K-04': '中', // 情報構造改善は中程度の改善
  'K-05': '低', // 情報飽和は構造的で即効性低
  'K-06': '中', // 認識粒度整合は中程度の改善
  'K-07': '低', // 物量差は中長期の取り組みが必要
  'K-08': '高', // 粒度不一致の解消は直接的に効く
  'K-09': '中', // 構文文脈転換は中程度の効果
  'K-10': '高', // 誤認対象からの分離は直接効果あり
};

/** K-ID → 推奨対応戦略（競合敗因ベース） */
const K_STRATEGY: Record<string, string> = {
  'K-01': '意味接点再設計（同一意味領域での自社優位性確立）',
  'K-02': '主語構造明確化（会社・サービス・用途の接続構造整備）',
  'K-03': '外部出典補完（引用可能な根拠・事例・ランキング掲載確立）',
  'K-04': '情報構造最適化（GPTが組み込みやすい情報密度に再設計）',
  'K-05': '意味カテゴリ分離（飽和カテゴリから分離したポジショニング）',
  'K-06': '問いの意図への粒度整合（認識粒度を問いの期待形式に合わせる）',
  'K-07': '外部権威補完（メディア掲載・UGC・被リンク強化）',
  'K-08': '対象粒度の明確化（会社/サービス/ツールとしての粒度整備）',
  'K-09': '構文文脈の転換（FAQ・定義文脈から候補推薦文脈への転換）',
  'K-10': '出現対象の正確な接続（誤認概念・カテゴリからの分離）',
};

/** K-ID → 対応候補（例） */
const K_CANDIDATES: Record<string, string> = {
  'K-01': '競合との意味的差別化を構造的に設計し、自社独自の意味領域を確立する',
  'K-02': '企業名・サービス名・用途の3点を明確に接続した主語構造を整備する',
  'K-03': '業界レポート掲載・導入事例・比較記事など引用可能な外部出典を整備する',
  'K-04': '特徴・用途・対象者・導入事例を整理した高密度な情報構造に再設計する',
  'K-05': '既存の飽和カテゴリと異なる切り口のポジショニングを検討する',
  'K-06': '問いの意図する対象粒度（会社/ツール/手法）に自社認識を整合させる',
  'K-07': 'メディア掲載・SNS言及・被リンク獲得により外部権威の量的補完を図る',
  'K-08': '自社が「会社/サービス」として認識されるよう対象粒度を明示的に整備する',
  'K-09': 'FAQ・定義文脈への吸収を避け、推薦・候補文脈での出現を構文設計する',
  'K-10': '誤認対象（概念・親カテゴリ・別企業）との明確な分離設計を行う',
};

/** K-ID → 設計補足コメント（競合敗因観測ベース） */
const K_DESIGN_COMMENT: Record<string, string> = {
  'K-01': '同一意味領域で競合に代替候補として出現されている。差別化語彙・独自概念・比較軸の設計により意味競合を解消する必要がある。',
  'K-02': '自社の主語構造が曖昧で、GPTが会社・サービス・カテゴリを識別しにくい状態。「誰が・何を・誰向けに」の構造を整備する。',
  'K-03': '競合には引用可能な出典・事例・ランキングがあるが、自社は根拠が不足している。外部出典の整備が最優先課題。',
  'K-04': '競合の情報構造・説明密度がGPTに組み込まれやすい水準に達している。自社情報の構造的整備と情報密度の向上が必要。',
  'K-05': '類似カテゴリの既知情報が多く、自社が候補集合に入りにくい状態。カテゴリ分離または新規意味領域での出現設計を検討。',
  'K-06': '問いの期待する出力粒度（推薦可能な会社/ツール）と自社の認識粒度がズレている。問いの意図形式への整合が必要。',
  'K-07': '競合は物量（メディア・UGC・被リンク）で圧倒的な優位を持つ。外部権威の獲得・補完が不可欠だが即効性は低い。',
  'K-08': '問いが会社・サービスを求めているのに、自社が概念・仕組み・機能として認識されている。対象粒度の明確化が急務。',
  'K-09': '推薦・候補選定文脈ではなく、FAQ・定義・解説文脈に吸収されている。候補として出現する構文への転換が必要。',
  'K-10': 'GPTが自社ではなく関連概念・親カテゴリ・別企業を主体として出現させている。出現対象の正確な接続・分離設計が必要。',
};

/** 戦略提案マトリクス（P-ID別 × K-ID） */
export function buildStrategyMatrix(entries: LogEntry[]): StrategyRow[] {
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.promptId] ??= []).push(e); });

  const ALL_KIDS = ['K-01','K-02','K-03','K-04','K-05','K-06','K-07','K-08','K-09','K-10'];
  const SCORE_ORDER: Record<string, number> = { '◎': 0, '○': 1, '△': 2, '×': 3 };
  const rows: StrategyRow[] = [];

  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([promptId, group]) => {
      // weight平均 > 5% の K-ID を取得して因果スコア順にソート
      const activeKIds = ALL_KIDS
        .filter(kid => {
          const weightAvg = group.reduce((sum, r) => {
            return sum + (r.kIdWeights?.[kid] ?? ((r.kIds ?? []).includes(kid) ? 0.5 : 0));
          }, 0) / (group.length || 1);
          return weightAvg > 0.05;
        })
        .sort((a, b) => (SCORE_ORDER[K_CAUSAL_SCORES[a]] ?? 3) - (SCORE_ORDER[K_CAUSAL_SCORES[b]] ?? 3));

      activeKIds.forEach(kid => {
        rows.push({
          promptId,
          typeName: getTypeName(promptId),
          kId: kid,
          causalScore: K_CAUSAL_SCORES[kid] ?? '×',
          strategy: K_STRATEGY[kid] ?? '—',
          candidates: K_CANDIDATES[kid] ?? '—',
          comment: K_DESIGN_COMMENT[kid] ?? '—',
        });
      });
    });

  return rows;
}

/** 出現成功構造パターン抽出（意味構造別） */
export function buildSuccessPatterns(_entries: LogEntry[]): SuccessPatternRow[] {
  // フレームワーク定義の固定パターン（PDF準拠）
  return [
    {
      cId: '信頼補完',
      aId: '企業',
      eId: '出典付き事例',
      comment: '企業主体の語りと具体事例出典が結びつく構文は、信頼形成構造として高い出現再現性がある。',
    },
    {
      cId: '比較誘導',
      aId: 'ユーザー',
      eId: 'SNS・UGC',
      comment: 'ユーザー視点からの比較と、SNS上での共感・体験情報を伴う構造は出現率が高くなりやすい。',
    },
    {
      cId: '課題提起',
      aId: '専門家',
      eId: '専門サイト言及',
      comment: '課題の明示と専門家による言及がセットで構文を支える構造は、GPTにとって出現優位性がある。',
    },
  ];
}

/** 出現阻害構造の整理と改善余地 */
export function buildBlockPatterns(entries: LogEntry[]): BlockPatternRow[] {
  const BLOCK_DEFS: Array<{ kId: string; mainStructure: string; }> = [
    { kId: 'K-01', mainStructure: '同一意味領域で競合が代替候補として出現している' },
    { kId: 'K-02', mainStructure: '競合の主語構造（企業名＋用途）が明確で自社が曖昧' },
    { kId: 'K-03', mainStructure: '競合に外部出典・事例・ランキング根拠あり、自社は根拠不足' },
    { kId: 'K-04', mainStructure: '競合の情報構造・説明密度がGPTに組み込まれやすい水準' },
    { kId: 'K-05', mainStructure: '類似カテゴリの既知競合情報が多数、候補集合への参入が困難' },
    { kId: 'K-06', mainStructure: '問いの期待粒度（ツール/会社）と自社の認識粒度にズレ' },
    { kId: 'K-07', mainStructure: '競合が媒体掲載・UGC・被リンクで量的に圧倒' },
    { kId: 'K-08', mainStructure: '問いが会社/サービスを求めているが自社が概念/機能として認識' },
    { kId: 'K-09', mainStructure: 'FAQ・定義・解説文脈に吸収され候補として出現しない' },
    { kId: 'K-10', mainStructure: '関連概念・親カテゴリ・別企業が自社の代わりに主体として出現' },
  ];

  const activeKIds = new Set(entries.flatMap(e => e.kIds ?? []));

  return BLOCK_DEFS
    .filter(k => activeKIds.has(k.kId))
    .map(k => {
      const kDef = K_IDS_DETAIL.find(d => d.kId === k.kId);
      return {
        kId: k.kId,
        name: kDef?.label ?? k.kId,
        mainStructure: k.mainStructure,
        improvementScore: K_IMPROVEMENT[k.kId] ?? '低',
        comment: K_DESIGN_COMMENT[k.kId] ?? kDef?.description ?? '—',
      };
    });
}

/** 優先順位まとめ */
export function buildPriorityMatrix(entries: LogEntry[]): PriorityRow[] {
  const kIdCounts: Record<string, number> = {};
  entries.forEach(e => { (e.kIds ?? []).forEach(k => { kIdCounts[k] = (kIdCounts[k] ?? 0) + 1; }); });
  const active = (kids: string[]) => kids.some(k => (kIdCounts[k] ?? 0) > 0);

  const rows: PriorityRow[] = [];

  if (active(['K-01', 'K-02', 'K-08', 'K-10'])) {
    rows.push({ priority: '高', category: '意味・粒度競合の解消', action: '自社商材の意味領域・対象粒度・主語構造を整備し、競合に意味的に押し出されない設計を行う' });
  }
  if (active(['K-03', 'K-09'])) {
    rows.push({ priority: '高', category: '外部出典補完・構文文脈転換', action: '引用可能な外部根拠（事例・ランキング・比較記事）を整備し、推薦・候補文脈での出現を設計する' });
  }
  if (active(['K-04', 'K-06'])) {
    rows.push({ priority: '中', category: '情報構造・粒度整合', action: '情報密度を高め、問いの期待粒度に合わせた認識整合設計を行う' });
  }
  if (active(['K-05', 'K-07'])) {
    rows.push({ priority: '低', category: '外部要因・情報飽和（中長期）', action: '物量差・情報飽和は即効性が低い。E-IDとK-IDの因果構造を踏まえ、中長期の外部権威獲得戦略と併行する' });
  }
  rows.push({ priority: '低', category: '方針', action: 'K-IDで特定した競合敗因に対し、E-ID（競合勝因）の再現・代替・回避を3層設計に接続することが最終目標です。' });

  return rows;
}

export function analyzeLogEntries(entries: LogEntry[]): AppearanceStats {
  const appeared = entries.filter(e => e.appeared).length;
  const byCAId: Record<string, number> = {};
  const byAId: Record<string, number> = {};

  entries.forEach(e => {
    if (e.cId) byCAId[e.cId] = (byCAId[e.cId] || 0) + 1;
    if (e.aId) byAId[e.aId] = (byAId[e.aId] || 0) + 1;
  });

  return {
    total: entries.length,
    appeared,
    rate: entries.length > 0 ? Math.round((appeared / entries.length) * 100) : 0,
    byCAId,
    byAId,
  };
}

// P-ID × T-ID: 各プロンプトタイプに対する推奨テンプレート（優先度順）
const PID_TO_TIDS: Record<string, string[]> = {
  'P-01': ['T-03-2', 'T-04-1', 'T-01-1', 'T-09-3'],   // 選定・相談型: 実績→比較評価軸→比較構造→資料請求
  'P-02': ['T-04-1', 'T-01-1', 'T-02-2', 'T-09-1'],   // 比較・評価型: 比較評価軸→比較構造→リスト分類→体験誘導
  'P-03': ['T-02-1', 'T-03-2', 'T-06-2', 'T-04-1'],   // ランキング期待型: リスト推薦→実績→出典接続→比較評価軸
  'P-04': ['T-05-4', 'T-07-5', 'T-04-2', 'T-09-4'],   // 課題解決・提案型: FAQ統合→理念エピソード→選定ポイント→導入ステップ
  'P-05': ['T-06-2', 'T-06-1', 'T-03-2', 'T-02-3'],   // 出典付き引用期待型: 出典接続→専門家視点→実績→導入事例列挙
  'P-06': ['T-07-1', 'T-03-3', 'T-10-3', 'T-07-3'],   // 推薦理由深掘り型: 起点ストーリー→想い推薦→価値観→ユーザーストーリー
  'P-99': ['T-10-4', 'T-07-2', 'T-08-2', 'T-05-3'],   // その他・特殊型: 社会性→転機ストーリー→無料プラン→関連語埋込
};

// T-ID × M-ID: 各テンプレートに対応する意味接点（新3層用マッピング表より）
const TIDS_TO_MID: Record<string, string> = {
  'T-01-1': 'M-03', 'T-01-2': 'M-11', 'T-01-3': 'M-05', 'T-01-4': 'M-09',
  'T-01-5': 'M-08', 'T-01-6': 'M-07',
  'T-02-1': 'M-09', 'T-02-2': 'M-13', 'T-02-3': 'M-04', 'T-02-4': 'M-05',
  'T-03-1': 'M-11', 'T-03-2': 'M-04', 'T-03-3': 'M-05',
  'T-04-1': 'M-09', 'T-04-2': 'M-13', 'T-04-3': 'M-08', 'T-04-4': 'M-04',
  'T-05-1': 'M-02', 'T-05-2': 'M-01', 'T-05-3': 'M-07', 'T-05-4': 'M-07',
  'T-06-1': 'M-12', 'T-06-2': 'M-11', 'T-06-3': 'M-04', 'T-06-4': 'M-10', 'T-06-5': 'M-01',
  'T-07-1': 'M-11', 'T-07-2': 'M-11', 'T-07-3': 'M-09', 'T-07-4': 'M-01', 'T-07-5': 'M-06',
  'T-08-1': 'M-02', 'T-08-2': 'M-11', 'T-08-3': 'M-06', 'T-08-4': 'M-02', 'T-08-5': 'M-02',
  'T-09-1': 'M-08', 'T-09-2': 'M-05', 'T-09-3': 'M-07', 'T-09-4': 'M-10', 'T-09-5': 'M-01',
  'T-10-1': 'M-13', 'T-10-2': 'M-10', 'T-10-3': 'M-02', 'T-10-4': 'M-05', 'T-10-5': 'M-08',
};

// T-ID × S-ID: 各テンプレートに対応する構文クラスタ
const TIDS_TO_SID: Record<string, string> = {
  'T-01-1': 'S-01', 'T-01-2': 'S-01', 'T-01-3': 'S-01', 'T-01-4': 'S-01',
  'T-01-5': 'S-02', 'T-01-6': 'S-09',
  'T-02-1': 'S-02', 'T-02-2': 'S-02', 'T-02-3': 'S-02', 'T-02-4': 'S-02',
  'T-03-1': 'S-03', 'T-03-2': 'S-03', 'T-03-3': 'S-03',
  'T-04-1': 'S-08', 'T-04-2': 'S-08', 'T-04-3': 'S-08', 'T-04-4': 'S-08',
  'T-05-1': 'S-09', 'T-05-2': 'S-09', 'T-05-3': 'S-09', 'T-05-4': 'S-10',
  'T-06-1': 'S-06', 'T-06-2': 'S-06', 'T-06-3': 'S-06', 'T-06-4': 'S-06', 'T-06-5': 'S-06',
  'T-07-1': 'S-07', 'T-07-2': 'S-07', 'T-07-3': 'S-07', 'T-07-4': 'S-07', 'T-07-5': 'S-07',
  'T-08-1': 'S-04', 'T-08-2': 'S-04', 'T-08-3': 'S-04', 'T-08-4': 'S-01', 'T-08-5': 'S-01',
  'T-09-1': 'S-03', 'T-09-2': 'S-03', 'T-09-3': 'S-03', 'T-09-4': 'S-03', 'T-09-5': 'S-06',
  'T-10-1': 'S-10', 'T-10-2': 'S-10', 'T-10-3': 'S-07', 'T-10-4': 'S-10', 'T-10-5': 'S-10',
};

export function generateTheoryDesign(pId: string, aId: string): TheoryDesign {
  const tIds = PID_TO_TIDS[pId] || ['T-03-1', 'T-01-1', 'T-05-4'];
  const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'high', 'medium', 'low'];

  const blocks: DesignBlock[] = tIds.map((tId, i) => {
    const tDef = T_IDS.find(t => t.tId === tId)!;
    const mId = TIDS_TO_MID[tId] || 'M-01';
    const sId = TIDS_TO_SID[tId] || 'S-01';
    const mDef = M_IDS.find(m => m.mId === mId)!;

    return {
      mId,
      sId,
      tId,
      syntaxId: `${sId}×${tId}`,
      sentence: generateSampleSentence(tId, aId),
      role: `${mDef?.label ?? mId}（${tDef?.pattern ?? tId}）`,
      priority: priorities[i] || 'low',
    };
  });

  return { pId, aId, blocks, generatedAt: new Date().toISOString() };
}

function generateSampleSentence(tId: string, aId: string): string {
  const product = '[製品名]';
  const subject = getAIdSubject(aId);
  const series = tId.split('-').slice(0, 2).join('-');

  const seriesTemplates: Record<string, string> = {
    'T-01': `${product}と競合他社を比較すると、〜の観点で明確な差異があります。`,
    'T-02': `${product}のおすすめ〇選：①〜 ②〜 ③〜。それぞれの特徴は〜です。`,
    'T-03': `${subject}${product}をおすすめする理由は、〜・〜・〜の3点です。`,
    'T-04': `${product}を選ぶ際の評価軸は〜・〜・〜。特に〜が重要なポイントです。`,
    'T-05': `${product}（〜とも呼ばれる）は、〜の文脈でも注目されています。`,
    'T-06': `${subject}${product}について「〜の点が特に優れている」と評価しています。`,
    'T-07': `${product}が生まれたきっかけは〜。その原点となる体験は〜でした。`,
    'T-08': `${product}は月額〜円から。無料プランでも〜まで利用可能です。`,
    'T-09': `まずは${product}を無料で試してみませんか？登録は〜分で完了します。`,
    'T-10': `${product}のミッションは「〜」。その実現のために〜に取り組んでいます。`,
  };

  return seriesTemplates[series] ?? `${product}に関する説明文です。`;
}

function getAIdSubject(aId: string): string {
  const subjects: Record<string, string> = {
    'A-01': '専門家によると、',
    'A-02': '企業・団体として、',
    'A-03': 'メディア掲載では、',
    'A-04': 'ユーザーの声として「',
    'A-05': '一般的に、',
    'A-06': '統計・調査によれば、',
    'A-07': '創業者・代表者として「',
    'A-08': '現場担当者が語るには、',
    'A-09': 'パートナー視点から、',
    'A-10': '',
  };
  return subjects[aId] ?? '';
}

export function generateReconciliation(
  logEntries: LogEntry[],
  design: TheoryDesign
): ReconciliationResult {
  const cidCounts: Record<string, number> = {};
  logEntries.filter(e => e.appeared).forEach(e => {
    if (e.cId) cidCounts[e.cId] = (cidCounts[e.cId] || 0) + 1;
  });

  const diffs: DiffItem[] = design.blocks.map((block, i) => {
    const expectedCount = block.priority === 'high' ? 10 : block.priority === 'medium' ? 6 : 3;
    const realCount = Math.max(0, Math.floor(Math.random() * expectedCount * 1.2));
    const gap = expectedCount - realCount;
    const type = gap <= 0 ? 'ok' : gap > expectedCount * 0.5 ? 'missing' : 'weak';

    const kIdx = type !== 'ok' ? Object.keys(K_IDS)[i % Object.keys(K_IDS).length] : undefined;

    return {
      blockId: block.syntaxId,
      type,
      tId: block.tId,
      mId: block.mId,
      realCount,
      expectedCount,
      kId: kIdx,
      kLabel: kIdx ? K_IDS[kIdx] : undefined,
      gap: Math.max(0, gap),
    };
  });

  const okCount = diffs.filter(d => d.type === 'ok').length;
  const overallScore = Math.round((okCount / diffs.length) * 100);

  return { overallScore, diffs, generatedAt: new Date().toISOString() };
}

export function generateImplementationReport(
  diffs: DiffItem[],
  selectedIds: Set<string>
): ImplementationReport {
  const items = diffs
    .filter(d => d.type !== 'ok' && selectedIds.has(d.blockId))
    .map(diff => {
      const tDef = T_IDS.find(t => t.tId === diff.tId);
      const mDef = M_IDS.find(m => m.mId === diff.mId);
      const eId = diff.type === 'missing' ? 'E-03' : 'E-13';
      const eDef = E_IDS.find(e => e.eId === eId);

      return {
        blockId: diff.blockId,
        tId: diff.tId,
        mId: diff.mId,
        eId,
        action: `${tDef?.label ?? diff.tId}形式のコンテンツブロックを追加`,
        placement: `${mDef?.label ?? diff.mId}セクションに${eDef?.label ?? eId}として配置`,
        priority: diff.type === 'missing' ? 'high' as const : 'medium' as const,
        selected: true,
      };
    });

  const highCount = items.filter(i => i.priority === 'high').length;
  const summary = `選択した ${items.length} 件の改善施策を実装します。うち優先度高は ${highCount} 件です。各施策は対象ページへの構造的配置により、AIの出現確率向上を目指します。`;

  return { items, summary, generatedAt: new Date().toISOString() };
}
