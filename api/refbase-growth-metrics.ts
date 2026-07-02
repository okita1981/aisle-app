/**
 * GET /api/refbase-growth-metrics — RefBase Growth Dashboard 集計API（Read Only）
 *
 * 既存KV（refbase:index:all / refbase:company:* / refbase:index:* / refbase:ref:* / evidence:*）
 * を都度集計して返す。新規KV・永続テーブルは作らない。
 *
 * Cluster数・Relationship数は正式なRegistry（refbase:cluster:* / refbase:relationship:*）が
 * 未実装のため、以下の近似値で代替する（レスポンスに注記フラグを含める）:
 *   - clusterCount: Entity の primaryCluster ユニーク数（近似）
 *   - relationshipCount: null（未実装）。参考値として parentEntity 設定済み Entity 数を返す
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

export const config = { maxDuration: 30 };

const EM_SECRET = process.env.EM_SHARED_SECRET;

function isAuthorized(req: IncomingMessage): boolean {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  if (headers['x-aisle-admin'] === '1') return true;
  if (EM_SECRET && headers['authorization'] === `Bearer ${EM_SECRET}`) return true;
  return false;
}

interface CompanyRecord {
  id: string;
  entityType?: string;
  primaryCluster?: string;
  parentEntity?: string | null;
  verificationStatus?: 'draft' | 'verified' | 'featured';
  [key: string]: unknown;
}

interface ReferenceRecord {
  promptTypeId?: string;
  [key: string]: unknown;
}

interface EvidenceRecord {
  evidenceId?: string;
  needsVerification?: boolean;
  sourceVerified?: boolean;
  coverageType?: string[];
  [key: string]: unknown;
}

const ENTITY_TYPES = ['company', 'product', 'service', 'person', 'concept', 'other'] as const;
const PROMPT_TYPE_IDS = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'];

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    const allSlugs = (await kv.get<string[]>('refbase:index:all')) ?? [];

    const companies = await Promise.all(
      allSlugs.map(slug => kv.get<CompanyRecord>(`refbase:company:${slug}`)),
    );
    const indices = await Promise.all(
      allSlugs.map(slug => kv.get<string[]>(`refbase:index:${slug}`)),
    );
    const evidenceLists = await Promise.all(
      allSlugs.map(slug => kv.get<EvidenceRecord[]>(`evidence:${slug}`)),
    );

    // Reference 本体は Entity 数 × 平均 Reference 数ぶん逐次取得が必要になるため、
    // 全 (slug, questionSlug) ペアをまとめて並列取得する。
    const refKeys: { slug: string; qslug: string }[] = [];
    allSlugs.forEach((slug, i) => {
      for (const qslug of indices[i] ?? []) refKeys.push({ slug, qslug });
    });
    const refRecords = await Promise.all(
      refKeys.map(({ slug, qslug }) => kv.get<ReferenceRecord>(`refbase:ref:${slug}/${qslug}`)),
    );

    // ── Summary ──────────────────────────────────────────────
    const entityCount = allSlugs.length;
    const referenceCount = refKeys.length;
    const evidenceCount = evidenceLists.reduce((sum, list) => sum + (list?.length ?? 0), 0);

    const clusterSet = new Set(companies.map(c => c?.primaryCluster).filter(Boolean));
    const clusterCount = clusterSet.size;

    const parentEntityCount = companies.filter(c => c?.parentEntity).length;

    // ── Verification Status ──────────────────────────────────
    const verificationStatusCounts: Record<string, number> = { draft: 0, verified: 0, featured: 0, unset: 0 };
    for (const c of companies) {
      const status = c?.verificationStatus;
      if (status === 'draft' || status === 'verified' || status === 'featured') {
        verificationStatusCounts[status]++;
      } else {
        verificationStatusCounts.unset++;
      }
    }
    const statusKnownTotal = verificationStatusCounts.draft + verificationStatusCounts.verified + verificationStatusCounts.featured;
    const verifiedRate = statusKnownTotal > 0
      ? Math.round(((verificationStatusCounts.verified + verificationStatusCounts.featured) / statusKnownTotal) * 1000) / 10
      : null;
    const draftRate = statusKnownTotal > 0
      ? Math.round((verificationStatusCounts.draft / statusKnownTotal) * 1000) / 10
      : null;

    // ── EntityType別 ──────────────────────────────────────────
    const entityTypeCounts: Record<string, number> = Object.fromEntries(ENTITY_TYPES.map(t => [t, 0]));
    for (const c of companies) {
      const t = c?.entityType && (ENTITY_TYPES as readonly string[]).includes(c.entityType) ? c.entityType : 'other';
      entityTypeCounts[t] = (entityTypeCounts[t] ?? 0) + 1;
    }

    // ── Cluster別Entity数 ─────────────────────────────────────
    const clusterEntityCounts: Record<string, number> = {};
    for (const c of companies) {
      const cluster = c?.primaryCluster ?? '(未設定)';
      clusterEntityCounts[cluster] = (clusterEntityCounts[cluster] ?? 0) + 1;
    }

    // ── P-ID別Reference数 ─────────────────────────────────────
    const pidCounts: Record<string, number> = Object.fromEntries(PROMPT_TYPE_IDS.map(p => [p, 0]));
    for (const ref of refRecords) {
      const pid = ref?.promptTypeId;
      if (pid && pid in pidCounts) pidCounts[pid]++;
    }

    // ── Backlog: draft Entity一覧 ──────────────────────────────
    const draftEntities = allSlugs
      .map((slug, i) => ({ slug, company: companies[i] }))
      .filter(({ company }) => company?.verificationStatus === 'draft')
      .map(({ slug, company }) => ({ slug, entityType: company?.entityType, primaryCluster: company?.primaryCluster }));

    // ── Backlog: 未検証Evidence一覧 ───────────────────────────
    const unverifiedEvidence: { slug: string; evidenceId?: string; needsVerification?: boolean; sourceVerified?: boolean }[] = [];
    allSlugs.forEach((slug, i) => {
      for (const ev of evidenceLists[i] ?? []) {
        if (ev.needsVerification === true || ev.sourceVerified !== true) {
          unverifiedEvidence.push({ slug, evidenceId: ev.evidenceId, needsVerification: ev.needsVerification, sourceVerified: ev.sourceVerified });
        }
      }
    });

    // ── Backlog: Credibility Evidence不足Entity一覧 ───────────
    const credibilityGapEntities: string[] = [];
    allSlugs.forEach((slug, i) => {
      const hasVerifiedCredibility = (evidenceLists[i] ?? []).some(
        ev => (ev.coverageType ?? []).includes('Credibility') && ev.needsVerification !== true && ev.sourceVerified === true,
      );
      if (!hasVerifiedCredibility) credibilityGapEntities.push(slug);
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        entityCount,
        referenceCount,
        evidenceCount,
        clusterCount,
        clusterCountNote: 'Cluster Registry未実装のため、EntityのprimaryClusterから算出（近似値）',
        relationshipCount: null,
        relationshipCountNote: 'Relationship Registry未実装',
        parentEntitySetCount: parentEntityCount,
        verifiedRate,
        draftRate,
      },
      verificationStatus: verificationStatusCounts,
      coverage: {
        byEntityType: entityTypeCounts,
        byCluster: clusterEntityCounts,
        byPromptTypeId: pidCounts,
      },
      backlog: {
        draftEntities,
        unverifiedEvidence,
        credibilityGapEntities,
      },
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
