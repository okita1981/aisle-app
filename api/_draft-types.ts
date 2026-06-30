/**
 * Authoring Workbench 共有型定義（S3: Generate / Validate / Publish 分離）
 *
 * tsconfig.api.json が src/ を含まないため、page-generate.ts と同じ方針で
 * 必要な型をこのファイルにインライン定義し、qi-resolve.ts / draft-generate.ts /
 * draft-validate.ts / draft-publish.ts から共有する。
 *
 * ライフサイクル:
 *   Question Instance（独立Object）
 *     → Draft（1 instance : N draft。複数LLM・複数試行を許容）
 *     → Validated Draft（schema/citation検証を通過した状態。まだ非公開）
 *     → Reference（採用されたValidated Draftから合成される最終成果物）
 *     → Publish（RefBase KVへ保存）
 */

// ── Coverage（L3/L4）共有型 ──────────────────────────────────────────────

export type CoverageType = 'Identity' | 'Capability' | 'Differentiation' | 'Credibility' | 'UseCase';

export interface QuestionTemplate {
  templateId: string;
  promptTypeId: string;
  templateText?: string;
  requiredCoverage: CoverageType[];
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

// ── Evidence（既存 page-generate.ts の EvidenceItemInput と同形） ────────────

export interface EvidenceItemInput {
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

// ── Question Instance（独立 Knowledge Object） ───────────────────────────

export interface QuestionInstance {
  instanceId: string;        // QIN-{entityId}-{pid}-001
  templateId: string;
  entityId: string;
  promptTypeId: string;
  resolvedText: string;
  unresolvedSlots: string[];
  createdAt: string;
  updatedAt?: string;
}

// ── Draft（Question Instance : Draft = 1 : N） ───────────────────────────

export interface ChildPageNarrative {
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
}

export interface Draft {
  draftId: string;                  // crypto.randomUUID()
  instanceId: string;               // ← Question Instance への参照（必須）
  clientSlug: string;
  promptTypeId: string;
  promptText: string;               // 生成時点の resolvedText スナップショット
  generator: {
    model: string;                  // "claude-sonnet-4-6" 等。将来の複数LLM対応
    generatedAt: string;
    attemptNumber: number;          // 同一 instanceId に対する何回目の生成試行か
  };
  narrative: ChildPageNarrative;
  sourceEvidence: EvidenceItemInput[];
}

// ── Response Schema（src/types/index.ts ResponseSchema と同形） ─────────────
// tsconfig.api.json が src/ を含まないため、ここにも同形で定義する。
// refbase:registry:responseSchemas の items[] がこの形。

export interface ResponseSchemaSection {
  sectionId: string;   // セクション識別子（例: "summary"）
  label: string;       // 表示名
  required: boolean;   // true = L6 が存在確認する
}

export interface ResponseSchema {
  promptTypeId: string;              // P-01 〜 P-06
  sections: ResponseSchemaSection[];
  citationRequired: boolean;         // true = citation[] が必須（L6 が確認）
}

// ── Validate Issue / Validated Draft（S3-2 実装） ─────────────────────────

export interface ValidateIssue {
  field: string;                    // "answer" | "evidencePoints" | "citation" | ...
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidatedDraft {
  draftId: string;                  // 元の Draft への参照
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
  ok: boolean;                      // 全 error 解消時のみ true。Publish 可否の最終判定
}

// ── Reference（Studioの最終成果物。型定義のみ。Publish実装は S3-3） ──────

export interface Reference {
  id: string;                       // questionSlug（確定版）
  companyId: string;
  questionId: string;
  instanceId: string;               // ← Question Instance への参照（生成履歴の追跡）
  draftId: string;                  // ← 採用された Draft への参照（生成履歴の追跡）
  promptText: string;
  promptTypeId: string;
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
  pageUrl: string;
  sourceEvidence: EvidenceItemInput[];
  generatedAt: string;
}

// ── /api/qi-resolve request/response ─────────────────────────────────────

export interface AislePerPIDMinimal {
  promptTypeId: string;
  promptText: string;
}

export interface QIResolveRequest {
  clientSlug: string;
  companyName?: string;
  perPID: AislePerPIDMinimal[];        // 対象候補（promptTypeId単位でフィルタする）
  targetPromptTypeIds: string[];       // 解決対象のP-ID
  adoptedEvidence?: EvidenceItemInput[];
}

export interface QIResolveResponse {
  ok: boolean;
  instances?: QuestionInstance[];
  coverageGate?: {
    registryAvailable: boolean;
    results: CoverageGateResult[];
    skipped: CoverageGateSkipped[];
  };
  error?: string;
}

// ── /api/draft-generate request/response ─────────────────────────────────

export interface DraftGenerateRequest {
  instanceId: string;
  clientSlug: string;
  companyName: string;
  productCategory: string;
  promptTypeId: string;
  promptText: string;                  // QuestionInstance.resolvedText（呼び出し側が渡す）
  adoptedEvidence?: EvidenceItemInput[];
  model?: string;                      // 将来の複数LLM対応。未指定時は既定モデル
  attemptNumber?: number;              // 呼び出し側（フロント state）が管理・採番する
}

export interface DraftGenerateResponse {
  ok: boolean;
  draft?: Draft;
  error?: string;
}

// ── /api/draft-validate request/response ──────────────────────────────────

export interface DraftValidateRequest {
  draft: Draft;
  responseSchema: ResponseSchema;
  requiredCoverage?: CoverageType[];   // QuestionTemplate.requiredCoverage（任意。Coverage整合確認に使用）
}

export interface DraftValidateResponse {
  ok: boolean;
  validatedDraft?: ValidatedDraft;
  error?: string;
}

// ── /api/draft-publish request/response ───────────────────────────────────

export interface DraftPublishRequest {
  draft: Draft;
  validatedDraft: ValidatedDraft;
  companyName: string;
  productCategory: string;
}

export interface DraftPublishResponse {
  ok: boolean;
  reference?: Reference;
  refbaseUrl?: string;
  studioUrl?: string;
  questionSlug?: string;
  error?: string;
}
