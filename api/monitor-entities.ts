/**
 * GET /api/monitor-entities — M1-1
 *
 * RefBase Entity / Reference 一覧の読み取り連携。
 * RefBaseの既存KV構造（refbase:index:all → refbase:company:{slug} →
 * refbase:index:{slug} → refbase:ref:{slug}/{questionSlug}）を読み取り専用で参照する。
 *
 * Monitor独自のEntity Configストレージは持たない（M1スコープ外。設計レビュー参照）。
 * RefBase側のKVへの書き込みは一切行わない。
 *
 * KV書き込み: なし。AI呼び出し: なし。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type { EntitiesResponse, MonitorEntityReference, MonitorEntitySummary } from './_monitor-types.js';

export const config = { maxDuration: 20 };

// ── 認可（既存Monitor以外のAPI群と同一方針） ─────────────────────────────────
function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

// ── RefBase KV型（page-generate.ts / refbase-get.ts と同形のサブセット） ──────

interface RefBaseCompanyMinimal {
  id: string;
  name: string;
  category: string;
  entityType?: string;
}

interface RefBaseReferenceMinimal {
  id: string;
  promptTypeId: string;
  promptText: string;
  pageUrl: string;
}

async function loadEntitySummary(slug: string): Promise<MonitorEntitySummary | null> {
  const [company, refSlugs] = await Promise.all([
    kv.get<RefBaseCompanyMinimal>(`refbase:company:${slug}`),
    kv.get<string[]>(`refbase:index:${slug}`),
  ]);
  if (!company) return null;

  const slugList = refSlugs ?? [];
  const refs = await Promise.all(
    slugList.map(qSlug => kv.get<RefBaseReferenceMinimal>(`refbase:ref:${slug}/${qSlug}`)),
  );

  const references: MonitorEntityReference[] = refs
    .filter((r): r is RefBaseReferenceMinimal => r !== null && r !== undefined)
    .map(r => ({
      questionSlug: r.id,
      promptTypeId: r.promptTypeId,
      promptText: r.promptText,
      pageUrl: r.pageUrl,
    }));

  return {
    id: company.id,
    name: company.name,
    category: company.category,
    entityType: company.entityType,
    references,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies EntitiesResponse));
    return;
  }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const clientSlug = url.searchParams.get('clientSlug');

    if (clientSlug) {
      const entity = await loadEntitySummary(clientSlug);
      if (!entity) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `Entity "${clientSlug}" が見つかりません` } satisfies EntitiesResponse));
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, entities: [entity] } satisfies EntitiesResponse));
      return;
    }

    const allSlugs = (await kv.get<string[]>('refbase:index:all')) ?? [];
    const BATCH = 8;
    const entities: MonitorEntitySummary[] = [];
    for (let i = 0; i < allSlugs.length; i += BATCH) {
      const batch = allSlugs.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(loadEntitySummary));
      for (const r of results) if (r) entities.push(r);
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, entities } satisfies EntitiesResponse));
  } catch (err) {
    console.error('[monitor-entities]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies EntitiesResponse));
  }
}
