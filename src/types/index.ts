export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6;

// ===================== 分析モード =====================

export type AnalysisMode =
  | 'non_appearance_analysis'       // 全エントリ appeared=false
  | 'partial_appearance_analysis'   // appeared=true / false 混在
  | 'success_observation'           // 全エントリ appeared=true（100%出現）
  | 'forced_mention_observation';   // 強制出現プロンプト（将来: Phase0フラグ対応）

// ===================== Phase 1 ログエントリ =====================

export interface LogEntry {
  id: string;
  // Phase ① 基本フィールド
  promptId: string;        // プロンプトID（例: P-01-01）行番号ベースの識別子
  promptTypeId?: string;   // 問いの型（例: P-03=ランキング期待型）AI分類による意味タイプ
  prompt: string;          // プロンプト文（旧フィールド名、後方互換）
  trialNo: number;        // 試行No
  appeared: boolean;      // 出現有無
  aiOutput: string;       // 出力本文
  outputReason: string;   // 出力理由
  sourceCategory: string; // 出典分類（7種）
  // Phase ② 構造付与フィールド
  cId: string;            // 意味クラスタ
  aId: string;            // 主語構造
  apId: string;           // 視点補完（A-10のみ）
  // Phase ③ 阻害・補完フィールド
  kIds: string[];                       // 出現阻害要因（最大3件）— weight >= threshold のもの
  kIdWeights?: Record<string, number>;  // K-ID強度マップ（0〜1）— weight平均%算出に使用
  kIdReasons?: Record<string, string>;  // K-ID選択理由（デバッグ・将来分析用、UIには非表示）
  eIds: string[];         // 外部補完要因（最大3件）
  // レガシーフィールド
  product?: string;
  timestamp?: string;
}

// ===================== 出典分類（7種） =====================

export const SOURCE_CATS = [
  '業界レポート／資料',
  'レビューサイト',
  '公式サイト',
  'Wikipedia／用語定義サイト',
  '一般知識',
  'その他',
  '出典不明',
] as const;
export type SourceCat = typeof SOURCE_CATS[number];

// ===================== フェーズ① 出力 =====================

export interface SourceMatrixRow {
  promptId: string;
  typeName: string;
  total: number;
  byCat: Record<SourceCat, number>;
  note: string;
}

export interface AppearanceRateRow {
  promptId: string;
  typeName: string;
  appearedCount: number;
  trialCount: number;
  rate: string;   // 例: "42.5%"
}

export interface OutputReasonRow {
  promptId: string;
  promptText: string;
  reasonSummary: string;
  reasonPatterns: string;
}

export interface OutputSummaryItem {
  label: string;
  content: string;
}

// ===================== フェーズ② 出力 =====================

export interface IdMatrixRow {
  promptId: string;
  total: number;
  counts: Record<string, number>;
}

// ===================== フェーズ③ 出力 =====================

export interface KIdMatrixRow {
  promptId: string;
  total: number;
  rates: Record<string, string>;  // K-01 → "35%"
  comment: string;
}

/** E-ID勝因接続マトリクス行（P-ID × 競合エンティティ × 勝因E-ID） */
export interface EIdRow {
  // 識別
  pId: string;
  promptTypeId: string;
  // 競合エンティティ情報（competitorAnalysis があれば詳細、なければ概算）
  competitorEntity: string;            // エンティティ名
  entityType: string;                  // company | service | tool | media | concept | '—'
  appearedContext: string;             // appeared_false | appeared_true | mixed | '—'
  replacementRole: string;             // 代替候補 | 比較対象 | 一般例 | 権威参照 | ツール例 | '—'
  // 勝因分析
  winningEId: string;                  // E-ID（複数はカンマ区切り）
  controlType: 'E-A' | 'E-B' | 'mixed' | '—';  // E-A: 真正外部勝因 / E-B: 設計可能勝因 / mixed: 混在
  winningFactor: string;               // 競合がなぜ出現したか
  evidenceText: string;                // 根拠テキスト（出力例の抜粋）
  gapToAisle: string;                  // Aisleとの差分
  implementationDirection: '再現' | '代替' | '回避' | '—';  // 実装方針
  relatedKId: string;                  // 関連する自社敗因K-ID
  comment: string;
}

export interface KIdScoreRow {
  kId: string;
  name: string;
  score: '◎' | '○' | '△' | '×';
  affectedCount: number;
  mainStructure: string;
  comment: string;
}

export interface StructureSummaryRow {
  promptId: string;
  promptTypeId?: string;   // 問いの型（P-01〜P-06）
  rate: string;
  appearStructure: string;
  blockStructure: string;
  complementStructure: string;
  comment: string;
}

// ===================== フェーズ① 統合結果 =====================

export interface Phase1SubResult {
  sourceMatrix: SourceMatrixRow[];
  appearanceRates: AppearanceRateRow[];
  outputReasons: OutputReasonRow[];
  summary: OutputSummaryItem[];
  analyzedAt: string;
}

// ===================== フェーズ② 統合結果 =====================

export interface Phase2SubResult {
  cIdMatrix: IdMatrixRow[];
  aIdMatrix: IdMatrixRow[];
  apIdMatrix: IdMatrixRow[];
  analyzedAt: string;
}

// ===================== フェーズ③ 統合結果 =====================

export interface Phase3SubResult {
  kIdMatrix: KIdMatrixRow[];
  eIdMatrix: EIdRow[];
  kIdScoreMap: KIdScoreRow[];
  structureSummary: StructureSummaryRow[];
  analyzedAt: string;
}

// ===================== 戦略提案フェーズ =====================

export interface SuccessPatternRow {
  cId: string;
  aId: string;
  eId: string;
  comment: string;
}

export interface BlockPatternRow {
  kId: string;
  name: string;
  mainStructure: string;
  improvementScore: '高' | '中' | '低';
  comment: string;
}

export interface StrategyRow {
  promptId: string;
  typeName: string;
  kId: string;
  causalScore: '◎' | '○' | '△' | '×';
  strategy: string;
  candidates: string;
  comment: string;
}

export interface PriorityRow {
  priority: '高' | '中' | '低';
  category: string;
  action: string;
}

export interface StrategySubResult {
  successPatterns: SuccessPatternRow[];
  blockPatterns: BlockPatternRow[];
  strategyMatrix: StrategyRow[];
  priorityMatrix: PriorityRow[];
  analyzedAt: string;
}

// ===================== Phase 1 全体結果 =====================

export interface Phase1Result {
  sub1: Phase1SubResult;
  sub2: Phase2SubResult;
  sub3: Phase3SubResult;
  strategy: StrategySubResult;
}

// ===================== Phase 2 (3層) 出現設計 =====================

export interface MIdMappingRow {
  mId: string;
  name: string;
  semanticRole: string;      // このP-IDにおける意味役割
  designNecessity: string;   // 該当構文の設計必要性
}

export interface PortfolioRow {
  sbId: string;
  mId: string;
  mName: string;
  syntaxIntent: string;      // 構文意図（役割コメント）
  tId: string;
  templateName: string;
  aId: string;
  agentStructure: string;    // 主語構造
  note: string;
  // ── 意味接点主役フィールド（追加）──────────────────────────
  adoptionReason?: string;    // このM-IDを採用した理由
  kIdCorrection?: string;     // K-ID補正がある場合の説明（なければ「なし」）
  implementationMemo?: string; // T-ID/A-IDを含む実装上のメモ
}

export interface AfterBunRow {
  sbId: string;
  mId: string;
  mName: string;
  syntaxIntent: string;
  tId: string;
  templateName: string;
  aId: string;
  agentStructure: string;
  afterText: string;         // After構文草案
  note: string;
}

export interface ConnectionOrderRow {
  order: number;
  sbId: string;
  mId: string;
  afterText: string;
  comment: string;
}

// ── 設計妥当性検証 ────────────────────────────────────────────────────

type ValidationIssueType =
  | 'missing_required_mid'
  | 'kid_correction_missing'
  | 'pid_order_conflict';

export interface ValidationIssue {
  type: ValidationIssueType;
  mId?: string;
  kId?: string;
  reason: string;
}

export interface ValidationResult {
  status: 'ok' | 'warning';
  criticalIssue: boolean;
  issues: ValidationIssue[];
}

export interface EIdComplementRow {
  sbId: string;
  mId: string;
  // ── 新フィールド（勝因接続思想） ───────────────────────────────────────
  kId?: string;               // K-ID（阻害要因）
  winningEId?: string;        // 勝因E-ID（競合・出現構文の外部的勝因）
  winningFactor?: string;     // 勝因要素（競合が持っていた外部構造の説明）
  gapToAisle?: string;        // Aisle側との差分
  reproducibility?: string;   // 再現性: 高 | 中 | 低
  requiredAction?: string;    // 実装方針（再現・代替・回避）
  // ── 旧フィールド（後方互換）── ────────────────────────────────────────
  kIdMatch?: string;          // 旧: K-ID該当
  requiredEId?: string;       // 旧: 必要EID
  resourceExample?: string;   // 旧: 補完資源例
  comment: string;
}

export interface AppearanceEvalRow {
  sbId: string;
  mId: string;
  tId: string;
  aId: string;
  // ── 新フィールド（出現到達性 × 阻害要因 × 改善レバー） ─────────────
  reachability: string;      // 出現到達性: ◎/○/△/×
  mainKId: string;           // 主阻害要因: K-ID（最重要1つ）
  improvementLever: string;  // 改善レバー: 最優先改善施策（自然文）
  // ── 維持フィールド ───────────────────────────────────────────────
  semanticFit: string;       // 意味的適合度: ◎/○/△
  connectionFit: string;     // 接続整合性: ◎/○/△
  comment: string;
  // ── 旧フィールド（後方互換） ─────────────────────────────────────
  probability?: string;      // 旧: 出現見込み 高/中/低
  complementNeed?: string;   // 旧: 補完必要性
}

export interface AppearanceSummary {
  overallImpression: string;
  keyBun: string;
  complementNeeds: string;
  implementationProposal: string;
}

// ===================== Architecture Foundation v1.0 =====================
// Sprint 1 / 1.5 で追加。既存フィールドへの変更なし。

// ── Registry Metadata（Sprint 1.5 追加）────────────────────────────────────

/** Registry オブジェクトの運用ステータス */
export type RegistryStatus = 'ACTIVE' | 'DEPRECATED' | 'DRAFT';

/**
 * すべての Registry が持つ共通ヘッダ。
 * version / status で将来の切り替え・廃止を機械的に管理できる。
 * items[] に各 Registry の実データを格納する。
 */
export interface RegistryEnvelope<T> {
  registryId: string;     // 例: "coverageTypes"
  version: string;        // セマンティックバージョン（例: "1.0"）
  status: RegistryStatus; // ACTIVE / DEPRECATED / DRAFT
  description: string;    // このRegistryが何を管理するかの説明
  owner: string;          // 管理責任者 / チーム（例: "Aisle Studio Architecture"）
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  items: T[];             // Registry の実データ配列
}

// ── Coverage Model ────────────────────────────────────────────────────────

/** Evidence がカバーする知識の軸（5軸）。件数ではなく軸で Coverage を管理する。 */
export type CoverageType =
  | 'Identity'        // そのEntityが何者か
  | 'Capability'      // 何ができるか・何を提供するか
  | 'Differentiation' // 他との違い・独自性・強み
  | 'Credibility'     // 信頼できる根拠・実績・第三者評価
  | 'UseCase';        // 誰がどう使うか・どんな課題を解くか

export interface CoverageResult {
  ok: boolean;
  coveredTypes: CoverageType[];
  missingTypes: CoverageType[];
  coverageScore: number; // 0〜1（coveredTypes.length / requiredCoverage.length）
}

// ── Source Class ─────────────────────────────────────────────────────────

/** Evidence の用途分類（AIが何のために使うか）。Evidence Architecture v2.0 で定義。 */
export type SourceClass =
  | 'Specification'  // 仕様・動作定義
  | 'Announcement'   // 発表・表明
  | 'Documentation'  // 説明・解説
  | 'Research'       // 研究・調査
  | 'Presentation'   // 発表・講演
  | 'CaseStudy'      // 事例
  | 'Benchmark'      // 比較・計測
  | 'Profile'        // 自己紹介・概要
  | 'Interview'      // 発言・インタビュー
  | 'Financial';     // 財務・事業情報

// ── Response Schema ───────────────────────────────────────────────────────

/** P-ID 別の回答セクション定義。Quality Audit（L6）の検証基準になる。 */
export interface ResponseSchemaSection {
  sectionId: string;   // セクション識別子（例: "summary"）
  label: string;       // 表示名
  required: boolean;   // true = L6 が存在確認する
}

export interface ResponseSchema {
  promptTypeId: string;              // P-01 〜 P-06
  sections: ResponseSchemaSection[];
  citationRequired: boolean;         // true = citation[] が必須（L6 が確認）
}

// ── Question Template ─────────────────────────────────────────────────────

/** P-ID ごとの問いの型。Entity非依存。DP-001（Unknown Entity Test）を満たす設計。 */
export interface QuestionTemplate {
  templateId: string;                // 例: "QT-P01-001"
  promptTypeId: string;              // P-01 〜 P-06
  status: RegistryStatus;            // ACTIVE / DEPRECATED / DRAFT（Sprint 1.5 追加）
  templateText: string;              // プレースホルダ入り問い文（例: "{entityName}とは何ですか？"）
  requiredCoverage: CoverageType[];  // QuestionInstance 生成前に必須の Coverage 軸
  optionalCoverage: CoverageType[];  // あれば回答品質が上がる Coverage 軸
  responseSchema: ResponseSchema;    // 生成回答の構造定義
  createdAt: string;
}

// ── Question Instance ─────────────────────────────────────────────────────

/** QuestionTemplate に Entity を適用して生成した個別の問い。KV 書き込みは Sprint 3。 */
export interface QuestionInstance {
  instanceId: string;     // 例: "QIN-aisle-P01-001"
  templateId: string;     // 生成元 QuestionTemplate の ID
  entityId: string;       // 適用した Entity の slug
  promptTypeId: string;   // P-01 〜 P-06
  resolvedText: string;   // プレースホルダを解決した実際の問い文
  createdAt: string;
}

// ===================== Evidence Layer =====================

export type EvidenceType =
  | 'case'         // 実績・事例
  | 'client'       // 顧客・取引先
  | 'feature'      // 特徴・機能・強み
  | 'metric'       // 数値実績
  | 'credential'   // 認定・受賞・資格
  | 'review'       // レビュー・評価・口コミ
  | 'media'        // メディア掲載
  | 'method'       // 独自手法・アプローチ
  | 'availability' // 提供条件・対応範囲
  | 'comparison'   // 比較・差別化
  | 'other';

export type EvidenceSourceType =
  | 'official_site' | 'note' | 'pdf' | 'media' | 'sns' | 'manual' | 'other';

export type EvidenceCandidateStatus = 'pending' | 'adopted' | 'rejected';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  entityRole: string;          // 必須: 「これは何の根拠か」を明示（例: "ゲーム映像実績"）
  value?: string;              // 数値・年度・量など
  tags: string[];
  sourceUrl?: string;
  sourceType?: EvidenceSourceType;
  confidence?: 'high' | 'medium' | 'low';
  // ── Architecture Foundation v1.0 追加フィールド（任意・後方互換）──────────
  evidenceId?: string;                  // "{entitySlug}-ev-{連番4桁}" 採番済み ID
  coverageType?: CoverageType[];        // この Evidence がカバーする Coverage 軸
  sourceClass?: SourceClass;            // 用途分類（Evidence Architecture v2.0）
  supportedPromptTypes?: string[];      // 寄与する P-ID 一覧（例: ["P-02","P-05"]）
  // ── Evidence Architecture v2.0 追加フィールド（任意・後方互換）────────────
  tier?: 'T1' | 'T2' | 'T3' | 'T4';   // Evidence Tier（所有者: T1=Entity管理）
  citationType?: string;                // 引用種別（fact / statement / methodology 等）
  evidenceStrength?: 'definitive' | 'strong' | 'moderate' | 'weak';
  needsVerification?: boolean;
  sourceVerified?: boolean;
  publicationDate?: string | null;
  lastVerifiedAt?: string | null;
}

export interface EvidenceResult {
  extractedAt: string;
  sourceDescription: string;
  items: EvidenceItem[];
}

export interface EvidenceCandidateItem extends EvidenceItem {
  status: EvidenceCandidateStatus;
  sourceLabel: string;         // 抽出元の表示名（"公式サイト" など）
}

export interface EvidenceCandidateResult {
  sourceUrls: string[];
  items: EvidenceCandidateItem[];
  lastUpdatedAt: string;
}

export interface EvidenceStore {
  candidates: EvidenceCandidateResult;
  adopted: EvidenceResult;
}

export interface EvaluationAxes {
  primaryAxes: string[];       // AIがこの問いに回答する際の評価軸（3〜5個）
  keyTerms: string[];          // 問いに含まれる検索語・関連語
  expectedAnswerFormat: string; // AIが返す回答の型
  pIdAlignment: string;        // 評価軸とP-IDの整合理由
  evidenceHints?: string[];    // Evidence Layer で探すべき根拠の種類
}

export interface Phase2PerPID {
  pId: string;              // ログ識別・SB-ID命名用（入力順: P-01-01 など）
  promptTypeId?: string;    // 問いの型（P-01〜P-06）: M-ID制約・型別分析に使用
  promptTypeLabel?: string; // 表示用ラベル（例: 比較・評価型）
  promptText: string;
  evaluationAxes?: EvaluationAxes; // 問い × 商材カテゴリから抽出した評価軸
  mIdMapping: MIdMappingRow[];
  portfolioIntro: {
    intentSummary: string;
    mIdOutputs: string;
  };
  portfolio: PortfolioRow[];
  afterBun: AfterBunRow[];
  connectionOrder: ConnectionOrderRow[];
  connectionComment: string;
  validationResult?: ValidationResult; // 設計妥当性検証結果
  eIdComplement: EIdComplementRow[];
  appearanceEval: AppearanceEvalRow[];
  appearanceSummary: AppearanceSummary;
  generatedAt: string;
}

export interface Phase2Result {
  companyName: string;
  productCategory: string;
  productDescription: string;
  perPID: Phase2PerPID[];
  generatedAt: string;
}

// ===================== Phase 3 (突合) =====================

export interface ReconcileDetailRow {
  pId: string;
  promptText: string;
  sbId: string;
  mId: string;                // M-ID（意味接点）
  afterText: string;          // After構文テキスト（照合対象）
  appeared: boolean;          // 出現有無（2層出現率50%以上=true）
  difficultyType: string;     // 出現困難要因分類：接続欠落 | 主語浮き | 意味競合 | 構文分断 | なし
  difficultyDetail: string;   // 困難要因の具体的説明
  reachabilityScore: string;  // 到達可能性スコア：高 | 中 | 低
  guideline: string;          // 補強・接続・再設計の指針
}

export interface ReconcileMatrixRow {
  sbId: string;
  mId: string;                  // M-ID
  reachabilityScore: string;    // 到達可能性スコア 高/中/低
  mainDifficultyType: string;   // 主要出現困難要因タイプ
  affectedPIds: string;         // 影響するP-ID（カンマ区切り）
  guideline: string;            // 補強・接続・再設計の指針
  priority: string;             // 優先度 高/中/低
}

export interface ReconcilePatternRow {
  difficultyType: string;  // 困難要因タイプ（接続欠落/主語浮き/意味競合/構文分断）
  description: string;     // タイプの説明
  count: number;           // 該当SB-ID数
  measures: string;        // 対応施策
}

export interface Phase3Result {
  companyName: string;
  productCategory: string;
  detailReport: ReconcileDetailRow[];
  matrixReport: ReconcileMatrixRow[];
  patternTable: ReconcilePatternRow[];
  overallSummary: string;
  generatedAt: string;
}

// ===================== Phase 4 (実装設計) =====================

export interface ImplementationPlanRow {
  sbId: string;
  priority: '高' | '中' | '低';
  action: string;           // 実装アクション
  targetPage: string;       // 配置先ページ
  eIdRequired: string;      // 必要なE-ID
  expectedEffect: string;   // 期待される効果
  connectionSyntax: string; // 連携推奨構文
}

export interface Phase4Result {
  companyName: string;
  productCategory: string;
  planRows: ImplementationPlanRow[];
  prioritySummary: string;
  generatedAt: string;
}

// ===================== 競合出現構造分析 =====================

export interface CompetitorEntityRow {
  rank: number;
  entity: string;
  count: number;
  pIds: string[];
  dominantStructure: string;
  // 新フィールド（競合文脈整合性対応）
  entityType?: 'company' | 'service' | 'tool' | 'media' | 'concept';
  appearedContext?: 'appeared_false' | 'appeared_true' | 'mixed';
  whyItAppeared?: string;
  replacementRole?: string;
  promptText?: string;     // entityByPId 行に付与（参照元プロンプト文）
  promptTypeId?: string;   // entityByPId 行に付与（P-01〜P-06）
}

export interface VocabPatternRow {
  patternType: string;
  example: string;
  count: number;
  kIdHint: string;
}

export interface CompetitorAnalysisResult {
  entityRanking: CompetitorEntityRow[];
  entityByPId: Record<string, CompetitorEntityRow[]>;
  vocabPatterns: VocabPatternRow[];
  summariesByPId: Record<string, string>;
  analyzedAt: string;
}

// ===================== 既存型（後方互換） =====================

export interface AppearanceStats {
  total: number;
  appeared: number;
  rate: number;
  byCAId: Record<string, number>;
  byAId: Record<string, number>;
}

export interface DesignBlock {
  mId: string;
  sId: string;
  tId: string;
  syntaxId: string;
  sentence: string;
  role: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TheoryDesign {
  pId: string;
  aId: string;
  blocks: DesignBlock[];
  generatedAt: string;
}

export interface DiffItem {
  blockId: string;
  type: 'missing' | 'weak' | 'ok';
  tId: string;
  mId: string;
  realCount: number;
  expectedCount: number;
  kId?: string;
  kLabel?: string;
  gap: number;
}

export interface ReconciliationResult {
  overallScore: number;
  diffs: DiffItem[];
  generatedAt: string;
}

export interface ImplementationItem {
  blockId: string;
  tId: string;
  mId: string;
  eId: string;
  action: string;
  placement: string;
  priority: 'high' | 'medium' | 'low';
  selected: boolean;
}

export interface ImplementationReport {
  items: ImplementationItem[];
  summary: string;
  generatedAt: string;
}

// ===================== Phase4 ページ生成結果 =====================

export interface EvidenceWarning {
  questionSlug: string;
  promptTypeId: string;
  missingTypes: string[];
  needsVerificationCount: number;
  insufficientTypes: string[];
  message: string;
}

export interface EvidenceSummary {
  totalEvidence: number;
  verifiedEvidence: number;
  needsVerificationEvidence: number;
}

/** 問い別出現ページ（Aisleページ）の生成結果 */
export interface AislePageResult {
  parentUrl: string;
  llmsTxtUrl: string;
  created: string[];
  skipped: string[];
  updated: string[];
  evidenceWarnings?: EvidenceWarning[];
  evidenceSummary?: EvidenceSummary;
}

/** 問い単位の公開ページインデックスエントリ */
export interface QuestionPageIndexEntry {
  questionSlug: string;       // "recommendation-001"（{promptTypeSlug}-{連番}）
  promptTypeId: string;       // "P-01"
  promptTypeSlug: string;     // "recommendation"
  promptText: string;         // 問いの全文
  sessionKey?: string;        // 生成元セッションキー
  generatedAt: string;        // ISO8601
}

/** 企業AIプロフィールページの生成結果 */
export interface GeneratedPage {
  slug: string;
  url: string;
  generatedAt: string;
  updatedAt?: string;
}

/** AI向け根拠補完リンク 1件 */
export interface ExternalUrlItem {
  type: string;
  url: string;
}

/** RefBase Entity の種別 */
export type EntityType =
  | 'company'
  | 'service'
  | 'product'
  | 'person'
  | 'organization'
  | 'concept'
  | 'other';

export interface AppState {
  currentPhase: PhaseId;
  logEntries: LogEntry[];
  stats: AppearanceStats | null;
  phase1Result: Phase1Result | null;
  phase2Result: Phase2Result | null;
  phase3Result: Phase3Result | null;
  phase4Result: Phase4Result | null;
  competitorAnalysis: CompetitorAnalysisResult | null;
  selectedPId: string;
  selectedAId: string;
  theoryDesign: TheoryDesign | null;
  reconciliation: ReconciliationResult | null;
  implementationReport: ImplementationReport | null;
  /** 既出現問いの扱い選択（promptId → 'reinforce' | 'skip'）。フェーズ遷移をまたいで保持 */
  appearedChoiceMap: Record<string, 'reinforce' | 'skip'>;
  /** 問い別出現ページ（Aisleページ）の最新生成結果 */
  aisleResult: AislePageResult | null;
  /** 企業AIプロフィールページの最新生成結果 */
  generatedPage: GeneratedPage | null;
  /** AI向け根拠補完リンク（企業AIプロフィールページ生成用） */
  externalUrls: ExternalUrlItem[];
  /** RefBase Entity の種別（デフォルト: 'company'） */
  entityType: EntityType;
}
