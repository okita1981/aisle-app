/**
 * /api/draft-publish — S3-3
 *
 * Authoring Workbench「Publish」ステップ本体（L7 Publishing 相当）。
 * Draft + ValidatedDraft を受け取り、Validate通過済みのものだけを
 * Reference として合成し、RefBase KVへ保存する。
 *
 * RefBase KVへの保存はこのAPIだけで発生する。
 * qi-resolve（QIのみ保存）/ draft-generate（KV保存なし）/ draft-validate（KV保存なし）
 * のいずれもRefBase本体データには書き込まない。
 *
 * page-generate.ts の saveToRefBase() 相当の処理を必要最小限だけ移植している。
 * page-generate.ts 自体は変更しない（レガシー一括投入用として維持）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import type {
  Draft,
  DraftPublishRequest,
  DraftPublishResponse,
  EvidenceItemInput,
  Reference,
} from './_draft-types.js';

export const config = { maxDuration: 15 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REFBASE_BASE = 'https://www.refbase.ai';
const HUB_BASE_URL = process.env.HUB_BASE_URL ?? 'https://app.aisle-aio.ai';

const PROMPT_TYPE_SLUGS: Record<string, string> = {
  'P-01': 'recommendation',
  'P-02': 'comparison',
  'P-03': 'ranking',
  'P-04': 'solution',
  'P-05': 'citation',
  'P-06': 'why-recommended',
};

function getPromptSlug(promptTypeId: string): string {
  const base = promptTypeId.split('-').slice(0, 2).join('-');
  return PROMPT_TYPE_SLUGS[base] ?? promptTypeId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ── 文字化け検知・除去（page-generate.ts と同一ロジック） ──────────────────

function hasGarbledText(s: string): boolean {
  if (s.includes('�')) return true;
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
}

function stripGarbled(s: string): string {
  return s.replace(/�/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

// ── questionSlug 採番（page-generate.ts nextQuestionSlug と同一アルゴリズム） ─
// Publish時点で既存indexを再取得し、衝突しないslugを確定する。

interface QuestionPageIndexEntry {
  questionSlug: string;
  promptTypeId: string;
  promptTypeSlug: string;
  promptText: string;
  sessionKey?: string;
  generatedAt: string;
  instanceId?: string;
}

function nextQuestionSlug(promptTypeSlug: string, existingQIndex: QuestionPageIndexEntry[]): string {
  const suffixPattern = new RegExp(`^${promptTypeSlug}-(\\d+)$`);
  let maxSuffix = 0;
  for (const e of existingQIndex) {
    const m = e.questionSlug.match(suffixPattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSuffix) maxSuffix = n;
    }
  }
  const usedSlugs = new Set(existingQIndex.map(e => e.questionSlug));
  let candidate = maxSuffix + 1;
  let questionSlug = `${promptTypeSlug}-${String(candidate).padStart(3, '0')}`;
  while (usedSlugs.has(questionSlug)) {
    candidate += 1;
    questionSlug = `${promptTypeSlug}-${String(candidate).padStart(3, '0')}`;
  }
  return questionSlug;
}

// ── 必須フィールド確認 ──────────────────────────────────────────────────────

function findMissingFields(draft: Draft): string[] {
  const missing: string[] = [];
  if (!draft.clientSlug || !SLUG_PATTERN.test(draft.clientSlug)) missing.push('clientSlug');
  if (!draft.promptTypeId) missing.push('promptTypeId');
  if (!draft.promptText?.trim()) missing.push('promptText');
  if (!draft.instanceId) missing.push('instanceId');
  if (!draft.narrative?.answer?.trim()) missing.push('narrative.answer');
  if (!Array.isArray(draft.narrative?.evidencePoints)) missing.push('narrative.evidencePoints');
  if (!draft.narrative?.scope?.trim()) missing.push('narrative.scope');
  if (!draft.narrative?.differentiation?.trim()) missing.push('narrative.differentiation');
  if (!Array.isArray(draft.narrative?.faq) || draft.narrative.faq.length === 0) missing.push('narrative.faq');
  return missing;
}

// ── RefBase KV保存（saveToRefBase 相当・必要最小限を移植） ──────────────────

interface RefBaseCompany {
  id: string;
  name: string;
  category: string;
  entityType?: string;
  externalLinks?: Array<{ type: string; url: string }>;
  updatedAt: string;
}

async function saveReferenceToRefBase(
  draft: Draft,
  reference: Reference,
  companyName: string,
  productCategory: string,
  now: string,
): Promise<void> {
  const existingEntity = await kv.get<RefBaseCompany>(`refbase:company:${draft.clientSlug}`);

  const company: RefBaseCompany = {
    id: draft.clientSlug,
    name: companyName,
    category: productCategory,
    entityType: existingEntity?.entityType ?? 'company',
    ...(existingEntity?.externalLinks !== undefined ? { externalLinks: existingEntity.externalLinks } : {}),
    updatedAt: now,
  };

  await kv.set(`refbase:company:${draft.clientSlug}`, company);
  await kv.set(`refbase:ref:${draft.clientSlug}/${reference.id}`, reference);

  const existingIndex = await kv.get<string[]>(`refbase:index:${draft.clientSlug}`) ?? [];
  if (!existingIndex.includes(reference.id)) {
    await kv.set(`refbase:index:${draft.clientSlug}`, [...existingIndex, reference.id]);
  }

  const globalIndex = await kv.get<string[]>('refbase:index:all') ?? [];
  if (!globalIndex.includes(draft.clientSlug)) {
    await kv.set('refbase:index:all', [...globalIndex, draft.clientSlug]);
  }
}

// ── ハンドラー ───────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as DraftPublishRequest;
    const { draft, validatedDraft, companyName, productCategory } = body;

    if (!draft || !validatedDraft) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'draft and validatedDraft are required' } satisfies DraftPublishResponse));
      return;
    }

    // ── Guard 1: validatedDraft.ok === true でなければ保存しない ──────────
    if (validatedDraft.ok !== true) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'validatedDraft.ok is not true. Publish blocked.' } satisfies DraftPublishResponse));
      return;
    }

    // ── Guard 2: draftId 不一致なら保存しない ─────────────────────────────
    if (validatedDraft.draftId !== draft.draftId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'validatedDraft.draftId does not match draft.draftId. Publish blocked.' } satisfies DraftPublishResponse));
      return;
    }

    // ── Guard 3: 必須フィールド不足なら保存しない ─────────────────────────
    const missingFields = findMissingFields(draft);
    if (missingFields.length > 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: `Missing required fields: ${missingFields.join(', ')}` } satisfies DraftPublishResponse));
      return;
    }
    if (!companyName?.trim() || !productCategory?.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'companyName and productCategory are required' } satisfies DraftPublishResponse));
      return;
    }

    const now = new Date().toISOString();

    // ── Guard 4: questionSlug 衝突をPublish時点で再確認 ────────────────────
    const existingQIndex = (await kv.get<QuestionPageIndexEntry[]>(`page-question-index:${draft.clientSlug}`)) ?? [];
    const promptTypeSlug = getPromptSlug(draft.promptTypeId);
    const questionSlug = nextQuestionSlug(promptTypeSlug, existingQIndex);

    // 文字化け検知・クリーニング（saveToRefBase と同一方針：検知したフィールドのみ除去して継続）
    const narrative = { ...draft.narrative };
    let effectivePromptText = draft.promptText;
    if (hasGarbledText(effectivePromptText)) effectivePromptText = stripGarbled(effectivePromptText);
    if (hasGarbledText(narrative.answer)) narrative.answer = stripGarbled(narrative.answer);
    narrative.evidencePoints = narrative.evidencePoints.map((e: string) => hasGarbledText(e) ? stripGarbled(e) : e);
    narrative.faq = narrative.faq.map((f: { question: string; answer: string }) => ({
      question: hasGarbledText(f.question) ? stripGarbled(f.question) : f.question,
      answer: hasGarbledText(f.answer) ? stripGarbled(f.answer) : f.answer,
    }));

    const pageUrl = `${REFBASE_BASE}/reference/${draft.clientSlug}/${questionSlug}`;

    const reference: Reference = {
      id: questionSlug,
      companyId: draft.clientSlug,
      questionId: questionSlug,
      instanceId: draft.instanceId,
      draftId: draft.draftId,
      promptText: effectivePromptText,
      promptTypeId: draft.promptTypeId,
      answer: narrative.answer,
      evidencePoints: narrative.evidencePoints,
      scope: narrative.scope,
      differentiation: narrative.differentiation,
      faq: narrative.faq,
      pageUrl,
      sourceEvidence: draft.sourceEvidence as EvidenceItemInput[],
      generatedAt: now,
    };

    // ── Guard 5: RefBase KVへの保存はここでのみ発生する ────────────────────
    await saveReferenceToRefBase(draft, reference, companyName, productCategory, now);

    // page-question-index 更新
    const newEntry: QuestionPageIndexEntry = {
      questionSlug,
      promptTypeId: draft.promptTypeId,
      promptTypeSlug,
      promptText: effectivePromptText,
      generatedAt: now,
      instanceId: draft.instanceId,
    };
    await kv.set(`page-question-index:${draft.clientSlug}`, [...existingQIndex, newEntry]);

    console.log(`[draft-publish] published ${draft.clientSlug}/${questionSlug} (draftId=${draft.draftId}, instanceId=${draft.instanceId})`);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      reference,
      refbaseUrl: pageUrl,
      studioUrl: `${HUB_BASE_URL}/${draft.clientSlug}/questions/${questionSlug}`,
      questionSlug,
    } satisfies DraftPublishResponse));
  } catch (err) {
    console.error('[draft-publish]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: String(err) } satisfies DraftPublishResponse));
  }
}
