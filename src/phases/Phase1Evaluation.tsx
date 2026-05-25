import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  analyzeLogEntries,
  buildSourceMatrix, buildAppearanceRates, buildOutputReasons, buildOutputSummary,
  assignStructureIds, buildIdMatrix,
  assignKIds, extractKIds, assignEIds, buildKIdMatrix, buildEIdMatrix, buildKIdScoreMap, buildStructureSummary,
  buildStrategyMatrix, buildSuccessPatterns, buildBlockPatterns, buildPriorityMatrix,
  buildModeMap,
} from '../store/analysisEngine';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import type { LogEntry, Phase1Result, SourceCat, StrategyRow, CompetitorAnalysisResult, AnalysisMode } from '../types';
import { SOURCE_CATS } from '../types';

// =====================================================================
// 定数
// =====================================================================

// C-IDは新6分類（C-01〜C-06）。C-07〜C-10は廃止済みで新規付与しない（既存データ互換のみ）。
const ALL_C_IDS = ['C-01','C-02','C-03','C-04','C-05','C-06'];
const ALL_A_IDS = ['A-01','A-02','A-03','A-04','A-05','A-06','A-07','A-08','A-09','A-10'];
const ALL_AP_IDS = ['AP-01','AP-02','AP-03','AP-04','AP-05'];
const BATCH_SIZE = 10;

// =====================================================================
// AI分類API呼び出し
// =====================================================================

interface ClassifyEntry { id: string; promptId: string; output: string; appeared: boolean }
interface ClassifyResult { id: string; cId: string; aId: string; apId: string; sourceCategory: string; kIds?: string[]; kIdReasons?: Record<string, string> }

async function classifyBatch(entries: ClassifyEntry[]): Promise<ClassifyResult[]> {
  const resp = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  const data = await resp.json() as { ok: boolean; results?: ClassifyResult[]; error?: string };
  if (!data.ok) throw new Error(data.error ?? 'API Error');
  return data.results ?? [];
}

// =====================================================================
// ユーティリティ
// =====================================================================

function runFullAnalysis(
  entries: LogEntry[],
  competitorAnalysis?: CompetitorAnalysisResult | null,
  companyName = '',
): Phase1Result {
  const sourceMatrix    = buildSourceMatrix(entries);
  const appearanceRates = buildAppearanceRates(entries);
  const outputReasons   = buildOutputReasons(entries);
  const summary         = buildOutputSummary(sourceMatrix, appearanceRates, entries);

  const e2 = assignStructureIds(entries);
  const cIdMatrix  = buildIdMatrix(e2, 'cId',  ALL_C_IDS);
  const aIdMatrix  = buildIdMatrix(e2, 'aId',  ALL_A_IDS);
  const apIdMatrix = buildIdMatrix(e2, 'apId', ALL_AP_IDS);

  // P-IDごとの分析モードを事前計算して K/E 発火条件を制御する
  const modeMap = buildModeMap(e2);
  const e3 = e2.map(e => {
    const kw = assignKIds(e, modeMap[e.promptId], competitorAnalysis);
    return {
      ...e,
      kIds: extractKIds(kw),
      kIdWeights: kw,
      eIds: assignEIds(e, modeMap[e.promptId]),
    };
  });
  const kIdMatrix        = buildKIdMatrix(e3);
  // E-ID勝因接続マトリクス: competitorAnalysis があれば詳細エンティティ付きで生成
  const eIdMatrix        = buildEIdMatrix(e3, competitorAnalysis, companyName);
  const kIdScoreMap      = buildKIdScoreMap(e3);
  // 4-4 構造接続サマリ: eIdMatrix.winningEId を優先ソースとして渡す（優先1）
  const structureSummary = buildStructureSummary(e3, eIdMatrix);

  // 戦略提案フェーズ
  const strategyMatrix   = buildStrategyMatrix(e3);
  const successPatterns  = buildSuccessPatterns(e3);
  const blockPatterns    = buildBlockPatterns(e3);
  const priorityMatrix   = buildPriorityMatrix(e3);

  return {
    sub1: { sourceMatrix, appearanceRates, outputReasons, summary, analyzedAt: new Date().toISOString() },
    sub2: { cIdMatrix, aIdMatrix, apIdMatrix, analyzedAt: new Date().toISOString() },
    sub3: { kIdMatrix, eIdMatrix, kIdScoreMap, structureSummary, analyzedAt: new Date().toISOString() },
    strategy: { successPatterns, blockPatterns, strategyMatrix, priorityMatrix, analyzedAt: new Date().toISOString() },
  };
}

// =====================================================================
// 競合分析APIコール（スタンドアロン）
// runClassification / runWithoutApi から呼ぶ共通関数
// =====================================================================

async function doCompetitorAnalysis(entries: LogEntry[]): Promise<CompetitorAnalysisResult> {
  const groupedFalse: Record<string, string[]> = {};
  const groupedTrue: Record<string, string[]> = {};
  const promptTexts: Record<string, string> = {};

  entries.forEach(e => {
    if (!e.aiOutput) return;
    if (!promptTexts[e.promptId] && e.prompt) promptTexts[e.promptId] = e.prompt;
    if (e.appeared) {
      if (!groupedTrue[e.promptId]) groupedTrue[e.promptId] = [];
      groupedTrue[e.promptId].push(e.aiOutput.slice(0, 400));
    } else {
      if (!groupedFalse[e.promptId]) groupedFalse[e.promptId] = [];
      groupedFalse[e.promptId].push(e.aiOutput.slice(0, 400));
    }
  });

  const allPIds = [...new Set([...Object.keys(groupedFalse), ...Object.keys(groupedTrue)])].sort();
  const pIdGroups = allPIds.map(pId => ({
    pId,
    promptTypeId: pId.split('-').slice(0, 2).join('-'),
    promptText: promptTexts[pId] ?? '',
    appearedFalseOutputs: (groupedFalse[pId] ?? []).slice(0, 8),
    appearedTrueOutputs:  (groupedTrue[pId]  ?? []).slice(0, 4),
  }));

  const resp = await fetch('/api/competitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pIdGroups, kIdSummary: '' }),
  });
  const data = await resp.json() as { ok: boolean; data?: CompetitorAnalysisResult; error?: string };
  if (!data.ok) throw new Error(data.error ?? 'API Error');
  return { ...(data.data as CompetitorAnalysisResult), analyzedAt: new Date().toISOString() };
}

// =====================================================================
// UIサブコンポーネント
// =====================================================================

function SubTabs({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div className="flex gap-1 flex-wrap mb-4">
      {tabs.map((t, i) => (
        <button key={i} onClick={() => onChange(i)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            active === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function MatrixTable({ headers, rows, highlightFn }: {
  headers: string[];
  rows: string[][];
  highlightFn?: (ri: number, ci: number, val: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs whitespace-nowrap border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {headers.map((h, i) => (
              <th key={i} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50">
              {row.map((cell, ci) => (
                <td key={ci} className={`border border-slate-200 px-2 py-1.5 ${
                  ci === 0 ? 'font-medium text-slate-700' : `text-center ${highlightFn ? highlightFn(ri, ci, cell) : 'text-slate-600'}`
                }`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ num, title, subtitle, done }: { num: string; title: string; subtitle: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
        {done ? '✓' : num}
      </div>
      <div>
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round(current / total * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>分類中... {current} / {total} 件</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// =====================================================================
// 競合出現構造分析カード（Phase1 独立コンポーネント）
// =====================================================================

function CompetitorAnalysisCard({
  logEntries,
  competitorAnalysis,
  isAnalyzing,
  error,
  tab,
  pIdTab,
  onRun,
  onClear,
  onTabChange,
  onPIdTabChange,
}: {
  logEntries: LogEntry[];
  competitorAnalysis: CompetitorAnalysisResult | null;
  isAnalyzing: boolean;
  error: string;
  tab: number;
  pIdTab: number;
  onRun: () => void;
  onClear: () => void;
  onTabChange: (i: number) => void;
  onPIdTabChange: (i: number) => void;
}) {
  // P-IDごとの出力件数（ヘッダー用）
  const pIdCounts = useMemo(() => {
    const map: Record<string, number> = {};
    logEntries.forEach(e => { map[e.promptId] = (map[e.promptId] ?? 0) + 1; });
    return map;
  }, [logEntries]);

  // entityType バッジ
  const entityTypeLabel: Record<string, string> = {
    company: '会社', service: 'サービス', tool: 'ツール', media: 'メディア', concept: '概念',
  };
  const entityTypeColor: Record<string, string> = {
    company: 'bg-purple-100 text-purple-700 border-purple-200',
    service: 'bg-blue-100 text-blue-700 border-blue-200',
    tool: 'bg-orange-100 text-orange-700 border-orange-200',
    media: 'bg-teal-100 text-teal-700 border-teal-200',
    concept: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  // appearedContext バッジ
  const appearedContextLabel: Record<string, string> = {
    appeared_false: '非出現主軸', appeared_true: '出現参考', mixed: '混在',
  };
  const appearedContextColor: Record<string, string> = {
    appeared_false: 'bg-red-100 text-red-700 border-red-200',
    appeared_true: 'bg-green-100 text-green-700 border-green-200',
    mixed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  const pIds = competitorAnalysis
    ? Object.keys(competitorAnalysis.entityByPId)
    : [];

  return (
    <Card>
      <CardBody>
        <SectionHeader
          num="2"
          title="競合出現構造分析"
          subtitle="K/E因果分析の前提観測。GPTが実際に出現させた競合エンティティ・語彙パターンを把握します"
          done={!!competitorAnalysis}
        />

        {!competitorAnalysis ? (
          <div className="space-y-4">
            {/* 説明 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">💡 K/E因果分析の必須前提（初回分析で自動実行）</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                出力本文（全{logEntries.length}件）をAIで解析し、GPTが実際に出現させている
                企業名・サービス名・語彙パターンを特定します。<br />
                「どの競合が・どのような構文で・なぜ出現しているか」を把握することが、
                K-ID（自社の敗因）・E-ID（競合の勝因）分析の前提情報となります。<br />
                <span className="font-semibold">この分析は「分析開始」時に自動実行されます。</span>
                追加で再分析したい場合は下のボタンを使用してください。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="lg"
                loading={isAnalyzing}
                disabled={isAnalyzing}
                onClick={onRun}
              >
                {isAnalyzing ? '分析中...' : '競合出現構造を分析する（LLM）'}
              </Button>
            </div>

            {error && (
              <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
                ⚠️ {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <SubTabs
              tabs={['エンティティランキング', '語彙パターン分析', '競合構造サマリー']}
              active={tab}
              onChange={onTabChange}
            />

            {/* ① エンティティランキング */}
            {tab === 0 && (
              <div className="space-y-5">
                <p className="text-xs text-slate-500">
                  appeared_false（対象商材が出なかった回答）を主軸に抽出。代わりに何が・どのタイプで・どの役割で出現したかを観測します。
                </p>

                {/* 全体統合ランキング */}
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-2">📊 全P-ID統合ランキング（上位10件）</div>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          {['順位', 'エンティティ', 'タイプ', '文脈', '出現頻度', '出現P-ID', '主な出現構文パターン'].map((h, i) => (
                            <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {competitorAnalysis.entityRanking.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 text-center font-bold text-slate-500 w-10">
                              {r.rank <= 3
                                ? <span className={r.rank === 1 ? 'text-yellow-500' : r.rank === 2 ? 'text-slate-400' : 'text-orange-400'}>
                                    {['🥇','🥈','🥉'][r.rank - 1]}
                                  </span>
                                : r.rank}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800">{r.entity}</td>
                            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                              {r.entityType ? (
                                <span className={`text-xs border px-1.5 py-0.5 rounded font-medium ${entityTypeColor[r.entityType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {entityTypeLabel[r.entityType] ?? r.entityType}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                              {r.appearedContext ? (
                                <span className={`text-xs border px-1.5 py-0.5 rounded font-medium ${appearedContextColor[r.appearedContext] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {appearedContextLabel[r.appearedContext] ?? r.appearedContext}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className="h-full rounded-full bg-indigo-400"
                                    style={{
                                      width: `${Math.min(100, (r.count / (competitorAnalysis.entityRanking[0]?.count || 1)) * 100)}%`
                                    }}
                                  />
                                </div>
                                <span className="font-semibold text-indigo-700">{r.count}件</span>
                              </div>
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {r.pIds.map((p, j) => (
                                  <span key={j} className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-1.5 py-0.5 rounded font-mono">{p}</span>
                                ))}
                              </div>
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 max-w-xs leading-relaxed">{r.dominantStructure}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* P-ID別ランキング */}
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-2">🗂 P-ID別 出現エンティティランキング（上位5件）</div>
                  <SubTabs
                    tabs={pIds.map(p => `${p}（${pIdCounts[p] ?? 0}件）`)}
                    active={pIdTab}
                    onChange={onPIdTabChange}
                  />
                  {pIds[pIdTab] && (
                    <div className="overflow-x-auto mt-2">
                      <table className="text-xs border-collapse w-full">
                        <thead>
                          <tr className="bg-slate-50">
                            {['順位', 'エンティティ', 'タイプ', '文脈', '役割', '出現頻度', '主な出現構文パターン'].map((h, i) => (
                              <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(competitorAnalysis.entityByPId[pIds[pIdTab]] ?? []).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="border border-slate-200 px-3 py-2 text-center font-bold text-slate-500 w-10">{r.rank}</td>
                              <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800">{r.entity}</td>
                              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                                {r.entityType ? (
                                  <span className={`text-xs border px-1.5 py-0.5 rounded font-medium ${entityTypeColor[r.entityType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {entityTypeLabel[r.entityType] ?? r.entityType}
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                                {r.appearedContext ? (
                                  <span className={`text-xs border px-1.5 py-0.5 rounded font-medium ${appearedContextColor[r.appearedContext] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {appearedContextLabel[r.appearedContext] ?? r.appearedContext}
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-slate-600">
                                {r.replacementRole ?? '—'}
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-indigo-700">{r.count}件</td>
                              <td className="border border-slate-200 px-3 py-2 text-slate-600 leading-relaxed">{r.dominantStructure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ② 語彙パターン分析 */}
            {tab === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  GPT出力本文のエンティティ周辺に繰り返し現れる語彙パターン。
                  これがAfter構文設計で「逆算すべき構文型」の根拠になります。
                </p>
                <div className="space-y-3">
                  {competitorAnalysis.vocabPatterns.map((p, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-bold text-slate-800">{p.patternType}</span>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded whitespace-nowrap">
                          {p.count}件出現
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-2">
                        <span className="text-xs text-slate-400 mr-1">代表例：</span>
                        <span className="text-xs text-slate-700 italic">{p.example}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <span className="font-bold flex-shrink-0">K-ID示唆：</span>
                        <span>{p.kIdHint}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ③ 競合構造サマリー */}
            {tab === 2 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  P-ID別の競合出現構造まとめ。「どの競合が・どのK-IDで・自社を押し出しているか」を一行で把握できます。
                </p>
                {Object.entries(competitorAnalysis.summariesByPId).map(([pId, summary], i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded font-mono">{pId}</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
                    {/* その P-ID の競合トップ3 */}
                    {competitorAnalysis.entityByPId[pId] && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-xs text-slate-400 mr-1 self-center">競合上位：</span>
                        {competitorAnalysis.entityByPId[pId].slice(0, 3).map((e, j) => (
                          <span key={j} className="bg-red-50 border border-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">
                            {e.entity}（{e.count}件）
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 再実行ボタン */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                分析日時: {new Date(competitorAnalysis.analyzedAt).toLocaleString('ja-JP')}
              </span>
              <Button variant="secondary" loading={isAnalyzing} disabled={isAnalyzing} onClick={onClear}>
                {isAnalyzing ? '再分析中...' : '競合分析を再実行'}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// =====================================================================
// メインコンポーネント
// =====================================================================

export function Phase1Evaluation() {
  const {
    logEntries, phase1Result, setLogEntries, setStats, setPhase1Result, setPhase,
    competitorAnalysis, setCompetitorAnalysis,
    phase0Data,
  } = useAppStore();

  // ステップ管理（Phase0からの引き継ぎのみ）
  const [step, setStep] = useState<'classify' | 'done'>(
    phase1Result !== null ? 'done' : 'classify'
  );

  // (API設定はサーバー側環境変数で管理)

  // 分類進捗
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [classifyError, setClassifyError] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);

  // 結果タブ
  const [sub1Tab, setSub1Tab] = useState(0);
  const [sub2Tab, setSub2Tab] = useState(0);
  const [sub3Tab, setSub3Tab] = useState(0);

  // 競合出現構造分析
  const [isAnalyzingCompetitor, setIsAnalyzingCompetitor] = useState(false);
  const [competitorError, setCompetitorError] = useState('');
  const [competitorTab, setCompetitorTab] = useState(0);
  const [competitorPIdTab, setCompetitorPIdTab] = useState(0);


  // P-IDごとの分析モード（表示用）
  const analysisModeMap = useMemo<Record<string, AnalysisMode>>(
    () => logEntries.length > 0 ? buildModeMap(logEntries) : {},
    [logEntries]
  );

  // =====================================================================
  // AI分類実行
  // =====================================================================

  const runClassification = useCallback(async () => {
    setIsClassifying(true);
    setClassifyError('');

    // ① C-ID/A-IDが未付与のエントリのみ分類対象
    const needsClassify = logEntries.filter(e => !e.cId || !e.aId);
    const total = needsClassify.length;
    setClassifyProgress({ current: 0, total });

    const classifiedMap: Record<string, ClassifyResult> = {};

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = needsClassify.slice(i, i + BATCH_SIZE).map(e => ({
          id: e.id,
          promptId: e.promptId,
          output: e.aiOutput,
          appeared: e.appeared,   // K-ID付与判定に必須
        }));
        const results = await classifyBatch(batch);
        results.forEach(r => { classifiedMap[r.id] = r; });
        setClassifyProgress({ current: Math.min(i + BATCH_SIZE, total), total });
      }

      // 分類結果をエントリにマージ
      // kIds: Claudeが返した値を一時的に _claudeKIds として保持し、後段で優先使用する
      const updated: LogEntry[] = logEntries.map(e => {
        const r = classifiedMap[e.id];
        if (!r) return e;
        return {
          ...e,
          cId: r.cId || e.cId,
          aId: r.aId || e.aId,
          apId: r.apId || e.apId,
          sourceCategory: r.sourceCategory || e.sourceCategory,
          // Claudeが付与したK-IDを一時保存（appeared=trueは[]、appeared=falseは最大3件）
          _claudeKIds: Array.isArray(r.kIds) ? r.kIds : undefined,
          _claudeKIdReasons: r.kIdReasons,
        } as LogEntry & { _claudeKIds?: string[]; _claudeKIdReasons?: Record<string, string> };
      });

      // ② 競合出現構造分析（K/E因果分析の必須前提・自動実行）
      setIsAnalyzingCompetitor(true);
      setCompetitorError('');
      let freshCompetitorAnalysis: CompetitorAnalysisResult | null = null;
      try {
        freshCompetitorAnalysis = await doCompetitorAnalysis(updated);
        setCompetitorAnalysis(freshCompetitorAnalysis);
      } catch (compErr) {
        // 競合分析失敗時もK/E計算は続行（フォールバックheuristicを使用）
        setCompetitorError(compErr instanceof Error ? compErr.message : String(compErr));
      } finally {
        setIsAnalyzingCompetitor(false);
      }

      // ③ C/A/AP補助特徴 + ④ K/E因果分析
      // K-ID優先順位: Claude分類結果（_claudeKIds）> ルールベースfallback（assignKIds）
      const classifyModeMap = buildModeMap(updated);
      const withKE: LogEntry[] = updated.map(e => {
        const entry = e as LogEntry & { _claudeKIds?: string[]; _claudeKIdReasons?: Record<string, string> };
        const claudeKIds = entry._claudeKIds;
        const claudeKIdReasons = entry._claudeKIdReasons;

        let finalKIds: string[];
        let finalKIdWeights: Record<string, number>;
        let finalKIdReasons: Record<string, string> | undefined;

        if (claudeKIds && claudeKIds.length > 0) {
          // Claude付与を優先: weightを均等付与（0.8）してK-IDスコアマップと互換を保つ
          finalKIds = claudeKIds.slice(0, 3);
          finalKIdWeights = Object.fromEntries(
            finalKIds.map((k, i) => [k, 0.8 - i * 0.1]) // 0.8, 0.7, 0.6
          );
          finalKIdReasons = claudeKIdReasons;
        } else {
          // fallback: ルールベースK-ID付与（competitorAnalysis利用）
          const kw = assignKIds(e, classifyModeMap[e.promptId], freshCompetitorAnalysis);
          finalKIds = extractKIds(kw);
          finalKIdWeights = kw;
          finalKIdReasons = undefined;
        }

        // 一時フィールドは型安全のため除去
        const { _claudeKIds: _removed, _claudeKIdReasons: _removed2, ...cleanEntry } = entry;
        void _removed;
        void _removed2;

        return {
          ...cleanEntry,
          kIds: finalKIds,
          kIdWeights: finalKIdWeights,
          kIdReasons: finalKIdReasons,
          eIds: assignEIds(e, classifyModeMap[e.promptId]),
        };
      });

      setLogEntries(withKE);
      setStats(analyzeLogEntries(withKE));

      // ⑤ 全フェーズ結果生成
      const result = runFullAnalysis(withKE, freshCompetitorAnalysis, phase0Data?.companyName ?? '');
      setPhase1Result(result);
      setStep('done');
    } catch (err) {
      setClassifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsClassifying(false);
    }
  }, [logEntries, setLogEntries, setStats, setPhase1Result, setCompetitorAnalysis]);

  // 競合出現構造分析（再実行専用）
  // 初回は runClassification / runWithoutApi 内で自動実行済み
  // このボタンは「Phase1結果更新後の任意再分析」として使用する
  const runCompetitorAnalysis = useCallback(async () => {
    setIsAnalyzingCompetitor(true);
    setCompetitorError('');
    try {
      const freshResult = await doCompetitorAnalysis(logEntries);
      setCompetitorAnalysis(freshResult);

      // K/E を自動再集計（再実行後は即時反映）
      const modeMap = buildModeMap(logEntries);
      const withKE = logEntries.map(e => {
        const kw = assignKIds(e, modeMap[e.promptId], freshResult);
        return {
          ...e,
          kIds: extractKIds(kw),
          kIdWeights: kw,
          eIds: assignEIds(e, modeMap[e.promptId]),
        };
      });
      setLogEntries(withKE);
      setStats(analyzeLogEntries(withKE));
      const result = runFullAnalysis(withKE, freshResult, phase0Data?.companyName ?? '');
      setPhase1Result(result);
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzingCompetitor(false);
    }
  }, [logEntries, setCompetitorAnalysis, setLogEntries, setStats, setPhase1Result]);

  // 既分類CSVの場合は直接実行（C/A/AP分類API不要・競合分析は自動実行）
  const runWithoutApi = async () => {
    // ② 競合出現構造分析（必須前提・自動実行）
    setIsAnalyzingCompetitor(true);
    setCompetitorError('');
    let freshCompetitorAnalysis: CompetitorAnalysisResult | null = null;
    try {
      freshCompetitorAnalysis = await doCompetitorAnalysis(logEntries);
      setCompetitorAnalysis(freshCompetitorAnalysis);
    } catch (compErr) {
      setCompetitorError(compErr instanceof Error ? compErr.message : String(compErr));
    } finally {
      setIsAnalyzingCompetitor(false);
    }

    // ③ C/A/APはCSV済み ④ K/E因果分析（competitorAnalysis前提で計算）
    const noApiModeMap = buildModeMap(logEntries);
    const withKE = logEntries.map(e => {
      const kw = assignKIds(e, noApiModeMap[e.promptId], freshCompetitorAnalysis);
      return {
        ...e,
        kIds: extractKIds(kw),
        kIdWeights: kw,
        eIds: assignEIds(e, noApiModeMap[e.promptId]),
      };
    });
    setLogEntries(withKE);
    setStats(analyzeLogEntries(withKE));
    const result = runFullAnalysis(withKE, freshCompetitorAnalysis);
    setPhase1Result(result);
    setStep('done');
  };


  // =====================================================================
  // 結果テーブル
  // =====================================================================

  const { sub1, sub2, sub3, strategy } = phase1Result ?? {};
  const [stratTab, setStratTab] = useState(0);

  const SourceTable = () => {
    if (!sub1) return null;
    const headers = ['P-ID', 'タイプ名', '件数', ...SOURCE_CATS, '備考'];
    const rows = sub1.sourceMatrix.map(r => [
      r.promptId, r.typeName, String(r.total),
      ...SOURCE_CATS.map(c => String(r.byCat[c as SourceCat] ?? 0)),
      r.note ?? '',
    ]);
    return <MatrixTable headers={headers} rows={rows} highlightFn={(_, ci, val) =>
      ci >= 3 && parseInt(val) > 0 ? 'font-bold text-indigo-700' : ci >= 3 ? 'text-slate-200' : ''
    } />;
  };

  const AppearTable = () => {
    if (!sub1) return null;
    const headers = ['P-ID', 'タイプ名', '出現件数', '試行回数', '出現率'];
    const rows = sub1.appearanceRates.map(r => [r.promptId, r.typeName, String(r.appearedCount), String(r.trialCount), r.rate]);
    return <MatrixTable headers={headers} rows={rows} highlightFn={(_, ci, val) => {
      if (ci !== 4) return '';
      const p = parseFloat(val);
      return p >= 50 ? 'font-bold text-green-600' : p >= 30 ? 'font-semibold text-yellow-600' : 'font-semibold text-red-600';
    }} />;
  };

  const ReasonTable = () => {
    if (!sub1) return null;
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead><tr className="bg-slate-50">
            {['P-ID', 'プロンプト文', '出力理由要約', '主な出現理由パターン'].map((h, i) => (
              <th key={i} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>
            ))}
          </tr></thead>
          <tbody>{sub1.outputReasons.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="border border-slate-200 px-2 py-2 font-medium text-slate-700 whitespace-nowrap">{r.promptId}</td>
              <td className="border border-slate-200 px-2 py-2 text-slate-600 max-w-[180px] truncate" title={r.promptText}>{r.promptText}</td>
              <td className="border border-slate-200 px-2 py-2 text-slate-600 max-w-[220px]">{r.reasonSummary}</td>
              <td className="border border-slate-200 px-2 py-2 text-slate-500">{r.reasonPatterns}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  const IdMatrix = ({ matrix, ids, title }: { matrix: { promptId: string; total: number; counts: Record<string, number> }[]; ids: string[]; title: string }) => (
    <>
      <p className="text-xs font-semibold text-slate-500 mb-2">{title}</p>
      <MatrixTable
        headers={['P-ID', '件数', ...ids]}
        rows={matrix.map(r => [r.promptId, String(r.total), ...ids.map(id => String(r.counts[id] ?? 0))])}
        highlightFn={(_, ci, val) => ci >= 2 ? (parseInt(val) > 0 ? 'font-bold text-indigo-700' : 'text-slate-200') : ''}
      />
    </>
  );

  const KIdTable = () => {
    if (!sub3) return null;
    const kids = ['K-01','K-02','K-03','K-04','K-05','K-06','K-07','K-08','K-09','K-10'];
    const headers = ['P-ID', '件数', ...kids, 'コメント'];
    const rows = sub3.kIdMatrix.map(r => [r.promptId, String(r.total), ...kids.map(k => r.rates[k] ?? '0%'), r.comment]);
    return <MatrixTable headers={headers} rows={rows} highlightFn={(_, ci, val) => {
      if (ci < 2 || ci > 11) return '';
      const p = parseInt(val);
      return p >= 30 ? 'font-bold text-red-600' : p >= 10 ? 'font-semibold text-yellow-600' : 'text-slate-200';
    }} />;
  };

  const KIdScoreTable = () => {
    if (!sub3) return null;
    const sc: Record<string, string> = { '◎': 'text-red-600 font-bold text-base', '○': 'text-orange-500 font-semibold text-base', '△': 'text-yellow-600', '×': 'text-slate-400' };
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead><tr className="bg-slate-50">
            {['K-ID', '阻害要因名', '影響スコア', '該当P-ID数', '主な接続構造', 'コメント'].map((h, i) => (
              <th key={i} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>
            ))}
          </tr></thead>
          <tbody>{sub3.kIdScoreMap.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="border border-slate-200 px-2 py-2"><Badge label={r.kId} color="red" /></td>
              <td className="border border-slate-200 px-2 py-2 font-medium text-slate-700">{r.name}</td>
              <td className={`border border-slate-200 px-2 py-2 text-center ${sc[r.score] ?? ''}`}>{r.score}</td>
              <td className="border border-slate-200 px-2 py-2 text-center">{r.affectedCount}件</td>
              <td className="border border-slate-200 px-2 py-2">{r.mainStructure}</td>
              <td className="border border-slate-200 px-2 py-2 max-w-xs">{r.comment}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  const EIdTable = () => {
    if (!sub3) return null;
    const rows = sub3.eIdMatrix;
    if (rows.length === 0) {
      return (
        <div className="text-xs text-slate-400 text-center py-6">
          非出現ログがないため勝因観測データがありません（success_observation）。
        </div>
      );
    }

    const ctColor = (ct: string) =>
      ct === 'E-A' ? 'bg-orange-100 text-orange-700 border-orange-200'
      : ct === 'E-B' ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-400 border-slate-200';

    const dirColor = (d: string) =>
      d === '再現' ? 'text-green-700 font-semibold'
      : d === '代替' ? 'text-yellow-700 font-semibold'
      : d === '回避' ? 'text-red-600 font-semibold'
      : 'text-slate-400';

    const entityTypeLabel: Record<string, string> = {
      company: '会社', service: 'サービス', tool: 'ツール',
      media: 'メディア', concept: '概念',
    };

    return (
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* ヘッダー行 */}
            <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 flex-wrap border-b border-slate-200">
              <span className="font-mono text-xs font-bold text-slate-600">{r.pId}</span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-sm text-slate-800">{r.competitorEntity}</span>
              {r.entityType !== '—' && (
                <span className="text-xs border rounded px-1.5 py-0.5 bg-purple-50 border-purple-200 text-purple-700">
                  {entityTypeLabel[r.entityType] ?? r.entityType}
                </span>
              )}
              {r.replacementRole !== '—' && (
                <span className="text-xs border rounded px-1.5 py-0.5 bg-slate-100 text-slate-600 border-slate-200">
                  {r.replacementRole}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {r.winningEId !== '—' && (
                  <span className="text-xs font-mono font-bold text-green-700">{r.winningEId}</span>
                )}
                {r.controlType !== '—' && (
                  <span className={`text-xs border rounded px-1.5 py-0.5 font-semibold ${ctColor(r.controlType)}`}>
                    {r.controlType}
                  </span>
                )}
                {r.implementationDirection !== '—' && (
                  <span className={`text-xs ${dirColor(r.implementationDirection)}`}>
                    [{r.implementationDirection}]
                  </span>
                )}
              </div>
            </div>
            {/* 詳細グリッド */}
            <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-semibold">勝因（なぜ出現したか）</span>
                <p className="mt-0.5 text-slate-700 leading-relaxed">{r.winningFactor}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">自社との差分</span>
                <p className="mt-0.5 text-slate-700 leading-relaxed">{r.gapToAisle}</p>
              </div>
              {r.evidenceText !== '—' && (
                <div className="md:col-span-2">
                  <span className="text-slate-400 font-semibold">根拠テキスト</span>
                  <p className="mt-0.5 text-slate-500 italic leading-relaxed truncate">{r.evidenceText}</p>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-semibold">関連K-ID（自社敗因）</span>
                <p className="mt-0.5 text-red-600 font-mono">{r.relatedKId}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">所見</span>
                <p className="mt-0.5 text-slate-600 leading-relaxed">{r.comment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const StructureSummaryTable = () => {
    if (!sub3) return null;
    const hs = ['P-ID', '出現率', '出現構造（C/A/AP）', '阻害構造（K-ID）', '勝因観測（E-ID）', '所見'];
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead><tr className="bg-slate-50">{hs.map((h, i) => <th key={i} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{sub3.structureSummary.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="border border-slate-200 px-2 py-2 font-medium whitespace-nowrap">{r.promptId}</td>
              <td className="border border-slate-200 px-2 py-2 text-center font-bold text-indigo-700">{r.rate}</td>
              <td className="border border-slate-200 px-2 py-2 whitespace-nowrap">{r.appearStructure}</td>
              <td className="border border-slate-200 px-2 py-2 text-red-600 font-medium whitespace-nowrap">{r.blockStructure}</td>
              <td className="border border-slate-200 px-2 py-2 text-green-700 whitespace-nowrap">{r.complementStructure}</td>
              <td className="border border-slate-200 px-2 py-2 max-w-xs">{r.comment}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  // =====================================================================
  // レンダリング
  // =====================================================================

  return (
    <div className="space-y-5">

      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">02 因果分析</h1>
        <p className="text-slate-500 text-sm mt-1">GPT出力ログを5工程で分析します：出力傾向観察 → 競合出現構造分析 → 出力構造分解 → 阻害/勝因因果分析 → 戦略示唆</p>
      </div>

      {/* ===================== STEP 1: データ確認 ===================== */}
      <Card>
        <CardHeader
          title="① ログデータ確認"
          subtitle="フェーズ01で収集したログを引き継ぎます"
        />
        <CardBody>
          {logEntries.length > 0 ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">✅</span>
              <div>
                <p className="text-sm font-semibold text-indigo-800">
                  フェーズ01のログデータを引き継ぎました（{logEntries.length}件）
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  下の「AI分類実行」からそのまま分類を実行できます。
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {Array.from(new Set(logEntries.map(e => e.promptId))).sort().map(pid => (
                    <span key={pid} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono">{pid}</span>
                  ))}
                  <span className="text-indigo-400 ml-1">
                    （出現: {logEntries.filter(e => e.appeared).length}件 /
                    非出現: {logEntries.filter(e => !e.appeared).length}件）
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">ログデータがありません</p>
                <p className="text-xs text-amber-700 mt-1">
                  先にフェーズ01（ログ取得）でAI出力ログを収集してください。
                </p>
                <button
                  onClick={() => setPhase(1)}
                  className="mt-3 px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                >
                  ← フェーズ01に戻る
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ===================== STEP 2: AI分類設定 ===================== */}
      {logEntries.length > 0 && (step === 'classify' || step === 'done') && (
        <Card>
          <CardHeader
            title="AI分類実行"
            subtitle="C-ID / A-ID / AP-ID / 出典分類 を自動付与します（サーバー側実行）"
          />
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">
                  {logEntries.length}件のログ ／ 未分類: {logEntries.filter(e => !e.cId).length}件
                  （{BATCH_SIZE}件/バッチ × {Math.ceil(logEntries.filter(e => !e.cId).length / BATCH_SIZE)}回のAPI呼び出し）
                </span>
              </div>

              {isClassifying && (
                <ProgressBar current={classifyProgress.current} total={classifyProgress.total} />
              )}

              {classifyError && (
                <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
                  ⚠️ {classifyError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  size="lg"
                  loading={isClassifying}
                  disabled={isClassifying}
                  onClick={runClassification}
                >
                  AIで構造分類を実行する
                </Button>
                <Button
                  variant="secondary"
                  disabled={isClassifying || isAnalyzingCompetitor}
                  onClick={runWithoutApi}
                >
                  ルールベースで実行（C/A/AP分類API不要）
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                ※ CSVにC-ID/A-IDが付与済みの場合は「ルールベースで実行」でもK-ID/E-IDを導出できます（競合分析APIは自動実行）
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ===================== 結果: フェーズ① ===================== */}
      {sub1 && (
        <Card>
          <CardBody>
            <SectionHeader num="1" title="出力傾向観察" subtitle={`実行日時: ${new Date(sub1.analyzedAt).toLocaleString('ja-JP')}`} done />
            <SubTabs tabs={['1-1 出典傾向マトリクス', '1-2 出現率マトリクス', '1-3 出力理由マトリクス', '1-4 出力理由まとめ']} active={sub1Tab} onChange={setSub1Tab} />
            {sub1Tab === 0 && (<><p className="text-xs text-slate-500 mb-3">各P-IDの出典分類カテゴリ別件数。出典構造の偏在を把握します。</p><SourceTable /></>)}
            {sub1Tab === 1 && (<><p className="text-xs text-slate-500 mb-3">各P-IDの出現件数・試行回数・出現率。GPTによる出現傾向を定量的に把握します。</p><AppearTable /></>)}
            {sub1Tab === 2 && (<><p className="text-xs text-slate-500 mb-3">各P-IDにおいてGPTがどのような語彙・構造で出力したかを定性的に要約します。</p><ReasonTable /></>)}
            {sub1Tab === 3 && (
              <>
                <p className="text-xs text-slate-500 mb-3">全体の出力傾向を6観点で統合した総括サマリです。</p>
                <div className="space-y-2">
                  {sub1.summary.map((item, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3">
                      <div className="text-xs font-bold text-indigo-700 mb-1">{item.label}</div>
                      <div className="text-xs text-slate-700 leading-relaxed">{item.content}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ===================== 結果: 競合出現構造分析（②） ===================== */}
      {step === 'done' && (
        <CompetitorAnalysisCard
          logEntries={logEntries}
          competitorAnalysis={competitorAnalysis}
          isAnalyzing={isAnalyzingCompetitor}
          error={competitorError}
          tab={competitorTab}
          pIdTab={competitorPIdTab}
          onRun={runCompetitorAnalysis}
          onClear={runCompetitorAnalysis}
          onTabChange={setCompetitorTab}
          onPIdTabChange={setCompetitorPIdTab}
        />
      )}

      {/* ===================== 結果: フェーズ③ ===================== */}
      {sub2 && (
        <Card>
          <CardBody>
            <SectionHeader num="3" title="出力構造分解（C/A/AP：補助特徴）" subtitle={`実行日時: ${new Date(sub2.analyzedAt).toLocaleString('ja-JP')}`} done />
            <p className="text-xs text-slate-500 -mt-2 mb-4">C/A/AP-IDはK-IDとE-IDを導くための中間特徴量です。分析の主役はK-ID（自社の敗因）とE-ID（競合の勝因）であり、このセクションはその前段として使用します。</p>
            <SubTabs tabs={['C-ID傾向マトリクス', 'A-ID傾向マトリクス', 'AP-ID傾向マトリクス（A-10対象）']} active={sub2Tab} onChange={setSub2Tab} />
            {sub2Tab === 0 && (<><p className="text-xs text-slate-500 mb-3">P-ID別の意味クラスタ（C-ID）件数分布。K-ID付与の入力となる中間特徴量です。</p><IdMatrix matrix={sub2.cIdMatrix} ids={ALL_C_IDS} title="C-ID傾向マトリクス（件数）" /></>)}
            {sub2Tab === 1 && (<><p className="text-xs text-slate-500 mb-3">P-ID別の主語構造（A-ID）件数分布。K-ID付与の入力となる中間特徴量です。</p><IdMatrix matrix={sub2.aIdMatrix} ids={ALL_A_IDS} title="A-ID傾向マトリクス（件数）" /></>)}
            {sub2Tab === 2 && (<><p className="text-xs text-slate-500 mb-3">A-10（混在型）行のみを対象にした視点補完（AP-ID）分布です。</p><IdMatrix matrix={sub2.apIdMatrix} ids={ALL_AP_IDS} title="AP-ID傾向マトリクス（A-10対象行のみ・件数）" /></>)}
          </CardBody>
        </Card>
      )}

      {/* ===================== 結果: フェーズ④（阻害/勝因因果分析） ===================== */}
      {sub3 && (
        <Card>
          <CardBody>
            <SectionHeader num="4" title="阻害/勝因因果分析（K-ID / E-ID）" subtitle={`実行日時: ${new Date(sub3.analyzedAt).toLocaleString('ja-JP')}`} done />
            <p className="text-xs text-slate-500 -mt-2 mb-3">K-IDは非出現側（自社）の敗因構造、E-IDは出現側（競合）の勝因構造です。両者は同一現象の表裏として分析します。</p>


            {/* 分析モードサマリ */}
            {Object.keys(analysisModeMap).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-slate-400 mr-1">分析モード：</span>
                {Object.entries(analysisModeMap).sort(([a],[b]) => a.localeCompare(b)).map(([pid, mode]) => {
                  const modeLabel: Record<string, string> = {
                    non_appearance_analysis:     '非出現',
                    partial_appearance_analysis: '部分出現',
                    success_observation:         '100%出現',
                    forced_mention_observation:  '強制出現',
                  };
                  const modeColor: Record<string, string> = {
                    non_appearance_analysis:     'bg-red-50 border-red-200 text-red-700',
                    partial_appearance_analysis: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                    success_observation:         'bg-green-50 border-green-200 text-green-700',
                    forced_mention_observation:  'bg-purple-50 border-purple-200 text-purple-700',
                  };
                  return (
                    <span key={pid} className={`text-xs border rounded px-2 py-0.5 font-mono ${modeColor[mode] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {pid}：{modeLabel[mode] ?? mode}
                    </span>
                  );
                })}
                <span className="text-xs text-slate-400 ml-1">（100%出現ではK/E不発火）</span>
              </div>
            )}

            <SubTabs tabs={['4-1 K-ID傾向マトリクス', '4-2 E-ID勝因接続', '4-3 K-ID因果スコア', '4-4 構造接続サマリ']} active={sub3Tab} onChange={setSub3Tab} />
            {sub3Tab === 0 && (<><p className="text-xs text-slate-500 mb-3">P-ID単位のK-ID（非出現側の敗因）出現率。主要な阻害因子を特定します。</p><KIdTable /></>)}
            {sub3Tab === 1 && (<><p className="text-xs text-slate-500 mb-3">K-IDに対応する競合側の勝因（E-ID）構造の接続マトリクスです。K-IDとE-IDは同一現象の表裏として扱います。</p><EIdTable /></>)}
            {sub3Tab === 2 && (<><p className="text-xs text-slate-500 mb-3">K-ID別の出現阻害強度スコア（◎強・○中・△弱・×限定的）と接続構造の評価です。</p><KIdScoreTable /></>)}
            {sub3Tab === 3 && (<><p className="text-xs text-slate-500 mb-3">全工程を統合したP-ID単位の出現構造・阻害構造・勝因補完構造の総合所見です。</p><StructureSummaryTable /></>)}
          </CardBody>
        </Card>
      )}

      {/* ===================== 結果: 戦略提案 ===================== */}
      {strategy && (
        <Card>
          <CardBody>
            <SectionHeader num="5" title="戦略示唆" subtitle={`実行日時: ${new Date(strategy.analyzedAt).toLocaleString('ja-JP')}`} done />
            <p className="text-xs text-slate-500 -mt-2 mb-4">競合の勝因（E-ID）と自社の阻害要因（K-ID）を踏まえ、どの構造を再現・代替・回避すべきかを示します。</p>
            <SubTabs
              tabs={['出現成功構造パターン', '出現阻害構造と改善余地', '戦略提案マトリクス', '優先順位まとめ']}
              active={stratTab}
              onChange={setStratTab}
            />

            {/* 出現成功構造パターン抽出 */}
            {stratTab === 0 && (
              <>
                <p className="text-xs text-slate-500 mb-3">C-ID × A-ID × E-IDの組み合わせから導く「出現しやすい意味構造パターン」です。</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-green-50">
                        {['意味構造（C-ID）', '主語構造（A-ID）', '出現補完（E-ID）', 'コメント（出現成功因子）'].map((h, i) => (
                          <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.successPatterns.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-3 py-2 font-medium text-indigo-700 whitespace-nowrap">{r.cId}</td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-indigo-700 whitespace-nowrap">{r.aId}</td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-green-700 whitespace-nowrap">{r.eId}</td>
                          <td className="border border-slate-200 px-3 py-2 text-slate-600 leading-relaxed">{r.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 出現阻害構造の整理と改善余地 */}
            {stratTab === 1 && (
              <>
                <p className="text-xs text-slate-500 mb-3">データに出現したK-IDごとの阻害構造・改善余地・対応コメントです。</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-red-50">
                        {['K-ID', '阻害要因名', '主な構造', '改善余地', 'コメント（構文設計への示唆）'].map((h, i) => (
                          <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.blockPatterns.map((r, i) => {
                        const scoreColor = r.improvementScore === '高'
                          ? 'text-red-600 font-bold'
                          : r.improvementScore === '中' ? 'text-yellow-600 font-semibold' : 'text-slate-400';
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap"><Badge label={r.kId} color="red" /></td>
                            <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{r.name}</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">{r.mainStructure}</td>
                            <td className={`border border-slate-200 px-3 py-2 text-center ${scoreColor}`}>{r.improvementScore}</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 max-w-xs leading-relaxed">{r.comment}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 戦略提案マトリクス（P-ID別） */}
            {stratTab === 2 && (
              <>
                <p className="text-xs text-slate-500 mb-4">P-ID別・K-ID別の因果スコア・推奨対応戦略・対応候補をまとめた戦略提案マトリクスです。</p>
                {[...new Set(strategy.strategyMatrix.map(r => r.promptId))].map(pid => {
                  const rows: StrategyRow[] = strategy.strategyMatrix.filter(r => r.promptId === pid);
                  const typeName = rows[0]?.typeName ?? pid;
                  return (
                    <div key={pid} className="mb-5">
                      <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-t border border-slate-200">
                        🗂 戦略提案マトリクス：{pid}（{typeName}）
                      </div>
                      <div className="overflow-x-auto border border-t-0 border-slate-200 rounded-b">
                        <table className="text-xs border-collapse w-full">
                          <thead>
                            <tr className="bg-slate-50">
                              {['阻害K-ID', '因果スコア', '推奨対応戦略', '対応候補（例）', 'コメント（設計補足）'].map((h, i) => (
                                <th key={i} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const sc: Record<string, string> = {
                                '◎': 'text-red-600 font-bold text-base',
                                '○': 'text-orange-500 font-semibold text-base',
                                '△': 'text-yellow-600',
                                '×': 'text-slate-400',
                              };
                              return (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap"><Badge label={r.kId} color="red" /></td>
                                  <td className={`border-b border-slate-100 px-3 py-2 text-center ${sc[r.causalScore] ?? ''}`}>{r.causalScore}</td>
                                  <td className="border-b border-slate-100 px-3 py-2 font-medium text-indigo-700 whitespace-nowrap">{r.strategy}</td>
                                  <td className="border-b border-slate-100 px-3 py-2 text-slate-600 whitespace-nowrap">{r.candidates}</td>
                                  <td className="border-b border-slate-100 px-3 py-2 text-slate-500 leading-relaxed max-w-xs">{r.comment}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
                {strategy.strategyMatrix.length === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center">対象となるK-IDが検出されませんでした。</p>
                )}
              </>
            )}

            {/* 優先順位まとめ */}
            {stratTab === 3 && (
              <>
                <p className="text-xs text-slate-500 mb-3">全P-IDを横断した戦略実行の優先順位まとめです。</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        {['優先度', '戦略カテゴリ', '実行施策の概要'].map((h, i) => (
                          <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.priorityMatrix.map((r, i) => {
                        const pc = r.priority === '高'
                          ? 'text-red-600 font-bold'
                          : r.priority === '中' ? 'text-yellow-600 font-semibold' : 'text-slate-400';
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className={`border border-slate-200 px-3 py-2 text-center whitespace-nowrap ${pc}`}>{r.priority}</td>
                            <td className="border border-slate-200 px-3 py-2 font-medium text-indigo-700 whitespace-nowrap">{r.category}</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600 leading-relaxed">{r.action}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {step === 'done' && (
        <div className="flex justify-end pt-2">
          <Button onClick={() => setPhase(3)} size="lg">03 出現設計へ進む →</Button>
        </div>
      )}

    </div>
  );
}
