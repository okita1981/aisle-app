import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { P_IDS } from '../store/masterData';
import { buildModeMap } from '../store/analysisEngine';
import type {
  Phase2PerPID,
  EvaluationAxes,
  EvidenceCandidateItem,
  EvidenceItem,
  EvidenceType,
  MIdMappingRow, PortfolioRow, AfterBunRow,
  ConnectionOrderRow, EIdComplementRow, AppearanceEvalRow,
  ValidationResult,
  AnalysisMode,
} from '../types';

// ============================================================
// 型定義（API レスポンス）
// ============================================================
interface ApiDesignStep1Response {
  step1: MIdMappingRow[];
  portfolioIntro: { intentSummary: string; mIdOutputs: string };
  step2: PortfolioRow[];
  step3: AfterBunRow[];
}

interface ApiDesignStep2Response {
  step4: ConnectionOrderRow[];
  connectionComment: string;
  validationResult?: ValidationResult;
}

interface ApiDesignStep3Response {
  step5: EIdComplementRow[];
  step6: AppearanceEvalRow[];
  summary: {
    overallImpression: string;
    keyBun: string;
    complementNeeds: string;
    implementationProposal: string;
  };
}

// P-IDごとの生成状態
interface GenerationState {
  result: Phase2PerPID | null;
  isGenerating: boolean;
  generatingStep: 0 | 1 | 2 | 3 | null; // 0 = evaluate-axes
  error: string | null;
}

// ============================================================
// ユーティリティ
// ============================================================
const reachabilityColor = (v: string) =>
  v === '◎' ? 'green' : v === '○' ? 'blue' : v === '△' ? 'yellow' : v === '×' ? 'red' : 'slate';

const fitBadgeColor = (v: string) =>
  v === '◎' ? 'green' : v === '○' ? 'blue' : 'slate';


// ============================================================
// API レスポンス安全読み取り
// ============================================================
// response.json() を直接呼ぶと非JSON応答（Vercel timeout HTML 等）で
// SyntaxError がそのまま UI に出てしまうため、text() で先読みしてから parse する
async function safeReadApiJson(resp: Response): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  // ① まず body を text として読む（json() は呼ばない）
  let rawText = '';
  try {
    rawText = await resp.text();
  } catch {
    return { ok: false, error: 'APIレスポンスの読み取りに失敗しました。ネットワークを確認してください。' };
  }

  // ② JSON かどうか判定（Content-Type または本文先頭文字）
  const contentType = resp.headers.get('content-type') ?? '';
  const trimmed = rawText.trimStart();
  const looksLikeJson = contentType.includes('application/json')
    || trimmed.startsWith('{')
    || trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      return JSON.parse(rawText) as { ok: boolean; data?: unknown; error?: string };
    } catch {
      // JSON parse 失敗時：例外文をUIに出さず、ログだけ残す
      console.error('[Phase2Design] JSON parse failed. status:', resp.status, 'url:', resp.url);
      console.error('[Phase2Design] raw (0-300):', rawText.slice(0, 300));
      return { ok: false, error: 'APIのレスポンス形式が不正です。Vercel Function Logsを確認してください。' };
    }
  }

  // ③ JSON ではない（Vercel タイムアウトの HTML、502 等）
  console.error('[Phase2Design] Non-JSON response. status:', resp.status, 'url:', resp.url);
  console.error('[Phase2Design] raw (0-300):', rawText.slice(0, 300));
  return {
    ok: false,
    error: `APIがJSONではない応答を返しました（HTTP ${resp.status}）。Vercel Function Logsを確認してください。`,
  };
}

// ============================================================
// テーブルコンポーネント（汎用）
// ============================================================
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 whitespace-nowrap">
      {children}
    </th>
  );
}
function Td({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs text-slate-700 border border-slate-200 ${wrap ? 'whitespace-pre-wrap' : 'whitespace-nowrap'}`}>
      {children}
    </td>
  );
}

// ============================================================
// STEP1: M-ID意味接点マッピング
// ============================================================
function Step1Table({ rows }: { rows: MIdMappingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <Th>No.</Th>
            <Th>接点名称</Th>
            <Th>このP-IDにおける意味役割</Th>
            <Th>該当構文の設計必要性</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.mId} className="even:bg-slate-50">
              <Td><span className="font-bold text-slate-500">#{i + 1}</span></Td>
              <Td>{r.name}</Td>
              <Td wrap>{r.semanticRole}</Td>
              <Td>
                <Badge color={r.designNecessity.startsWith('必須') ? 'red' : r.designNecessity.startsWith('任意') ? 'slate' : 'yellow'}>
                  {r.designNecessity}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// STEP2-2: 構文ポートフォリオ一覧（意味接点主役レイアウト）
// ============================================================
function Step2Table({ rows }: { rows: PortfolioRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const hasKidCorrection = r.kIdCorrection && r.kIdCorrection !== 'なし' && r.kIdCorrection !== '';
        const mainReason = r.adoptionReason ?? r.syntaxIntent;
        const memo = r.implementationMemo ?? r.note;
        return (
          <div key={r.sbId} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* ヘッダー：SB-ID + M-ID名 */}
            <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-100">
              <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{r.sbId}</span>
              <span className="text-xs font-bold text-blue-700 flex-shrink-0">#{i + 1}</span>
              <span className="text-sm font-semibold text-slate-800">{r.mName}</span>
            </div>
            {/* 主役：採用理由 / K-ID補正 */}
            <div className="px-4 py-3 space-y-2">
              {mainReason && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">採用理由</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{mainReason}</p>
                </div>
              )}
              {hasKidCorrection && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-0.5">K-ID補正</p>
                  <p className="text-xs text-amber-700 leading-relaxed">{r.kIdCorrection}</p>
                </div>
              )}
              {/* 実装パーツ（参考）：折りたたみ */}
              <details className="group">
                <summary className="text-[10px] text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors">
                  実装パーツ（参考）▸
                </summary>
                <div className="mt-2 pl-2 border-l-2 border-slate-100 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.tId && <><Badge color="purple">{r.tId}</Badge><span className="text-xs text-slate-500">{r.templateName}</span></>}
                    {r.aId && <><Badge color="orange">{r.aId}</Badge><span className="text-xs text-slate-500">{r.agentStructure}</span></>}
                  </div>
                  {memo && <p className="text-xs text-slate-500 leading-relaxed">{memo}</p>}
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// STEP2-3: AI回答構文一覧
// ============================================================
function Step3Table({ rows }: { rows: AfterBunRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.sbId} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* ヘッダー：SB-ID + M-ID名 */}
          <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-100">
            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{r.sbId}</span>
            <span className="text-xs font-bold text-blue-700 flex-shrink-0">#{i + 1}</span>
            <span className="text-sm font-semibold text-slate-800">{r.mName}</span>
          </div>
          {/* 主役：AI回答構文 */}
          <div className="px-4 py-3 space-y-2">
            <div>
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-0.5">AI回答構文</p>
              <p className="text-sm text-green-800 font-medium leading-relaxed">{r.afterText}</p>
            </div>
            {r.syntaxIntent && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">構文意図</p>
                <p className="text-xs text-slate-600 leading-relaxed">{r.syntaxIntent}</p>
              </div>
            )}
            {/* 実装パーツ（参考）：折りたたみ */}
            <details className="group">
              <summary className="text-[10px] text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors">
                実装パーツ（参考）▸
              </summary>
              <div className="mt-2 pl-2 border-l-2 border-slate-100 flex flex-wrap items-center gap-2">
                {r.tId && <Badge color="purple">{r.tId}</Badge>}
                {r.aId && <Badge color="orange">{r.aId}</Badge>}
                {r.note && <span className="text-xs text-slate-500">{r.note}</span>}
              </div>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// STEP3: 構文接続順
// ============================================================
function Step4Table({ rows, comment, validationResult }: {
  rows: ConnectionOrderRow[];
  comment: string;
  validationResult?: ValidationResult;
}) {
  const hasWarning = validationResult?.status === 'warning' && (validationResult.issues?.length ?? 0) > 0;
  return (
    <div className="space-y-3">
      {/* 設計妥当性 警告バナー */}
      {hasWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-800 mb-1.5">
            ⚠️ 設計妥当性に問題があります
          </p>
          <ul className="space-y-1">
            {validationResult!.issues.map((issue, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                <span className="flex-shrink-0 mt-0.5">・</span>
                <span>{issue.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* 問題なし */}
      {validationResult?.status === 'ok' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <p className="text-xs text-green-700 font-medium">✅ 設計妥当性：問題なし</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>接続順</Th>
              <Th>No.</Th>
              <Th>意味接点</Th>
              <Th>After構文</Th>
              <Th>コメント</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.order} className="even:bg-slate-50">
                <Td>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold">
                    {r.order}
                  </span>
                </Td>
                <Td><span className="font-bold text-slate-500">#{i + 1}</span></Td>
                <Td><span className="text-blue-700 font-medium">{r.mId?.replace(/^M-\d+\s*[:：]?\s*/, '') || r.mId}</span></Td>
                <Td wrap><span className="text-green-800">{r.afterText}</span></Td>
                <Td wrap>{r.comment}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comment && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">接続意図コメント</p>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{comment}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STEP4: 勝因接続マトリクス
// ============================================================
const reproducibilityColor = (v: string) =>
  v === '高' ? 'green' : v === '中' ? 'yellow' : 'slate';

function Step5Table({ rows }: { rows: EIdComplementRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        // 新フィールド優先、旧フィールドへフォールバック
        const kId = r.kId ?? r.kIdMatch ?? '';
        const winningEId = r.winningEId ?? r.requiredEId ?? '';
        const winningFactor = r.winningFactor ?? r.resourceExample ?? '';
        const gapToAisle = r.gapToAisle ?? '';
        const reproducibility = r.reproducibility ?? '';
        const requiredAction = r.requiredAction ?? '';
        return (
          <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* ヘッダー：No. + 意味接点 */}
            <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-100">
              <span className="text-xs font-bold text-blue-700 flex-shrink-0">#{i + 1}</span>
              <span className="text-sm font-semibold text-slate-800">
                {r.mId?.replace(/^M-\d+\s*[:：]?\s*/, '') || r.mId}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {kId && <Badge color="red">{kId}</Badge>}
                {winningEId && <Badge color="green">{winningEId}</Badge>}
                {reproducibility && (
                  <Badge color={reproducibilityColor(reproducibility)}>
                    再現性：{reproducibility}
                  </Badge>
                )}
              </div>
            </div>
            {/* 本体 */}
            <div className="px-4 py-3 space-y-2.5">
              {winningFactor && (
                <div>
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">
                    競合の勝因要素
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{winningFactor}</p>
                </div>
              )}
              {gapToAisle && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">
                    自社との差分
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">{gapToAisle}</p>
                </div>
              )}
              {requiredAction && (
                <div>
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">
                    実装方針
                  </p>
                  <p className="text-xs text-blue-800 leading-relaxed">{requiredAction}</p>
                </div>
              )}
              {r.comment && (
                <div className="pt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-500 leading-relaxed">{r.comment}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// STEP5: 出現構造評価マトリクス（出現到達性 × 阻害要因 × 改善レバー）
// ============================================================
function Step6Table({ rows }: { rows: AppearanceEvalRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <Th>No.</Th>
            <Th>意味接点</Th>
            <Th>構文型</Th>
            <Th>主語型</Th>
            <Th>出現到達性</Th>
            <Th>意味的適合度</Th>
            <Th>接続整合性</Th>
            <Th>主阻害要因</Th>
            <Th>改善レバー</Th>
            <Th>コメント</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            // 新フィールド優先・旧フィールドへフォールバック
            const reachability = r.reachability ?? r.probability ?? '';
            const mainKId = r.mainKId ?? '';
            const improvementLever = r.improvementLever ?? '';
            return (
              <tr key={i} className="even:bg-slate-50">
                <Td><span className="font-bold text-slate-500">#{i + 1}</span></Td>
                <Td><span className="text-blue-700 font-medium">{r.mId?.replace(/^M-\d+\s*[:：]?\s*/, '') || r.mId}</span></Td>
                <Td><Badge color="purple">{r.tId}</Badge></Td>
                <Td><Badge color="orange">{r.aId}</Badge></Td>
                <Td><Badge color={reachabilityColor(reachability)}>{reachability}</Badge></Td>
                <Td><Badge color={fitBadgeColor(r.semanticFit)}>{r.semanticFit}</Badge></Td>
                <Td><Badge color={fitBadgeColor(r.connectionFit)}>{r.connectionFit}</Badge></Td>
                <Td>
                  {mainKId && mainKId !== 'なし'
                    ? <Badge color="red">{mainKId}</Badge>
                    : <span className="text-slate-400">なし</span>}
                </Td>
                <Td wrap>{improvementLever}</Td>
                <Td wrap>{r.comment}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 出現設計サマリ
// ============================================================
function SummaryBlock({ summary }: { summary: Phase2PerPID['appearanceSummary'] }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-xs font-bold text-blue-700 mb-1">全体印象</p>
        <p className="text-xs text-slate-700">{summary.overallImpression}</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded p-3">
        <p className="text-xs font-bold text-green-700 mb-1">注目構文</p>
        <p className="text-xs text-slate-700">{summary.keyBun}</p>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
        <p className="text-xs font-bold text-yellow-700 mb-1">補完要否</p>
        <p className="text-xs text-slate-700">{summary.complementNeeds}</p>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded p-3">
        <p className="text-xs font-bold text-purple-700 mb-1">実装提案</p>
        <p className="text-xs text-slate-700">{summary.implementationProposal}</p>
      </div>
    </div>
  );
}

// ============================================================
// Evidence type 表示定義
// ============================================================
const EVIDENCE_TYPE_DISPLAY: Record<EvidenceType, { label: string; color: string }> = {
  case:         { label: '実績・事例',       color: 'blue'   },
  client:       { label: '顧客・取引先',     color: 'violet' },
  feature:      { label: '特徴・機能',       color: 'teal'   },
  metric:       { label: '数値実績',         color: 'green'  },
  credential:   { label: '認定・受賞',       color: 'amber'  },
  review:       { label: 'レビュー・評価',   color: 'pink'   },
  media:        { label: 'メディア掲載',     color: 'orange' },
  method:       { label: '独自手法',         color: 'indigo' },
  availability: { label: '提供条件',         color: 'slate'  },
  comparison:   { label: '比較・差別化',     color: 'red'    },
  other:        { label: 'その他',           color: 'gray'   },
};

const EVIDENCE_COLOR_CLASSES: Record<string, { badge: string; tab: string }> = {
  blue:   { badge: 'bg-blue-100 text-blue-800',     tab: 'bg-blue-600 text-white' },
  violet: { badge: 'bg-violet-100 text-violet-800', tab: 'bg-violet-600 text-white' },
  teal:   { badge: 'bg-teal-100 text-teal-800',     tab: 'bg-teal-600 text-white' },
  green:  { badge: 'bg-green-100 text-green-800',   tab: 'bg-green-600 text-white' },
  amber:  { badge: 'bg-amber-100 text-amber-800',   tab: 'bg-amber-600 text-white' },
  pink:   { badge: 'bg-pink-100 text-pink-800',     tab: 'bg-pink-600 text-white' },
  orange: { badge: 'bg-orange-100 text-orange-800', tab: 'bg-orange-600 text-white' },
  indigo: { badge: 'bg-indigo-100 text-indigo-800', tab: 'bg-indigo-600 text-white' },
  slate:  { badge: 'bg-slate-100 text-slate-700',   tab: 'bg-slate-600 text-white' },
  red:    { badge: 'bg-red-100 text-red-800',       tab: 'bg-red-600 text-white' },
  gray:   { badge: 'bg-gray-100 text-gray-700',     tab: 'bg-gray-600 text-white' },
};

// ============================================================
// Evidence収集パネル
// ============================================================
interface EvidenceCollectorProps {
  companyName: string;
  onAdoptedChange: (items: EvidenceItem[]) => void;
}

function EvidenceCollector({ companyName, onAdoptedChange }: EvidenceCollectorProps) {
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('公式サイト');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [candidates, setCandidates] = useState<EvidenceCandidateItem[]>([]);
  const [activeTypeTab, setActiveTypeTab] = useState<EvidenceType | 'all'>('all');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const adoptedCount = candidates.filter(c => c.status === 'adopted').length;
  const pendingCount = candidates.filter(c => c.status === 'pending').length;

  const handleExtract = async () => {
    const target = inputMode === 'url' ? urlInput.trim() : textInput.trim();
    if (!target) return;
    setIsExtracting(true);
    setExtractError('');
    setIsConfirmed(false);
    try {
      const body = inputMode === 'url'
        ? { url: target, sourceLabel, companyName }
        : { rawText: target, sourceLabel, companyName };
      const resp = await fetch('/api/evidence-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json() as { ok: boolean; items?: EvidenceCandidateItem[]; error?: string };
      if (!json.ok || !json.items) throw new Error(json.error ?? '抽出に失敗しました');
      // 既存候補とマージ（同タイトルの重複は追加しない）
      const existingTitles = new Set(candidates.map(c => c.title));
      const newItems = json.items.filter(i => !existingTitles.has(i.title));
      setCandidates(prev => [...prev, ...newItems]);
      if (inputMode === 'url') setUrlInput('');
      else setTextInput('');
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : '抽出に失敗しました');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateStatus = (id: string, status: EvidenceCandidateItem['status']) => {
    const updated = candidates.map(c => c.id === id ? { ...c, status } : c);
    setCandidates(updated);
    if (isConfirmed) syncAdopted(updated);
  };

  const syncAdopted = (items: EvidenceCandidateItem[]) => {
    const adopted: EvidenceItem[] = items
      .filter(c => c.status === 'adopted')
      .map(({ status: _s, sourceLabel: _l, ...rest }) => rest);
    onAdoptedChange(adopted);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    syncAdopted(candidates);
  };

  const handleAdoptAll = () => {
    const updated = candidates.map(c => c.status === 'pending' ? { ...c, status: 'adopted' as const } : c);
    setCandidates(updated);
    if (isConfirmed) syncAdopted(updated);
  };

  // type別グルーピング
  const typeGroups = candidates.reduce((acc, c) => {
    acc[c.type] = [...(acc[c.type] ?? []), c];
    return acc;
  }, {} as Record<string, EvidenceCandidateItem[]>);

  const availableTypes = Object.keys(typeGroups) as EvidenceType[];
  const displayedCandidates = activeTypeTab === 'all'
    ? candidates
    : (typeGroups[activeTypeTab] ?? []);

  if (candidates.length === 0 && !isExtracting) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Evidence 収集</p>
            <p className="text-xs text-slate-500 mt-0.5">URLまたはテキストからAIが根拠を自動抽出します</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('url')}
            className={`px-3 py-1 rounded text-xs font-medium ${inputMode === 'url' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >URL</button>
          <button
            onClick={() => setInputMode('text')}
            className={`px-3 py-1 rounded text-xs font-medium ${inputMode === 'text' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >テキスト貼付</button>
        </div>
        <div className="flex gap-2 items-start">
          <div className="flex-1 space-y-1.5">
            <input
              type="text"
              placeholder="抽出元ラベル（例: 公式サイト・事例ページ）"
              value={sourceLabel}
              onChange={e => setSourceLabel(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            {inputMode === 'url' ? (
              <input
                type="url"
                placeholder="https://..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleExtract()}
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            ) : (
              <textarea
                placeholder="事例・実績・特徴などのテキストを貼り付けてください"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={4}
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
              />
            )}
          </div>
          <button
            onClick={handleExtract}
            disabled={isExtracting || !(inputMode === 'url' ? urlInput.trim() : textInput.trim())}
            className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded font-medium disabled:opacity-40 hover:bg-slate-800 whitespace-nowrap mt-6"
          >{isExtracting ? '抽出中...' : '抽出'}</button>
        </div>
        {extractError && <p className="text-xs text-red-600">{extractError}</p>}
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-700">Evidence 候補</p>
          <span className="text-xs text-slate-500">
            採用 <span className="font-bold text-green-700">{adoptedCount}</span>件
            {pendingCount > 0 && <> / 未判定 {pendingCount}件</>}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pendingCount > 0 && (
            <button onClick={handleAdoptAll} className="text-xs px-2.5 py-1 bg-green-50 border border-green-300 text-green-700 rounded hover:bg-green-100">
              全て採用
            </button>
          )}
          {!isConfirmed ? (
            <button
              onClick={handleConfirm}
              disabled={adoptedCount === 0}
              className="text-xs px-3 py-1 bg-indigo-600 text-white rounded font-medium disabled:opacity-40 hover:bg-indigo-700"
            >設計に使用する</button>
          ) : (
            <span className="text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-300 text-indigo-700 rounded font-medium">
              ✓ Evidence適用中 {adoptedCount}件
            </span>
          )}
          {/* URL/テキスト追加入力 */}
          <button
            onClick={() => { setCandidates([]); setIsConfirmed(false); onAdoptedChange([]); }}
            className="text-xs px-2 py-1 text-slate-500 hover:text-red-600"
          >クリア</button>
        </div>
      </div>

      {/* 追加URL入力バー */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex gap-2 items-center">
        <div className="flex gap-1.5">
          <button onClick={() => setInputMode('url')} className={`px-2 py-0.5 rounded text-xs ${inputMode === 'url' ? 'bg-slate-200 font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>URL</button>
          <button onClick={() => setInputMode('text')} className={`px-2 py-0.5 rounded text-xs ${inputMode === 'text' ? 'bg-slate-200 font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>テキスト</button>
        </div>
        {inputMode === 'url' ? (
          <input type="url" placeholder="追加URL..." value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExtract()}
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300" />
        ) : (
          <input type="text" placeholder="テキストを追加..." value={textInput} onChange={e => setTextInput(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300" />
        )}
        <input type="text" placeholder="ラベル" value={sourceLabel} onChange={e => setSourceLabel(e.target.value)}
          className="w-24 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
        <button onClick={handleExtract} disabled={isExtracting || !(inputMode === 'url' ? urlInput.trim() : textInput.trim())}
          className="px-2.5 py-1 bg-slate-600 text-white text-xs rounded disabled:opacity-40 hover:bg-slate-700 whitespace-nowrap">
          {isExtracting ? '...' : '追加'}
        </button>
      </div>

      {/* type タブ */}
      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTypeTab('all')}
          className={`px-2.5 py-0.5 rounded text-xs font-medium ${activeTypeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >すべて {candidates.length}</button>
        {availableTypes.map(type => {
          const disp = EVIDENCE_TYPE_DISPLAY[type];
          const colorClass = EVIDENCE_COLOR_CLASSES[disp.color];
          const count = typeGroups[type]?.length ?? 0;
          return (
            <button key={type}
              onClick={() => setActiveTypeTab(type)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium ${activeTypeTab === type ? colorClass.tab : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >{disp.label} {count}</button>
          );
        })}
      </div>

      {/* 候補カード一覧 */}
      {extractError && <p className="px-4 py-2 text-xs text-red-600">{extractError}</p>}
      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {displayedCandidates.length === 0 && (
          <p className="px-4 py-4 text-xs text-slate-400 text-center">候補がありません</p>
        )}
        {displayedCandidates.map(item => {
          const disp = EVIDENCE_TYPE_DISPLAY[item.type as EvidenceType] ?? EVIDENCE_TYPE_DISPLAY.other;
          const colorClass = EVIDENCE_COLOR_CLASSES[disp.color];
          return (
            <div key={item.id} className={`px-4 py-2.5 flex gap-3 items-start ${item.status === 'rejected' ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass.badge}`}>{disp.label}</span>
                  {item.confidence === 'high' && <span className="text-xs text-green-600 font-medium">確度高</span>}
                  {item.confidence === 'low' && <span className="text-xs text-slate-400">確度低</span>}
                  <span className="text-xs text-slate-400">{item.sourceLabel}</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                <p className="text-xs text-slate-600 line-clamp-1">{item.entityRole} — {item.description}</p>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {item.status !== 'adopted' ? (
                  <button onClick={() => updateStatus(item.id, 'adopted')}
                    className="text-xs px-2 py-1 bg-green-50 border border-green-300 text-green-700 rounded hover:bg-green-100 font-medium">採用</button>
                ) : (
                  <button onClick={() => updateStatus(item.id, 'pending')}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded font-medium">✓ 採用済</button>
                )}
                {item.status !== 'rejected' ? (
                  <button onClick={() => updateStatus(item.id, 'rejected')}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-red-600">除外</button>
                ) : (
                  <button onClick={() => updateStatus(item.id, 'pending')}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-slate-700">戻す</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// P-ID 結果表示（1件）
// ============================================================
function PidResult({ result }: { result: Phase2PerPID }) {
  const [activeStep, setActiveStep] = useState<string>('step1');

  const steps = [
    { key: 'step1', label: 'STEP1 意味接点マッピング' },
    { key: 'step2', label: 'STEP2-1 意味接点サマリ' },
    { key: 'step3', label: 'STEP2-2 構文ポートフォリオ一覧' },
    { key: 'step4', label: 'STEP2-3 AI回答構文一覧' },
    { key: 'step5', label: 'STEP3 構文接続順' },
    { key: 'step6', label: 'STEP4 勝因接続マトリクス' },
    { key: 'step7', label: 'STEP5 出現構造評価マトリクス' },
    { key: 'step8', label: '出現設計サマリ' },
  ];

  return (
    <div className="space-y-4">
      {/* 評価軸パネル */}
      {result.evaluationAxes && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-indigo-700">この問いの評価軸</p>
            <p className="text-xs text-indigo-500 mt-0.5">AIがこの問いに回答する際に重視しやすい判断軸です。</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">評価軸</p>
              <div className="flex flex-wrap gap-1.5">
                {result.evaluationAxes.primaryAxes.map((axis, i) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">{axis}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">関連語彙</p>
              <div className="flex flex-wrap gap-1.5">
                {result.evaluationAxes.keyTerms.map((term, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">{term}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">期待される回答形式</p>
                <p className="text-xs text-slate-700">{result.evaluationAxes.expectedAnswerFormat}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">P-IDとの整合</p>
                <p className="text-xs text-slate-700">{result.evaluationAxes.pIdAlignment}</p>
              </div>
            </div>
            {result.evaluationAxes.evidenceHints && result.evaluationAxes.evidenceHints.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">探すべき根拠（Evidence ヒント）</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.evaluationAxes.evidenceHints.map((hint, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs">{hint}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ステップタブ */}
      <div className="flex flex-wrap gap-1">
        {steps.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStep(s.key)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeStep === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ステップ内容 */}
      <div>
        {activeStep === 'step1' && <Step1Table rows={result.mIdMapping} />}

        {activeStep === 'step2' && (
          <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500">P-ID</span>
              <p className="font-bold text-slate-800">{result.pId}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500">プロンプト例</span>
              <p className="text-slate-700">「{result.promptText}」</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-slate-500">意図の概要</span>
              <p className="text-slate-700">{result.portfolioIntro.intentSummary}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-slate-500">02 因果分析の出力（意味接点）</span>
              <p className="text-blue-700 font-medium">{result.portfolioIntro.mIdOutputs}</p>
            </div>
          </div>
        )}

        {activeStep === 'step3' && <Step2Table rows={result.portfolio} />}
        {activeStep === 'step4' && <Step3Table rows={result.afterBun} />}
        {activeStep === 'step5' && <Step4Table rows={result.connectionOrder} comment={result.connectionComment} validationResult={result.validationResult} />}
        {activeStep === 'step6' && <Step5Table rows={result.eIdComplement} />}
        {activeStep === 'step7' && <Step6Table rows={result.appearanceEval} />}
        {activeStep === 'step8' && <SummaryBlock summary={result.appearanceSummary} />}
      </div>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export function Phase2Design() {
  const { logEntries, phase1Result, phase2Result, phase0Data, setPhase2Result, setPhase, appearedChoiceMap, setAppearedChoiceMap } = useAppStore();
  // 採用済みEvidence（EvidenceCollectorから受け取り、design呼び出し時に注入）
  const [adoptedEvidence, setAdoptedEvidence] = useState<EvidenceItem[]>([]);
  // phase0Data は promptTypeId の取得に使用

  // K-IDスコアマップ: KIdScoreRow[] → Record<string, string>（K-ID → ◎/○/△/×）
  const kIdScoreMap: Record<string, string> = phase1Result?.sub3?.kIdScoreMap
    ? Object.fromEntries(phase1Result.sub3.kIdScoreMap.map(k => [k.kId, k.score]))
    : {};

  // 分析モードマップ: promptId → AnalysisMode（2層での判定を3層設計に引き継ぐ）
  const analysisModeMap = useMemo<Record<string, AnalysisMode>>(
    () => logEntries.length > 0 ? buildModeMap(logEntries) : {},
    [logEntries]
  );

  // 商材情報（phase2Result → phase0Data の順でフォールバック）
  const [companyName, setCompanyName] = useState(
    phase2Result?.companyName ?? phase0Data?.companyName ?? ''
  );
  const [productCategory, setProductCategory] = useState(
    phase2Result?.productCategory ?? phase0Data?.category ?? ''
  );
  const [productDescription, setProductDescription] = useState(phase2Result?.productDescription ?? '');

  // 商材情報 入力モード
  type InputMode = 'url' | 'pdf' | 'text';
  const [inputMode, setInputMode] = useState<InputMode>('text');

  // サイトURL取得
  const [siteUrl, setSiteUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState('');
  const [urlFetchInfo, setUrlFetchInfo] = useState('');

  const handleFetchUrl = async () => {
    if (!siteUrl.trim()) return;
    setIsFetchingUrl(true);
    setUrlFetchError('');
    setUrlFetchInfo('');
    try {
      const resp = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      const json = await safeReadApiJson(resp) as { ok: boolean; text?: string; totalLength?: number; rawLength?: number; error?: string };
      if (!json.ok) throw new Error(json.error ?? '取得に失敗しました');
      const structured = json.text ?? '';
      setProductDescription(structured);
      setUrlFetchInfo(`AIが引用しやすい形に構造化しました（${structured.length.toLocaleString()}文字）`);
    } catch (e) {
      setUrlFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // PDF テキスト抽出
  const [isPdfExtracting, setIsPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');

  const handlePdfFile = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setPdfError('PDFファイルを選択してください');
      return;
    }
    setIsPdfExtracting(true);
    setPdfError('');
    setPdfFileName(file.name);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: unknown) => (item as { str?: string }).str ?? '')
          .join(' ');
        fullText += pageText + '\n';
      }

      const trimmed = fullText.trim().slice(0, 3000);
      setProductDescription(trimmed);
      setPdfFileName(`${file.name}（${pdf.numPages}ページ・${trimmed.length}文字）`);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF読み込みに失敗しました');
    } finally {
      setIsPdfExtracting(false);
    }
  };

  // 説明文が入力されているか（生成ボタン活性化の条件）
  const isDescriptionReady = productDescription.trim().length > 0;

  // P-IDごとの生成状態（keyed by promptId: "P-01", "P-02", …）
  const [generationMap, setGenerationMap] = useState<Record<string, GenerationState>>(() => {
    if (phase2Result?.perPID.length) {
      return Object.fromEntries(
        phase2Result.perPID.map(p => [
          // "P-01-01" → "P-01"
          p.pId.split('-').slice(0, 2).join('-'),
          { result: p, isGenerating: false, generatingStep: null, error: null } satisfies GenerationState,
        ])
      );
    }
    return {};
  });

  // 展開状態
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // appearedChoiceMap はZustandで永続管理（フェーズ遷移をまたいで保持）
  // 'reinforce' = 維持・強化対象にする / 'skip' = 今回は設計対象外にする
  // useAppStore から直接取得済み（上部の分割代入を参照）

  // logEntries から P-IDグループを自動生成
  // promptId    = 入力順ログ識別子（P-01, P-02...）: SB-ID命名に使用
  // promptTypeId = 問いの型（P-01〜P-06）: M-ID制約に使用
  // secondaryPIds = 補助P-ID（Phase0で取得済み）: AIへの補助文脈として渡す
  const pidGroups = useMemo(() => {
    const map: Record<string, string> = {};
    logEntries.forEach(e => {
      if (!map[e.promptId]) map[e.promptId] = e.prompt;
    });
    return Object.entries(map)
      .map(([promptId, prompt]) => {
        // P-01 → index 0, P-02 → index 1 ...
        const idx = parseInt(promptId.replace('P-', ''), 10) - 1;
        const promptItem = phase0Data?.prompts[idx];
        const promptTypeId =
          promptItem?.promptTypeId && promptItem.promptTypeId !== ''
            ? promptItem.promptTypeId
            : promptId; // 未判定の場合は promptId にフォールバック
        const secondaryPIds = promptItem?.promptTypeSecondary ?? [];
        return { promptId, prompt, promptTypeId, secondaryPIds };
      })
      .sort((a, b) => a.promptId.localeCompare(b.promptId));
  }, [logEntries, phase0Data]);

  // 単一P-ID 出現設計生成（2ステップ）
  // promptId     = 入力順ログ識別子（例: P-01）→ SB-ID命名に使用
  // promptTypeId = 問いの型（例: P-02）→ M-ID制約・P-IDラベルに使用
  // secondaryPIds = 補助P-ID → AIへの補助文脈として渡す（M-ID固定順を上書きしない）
  const generateForPid = async (promptId: string, promptText: string, promptTypeId: string, analysisMode?: AnalysisMode, secondaryPIds?: string[]) => {
    if (!companyName.trim()) { alert('会社名を入力してください'); return; }

    const subId = `${promptId}-01`;         // SB-ID命名用（位置番号ベース）
    const typeSubId = `${promptTypeId}-01`; // M-ID制約用（問いの型ベース）
    const pIdObj = P_IDS.find(p => p.pId === promptTypeId);
    const pLabel = pIdObj ? `${pIdObj.pId} ${pIdObj.label}` : promptTypeId;
    const commonParams = {
      companyName,
      productCategory,
      productDescription,
      pId: typeSubId,       // M-ID制約: 問いの型
      sbIdPromptId: subId,  // SB-ID命名: 位置番号
      pLabel,
      promptText,
      kIdScoreMap: Object.keys(kIdScoreMap).length > 0 ? kIdScoreMap : undefined,
      analysisMode,         // 2層分析モード: success_observation 時はK-ID改善設計を抑制
      secondaryPIds: secondaryPIds && secondaryPIds.length > 0 ? secondaryPIds : undefined,
    };

    // ── Step 0: 評価軸抽出 ────────────────────────────────────
    setGenerationMap(prev => ({
      ...prev,
      [promptId]: { result: prev[promptId]?.result ?? null, isGenerating: true, generatingStep: 0, error: null },
    }));

    let evaluationAxes: EvaluationAxes | undefined;
    try {
      const respAxes = await fetch('/api/evaluate-axes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText,
          pId: typeSubId,
          pLabel,
          companyName,
          productCategory,
          productDescription,
        }),
      });
      const jsonAxes = await safeReadApiJson(respAxes) as { ok: boolean; data?: EvaluationAxes; error?: string };
      if (jsonAxes.ok && jsonAxes.data) evaluationAxes = jsonAxes.data;
    } catch {
      // 評価軸取得失敗は無視して既存フローを継続
    }

    // ── STEP1〜3 ──────────────────────────────────────────────
    setGenerationMap(prev => ({
      ...prev,
      [promptId]: { result: prev[promptId]?.result ?? null, isGenerating: true, generatingStep: 1, error: null },
    }));

    try {
      const resp1 = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commonParams,
          evaluationAxes,
          adoptedEvidence: adoptedEvidence.length > 0 ? adoptedEvidence : undefined,
        }),
      });
      const json1 = await safeReadApiJson(resp1) as { ok: boolean; data?: ApiDesignStep1Response; error?: string };
      if (!json1.ok || !json1.data) throw new Error(json1.error ?? 'API エラー（STEP1〜3）');

      const d1 = json1.data;

      // ── STEP4 + validationResult ──────────────────────────
      setGenerationMap(prev => ({
        ...prev,
        [promptId]: { result: prev[promptId]?.result ?? null, isGenerating: true, generatingStep: 2, error: null },
      }));

      // 現在のP-IDに関係するeIdMatrix行だけを絞り込んで渡す
      const filteredEIdMatrix = phase1Result?.sub3?.eIdMatrix?.filter(
        row => row.promptTypeId === promptTypeId
      ) ?? [];

      const resp2 = await fetch('/api/design-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commonParams,
          step1: d1.step1,
          step3: d1.step3,
          eIdMatrix: filteredEIdMatrix.length > 0 ? filteredEIdMatrix : undefined,
        }),
      });
      const json2 = await safeReadApiJson(resp2) as { ok: boolean; data?: ApiDesignStep2Response; error?: string };
      if (!json2.ok || !json2.data) throw new Error(json2.error ?? 'API エラー（STEP4）');

      const d2 = json2.data;

      // ── STEP5 + STEP6 + サマリ ────────────────────────────
      setGenerationMap(prev => ({
        ...prev,
        [promptId]: { result: prev[promptId]?.result ?? null, isGenerating: true, generatingStep: 3, error: null },
      }));

      // step3Slim: sbId/mId/tId/aId のみ（afterTextはSTEP5/6で不要）
      const step3Slim = (d1.step3 ?? []).map((r: { sbId?: string; mId?: string; tId?: string; aId?: string }) => ({
        sbId: r.sbId, mId: r.mId, tId: r.tId, aId: r.aId,
      }));

      const resp3 = await fetch('/api/design-step3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commonParams,
          step4: d2.step4,
          step3Slim,
          eIdMatrix: filteredEIdMatrix.length > 0 ? filteredEIdMatrix : undefined,
        }),
      });
      const json3 = await safeReadApiJson(resp3) as { ok: boolean; data?: ApiDesignStep3Response; error?: string };
      if (!json3.ok || !json3.data) throw new Error(json3.error ?? 'API エラー（STEP5〜6）');

      const d3 = json3.data;

      const perPID: Phase2PerPID = {
        pId: subId,
        promptTypeId,
        promptTypeLabel: pIdObj?.label ?? '',
        promptText,
        evaluationAxes,
        mIdMapping: d1.step1 ?? [],
        portfolioIntro: d1.portfolioIntro ?? { intentSummary: '', mIdOutputs: '' },
        portfolio: d1.step2 ?? [],
        afterBun: d1.step3 ?? [],
        connectionOrder: d2.step4 ?? [],
        connectionComment: d2.connectionComment ?? '',
        validationResult: d2.validationResult,
        eIdComplement: d3.step5 ?? [],
        appearanceEval: d3.step6 ?? [],
        appearanceSummary: d3.summary ?? { overallImpression: '', keyBun: '', complementNeeds: '', implementationProposal: '' },
        generatedAt: new Date().toISOString(),
      };

      setGenerationMap(prev => {
        const next = { ...prev, [promptId]: { result: perPID, isGenerating: false, generatingStep: null, error: null } };
        // Zustandに保存
        const allResults = Object.values(next)
          .filter((s): s is GenerationState & { result: Phase2PerPID } => s.result !== null)
          .map(s => s.result);
        setPhase2Result({
          companyName,
          productCategory,
          productDescription,
          perPID: allResults,
          generatedAt: new Date().toISOString(),
        });
        return next;
      });
      setExpandedIds(prev => new Set([...prev, promptId]));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerationMap(prev => ({
        ...prev,
        [promptId]: { result: prev[promptId]?.result ?? null, isGenerating: false, generatingStep: null, error: msg },
      }));
    }
  };

  const hasAnyResult = Object.values(generationMap).some(s => s.result !== null);

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">03 出現設計</h1>
        <p className="text-slate-500 text-sm mt-1">
          01 ログ取得・02 因果分析の結果を引き継ぎ、P-IDごとにAfter構文設計（STEP1〜5）を生成します
        </p>
      </div>

      {/* ① 商材情報入力 */}
      <Card>
        <CardHeader
          title="① 商材情報"
          subtitle="会社名・説明文を入力してください。説明文が入力されると生成ボタンが活性化します"
        />
        <CardBody>
          <div className="space-y-4">
            {/* 会社名・カテゴリ */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">会社名 *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="例：株式会社UltraImpression"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">商材カテゴリ</label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={e => setProductCategory(e.target.value)}
                  placeholder="例：広告代理店（広告代理サービス）"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* 説明文 入力モード切替タブ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600">
                  説明文（訴求文）
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                  {([
                    { mode: 'url' as InputMode, icon: '🔗', label: 'サイトURL' },
                    { mode: 'pdf' as InputMode, icon: '📄', label: 'PDF添付' },
                    { mode: 'text' as InputMode, icon: '✏️', label: 'テキスト入力' },
                  ] as const).map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setInputMode(mode)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        inputMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* サイトURL モード */}
              {inputMode === 'url' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={siteUrl}
                      onChange={e => { setSiteUrl(e.target.value); setUrlFetchError(''); setUrlFetchInfo(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleFetchUrl(); }}
                      placeholder="https://example.com"
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={handleFetchUrl}
                      disabled={isFetchingUrl || !siteUrl.trim()}
                      className={`px-4 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                        isFetchingUrl || !siteUrl.trim()
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isFetchingUrl ? (
                        <><span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />AI構造化中...</>
                      ) : '取得・構造化'}
                    </button>
                  </div>
                  {urlFetchError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">⚠️ {urlFetchError}</p>
                  )}
                  {urlFetchInfo && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">✅ {urlFetchInfo}</p>
                  )}
                  {productDescription && (
                    <textarea
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      rows={6}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                    />
                  )}
                </div>
              )}

              {/* PDF添付 モード */}
              {inputMode === 'pdf' && (
                <div className="space-y-2">
                  <label
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                      isPdfExtracting ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={isPdfExtracting}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) { setPdfFileName(''); setPdfError(''); handlePdfFile(file); }
                        e.target.value = '';
                      }}
                    />
                    {isPdfExtracting ? (
                      <><span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" /><span className="text-sm text-blue-600">テキストを抽出中...</span></>
                    ) : (
                      <><span className="text-3xl mb-2">📄</span><span className="text-sm font-medium text-slate-700">PDFをクリックまたはドロップして選択</span><span className="text-xs text-slate-400 mt-1">PDF形式のみ対応</span></>
                    )}
                  </label>
                  {pdfError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">⚠️ {pdfError}</p>
                  )}
                  {pdfFileName && !isPdfExtracting && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">✅ {pdfFileName}</p>
                  )}
                  {productDescription && !isPdfExtracting && (
                    <textarea
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      rows={6}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                    />
                  )}
                </div>
              )}

              {/* テキスト入力 モード */}
              {inputMode === 'text' && (
                <textarea
                  value={productDescription}
                  onChange={e => setProductDescription(e.target.value)}
                  rows={7}
                  placeholder={`AIに引用されやすい情報を入力してください：\n・強み・差別化ポイント（他社と何が違うか）\n・具体的な実績・数値（あれば）\n・ターゲット・対象業種\n・創業思想・なぜこの事業をやっているか`}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              )}

              {/* 入力ステータスインジケーター */}
              <div className={`text-xs flex items-center gap-1.5 ${isDescriptionReady ? 'text-green-600' : 'text-slate-400'}`}>
                {isDescriptionReady
                  ? <><span>✅</span><span>説明文が入力されました（{productDescription.trim().length}文字）— 生成ボタンが活性化しています</span></>
                  : <><span>⚪</span><span>説明文を入力すると「生成」ボタンが活性化します</span></>
                }
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Evidence 収集パネル */}
      <Card>
        <CardHeader
          title="② Evidence 収集（任意）"
          subtitle="URLまたはテキストからAIが根拠を抽出します。採用済みEvidenceは出現設計に自動注入されます"
        />
        <CardBody>
          <EvidenceCollector
            companyName={companyName}
            onAdoptedChange={setAdoptedEvidence}
          />
          {adoptedEvidence.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-medium">
                Evidence {adoptedEvidence.length}件が出現設計に適用されます
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ③ 引き継いだプロンプト（読み取り専用） */}
      <Card>
        <CardHeader
          title="③ 引き継いだプロンプト（読み取り専用）"
          subtitle="01 ログ取得・02 因果分析から自動引き継ぎされたP-IDとプロンプトです"
        />
        <CardBody>
          {pidGroups.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
              <p>01 ログ取得のデータがありません</p>
              <button
                onClick={() => setPhase(1)}
                className="mt-3 text-indigo-600 text-xs underline"
              >
                ← 01 ログ取得へ戻る
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {pidGroups.map(({ promptId, prompt, promptTypeId }) => {
                const promptNum = promptId.replace('P-', '');
                const pIdObjReadonly = P_IDS.find(p => p.pId === promptTypeId);
                return (
                  <div key={promptId} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex-shrink-0 w-28">
                      <div className="text-xs font-semibold text-slate-600">Prompt #{promptNum}</div>
                      <div className="text-[10px] text-indigo-600 mt-0.5 leading-tight">
                        P-ID：{promptTypeId}{pIdObjReadonly ? ` ${pIdObjReadonly.label}` : ''}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 flex-1 break-words">{prompt}</p>
                  </div>
                );
              })}
              <p className="text-xs text-slate-400 pt-1">
                {pidGroups.length}件のプロンプトを引き継ぎました。編集する場合は 01 ログ取得に戻ってください。
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ③ 出現設計生成 */}
      {pidGroups.length > 0 && (
        <Card>
          <CardHeader
            title="③ 出現設計生成"
            subtitle={isDescriptionReady
              ? 'P-IDごとに「生成」ボタンを押すとAfter構文設計（STEP1〜5）を実行します'
              : '⚠️ ① 商材情報の説明文を入力すると生成ボタンが活性化します'}
          />
          <CardBody>
            <div className="space-y-4">
              {pidGroups.map(({ promptId, prompt, promptTypeId, secondaryPIds }) => {
                const state = generationMap[promptId] ?? { result: null, isGenerating: false, error: null };
                // ラベル表示は問いの型（promptTypeId）を優先
                const pIdObj = P_IDS.find(p => p.pId === promptTypeId);
                // 既出現問い判定（analysisModeMap が success_observation = 全ログでappeared=true）
                const isAlreadyAppeared = analysisModeMap[promptId] === 'success_observation';
                const appearedChoice = appearedChoiceMap[promptId];
                // 生成ボタン表示条件（未選択・スキップ時は非表示）
                const showGenerateButton = !isAlreadyAppeared || appearedChoice === 'reinforce';
                // 「結果を見る」ボタンは result があれば appearedChoice に関係なく常に表示
                // （画面帰還後に appearedChoiceMap がリセットされても結果にアクセスできるようにするため）
                const showResultButton = !!state.result;

                return (
                  <div key={promptId} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* ヘッダー行 */}
                    <div className="bg-slate-50 p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-shrink-0">
                          <div className="text-xs font-semibold text-slate-700">
                            Prompt #{promptId.replace('P-', '')}
                          </div>
                          <div className="text-[10px] text-indigo-600 mt-0.5 leading-tight">
                            P-ID：{promptTypeId}{pIdObj ? ` ${pIdObj.label}` : ''}
                          </div>
                        </div>
                        <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">
                          「{prompt}」
                        </span>
                        {(showGenerateButton || showResultButton) && (
                          <div className="flex gap-2 flex-shrink-0">
                            {showGenerateButton && (
                              <Button
                                onClick={() => generateForPid(promptId, prompt, promptTypeId, analysisModeMap[promptId], secondaryPIds)}
                                disabled={state.isGenerating || !isDescriptionReady}
                                size="sm"
                                variant="primary"
                              >
                                {state.isGenerating
                                  ? state.generatingStep === 0 ? '評価軸を分析中...' : state.generatingStep === 1 ? 'STEP1〜3 生成中...' : state.generatingStep === 2 ? 'STEP4 生成中...' : 'STEP5〜6 生成中...'
                                  : state.result ? '再生成' : '生成'}
                              </Button>
                            )}
                            {showResultButton && (
                              <Button
                                onClick={() => toggleExpand(promptId)}
                                size="sm"
                                variant="secondary"
                              >
                                {expandedIds.has(promptId) ? '▲ 閉じる' : '▼ 結果を見る'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* P-02/P-03 比較型注釈 */}
                      {(promptTypeId === 'P-02' || promptTypeId === 'P-03') && (
                        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                          <span className="flex-shrink-0 mt-0.5">⚠</span>
                          <span>
                            <span className="font-semibold">比較型の問いです。</span>
                            AIはカテゴリ全体を比較・ランキングする構成になりやすく、特定企業が埋もれるリスクがあります。「比較軸の提示（M-08）」や「自社の特化ポジション」を意識した設計を推奨します。
                          </span>
                        </div>
                      )}

                      {/* 既出現問い：選択バナー（未選択時） */}
                      {isAlreadyAppeared && !appearedChoice && (
                        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-700 mb-1">✅ この問いはすでに出現しています</p>
                          <p className="text-xs text-slate-600 mb-3">
                            Ver1では出現品質分析（位置・文脈・誤認）は行いません。出現維持・強化の設計対象として扱うか、今回はスキップするかを選択してください。
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setAppearedChoiceMap({ ...appearedChoiceMap, [promptId]: 'reinforce' })}
                            >
                              維持・強化対象にする
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setAppearedChoiceMap({ ...appearedChoiceMap, [promptId]: 'skip' })}
                            >
                              今回は設計対象外にする
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 既出現問い：設計対象外バナー */}
                      {isAlreadyAppeared && appearedChoice === 'skip' && (
                        <div className="mt-3 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-slate-500">🚫 今回は設計対象外にしています</span>
                          <button
                            className="text-xs text-indigo-500 hover:underline"
                            onClick={() => setAppearedChoiceMap(
                              Object.fromEntries(Object.entries(appearedChoiceMap).filter(([k]) => k !== promptId))
                            )}
                          >
                            選択を変更する
                          </button>
                        </div>
                      )}

                      {/* 既出現問い：維持・強化モードバッジ */}
                      {isAlreadyAppeared && appearedChoice === 'reinforce' && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] bg-green-100 text-green-700 font-medium rounded px-2 py-0.5">
                            出現維持・強化モードで設計します
                          </span>
                          <button
                            className="text-xs text-slate-400 hover:underline"
                            onClick={() => setAppearedChoiceMap(
                              Object.fromEntries(Object.entries(appearedChoiceMap).filter(([k]) => k !== promptId))
                            )}
                          >
                            選択を変更する
                          </button>
                        </div>
                      )}

                      {state.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          ⚠️ {state.error}
                        </div>
                      )}

                      {state.isGenerating && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                          {state.generatingStep === 0
                            ? '問いの評価軸を分析中です...'
                            : state.generatingStep === 1
                            ? 'STEP1〜3（M-ID接点・構文ポートフォリオ・After構文）を生成中です...'
                            : state.generatingStep === 2
                            ? 'STEP4（構文接続順の検証・補正）を生成中です...'
                            : 'STEP5〜6（勝因マトリクス・出現構造評価・サマリ）を生成中です...'}
                        </div>
                      )}
                    </div>

                    {/* 結果展開 */}
                    {state.result && expandedIds.has(promptId) && !(isAlreadyAppeared && appearedChoice === 'skip') && (
                      <div className="p-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge color="blue">{state.result.pId}</Badge>
                          <Badge color="green">生成完了</Badge>
                        </div>
                        <PidResult result={state.result} />
                      </div>
                    )}

                    {/* 結果あり・折りたたみ */}
                    {state.result && !expandedIds.has(promptId) && !(isAlreadyAppeared && appearedChoice === 'skip') && (
                      <div className="px-4 py-2 border-t border-slate-200 bg-green-50">
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <span>✅ 生成完了</span>
                          <span>構文: {state.result.portfolio.length}件</span>
                          <span>|</span>
                          <span>意味接点: {state.result.mIdMapping.length}件選択</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* フェーズ移動 */}
      <div className="flex justify-between pt-2">
        <Button onClick={() => setPhase(2)} variant="secondary" size="sm">
          ← 02 因果分析に戻る
        </Button>
        {hasAnyResult && (
          <Button onClick={() => setPhase(4)} size="lg">
            04 突合検証へ進む →
          </Button>
        )}
      </div>
    </div>
  );
}
