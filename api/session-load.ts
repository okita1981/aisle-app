import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import { parse } from 'node:url';
import type { SessionIndexEntry } from './session-save.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  try {
    const { query } = parse(req.url ?? '', true);
    const key        = typeof query.key        === 'string' ? query.key        : undefined;
    const clientSlug = typeof query.clientSlug === 'string' ? query.clientSlug : undefined;

    // ── ?key=session:xxx:yyy → セッション本体を返す ─────────────────
    if (key) {
      const data = await kv.get(key);
      if (!data) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, data }));
      return;
    }

    // ── ?clientSlug=xxx → そのクライアントのセッション一覧を返す ────
    if (clientSlug) {
      const sessions = await kv.get<SessionIndexEntry[]>(`session-index:${clientSlug}`) ?? [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, sessions }));
      return;
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'key または clientSlug クエリパラメータが必要です' }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
