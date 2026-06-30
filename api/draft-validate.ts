/**
 * /api/draft-validate — S3-2
 *
 * Authoring Workbench「Validate」ステップ本体（L6 Quality Audit 相当）。
 * Draft を受け取り、responseSchema sections 充足・citationRequired充足・
 * Coverage整合の3点を検証し、ValidatedDraft を返す。
 *
 * KV書き込み: なし。AI呼び出し: なし。Coverage Engine（L3）と同じ純粋関数方針。
 *
 * 既知の制約（TD-004）:
 *   現行 L5（draft-generate）は responseSchema 構造で生成しておらず、
 *   answer / evidencePoints / scope / differentiation / faq の固定フィールドのみを返す。
 *   そのため sectionId とフィールドの対応は完全ではなく、対応関係が定義されていない
 *   sectionId は「確認不能（warning）」として扱い、ok判定をブロックしない。
 *   responseSchema 準拠の構造化生成（L5リファクタ）は将来の別タスクとする。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  CoverageType,
  Draft,
  DraftValidateRequest,
  DraftValidateResponse,
  ResponseSchema,
  ValidateIssue,
  ValidatedDraft,
} from './_draft-types.js';

export const config = { maxDuration: 10 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── 認可（coverage-report.ts と同一方針） ───────────────────────────────────
function isAuthorized(req: IncomingMessage): boolean {
  const h = req.headers as Record<string, string | string[] | undefined>;
  if (h['x-aisle-admin'] === '1') return true;
  const em = process.env.EM_SHARED_SECRET;
  if (em && h['authorization'] === `Bearer ${em}`) return true;
  return false;
}

// ── sectionId → narrative フィールドの暫定マッピング（TD-004の暫定対応） ───
// 対応が定義されていない sectionId は「確認不能」として warning のみ発行する。

const SECTION_FIELD_MAP: Record<string, 'answer' | 'evidencePoints' | 'differentiation' | 'scope'> = {
  // Identity/要約系 → answer
  summary: 'answer',
  positioning: 'answer',
  recommendation: 'answer',
  problem: 'answer',
  primarySource: 'answer',
  // 根拠・特徴系 → evidencePoints
  capabilities: 'evidencePoints',
  evidence: 'evidencePoints',
  solution: 'evidencePoints',
  rationale: 'evidencePoints',
  supporting: 'evidencePoints',
  reliability: 'evidencePoints',
  // 違い・適用範囲系 → differentiation
  differentiators: 'differentiation',
  comparison: 'differentiation',
  bestFor: 'differentiation',
  context: 'differentiation',
  usecase: 'differentiation',
  usecases: 'differentiation',
};

function isFieldFilled(draft: Draft, field: 'answer' | 'evidencePoints' | 'differentiation' | 'scope'): boolean {
  const value = draft.narrative[field];
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
}

// ── L6: responseSchema sections 充足チェック（純粋関数） ────────────────────

function checkSchemaSections(
  draft: Draft,
  schema: ResponseSchema,
): { ok: boolean; requiredSections: string[]; missingSections: string[]; issues: ValidateIssue[] } {
  const issues: ValidateIssue[] = [];
  const requiredSections = schema.sections.filter(s => s.required).map(s => s.sectionId);
  const missingSections: string[] = [];

  for (const section of schema.sections.filter(s => s.required)) {
    const mapped = SECTION_FIELD_MAP[section.sectionId];
    if (!mapped) {
      issues.push({
        field: section.sectionId,
        severity: 'warning',
        message: `sectionId="${section.sectionId}" は narrative フィールドへの対応が未定義のため、内容充足を機械的に確認できません（TD-004）`,
      });
      continue;
    }
    if (!isFieldFilled(draft, mapped)) {
      missingSections.push(section.sectionId);
      issues.push({
        field: section.sectionId,
        severity: 'error',
        message: `required section "${section.label}"（${section.sectionId}）に対応する ${mapped} が空です`,
      });
    }
  }

  return { ok: missingSections.length === 0, requiredSections, missingSections, issues };
}

// ── L6: citationRequired 充足チェック（純粋関数） ───────────────────────────

function checkCitation(
  draft: Draft,
  schema: ResponseSchema,
): { required: boolean; ok: boolean; citationCount: number; issues: ValidateIssue[] } {
  const required = schema.citationRequired;
  const citationCount = draft.sourceEvidence.length;
  const ok = !required || citationCount > 0;
  const issues: ValidateIssue[] = [];
  if (!ok) {
    issues.push({
      field: 'citation',
      severity: 'error',
      message: `promptTypeId="${schema.promptTypeId}" は citationRequired=true ですが sourceEvidence が0件です`,
    });
  }
  return { required, ok, citationCount, issues };
}

// ── L6: Coverage整合の再確認（純粋関数） ────────────────────────────────────
// draft.sourceEvidence の coverageType[] が requiredCoverage を満たすかを再検証する。
// qi-resolve で既にUNLOCKED判定済みのはずだが、Draft生成までの間にEvidenceが
// 変わっていないかを Validate 時点でも防御的に再確認する。

function checkCoverageConsistency(
  draft: Draft,
  requiredCoverage: CoverageType[] | undefined,
): { ok: boolean; missingTypes: CoverageType[]; issues: ValidateIssue[] } {
  if (!requiredCoverage || requiredCoverage.length === 0) {
    return { ok: true, missingTypes: [], issues: [] };
  }
  const valid = new Set<string>(['Identity', 'Capability', 'Differentiation', 'Credibility', 'UseCase']);
  const coverageTypeSet = new Set<CoverageType>();
  for (const ev of draft.sourceEvidence) {
    if (!Array.isArray(ev.coverageType)) continue;
    for (const t of ev.coverageType) {
      if (typeof t === 'string' && valid.has(t)) coverageTypeSet.add(t as CoverageType);
    }
  }
  const missingTypes = requiredCoverage.filter(ct => !coverageTypeSet.has(ct));
  const ok = missingTypes.length === 0;
  const issues: ValidateIssue[] = ok ? [] : [{
    field: 'coverage',
    severity: 'error',
    message: `Draft の sourceEvidence では requiredCoverage を満たしません（不足: ${missingTypes.join(', ')}）`,
  }];
  return { ok, missingTypes, issues };
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  if (!isAuthorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' } satisfies DraftValidateResponse));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as DraftValidateRequest;
    const { draft, responseSchema, requiredCoverage } = body;

    if (!draft || !draft.draftId || !draft.narrative) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'draft is required' } satisfies DraftValidateResponse));
      return;
    }
    if (!responseSchema || !Array.isArray(responseSchema.sections)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'responseSchema is required' } satisfies DraftValidateResponse));
      return;
    }

    const schemaResult = checkSchemaSections(draft, responseSchema);
    const citationResult = checkCitation(draft, responseSchema);
    const coverageResult = checkCoverageConsistency(draft, requiredCoverage);

    const issues: ValidateIssue[] = [
      ...schemaResult.issues,
      ...citationResult.issues,
      ...coverageResult.issues,
    ];

    const ok = schemaResult.ok && citationResult.ok && coverageResult.ok;

    const validatedDraft: ValidatedDraft = {
      draftId: draft.draftId,
      validatedAt: new Date().toISOString(),
      schemaCheck: {
        ok: schemaResult.ok,
        requiredSections: schemaResult.requiredSections,
        missingSections: schemaResult.missingSections,
      },
      citationCheck: {
        required: citationResult.required,
        ok: citationResult.ok,
        citationCount: citationResult.citationCount,
      },
      coverageCheck: {
        ok: coverageResult.ok,
        missingTypes: coverageResult.missingTypes,
      },
      issues,
      ok,
    };

    // KV書き込みなし。AI呼び出しなし。
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, validatedDraft } satisfies DraftValidateResponse));
  } catch (err) {
    console.error('[draft-validate]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies DraftValidateResponse));
  }
}
