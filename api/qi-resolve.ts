/**
 * /api/qi-resolve — S3-1
 *
 * Authoring Workbench「Generate」ステップの前段。
 * Coverage Gate（L3/L4）+ Question Instance 解決（L2）のみを行う。
 *
 * KV書き込み: refbase:qi:{clientSlug}:{promptTypeId} のみ。
 * Reference / Draft / page:question / page-question-index 等は一切書き込まない。
 * AI呼び出し: なし。
 *
 * page-generate.ts の add モード内に混在していた Coverage Gate / QI解決ロジックを
 * 独立 API として切り出したもの（ロジック自体は同一。インライン実装方針も踏襲）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type {
  CoverageGateResult,
  CoverageGateSkipped,
  CoverageType,
  EvidenceItemInput,
  QIResolveRequest,
  QIResolveResponse,
  QuestionInstance,
  QuestionTemplate,
} from './_draft-types.js';

export const config = { maxDuration: 30 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── 認可（coverage-report.ts と同一方針） ───────────────────────────────────
function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

// ── L4: Evidence から coverageType の集合を収集する（純粋関数） ─────────────
function collectCoverageTypeSet(evidence: EvidenceItemInput[]): Set<CoverageType> {
  const set = new Set<CoverageType>();
  const valid = new Set<string>(['Identity', 'Capability', 'Differentiation', 'Credibility', 'UseCase']);
  for (const ev of evidence) {
    if (!Array.isArray(ev.coverageType)) continue;
    for (const t of ev.coverageType) {
      if (typeof t === 'string' && valid.has(t)) set.add(t as CoverageType);
    }
  }
  return set;
}

// ── L3: requiredCoverage ⊆ coverageTypeSet を判定する純粋関数 ──────────────
function checkCoverage(
  requiredCoverage: CoverageType[],
  coverageTypeSet: Set<CoverageType>,
  promptTypeId: string,
): CoverageGateResult {
  const missingTypes = requiredCoverage.filter(ct => !coverageTypeSet.has(ct));
  const coveredCount = requiredCoverage.length - missingTypes.length;
  const coverageScore = requiredCoverage.length === 0 ? 1.0 : coveredCount / requiredCoverage.length;
  return {
    promptTypeId,
    status: missingTypes.length === 0 ? 'UNLOCKED' : 'LOCKED',
    missingTypes,
    coverageScore,
  };
}

// ── L2: QuestionInstance 解決（純粋関数） ───────────────────────────────────

interface EntityMinimal {
  id: string;
  canonicalName: string;
  primaryCluster?: string;
  entityType?: string;
}

/** src/lib/questionResolver.ts の CLUSTER_LABEL_MAP と同期して維持する */
const QI_CLUSTER_LABEL_MAP: Record<string, string> = {
  'ai-assistant':        'AIアシスタント',
  'ai-coding':           'AIコーディング',
  'ai-company':          'AI企業・研究機関',
  'ai-leaders':          'AIリーダー',
  'creative-design':     'クリエイティブ・デザイン',
  'marketing-crm':       'マーケティング・CRM',
  'entertainment-media': 'エンタメ・メディア',
  'sports-people':       'スポーツ・人物',
  'e-commerce':          'Eコマース',
  'platform-business':   'プラットフォームビジネス',
  'ai-emergence':        'AI出現設計',
  'ai-image-generation': 'AI画像生成',
};

function resolveClusterLabelForQI(slug: string): string {
  if (!slug) return '同分野';
  return QI_CLUSTER_LABEL_MAP[slug]
    ?? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const QI_SLOT_PATTERN = /\{([^}]+)\}/g;

function resolveQITemplateText(
  templateText: string,
  entity: EntityMinimal,
): { resolvedText: string; unresolvedSlots: string[] } {
  const entityName = entity.canonicalName || entity.id;
  const clusterLabel = entity.primaryCluster
    ? resolveClusterLabelForQI(entity.primaryCluster)
    : entity.entityType === 'person' ? '人物' : '同分野';

  const slotMap: Record<string, string> = { entityName, clusterLabel };
  const unresolvedSlots: string[] = [];

  const resolvedText = templateText.replace(QI_SLOT_PATTERN, (_, name: string) => {
    if (name in slotMap) return slotMap[name];
    unresolvedSlots.push(name);
    return `{${name}}`;
  });

  return { resolvedText, unresolvedSlots };
}

function buildQIInstanceId(entityId: string, promptTypeId: string): string {
  const pid = promptTypeId.replace('-', ''); // "P-01" → "P01"
  return `QIN-${entityId}-${pid}-001`;
}

function resolveQuestionInstance(
  entity: EntityMinimal,
  template: { templateId: string; promptTypeId: string; templateText: string },
  createdAt: string,
): QuestionInstance {
  const { resolvedText, unresolvedSlots } = resolveQITemplateText(template.templateText, entity);
  return {
    instanceId: buildQIInstanceId(entity.id, template.promptTypeId),
    templateId: template.templateId,
    entityId: entity.id,
    promptTypeId: template.promptTypeId,
    resolvedText,
    unresolvedSlots,
    createdAt,
  };
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies QIResolveResponse));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as QIResolveRequest;
    const { clientSlug, companyName, perPID, targetPromptTypeIds, adoptedEvidence: requestEvidence } = body;

    if (!clientSlug || !SLUG_PATTERN.test(clientSlug)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid clientSlug' } satisfies QIResolveResponse));
      return;
    }
    if (!Array.isArray(targetPromptTypeIds) || targetPromptTypeIds.length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'targetPromptTypeIds is required' } satisfies QIResolveResponse));
      return;
    }

    const now = new Date().toISOString();

    interface EntityKVFull {
      id: string;
      name?: string;
      canonicalName?: string;
      primaryCluster?: string;
      entityType?: string;
    }

    const [templateReg, entityKVRaw, evidenceFromKV] = await Promise.all([
      kv.get<{ items: QuestionTemplate[] }>('refbase:registry:questionTemplates'),
      kv.get<EntityKVFull>(`refbase:company:${clientSlug}`),
      kv.get<EvidenceItemInput[]>(`evidence:${clientSlug}`),
    ]);

    const adoptedEvidence: EvidenceItemInput[] =
      (requestEvidence && requestEvidence.length > 0) ? requestEvidence : (evidenceFromKV ?? []);

    const questionTemplates: QuestionTemplate[] = templateReg?.items ?? [];
    const templateRegistryAvailable = questionTemplates.length > 0;

    const entityForResolver: EntityMinimal = {
      id: clientSlug,
      canonicalName: entityKVRaw?.canonicalName ?? entityKVRaw?.name ?? companyName ?? clientSlug,
      primaryCluster: entityKVRaw?.primaryCluster,
      entityType: entityKVRaw?.entityType,
    };

    const coverageTypeSet = collectCoverageTypeSet(adoptedEvidence);

    const instances: QuestionInstance[] = [];
    const coverageGateResults: CoverageGateResult[] = [];
    const skipped: CoverageGateSkipped[] = [];

    if (!templateRegistryAvailable) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: false,
        error: 'QuestionTemplate Registry が取得できません',
        instances: [],
        coverageGate: { registryAvailable: false, results: [], skipped: [] },
      } satisfies QIResolveResponse));
      return;
    }

    for (const baseId of targetPromptTypeIds) {
      const template = questionTemplates.find(t => t.promptTypeId === baseId);
      if (!template) continue;

      if (template.requiredCoverage.length > 0) {
        const gate = checkCoverage(template.requiredCoverage, coverageTypeSet, baseId);
        coverageGateResults.push(gate);
        if (gate.status === 'LOCKED') {
          skipped.push({ promptTypeId: baseId, missingTypes: gate.missingTypes });
          continue;
        }
      }

      if (!template.templateText) {
        skipped.push({ promptTypeId: baseId, missingTypes: [] });
        continue;
      }

      const qi = resolveQuestionInstance(
        entityForResolver,
        { templateId: template.templateId, promptTypeId: template.promptTypeId, templateText: template.templateText },
        now,
      );

      // QIのみKV保存。Reference/Draft/page系のKVには一切書き込まない。
      await kv.set(`refbase:qi:${clientSlug}:${baseId}`, { ...qi, updatedAt: now });

      instances.push(qi);
    }

    // perPID は将来的な promptText 突合・promptTypeLabel 補完に使う想定だが、
    // S3-1時点では QuestionTemplate の templateText を正本として解決するため未使用。
    void perPID;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      instances,
      coverageGate: {
        registryAvailable: templateRegistryAvailable,
        results: coverageGateResults,
        skipped,
      },
    } satisfies QIResolveResponse));
  } catch (err) {
    console.error('[qi-resolve]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: String(err),
      instances: [],
      coverageGate: { registryAvailable: false, results: [], skipped: [] },
    } satisfies QIResolveResponse));
  }
}
