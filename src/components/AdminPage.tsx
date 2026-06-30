import { useState, useCallback, useEffect } from 'react';
import { CoveragePanel } from './CoveragePanel.js';
import { EvidenceManager } from './EvidenceManager.js';
import { RelationshipEditor } from './RelationshipEditor.js';

// ── 型定義 ──────────────────────────────────────────────────────
interface AdminEntity {
  id: string;
  name: string;
  category: string;
  entityType?: string;
  externalLinks?: Array<{ type: string; url: string }>;
  updatedAt: string;
}

interface AdminReference {
  id: string;
  companyId: string;
  questionId: string;
  promptText: string;
  promptTypeId: string;
  generatedAt: string;
  pageUrl: string;
}

interface AdminReferenceDetail extends AdminReference {
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
  sourceEvidence: Array<{
    type: string;
    title: string;
    description: string;
    entityRole: string;
    value?: string;
    tags: string[];
  }>;
}

interface AdminData {
  company: AdminEntity | null;
  references: AdminReference[];
}

interface DeleteConfirm {
  questionSlug: string;
  promptText: string;
  promptTypeId: string;
}

interface EntityDeleteConfirm {
  clientSlug: string;
  name: string;
  entityType: string;
  referenceCount: number;
  referenceSlugs: string[];
  externalLinksCount: number;
}

// ── 定数 ────────────────────────────────────────────────────────
const REFBASE_BASE = 'https://www.refbase.ai';
const AISLE_BASE   = 'https://app.aisle-aio.ai';

const PID_COLORS: Record<string, string> = {
  'P-01': 'bg-violet-100 text-violet-700 border-violet-200',
  'P-02': 'bg-blue-100 text-blue-700 border-blue-200',
  'P-03': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'P-04': 'bg-amber-100 text-amber-700 border-amber-200',
  'P-05': 'bg-green-100 text-green-700 border-green-200',
  'P-06': 'bg-rose-100 text-rose-700 border-rose-200',
};
const pidClass = (pid: string) =>
  PID_COLORS[pid] ?? 'bg-gray-100 text-gray-600 border-gray-200';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  case: '事例', method: '手法', feature: '特徴', comparison: '比較',
  credential: '実績', media: 'メディア', metric: '数値', client: 'クライアント',
};

type AdminTab = 'entity' | 'coverage' | 'evidence' | 'relationship';

// ── メインコンポーネント ─────────────────────────────────────────
export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('entity');
  const [clientSlugInput, setClientSlugInput] = useState('');
  const [loadedSlug, setLoadedSlug]           = useState('');
  const [data, setData]                       = useState<AdminData | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // 部分一致検索
  const [allSlugs, setAllSlugs]         = useState<string[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reference 削除フロー
  const [deletingSlug, setDeletingSlug]   = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  // Entity 削除フロー
  const [entityDeleteConfirm, setEntityDeleteConfirm] = useState<EntityDeleteConfirm | null>(null);
  const [entityDeleteInput, setEntityDeleteInput]     = useState('');
  const [isDeletingEntity, setIsDeletingEntity]       = useState(false);

  // プレビューモーダル
  const [previewData, setPreviewData]       = useState<AdminReferenceDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]     = useState<string | null>(null);

  // ── 全slug取得（マウント時1回） ───────────────────────────────
  useEffect(() => {
    fetch('/api/refbase-get?type=all', { headers: { 'X-Aisle-Admin': '1' } })
      .then(r => r.json())
      .then((j: { ok: boolean; entityIds?: string[] }) => {
        if (j.ok && j.entityIds) setAllSlugs(j.entityIds);
      })
      .catch(() => {});
  }, []);

  // ── 入力に応じた候補フィルタリング ────────────────────────────
  const handleInputChange = useCallback((val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setClientSlugInput(cleaned);
    if (cleaned.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const hits = allSlugs.filter(s => s.includes(cleaned)).slice(0, 10);
    setSuggestions(hits);
    setShowSuggestions(hits.length > 0);
  }, [allSlugs]);

  const selectSuggestion = (slug: string) => {
    setClientSlugInput(slug);
    setSuggestions([]);
    setShowSuggestions(false);
    loadEntity(slug);
  };

  // ── Entity 読み込み ────────────────────────────────────────────
  const loadEntity = useCallback(async (slug: string) => {
    const s = slug.trim();
    if (!s) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const resp = await fetch(`/api/refbase-get?clientSlug=${encodeURIComponent(s)}`, { headers: { 'X-Aisle-Admin': '1' } });
      const json = await resp.json() as {
        ok: boolean;
        company?: AdminEntity;
        references?: AdminReference[];
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? '読み込みに失敗しました');
      setData({ company: json.company ?? null, references: json.references ?? [] });
      setLoadedSlug(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Reference プレビュー取得 ──────────────────────────────────
  const handlePreview = async (ref: AdminReference) => {
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const resp = await fetch(
        `/api/refbase-get?clientSlug=${encodeURIComponent(ref.companyId)}&questionSlug=${encodeURIComponent(ref.id)}`,
        { headers: { 'X-Aisle-Admin': '1' } },
      );
      const json = await resp.json() as {
        ok: boolean;
        reference?: AdminReferenceDetail;
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? '取得に失敗しました');
      setPreviewData(json.reference ?? null);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Reference 削除 ────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm || !data?.company) return;
    const { questionSlug } = deleteConfirm;
    const clientSlug = data.company.id;
    setDeletingSlug(questionSlug);
    setDeleteConfirm(null);
    try {
      const resp = await fetch('/api/page-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSlug,
          questionSlug,
          companyName: data.company.name,
          productCategory: data.company.category,
          deleteFromIndex: true,
          regenerateParent: true,
        }),
      });
      const json = await resp.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? '削除に失敗しました');
      await loadEntity(clientSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingSlug(null);
    }
  };

  // ── Entity 削除 ───────────────────────────────────────────────
  const handleEntityDelete = async () => {
    if (!entityDeleteConfirm || entityDeleteInput !== entityDeleteConfirm.clientSlug) return;
    setIsDeletingEntity(true);
    try {
      const resp = await fetch('/api/entity-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSlug: entityDeleteConfirm.clientSlug,
          confirmSlug: entityDeleteInput,
        }),
      });
      const json = await resp.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Entity削除に失敗しました');
      setEntityDeleteConfirm(null);
      setEntityDeleteInput('');
      setData(null);
      setClientSlugInput('');
      setLoadedSlug('');
      // allSlugs を更新
      setAllSlugs(prev => prev.filter(s => s !== entityDeleteConfirm.clientSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDeletingEntity(false);
    }
  };

  // ── レンダリング ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">管理画面</h1>
            <p className="text-xs text-slate-500 mt-0.5">Entity / Reference の確認・削除</p>
          </div>
          <a href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Aisle APP に戻る
          </a>
        </div>

        {/* タブナビ */}
        <div className="max-w-4xl mx-auto mt-4 flex gap-1">
          {([ ['entity', 'Entity / Reference'], ['coverage', 'Coverage Panel'], ['evidence', 'Evidence Manager'], ['relationship', 'Relationship Editor'] ] as [AdminTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Coverage Panel タブ */}
        {activeTab === 'coverage' && <CoveragePanel />}

        {/* Evidence Manager タブ */}
        {activeTab === 'evidence' && <EvidenceManager initialSlugs={allSlugs} />}

        {/* Relationship Editor タブ */}
        {activeTab === 'relationship' && <RelationshipEditor />}

        {/* Entity / Reference タブ */}
        {activeTab === 'entity' && (<>

        {/* clientSlug 入力 */}
        <section>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            clientSlug を入力
          </label>
          <div className="flex gap-2 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                value={clientSlugInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setShowSuggestions(false); }
                }}
                placeholder="例: aisle（部分一致で候補を表示）"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
              />
              {showSuggestions && (
                <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map(slug => (
                    <li key={slug}>
                      <button
                        type="button"
                        onMouseDown={() => selectSuggestion(slug)}
                        className="w-full text-left px-4 py-2.5 text-sm font-mono text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        {slug}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (suggestions.length === 1) {
                  setSuggestions([]);
                  setShowSuggestions(false);
                  loadEntity(suggestions[0]);
                } else if (suggestions.length > 1) {
                  setError('候補を選択してください');
                } else {
                  loadEntity(clientSlugInput.trim());
                }
              }}
              disabled={loading || !clientSlugInput}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '読み込み中...' : '読み込む'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
              <span>⚠️</span>{error}
            </p>
          )}
        </section>

        {data && activeTab === 'entity' && (
          <>
            {/* ── Entity 情報 ───────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Entity
              </h2>
              {data.company ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-[120px_1fr] gap-y-2.5 text-sm">
                    <span className="text-slate-400">entityId</span>
                    <code className="font-mono text-slate-700">{data.company.id}</code>

                    <span className="text-slate-400">name</span>
                    <span className="text-slate-800 font-medium">{data.company.name}</span>

                    <span className="text-slate-400">category</span>
                    <span className="text-slate-700">{data.company.category}</span>

                    <span className="text-slate-400">entityType</span>
                    <span>
                      <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono">
                        {data.company.entityType ?? 'company'}
                      </code>
                    </span>

                    <span className="text-slate-400">更新日</span>
                    <span className="text-slate-600 text-xs font-mono">
                      {data.company.updatedAt.slice(0, 10)}
                    </span>

                    <span className="text-slate-400">RefBase URL</span>
                    <a
                      href={`${REFBASE_BASE}/entity/${data.company.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs font-mono break-all"
                    >
                      {REFBASE_BASE}/entity/{data.company.id}
                    </a>
                  </div>

                  {(data.company.externalLinks ?? []).filter(u => u.url.trim()).length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        外部情報源
                      </p>
                      <ul className="space-y-1.5">
                        {(data.company.externalLinks ?? []).filter(u => u.url.trim()).map((link, i) => (
                          <li key={i} className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400 w-20 shrink-0">{link.type}</span>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-mono break-all"
                            >
                              {link.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Entity 削除ボタン */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setEntityDeleteConfirm({
                        clientSlug: data.company!.id,
                        name: data.company!.name,
                        entityType: data.company!.entityType ?? 'company',
                        referenceCount: data.references.length,
                        referenceSlugs: data.references.map(r => r.id),
                        externalLinksCount: (data.company!.externalLinks ?? []).filter(u => u.url.trim()).length,
                      })}
                      className="px-4 py-2 text-xs font-medium bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                    >
                      🗑 Entity を削除する
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Entity が見つかりません（RefBase未登録 or slugが間違いです）
                </p>
              )}
            </section>

            {/* ── Reference 一覧 ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  References
                </h2>
                <span className="text-xs text-slate-400">
                  {data.references.length}件 — {loadedSlug}
                </span>
              </div>

              {data.references.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400">
                  Referenceが登録されていません。
                </div>
              ) : (
                <div className="space-y-2">
                  {data.references.map((ref) => {
                    const refbaseUrl = `${REFBASE_BASE}/reference/${ref.companyId}/${ref.id}`;
                    const isDeleting = deletingSlug === ref.id;
                    return (
                      <div
                        key={ref.id}
                        className={`bg-white rounded-xl border border-slate-200 p-4 transition-opacity ${isDeleting ? 'opacity-40' : ''}`}
                      >
                        {/* 上段：バッジ + slug + 生成日 */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-bold ${pidClass(ref.promptTypeId)}`}>
                            {ref.promptTypeId}
                          </span>
                          <code className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                            {ref.id}
                          </code>
                          <span className="text-[11px] text-slate-400">
                            生成日: {ref.generatedAt.slice(0, 10)}
                          </span>
                        </div>

                        {/* 中段：問い文 */}
                        <p className="text-sm text-slate-700 leading-snug mb-3">
                          {ref.promptText}
                        </p>

                        {/* 下段：アクション */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreview(ref)}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                          >
                            詳細を見る
                          </button>
                          <a
                            href={refbaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                          >
                            RefBase ↗
                          </a>
                          <button
                            onClick={() => setDeleteConfirm({
                              questionSlug: ref.id,
                              promptText: ref.promptText,
                              promptTypeId: ref.promptTypeId,
                            })}
                            disabled={isDeleting}
                            className="px-3 py-1.5 text-xs font-medium bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
                          >
                            {isDeleting ? '削除中...' : '削除'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
        </>)}
      </div>

      {/* ── プレビューモーダル ─────────────────────────────────── */}
      {(previewLoading || previewData || previewError) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) { setPreviewData(null); setPreviewError(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* モーダルヘッダー */}
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                {previewData ? (
                  <>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-bold ${pidClass(previewData.promptTypeId)}`}>
                        {previewData.promptTypeId}
                      </span>
                      <code className="text-xs text-slate-400 font-mono">{previewData.id}</code>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">
                      {previewData.promptText}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">読み込み中...</p>
                )}
              </div>
              <button
                onClick={() => { setPreviewData(null); setPreviewError(null); }}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {previewLoading && (
                <p className="text-sm text-slate-400 py-8 text-center">読み込み中...</p>
              )}
              {previewError && (
                <p className="text-sm text-red-600">⚠️ {previewError}</p>
              )}
              {previewData && (
                <>
                  {/* Answer */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Answer
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {previewData.answer}
                    </p>
                  </div>

                  {/* Evidence Points */}
                  {previewData.evidencePoints.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Evidence Points
                      </h4>
                      <ul className="space-y-1.5">
                        {previewData.evidencePoints.map((ep, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="shrink-0 text-slate-300 mt-0.5">•</span>
                            <span className="leading-snug">{ep}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* FAQ */}
                  {previewData.faq.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        FAQ
                      </h4>
                      <div className="space-y-3">
                        {previewData.faq.map((item, i) => (
                          <div key={i} className="bg-slate-50 rounded-lg px-4 py-3">
                            <p className="text-xs font-semibold text-slate-600 mb-1">Q. {item.question}</p>
                            <p className="text-sm text-slate-700 leading-snug">A. {item.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Evidence */}
                  {previewData.sourceEvidence.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Source Evidence
                      </h4>
                      <div className="space-y-2">
                        {previewData.sourceEvidence.map((se, i) => (
                          <div key={i} className="border border-slate-200 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-mono">
                                {SOURCE_TYPE_LABELS[se.type] ?? se.type}
                              </span>
                              <span className="text-xs font-semibold text-slate-700">{se.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-snug">{se.description}</p>
                            {se.value && (
                              <p className="text-xs text-indigo-600 mt-1 font-mono">{se.value}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RefBase リンク */}
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href={`${REFBASE_BASE}/reference/${previewData.companyId}/${previewData.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline font-mono"
                    >
                      RefBase で開く ↗
                    </a>
                    <span className="mx-2 text-slate-300">|</span>
                    <a
                      href={`${AISLE_BASE}/${previewData.companyId}/questions/${previewData.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:underline font-mono"
                    >
                      Aisle Preview で開く ↗
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 削除確認ダイアログ ─────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl shrink-0">🗑️</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-base leading-snug mb-3">
                  Referenceを削除しますか？
                </h3>

                {/* 対象の識別情報 */}
                <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16 shrink-0">P-ID</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded border text-[11px] font-bold ${pidClass(deleteConfirm.promptTypeId)}`}>
                      {deleteConfirm.promptTypeId}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-400 w-16 shrink-0 mt-0.5">slug</span>
                    <code className="text-xs font-mono text-slate-600 break-all">
                      {deleteConfirm.questionSlug}
                    </code>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-400 w-16 shrink-0 mt-0.5">Question</span>
                    <span className="text-xs text-slate-700 leading-snug">
                      {deleteConfirm.promptText}
                    </span>
                  </div>
                </div>

                {/* 削除対象一覧 */}
                <p className="text-xs font-semibold text-slate-500 mb-2">削除・更新される対象：</p>
                <ul className="space-y-1 text-xs text-slate-500">
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✕</span>
                    <span>Aisle HTMLページ</span>
                    <code className="text-slate-400 font-mono text-[10px]">page:question:...</code>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">✕</span>
                    <span>RefBase Reference</span>
                    <code className="text-slate-400 font-mono text-[10px]">refbase:ref:...</code>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-orange-400">↺</span>
                    <span>Reference Index から除去</span>
                    <code className="text-slate-400 font-mono text-[10px]">refbase:index:...</code>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-orange-400">↺</span>
                    <span>Aisle 問い別一覧を再生成</span>
                    <code className="text-slate-400 font-mono text-[10px]">page:index:...</code>
                  </li>
                </ul>

                <p className="text-xs text-red-500 mt-3 font-medium">
                  この操作は取り消せません。
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Entity削除確認ダイアログ ──────────────────────────── */}
      {entityDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-base leading-snug mb-1">
                  Entity を完全削除しますか？
                </h3>
                <p className="text-xs text-slate-500">この操作は取り消せません。</p>
              </div>
            </div>

            {/* 削除対象の情報 */}
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-xs text-red-400 w-24 shrink-0 mt-0.5">entityId</span>
                <code className="font-mono text-red-700 break-all">{entityDeleteConfirm.clientSlug}</code>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-red-400 w-24 shrink-0 mt-0.5">name</span>
                <span className="text-red-800 font-medium">{entityDeleteConfirm.name}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-red-400 w-24 shrink-0 mt-0.5">entityType</span>
                <code className="text-xs font-mono text-red-700">{entityDeleteConfirm.entityType}</code>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-red-400 w-24 shrink-0 mt-0.5">References</span>
                <span className="text-red-800 font-medium">{entityDeleteConfirm.referenceCount}件</span>
              </div>
              {entityDeleteConfirm.externalLinksCount > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-red-400 w-24 shrink-0 mt-0.5">外部情報源</span>
                  <span className="text-red-800">{entityDeleteConfirm.externalLinksCount}件</span>
                </div>
              )}
            </div>

            {/* 削除されるReference slug一覧 */}
            {entityDeleteConfirm.referenceSlugs.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">削除されるReference：</p>
                <ul className="bg-slate-50 rounded-lg px-3 py-2 space-y-0.5 max-h-28 overflow-y-auto">
                  {entityDeleteConfirm.referenceSlugs.map(slug => (
                    <li key={slug} className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                      <span className="text-red-400">✕</span>{slug}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 削除対象キー説明 */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">削除される対象：</p>
              <ul className="space-y-0.5 text-xs text-slate-500">
                {[
                  'RefBase Entity（refbase:company:...）',
                  'RefBase Reference 全件（refbase:ref:...）',
                  'Aisle HTMLページ全件（page:question:...）',
                  '問い別一覧ページ（page:index:...）',
                  'インデックス全件（refbase:index:... / page-question-index:...）',
                  'refbase:index:all から除去',
                  '外部情報源・Evidence KV',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-400 shrink-0">✕</span>{item}
                  </li>
                ))}
              </ul>
            </div>

            {/* slug再入力確認 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                確認のため <code className="bg-slate-100 px-1 rounded font-mono">{entityDeleteConfirm.clientSlug}</code> を入力してください
              </label>
              <input
                type="text"
                value={entityDeleteInput}
                onChange={e => setEntityDeleteInput(e.target.value)}
                placeholder={entityDeleteConfirm.clientSlug}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEntityDelete}
                disabled={isDeletingEntity || entityDeleteInput !== entityDeleteConfirm.clientSlug}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingEntity ? '削除中...' : '完全削除する'}
              </button>
              <button
                onClick={() => { setEntityDeleteConfirm(null); setEntityDeleteInput(''); }}
                disabled={isDeletingEntity}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
