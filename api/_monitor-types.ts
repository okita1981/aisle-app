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

// ── Dashboard（M1-1は空データ・M1-5以降で本格集計） ───────────────────────────

export interface EntityDashboardRow {
  entityId: string;
  lastContactedAt?: string;
  lastCrawledAt?: string;
  lastAppearanceCheckedAt?: string;
  contactCount: number;
  crawlCount: number;
  appearanceCount: number;
  appearanceRate: number;
}

export interface DashboardResponse {
  ok: boolean;
  summary?: EntityDashboardRow[];
  error?: string;
}
