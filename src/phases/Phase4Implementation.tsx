import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import type { Phase4Result, ReconcileMatrixRow, GeneratedPage } from '../types';
import { filterIds } from '../utils/idFilter';

// ─── 優先度カラー ──────────────────────────────────────────────

const priorityColor = (p: string): 'red' | 'yellow' | 'green' | 'slate' =>
  p === '高' ? 'red' : p === '中' ? 'yellow' : p === '低' ? 'green' : 'slate';

const reachabilityColor = (v: string): 'red' | 'yellow' | 'green' | 'slate' =>
  v === '低' ? 'red' : v === '中' ? 'yellow' : v === '高' ? 'green' : 'slate';

const DIFFICULTY_TYPE_COLORS: Record<string, 'red' | 'yellow' | 'orange' | 'purple' | 'green' | 'slate'> = {
  '接続欠落': 'red',
  '主語浮き': 'yellow',
  '意味競合': 'orange',
  '構文分断': 'purple',
  'なし': 'green',
};

// ─── 実装計画テーブル ──────────────────────────────────────────

function PlanTable({ rows }: { rows: Phase4Result['planRows'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-20">優先度</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-36">No.</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">実装アクション</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-40">配置先ページ</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-44">必要E-ID</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">期待効果</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`hover:bg-slate-50 ${
                row.priority === '高' ? 'bg-red-50/40' :
                row.priority === '中' ? 'bg-yellow-50/30' : ''
              }`}
            >
              <td className="px-3 py-3 text-center">
                <Badge label={row.priority} color={priorityColor(row.priority)} />
              </td>
              <td className="px-3 py-3">
                <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                {row.connectionSyntax && row.connectionSyntax !== '単独実装' && (
                  <div className="text-xs text-indigo-600 mt-1 leading-snug">↔ {row.connectionSyntax}</div>
                )}
              </td>
              <td className="px-3 py-3 text-sm text-slate-700 leading-relaxed">{row.action}</td>
              <td className="px-3 py-3">
                <div className="bg-green-50 border border-green-100 rounded px-2 py-1 text-xs text-green-800 leading-relaxed">
                  {row.targetPage}
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-600 leading-relaxed">{filterIds(row.eIdRequired)}</td>
              <td className="px-3 py-3 text-xs text-slate-700 leading-relaxed">{row.expectedEffect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 対象SB-ID 選択カード ──────────────────────────────────────

function SelectionCard({
  items,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  items: ReconcileMatrixRow[];
  selected: Set<string>;
  onToggle: (sbId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="実装対象の選択"
        subtitle="突合診断で到達可能性が低・中と判定された構文から実装設計対象を選択"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onSelectAll}>すべて選択</Button>
            <Button size="sm" variant="ghost" onClick={onClearAll}>解除</Button>
          </div>
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-3xl mb-2">🎉</div>
            <p>すべての構文が十分な到達可能性を達成しています</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => {
              const isChecked = selected.has(item.sbId);
              return (
                <label
                  key={item.sbId}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isChecked
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
                    checked={isChecked}
                    onChange={() => onToggle(item.sbId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                      {item.mId && <span className="text-xs font-semibold text-blue-700">{item.mId.replace(/^M-\d+\s*[:：]?\s*/, '') || item.mId}</span>}
                      <Badge label={`到達可能性：${item.reachabilityScore}`} color={reachabilityColor(item.reachabilityScore)} />
                      <Badge label={item.mainDifficultyType} color={DIFFICULTY_TYPE_COLORS[item.mainDifficultyType] ?? 'slate'} />
                      <Badge label={`優先度：${item.priority}`} color={priorityColor(item.priority)} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      <span className="font-medium text-slate-600">指針：</span>{item.guideline}
                    </div>
                    {item.affectedPIds && (
                      <div className="text-xs text-slate-400 mt-0.5">影響する問いタイプ：{item.affectedPIds}</div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── エクスポート ──────────────────────────────────────────────

function exportReport(result: Phase4Result) {
  const lines = [
    '実装指示書（AI向け情報設計）',
    `会社名: ${result.companyName} | 商材: ${result.productCategory}`,
    `生成日時: ${new Date(result.generatedAt).toLocaleString('ja-JP')}`,
    '',
    '■ 実装サマリー',
    result.prioritySummary,
    '',
    '■ 実装施策一覧',
    ['優先度', '構文ID', '実装アクション', '配置先ページ', '必要外部接点', '期待効果', '連携構文'].join('\t'),
    ...result.planRows.map(r =>
      [r.priority, r.sbId, r.action, r.targetPage, r.eIdRequired, r.expectedEffect, r.connectionSyntax].join('\t')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aisle_implementation_spec_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Aisleページ管理 定数・型 ──────────────────────────────────

interface AisleIndexEntry {
  slug: string;
  promptTypeId: string;
  promptSlug: string;
  label: string;
  generatedAt: string;
  promptText?: string;
}

const AISLE_PROMPT_SLUGS: Record<string, string> = {
  'P-01': 'recommendation',
  'P-02': 'comparison',
  'P-03': 'ranking',
  'P-04': 'solution',
  'P-05': 'citation',
  'P-06': 'why-recommended',
};

const AISLE_LABEL_MAP: Record<string, string> = {
  'P-01': '選定・相談型',
  'P-02': '比較・評価型',
  'P-03': 'ランキング期待型',
  'P-04': '課題解決・提案型',
  'P-05': '出典付き引用期待型',
  'P-06': '推薦理由深掘り型',
};

// ─── clientSlug バリデーション ────────────────────────────────────
const SLUG_VALID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validateClientSlug = (val: string): string => {
  if (!val) return 'URL識別子は必須です';
  if (!SLUG_VALID_PATTERN.test(val)) return 'URL識別子は小文字英数字とハイフンのみ使用できます';
  return '';
};

// ─── メイン ─────────────────────────────────────────────────────

export function Phase4Implementation() {
  const {
    phase1Result, phase2Result, phase3Result, phase4Result, setPhase4Result,
    aisleResult, setAisleResult,
    generatedPage, setGeneratedPage,
    externalUrls, setExternalUrls,
  } = useAppStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // ── AI専用ページ管理 ──────────────────────────────────────────
  // externalUrls / generatedPage / aisleResult は Zustand で永続管理（画面遷移をまたいで保持）
  const URL_TYPE_OPTIONS = ['note', 'LinkedIn', 'メディア記事', '公式サイト', 'その他'] as const;
  const MAX_URLS = 5;

  const addExternalUrl = () => {
    if (externalUrls.length >= MAX_URLS) return;
    setExternalUrls([...externalUrls, { type: 'note', url: '' }]);
  };
  const removeExternalUrl = (index: number) => {
    setExternalUrls(externalUrls.filter((_, i) => i !== index));
  };
  const updateExternalUrl = (index: number, field: 'type' | 'url', value: string) => {
    setExternalUrls(externalUrls.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── 上書き確認ダイアログ ────────────────────────────────────
  const [overwriteDialog, setOverwriteDialog] = useState<{ slug: string } | null>(null);
  const [isCheckingPage, setIsCheckingPage] = useState(false);

  // ── Aisleページ管理 ──────────────────────────────────────────
  const [aisleMode, setAisleMode] = useState<'add' | 'update'>('add');
  const [existingAisleIndex, setExistingAisleIndex] = useState<AisleIndexEntry[]>([]);
  const [selectedUpdateSlugs, setSelectedUpdateSlugs] = useState<Set<string>>(new Set());
  const [isGeneratingAislePage, setIsGeneratingAislePage] = useState(false);
  const [aisleError, setAisleError] = useState<string | null>(null);
  const [isDeletingAisleSlug, setIsDeletingAisleSlug] = useState<string | null>(null);

  // ── clientSlug（公開URL識別子） ──────────────────────────────────
  const [clientSlugInput, setClientSlugInput] = useState('');
  const [clientSlugError, setClientSlugError] = useState('');
  const slugInitializedRef = useRef(false);

  const handleClientSlugChange = (val: string) => {
    const lower = val.toLowerCase();
    setClientSlugInput(lower);
    setClientSlugError(validateClientSlug(lower));
  };

  // companyName 確定時に一度だけ自動提案（ユーザー編集後は上書きしない）
  useEffect(() => {
    if (phase2Result?.companyName && !slugInitializedRef.current) {
      const auto = computeSlug(phase2Result.companyName);
      if (auto) setClientSlugInput(auto);
      slugInitializedRef.current = true;
    }
  }, [phase2Result?.companyName]);

  // ── fetchAisleIndex（明示的 clientSlug パラメータ） ──────────────
  const fetchAisleIndex = useCallback(async (clientSlug?: string) => {
    try {
      const qs = clientSlug ? `?clientSlug=${encodeURIComponent(clientSlug)}` : '';
      const resp = await fetch(`/api/page-generate${qs}`);
      const json = await resp.json() as { ok: boolean; index: AisleIndexEntry[] };
      if (json.ok) setExistingAisleIndex(json.index ?? []);
    } catch { /* サイレント失敗 */ }
  }, []);

  // phase2Result が揃ったらインデックスを取得（companyNameから自動生成したslugで）
  useEffect(() => {
    if (phase2Result) {
      void fetchAisleIndex(computeSlug(phase2Result.companyName) ?? undefined);
    }
  }, [phase2Result, fetchAisleIndex]);

  const handleGenerateAislePage = useCallback(async () => {
    if (!phase2Result) return;
    setIsGeneratingAislePage(true);
    setAisleError(null);
    try {
      const validPerPID = phase2Result.perPID.filter(p => !!p.promptTypeId);
      const baseIds = [...new Set(
        validPerPID.map(p => p.promptTypeId!.split('-').slice(0, 2).join('-')),
      )];

      const targetPromptTypeIds = aisleMode === 'add'
        ? baseIds
        : [...selectedUpdateSlugs].map(slug => {
            const entry = existingAisleIndex.find(e => e.promptSlug === slug);
            return entry?.promptTypeId ?? '';
          }).filter(Boolean);

      if (targetPromptTypeIds.length === 0) throw new Error('対象となる問いタイプがありません');

      const resp = await fetch('/api/page-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aisleMode,
          targetPromptTypeIds,
          companyName: phase2Result.companyName,
          productCategory: phase2Result.productCategory,
          clientSlug: clientSlugInput || undefined,
          perPID: validPerPID.map(p => ({
            pId: p.pId,
            promptTypeId: p.promptTypeId,
            promptTypeLabel: p.promptTypeLabel,
            promptText: p.promptText,
            mIdMapping: p.mIdMapping ?? [],
            afterBun: p.afterBun,
            eIdComplement: p.eIdComplement ?? [],
          })),
        }),
      });
      const json = await resp.json() as {
        ok: boolean; parentUrl?: string; llmsTxtUrl?: string;
        created?: string[]; skipped?: string[]; updated?: string[]; error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? '問い別出現ページの生成に失敗しました');

      setAisleResult({
        parentUrl: json.parentUrl ?? '',
        llmsTxtUrl: json.llmsTxtUrl ?? '',
        created: json.created ?? [],
        skipped: json.skipped ?? [],
        updated: json.updated ?? [],
      });
      await fetchAisleIndex(clientSlugInput || undefined);
    } catch (e) {
      setAisleError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGeneratingAislePage(false);
    }
  }, [phase2Result, aisleMode, selectedUpdateSlugs, existingAisleIndex, fetchAisleIndex, clientSlugInput]);

  // ── 問い別出現ページ 削除ハンドラ ────────────────────────────
  const handleDeleteAislePage = async (entry: AisleIndexEntry) => {
    setAisleError(null);
    const confirmed = window.confirm(
      `この問い別出現ページを削除しますか？\n公開URLからアクセスできなくなります。この操作は元に戻せません。\n\n対象URL: /${entry.slug}`,
    );
    if (!confirmed) return;

    setIsDeletingAisleSlug(entry.promptSlug);
    try {
      const resp = await fetch('/api/page-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: entry.slug,
          clientSlug: clientSlugInput || undefined,
          promptSlug: entry.promptSlug,
          companyName: phase2Result?.companyName ?? '',
          productCategory: phase2Result?.productCategory ?? '',
          deleteFromIndex: true,
          regenerateParent: true,
        }),
      });
      const json = await resp.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? '削除に失敗しました');
      setAisleResult(null);
      await fetchAisleIndex(clientSlugInput || undefined);
    } catch (e) {
      setAisleError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDeletingAisleSlug(null);
    }
  };

  // スラグ計算（api/page-generate.ts の toSlug と同じロジック）
  const computeSlug = (name: string): string | null => {
    const stripped = name
      .replace(/株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人|一般財団法人/g, '')
      .trim();
    const ascii = stripped.replace(/[^\x20-\x7E]/g, '').trim();
    if (ascii.length > 0) {
      const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (slug.length > 0) return slug.slice(0, 60);
    }
    return null; // 純粋な日本語会社名は判定不能
  };

  // 新規生成ボタンのクリックハンドラ（既存ページ確認 → ダイアログ or 即生成）
  const handleNewPageClick = async () => {
    if (!phase2Result || !phase4Result) return;
    if (!clientSlugInput || clientSlugError) return; // バリデーションガード
    const slug = clientSlugInput;

    setIsCheckingPage(true);
    try {
      const resp = await fetch(`/api/page-get?slug=${encodeURIComponent(slug)}`);
      if (resp.status === 200) {
        // 既存ページあり → 確認ダイアログ
        setOverwriteDialog({ slug });
      } else {
        // 既存ページなし → 即新規生成
        await handleGeneratePage('new');
      }
    } catch {
      // エラー時はそのまま新規生成
      await handleGeneratePage('new');
    } finally {
      setIsCheckingPage(false);
    }
  };

  // 突合結果から実装対象候補（到達可能性 低/中）を抽出
  const candidateItems = useMemo<ReconcileMatrixRow[]>(() => {
    if (!phase3Result) return [];
    return phase3Result.matrixReport.filter(
      r => r.reachabilityScore === '低' || r.reachabilityScore === '中'
    );
  }, [phase3Result]);

  const toggleSelect = (sbId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(sbId) ? next.delete(sbId) : next.add(sbId);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(candidateItems.map(i => i.sbId)));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async () => {
    if (selected.size === 0) { setError('1件以上の構文を選択してください'); return; }

    setIsGenerating(true);
    setError('');

    try {
      // 選択されたSB-IDの詳細情報を突合データから収集
      const selectedItems = candidateItems
        .filter(item => selected.has(item.sbId))
        .map(item => {
          const details = phase3Result?.detailReport.filter(d => d.sbId === item.sbId) ?? [];
          return {
            sbId: item.sbId,
            mId: item.mId,
            reachabilityScore: item.reachabilityScore,
            mainDifficultyType: item.mainDifficultyType,
            affectedPIds: item.affectedPIds,
            guideline: item.guideline,
            priority: item.priority,
            // P-ID × SB-IDの詳細診断を渡す
            difficultyDetails: details.map(d => d.difficultyDetail).filter(Boolean),
            guidelineDetails: details.map(d => d.guideline).filter(Boolean),
            promptTexts: details.map(d => {
              // pId（P-01-01）から対応する Phase2 エントリを引いて promptTypeId を補完
              const phase2Entry = phase2Result?.perPID.find(p => p.pId === d.pId);
              return {
                pId: d.pId,
                promptTypeId: phase2Entry?.promptTypeId,
                promptTypeLabel: phase2Entry?.promptTypeLabel,
                promptText: d.promptText,
                appeared: d.appeared,
              };
            }),
          };
        });

      const resp = await fetch('/api/implement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: phase2Result?.companyName ?? phase3Result?.companyName ?? '',
          productCategory: phase2Result?.productCategory ?? phase3Result?.productCategory ?? '',
          selectedItems,
        }),
      });

      const json = await resp.json() as {
        ok: boolean;
        data?: { planRows: Phase4Result['planRows']; prioritySummary: string };
        error?: string;
      };
      if (!json.ok || !json.data) throw new Error(json.error ?? '実装設計の生成に失敗しました');

      const result: Phase4Result = {
        companyName: phase2Result?.companyName ?? phase3Result?.companyName ?? '',
        productCategory: phase2Result?.productCategory ?? phase3Result?.productCategory ?? '',
        planRows: json.data.planRows ?? [],
        prioritySummary: json.data.prioritySummary ?? '',
        generatedAt: new Date().toISOString(),
      };
      setPhase4Result(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  };

  // ── AI専用ページ生成（mode: 'new' | 'append' | 'update'） ───
  const handleGeneratePage = async (mode: 'new' | 'append' | 'update' = 'new') => {
    if (!phase2Result || !phase4Result) return;
    setIsGeneratingPage(true);
    setPageError(null);

    try {
      // M-ID別にAfter構文を集約（重複排除）
      const mIdMap = new Map<string, { mName: string; afterTexts: string[] }>();
      for (const pid of phase2Result.perPID) {
        for (const bun of pid.afterBun) {
          if (!bun.afterText) continue;
          if (!mIdMap.has(bun.mId)) {
            mIdMap.set(bun.mId, { mName: bun.mName, afterTexts: [] });
          }
          const entry = mIdMap.get(bun.mId)!;
          if (!entry.afterTexts.includes(bun.afterText)) {
            entry.afterTexts.push(bun.afterText);
          }
        }
      }

      const promptTexts = phase2Result.perPID
        .map(p => p.promptText)
        .filter(Boolean);

      const mIdSections = Array.from(mIdMap.entries()).map(([mId, { mName, afterTexts }]) => ({
        mId, mName, afterTexts,
      }));

      // P-IDリスト（重複排除）
      const pIds = [...new Set(phase2Result.perPID.map(p => p.pId).filter(Boolean))];
      // 問いの型IDリスト（重複排除）
      const promptTypeIds = [...new Set(phase2Result.perPID.map(p => p.promptTypeId).filter((v): v is string => !!v))];

      // K-IDスコアマップ: KIdScoreRow[] → Record<string, string>（K-ID → ◎/○/△/×）
      const kIdScoreMap = phase1Result?.sub3?.kIdScoreMap
        ? Object.fromEntries(phase1Result.sub3.kIdScoreMap.map(k => [k.kId, k.score]))
        : undefined;

      // K-IDマトリクス: KIdMatrixRow[] → Record<string, Record<string, string>>（P-ID → K-ID → "35%"）
      const kIdMatrix = phase1Result?.sub3?.kIdMatrix
        ? Object.fromEntries(phase1Result.sub3.kIdMatrix.map(r => [r.promptId, r.rates]))
        : undefined;

      const resp = await fetch('/api/page-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: phase2Result.companyName,
          productCategory: phase2Result.productCategory,
          productDescription: phase2Result.productDescription ?? '',
          promptTexts,
          mIdSections,
          implementationSummary: phase4Result.prioritySummary,
          externalUrls: externalUrls.filter(u => u.url.trim()),
          mode,
          pIds,
          promptTypeIds,  // 問いの型IDリスト（P-ID型別ページ生成に使用）
          kIdScoreMap,
          kIdMatrix,
          clientSlug: clientSlugInput || undefined,
        }),
      });

      const json = await resp.json() as {
        ok: boolean;
        slug?: string;
        url?: string;
        updatedAt?: string;
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? 'ページ生成に失敗しました');

      const now = json.updatedAt ?? new Date().toISOString();
      const newPage: GeneratedPage = {
        slug: json.slug!,
        url: json.url!,
        generatedAt: mode === 'new' ? now : (generatedPage?.generatedAt ?? now),
        updatedAt: mode !== 'new' ? now : undefined,
      };
      setGeneratedPage(newPage);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGeneratingPage(false);
    }
  };

  const handleDeletePage = async () => {
    if (!generatedPage) return;
    setIsDeletingPage(true);
    setPageError(null);

    try {
      const resp = await fetch('/api/page-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: generatedPage.slug }),
      });
      const json = await resp.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? '削除に失敗しました');
      setGeneratedPage(null);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDeletingPage(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!generatedPage) return;
    await navigator.clipboard.writeText(generatedPage.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 統計
  const highCount = phase4Result?.planRows.filter(r => r.priority === '高').length ?? 0;
  const midCount = phase4Result?.planRows.filter(r => r.priority === '中').length ?? 0;
  const lowCount = phase4Result?.planRows.filter(r => r.priority === '低').length ?? 0;

  // 突合データの統計
  const lowReachCount = phase3Result?.matrixReport.filter(r => r.reachabilityScore === '低').length ?? 0;
  const midReachCount = phase3Result?.matrixReport.filter(r => r.reachabilityScore === '中').length ?? 0;

  // Aisleページ管理: computed
  const aisleAvailableBaseIds = useMemo(() => {
    const valid = phase2Result?.perPID.filter(p => !!p.promptTypeId) ?? [];
    return [...new Set(valid.map(p => p.promptTypeId!.split('-').slice(0, 2).join('-')))];
  }, [phase2Result]);
  const existingSlugsSet = useMemo(
    () => new Set(existingAisleIndex.map(e => e.promptSlug)),
    [existingAisleIndex],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">05 実装設計</h1>
          <p className="text-slate-500 text-sm mt-1">
            突合診断で特定した出現困難構文（到達可能性：低・中）に対し、具体的な実装施策を設計します
          </p>
        </div>
        {phase4Result && (
          <div className="flex flex-col items-end gap-1">
            <Button variant="secondary" onClick={() => exportReport(phase4Result)}>
              実装指示書を出力（.txt）
            </Button>
            <span className="text-xs text-slate-400">Claude Code・AI Studio・Web制作担当者に渡す実装指示書です</span>
          </div>
        )}
      </div>

      {/* 設計レビューなし警告 */}
      {!phase3Result && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          ⚠️ 設計レビュー（04）が未実行です。先に設計レビューを完了してください。
        </div>
      )}

      {/* Phase3→Phase4 連携メモ */}
      {phase3Result && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">📎 設計レビューの位置づけ：</span>
          設計レビュー結果は、実装計画の優先判断に使用します。ページ生成には設計工程で作成された説明文案を使用します。レビュー結果のページ生成への自動反映はVer2対象です。
        </div>
      )}

      {/* 実装設計未生成の場合: 選択UI */}
      {phase3Result && !phase4Result && (
        <>
          {/* 設計レビューサマリー */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">{phase3Result.matrixReport.length}</div>
              <div className="text-xs text-slate-500 mt-1">設計構文総数</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{lowReachCount}</div>
              <div className="text-xs text-slate-500 mt-1">到達可能性：低（要対応）</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{midReachCount}</div>
              <div className="text-xs text-slate-500 mt-1">到達可能性：中（要補強）</div>
            </div>
          </div>

          {/* 対象選択 */}
          <SelectionCard
            items={candidateItems}
            selected={selected}
            onToggle={toggleSelect}
            onSelectAll={selectAll}
            onClearAll={clearAll}
          />

          {/* 生成ボタン */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              loading={isGenerating}
              disabled={selected.size === 0}
              onClick={handleGenerate}
            >
              {isGenerating
                ? '実装設計を生成中...'
                : `実装設計レポートを生成する（${selected.size}件選択中）`}
            </Button>
            {selected.size === 0 && (
              <span className="text-sm text-slate-400">構文を1件以上選択してください</span>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </>
      )}

      {/* 実装設計結果 */}
      {phase4Result && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-700">{phase4Result.planRows.length}</div>
              <div className="text-xs text-slate-500 mt-1">総施策数</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{highCount}</div>
              <div className="text-xs text-slate-500 mt-1">優先度：高</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{midCount}</div>
              <div className="text-xs text-slate-500 mt-1">優先度：中</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{lowCount}</div>
              <div className="text-xs text-slate-500 mt-1">優先度：低</div>
            </div>
          </div>

          {/* 実装サマリー */}
          <Card>
            <CardHeader title="実装サマリー" subtitle="優先順位と全体ロードマップ" />
            <CardBody>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {phase4Result.prioritySummary}
              </div>
            </CardBody>
          </Card>

          {/* 実装施策テーブル */}
          <Card>
            <CardHeader
              title="実装施策一覧"
              subtitle={`生成日時: ${new Date(phase4Result.generatedAt).toLocaleString('ja-JP')}`}
            />
            <PlanTable rows={phase4Result.planRows} />
          </Card>

          {/* 優先度高 クイックビュー */}
          {highCount > 0 && (
            <Card>
              <CardHeader
                title="優先度：高 — 即時対応推奨"
                subtitle="意味空間補強・出典接続・導線設計が必要な構文"
              />
              <CardBody>
                <div className="space-y-3">
                  {phase4Result.planRows
                    .filter(r => r.priority === '高')
                    .map((row, i) => (
                      <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                          <Badge label="優先度：高" color="red" />
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-1">{row.action}</p>
                        <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                          <span>📍 {row.targetPage}</span>
                          <span>🔗 {filterIds(row.eIdRequired)}</span>
                        </div>
                        <p className="text-xs text-indigo-700 mt-2 bg-indigo-50 rounded px-2 py-1">
                          💡 {row.expectedEffect}
                        </p>
                      </div>
                    ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* 再設計ボタン */}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setPhase4Result(null)}>
              再設計する
            </Button>
          </div>

          {/* ── 公開URL識別子（共通設定） ─────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div>
              <div className="text-sm font-bold text-slate-800 mb-0.5">🔗 公開URL識別子</div>
              <p className="text-xs text-slate-500">
                問い別出現ページ・企業AIプロフィールページ共通のURL識別子です。<br />
                会社名から自動提案されますが、ブランド表記や可読性に合わせて編集できます。
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-500 font-mono">app.aisle-aio.ai /</span>
              <input
                type="text"
                value={clientSlugInput}
                onChange={e => handleClientSlugChange(e.target.value)}
                placeholder="your-company"
                className={`w-52 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 ${
                  clientSlugError
                    ? 'border-red-300 focus:ring-red-300 bg-red-50'
                    : 'border-slate-300 focus:ring-indigo-400'
                }`}
              />
              <span className="text-sm text-slate-500 font-mono">/ recommendation</span>
            </div>
            {clientSlugError && (
              <p className="text-xs text-red-600">⚠ {clientSlugError}</p>
            )}
            {!clientSlugError && clientSlugInput && (
              <p className="text-xs text-green-700">
                ✓ 公開URL例：<code className="bg-slate-100 px-1 rounded">app.aisle-aio.ai/{clientSlugInput}/recommendation</code>
              </p>
            )}
            <p className="text-xs text-slate-400">
              使用可能：小文字英数字とハイフン　例：<code className="bg-slate-100 px-1 rounded text-xs">storefront</code>　<code className="bg-slate-100 px-1 rounded text-xs">anchor-artworks</code>
            </p>
          </div>

          {/* ── 問い別出現ページ（P-ID別） ─────────────── */}
          <Card>
            <CardHeader
              title="問い別AIページ"
              subtitle="問いの種類ごとに専用ページを生成・管理します（公開URL：/{clientSlug}/{promptSlug} 形式）"
            />
            <CardBody>
              <div className="space-y-4">
                {/* 説明 */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700 space-y-1.5">
                  <div className="font-semibold text-indigo-800">📄 問い別AIページとは？</div>
                  <p>「選定・相談」「比較」「ランキング」など問いの種類ごとに専用ページを生成します。生成AIがその問いに答える際に、貴社情報をそのまま参照・引用できる構造で公開されます。</p>
                  <p>Ver1.5 公開URL：<code className="bg-white px-1 rounded text-xs">app.aisle-aio.ai/{'{clientSlug}'}/{'{promptSlug}'}</code></p>
                  <p className="text-xs text-indigo-600">例：<code className="bg-white px-1 rounded text-xs">app.aisle-aio.ai/storefront/recommendation</code>　※ clientSlug は上部の「公開URL識別子」で設定・変更できます</p>
                  <p>AI向けコンテンツマップ：<code className="bg-white px-1 rounded text-xs">app.aisle-aio.ai/llms.txt</code></p>
                  <p className="text-xs text-indigo-600">llms.txt はAIに重要ページを伝えるためのコンテンツマップです。Ver1.5では本システム上で公開された生成ページを案内する補助ファイルとして扱います。</p>
                </div>

                {/* モード選択 */}
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">生成モード</div>
                  <div className="flex gap-3 flex-wrap">
                    {(['add', 'update'] as const).map(m => (
                      <label key={m} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                        aisleMode === m ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <input type="radio" name="aisleMode" value={m} checked={aisleMode === m}
                          onChange={() => { setAisleMode(m); setSelectedUpdateSlugs(new Set()); setAisleResult(null); }}
                          className="accent-indigo-600" />
                        <div>
                          <div className="text-sm font-semibold text-slate-700">{m === 'add' ? '新規ページを追加' : '既存ページを上書き'}</div>
                          <div className="text-xs text-slate-500">
                            {m === 'add'
                              ? 'まだ存在しない問い別ページだけを作成します。既存ページは変更しません。'
                              : '選択した既存ページを、現在の設計内容で更新します。'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* addモード: 新規/スキップ表示 */}
                {aisleMode === 'add' && (
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">生成対象の問いタイプ</div>
                    {aisleAvailableBaseIds.length === 0 ? (
                      <div className="text-sm text-slate-400">設計データに問いタイプが含まれていません</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {aisleAvailableBaseIds.map(baseId => {
                          const slug = AISLE_PROMPT_SLUGS[baseId];
                          const isExisting = !!slug && existingSlugsSet.has(slug);
                          const label = AISLE_LABEL_MAP[baseId] ?? baseId;
                          return (
                            <div key={baseId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                              isExisting
                                ? 'bg-slate-100 border-slate-200 text-slate-400'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            }`}>
                              <span className="font-bold">{baseId}</span>
                              <span className="font-normal">{label}</span>
                              <span className={`ml-1 ${isExisting ? 'text-slate-400' : 'text-indigo-500'}`}>
                                {isExisting ? '（スキップ）' : '（新規）'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* updateモード: 既存ページ選択 */}
                {aisleMode === 'update' && (
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">更新するページを選択</div>
                    {existingAisleIndex.length === 0 ? (
                      <div className="text-sm text-slate-400">既存の問い別AIページがありません（「追加」モードで先に生成してください）</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {existingAisleIndex.map(entry => {
                          const isChecked = selectedUpdateSlugs.has(entry.promptSlug);
                          return (
                            <label key={entry.promptSlug} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                              isChecked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                            }`}>
                              <input type="checkbox" className="accent-indigo-600" checked={isChecked}
                                onChange={() => {
                                  setSelectedUpdateSlugs(prev => {
                                    const next = new Set(prev);
                                    next.has(entry.promptSlug) ? next.delete(entry.promptSlug) : next.add(entry.promptSlug);
                                    return next;
                                  });
                                }}
                              />
                              <div>
                                <div className="text-xs font-semibold text-slate-700">{entry.label}</div>
                                <div className="text-xs text-slate-400">{entry.promptTypeId} / /{entry.slug}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 生成ボタン */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateAislePage}
                    disabled={isGeneratingAislePage || (aisleMode === 'update' && selectedUpdateSlugs.size === 0) || !!clientSlugError || !clientSlugInput}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                      isGeneratingAislePage || (aisleMode === 'update' && selectedUpdateSlugs.size === 0) || !!clientSlugError || !clientSlugInput
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                    }`}
                  >
                    {isGeneratingAislePage ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        生成中...
                      </>
                    ) : aisleMode === 'add' ? '🌐 問い別出現ページを生成する' : '🔄 選択したページを上書き更新する'}
                  </button>
                  <button
                    onClick={() => fetchAisleIndex(clientSlugInput || undefined)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors"
                  >
                    🔃 一覧を更新
                  </button>
                </div>

                {/* 公開中のページ一覧（削除ボタン付き） */}
                {existingAisleIndex.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">公開中のページ（{existingAisleIndex.length}件）</span>
                      <span className="text-xs text-slate-400">削除すると即座に非公開になります</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {existingAisleIndex.map(entry => (
                        <div key={entry.promptSlug} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">{entry.promptText ?? entry.label}</div>
                            <code className="text-xs text-slate-400">/{entry.slug}</code>
                          </div>
                          <a
                            href={`https://app.aisle-aio.ai/${entry.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            開く
                          </a>
                          <button
                            onClick={() => { void handleDeleteAislePage(entry); }}
                            disabled={isDeletingAisleSlug === entry.promptSlug}
                            className="flex-shrink-0 px-2.5 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isDeletingAisleSlug === entry.promptSlug ? '削除中...' : '削除'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 結果表示 */}
                {aisleResult && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✅</span>
                        <span className="font-semibold text-green-800">問い別出現ページが生成されました</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                          🌐 公開済み
                        </span>
                        <span className="text-xs text-slate-500">URLからアクセスできます</span>
                      </div>
                    </div>

                    {/* 親ページ */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">親ページ（エンティティHub）</div>
                      <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <code className="text-sm text-slate-700 flex-1 break-all">{aisleResult.parentUrl}</code>
                        <a href={aisleResult.parentUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-200">開く</a>
                      </div>
                    </div>

                    {/* llms.txt */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">AI向けコンテンツマップ（llms.txt）</div>
                      <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <code className="text-sm text-slate-700 flex-1 break-all">{aisleResult.llmsTxtUrl}</code>
                        <a href={aisleResult.llmsTxtUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-semibold hover:bg-slate-200">開く</a>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">llms.txt はAIに重要ページを伝えるためのコンテンツマップです。Ver1.5では本システム上で公開された生成ページを案内する補助ファイルとして扱います。</p>
                    </div>

                    {/* 子ページ一覧 */}
                    {(aisleResult.created.length > 0 || aisleResult.updated.length > 0) && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          {aisleResult.created.length > 0 && `新規生成 ${aisleResult.created.length}件`}
                          {aisleResult.created.length > 0 && aisleResult.updated.length > 0 && ' / '}
                          {aisleResult.updated.length > 0 && `更新 ${aisleResult.updated.length}件`}
                        </div>
                        <div className="space-y-1">
                          {[...aisleResult.created, ...aisleResult.updated].map(url => (
                            <div key={url} className="bg-white border border-green-100 rounded-lg px-3 py-2 flex items-center gap-2">
                              <code className="text-xs text-slate-600 flex-1 break-all">{url}</code>
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="flex-shrink-0 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold hover:bg-green-200">開く</a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* スキップ */}
                    {aisleResult.skipped.length > 0 && (
                      <div className="text-xs text-slate-400">
                        スキップ（既存）：{aisleResult.skipped.length}件
                      </div>
                    )}
                  </div>
                )}

                {/* エラー */}
                {aisleError && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span className="flex-shrink-0">⚠️</span>
                    <div className="flex-1">{aisleError}</div>
                    <button onClick={() => setAisleError(null)} className="flex-shrink-0 text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* ── 企業AIプロフィールページ ─────────────────────────────── */}
          <Card>
            <CardHeader
              title="企業AIプロフィールページ"
              subtitle="GPT・Perplexityが会社情報を参照しやすいAI向けページを生成します"
            />
            <CardBody>
              <div className="space-y-4">
                {/* 説明 */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700 space-y-2">
                  <div className="font-semibold text-indigo-800">🏢 企業AIプロフィールページとは？</div>
                  <p>会社単位でAIが参照しやすい構造のHTMLページを生成します。診断結果をテーマ別に整理し、GPT・Perplexityなどが会社情報を正確に引用できる形で公開します。</p>
                  <p>このページは診断レポートと合わせて、<br />2つの納品物として提供されます：</p>
                  <ul className="list-none space-y-0.5 pl-1">
                    <li>・<span className="font-medium">診断レポート（PDF）</span>：なぜ出ないかの構造分析と実装設計書</li>
                    <li>・<span className="font-medium">企業AIプロフィールページ（HTML）</span>：AIが参照・理解しやすい情報ページ</li>
                  </ul>
                  <p className="font-medium pt-1">公開URL：<code className="bg-white px-1 rounded text-xs">app.aisle-aio.ai/{clientSlugInput || '（公開URL識別子を設定してください）'}</code></p>
                </div>

                {/* 外部リソース（複数URL） */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      AI向け根拠補完リンク
                      <span className="ml-1 text-xs text-slate-400 font-normal">（任意・最大{MAX_URLS}件）</span>
                    </label>
                    {externalUrls.length < MAX_URLS && (
                      <button
                        onClick={addExternalUrl}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                      >
                        ＋ URLを追加
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {externalUrls.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={item.type}
                          onChange={e => updateExternalUrl(index, 'type', e.target.value)}
                          className="border border-slate-300 rounded-lg px-2 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-shrink-0 bg-white"
                        >
                          {URL_TYPE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="url"
                          value={item.url}
                          onChange={e => updateExternalUrl(index, 'url', e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {externalUrls.length > 1 && (
                          <button
                            onClick={() => removeExternalUrl(index)}
                            className="text-slate-400 hover:text-red-500 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors text-sm"
                            title="削除"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    note・LinkedIn・PR記事などを追加すると、AIが会社説明の根拠として参照しやすい補完情報として掲載されます
                  </p>
                </div>

                {/* 生成前：新規ボタン */}
                {!generatedPage && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleNewPageClick}
                      disabled={isGeneratingPage || isCheckingPage || !!clientSlugError || !clientSlugInput}
                      className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                        isGeneratingPage || isCheckingPage || !!clientSlugError || !clientSlugInput
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                      }`}
                    >
                      {isCheckingPage ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          既存ページを確認中...
                        </>
                      ) : isGeneratingPage ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          生成中...
                        </>
                      ) : (
                        <>🌐 AI専用ページを生成する</>
                      )}
                    </button>
                    <span className="text-xs text-slate-400">
                      ※ 同じ会社名のページが既存の場合は確認ダイアログが表示されます
                    </span>
                  </div>
                )}

                {/* 生成後：URL表示 + 追記/更新/削除ボタン */}
                {generatedPage && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✅</span>
                        <span className="font-semibold text-green-800">企業AIプロフィールページが生成されました</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                          🌐 公開済み
                        </span>
                      </div>
                      {/* 日時表示 */}
                      <div className="text-right text-xs text-slate-500 space-y-0.5">
                        <div className="text-slate-400">URLからアクセスできます</div>
                        <div>生成：{new Date(generatedPage.generatedAt).toLocaleString('ja-JP')}</div>
                        {generatedPage.updatedAt && (
                          <div className="text-indigo-600 font-medium">
                            最終更新：{new Date(generatedPage.updatedAt).toLocaleString('ja-JP')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* URL表示 */}
                    <div className="bg-white border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
                      <code className="text-sm text-slate-700 flex-1 break-all">{generatedPage.url}</code>
                      <button
                        onClick={handleCopyUrl}
                        className="flex-shrink-0 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs font-semibold transition-colors"
                      >
                        {copied ? '✓ コピー済' : 'URLコピー'}
                      </button>
                    </div>

                    {/* アクションボタン（既存ページあり：追記/上書き） */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <a
                        href={generatedPage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        🔗 ページを開く
                      </a>
                      {/* 追記ボタン（メイン） */}
                      <button
                        onClick={() => handleGeneratePage('append')}
                        disabled={isGeneratingPage}
                        className="px-4 py-2 bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingPage ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            追記中...
                          </span>
                        ) : '➕ 追記する'}
                      </button>
                      {/* 上書き更新（サブ） */}
                      <button
                        onClick={() => handleGeneratePage('update')}
                        disabled={isGeneratingPage}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:border-slate-400 transition-colors disabled:opacity-50"
                      >
                        🔄 上書き更新
                      </button>
                      <button
                        onClick={handleDeletePage}
                        disabled={isDeletingPage}
                        className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isDeletingPage ? '削除中...' : '🗑️ ページを削除'}
                      </button>
                    </div>

                    {/* slug情報 */}
                    <div className="text-xs text-slate-400">
                      slug: <code className="bg-slate-100 px-1 rounded">{generatedPage.slug}</code>
                      　|　mode: 追記は既存ページへ新セクションを挿入 / 上書き更新は全体を再生成
                    </div>
                  </div>
                )}

                {/* エラー表示 */}
                {pageError && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span className="flex-shrink-0">⚠️</span>
                    <div>
                      <div className="font-semibold mb-0.5">エラー</div>
                      <div>{pageError}</div>
                      {pageError.includes('KV') || pageError.includes('fetch') ? (
                        <div className="mt-1 text-xs text-red-500">
                          → Vercel KVストアの作成と環境変数（KV_REST_API_URL / KV_REST_API_TOKEN）の設定を確認してください
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => setPageError(null)} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── 上書き確認ダイアログ ────────────────────────────────── */}
      {overwriteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div>
                <h3 className="font-bold text-slate-800 text-lg leading-snug">
                  既存ページが見つかりました
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  スラグ <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-700">{overwriteDialog.slug}</code> にすでにページが存在します。
                  どの操作を行いますか？
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/* 上書き */}
              <button
                onClick={async () => { setOverwriteDialog(null); await handleGeneratePage('update'); }}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all text-left flex items-start gap-3"
              >
                <span className="text-base flex-shrink-0 mt-0.5">🔄</span>
                <div>
                  <div>上書きする</div>
                  <div className="text-xs text-indigo-200 font-normal mt-0.5">
                    既存ページのテーマ別セクションを新しいコンテンツで差し替えます
                  </div>
                </div>
              </button>

              {/* 追記 */}
              <button
                onClick={async () => { setOverwriteDialog(null); await handleGeneratePage('append'); }}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all text-left flex items-start gap-3"
              >
                <span className="text-base flex-shrink-0 mt-0.5">➕</span>
                <div>
                  <div>追記する</div>
                  <div className="text-xs text-green-200 font-normal mt-0.5">
                    既存ページを保持したまま、新しいセクションを末尾に追加します
                  </div>
                </div>
              </button>

              {/* キャンセル */}
              <button
                onClick={() => setOverwriteDialog(null)}
                className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
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
