/**
 * refbase-preview.ts
 *
 * GET /api/refbase-preview?key={sessionKey}&pId={pId}
 *
 * session JSON → RefBase 構造化JSON + Markdown を返す。
 * HTML 生成は後続タスク。
 *
 * ?key    : session:{clientSlug}:{timestamp}（必須）
 * ?pId    : 対象の問い ID（例: P-01）。省略時は最初の PID を使用
 * ?list=1 : key だけ指定して利用可能な pId 一覧を取得する場合に指定
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';
import { parse } from 'node:url';

// ── 内部型定義（session-save が書いた構造と対応） ─────────────────────

interface ExternalUrlEntry { type: string; url: string; }

interface Phase0Prompt { promptText: string; promptTypeId?: string; promptTypeLabel?: string; }
interface Phase0Data {
  companyName?: string;
  category?: string;
  keywords?: string;
  prompts?: Phase0Prompt[];
}

interface LogEntry { promptId?: string; appeared?: boolean; aiOutput?: string; eIds?: string[]; }

interface AppearanceRateRow { promptId: string; rate: string; appearedCount: number; trialCount: number; }
interface EIdRow {
  pId: string;
  competitorEntity?: string;
  winningFactor?: string;
  gapToAisle?: string;
  winningEId?: string;
  implementationDirection?: string;
}
interface StructureSummaryRow { promptId: string; rate: string; comment?: string; }

interface Phase1Result {
  sub1?: { appearanceRates?: AppearanceRateRow[] };
  sub3?: { eIdMatrix?: EIdRow[]; structureSummary?: StructureSummaryRow[] };
}

interface MIdMappingRow { name: string; semanticRole?: string; }
interface AfterBunRow { afterText: string; }
interface ConnectionOrderRow { order: number; sbId: string; afterText: string; }
interface AppearanceSummary { overallImpression?: string; }
interface EIdComplementRow { winningFactor?: string; gapToAisle?: string; }
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
  eIdComplement?: EIdComplementRow[];
  appearanceEval?: AppearanceEvalRow[];
  generatedAt?: string;
}

interface Phase2Result {
  companyName?: string;
  productCategory?: string;
  productDescription?: string;
  perPID?: Phase2PerPID[];
}

interface MatrixReportRow { reachabilityScore?: string; sbId?: string; }
interface Phase3Result { overallSummary?: string; matrixReport?: MatrixReportRow[]; }

interface PlanRow { priority?: string; action?: string; targetPage?: string; eIdRequired?: string; }
interface Phase4Result { planRows?: PlanRow[]; }

interface CompetitorEntityRow {
  rank?: number;
  entity?: string;
  whyItAppeared?: string;
  dominantStructure?: string;
  replacementRole?: string;
}
interface CompetitorAnalysis {
  entityRanking?: CompetitorEntityRow[];
  entityByPId?: Record<string, CompetitorEntityRow[]>;
  summariesByPId?: Record<string, string>;
}

interface SessionData {
  sessionKey: string;
  savedAt: string;
  clientSlug: string;
  schema?: string;
  phase0Data?: Phase0Data | null;
  logEntries?: LogEntry[];
  phase1Result?: Phase1Result | null;
  competitorAnalysis?: CompetitorAnalysis | null;
  phase2Result?: Phase2Result | null;
  phase3Result?: Phase3Result | null;
  phase4Result?: Phase4Result | null;
  externalUrls?: ExternalUrlEntry[];
}

// ── RefBase 構造化JSON型 ──────────────────────────────────────────────

export interface RefBaseData {
  question: string;
  entitySummary: string;
  meaningContext: string;
  questionFit: string;
  comparisonAxis: string;
  evidence: { type: string; url: string; description?: string }[];
  faq: { q: string; a: string }[];
  relatedReferences: { label: string; url: string }[];
  lastUpdated: string;
}

// ── 各フィールドのビルド関数 ─────────────────────────────────────────

function buildEntitySummary(s: SessionData, perPID: Phase2PerPID | undefined): string {
  const company = s.phase2Result?.companyName ?? s.phase0Data?.companyName ?? '';
  const category = s.phase2Result?.productCategory ?? s.phase0Data?.category ?? '';
  const desc = (s.phase2Result?.productDescription ?? '').trim();

  // 基本文：会社名 + カテゴリ
  let base = company ? `${company}は、${category}の会社です。` : category;

  // productDescription があれば追記
  if (desc) {
    base += `\n\n${desc}`;
  } else if (perPID?.portfolioIntro?.intentSummary) {
    // 設計意図サマリーを代替として使用
    base += `\n\n${perPID.portfolioIntro.intentSummary}`;
  } else if (perPID?.afterBun && perPID.afterBun.length > 0) {
    // 最初の説明文を暫定的にEntity Summaryとして利用
    const firstText = perPID.afterBun[0].afterText.trim();
    if (firstText) base += `\n\n${firstText}`;
  }

  return base.trim();
}

function buildMeaningContext(perPID: Phase2PerPID | undefined): string {
  if (!perPID) return '（設計データなし）';

  const lines: string[] = [];

  // M-ID マッピング（意味接点 × 役割説明）
  if (perPID.mIdMapping && perPID.mIdMapping.length > 0) {
    perPID.mIdMapping.forEach(m => {
      const role = m.semanticRole?.trim();
      lines.push(role ? `**${m.name}**：${role}` : `**${m.name}**`);
    });
  }

  // 設計の考え方（connectionComment）
  const comment = perPID.connectionComment?.trim();
  if (comment) {
    lines.push('');
    lines.push(comment);
  }

  return lines.length > 0 ? lines.join('\n') : '（意味接点データなし）';
}

function buildQuestionFit(
  rateRow: AppearanceRateRow | undefined,
  perPID: Phase2PerPID | undefined,
  phase3: Phase3Result | null | undefined,
): string {
  const lines: string[] = [];

  // 実測AI言及率
  if (rateRow) {
    lines.push(`**実測AI言及率：${rateRow.rate}**（${rateRow.appearedCount}/${rateRow.trialCount} 試行）`);
  }

  // 設計評価（到達可能性）
  if (perPID?.appearanceEval && perPID.appearanceEval.length > 0) {
    const scores = perPID.appearanceEval.map(e => e.reachability).filter(Boolean);
    const high = scores.filter(s => s === '◎' || s === '高').length;
    const mid  = scores.filter(s => s === '○' || s === '中').length;
    const low  = scores.filter(s => s === '△' || s === '低' || s === '×').length;
    if (scores.length > 0) {
      lines.push(`**AI言及可能性（設計評価）**：高 ${high}件 / 中 ${mid}件 / 低 ${low}件（全 ${scores.length}件）`);
    }
  }

  // 設計レビュー総評
  const overallSummary = phase3?.overallSummary?.trim();
  if (overallSummary) {
    lines.push('');
    lines.push(overallSummary);
  } else if (perPID?.appearanceSummary?.overallImpression) {
    lines.push('');
    lines.push(perPID.appearanceSummary.overallImpression);
  }

  return lines.length > 0 ? lines.join('\n') : '（評価データなし）';
}

function buildComparisonAxis(
  competitors: CompetitorEntityRow[],
  eIdRows: EIdRow[],
  competitorSummary: string | undefined,
): string {
  const lines: string[] = [];

  // 競合出現エンティティ（上位3件）
  const topCompetitors = competitors.slice(0, 3);
  if (topCompetitors.length > 0) {
    lines.push('**AIの回答に登場した競合エンティティ（上位）**');
    topCompetitors.forEach(c => {
      const why = c.whyItAppeared?.trim() ?? c.dominantStructure?.trim() ?? '—';
      lines.push(`- **${c.entity ?? '—'}**：${why}`);
    });
  }

  // 自社の現状ギャップ（eIdMatrixから、pId一致行）
  const gapTexts = [...new Set(
    eIdRows
      .map(r => r.gapToAisle?.trim())
      .filter((g): g is string => !!g && g !== '—'),
  )].slice(0, 2);

  if (gapTexts.length > 0) {
    lines.push('');
    lines.push('**自社の現状ギャップ（暫定）**');
    gapTexts.forEach(g => lines.push(`- ${g}`));
  }

  // competitorAnalysis のサマリーがあれば追記
  if (competitorSummary) {
    lines.push('');
    lines.push(competitorSummary);
  }

  return lines.length > 0 ? lines.join('\n') : '（競合データなし）';
}

function buildEvidence(externalUrls: ExternalUrlEntry[]): RefBaseData['evidence'] {
  return externalUrls
    .filter(u => u.url.trim())
    .map(u => ({
      type: u.type,
      url: u.url.trim(),
      description: describeEvidenceType(u.type),
    }));
}

function describeEvidenceType(type: string): string {
  const t = type.toLowerCase();
  if (t === 'note')                                  return '会社の考え方・活動内容を補足する情報';
  if (t === 'linkedin')                              return '会社・担当者の専門性・活動履歴を補足する情報';
  if (t === 'メディア記事' || t === 'media')          return '第三者による紹介・掲載情報';
  if (t === '公式サイト' || t === 'official' || t === 'website') return '会社の基本情報・サービス概要の公式情報';
  return '外部参照情報';
}

function buildFaq(perPID: Phase2PerPID | undefined): RefBaseData['faq'] {
  if (!perPID) return [];

  // connectionOrder がある場合はその順序で afterText を並べる
  let answerTexts: string[] = [];

  if (perPID.connectionOrder && perPID.connectionOrder.length > 0) {
    answerTexts = perPID.connectionOrder
      .sort((a, b) => a.order - b.order)
      .map(c => c.afterText.trim())
      .filter(Boolean);
  } else if (perPID.afterBun && perPID.afterBun.length > 0) {
    answerTexts = perPID.afterBun.map(b => b.afterText.trim()).filter(Boolean);
  }

  if (answerTexts.length === 0) return [];

  return [{
    q: perPID.promptText,
    a: answerTexts.join('\n\n'),
  }];
}

function buildRelatedReferences(externalUrls: ExternalUrlEntry[]): RefBaseData['relatedReferences'] {
  return externalUrls
    .filter(u => u.url.trim())
    .map(u => ({ label: u.type, url: u.url.trim() }));
}

// ── Markdown 生成 ────────────────────────────────────────────────────

function buildMarkdown(data: RefBaseData): string {
  const lines: string[] = [];

  lines.push(`# ${data.question}`);
  lines.push('');

  lines.push('## Entity Summary');
  lines.push(data.entitySummary || '—');
  lines.push('');

  lines.push('## Meaning Context');
  lines.push(data.meaningContext || '—');
  lines.push('');

  lines.push('## Question Fit');
  lines.push(data.questionFit || '—');
  lines.push('');

  lines.push('## Comparison Axis');
  lines.push(data.comparisonAxis || '—');
  lines.push('');

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
      lines.push(`**Q: ${item.q}**`);
      lines.push('');
      lines.push(item.a);
    });
  } else {
    lines.push('（FAQ データなし）');
  }
  lines.push('');

  lines.push('## Related References');
  if (data.relatedReferences.length > 0) {
    data.relatedReferences.forEach(r => {
      lines.push(`- [${r.label}](${r.url})`);
    });
  } else {
    lines.push('（関連参照URLが未登録です）');
  }
  lines.push('');

  lines.push('---');
  lines.push(`Last Updated: ${data.lastUpdated}`);

  return lines.join('\n');
}

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  try {
    const { query } = parse(req.url ?? '', true);
    const key     = typeof query.key     === 'string' ? query.key     : undefined;
    const pIdParam = typeof query.pId    === 'string' ? query.pId    : undefined;
    const listMode = query.list === '1';

    if (!key) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'key クエリパラメータが必要です' }));
      return;
    }

    // ── セッション読み込み ──────────────────────────────────────────
    const session = await kv.get<SessionData>(key);
    if (!session) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
      return;
    }

    // ── ?list=1 → 利用可能な pId 一覧を返す ──────────────────────
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

    // ── 対象 PID の特定 ────────────────────────────────────────────
    const perPIDList = session.phase2Result?.perPID ?? [];
    const perPID = pIdParam
      ? perPIDList.find(p => p.pId === pIdParam) ?? perPIDList[0]
      : perPIDList[0];

    const targetPId = perPID?.pId ?? pIdParam ?? 'P-01';

    // ── Phase1 から当該 PID のデータ取得 ──────────────────────────
    const rateRow = session.phase1Result?.sub1?.appearanceRates?.find(
      r => r.promptId === targetPId,
    );
    const eIdRows = (session.phase1Result?.sub3?.eIdMatrix ?? []).filter(
      r => r.pId === targetPId,
    );

    // ── 競合データ取得（entityByPId > entityRanking） ──────────────
    const competitors: CompetitorEntityRow[] =
      session.competitorAnalysis?.entityByPId?.[targetPId] ??
      session.competitorAnalysis?.entityRanking?.slice(0, 5) ??
      [];
    const competitorSummary = session.competitorAnalysis?.summariesByPId?.[targetPId];

    // ── externalUrls ────────────────────────────────────────────────
    const externalUrls: ExternalUrlEntry[] = session.externalUrls ?? [];

    // ── RefBase 構造化データ生成 ───────────────────────────────────
    const data: RefBaseData = {
      question:          perPID?.promptText ?? '（問いデータなし）',
      entitySummary:     buildEntitySummary(session, perPID),
      meaningContext:    buildMeaningContext(perPID),
      questionFit:       buildQuestionFit(rateRow, perPID, session.phase3Result),
      comparisonAxis:    buildComparisonAxis(competitors, eIdRows, competitorSummary),
      evidence:          buildEvidence(externalUrls),
      faq:               buildFaq(perPID),
      relatedReferences: buildRelatedReferences(externalUrls),
      lastUpdated:       session.savedAt,
    };

    const markdown = buildMarkdown(data);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      format: 'markdown',
      sessionKey: key,
      clientSlug: session.clientSlug,
      pId: targetPId,
      availablePIds: perPIDList.map(p => p.pId),
      data,
      markdown,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
