/**
 * Relationship Manager API — S5 (M-05)
 *
 * GET  /api/relationship-manager?entity={slug}
 *   → 指定 Entity が sourceEntity / targetEntity のいずれかである Relationship を返す
 *
 * POST /api/relationship-manager
 *   body: { action: 'create', sourceEntity, targetEntity, relationshipType, description, confidence? }
 *     → relationshipId を Write 直前に Registry を再取得して採番（同時実行対策）
 *   body: { action: 'update', relationshipId, description?, confidence?, status? }
 *     → sourceEntity/targetEntity/relationshipType/direction は変更不可
 *   body: { action: 'delete', relationshipId }
 *     → 物理削除ではなく status: 'DEPRECATED' へ変更する
 *
 * 対象 relationshipType: parentEntity / productOf / competitorOf / alternativeTo の4種のみ。
 * memberOfCluster は対象外（primaryCluster/secondaryClusters との二重管理を避けるため）。
 * R-01〜R-22 のうち未実装17種も対象外（RefBase 側の表示ロジックが追いついていない）。
 *
 * 安全条件:
 *   - Entity / Reference / Evidence / QuestionTemplate / Cluster Registry は変更しない
 *   - 自己参照（sourceEntity === targetEntity）は拒否
 *   - 存在しない Entity への参照は拒否
 *   - AI 呼び出しなし
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

export const config = { maxDuration: 15 };

// ── 型定義（api 層内にインライン定義。tsconfig.api.json が src/ を含まないため） ─

type RelationshipType = 'parentEntity' | 'productOf' | 'competitorOf' | 'alternativeTo';
type Direction = 'directed' | 'bidirectional';
type Confidence = 'high' | 'medium' | 'low';
type RelationshipStatus = 'ACTIVE' | 'DEPRECATED' | 'DRAFT';

interface RelationshipItem {
  relationshipId: string;
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string;
  direction: Direction;
  description: string;
  confidence: Confidence;
  source: string;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

interface RelationshipRegistryEnvelope {
  registryId: string;
  version: string;
  status: string;
  description: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  items: RelationshipItem[];
}

const REGISTRY_KEY = 'refbase:registry:relationships';

// 4種のみ許可。direction はここから自動決定する（ユーザーに選択させない）。
const ALLOWED_TYPES: Record<RelationshipType, Direction> = {
  parentEntity: 'directed',
  productOf: 'directed',
  competitorOf: 'bidirectional',
  alternativeTo: 'bidirectional',
};

function isAllowedType(t: string): t is RelationshipType {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, t);
}

// ── 認可（既存4 APIと同一方針） ──────────────────────────────────────────────

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

async function entityExists(slug: string): Promise<boolean> {
  const entity = await kv.get(`refbase:company:${slug}`);
  return entity !== null && entity !== undefined;
}

function nextRelationshipId(items: RelationshipItem[]): string {
  let maxSeq = 0;
  for (const item of items) {
    const m = item.relationshipId.match(/^REL-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  return `REL-${String(maxSeq + 1).padStart(3, '0')}`;
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

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const entity = url.searchParams.get('entity')?.trim();
    if (!entity) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'entity パラメータが必要です' }));
      return;
    }
    try {
      const registry = await kv.get<RelationshipRegistryEnvelope>(REGISTRY_KEY);
      const items = (registry?.items ?? []).filter(
        r => r.sourceEntity === entity || r.targetEntity === entity,
      );
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, entity, items }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  // ── POST（create / update / delete） ─────────────────────────────────────
  if (req.method === 'POST') {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(await readBody(req)) as Record<string, unknown>;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'JSON parse error' }));
      return;
    }

    const action = payload.action;

    // ── create ─────────────────────────────────────────────────────────────
    if (action === 'create') {
      const sourceEntity = String(payload.sourceEntity ?? '').trim();
      const targetEntity = String(payload.targetEntity ?? '').trim();
      const relationshipType = String(payload.relationshipType ?? '').trim();
      const description = String(payload.description ?? '').trim();
      const confidence = (payload.confidence as Confidence | undefined) ?? 'high';

      if (!sourceEntity || !targetEntity || !relationshipType || !description) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'sourceEntity / targetEntity / relationshipType / description は必須です' }));
        return;
      }

      // ガード: memberOfCluster・未対応typeを拒否
      if (!isAllowedType(relationshipType)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: `relationshipType="${relationshipType}" は対象外です（parentEntity / productOf / competitorOf / alternativeTo のみ許可）` }));
        return;
      }

      // ガード: 自己参照を拒否
      if (sourceEntity === targetEntity) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'sourceEntity と targetEntity が同一です（自己参照は許可されません）' }));
        return;
      }

      // ガード: 存在しないEntityを拒否
      const [sourceOk, targetOk] = await Promise.all([entityExists(sourceEntity), entityExists(targetEntity)]);
      if (!sourceOk || !targetOk) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: false,
          error: `存在しないEntityが指定されました（sourceEntity=${sourceOk ? 'OK' : 'NOT FOUND'} / targetEntity=${targetOk ? 'OK' : 'NOT FOUND'}）`,
        }));
        return;
      }

      const direction = ALLOWED_TYPES[relationshipType];

      try {
        // Write直前にRegistryを再取得し、最大値を再確認してから採番する（同時実行対策）
        const registry = await kv.get<RelationshipRegistryEnvelope>(REGISTRY_KEY);
        const items = registry?.items ?? [];
        const relationshipId = nextRelationshipId(items);
        const now = new Date().toISOString();

        const newItem: RelationshipItem = {
          relationshipId,
          sourceEntity,
          targetEntity,
          relationshipType,
          direction,
          description,
          confidence,
          source: 'manual',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };

        const updatedEnvelope: RelationshipRegistryEnvelope = registry
          ? { ...registry, items: [...items, newItem], updatedAt: now }
          : {
              registryId: 'relationships',
              version: '1.0',
              status: 'ACTIVE',
              description: 'RefBase Knowledge Graph — Relationship 定義。',
              owner: 'Aisle Studio Architecture',
              createdAt: now,
              updatedAt: now,
              items: [newItem],
            };

        await kv.set(REGISTRY_KEY, updatedEnvelope);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, relationship: newItem }));
      } catch (err) {
        console.error('[relationship-manager create]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
      return;
    }

    // ── update ─────────────────────────────────────────────────────────────
    if (action === 'update') {
      const relationshipId = String(payload.relationshipId ?? '').trim();
      if (!relationshipId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'relationshipId は必須です' }));
        return;
      }

      try {
        const registry = await kv.get<RelationshipRegistryEnvelope>(REGISTRY_KEY);
        const items = registry?.items ?? [];
        const idx = items.findIndex(r => r.relationshipId === relationshipId);
        if (idx === -1) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: `relationshipId="${relationshipId}" が見つかりません` }));
          return;
        }

        // sourceEntity/targetEntity/relationshipType/direction は変更不可。3フィールドのみ更新可能。
        const original = items[idx];
        const updated: RelationshipItem = { ...original, updatedAt: new Date().toISOString() };
        if (typeof payload.description === 'string') updated.description = payload.description;
        if (typeof payload.confidence === 'string') updated.confidence = payload.confidence as Confidence;
        if (typeof payload.status === 'string') updated.status = payload.status as RelationshipStatus;

        const newItems = [...items];
        newItems[idx] = updated;
        await kv.set(REGISTRY_KEY, { ...registry, items: newItems, updatedAt: new Date().toISOString() });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, relationship: updated }));
      } catch (err) {
        console.error('[relationship-manager update]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
      return;
    }

    // ── delete（物理削除ではなく DEPRECATED 化） ──────────────────────────────
    if (action === 'delete') {
      const relationshipId = String(payload.relationshipId ?? '').trim();
      if (!relationshipId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'relationshipId は必須です' }));
        return;
      }

      try {
        const registry = await kv.get<RelationshipRegistryEnvelope>(REGISTRY_KEY);
        const items = registry?.items ?? [];
        const idx = items.findIndex(r => r.relationshipId === relationshipId);
        if (idx === -1) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: `relationshipId="${relationshipId}" が見つかりません` }));
          return;
        }

        const now = new Date().toISOString();
        const updated: RelationshipItem = { ...items[idx], status: 'DEPRECATED', updatedAt: now };
        const newItems = [...items];
        newItems[idx] = updated;
        await kv.set(REGISTRY_KEY, { ...registry, items: newItems, updatedAt: now });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, relationship: updated }));
      } catch (err) {
        console.error('[relationship-manager delete]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
      return;
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: `不明な action="${String(action)}"` }));
    return;
  }

  res.statusCode = 405;
  res.end();
}
