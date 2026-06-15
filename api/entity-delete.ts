import type { IncomingMessage, ServerResponse } from 'http';
import { kv } from '@vercel/kv';

export const config = { maxDuration: 60 };

interface QuestionPageIndexEntry {
  questionSlug: string;
  promptText: string;
  promptTypeId: string;
  generatedAt: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  // body 読み取り
  const body = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  let clientSlug: string;
  let confirmSlug: string;
  try {
    const parsed = JSON.parse(body) as { clientSlug?: string; confirmSlug?: string };
    clientSlug  = (parsed.clientSlug ?? '').trim();
    confirmSlug = (parsed.confirmSlug ?? '').trim();
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  if (!clientSlug) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'clientSlug is required' }));
    return;
  }

  // 再入力確認（サーバー側でも検証）
  if (clientSlug !== confirmSlug) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'confirmSlug が一致しません' }));
    return;
  }

  // slug バリデーション
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clientSlug)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'clientSlug の形式が不正です' }));
    return;
  }

  try {
    const deleted: string[] = [];

    // 1. refbase:index:{clientSlug} から questionSlug 一覧を取得
    const refIndex = await kv.get<string[]>(`refbase:index:${clientSlug}`) ?? [];

    // 2. refbase:ref:{clientSlug}/{questionSlug} を全件削除
    await Promise.all(refIndex.map(async (qSlug) => {
      await kv.del(`refbase:ref:${clientSlug}/${qSlug}`);
      deleted.push(`refbase:ref:${clientSlug}/${qSlug}`);
    }));

    // 3. page:question:{clientSlug}/{questionSlug} を全件削除
    //    （page-question-index から取得して対象を特定）
    const pageQIdx = await kv.get<QuestionPageIndexEntry[]>(`page-question-index:${clientSlug}`) ?? [];
    await Promise.all(pageQIdx.map(async (entry) => {
      await kv.del(`page:question:${clientSlug}/${entry.questionSlug}`);
      deleted.push(`page:question:${clientSlug}/${entry.questionSlug}`);
    }));

    // 4. refbase:index:all から clientSlug を除去
    const globalIndex = await kv.get<string[]>('refbase:index:all') ?? [];
    if (globalIndex.includes(clientSlug)) {
      await kv.set('refbase:index:all', globalIndex.filter(s => s !== clientSlug));
      deleted.push('refbase:index:all (updated)');
    }

    // 5. 残りのキーを一括削除
    const keysToDelete = [
      `refbase:company:${clientSlug}`,
      `refbase:index:${clientSlug}`,
      `page:index:${clientSlug}`,
      `page-question-index:${clientSlug}`,
      `page:${clientSlug}`,
      `page-index:${clientSlug}`,
      `evidence:${clientSlug}`,
    ];
    await Promise.all(keysToDelete.map(async (key) => {
      await kv.del(key);
      deleted.push(key);
    }));

    console.log(`[entity-delete] ${clientSlug}: deleted ${deleted.length} keys`);

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, clientSlug, deletedCount: deleted.length, deleted }));
  } catch (err) {
    console.error('[entity-delete] error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}
