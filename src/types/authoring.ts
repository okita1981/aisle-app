/**
 * Authoring Workbench（S4）専用の型定義。
 *
 * api/_draft-types.ts と同形だが、tsconfig.app.json が api/ を含まないため
 * （include: ["src"]）、page-generate.ts と同じ方針でフロント側にも複製する。
 *
 * ライフサイクル: Question Instance → Draft → Validated Draft → Reference → Publish
 */

import type { CoverageType, EvidenceItem, ResponseSchema } from './index.js';

export type { CoverageType, ResponseSchema };

// ── Question Instance ───────────────────────────────────────────────────────

export interface AuthoringQuestionInstance {
  instanceId: string;
  templateId: string;
  entityId: string;
  promptTypeId: string;
  resolvedText: string;
  unresolvedSlots: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CoverageGateResult {
  promptTypeId: string;
  status: 'UNLOCKED' | 'LOCKED';
  missingTypes: CoverageType[];
  coverageScore: number;
}

export interface CoverageGateSkipped {
  promptTypeId: string;
  missingTypes: CoverageType[];
}

// ── Draft ────────────────────────────────────────────────────────────────────

export interface ChildPageNarrative {
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
}

export interface Draft {
  draftId: string;
  instanceId: string;
  clientSlug: string;
  promptTypeId: string;
  promptText: string;
  generator: {
    model: string;
    generatedAt: string;
    attemptNumber: number;
  };
  narrative: ChildPageNarrative;
  sourceEvidence: EvidenceItem[];
}

// ── Validated Draft ──────────────────────────────────────────────────────────

export interface ValidateIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidatedDraft {
  draftId: string;
  validatedAt: string;
  schemaCheck: {
    ok: boolean;
    requiredSections: string[];
    missingSections: string[];
  };
  citationCheck: {
    required: boolean;
    ok: boolean;
    citationCount: number;
  };
  coverageCheck: {
    ok: boolean;
    missingTypes: CoverageType[];
  };
  issues: ValidateIssue[];
  ok: boolean;
}

// ── Reference ────────────────────────────────────────────────────────────────

export interface AuthoringReference {
  id: string;
  companyId: string;
  questionId: string;
  instanceId: string;
  draftId: string;
  promptText: string;
  promptTypeId: string;
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
  pageUrl: string;
  sourceEvidence: EvidenceItem[];
  generatedAt: string;
}

// ── API request/response ─────────────────────────────────────────────────────

export interface QIResolveRequest {
  clientSlug: string;
  companyName?: string;
  perPID: Array<{ promptTypeId: string; promptText: string }>;
  targetPromptTypeIds: string[];
  adoptedEvidence?: EvidenceItem[];
}

export interface QIResolveResponse {
  ok: boolean;
  instances?: AuthoringQuestionInstance[];
  coverageGate?: {
    registryAvailable: boolean;
    results: CoverageGateResult[];
    skipped: CoverageGateSkipped[];
  };
  error?: string;
}

export interface DraftGenerateRequest {
  instanceId: string;
  clientSlug: string;
  companyName: string;
  productCategory: string;
  promptTypeId: string;
  promptText: string;
  adoptedEvidence?: EvidenceItem[];
  model?: string;
  attemptNumber?: number;
}

export interface DraftGenerateResponse {
  ok: boolean;
  draft?: Draft;
  error?: string;
}

export interface DraftValidateRequest {
  draft: Draft;
  responseSchema: ResponseSchema;
  requiredCoverage?: CoverageType[];
}

export interface DraftValidateResponse {
  ok: boolean;
  validatedDraft?: ValidatedDraft;
  error?: string;
}

export interface DraftPublishRequest {
  draft: Draft;
  validatedDraft: ValidatedDraft;
  companyName: string;
  productCategory: string;
}

export interface DraftPublishResponse {
  ok: boolean;
  reference?: AuthoringReference;
  refbaseUrl?: string;
  studioUrl?: string;
  questionSlug?: string;
  error?: string;
}
