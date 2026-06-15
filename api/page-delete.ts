import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import { generateParentHtml, generateQuestionParentHtml, type AislePageIndexEntry, type QuestionPageIndexEntry } from './page-generate.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface DeleteRequest {
  // ── 旧P-IDページ削除（後方互換） ──────────────────────────────────
  slug?: string;
  promptSlug?: string;
  // ── 新問いページ削除 ──────────────────────────────────────────────
  questionSlug?: string;
  // ── 共通 ──────────────────────────────────────────────────────────
  clientSlug?: string;
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
      questionSlug,
      clientSlug,
      promptSlug,
      companyName = '',
      productCategory = '',
      deleteFromIndex = false,
      regenerateParent = false,
    } = body;

    const now = new Date().toISOString();
    let indexUpdated = false;
    let parentRegenerated = false;

    // ── 問い単位ページの削除（新構造） ───────────────────────────────
    if (questionSlug && clientSlug) {
      // Aisle HTML 削除
      await kv.del(`page:question:${clientSlug}/${questionSlug}`);

      // RefBase KV 連動削除（常に実行）
      await kv.del(`refbase:ref:${clientSlug}/${questionSlug}`);
      const existingRefIdx = await kv.get<string[]>(`refbase:index:${clientSlug}`) ?? [];
      if (existingRefIdx.includes(questionSlug)) {
        await kv.set(`refbase:index:${clientSlug}`, existingRefIdx.filter(s => s !== questionSlug));
      }

      if (deleteFromIndex) {
        const existingQIdx = await kv.get<QuestionPageIndexEntry[]>(`page-question-index:${clientSlug}`) ?? [];
        const updatedQIdx = existingQIdx.filter(e => e.questionSlug !== questionSlug);
        await kv.set(`page-question-index:${clientSlug}`, updatedQIdx);
        indexUpdated = true;

        if (regenerateParent && companyName) {
          const parentHtml = generateQuestionParentHtml(updatedQIdx, now, clientSlug, companyName, productCategory);
          await kv.set(`page:index:${clientSlug}`, parentHtml);
          parentRegenerated = true;
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, questionSlug, indexUpdated, parentRegenerated }));
      return;
    }

    // ── 旧P-IDページの削除（後方互換） ──────────────────────────────
    if (!slug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'slug or questionSlug is required' }));
      return;
    }

    await kv.del(`page:${slug}`);

    if (deleteFromIndex && clientSlug) {
      const existingIndex = await kv.get<AislePageIndexEntry[]>(`page-index:${clientSlug}`) ?? [];
      const updatedIndex = existingIndex.filter(e =>
        e.slug !== slug && (!promptSlug || e.promptSlug !== promptSlug),
      );
      await kv.set(`page-index:${clientSlug}`, updatedIndex);
      indexUpdated = true;

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
