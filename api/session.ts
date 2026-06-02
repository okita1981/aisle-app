/**
 * session.ts — セッション保存・読み出し・RefBase プレビューの統合エンドポイント
 *
 * POST /api/session                              → セッション保存
 * GET  /api/session?key={sessionKey}             → セッション本体を返す
 * GET  /api/session?clientSlug={slug}            → セッション一覧を返す
 * GET  /api/session?key={sessionKey}&preview=1   → RefBase プレビュー（Markdown + JSON）
 * GET  /api/session?key={sessionKey}&list=1      → セッション内の利用可能 pId 一覧
 *
 * ※ 旧 session-save.ts / session-load.ts / refbase-preview.ts を統合。
 *    Vercel Hobby plan の Serverless Function 数制限（12件）対応。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import { parse } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// 共通ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function toSlug(companyName: string): string {
  const stripped = companyName
    .replace(/株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人|一般財団法人/g, '')
    .trim();
  const ascii = stripped.replace(/[^\x20-\x7E]/g, '').trim();
  if (ascii.length > 0) {
    const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug.length > 0) return slug.slice(0, 60);
  }
  return `client-${Date.now()}`;
}

function toCompactTs(iso: string): string {
  return iso.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────────────────────────────────

export interface ExternalUrlEntry { type: string; url: string; }

export interface SessionIndexEntry {
  sessionKey: string;
  savedAt: string;
  companyName: string;
  promptCount: number;
  hasPhase2: boolean;
  hasPhase3: boolean;
  hasPhase4: boolean;
}

// ── RefBase 内部型 ────────────────────────────────────────────────────────────

interface Phase0Prompt { promptText: string; promptTypeId?: string; promptTypeLabel?: string; }
interface Phase0Data {
  companyName?: string;
  category?: string;
  keywords?: string;
  prompts?: Phase0Prompt[];
}

interface AppearanceRateRow { promptId: string; rate: string; appearedCount: number; trialCount: number; }
interface StructureSummaryRow { promptId: string; rate: string; comment?: string; }

interface Phase1Result {
  sub1?: { appearanceRates?: AppearanceRateRow[] };
  sub3?: { structureSummary?: StructureSummaryRow[] };
}

interface MIdMappingRow { name: string; semanticRole?: string; }
interface AfterBunRow { afterText: string; }
interface ConnectionOrderRow { order: number; sbId: string; afterText: string; }
interface AppearanceSummary { overallImpression?: string; }
interface AppearanceEvalRow { reachability?: string; }

interface Phase2PerPID {
  pId: string;
  promptText: string;
  promptTypeId?: string;
  promptTypeLabel?: string;
  mIdMapping?: MIdMappingRow[];
  afterBun?: AfterBunRow[];
  connectionOrder?: ConnectionOrderRow[];
  connectionComment?: string;
  portfolioIntro?: { intentSummary?: string };
  appearanceSummary?: AppearanceSummary;
  appearanceEval?: AppearanceEvalRow[];
  generatedAt?: string;
}

interface Phase2Result {
  companyName?: string;
  productCategory?: string;
  productDescription?: string;
  perPID?: Phase2PerPID[];
}

interface MatrixReportRow { reachabilityScore?: string; }
interface Phase3Result { overallSummary?: string; matrixReport?: MatrixReportRow[]; }

interface CompetitorEntityRow {
  entity?: string;
  whyItAppeared?: string;
  dominantStructure?: string;
}
interface CompetitorAnalysis {
  entityRanking?: CompetitorEntityRow[];
  entityByPId?: Record<string, CompetitorEntityRow[]>;
}

interface SessionData {
  sessionKey: string;
  savedAt: string;
  clientSlug: string;
  schema?: string;
  phase0Data?: Phase0Data | null;
  logEntries?: unknown[];
  phase1Result?: Phase1Result | null;
  competitorAnalysis?: CompetitorAnalysis | null;
  phase2Result?: Phase2Result | null;
  phase3Result?: Phase3Result | null;
  phase4Result?: unknown;
  externalUrls?: ExternalUrlEntry[];
}

// ── RefBase 出力型 ────────────────────────────────────────────────────────────

export interface QuestionPerspective {
  label: string;
  description: string;
  entityConnection: string;
}

export interface RefBaseData {
  question: string;
  entitySummary: string;
  meaningContext: string;
  questionFit: string;
  questionPerspectives: QuestionPerspective[];
  evidence: { type: string; url: string; description?: string }[];
  faq: { q: string; a: string }[];
  relatedReferences: { label: string; url: string }[];
  lastUpdated: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: セッション保存
// ─────────────────────────────────────────────────────────────────────────────

interface SaveRequest {
  clientSlug?: string;
  phase0Data?: { companyName?: string; category?: string; keywords?: string; prompts?: unknown[] } | null;
  logEntries?: unknown[];
  phase1Result?: unknown;
  competitorAnalysis?: unknown;
  phase2Result?: unknown;
  phase3Result?: unknown;
  phase4Result?: unknown;
  externalUrls?: ExternalUrlEntry[];
}

async function handleSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = JSON.parse(await readBody(req)) as SaveRequest;

  const companyName = body.phase0Data?.companyName ?? '';
  const clientSlug = body.clientSlug?.trim() || toSlug(companyName) || 'unknown';
  const now = new Date().toISOString();
  const sessionKey = `session:${clientSlug}:${toCompactTs(now)}`;

  const sessionData: SessionData = {
    sessionKey,
    savedAt: now,
    clientSlug,
    schema: 'aisle-session-v1',
    phase0Data:         (body.phase0Data ?? null) as Phase0Data | null,
    logEntries:         body.logEntries         ?? [],
    phase1Result:       (body.phase1Result       ?? null) as Phase1Result | null,
    competitorAnalysis: (body.competitorAnalysis ?? null) as CompetitorAnalysis | null,
    phase2Result:       (body.phase2Result       ?? null) as Phase2Result | null,
    phase3Result:       (body.phase3Result       ?? null) as Phase3Result | null,
    phase4Result:       body.phase4Result        ?? null,
    externalUrls:       (body.externalUrls ?? []).filter(u => u.url.trim() !== ''),
  };

  await kv.set(sessionKey, sessionData);

  const indexKey = `session-index:${clientSlug}`;
  const existingIndex = await kv.get<SessionIndexEntry[]>(indexKey) ?? [];
  const promptIds = Array.isArray(body.logEntries)
    ? [...new Set((body.logEntries as Array<{ promptId?: string }>).map(e => e.promptId).filter(Boolean))]
    : [];

  const indexEntry: SessionIndexEntry = {
    sessionKey,
    savedAt: now,
    companyName: companyName || clientSlug,
    promptCount: promptIds.length,
    hasPhase2: !!body.phase2Result,
    hasPhase3: !!body.phase3Result,
    hasPhase4: !!body.phase4Result,
  };

  await kv.set(indexKey, [indexEntry, ...existingIndex].slice(0, 50));

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, sessionKey, savedAt: now, clientSlug }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: セッション読み出し / 一覧
// ─────────────────────────────────────────────────────────────────────────────

async function handleLoad(query: Record<string, string | string[] | undefined>, res: ServerResponse): Promise<void> {
  const key        = typeof query.key        === 'string' ? query.key        : undefined;
  const clientSlug = typeof query.clientSlug === 'string' ? query.clientSlug : undefined;

  if (key) {
    const data = await kv.get(key);
    if (!data) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data }));
    return;
  }

  if (clientSlug) {
    const sessions = await kv.get<SessionIndexEntry[]>(`session-index:${clientSlug}`) ?? [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, sessions }));
    return;
  }

  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'key または clientSlug が必要です' }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET &preview=1: RefBase プレビュー生成
// ─────────────────────────────────────────────────────────────────────────────

function buildEntitySummary(s: SessionData, perPID: Phase2PerPID | undefined): string {
  const company = s.phase2Result?.companyName ?? s.phase0Data?.companyName ?? '';
  const category = s.phase2Result?.productCategory ?? s.phase0Data?.category ?? '';
  const desc = (s.phase2Result?.productDescription ?? '').trim();

  let base = company ? `${company}は、${category}の会社です。` : category;
  if (desc) {
    base += `\n\n${desc}`;
  } else if (perPID?.portfolioIntro?.intentSummary) {
    base += `\n\n${perPID.portfolioIntro.intentSummary}`;
  } else if (perPID?.afterBun && perPID.afterBun.length > 0) {
    const firstText = perPID.afterBun[0].afterText.trim();
    if (firstText) base += `\n\n${firstText}`;
  }
  return base.trim();
}

function buildMeaningContext(perPID: Phase2PerPID | undefined): string {
  if (!perPID) return '（設計データなし）';
  const lines: string[] = [];
  (perPID.mIdMapping ?? []).forEach(m => {
    const role = m.semanticRole?.trim();
    lines.push(role ? `**${m.name}**：${role}` : `**${m.name}**`);
  });
  const comment = perPID.connectionComment?.trim();
  if (comment) { lines.push(''); lines.push(comment); }
  return lines.length > 0 ? lines.join('\n') : '（意味接点データなし）';
}

function buildQuestionFit(
  rateRow: AppearanceRateRow | undefined,
  perPID: Phase2PerPID | undefined,
  phase3: Phase3Result | null | undefined,
): string {
  const lines: string[] = [];
  if (rateRow) {
    lines.push(`**実測AI言及率：${rateRow.rate}**（${rateRow.appearedCount}/${rateRow.trialCount} 試行）`);
  }
  if (perPID?.appearanceEval && perPID.appearanceEval.length > 0) {
    const scores = perPID.appearanceEval.map(e => e.reachability).filter(Boolean);
    const high = scores.filter(s => s === '◎' || s === '高').length;
    const mid  = scores.filter(s => s === '○' || s === '中').length;
    const low  = scores.filter(s => s === '△' || s === '低' || s === '×').length;
    if (scores.length > 0) {
      lines.push(`**AI言及可能性（設計評価）**：高 ${high}件 / 中 ${mid}件 / 低 ${low}件（全 ${scores.length}件）`);
    }
  }
  const summary = phase3?.overallSummary?.trim() ?? perPID?.appearanceSummary?.overallImpression?.trim();
  if (summary) { lines.push(''); lines.push(summary); }
  return lines.length > 0 ? lines.join('\n') : '（評価データなし）';
}

function buildQuestionPerspectives(
  perPID: Phase2PerPID | undefined,
  competitors: CompetitorEntityRow[],
): QuestionPerspective[] {
  const perspectives: QuestionPerspective[] = [];
  const connectionBase =
    perPID?.connectionComment?.trim() ||
    perPID?.portfolioIntro?.intentSummary?.trim() ||
    '';

  (perPID?.mIdMapping ?? []).slice(0, 4).forEach((m, i) => {
    const role = m.semanticRole?.trim();
    if (!role) return;
    perspectives.push({
      label: m.name,
      description: role,
      entityConnection: i === 0 && connectionBase
        ? connectionBase
        : `対象Entityは、${m.name}の観点からこの問いへの接続を設計しています。`,
    });
  });

  if (perspectives.length < 2) {
    competitors
      .filter(c => (c.whyItAppeared || c.dominantStructure) && c.entity)
      .slice(0, 2)
      .forEach(c => {
        const why = c.whyItAppeared?.trim() || '';
        const structure = c.dominantStructure?.trim() || '';
        if (!why && !structure) return;
        perspectives.push({
          label: structure || '選定評価観点',
          description: why || structure,
          entityConnection:
            connectionBase || '対象Entityは、この評価観点への意味接点を整備しています。',
        });
      });
  }
  return perspectives;
}

function describeEvidenceType(type: string): string {
  const t = type.toLowerCase();
  if (t === 'note')                                           return '会社の考え方・活動内容を補足する情報';
  if (t === 'linkedin')                                       return '会社・担当者の専門性・活動履歴を補足する情報';
  if (t === 'メディア記事' || t === 'media')                   return '第三者による紹介・掲載情報';
  if (t === '公式サイト' || t === 'official' || t === 'website') return '会社の基本情報・サービス概要の公式情報';
  return '外部参照情報';
}

function buildMarkdown(data: RefBaseData): string {
  const lines: string[] = [];
  lines.push(`# ${data.question}`, '');

  lines.push('## Entity Summary');
  lines.push(data.entitySummary || '—', '');

  lines.push('## Meaning Context');
  lines.push(data.meaningContext || '—', '');

  lines.push('## Question Fit');
  lines.push(data.questionFit || '—', '');

  lines.push('## Question Perspectives');
  if (data.questionPerspectives.length > 0) {
    data.questionPerspectives.forEach(p => {
      lines.push(`### ${p.label}`);
      lines.push(p.description, '');
      lines.push(`> ${p.entityConnection}`, '');
    });
  } else {
    lines.push('（評価観点データなし）', '');
  }

  lines.push('## Evidence');
  if (data.evidence.length > 0) {
    data.evidence.forEach(e => {
      lines.push(`- [${e.type}](${e.url})${e.description ? ` — ${e.description}` : ''}`);
    });
  } else {
    lines.push('（外部根拠URLが未登録です）');
  }
  lines.push('');

  lines.push('## FAQ');
  if (data.faq.length > 0) {
    data.faq.forEach(item => {
      lines.push(`**Q: ${item.q}**`, '');
      lines.push(item.a);
    });
  } else {
    lines.push('（FAQ データなし）');
  }
  lines.push('');

  lines.push('## Related References');
  if (data.relatedReferences.length > 0) {
    data.relatedReferences.forEach(r => lines.push(`- [${r.label}](${r.url})`));
  } else {
    lines.push('（関連参照URLが未登録です）');
  }
  lines.push('', '---');
  lines.push(`Last Updated: ${data.lastUpdated}`);

  return lines.join('\n');
}

async function handlePreview(
  query: Record<string, string | string[] | undefined>,
  res: ServerResponse,
): Promise<void> {
  const key      = typeof query.key  === 'string' ? query.key  : undefined;
  const pIdParam = typeof query.pId  === 'string' ? query.pId  : undefined;
  const listMode = query.list === '1';

  if (!key) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'key が必要です' }));
    return;
  }

  const session = await kv.get<SessionData>(key);
  if (!session) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
    return;
  }

  // pId 一覧モード
  if (listMode) {
    const pIds = (session.phase2Result?.perPID ?? []).map(p => ({
      pId: p.pId,
      promptText: p.promptText,
      promptTypeLabel: p.promptTypeLabel ?? p.promptTypeId ?? '',
      generatedAt: p.generatedAt ?? null,
    }));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, pIds, savedAt: session.savedAt, clientSlug: session.clientSlug }));
    return;
  }

  // 対象 PID の特定
  const perPIDList = session.phase2Result?.perPID ?? [];
  const perPID = pIdParam
    ? perPIDList.find(p => p.pId === pIdParam) ?? perPIDList[0]
    : perPIDList[0];
  const targetPId = perPID?.pId ?? pIdParam ?? 'P-01';

  const rateRow = session.phase1Result?.sub1?.appearanceRates?.find(r => r.promptId === targetPId);

  const competitors: CompetitorEntityRow[] =
    session.competitorAnalysis?.entityByPId?.[targetPId] ??
    session.competitorAnalysis?.entityRanking?.slice(0, 5) ??
    [];

  const externalUrls: ExternalUrlEntry[] = session.externalUrls ?? [];

  const data: RefBaseData = {
    question:             perPID?.promptText ?? '（問いデータなし）',
    entitySummary:        buildEntitySummary(session, perPID),
    meaningContext:       buildMeaningContext(perPID),
    questionFit:          buildQuestionFit(rateRow, perPID, session.phase3Result),
    questionPerspectives: buildQuestionPerspectives(perPID, competitors),
    evidence: externalUrls.filter(u => u.url.trim()).map(u => ({
      type: u.type,
      url: u.url.trim(),
      description: describeEvidenceType(u.type),
    })),
    faq: (() => {
      if (!perPID) return [];
      const texts = perPID.connectionOrder?.length
        ? perPID.connectionOrder.sort((a, b) => a.order - b.order).map(c => c.afterText.trim()).filter(Boolean)
        : (perPID.afterBun ?? []).map(b => b.afterText.trim()).filter(Boolean);
      return texts.length ? [{ q: perPID.promptText, a: texts.join('\n\n') }] : [];
    })(),
    relatedReferences: externalUrls.filter(u => u.url.trim()).map(u => ({ label: u.type, url: u.url.trim() })),
    lastUpdated: session.savedAt,
  };

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    format: 'markdown',
    sessionKey: key,
    clientSlug: session.clientSlug,
    pId: targetPId,
    availablePIds: perPIDList.map(p => p.pId),
    data,
    markdown: buildMarkdown(data),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// メインハンドラ
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  try {
    if (req.method === 'POST') {
      await handleSave(req, res);
      return;
    }

    if (req.method === 'GET') {
      const { query } = parse(req.url ?? '', true);
      const q = query as Record<string, string | string[] | undefined>;

      if (q.preview === '1') {
        await handlePreview(q, res);
      } else {
        await handleLoad(q, res);
      }
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
