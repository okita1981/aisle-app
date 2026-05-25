import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import { generateParentHtml, type AislePageIndexEntry } from './page-generate.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface DeleteRequest {
  slug: string;
  clientSlug?: string;
  promptSlug?: string;
  companyName?: string;
  productCategory?: string;
  deleteFromIndex?: boolean;
  regenerateParent?: boolean;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as DeleteRequest;
    const {
      slug,
      clientSlug,
      promptSlug,
      companyName = '',
      productCategory = '',
      deleteFromIndex = false,
      regenerateParent = false,
    } = body;

    if (!slug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'slug is required' }));
      return;
    }

    // 1. KV本文削除
    await kv.del(`page:${slug}`);

    const now = new Date().toISOString();
    let indexUpdated = false;
    let parentRegenerated = false;

    // 2. インデックス更新
    if (deleteFromIndex && clientSlug) {
      const existingIndex = await kv.get<AislePageIndexEntry[]>(`page-index:${clientSlug}`) ?? [];
      const updatedIndex = existingIndex.filter(e =>
        e.slug !== slug && (!promptSlug || e.promptSlug !== promptSlug),
      );
      await kv.set(`page-index:${clientSlug}`, updatedIndex);
      indexUpdated = true;

      // 3. 親ページ再生成（companyName が必要）
      if (regenerateParent && companyName) {
        const parentHtml = generateParentHtml(updatedIndex, now, clientSlug, companyName, productCategory);
        await kv.set(`page:${clientSlug}`, parentHtml);
        parentRegenerated = true;
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, slug, indexUpdated, parentRegenerated }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
