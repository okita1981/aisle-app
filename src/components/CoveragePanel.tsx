/**
 * CoveragePanel — Sprint 3.5B
 *
 * 全 Entity の Coverage 状況を一覧表示する Read-Only パネル。
 * KV 書き込みなし / AI 呼び出しなし。
 */

import { useState, useEffect } from 'react';
import type { CoverageType } from '../types/index.js';

// ── API レスポンス型（coverage-report.ts と対応） ──────────────────────────

interface EntityCoverageSummaryRow {
  entityId: string;
  entityName: string;
  entityType: string;
  primaryCluster: string;
  evidenceCount: number;
  labelledEvidenceCount: number;
  coveredTypes: CoverageType[];
  missingTypes: CoverageType[];
  unlockedCount: number;
  lockedCount: number;
  templateCount: number;
  unlockedTemplates: Array<{
    templateId: string;
    promptTypeId: string;
    coverageScore: number;
  }>;
  lockedTemplates: Array<{
    templateId: string;
    promptTypeId: string;
    missingTypes: CoverageType[];
    coverageScore: number;
  }>;
}

interface CoverageReportResponse {
  ok: boolean;
  entities?: EntityCoverageSummaryRow[];
  templateCount?: number;
  entityCount?: number;
  error?: string;
}

// ── 定数 ─────────────────────────────────────────────────────────────────────

const ALL_COVERAGE_TYPES: CoverageType[] = [
  'Identity',
  'Capability',
  'Differentiation',
  'Credibility',
  'UseCase',
];

const COVERAGE_SHORT: Record<CoverageType, string> = {
  Identity:        'Id',
  Capability:      'Ca',
  Differentiation: 'Di',
  Credibility:     'Cr',
  UseCase:         'Uc',
};

const PID_COLORS: Record<string, string> = {
  'P-01': 'bg-violet-100 text-violet-700',
  'P-02': 'bg-blue-100 text-blue-700',
  'P-03': 'bg-cyan-100 text-cyan-700',
  'P-04': 'bg-amber-100 text-amber-700',
  'P-05': 'bg-green-100 text-green-700',
  'P-06': 'bg-rose-100 text-rose-700',
};
const pidClass = (pid: string) => PID_COLORS[pid] ?? 'bg-gray-100 text-gray-600';

// ── 詳細行コンポーネント ──────────────────────────────────────────────────────

function EntityCoverageRow({ row }: { row: EntityCoverageSummaryRow }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((row.unlockedCount / Math.max(row.templateCount, 1)) * 100);
  const allCovered = row.unlockedCount === row.templateCount;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* 概要行（クリックで展開） */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Entity 名 */}
          <span className="font-medium text-sm text-slate-800 w-36 truncate shrink-0">
            {row.entityName}
          </span>

          {/* UNLOCKED バッジ */}
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
              allCovered
                ? 'bg-emerald-100 text-emerald-700'
                : row.unlockedCount === 0
                ? 'bg-red-100 text-red-600'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {row.unlockedCount}/{row.templateCount}
          </span>

          {/* 5軸バッジ */}
          <div className="flex gap-1 shrink-0">
            {ALL_COVERAGE_TYPES.map(ct => {
              const covered = row.coveredTypes.includes(ct);
              return (
                <span
                  key={ct}
                  title={ct}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    covered
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {COVERAGE_SHORT[ct]}
                </span>
              );
            })}
          </div>

          {/* Evidence 件数 */}
          <span className="text-xs text-slate-400 shrink-0 ml-auto">
            Evidence {row.labelledEvidenceCount}/{row.evidenceCount}
          </span>

          {/* 展開矢印 */}
          <span className="text-slate-300 text-xs shrink-0">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 展開詳細 */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-slate-50 space-y-3 border-t border-slate-100">

          {/* メタ情報 */}
          <div className="grid grid-cols-[100px_1fr] gap-y-1 text-xs">
            <span className="text-slate-400">entityId</span>
            <code className="font-mono text-slate-600">{row.entityId}</code>
            <span className="text-slate-400">entityType</span>
            <code className="font-mono text-slate-600">{row.entityType}</code>
            <span className="text-slate-400">cluster</span>
            <span className="text-slate-600">{row.primaryCluster || '—'}</span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Coverage Score</span>
              <span className="font-mono text-slate-600">{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allCovered ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-red-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* UNLOCKED Templates */}
          {row.unlockedTemplates.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1.5">
                UNLOCKED（{row.unlockedTemplates.length}件）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {row.unlockedTemplates.map(t => (
                  <span
                    key={t.templateId}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${pidClass(t.promptTypeId)}`}
                  >
                    {t.promptTypeId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* LOCKED Templates */}
          {row.lockedTemplates.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1.5">
                LOCKED（{row.lockedTemplates.length}件）
              </p>
              <div className="space-y-1.5">
                {row.lockedTemplates.map(t => (
                  <div key={t.templateId} className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded opacity-50 ${pidClass(t.promptTypeId)}`}>
                      {t.promptTypeId}
                    </span>
                    <span className="text-[10px] text-slate-400">不足:</span>
                    {t.missingTypes.map(mt => (
                      <span
                        key={mt}
                        className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-medium"
                      >
                        {mt}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* missingTypes（全軸の和集合） */}
          {row.missingTypes.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200">
              <span className="text-[10px] text-slate-400">不足軸:</span>
              {row.missingTypes.map(mt => (
                <span
                  key={mt}
                  className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-medium"
                >
                  {mt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function CoveragePanel() {
  const [data, setData]       = useState<CoverageReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/coverage-report', { headers: { 'X-Aisle-Admin': '1' } })
      .then(r => r.json())
      .then((j: CoverageReportResponse) => {
        setData(j);
        if (!j.ok) setError(j.error ?? '取得に失敗しました');
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const entities = data?.entities ?? [];
  const filtered = search.trim()
    ? entities.filter(e =>
        e.entityId.includes(search.toLowerCase()) ||
        e.entityName.toLowerCase().includes(search.toLowerCase()) ||
        e.primaryCluster.toLowerCase().includes(search.toLowerCase()),
      )
    : entities;

  // サマリー集計
  const fullUnlocked = entities.filter(e => e.unlockedCount === e.templateCount).length;
  const totalUnlocked = entities.reduce((s, e) => s + e.unlockedCount, 0);
  const totalPossible = entities.reduce((s, e) => s + e.templateCount, 0);

  return (
    <div className="space-y-6">

      {/* サマリーカード */}
      {!loading && entities.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{entities.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Entity 総数</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{fullUnlocked}</p>
            <p className="text-xs text-slate-400 mt-0.5">全Template解放済み</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {totalPossible > 0 ? Math.round((totalUnlocked / totalPossible) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              解放率（{totalUnlocked}/{totalPossible}）
            </p>
          </div>
        </div>
      )}

      {/* 検索 */}
      {!loading && entities.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Entity名・ID・Clusterで絞り込み"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      )}

      {/* ローディング */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">Coverage を計算中...</p>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Entity 一覧 */}
      {!loading && !error && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              {search ? '一致するEntityが見つかりません' : 'Entityが登録されていません'}
            </p>
          ) : (
            filtered.map(row => <EntityCoverageRow key={row.entityId} row={row} />)
          )}
        </div>
      )}

      {/* フッター */}
      {!loading && entities.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {filtered.length}/{entities.length} 件表示 —
          Template {data?.templateCount ?? 0}種
        </p>
      )}
    </div>
  );
}
