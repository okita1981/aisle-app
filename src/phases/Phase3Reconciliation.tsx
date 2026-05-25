import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import type { Phase3Result } from '../types';
import { filterIds } from '../utils/idFilter';

// ─── 定数 ────────────────────────────────────────────────────────

const M_ID_NAMES: Record<string, string> = {
  'M-01': '認知・話題性', 'M-02': '差別化・独自性', 'M-03': '導入実績・信頼',
  'M-04': '専門性・技術性', 'M-05': '世界観・価値観提示', 'M-06': '課題提起・共感形成',
  'M-07': '解決策・方法提示', 'M-08': '比較軸・検討材料提示', 'M-09': '推薦・第三者視点',
  'M-10': '行動喚起・次アクション', 'M-11': '先進性・未来価値', 'M-12': '構造設計・包括性',
  'M-13': '対象特化・業界焦点',
};

const DIFFICULTY_TYPE_COLORS: Record<string, 'red' | 'yellow' | 'orange' | 'purple' | 'green' | 'slate'> = {
  '接続欠落': 'red',
  '主語浮き': 'yellow',
  '意味競合': 'orange',
  '構文分断': 'purple',
  'なし': 'green',
};

const DIFFICULTY_TYPE_DESC: Record<string, string> = {
  '接続欠落': '意味接点語彙と実出力ログが意味的に断絶',
  '主語浮き': '主語構造がプロンプト期待と不一致',
  '意味競合': '競合エンティティ語彙に埋もれている',
  '構文分断': 'After構文内の意味の流れが途切れている',
  'なし': '構造的問題なし（出現済み）',
};

const K_ID_NAMES: Record<string, string> = {
  'K-01': '意味競合', 'K-02': '主語構造競合', 'K-03': '出典競合',
  'K-04': '構文的上位互換', 'K-05': '情報飽和競合', 'K-06': 'プロンプト整合度競合',
  'K-07': '外部要因量的優位', 'K-08': '対象粒度不一致', 'K-09': 'FAQ・定義構文誤競合',
  'K-10': '出現対象誤認競合',
};

// ─── サブコンポーネント ─────────────────────────────────────────

// 3-1. 詳細突合レポートテーブル
function DetailReportTable({ rows }: { rows: Phase3Result['detailReport'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[1000px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-28">P-ID</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-36">No. / 意味接点</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-16">出現</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-28">困難要因分類</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">困難要因の詳細（なぜこの構文がこのプロンプトに届かないか）</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-20">到達可能性</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">設計指針</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`hover:bg-slate-50 ${
                row.reachabilityScore === '低' ? 'bg-red-50/30' :
                row.reachabilityScore === '中' ? 'bg-yellow-50/20' : ''
              }`}
            >
              <td className="px-3 py-3 align-top">
                <Badge label={row.pId} color="indigo" />
                <div className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">{row.promptText}</div>
              </td>
              <td className="px-3 py-3 align-top">
                <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                {row.mId && (
                  <div className="text-xs text-blue-700 mt-1 leading-snug">
                    {M_ID_NAMES[row.mId] ?? filterIds(row.mId)}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-center align-top">
                <span className={`text-lg font-bold ${row.appeared ? 'text-green-600' : 'text-red-500'}`}>
                  {row.appeared ? '○' : '×'}
                </span>
              </td>
              <td className="px-3 py-3 align-top">
                <Badge
                  label={row.difficultyType || 'なし'}
                  color={DIFFICULTY_TYPE_COLORS[row.difficultyType] ?? 'slate'}
                />
                {row.difficultyType && row.difficultyType !== 'なし' && (
                  <div className="text-xs text-slate-400 mt-1 leading-snug">
                    {DIFFICULTY_TYPE_DESC[row.difficultyType]}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-xs text-slate-700 leading-relaxed align-top max-w-[280px]">
                {row.difficultyDetail}
              </td>
              <td className="px-3 py-3 text-center align-top">
                <Badge
                  label={row.reachabilityScore}
                  color={row.reachabilityScore === '高' ? 'green' : row.reachabilityScore === '中' ? 'yellow' : 'red'}
                />
              </td>
              <td className="px-3 py-3 text-xs text-slate-700 leading-relaxed align-top max-w-[240px]">
                {filterIds(row.guideline)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 3-2. 横型マトリクス（SB-ID単位集約）
function MatrixReportTable({ rows }: { rows: Phase3Result['matrixReport'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-36">No. / 意味接点</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-24">到達可能性</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-28">主要困難要因</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-36">影響P-ID</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-20">優先度</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">補強・接続・再設計の指針</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${
              row.priority === '高' ? 'bg-red-50/30' :
              row.priority === '中' ? 'bg-yellow-50/20' : ''
            }`}>
              <td className="px-3 py-3 align-top">
                <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                {row.mId && (
                  <div className="text-xs text-blue-700 mt-1 leading-snug">
                    {M_ID_NAMES[row.mId] ?? filterIds(row.mId)}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-center align-top">
                <Badge
                  label={row.reachabilityScore}
                  color={row.reachabilityScore === '高' ? 'green' : row.reachabilityScore === '中' ? 'yellow' : 'red'}
                />
              </td>
              <td className="px-3 py-3 align-top">
                <Badge
                  label={row.mainDifficultyType || '—'}
                  color={DIFFICULTY_TYPE_COLORS[row.mainDifficultyType] ?? 'slate'}
                />
              </td>
              <td className="px-3 py-3 text-xs text-slate-600 align-top">{row.affectedPIds}</td>
              <td className="px-3 py-3 text-center align-top">
                <Badge
                  label={row.priority}
                  color={row.priority === '高' ? 'red' : row.priority === '中' ? 'yellow' : 'green'}
                />
              </td>
              <td className="px-3 py-3 text-xs text-slate-700 leading-relaxed align-top">{row.guideline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 対応パターン整理（困難要因タイプ別）
function PatternTable({ rows }: { rows: Phase3Result['patternTable'] }) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`rounded-xl border p-4 ${
            row.difficultyType === '接続欠落' ? 'bg-red-50 border-red-200' :
            row.difficultyType === '主語浮き' ? 'bg-yellow-50 border-yellow-200' :
            row.difficultyType === '意味競合' ? 'bg-orange-50 border-orange-200' :
            row.difficultyType === '構文分断' ? 'bg-purple-50 border-purple-200' :
            'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <Badge
              label={row.difficultyType}
              color={DIFFICULTY_TYPE_COLORS[row.difficultyType] ?? 'slate'}
            />
            <span className="text-xs font-semibold text-slate-600">
              {typeof row.count === 'number' ? `${row.count}件` : row.count}
            </span>
          </div>
          <p className="text-sm text-slate-700 mb-2">{row.description}</p>
          <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">対応施策：</span>{row.measures}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── マージ処理（フロントエンド側） ──────────────────────────────

type ReconcilePartial = Pick<Phase3Result, 'detailReport' | 'matrixReport' | 'patternTable' | 'overallSummary'>;

function mergeReconcileResults(results: ReconcilePartial[]): ReconcilePartial {
  const detailReport: Phase3Result['detailReport'] = [];
  const matrixReport: Phase3Result['matrixReport'] = [];
  const patternTableMap = new Map<string, Phase3Result['patternTable'][number]>();
  const summaries: string[] = [];

  for (const r of results) {
    detailReport.push(...(r.detailReport ?? []));
    matrixReport.push(...(r.matrixReport ?? []));
    for (const pt of (r.patternTable ?? [])) {
      const existing = patternTableMap.get(pt.difficultyType);
      if (existing) {
        existing.count += pt.count;
      } else {
        patternTableMap.set(pt.difficultyType, { ...pt });
      }
    }
    if (r.overallSummary) summaries.push(r.overallSummary);
  }

  return {
    detailReport,
    matrixReport,
    patternTable: [...patternTableMap.values()],
    overallSummary: summaries.join('\n\n'),
  };
}

// ─── P-ID 選択ピル ────────────────────────────────────────────────

function PidTabs({ pIds, active, onSelect }: { pIds: string[]; active: string; onSelect: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
          active === 'all'
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
        }`}
      >
        すべて
      </button>
      {pIds.map(pId => (
        <button
          key={pId}
          onClick={() => onSelect(pId)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            active === pId
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
          }`}
        >
          {pId}
        </button>
      ))}
    </div>
  );
}

// ─── メイン ─────────────────────────────────────────────────────

type TabId = 'detail' | 'matrix' | 'pattern' | 'summary';

export function Phase3Reconciliation() {
  const { phase1Result, phase2Result, phase3Result, setPhase3Result, setPhase, appearedChoiceMap } = useAppStore();

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('detail');
  const [activePId, setActivePId] = useState<string>('all');

  // ── 2層データを意味構造照合用に構築 ──────────────────────────
  const buildPhase1Summary = () => {
    if (!phase1Result) return null;
    const rates = phase1Result.sub1.appearanceRates;
    return rates.map(r => {
      const cIds = phase1Result.sub2.cIdMatrix.find(m => m.promptId === r.promptId)
        ? Object.entries(phase1Result.sub2.cIdMatrix.find(m => m.promptId === r.promptId)!.counts)
            .filter(([, v]) => v > 0).map(([k]) => k) : [];
      const kIds = phase1Result.sub3.kIdMatrix.find(m => m.promptId === r.promptId)
        ? Object.entries(phase1Result.sub3.kIdMatrix.find(m => m.promptId === r.promptId)!.rates)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([k]) => `${k}（${K_ID_NAMES[k] ?? k}）`) : [];
      const outputReason = phase1Result.sub1.outputReasons.find(o => o.promptId === r.promptId);
      const structSummary = phase1Result.sub3.structureSummary.find(s => s.promptId === r.promptId);
      return {
        pId: r.promptId,
        promptText: r.typeName,
        appearanceRate: r.rate,
        appearedBool: parseFloat(r.rate) >= 50,
        totalTrials: r.trialCount,
        cIds,                              // 実出力時の意味クラスタ
        kIds,                              // 出現阻害要因（名称付き）
        outputReasonSummary: outputReason?.reasonSummary ?? '',   // 実出力の傾向
        appearStructure: structSummary?.appearStructure ?? '',     // 出現時の構造
        blockStructure: structSummary?.blockStructure ?? '',       // 阻害構造
      };
    });
  };

  // ── 3層データをAfter構文（SB-ID × M-ID × 意味接点）として構築 ──
  const buildPhase2Summary = () => {
    if (!phase2Result) return null;
    return phase2Result.perPID.map(pid => ({
      pId: pid.pId,
      promptTypeId: pid.promptTypeId,   // 問いの型（reconcile.ts の JSON コンテキストとして渡る）
      promptTypeLabel: pid.promptTypeLabel,
      promptText: pid.promptText,
      mIdMapping: pid.mIdMapping.map(m => ({
        mId: m.mId,
        name: m.name,
        semanticRole: m.semanticRole,
      })),
      sbIds: pid.portfolio.map(p => {
        const afterBun = pid.afterBun.find(a => a.sbId === p.sbId);
        const complement = pid.eIdComplement.find(e => e.sbId === p.sbId);
        const evalRow = pid.appearanceEval.find(e => e.sbId === p.sbId);
        return {
          sbId: p.sbId,
          mId: p.mId,
          mName: p.mName,
          tId: p.tId,
          aId: p.aId,
          agentStructure: p.agentStructure,   // 主語構造
          afterText: afterBun?.afterText ?? '',
          syntaxIntent: afterBun?.syntaxIntent ?? '',
          kIdMatch: complement?.kId ?? complement?.kIdMatch ?? '',       // 対応K-ID（新フィールド優先）
          requiredEId: complement?.winningEId ?? complement?.requiredEId ?? '', // 勝因E-ID（新フィールド優先）
          // NOTE: API互換のため key は probability のまま。
          // 値は新思想の reachability を優先して渡す。
          probability: evalRow?.reachability ?? evalRow?.probability ?? '',
        };
      }),
    }));
  };

  const handleRun = async () => {
    if (!phase2Result) { setError('3層（出現設計）データが必要です'); return; }

    setIsRunning(true);
    setError('');
    setProgress('');

    try {
      const phase1Summary = buildPhase1Summary();
      const phase2Summary = buildPhase2Summary();

      if (!phase2Summary || phase2Summary.length === 0) throw new Error('出現設計データが空です');

      // P-IDごとに個別リクエスト（1リクエスト = 1 P-ID、60秒制限対策）
      const allResults: ReconcilePartial[] = [];

      for (let i = 0; i < phase2Summary.length; i++) {
        const phase2Item = phase2Summary[i];
        const phase1Item = phase1Summary?.find(p => p.pId === phase2Item.pId) ?? null;

        setProgress(`${i + 1} / ${phase2Summary.length} 件目を診断中（${phase2Item.pId}）...`);

        try {
          const resp = await fetch('/api/reconcile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: phase2Result.companyName,
              productCategory: phase2Result.productCategory,
              phase1Item,
              phase2Item,
            }),
          });
          const json = await resp.json() as { ok: boolean; data?: ReconcilePartial; error?: string };
          if (!json.ok || !json.data) {
            console.error(`P-ID ${phase2Item.pId} の突合でエラー:`, json.error);
            continue;
          }
          allResults.push(json.data);
        } catch (e) {
          console.error(`P-ID ${phase2Item.pId} の突合で例外:`, e);
          continue;
        }
      }

      if (allResults.length === 0) throw new Error('全P-IDの突合に失敗しました');

      const merged = mergeReconcileResults(allResults);

      const result: Phase3Result = {
        companyName: phase2Result.companyName,
        productCategory: phase2Result.productCategory,
        detailReport: merged.detailReport,
        matrixReport: merged.matrixReport,
        patternTable: merged.patternTable,
        overallSummary: merged.overallSummary,
        generatedAt: new Date().toISOString(),
      };
      setPhase3Result(result);
      setActiveTab('detail');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
      setProgress('');
    }
  };

  // ── フィルタリング & 集計 ─────────────────────────────────────

  const pIds = phase3Result
    ? [...new Set(phase3Result.detailReport.map(r => r.pId))]
    : [];

  const filteredDetail = phase3Result?.detailReport.filter(
    r => activePId === 'all' || r.pId === activePId
  ) ?? [];

  const total = phase3Result?.detailReport.length ?? 0;
  const appeared = phase3Result?.detailReport.filter(r => r.appeared).length ?? 0;
  const lowReachability = phase3Result?.matrixReport.filter(r => r.reachabilityScore === '低').length ?? 0;

  // 困難要因タイプ別件数
  const difficultyTypeCounts = phase3Result?.detailReport.reduce<Record<string, number>>((acc, r) => {
    const t = r.difficultyType || 'なし';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {}) ?? {};
  const topDifficultyType = Object.entries(difficultyTypeCounts)
    .filter(([k]) => k !== 'なし')
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'detail', label: '3-1 詳細レビューレポート' },
    { id: 'matrix', label: '3-2 横型マトリクス' },
    { id: 'pattern', label: '対応パターン整理' },
    { id: 'summary', label: '総合サマリー' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">04 出現設計レビュー</h1>
        <p className="text-slate-500 text-sm mt-1">
          Phase2で生成したAfter構文を実装前に確認し、到達可能性が低い構文や補正が必要な箇所を整理します
        </p>
      </div>

      {/* 入力データ確認 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="因果分析データ" subtitle="実出現ログ・C-ID・K-ID・阻害構造" />
          <CardBody>
            {phase1Result ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">P-ID数</span>
                  <span className="font-semibold">{phase1Result.sub1.appearanceRates.length} 件</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">総ログ数</span>
                  <span className="font-semibold">
                    {phase1Result.sub1.appearanceRates.reduce((s, r) => s + r.trialCount, 0)} 件
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">K-ID・阻害構造分析</span>
                  <Badge label="完了" color="green" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">出力傾向サマリー</span>
                  <Badge label="完了" color="green" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-sm">⚠</span>
                <p className="text-slate-500 text-sm">2層診断データなし（3層データのみで実行可）</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="出現設計データ" subtitle="After構文（意味接点テキスト）" />
          <CardBody>
            {phase2Result ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">会社名</span>
                  <span className="font-semibold text-slate-700">{phase2Result.companyName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">P-ID数</span>
                  <span className="font-semibold">{phase2Result.perPID.length} 件</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">構文（After構文）総数</span>
                  <span className="font-semibold">
                    {phase2Result.perPID.reduce((s, p) => s + p.portfolio.length, 0)} 件
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-sm">✕</span>
                <p className="text-slate-500 text-sm">出現設計データが必要です</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* スキップ済みプロンプト通知
          appearedChoiceMap のキーは "P-01" 形式（logEntry.promptId と同一）
          プロンプトテキストは phase1Result.sub1.appearanceRates の typeName から取得 */}
      {(() => {
        const skippedEntries = Object.entries(appearedChoiceMap).filter(([, v]) => v === 'skip');
        if (skippedEntries.length === 0) return null;
        const rateRows = phase1Result?.sub1.appearanceRates ?? [];
        const skippedPrompts = skippedEntries.map(([promptId]) => {
          const rateRow = rateRows.find(r => r.promptId === promptId);
          return { promptId, promptText: rateRow?.typeName ?? '' };
        });
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <span className="text-slate-400 text-base flex-shrink-0 mt-0.5">🚫</span>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                設計対象外（スキップ）のプロンプト — {skippedPrompts.length}件
              </p>
              <p className="text-xs text-slate-400 mb-2">
                出現設計フェーズで「今回は設計対象外にする」を選択したプロンプトです。突合・実装設計の対象から除外されています。
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skippedPrompts.map(({ promptId, promptText }) => (
                  <span key={promptId} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-500">
                    <span className="font-semibold text-indigo-500">{promptId}</span>
                    {promptText && <span className="truncate max-w-[200px]">「{promptText}」</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 突合ロジック説明 */}
      {!phase3Result && (
        <Card>
          <CardHeader title="レビュー観点" subtitle="実装前に確認する4つの出現困難要因" />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: '接続欠落', color: 'bg-red-50 border-red-200', desc: 'After構文の意味接点語彙と実出力ログの語彙が意味的に繋がっていない（語彙・概念の橋渡し断絶）' },
                { type: '主語浮き', color: 'bg-yellow-50 border-yellow-200', desc: 'After構文の主語構造がプロンプトの期待主語と合っておらず、AIが別主語にルーティングする' },
                { type: '意味競合', color: 'bg-orange-50 border-orange-200', desc: 'After構文のキーワードが競合エンティティ語彙に埋もれ、自社構文が選択されない' },
                { type: '構文分断', color: 'bg-purple-50 border-purple-200', desc: 'After構文内の意味の流れが途切れており、AIがコヒーレントな意味単位として認識できない' },
              ].map(({ type, color, desc }) => (
                <div key={type} className={`rounded-lg border p-3 ${color}`}>
                  <div className="font-semibold text-sm text-slate-800 mb-1">🔍 {type}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 実行ボタン */}
      {!phase3Result && (
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            loading={isRunning}
            disabled={!phase2Result}
            onClick={handleRun}
          >
            {isRunning ? '設計レビューを実行中...' : '設計レビューを実行する'}
          </Button>
          {!phase2Result && (
            <span className="text-sm text-slate-400">3層（出現設計）を先に実行してください</span>
          )}
          {isRunning && progress && (
            <span className="text-sm text-slate-500">{progress}</span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 結果表示 */}
      {phase3Result && (
        <>
          {/* 統計サマリカード */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">{total}</div>
              <div className="text-xs text-slate-500 mt-1">構文 × P-ID 総数</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{appeared}</div>
              <div className="text-xs text-slate-500 mt-1">出現あり（出現率50%以上）</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{lowReachability}</div>
              <div className="text-xs text-slate-500 mt-1">到達可能性：低（優先対応）</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-purple-700">{topDifficultyType}</div>
              <div className="text-xs text-slate-500 mt-1">最多困難要因タイプ</div>
            </div>
          </div>

          {/* 困難要因タイプ内訳バー */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-600 mb-3">困難要因タイプ分布</div>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(difficultyTypeCounts).map(([type, count]) => (
                <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  type === '接続欠落' ? 'bg-red-100 border-red-300 text-red-700' :
                  type === '主語浮き' ? 'bg-yellow-100 border-yellow-300 text-yellow-700' :
                  type === '意味競合' ? 'bg-orange-100 border-orange-300 text-orange-700' :
                  type === '構文分断' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                  'bg-green-100 border-green-300 text-green-700'
                }`}>
                  <span>{type}</span>
                  <span className="font-bold">{count}件</span>
                </div>
              ))}
            </div>
          </div>

          {/* タブ */}
          <div className="border-b border-slate-200">
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3-1: 詳細突合レポート */}
          {activeTab === 'detail' && (
            <Card>
              <CardHeader
                title="3-1. 詳細レビューレポート"
                subtitle={`レビュー実施日時: ${new Date(phase3Result.generatedAt).toLocaleString('ja-JP')}`}
                action={
                  <PidTabs pIds={pIds} active={activePId} onSelect={setActivePId} />
                }
              />
              <DetailReportTable rows={filteredDetail} />
            </Card>
          )}

          {/* 3-2: 横型マトリクス */}
          {activeTab === 'matrix' && (
            <Card>
              <CardHeader
                title="3-2. 横型マトリクス"
                subtitle="構文単位で到達可能性・困難要因・実装優先度を俯瞰"
              />
              <MatrixReportTable rows={phase3Result.matrixReport} />
            </Card>
          )}

          {/* 対応パターン整理 */}
          {activeTab === 'pattern' && (
            <Card>
              <CardHeader
                title="対応パターン整理（困難要因タイプ別）"
                subtitle="4タイプの出現困難要因ごとの対応施策"
              />
              <CardBody>
                <PatternTable rows={phase3Result.patternTable} />

                {/* 意味空間補強ロジック */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2 mt-4">
                  <div className="text-sm font-semibold text-indigo-800">💡 意味空間補強の基本原則</div>
                  <ul className="space-y-1.5 text-sm text-indigo-700">
                    <li>・<strong>接続欠落</strong>への対応：E-03（出典付き事例）・E-04（FAQ/Schema）で語彙的橋渡しを構築する</li>
                    <li>・<strong>主語浮き</strong>への対応：A-IDの主語設計を見直し、プロンプトの期待主語に合わせた再設計が必要</li>
                    <li>・<strong>意味競合</strong>への対応：E-07（ランキング/比較）・E-09（複数出典の交差構造）で自社エンティティを強化する</li>
                    <li>・<strong>構文分断</strong>への対応：T-IDのテンプレートを見直し、意味の連続性を確保した構文に再設計する</li>
                  </ul>
                </div>
              </CardBody>
            </Card>
          )}

          {/* 総合サマリー（タブ） */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <Card>
                <CardHeader title="総合サマリー" subtitle="突合診断の総括・このクライアントの出現構造の本質的問題" />
                <CardBody>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {filterIds(phase3Result.overallSummary ?? '')}
                  </div>
                </CardBody>
              </Card>

              {/* 到達可能性：低 の構文一覧（優先対応） */}
              <Card>
                <CardHeader title="到達可能性：低 の構文一覧" subtitle="優先的に補強・再設計が必要な構文" />
                <CardBody>
                  <div className="space-y-2">
                    {phase3Result.matrixReport
                      .filter(r => r.reachabilityScore === '低')
                      .map((r, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                          <span className="text-xs font-bold text-slate-500 flex-shrink-0">#{i + 1}</span>
                          <Badge label="到達可能性：低" color="red" />
                          <Badge label={r.mainDifficultyType} color={DIFFICULTY_TYPE_COLORS[r.mainDifficultyType] ?? 'slate'} />
                          <div className="text-xs text-slate-600 ml-auto flex-shrink-0">{r.affectedPIds}</div>
                        </div>
                      ))}
                    {phase3Result.matrixReport.filter(r => r.reachabilityScore === '低').length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">到達可能性「低」の構文はありません</p>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* 再実行ボタン */}
              <div className="flex justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setPhase3Result(null)}
                >
                  再レビューする
                </Button>
                <Button onClick={() => setPhase(5)} size="lg">
                  05 実装設計へ進む →
                </Button>
              </div>
            </div>
          )}
          {/* 結果フッター：常時表示の導線ボタン */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-2">
            <Button
              variant="secondary"
              onClick={() => setPhase3Result(null)}
            >
              再診断する
            </Button>
            <Button onClick={() => setPhase(5)} size="lg">
              05 実装設計へ進む →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
