/**
 * Aisle Monitor 共有型定義 — M1
 *
 * api/_draft-types.ts と同じ方針：tsconfig.api.json が src/ を含まないため、
 * Monitor関連の型は api/ 配下にこのファイルとして集約する。
 *
 * 設計範囲についての注意:
 *   Schedule Config / Entity Config は MVP（M1）のコードスコープに含めない
 *   （PL-008の教訓：使われない型・ファイルを残さない）。
 *   設計としては Aisle Platform Specification / Monitor設計レビューに記載済みで、
 *   M2以降で必要になった時点でこのファイルに追加する。
 *
 * 因果断定の禁止（必須ガードレール）:
 *   Contact / Crawl Log / Appearance Monitoring の結果を結びつける場合、
 *   「causedBy」のような因果を主張するフィールドは絶対に作らない。
 *   時間窓内の co-occurrence（同時発生）として提示するに留める
 *   （例: CrawlLogEntry.relatedContactRuns の timeDeltaMinutes）。
 */

// ── Provider ─────────────────────────────────────────────────────────────────

export type MonitorProviderId = 'chatgpt' | 'perplexity' | 'gemini';

export interface MonitorProviderDef {
  providerId: MonitorProviderId;
  displayName: string;
  contactApiAvailable: boolean;
  monitoringApiAvailable: boolean;
  /** Crawl Log の User-Agent 判定用パターン（部分一致文字列。正規表現ではない） */
  botUserAgentPatterns: string[];
}

// ── Contact（M1-2以降で実装） ─────────────────────────────────────────────────

export interface ContactRun {
  runId: string;
  triggerType: 'manual';            // M1は'manual'のみ。'scheduled'はM2でPL対応時に追加
  targetEntityIds: string[];
  providers: MonitorProviderId[];
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'partial_failure' | 'failed';
  itemCount: number;
}

export interface ContactItem {
  itemId: string;
  runId: string;
  entityId: string;
  referenceId?: string;
  provider: MonitorProviderId;
  targetUrl: string;
  requestedAt: string;
  httpStatus?: number;
  success: boolean;
  errorMessage?: string;
  /**
   * true = 実際にAI Provider APIへ接触したのではなく、
   * targetUrlの到達性チェックで代替した「模擬Contact」であることを示す。
   * M1-2時点ではProvider APIとの実接触が未検証のため、全件 simulated: true になる。
   * 実Provider接続が実装され次第、該当Providerのみ false へ切り替える。
   */
  simulated: boolean;
}

// ── Appearance Monitoring（M1-3以降で実装） ───────────────────────────────────

export interface MonitoringRun {
  runId: string;
  triggerType: 'manual';
  targetEntityIds: string[];
  providers: MonitorProviderId[];
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface MonitoringItem {
  itemId: string;
  runId: string;
  entityId: string;
  questionInstanceId?: string;
  provider: MonitorProviderId;
  appeared: boolean;
  citationFound: boolean;
  rawResponseSnippet?: string;
  checkedAt: string;
  /**
   * true = 実Provider APIを呼ばず模擬応答で判定したことを示す。
   * ContactItem.simulated と同じ思想。PERPLEXITY_API_KEY 等が未設定の場合は
   * 常に true になる。意図的にContact結果とは独立したフィールドであり、
   * ContactRun/ContactItem への参照は一切持たない（因果断定の禁止）。
   */
  simulated: boolean;
}

// ── /api/monitor-appearance request/response（M1-3） ─────────────────────────

export interface MonitorAppearanceRequest {
  entityId: string;
  questionText: string;
  /** M1-3は'perplexity'のみ受け付ける（複数指定は400で拒否）。 */
  providers: MonitorProviderId[];
}

export interface MonitorAppearancePostResponse {
  ok: boolean;
  run?: MonitoringRun;
  items?: MonitoringItem[];
  error?: string;
}

export interface MonitorAppearanceGetResponse {
  ok: boolean;
  run?: MonitoringRun;
  items?: MonitoringItem[];
  runs?: MonitoringRun[];
  error?: string;
}

// ── Crawl Log（M1-4以降で実装） ───────────────────────────────────────────────

export interface CrawlLogEntry {
  logId: string;
  detectedAt: string;
  botUserAgent: string;
  /** User-Agent からの推定。確証ではない。 */
  inferredProvider?: MonitorProviderId;
  targetUrl: string;
  entityId?: string;
  /**
   * 時間窓内に実行された Contact Run の一覧（co-occurrenceの提示のみ）。
   * 「このCrawlがこのContactによって発生した」と断定する causedBy フィールドは作らない。
   */
  relatedContactRuns?: Array<{ runId: string; timeDeltaMinutes: number }>;
}

export interface MonitorCrawlLogGetResponse {
  ok: boolean;
  entries?: CrawlLogEntry[];
  error?: string;
}

// ── /api/monitor-contact request/response（M1-2） ────────────────────────────

export interface MonitorContactRequest {
  entityId: string;
  /** 指定があれば該当Referenceのpage Urlを対象にする。省略時はEntityハブURLを対象にする。 */
  referenceId?: string;
  /** M1-2はProvider1件のみ受け付ける（複数指定は400で拒否）。 */
  providers: MonitorProviderId[];
}

export interface MonitorContactPostResponse {
  ok: boolean;
  run?: ContactRun;
  items?: ContactItem[];
  error?: string;
}

export interface MonitorContactGetResponse {
  ok: boolean;
  /** ?runId= 指定時 */
  run?: ContactRun;
  items?: ContactItem[];
  /** 一覧取得時 */
  runs?: ContactRun[];
  error?: string;
}

// ── Entity一覧（RefBase読み取り連携・M1-1） ───────────────────────────────────

export interface MonitorEntityReference {
  questionSlug: string;
  promptTypeId: string;
  promptText: string;
  pageUrl: string;
}

export interface MonitorEntitySummary {
  id: string;
  name: string;
  category: string;
  entityType?: string;
  references: MonitorEntityReference[];
}

export interface EntitiesResponse {
  ok: boolean;
  entities?: MonitorEntitySummary[];
  error?: string;
}

// ── Dashboard（M1-1は空データ・M1-5で本格集計） ───────────────────────────────
//
// 重要: Contact / Crawl / Appearance は常に独立した指標（independent metrics）として
// 集計する。Contact→Crawl→Appearanceの転換・因果を示すフィールド（causedBy /
// conversion / attribution / contactToAppearanceRate / 合成スコア等）は作らない。
// 各指標は「同じEntity/Providerについて、それぞれ別々に何が起きたか」を横並びで
// 示すのみで、相互の因果は一切主張しない。

export type MonitorPeriod = '7d' | '30d' | 'all';

/** 1 Provider分の独立集計（Entity単位の内訳）。他Provider・他指標との合成は行わない。 */
export interface ProviderDashboardStats {
  contactCount: number;
  crawlCount: number;
  appearanceCount: number;
  appearanceRate: number;
  citationCount: number;
}

export interface EntityDashboardRow {
  entityId: string;
  lastContactedAt?: string;
  lastCrawledAt?: string;
  lastAppearanceCheckedAt?: string;
  contactCount: number;
  crawlCount: number;
  appearanceCount: number;
  appearanceRate: number;
  citationCount: number;
  /** Provider別の独立集計。キーはMonitorProviderId。 */
  byProvider: Record<string, ProviderDashboardStats>;
}

export interface DashboardResponse {
  ok: boolean;
  period?: MonitorPeriod;
  summary?: EntityDashboardRow[];
  error?: string;
}
