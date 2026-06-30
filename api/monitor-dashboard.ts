/**
 * GET /api/monitor-dashboard — M1-5（本格集計）
 *
 * Contact / Crawl / Appearance の3指標をEntity別・Provider別に横並び集計する。
 *
 * ── 因果断定の禁止（必須・最重要） ───────────────────────────────────────────
 * Contact / Crawl / Appearance は常に independent metrics（独立した指標）として
 * 集計する。以下のようなフィールド・計算は絶対に作らない：
 *   - causedBy / sourceContactRunId のような参照
 *   - conversion（Contact→Crawl→Appearanceの転換率）
 *   - attribution（どのContactが出現の要因かの推定）
 *   - contactToAppearanceRate のような合成率
 *   - Contact成功率と出現率を合成した単一スコア
 * 許可されるのは「同じEntity/Providerについて、それぞれ独立に何件発生したか」を
 * 横並びで提示することのみ。Crawl LogのrelatedContactRuns（時間相関）は
 * /api/monitor-crawl-log の責務であり、Dashboard集計はそれを合成・スコア化しない。
 *
 * KV読み取り: monitor:contact:*, monitor:appearance:*, monitor:crawl:* （すべて読み取り専用）
 * KV書き込み: なし。AI呼び出し: なし。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type {
  ContactItem,
  ContactRun,
  CrawlLogEntry,
  DashboardResponse,
  EntityDashboardRow,
  MonitoringItem,
  MonitoringRun,
  MonitorPeriod,
  MonitorProviderId,
  ProviderDashboardStats,
} from './_monitor-types.js';

export const config = { maxDuration: 30 };

// 1リクエストあたりに走査するRun/Log件数の上限（タイムアウト対策。全件スキャンはしない）
const SCAN_LIMIT = 300;

function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

function periodCutoffMs(period: MonitorPeriod): number {
  const now = Date.now();
  if (period === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (period === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  return 0; // 'all'
}

function emptyProviderStats(): ProviderDashboardStats {
  return { contactCount: 0, crawlCount: 0, appearanceCount: 0, appearanceRate: 0, citationCount: 0 };
}

function emptyRow(entityId: string): EntityDashboardRow {
  return {
    entityId,
    contactCount: 0,
    crawlCount: 0,
    appearanceCount: 0,
    appearanceRate: 0,
    citationCount: 0,
    byProvider: {},
  };
}

function getOrCreateRow(rows: Map<string, EntityDashboardRow>, entityId: string): EntityDashboardRow {
  let row = rows.get(entityId);
  if (!row) { row = emptyRow(entityId); rows.set(entityId, row); }
  return row;
}

function getOrCreateProviderStats(row: EntityDashboardRow, provider: string): ProviderDashboardStats {
  let stats = row.byProvider[provider];
  if (!stats) { stats = emptyProviderStats(); row.byProvider[provider] = stats; }
  return stats;
}

function isNewer(a: string | undefined, b: string): boolean {
  return !a || new Date(b).getTime() > new Date(a).getTime();
}

// ── Contact集計 ──────────────────────────────────────────────────────────────

async function aggregateContact(rows: Map<string, EntityDashboardRow>, cutoffMs: number): Promise<void> {
  const runIds = ((await kv.get<string[]>('monitor:contact:runs:index')) ?? []).slice(0, SCAN_LIMIT);
  const runs = (await Promise.all(runIds.map(id => kv.get<ContactRun>(`monitor:contact:run:${id}`))))
    .filter((r): r is ContactRun => r !== null && r !== undefined && new Date(r.startedAt).getTime() >= cutoffMs);

  for (const run of runs) {
    const itemIds = (await kv.get<string[]>(`monitor:contact:run:${run.runId}:items`)) ?? [];
    const items = (await Promise.all(itemIds.map(id => kv.get<ContactItem>(`monitor:contact:item:${run.runId}:${id}`))))
      .filter((i): i is ContactItem => i !== null && i !== undefined);

    for (const item of items) {
      const row = getOrCreateRow(rows, item.entityId);
      row.contactCount += 1;
      if (isNewer(row.lastContactedAt, item.requestedAt)) row.lastContactedAt = item.requestedAt;

      const stats = getOrCreateProviderStats(row, item.provider);
      stats.contactCount += 1;
    }
  }
}

// ── Appearance集計 ───────────────────────────────────────────────────────────

async function aggregateAppearance(rows: Map<string, EntityDashboardRow>, cutoffMs: number): Promise<void> {
  const runIds = ((await kv.get<string[]>('monitor:appearance:runs:index')) ?? []).slice(0, SCAN_LIMIT);
  const runs = (await Promise.all(runIds.map(id => kv.get<MonitoringRun>(`monitor:appearance:run:${id}`))))
    .filter((r): r is MonitoringRun => r !== null && r !== undefined && new Date(r.startedAt).getTime() >= cutoffMs);

  // Provider別の appearanceRate 算出用に「総チェック数」を別途集計する
  const totalChecksByEntityProvider = new Map<string, number>(); // key: `${entityId}:${provider}`
  const totalChecksByEntity = new Map<string, number>();

  for (const run of runs) {
    const itemIds = (await kv.get<string[]>(`monitor:appearance:run:${run.runId}:items`)) ?? [];
    const items = (await Promise.all(itemIds.map(id => kv.get<MonitoringItem>(`monitor:appearance:item:${run.runId}:${id}`))))
      .filter((i): i is MonitoringItem => i !== null && i !== undefined);

    for (const item of items) {
      const row = getOrCreateRow(rows, item.entityId);
      if (isNewer(row.lastAppearanceCheckedAt, item.checkedAt)) row.lastAppearanceCheckedAt = item.checkedAt;

      const stats = getOrCreateProviderStats(row, item.provider);

      const epKey = `${item.entityId}:${item.provider}`;
      totalChecksByEntityProvider.set(epKey, (totalChecksByEntityProvider.get(epKey) ?? 0) + 1);
      totalChecksByEntity.set(item.entityId, (totalChecksByEntity.get(item.entityId) ?? 0) + 1);

      if (item.appeared) {
        row.appearanceCount += 1;
        stats.appearanceCount += 1;
      }
      if (item.citationFound) {
        row.citationCount += 1;
        stats.citationCount += 1;
      }
    }
  }

  // appearanceRate = appeared件数 / 総チェック件数（独立指標。他指標とは合成しない）
  for (const [entityId, row] of rows) {
    const totalEntity = totalChecksByEntity.get(entityId) ?? 0;
    row.appearanceRate = totalEntity > 0 ? row.appearanceCount / totalEntity : 0;

    for (const [provider, stats] of Object.entries(row.byProvider)) {
      const totalEp = totalChecksByEntityProvider.get(`${entityId}:${provider}`) ?? 0;
      stats.appearanceRate = totalEp > 0 ? stats.appearanceCount / totalEp : 0;
    }
  }
}

// ── Crawl集計 ────────────────────────────────────────────────────────────────

async function aggregateCrawl(rows: Map<string, EntityDashboardRow>, cutoffMs: number): Promise<void> {
  const logIds = ((await kv.get<string[]>('monitor:crawl:logs:index')) ?? []).slice(0, SCAN_LIMIT);
  const entries = (await Promise.all(logIds.map(id => kv.get<CrawlLogEntry>(`monitor:crawl:log:${id}`))))
    .filter((e): e is CrawlLogEntry => e !== null && e !== undefined && new Date(e.detectedAt).getTime() >= cutoffMs);

  for (const entry of entries) {
    if (!entry.entityId) continue; // entityIdが推定できないCrawlはEntity別集計から除外（全体件数には影響しない設計）
    const row = getOrCreateRow(rows, entry.entityId);
    row.crawlCount += 1;
    if (isNewer(row.lastCrawledAt, entry.detectedAt)) row.lastCrawledAt = entry.detectedAt;

    if (entry.inferredProvider) {
      const stats = getOrCreateProviderStats(row, entry.inferredProvider as MonitorProviderId);
      stats.crawlCount += 1;
    }
  }
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies DashboardResponse));
    return;
  }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const periodParam = url.searchParams.get('period');
    const period: MonitorPeriod = periodParam === '7d' || periodParam === '30d' ? periodParam : 'all';
    const cutoffMs = periodCutoffMs(period);

    const rows = new Map<string, EntityDashboardRow>();

    // 3指標を独立に集計する（互いの結果を参照しない）
    await aggregateContact(rows, cutoffMs);
    await aggregateAppearance(rows, cutoffMs);
    await aggregateCrawl(rows, cutoffMs);

    const summary = [...rows.values()].sort((a, b) => a.entityId.localeCompare(b.entityId));

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, period, summary } satisfies DashboardResponse));
  } catch (err) {
    console.error('[monitor-dashboard]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies DashboardResponse));
  }
}
