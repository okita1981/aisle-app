/**
 * EvidenceManager — Sprint 3.5C
 *
 * Coverage Gap を Evidence 側で確認・修正するための Read/Edit UI。
 * 編集可能: coverageType[] / sourceClass / supportedPromptTypes[]
 * Read-Only: その他全フィールド
 * Evidence 新規作成・削除・本文編集: 対象外
 */

import { useState, useEffect, useCallback } from 'react';
import type { CoverageType, SourceClass } from '../types/index.js';

// ── 型 ───────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  id: string;
  evidenceId?: string;
  type: string;
  title: string;
  description: string;
  entityRole: string;
  value?: string;
  tags?: string[];
  sourceUrl?: string;
  sourceType?: string;
  confidence?: string;
  coverageType?: CoverageType[];
  sourceClass?: SourceClass;
  supportedPromptTypes?: string[];
  needsVerification?: boolean;
  sourceVerified?: boolean;
  tier?: string;
  citationType?: string;
  evidenceStrength?: string;
  publicationDate?: string | null;
  lastVerifiedAt?: string | null;
}

// ── 定数 ─────────────────────────────────────────────────────────────────────

const ALL_COVERAGE_TYPES: CoverageType[] = [
  'Identity', 'Capability', 'Differentiation', 'Credibility', 'UseCase',
];

const ALL_SOURCE_CLASSES: SourceClass[] = [
  'Specification', 'Announcement', 'Documentation', 'Research',
  'Presentation', 'CaseStudy', 'Benchmark', 'Profile', 'Interview', 'Financial',
];

const ALL_PROMPT_TYPES = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'];

const COVERAGE_DESC: Record<CoverageType, string> = {
  Identity:        'そのEntityが何者か',
  Capability:      '何ができるか・何を提供するか',
  Differentiation: '他との違い・独自性・強み',
  Credibility:     '信頼できる根拠・実績・第三者評価',
  UseCase:         '誰がどう使うか・どんな課題を解くか',
};

const PID_COLORS: Record<string, string> = {
  'P-01': 'bg-violet-100 text-violet-700 border-violet-200',
  'P-02': 'bg-blue-100 text-blue-700 border-blue-200',
  'P-03': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'P-04': 'bg-amber-100 text-amber-700 border-amber-200',
  'P-05': 'bg-green-100 text-green-700 border-green-200',
  'P-06': 'bg-rose-100 text-rose-700 border-rose-200',
};

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function coverageBadgeClass(ct: CoverageType, selected: boolean) {
  if (!selected) return 'bg-slate-100 text-slate-400 border-slate-200 cursor-pointer hover:bg-slate-200';
  const map: Record<CoverageType, string> = {
    Identity:        'bg-indigo-100 text-indigo-700 border-indigo-300 cursor-pointer',
    Capability:      'bg-emerald-100 text-emerald-700 border-emerald-300 cursor-pointer',
    Differentiation: 'bg-violet-100 text-violet-700 border-violet-300 cursor-pointer',
    Credibility:     'bg-amber-100 text-amber-700 border-amber-300 cursor-pointer',
    UseCase:         'bg-rose-100 text-rose-700 border-rose-300 cursor-pointer',
  };
  return map[ct];
}

// ── 単一 Evidence 行 ──────────────────────────────────────────────────────────

interface EvidenceRowProps {
  ev: EvidenceItem;
  onSave: (
    evidenceId: string,
    coverageType: CoverageType[],
    sourceClass: SourceClass | undefined,
    supportedPromptTypes: string[],
  ) => Promise<void>;
}

function EvidenceRow({ ev, onSave }: EvidenceRowProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 編集ステート
  const [editCoverage, setEditCoverage] = useState<CoverageType[]>(ev.coverageType ?? []);
  const [editSourceClass, setEditSourceClass] = useState<SourceClass | undefined>(ev.sourceClass);
  const [editPromptTypes, setEditPromptTypes] = useState<string[]>(ev.supportedPromptTypes ?? []);

  const isDirty =
    JSON.stringify([...editCoverage].sort()) !== JSON.stringify([...(ev.coverageType ?? [])].sort()) ||
    editSourceClass !== ev.sourceClass ||
    JSON.stringify([...editPromptTypes].sort()) !== JSON.stringify([...(ev.supportedPromptTypes ?? [])].sort());

  const handleToggleCoverage = (ct: CoverageType) => {
    setEditCoverage(prev =>
      prev.includes(ct) ? prev.filter(x => x !== ct) : [...prev, ct],
    );
  };

  const handleTogglePromptType = (pid: string) => {
    setEditPromptTypes(prev =>
      prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid],
    );
  };

  const handleSave = async () => {
    const id = ev.evidenceId ?? ev.id;
    setSaving(true);
    try {
      await onSave(id, editCoverage, editSourceClass, editPromptTypes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEditCoverage(ev.coverageType ?? []);
    setEditSourceClass(ev.sourceClass);
    setEditPromptTypes(ev.supportedPromptTypes ?? []);
  };

  const displayId = ev.evidenceId ?? ev.id;
  const hasCoverage = (ev.coverageType ?? []).length > 0;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${isDirty ? 'border-amber-300' : 'border-slate-200'}`}>
      {/* 概要行 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <code className="text-[10px] font-mono text-slate-400 shrink-0">{displayId}</code>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0">
                {ev.type}
              </span>
              {(ev.coverageType ?? []).map(ct => (
                <span key={ct} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${coverageBadgeClass(ct, true)}`}>
                  {ct}
                </span>
              ))}
              {!hasCoverage && (
                <span className="text-[10px] bg-red-50 text-red-400 border border-red-200 px-1.5 py-0.5 rounded">
                  未分類
                </span>
              )}
              {isDirty && (
                <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                  未保存
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-700 leading-snug truncate">{ev.title}</p>
          </div>
          <span className="text-slate-300 text-xs shrink-0 mt-1">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 展開詳細 */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 pb-5 pt-4 space-y-5">

          {/* Read-Only フィールド */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              情報（読み取り専用）
            </p>
            <div className="grid grid-cols-[120px_1fr] gap-y-1.5 text-xs">
              <span className="text-slate-400">evidenceId</span>
              <code className="font-mono text-slate-600">{displayId}</code>

              <span className="text-slate-400">title</span>
              <span className="text-slate-700 font-medium">{ev.title}</span>

              <span className="text-slate-400">type</span>
              <code className="font-mono text-slate-600">{ev.type}</code>

              <span className="text-slate-400">entityRole</span>
              <span className="text-slate-600">{ev.entityRole}</span>

              {ev.value && (
                <>
                  <span className="text-slate-400">value</span>
                  <span className="text-slate-600 font-mono">{ev.value}</span>
                </>
              )}

              <span className="text-slate-400">sourceType</span>
              <span className="text-slate-600">{ev.sourceType ?? '—'}</span>

              {ev.sourceUrl && (
                <>
                  <span className="text-slate-400">sourceUrl</span>
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-mono break-all"
                  >
                    {ev.sourceUrl}
                  </a>
                </>
              )}

              <span className="text-slate-400">confidence</span>
              <span className="text-slate-600">{ev.confidence ?? '—'}</span>

              <span className="text-slate-400">needsVerification</span>
              <span className={ev.needsVerification ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                {ev.needsVerification ? 'true' : 'false'}
              </span>

              <span className="text-slate-400">sourceVerified</span>
              <span className={ev.sourceVerified ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                {ev.sourceVerified ? 'true' : 'false'}
              </span>

              {ev.description && (
                <>
                  <span className="text-slate-400 mt-0.5">description</span>
                  <span className="text-slate-600 leading-snug">{ev.description}</span>
                </>
              )}
            </div>
          </div>

          {/* ── 編集フィールド ── */}
          <div className="space-y-4 pt-1 border-t border-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mt-3">
              編集可能フィールド
            </p>

            {/* coverageType[] */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                coverageType[]
                <span className="ml-1 text-[10px] font-normal text-slate-400">（複数選択可）</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_COVERAGE_TYPES.map(ct => {
                  const selected = editCoverage.includes(ct);
                  return (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => handleToggleCoverage(ct)}
                      title={COVERAGE_DESC[ct]}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${coverageBadgeClass(ct, selected)}`}
                    >
                      {ct}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* sourceClass */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                sourceClass
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SOURCE_CLASSES.map(sc => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setEditSourceClass(editSourceClass === sc ? undefined : sc)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      editSourceClass === sc
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>

            {/* supportedPromptTypes[] */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                supportedPromptTypes[]
                <span className="ml-1 text-[10px] font-normal text-slate-400">（この Evidence が寄与する P-ID）</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PROMPT_TYPES.map(pid => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handleTogglePromptType(pid)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-colors ${
                      editPromptTypes.includes(pid)
                        ? PID_COLORS[pid] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                        : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {pid}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  saved
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : isDirty
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saving ? '保存中...' : saved ? '保存しました ✓' : '保存する'}
              </button>
              {isDirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  リセット
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

interface EvidenceManagerProps {
  initialSlugs?: string[];
}

export function EvidenceManager({ initialSlugs = [] }: EvidenceManagerProps) {
  const [allSlugs, setAllSlugs]       = useState<string[]>(initialSlugs);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [slugInput, setSlugInput]     = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [items, setItems]     = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // slug 一覧を取得（マウント時）
  useEffect(() => {
    if (initialSlugs.length > 0) return;
    fetch('/api/refbase-get?type=all', { headers: { 'X-Aisle-Admin': '1' } })
      .then(r => r.json())
      .then((j: { ok: boolean; entityIds?: string[] }) => {
        if (j.ok && j.entityIds) setAllSlugs(j.entityIds);
      })
      .catch(() => {});
  }, [initialSlugs]);

  // 入力補完
  const handleInputChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugInput(cleaned);
    if (!cleaned) { setSuggestions([]); setShowSuggestions(false); return; }
    const hits = allSlugs.filter(s => s.includes(cleaned)).slice(0, 8);
    setSuggestions(hits);
    setShowSuggestions(hits.length > 0);
  };

  const loadEvidence = useCallback(async (slug: string) => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setItems([]);
    setSelectedSlug(slug);
    try {
      const resp = await fetch(`/api/evidence-manager?slug=${encodeURIComponent(slug)}`, {
        headers: { 'X-Aisle-Admin': '1' },
      });
      const json = await resp.json() as { ok: boolean; items?: EvidenceItem[]; error?: string };
      if (!json.ok) throw new Error(json.error ?? '取得に失敗しました');
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSuggestion = (slug: string) => {
    setSlugInput(slug);
    setSuggestions([]);
    setShowSuggestions(false);
    loadEvidence(slug);
  };

  // Evidence 保存ハンドラー（API → ローカル state も更新）
  const handleSave = useCallback(async (
    evidenceId: string,
    coverageType: CoverageType[],
    sourceClass: SourceClass | undefined,
    supportedPromptTypes: string[],
  ) => {
    const resp = await fetch('/api/evidence-manager', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Aisle-Admin': '1' },
      body: JSON.stringify({
        slug: selectedSlug,
        evidenceId,
        coverageType,
        sourceClass: sourceClass ?? null,
        supportedPromptTypes,
      }),
    });
    const json = await resp.json() as { ok: boolean; updated?: EvidenceItem; error?: string };
    if (!json.ok) throw new Error(json.error ?? '保存に失敗しました');

    // ローカル state を更新（Coverage Panel もリロードで反映される）
    if (json.updated) {
      setItems(prev => prev.map(ev =>
        (ev.evidenceId ?? ev.id) === evidenceId ? { ...ev, ...json.updated } : ev,
      ));
    }
  }, [selectedSlug]);

  // Coverage サマリー（選択中 Entity の軸充足状況）
  const coveredTypes = [...new Set(items.flatMap(ev => ev.coverageType ?? []))];
  const missingTypes = (['Identity', 'Capability', 'Differentiation', 'Credibility', 'UseCase'] as CoverageType[])
    .filter(ct => !coveredTypes.includes(ct));

  // 重点 Entity ショートカット
  const FOCUS = ['chatgpt', 'uber', 'aisle', 'anchor-artworks'];

  return (
    <div className="space-y-6">
      {/* 重点 Entity ショートカット */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          重点 Entity
        </p>
        <div className="flex flex-wrap gap-2">
          {FOCUS.map(slug => (
            <button
              key={slug}
              type="button"
              onClick={() => { setSlugInput(slug); loadEvidence(slug); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedSlug === slug
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {slug}
            </button>
          ))}
        </div>
      </div>

      {/* Entity 検索 */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Entity slug で検索
        </label>
        <div className="flex gap-2 relative">
          <div className="flex-1 relative">
            <input
              type="text"
              value={slugInput}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setShowSuggestions(false);
                if (e.key === 'Enter') { loadEvidence(slugInput); setShowSuggestions(false); }
              }}
              placeholder="例: chatgpt"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {showSuggestions && (
              <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {suggestions.map(s => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      className="w-full text-left px-4 py-2 text-sm font-mono text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { loadEvidence(slugInput); setShowSuggestions(false); }}
            disabled={loading || !slugInput}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '読み込み中...' : '表示'}
          </button>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Coverage サマリー */}
      {selectedSlug && !loading && items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {selectedSlug} — Coverage サマリー
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {(['Identity', 'Capability', 'Differentiation', 'Credibility', 'UseCase'] as CoverageType[]).map(ct => {
              const covered = coveredTypes.includes(ct);
              return (
                <span
                  key={ct}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    covered
                      ? coverageBadgeClass(ct, true)
                      : 'bg-red-50 text-red-400 border-red-200'
                  }`}
                >
                  {covered ? '✓' : '✗'} {ct}
                </span>
              );
            })}
          </div>
          {missingTypes.length > 0 && (
            <p className="text-xs text-red-500">
              不足軸: [{missingTypes.join(', ')}] →
              これを Evidence に付与するとテンプレートが解放されます
            </p>
          )}
          {missingTypes.length === 0 && (
            <p className="text-xs text-emerald-600 font-medium">
              全 Coverage 軸が充足されています（全6テンプレート解放可能）
            </p>
          )}
        </div>
      )}

      {/* Evidence 一覧 */}
      {selectedSlug && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Evidence 一覧
            </h3>
            <span className="text-xs text-slate-400">{items.length} 件 — {selectedSlug}</span>
          </div>
          {items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-400 text-center">
              Evidence が登録されていません
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((ev, i) => (
                <EvidenceRow
                  key={ev.evidenceId ?? ev.id ?? i}
                  ev={ev}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
