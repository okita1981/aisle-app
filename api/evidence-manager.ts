/**
 * Evidence Manager API — Sprint 3.5C
 *
 * GET  /api/evidence-manager?slug={slug}
 *   → evidence:{slug} を返す（Read Only）
 *
 * PATCH /api/evidence-manager
 *   body: { slug, evidenceId, coverageType?, sourceClass?, supportedPromptTypes? }
 *   → 対象 EvidenceItem の 3フィールドのみ更新。他フィールドは一切変更しない。
 *
 * 安全条件:
 *   - Entity / Reference / QuestionTemplate / Registry は変更しない
 *   - Evidence 削除なし / 新規作成なし / AI 呼び出しなし
 *   - 更新対象: coverageType / sourceClass / supportedPromptTypes のみ
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
// 型は api 層内にインライン定義（tsconfig.api.json が src/ を含まないため）
type CoverageType = 'Identity' | 'Capability' | 'Differentiation' | 'Credibility' | 'UseCase';
type SourceClass =
  | 'Specification' | 'Announcement' | 'Documentation' | 'Research'
  | 'Presentation' | 'CaseStudy' | 'Benchmark' | 'Profile' | 'Interview' | 'Financial';

interface EvidenceItem {
  id: string;
  evidenceId?: string;
  type: string;
  title: string;
  description: string;
  entityRole: string;
  value?: string;
  tags?: string[];
  sourceUrl?: string;
  sourceType?: string;
  confidence?: string;
  coverageType?: CoverageType[];
  sourceClass?: SourceClass;
  supportedPromptTypes?: string[];
  needsVerification?: boolean;
  sourceVerified?: boolean;
  [key: string]: unknown;
}

export const config = { maxDuration: 15 };

// ── 認可 ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

// ── KV ヘルパー ──────────────────────────────────────────────────────────────

async function kvGet<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

// ── リクエストボディ読み込み ──────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk: Buffer) => { buf += chunk.toString(); });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

// ── PATCH ペイロード型 ───────────────────────────────────────────────────────

interface PatchPayload {
  slug: string;
  evidenceId: string;
  coverageType?: CoverageType[];
  sourceClass?: SourceClass | null;
  supportedPromptTypes?: string[];
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const slug = url.searchParams.get('slug')?.trim();
    if (!slug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'slug パラメータが必要です' }));
      return;
    }
    try {
      const items = await kvGet<EvidenceItem[]>(`evidence:${slug}`) ?? [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, slug, items }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let payload: PatchPayload;
    try {
      const body = await readBody(req);
      payload = JSON.parse(body) as PatchPayload;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'JSON parse error' }));
      return;
    }

    const { slug, evidenceId, coverageType, sourceClass, supportedPromptTypes } = payload;

    if (!slug || !evidenceId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'slug と evidenceId は必須です' }));
      return;
    }

    try {
      // 現在の Evidence 一覧を取得
      const items = await kvGet<EvidenceItem[]>(`evidence:${slug}`);
      if (!Array.isArray(items)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `evidence:${slug} が見つかりません` }));
        return;
      }

      // evidenceId で対象を特定（evidenceId フィールドまたは id フィールドで照合）
      const idx = items.findIndex(
        ev => ev.evidenceId === evidenceId || ev.id === evidenceId,
      );
      if (idx === -1) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `evidenceId="${evidenceId}" が見つかりません` }));
        return;
      }

      // 対象アイテムを shallow copy し、3フィールドのみ更新（他は一切変更しない）
      const original = items[idx];
      const updated: EvidenceItem = { ...original };

      if (coverageType !== undefined) {
        updated.coverageType = coverageType;
      }
      if (sourceClass !== undefined) {
        // null が来たら undefined に変換（フィールドを除去する意味）
        updated.sourceClass = sourceClass ?? undefined;
      }
      if (supportedPromptTypes !== undefined) {
        updated.supportedPromptTypes = supportedPromptTypes;
      }

      // 更新後の配列を KV に保存
      const newItems = [...items];
      newItems[idx] = updated;
      await kv.set(`evidence:${slug}`, JSON.stringify(newItems));

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, slug, evidenceId, updated }));
    } catch (err) {
      console.error('[evidence-manager PATCH]', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  res.statusCode = 405;
  res.end();
}
