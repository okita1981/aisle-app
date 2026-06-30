/**
 * Authoring Workbench（S4）専用の型定義。
 *
 * api/_draft-types.ts と同形だが、tsconfig.app.json が api/ を含まないため
 * （include: ["src"]）、page-generate.ts と同じ方針でフロント側にも複製する。
 *
 * 注意: src/types/index.ts の CoverageType / ResponseSchema / EvidenceItem は
 * 未コミットの変更（Architecture Foundation v1.0 / Quality Sprint 由来）に
 * 含まれており、本番ビルド（git clone ベース）には存在しない場合がある。
 * そのため index.ts には依存せず、このファイル単体で完結させる。
 *
 * ライフサイクル: Question Instance → Draft → Validated Draft → Reference → Publish
 */

// ── Coverage（api/_draft-types.ts と同形） ───────────────────────────────────

export type CoverageType = 'Identity' | 'Capability' | 'Differentiation' | 'Credibility' | 'UseCase';

// ── Evidence（api/_draft-types.ts EvidenceItemInput と同形） ────────────────

export interface AuthoringEvidenceItem {
  type: string;
  title: string;
  description: string;
  entityRole: string;
  value?: string;
  tags: string[];
  sourceUrl?: string;
  sourceType?: string;
  confidence?: 'high' | 'medium' | 'low';
  needsVerification?: boolean;
  verificationNote?: string;
  sourceVerified?: boolean;
  coverageType?: string[];
}

// ── Response Schema（api/_draft-types.ts と同形） ───────────────────────────

export interface ResponseSchemaSection {
  sectionId: string;
  label: string;
  required: boolean;
}

export interface ResponseSchema {
  promptTypeId: string;
  sections: ResponseSchemaSection[];
  citationRequired: boolean;
}

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
  sourceEvidence: AuthoringEvidenceItem[];
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
  sourceEvidence: AuthoringEvidenceItem[];
  generatedAt: string;
}

// ── API request/response ─────────────────────────────────────────────────────

export interface QIResolveRequest {
  clientSlug: string;
  companyName?: string;
  perPID: Array<{ promptTypeId: string; promptText: string }>;
  targetPromptTypeIds: string[];
  adoptedEvidence?: AuthoringEvidenceItem[];
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
  adoptedEvidence?: AuthoringEvidenceItem[];
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
