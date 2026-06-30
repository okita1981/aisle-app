/**
 * GET /api/monitor-dashboard — M1-1
 *
 * Dashboard集計API。M1-1時点ではContact/Crawl/Appearanceのいずれも未実装のため、
 * KVに集計対象データが存在しない。空配列を返すことで、Dashboard UIの土台
 * （API疎通・レスポンス形状）だけを先に固める。
 *
 * 本格集計（Contact/Crawl/Appearance Runからの実データ集計）はM1-5以降で実装する。
 * KV書き込み: なし。AI呼び出し: なし。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DashboardResponse } from './_monitor-types.js';

export const config = { maxDuration: 10 };

function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

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

  // M1-1: Contact/Crawl/Appearance のRunデータがまだ存在しないため、
  // 集計ロジックは実装せず空配列を返す（API形状の確定が目的）。
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, summary: [] } satisfies DashboardResponse));
}
