/**
 * GET /api/monitor-crawl-log — M1-4
 *
 * monitor-crawl-ingest.tsが受信したCrawlLogEntryの一覧・フィルタ取得。
 * 認証はMonitor管理API群と同じ isAuthorized()（x-aisle-admin / EM_SHARED_SECRET）。
 * ingest側（MONITOR_INGEST_SECRET）とは別方式であることに注意。
 *
 * ── 因果断定の禁止（必須） ───────────────────────────────────────────────────
 * 各エントリに relatedContactRuns（時間窓内に実行されたContact Runの一覧）を
 * 付与するが、これは「co-occurrence（同時発生）」の提示に過ぎない。
 * 「このCrawlはこのContactが原因で発生した」と断定する causedBy / sourceContactRunId
 * のようなフィールド名・実装は一切行わない。あくまで「runIdと時間差」の事実列挙のみ。
 *
 * KV読み取り: monitor:crawl:log:*, monitor:crawl:logs:index, monitor:contact:run:*,
 *            monitor:contact:runs:index
 * KV書き込み: なし。AI呼び出し: なし。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type { ContactRun, CrawlLogEntry, MonitorCrawlLogGetResponse, MonitorProviderId } from './_monitor-types.js';

export const config = { maxDuration: 20 };

const LOGS_INDEX_KEY = 'monitor:crawl:logs:index';
const CONTACT_RUNS_INDEX_KEY = 'monitor:contact:runs:index';

/** Crawl来訪とContact実行の「関連の可能性」を提示する時間窓（分）。これより外は無関係として扱う。 */
const CORRELATION_WINDOW_MINUTES = 120;
/** 相関計算の対象とするContact Run走査件数（直近N件のみ。全件スキャンは行わない） */
const CONTACT_RUNS_SCAN_LIMIT = 200;

function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

/**
 * Crawl Logエントリ1件に対して、時間窓内のContact Runを co-occurrence として列挙する。
 * 「原因」は判定しない。entityIdが一致し、かつ時間差がCORRELATION_WINDOW_MINUTES以内の
 * Contact Runのみを対象にする。
 */
function computeRelatedContactRuns(
  entry: CrawlLogEntry,
  contactRuns: ContactRun[],
): Array<{ runId: string; timeDeltaMinutes: number }> {
  if (!entry.entityId) return [];
  const entryTime = new Date(entry.detectedAt).getTime();

  const related: Array<{ runId: string; timeDeltaMinutes: number }> = [];
  for (const run of contactRuns) {
    if (!run.targetEntityIds.includes(entry.entityId)) continue;
    const runTime = new Date(run.startedAt).getTime();
    const deltaMinutes = Math.round(Math.abs(entryTime - runTime) / 60000);
    if (deltaMinutes <= CORRELATION_WINDOW_MINUTES) {
      related.push({ runId: run.runId, timeDeltaMinutes: deltaMinutes });
    }
  }
  return related.sort((a, b) => a.timeDeltaMinutes - b.timeDeltaMinutes);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies MonitorCrawlLogGetResponse));
    return;
  }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const entityIdFilter = url.searchParams.get('entityId');
    const providerFilter = url.searchParams.get('provider') as MonitorProviderId | null;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

    const index = (await kv.get<string[]>(LOGS_INDEX_KEY)) ?? [];
    const targetIds = index.slice(0, limit);
    let entries = (await Promise.all(targetIds.map(id => kv.get<CrawlLogEntry>(`monitor:crawl:log:${id}`))))
      .filter((e): e is CrawlLogEntry => e !== null && e !== undefined);

    if (entityIdFilter) entries = entries.filter(e => e.entityId === entityIdFilter);
    if (providerFilter) entries = entries.filter(e => e.inferredProvider === providerFilter);

    // 相関計算用にContact Runを取得（直近N件のみ。全件スキャンしない）
    const contactRunIds = ((await kv.get<string[]>(CONTACT_RUNS_INDEX_KEY)) ?? []).slice(0, CONTACT_RUNS_SCAN_LIMIT);
    const contactRuns = (await Promise.all(contactRunIds.map(id => kv.get<ContactRun>(`monitor:contact:run:${id}`))))
      .filter((r): r is ContactRun => r !== null && r !== undefined);

    const entriesWithRelations = entries.map(entry => ({
      ...entry,
      relatedContactRuns: computeRelatedContactRuns(entry, contactRuns),
    }));

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, entries: entriesWithRelations } satisfies MonitorCrawlLogGetResponse));
  } catch (err) {
    console.error('[monitor-crawl-log]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies MonitorCrawlLogGetResponse));
  }
}
