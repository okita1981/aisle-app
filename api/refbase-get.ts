import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type { RefBaseCompany, RefBaseReference } from './page-generate.js';

export const config = { maxDuration: 15 };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const clientSlug   = url.searchParams.get('clientSlug');
    const questionSlug = url.searchParams.get('questionSlug');
    const promptTypeId = url.searchParams.get('promptTypeId');

    // global index: type=all のとき clientSlug 不要
    if (url.searchParams.get('type') === 'all') {
      const globalIndex = await kv.get<string[]>('refbase:index:all') ?? [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, entityIds: globalIndex }));
      return;
    }

    if (!clientSlug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'clientSlug is required' }));
      return;
    }

    const company = await kv.get<RefBaseCompany>(`refbase:company:${clientSlug}`);
    const index   = await kv.get<string[]>(`refbase:index:${clientSlug}`) ?? [];

    // 単一 reference を返す
    if (questionSlug) {
      const reference = await kv.get<RefBaseReference>(`refbase:ref:${clientSlug}/${questionSlug}`);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, company, reference: reference ?? null }));
      return;
    }

    // インデックスのみ返す（type=index）
    if (url.searchParams.get('type') === 'index') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, company, index }));
      return;
    }

    // 会社単位で全 reference を返す（promptTypeId フィルター対応）
    const refs = await Promise.all(
      index.map(slug => kv.get<RefBaseReference>(`refbase:ref:${clientSlug}/${slug}`)),
    );
    const validRefs = refs.filter((r): r is RefBaseReference => r !== null && r !== undefined);
    const filtered  = promptTypeId
      ? validRefs.filter((r: RefBaseReference) => r.promptTypeId === promptTypeId)
      : validRefs;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, company, references: filtered, index }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
