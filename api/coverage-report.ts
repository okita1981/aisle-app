/**
 * Coverage Report API — Sprint 3.5B
 *
 * GET /api/coverage-report          → 全 Entity の Coverage 判定結果
 * GET /api/coverage-report?slug=x   → 単一 Entity の Coverage 判定結果
 *
 * KV 書き込み: ゼロ / AI 呼び出し: ゼロ
 * Coverage Engine ロジックをインライン実装（tsconfig.api.json が src/ を含まないため）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

export const config = { maxDuration: 30 };

// ── インライン型定義（src/types/index.ts のサブセット）──────────────────────

type CoverageType = 'Identity' | 'Capability' | 'Differentiation' | 'Credibility' | 'UseCase';

interface EvidenceItem {
  id: string;
  evidenceId?: string;
  coverageType?: CoverageType[];
  [key: string]: unknown;
}

interface QuestionTemplate {
  templateId: string;
  promptTypeId: string;
  requiredCoverage: CoverageType[];
  [key: string]: unknown;
}

interface RegistryEnvelope<T> {
  items: T[];
  [key: string]: unknown;
}

// ── インライン Coverage Engine（純粋関数）────────────────────────────────────

interface TemplateCheckResult {
  templateId: string;
  promptTypeId: string;
  status: 'UNLOCKED' | 'LOCKED';
  ok: boolean;
  coveredTypes: CoverageType[];
  missingTypes: CoverageType[];
  coverageScore: number;
}

interface EntityCoverageReport {
  entityId: string;
  unlockedTemplates: TemplateCheckResult[];
  lockedTemplates: TemplateCheckResult[];
  coverageSummary: {
    coveredTypes: CoverageType[];
    totalEvidence: number;
    labelledEvidence: number;
  };
}

function collectCoverageTypeSet(evidenceList: EvidenceItem[]): Set<CoverageType> {
  const set = new Set<CoverageType>();
  for (const ev of evidenceList) {
    if (Array.isArray(ev.coverageType)) {
      for (const ct of ev.coverageType) set.add(ct);
    }
  }
  return set;
}

function checkTemplateCoverage(
  template: QuestionTemplate,
  coverageTypeSet: Set<CoverageType>,
): TemplateCheckResult {
  const required = template.requiredCoverage;
  const coveredTypes = required.filter(ct => coverageTypeSet.has(ct));
  const missingTypes = required.filter(ct => !coverageTypeSet.has(ct));
  const coverageScore = required.length === 0 ? 1.0 : coveredTypes.length / required.length;
  const ok = missingTypes.length === 0;
  return {
    templateId: template.templateId,
    promptTypeId: template.promptTypeId,
    ok,
    coveredTypes,
    missingTypes,
    coverageScore,
    status: ok ? 'UNLOCKED' : 'LOCKED',
  };
}

function buildEntityCoverageReport(
  entityId: string,
  evidenceList: EvidenceItem[],
  templates: QuestionTemplate[],
): EntityCoverageReport {
  const typeSet = collectCoverageTypeSet(evidenceList);
  const labelled = evidenceList.filter(ev => Array.isArray(ev.coverageType) && ev.coverageType.length > 0).length;
  const results = templates.map(t => checkTemplateCoverage(t, typeSet));
  return {
    entityId,
    unlockedTemplates: results.filter(r => r.status === 'UNLOCKED'),
    lockedTemplates: results.filter(r => r.status === 'LOCKED'),
    coverageSummary: {
      coveredTypes: [...typeSet],
      totalEvidence: evidenceList.length,
      labelledEvidence: labelled,
    },
  };
}

// ── 認可 ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

async function kvGet<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

// ── Coverage Panel レスポンス型 ──────────────────────────────────────────────

interface EntityMeta {
  canonicalName?: string;
  displayName?: string;
  officialName?: string;
  name?: string;
  entityType?: string;
  primaryCluster?: string;
  [key: string]: unknown;
}

export interface EntityCoverageSummaryRow {
  entityId: string;
  entityName: string;
  entityType: string;
  primaryCluster: string;
  evidenceCount: number;
  labelledEvidenceCount: number;
  coveredTypes: CoverageType[];
  missingTypes: CoverageType[];
  unlockedCount: number;
  lockedCount: number;
  templateCount: number;
  unlockedTemplates: Array<{ templateId: string; promptTypeId: string; coverageScore: number }>;
  lockedTemplates: Array<{ templateId: string; promptTypeId: string; missingTypes: CoverageType[]; coverageScore: number }>;
}

async function buildCoverageRow(
  slug: string,
  templates: QuestionTemplate[],
): Promise<EntityCoverageSummaryRow> {
  const [entityRaw, evidenceRaw] = await Promise.all([
    kvGet<EntityMeta>(`refbase:company:${slug}`),
    kvGet<EvidenceItem[]>(`evidence:${slug}`),
  ]);
  const entity = entityRaw ?? {};
  const evidenceList = Array.isArray(evidenceRaw) ? evidenceRaw : [];
  const entityName =
    entity.canonicalName ?? entity.displayName ?? entity.officialName ?? entity.name ?? slug;

  const report = buildEntityCoverageReport(slug, evidenceList, templates);

  const allMissing = new Set<CoverageType>();
  for (const t of report.lockedTemplates) {
    for (const m of t.missingTypes) allMissing.add(m);
  }

  return {
    entityId: slug,
    entityName: typeof entityName === 'string' ? entityName : slug,
    entityType: typeof entity.entityType === 'string' ? entity.entityType : 'unknown',
    primaryCluster: typeof entity.primaryCluster === 'string' ? entity.primaryCluster : '',
    evidenceCount: report.coverageSummary.totalEvidence,
    labelledEvidenceCount: report.coverageSummary.labelledEvidence,
    coveredTypes: report.coverageSummary.coveredTypes,
    missingTypes: [...allMissing],
    unlockedCount: report.unlockedTemplates.length,
    lockedCount: report.lockedTemplates.length,
    templateCount: templates.length,
    unlockedTemplates: report.unlockedTemplates.map(t => ({
      templateId: t.templateId,
      promptTypeId: t.promptTypeId,
      coverageScore: t.coverageScore,
    })),
    lockedTemplates: report.lockedTemplates.map(t => ({
      templateId: t.templateId,
      promptTypeId: t.promptTypeId,
      missingTypes: t.missingTypes,
      coverageScore: t.coverageScore,
    })),
  };
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const singleSlug = url.searchParams.get('slug');

    const templateReg = await kvGet<RegistryEnvelope<QuestionTemplate>>('refbase:registry:questionTemplates');
    const templates: QuestionTemplate[] = (templateReg?.items ?? []) as QuestionTemplate[];

    if (templates.length === 0) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'QuestionTemplate Registry が取得できません' }));
      return;
    }

    if (singleSlug) {
      const row = await buildCoverageRow(singleSlug, templates);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, entity: row, templateCount: templates.length }));
      return;
    }

    const allSlugs = (await kvGet<string[]>('refbase:index:all')) ?? [];
    if (allSlugs.length === 0) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Entity 一覧が取得できません' }));
      return;
    }

    const rows: EntityCoverageSummaryRow[] = [];
    const BATCH = 6;
    for (let i = 0; i < allSlugs.length; i += BATCH) {
      const batch = allSlugs.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(slug => buildCoverageRow(slug, templates)));
      rows.push(...results);
    }

    rows.sort((a, b) =>
      b.unlockedCount - a.unlockedCount || a.entityId.localeCompare(b.entityId),
    );

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, entities: rows, templateCount: templates.length, entityCount: rows.length }));
  } catch (err) {
    console.error('[coverage-report]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
