/**
 * POST /api/monitor-crawl-ingest — M1-4
 *
 * RefBase（別リポジトリ）側のBot検知ミドルウェアから、Fire-and-forgetでPOSTされる
 * 受信専用エンドポイント。RefBase側はこのAPIの応答を待たず、失敗してもRefBaseの
 * ページ表示には一切影響しない設計を前提とする（呼び出し側の実装はM1-4の対象外）。
 *
 * 認証: MONITOR_INGEST_SECRET による共有シークレット方式（Bearer）。
 *   - x-aisle-admin は使わない（ブラウザUI用の簡易認証であり、サーバー間連携には不向き）。
 *   - EM_SHARED_SECRET も使わない（Monitor Crawl Log専用シークレットとして分離管理する）。
 *   - secret未設定（本番運用ミス） → 500
 *   - Authorization ヘッダーなし/不一致 → 401
 *
 * KV書き込み:
 *   monitor:crawl:log:{logId}   → CrawlLogEntry
 *   monitor:crawl:logs:index    → string[]（logId一覧。新しい順に先頭追加）
 *
 * 因果断定はしない。このAPI自体はContact Runとの関連付けを一切行わない
 * （関連付けはGET側 /api/monitor-crawl-log の責務。relatedContactRuns参照）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { kv } from '@vercel/kv';
import type { CrawlLogEntry, MonitorProviderId } from './_monitor-types.js';
import { MONITOR_PROVIDERS } from './_monitor-providers.js';

export const config = { maxDuration: 10 };

const LOGS_INDEX_KEY = 'monitor:crawl:logs:index';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── User-AgentからProvider推定（確証ではない・部分一致のみ） ──────────────────
function inferProvider(userAgent: string): MonitorProviderId | undefined {
  for (const p of MONITOR_PROVIDERS) {
    if (p.botUserAgentPatterns.some(pattern => userAgent.includes(pattern))) {
      return p.providerId;
    }
  }
  return undefined;
}

// ── targetUrlからentityIdを抽出（RefBase URL構造 /entity/{id} or /reference/{id}/...） ──
function inferEntityId(targetUrl: string): string | undefined {
  try {
    const u = new URL(targetUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'entity' && parts[1]) return parts[1];
    if (parts[0] === 'reference' && parts[1]) return parts[1];
    return undefined;
  } catch {
    return undefined;
  }
}

interface IngestRequestBody {
  userAgent: string;
  targetUrl: string;
  detectedAt?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  const secret = process.env.MONITOR_INGEST_SECRET;
  if (!secret) {
    // 本番で未設定は運用ミス。ingest側（RefBase）はFire-and-forgetのため
    // この500はRefBaseの表示には影響しない。
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'MONITOR_INGEST_SECRET is not configured' }));
    return;
  }

  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['authorization'] !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as IngestRequestBody;
    if (!body.userAgent || !body.targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'userAgent and targetUrl are required' }));
      return;
    }

    const entry: CrawlLogEntry = {
      logId: `CL-${randomUUID()}`,
      detectedAt: body.detectedAt ?? new Date().toISOString(),
      botUserAgent: body.userAgent,
      inferredProvider: inferProvider(body.userAgent),
      targetUrl: body.targetUrl,
      entityId: inferEntityId(body.targetUrl),
      // relatedContactRuns はここでは計算しない（GET側で都度計算する。7章ガードレール参照）
    };

    await kv.set(`monitor:crawl:log:${entry.logId}`, entry);
    const index = (await kv.get<string[]>(LOGS_INDEX_KEY)) ?? [];
    await kv.set(LOGS_INDEX_KEY, [entry.logId, ...index]);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[monitor-crawl-ingest]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
