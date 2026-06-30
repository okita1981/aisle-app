/**
 * /api/monitor-contact — M1-2
 *
 * POST: Manual AI Contact 実行（ContactRun + ContactItem作成）
 * GET : Contact履歴取得（?runId= で単体／無指定で一覧）
 *
 * ── M1-2の実装範囲についての重要な注記 ──────────────────────────────────────
 * 「AI Contact」はAI Provider APIへ実際に接触する想定の機能だが、各Provider
 * （ChatGPT/Perplexity/Gemini）のAPI仕様・「URLを読ませる」挙動はM1-2時点では
 * 未検証。そのため M1-2 は全件 simulated Contact として実装する：
 *   - targetUrl（RefBase URL）への実HTTP到達性チェックは行う（fetch HEAD/GET）
 *   - しかしAI Provider APIへのリクエストは一切送らない
 *   - ContactItem.simulated は常に true
 * 実Provider接続が検証でき次第、Provider単位で simulated: false に切り替える
 * （M1-2のスコープ外）。
 *
 * 対象Provider: M1-2は 'perplexity' のみ受け付ける（他は400で拒否）。
 *
 * ── 因果断定の禁止 ───────────────────────────────────────────────────────────
 * このAPIは「Contactを実行した」事実のみを記録する。これによってAIが実際に
 * 出現したかどうかは一切判定・主張しない（出現判定はAppearance Monitoringの
 * 責務。M1-3で実装）。ContactRun/ContactItemに出現結果フィールドは持たせない。
 *
 * KV書き込み:
 *   monitor:contact:run:{runId}            → ContactRun
 *   monitor:contact:item:{runId}:{itemId}  → ContactItem
 *   monitor:contact:run:{runId}:items      → string[]（itemId一覧。run単位のitem取得用）
 *   monitor:contact:runs:index             → string[]（runId一覧。新しい順に先頭追加）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { kv } from '@vercel/kv';
import type {
  ContactItem,
  ContactRun,
  MonitorContactGetResponse,
  MonitorContactPostResponse,
  MonitorContactRequest,
  MonitorProviderId,
} from './_monitor-types.js';

export const config = { maxDuration: 30 };

const RUNS_INDEX_KEY = 'monitor:contact:runs:index';
const M1_SUPPORTED_PROVIDERS: MonitorProviderId[] = ['perplexity'];

// ── 認可 ─────────────────────────────────────────────────────────────────────
function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── RefBase からターゲットURLを解決（読み取り専用） ───────────────────────────

interface RefBaseReferenceMinimal {
  pageUrl: string;
}

const REFBASE_BASE = 'https://www.refbase.ai';

async function resolveTargetUrl(entityId: string, referenceId?: string): Promise<string | null> {
  const entity = await kv.get(`refbase:company:${entityId}`);
  if (!entity) return null;

  if (referenceId) {
    const ref = await kv.get<RefBaseReferenceMinimal>(`refbase:ref:${entityId}/${referenceId}`);
    return ref?.pageUrl ?? null;
  }
  return `${REFBASE_BASE}/entity/${entityId}`;
}

// ── Simulated Contact 実行（実Provider接触なし。到達性チェックのみ） ──────────

async function executeSimulatedContact(targetUrl: string): Promise<{ success: boolean; httpStatus?: number; errorMessage?: string }> {
  try {
    const resp = await fetch(targetUrl, { method: 'GET', signal: AbortSignal.timeout(10000) });
    return { success: resp.ok, httpStatus: resp.status };
  } catch (err) {
    return { success: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

// ── POST: Manual Contact実行 ──────────────────────────────────────────────────

async function handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: MonitorContactRequest;
  try {
    body = JSON.parse(await readBody(req)) as MonitorContactRequest;
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'JSON parse error' } satisfies MonitorContactPostResponse));
    return;
  }

  const { entityId, referenceId, providers } = body;

  if (!entityId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'entityId is required' } satisfies MonitorContactPostResponse));
    return;
  }
  if (!Array.isArray(providers) || providers.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'providers is required' } satisfies MonitorContactPostResponse));
    return;
  }
  const unsupported = providers.filter(p => !M1_SUPPORTED_PROVIDERS.includes(p));
  if (unsupported.length > 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: `M1-2はProvider [${M1_SUPPORTED_PROVIDERS.join(', ')}] のみ対応しています（未対応: ${unsupported.join(', ')}）`,
    } satisfies MonitorContactPostResponse));
    return;
  }

  const targetUrl = await resolveTargetUrl(entityId, referenceId);
  if (!targetUrl) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: `entityId="${entityId}"${referenceId ? ` / referenceId="${referenceId}"` : ''} が見つかりません` } satisfies MonitorContactPostResponse));
    return;
  }

  const runId = `CR-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const items: ContactItem[] = [];

  for (const provider of providers) {
    const result = await executeSimulatedContact(targetUrl);
    items.push({
      itemId: `CI-${randomUUID()}`,
      runId,
      entityId,
      referenceId,
      provider,
      targetUrl,
      requestedAt: new Date().toISOString(),
      httpStatus: result.httpStatus,
      success: result.success,
      errorMessage: result.errorMessage,
      simulated: true, // M1-2は常にtrue（ファイル冒頭の注記を参照）
    });
  }

  const completedAt = new Date().toISOString();
  const successCount = items.filter(i => i.success).length;
  const run: ContactRun = {
    runId,
    triggerType: 'manual',
    targetEntityIds: [entityId],
    providers,
    startedAt,
    completedAt,
    status: successCount === items.length ? 'completed' : successCount > 0 ? 'partial_failure' : 'failed',
    itemCount: items.length,
  };

  try {
    await kv.set(`monitor:contact:run:${runId}`, run);
    await Promise.all(items.map(item => kv.set(`monitor:contact:item:${runId}:${item.itemId}`, item)));
    await kv.set(`monitor:contact:run:${runId}:items`, items.map(i => i.itemId));

    const index = (await kv.get<string[]>(RUNS_INDEX_KEY)) ?? [];
    await kv.set(RUNS_INDEX_KEY, [runId, ...index]);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, run, items } satisfies MonitorContactPostResponse));
  } catch (err) {
    console.error('[monitor-contact POST]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies MonitorContactPostResponse));
  }
}

// ── GET: Contact履歴取得 ───────────────────────────────────────────────────────

async function handleGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const runId = url.searchParams.get('runId');

  try {
    if (runId) {
      const run = await kv.get<ContactRun>(`monitor:contact:run:${runId}`);
      if (!run) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `runId="${runId}" が見つかりません` } satisfies MonitorContactGetResponse));
        return;
      }
      const itemIds = (await kv.get<string[]>(`monitor:contact:run:${runId}:items`)) ?? [];
      const items = (await Promise.all(itemIds.map(id => kv.get<ContactItem>(`monitor:contact:item:${runId}:${id}`))))
        .filter((i): i is ContactItem => i !== null && i !== undefined);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, run, items } satisfies MonitorContactGetResponse));
      return;
    }

    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;
    const index = (await kv.get<string[]>(RUNS_INDEX_KEY)) ?? [];
    const targetIds = index.slice(0, limit);
    const runs = (await Promise.all(targetIds.map(id => kv.get<ContactRun>(`monitor:contact:run:${id}`))))
      .filter((r): r is ContactRun => r !== null && r !== undefined);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, runs } satisfies MonitorContactGetResponse));
  } catch (err) {
    console.error('[monitor-contact GET]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies MonitorContactGetResponse));
  }
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  if (req.method === 'POST') { await handlePost(req, res); return; }
  if (req.method === 'GET') { await handleGet(req, res); return; }

  res.statusCode = 405;
  res.end();
}
