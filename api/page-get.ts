import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  try {
    // slug はクエリパラメータで渡される（/test/:slug → /api/page-get?slug=:slug）
    const rawUrl = req.url ?? '';
    const queryStr = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    const slug         = params.get('slug') ?? '';
    const questionSlug = params.get('questionSlug') ?? '';
    const clientSlug   = params.get('clientSlug') ?? '';

    // ── 問い単位ページ（新構造）: /{clientSlug}/questions/{questionSlug} ──
    if (questionSlug && clientSlug) {
      const html = await kv.get<string>(`page:question:${clientSlug}/${questionSlug}`);
      if (!html) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Not Found</title></head>
<body><h1>404 Not Found</h1><p>ページ「${clientSlug}/questions/${questionSlug}」は存在しません。</p></body></html>`);
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(html);
      return;
    }

    if (!slug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('slug パラメータが必要です');
      return;
    }

    // ── 旧構造ページ（後方互換）──────────────────────────────────────────
    const html = await kv.get<string>(`page:${slug}`);

    if (!html) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Not Found</title></head>
<body><h1>404 Not Found</h1><p>ページ「${slug}」は存在しません。</p></body></html>`);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(html);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Internal Server Error: ${message}`);
  }
}
