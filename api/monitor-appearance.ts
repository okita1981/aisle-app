/**
 * /api/monitor-appearance — M1-3
 *
 * POST: Appearance Monitoring 実行（手動トリガー。MonitoringRun + MonitoringItem作成）
 * GET : Monitoring履歴取得（?runId= で単体／無指定で一覧）
 *
 * ── M1-3の実装範囲についての重要な注記 ──────────────────────────────────────
 * PERPLEXITY_API_KEY が環境変数に設定されている場合のみ実Perplexity APIへ
 * questionTextを送信する。未設定、またはAPI呼び出しが失敗した場合は
 * simulated: true の模擬応答（空文字列のresponseText）にフォールバックする。
 * 模擬応答時は appeared / citationFound は必ず false になる（存在しないものを
 * 「出現した」と誤って記録しないため）。
 *
 * 対象Provider: M1-3は 'perplexity' のみ受け付ける（他は400で拒否）。
 *
 * ── 判定ロジック（意味評価は行わない） ────────────────────────────────────────
 *   appeared      = responseText に Entity名（canonicalName優先）が部分一致で含まれるか
 *   citationFound = responseText に RefBase Entity URL が部分一致で含まれるか
 * 「好意的に紹介されたか」「推薦されたか」等の意味解釈は一切行わない（文字列包含判定のみ）。
 *
 * ── 因果断定の禁止 ───────────────────────────────────────────────────────────
 * MonitoringRun/MonitoringItem は ContactRun/ContactItem への参照を一切持たない。
 * Contact実行と出現確認は独立した観測であり、本APIはその関連付け・因果判定を
 * 一切行わない（関連付けが必要な場合はDashboard側で時間相関として提示するに留める。
 * causedBy のような断定フィールドはここでも作らない）。
 *
 * KV書き込み:
 *   monitor:appearance:run:{runId}            → MonitoringRun
 *   monitor:appearance:item:{runId}:{itemId}  → MonitoringItem
 *   monitor:appearance:run:{runId}:items      → string[]（itemId一覧）
 *   monitor:appearance:runs:index             → string[]（runId一覧。新しい順に先頭追加）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { kv } from '@vercel/kv';
import type {
  MonitorAppearanceGetResponse,
  MonitorAppearancePostResponse,
  MonitorAppearanceRequest,
  MonitoringItem,
  MonitoringRun,
  MonitorProviderId,
} from './_monitor-types.js';

export const config = { maxDuration: 30 };

const RUNS_INDEX_KEY = 'monitor:appearance:runs:index';
const M1_SUPPORTED_PROVIDERS: MonitorProviderId[] = ['perplexity'];
const SNIPPET_MAX_LENGTH = 300;
const REFBASE_BASE = 'https://www.refbase.ai';

// ── 認可（既存Monitor APIと同一方針） ─────────────────────────────────────────
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

// ── RefBase からEntity名/URLを解決（読み取り専用） ────────────────────────────

interface RefBaseCompanyMinimal {
  id: string;
  name: string;
  canonicalName?: string;
}

async function resolveEntity(entityId: string): Promise<{ name: string; url: string } | null> {
  const company = await kv.get<RefBaseCompanyMinimal>(`refbase:company:${entityId}`);
  if (!company) return null;
  return {
    name: company.canonicalName || company.name,
    url: `${REFBASE_BASE}/entity/${entityId}`,
  };
}

// ── Provider呼び出し（Perplexity・キー未設定時は simulated） ──────────────────

async function callPerplexity(questionText: string): Promise<{ responseText: string; simulated: boolean; errorMessage?: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { responseText: '', simulated: true, errorMessage: 'PERPLEXITY_API_KEY 未設定のため simulated 実行' };
  }

  try {
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: questionText }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) {
      return { responseText: '', simulated: true, errorMessage: `Perplexity API error: HTTP ${resp.status}` };
    }
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    return { responseText: text, simulated: false };
  } catch (err) {
    return { responseText: '', simulated: true, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function executeAppearanceCheck(
  provider: MonitorProviderId,
  questionText: string,
): Promise<{ responseText: string; simulated: boolean; errorMessage?: string }> {
  // M1-3は'perplexity'のみ対応。将来Provider追加時はここに分岐を足す。
  if (provider === 'perplexity') return callPerplexity(questionText);
  return { responseText: '', simulated: true, errorMessage: `Provider "${provider}" は未対応` };
}

// ── POST: Appearance Monitoring実行 ───────────────────────────────────────────

async function handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: MonitorAppearanceRequest;
  try {
    body = JSON.parse(await readBody(req)) as MonitorAppearanceRequest;
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'JSON parse error' } satisfies MonitorAppearancePostResponse));
    return;
  }

  const { entityId, questionText, providers } = body;

  if (!entityId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'entityId is required' } satisfies MonitorAppearancePostResponse));
    return;
  }
  if (!questionText || !questionText.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'questionText is required' } satisfies MonitorAppearancePostResponse));
    return;
  }
  if (!Array.isArray(providers) || providers.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'providers is required' } satisfies MonitorAppearancePostResponse));
    return;
  }
  const unsupported = providers.filter(p => !M1_SUPPORTED_PROVIDERS.includes(p));
  if (unsupported.length > 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: `M1-3はProvider [${M1_SUPPORTED_PROVIDERS.join(', ')}] のみ対応しています（未対応: ${unsupported.join(', ')}）`,
    } satisfies MonitorAppearancePostResponse));
    return;
  }

  const entity = await resolveEntity(entityId);
  if (!entity) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: `entityId="${entityId}" が見つかりません` } satisfies MonitorAppearancePostResponse));
    return;
  }

  const runId = `MR-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const items: MonitoringItem[] = [];

  for (const provider of providers) {
    const result = await executeAppearanceCheck(provider, questionText);

    // 文字列包含判定のみ。意味評価・好意度評価は一切行わない。
    const appeared = !result.simulated && result.responseText.toLowerCase().includes(entity.name.toLowerCase());
    const citationFound = !result.simulated && result.responseText.includes(entity.url);

    items.push({
      itemId: `MI-${randomUUID()}`,
      runId,
      entityId,
      provider,
      appeared,
      citationFound,
      rawResponseSnippet: result.responseText ? result.responseText.slice(0, SNIPPET_MAX_LENGTH) : result.errorMessage,
      checkedAt: new Date().toISOString(),
      simulated: result.simulated,
    });
  }

  const completedAt = new Date().toISOString();
  const run: MonitoringRun = {
    runId,
    triggerType: 'manual',
    targetEntityIds: [entityId],
    providers,
    startedAt,
    completedAt,
    status: 'completed',
  };

  try {
    await kv.set(`monitor:appearance:run:${runId}`, run);
    await Promise.all(items.map(item => kv.set(`monitor:appearance:item:${runId}:${item.itemId}`, item)));
    await kv.set(`monitor:appearance:run:${runId}:items`, items.map(i => i.itemId));

    const index = (await kv.get<string[]>(RUNS_INDEX_KEY)) ?? [];
    await kv.set(RUNS_INDEX_KEY, [runId, ...index]);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, run, items } satisfies MonitorAppearancePostResponse));
  } catch (err) {
    console.error('[monitor-appearance POST]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies MonitorAppearancePostResponse));
  }
}

// ── GET: Monitoring履歴取得 ────────────────────────────────────────────────────

async function handleGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const runId = url.searchParams.get('runId');

  try {
    if (runId) {
      const run = await kv.get<MonitoringRun>(`monitor:appearance:run:${runId}`);
      if (!run) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `runId="${runId}" が見つかりません` } satisfies MonitorAppearanceGetResponse));
        return;
      }
      const itemIds = (await kv.get<string[]>(`monitor:appearance:run:${runId}:items`)) ?? [];
      const items = (await Promise.all(itemIds.map(id => kv.get<MonitoringItem>(`monitor:appearance:item:${runId}:${id}`))))
        .filter((i): i is MonitoringItem => i !== null && i !== undefined);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, run, items } satisfies MonitorAppearanceGetResponse));
      return;
    }

    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;
    const index = (await kv.get<string[]>(RUNS_INDEX_KEY)) ?? [];
    const targetIds = index.slice(0, limit);
    const runs = (await Promise.all(targetIds.map(id => kv.get<MonitoringRun>(`monitor:appearance:run:${id}`))))
      .filter((r): r is MonitoringRun => r !== null && r !== undefined);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, runs } satisfies MonitorAppearanceGetResponse));
  } catch (err) {
    console.error('[monitor-appearance GET]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies MonitorAppearanceGetResponse));
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
