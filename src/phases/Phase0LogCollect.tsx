import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Phase0PromptItem } from '../store/useAppStore';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Button } from '../components/Button';
import type { LogEntry } from '../types';
import { P_IDS } from '../store/masterData';
import { classifyPId } from '../utils/classifyPId';

// =====================================================================
// 定数
// =====================================================================

const MODELS = [
  { id: 'gpt-4.1',     label: 'GPT-4.1' },
  { id: 'gpt-4o',      label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
] as const;

const LOOP_COUNTS = [10, 20, 50, 100, 200] as const;
const BATCH_SIZE  = 10;
const MAX_PROMPTS = 20;

// =====================================================================
// 型定義
// =====================================================================

// Phase0PromptItem はストアから再エクスポートされた型を使用
type PromptItem = Phase0PromptItem;

interface TrialResult {
  promptGroup: string;
  promptId: string;
  promptText: string;
  trialNo: number;
  appeared: boolean;
  answer: string;
  reason: string;
  source: string;
}

// =====================================================================
// ユーティリティ
// =====================================================================

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toCSV(rows: TrialResult[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const header = 'プロンプト群,プロンプトID,プロンプト,試行No,出現有無,出力本文,出力理由,出典分類';
  const body = rows.map(r => [
    esc(r.promptGroup),
    esc(r.promptId),
    esc(r.promptText),
    r.trialNo,
    r.appeared ? '出現' : '非出現',
    esc(r.answer),
    esc(r.reason),
    esc(r.source),
  ].join(','));
  return [header, ...body].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const bom  = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${s % 60}秒`;
}

// =====================================================================
// Phase0LogCollect
// =====================================================================

export function Phase0LogCollect() {
  const { setLogEntries, setPhase, phase0Data, setPhase0Data } = useAppStore();

  // ── 基本設定（Zustandストアから初期値を復元）────────────────────
  const [companyName, setCompanyName] = useState(phase0Data?.companyName ?? '');
  const [category,    setCategory]    = useState(phase0Data?.category    ?? '');
  const [keywords,    setKeywords]    = useState(phase0Data?.keywords    ?? '');

  // ── 実行設定 ──────────────────────────────────────────────────────
  const [model,     setModel]     = useState<string>('gpt-4.1');
  const [loopCount, setLoopCount] = useState<number>(100);

  // ── プロンプト設定（Zustandストアから初期値を復元）──────────────
  const [prompts,  setPrompts]  = useState<PromptItem[]>(phase0Data?.prompts ?? []);
  const [newText,  setNewText]  = useState('');
  // P-ID判定中のプロンプトid set（ローカルのみ）
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());

  // ── Zustandへの自動同期（companyName/category/keywords/prompts が変わるたびに保存）
  useEffect(() => {
    setPhase0Data({ companyName, category, keywords, prompts });
  }, [companyName, category, keywords, prompts, setPhase0Data]);

  // ── 実行状態 ──────────────────────────────────────────────────────
  const [isRunning,   setIsRunning]   = useState(false);
  const [completed,   setCompleted]   = useState(0);
  const [total,       setTotal]       = useState(0);
  const [elapsedMs,   setElapsedMs]   = useState(0);
  const [errorLog,    setErrorLog]    = useState<string[]>([]);
  const [results,     setResults]     = useState<TrialResult[]>([]);
  const [csvData,     setCsvData]     = useState<string>('');
  const [startedAt,   setStartedAt]   = useState<Date | null>(null);
  const [finishedAt,  setFinishedAt]  = useState<Date | null>(null);

  const abortRef     = useRef(false);
  const resultsRef   = useRef<TrialResult[]>([]);

  // ── プロンプト追加（非同期：P-ID自動判定付き） ──────────────────
  const addPrompt = async () => {
    if (!newText.trim()) return;
    if (prompts.length >= MAX_PROMPTS) return;
    const newId = uid();
    const newPrompt: PromptItem = {
      id: newId,
      promptText: newText.trim(),
      promptTypeId: '',
      promptTypeSecondary: [],
      promptTypeReason: '',
    };
    setPrompts(prev => [...prev, newPrompt]);
    setNewText('');

    // 非同期でP-ID判定
    setClassifyingIds(prev => new Set([...prev, newId]));
    try {
      const result = await classifyPId(newPrompt.promptText);
      setPrompts(prev => prev.map(p =>
        p.id === newId
          ? { ...p, promptTypeId: result.primary, promptTypeSecondary: result.secondary, promptTypeReason: result.reason }
          : p
      ));
    } catch {
      setPrompts(prev => prev.map(p =>
        p.id === newId
          ? { ...p, promptTypeId: 'P-01', promptTypeReason: '判定失敗（デフォルト: P-01）' }
          : p
      ));
    } finally {
      setClassifyingIds(prev => {
        const next = new Set(prev);
        next.delete(newId);
        return next;
      });
    }
  };

  const removePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  // ── ログ取得実行 ──────────────────────────────────────────────────
  const handleStart = async () => {
    if (!companyName.trim())   { alert('会社名を入力してください'); return; }
    if (prompts.length === 0)  { alert('プロンプトを1件以上追加してください'); return; }

    const totalCalls = prompts.length * loopCount;
    setTotal(totalCalls);
    setCompleted(0);
    setErrorLog([]);
    setResults([]);
    setCsvData('');
    setStartedAt(new Date());
    setFinishedAt(null);
    setIsRunning(true);
    abortRef.current    = false;
    resultsRef.current  = [];
    const startTime     = Date.now();

    try {
      for (let pi = 0; pi < prompts.length; pi++) {
        const prompt = prompts[pi];
        if (abortRef.current) break;
        // P-01, P-02 … と自動採番（フェーズ01の因果分析でP-IDクラスタは自動分類）
        const autoId = `P-${String(pi + 1).padStart(2, '0')}`;

        // loopCount 件を BATCH_SIZE ずつ順次実行
        for (let base = 1; base <= loopCount; base += BATCH_SIZE) {
          if (abortRef.current) break;

          const batchNos: number[] = [];
          for (let n = base; n < base + BATCH_SIZE && n <= loopCount; n++) {
            batchNos.push(n);
          }

          try {
            const resp = await fetch('/api/log-collect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                promptGroup:  autoId,
                promptId:     autoId,
                promptText:   prompt.promptText,
                trialNumbers: batchNos,
                model,
                companyName:  companyName.trim(),
                category:     category.trim(),
                keywords: keywords.trim()
                  ? keywords.split(',').map(k => k.trim()).filter(Boolean)
                  : [],
              }),
              signal: AbortSignal.timeout(55000),
            });

            const data = await resp.json() as {
              ok: boolean;
              results?: Array<{
                trialNo: number; appeared: boolean;
                answer: string; reason: string; source: string;
              }>;
              error?: string;
            };

            if (data.ok && data.results) {
              const newRows: TrialResult[] = data.results.map(r => ({
                promptGroup: autoId,
                promptId:    autoId,
                promptText:  prompt.promptText,
                trialNo:     r.trialNo,
                appeared:    r.appeared,
                answer:      r.answer,
                reason:      r.reason,
                source:      r.source,
              }));
              resultsRef.current = [...resultsRef.current, ...newRows];
              setResults([...resultsRef.current]);
            } else {
              setErrorLog(prev => [...prev, `[${autoId} 試行${base}-${base + batchNos.length - 1}] ${data.error ?? '不明なエラー'}`]);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setErrorLog(prev => [...prev, `[${autoId} 試行${base}-${base + batchNos.length - 1}] ${msg}`]);
          }

          setCompleted(prev => prev + batchNos.length);
          setElapsedMs(Date.now() - startTime);
        }
      }
    } finally {
      setIsRunning(false);
      setFinishedAt(new Date());
      setElapsedMs(Date.now() - startTime);
      const csv = toCSV(resultsRef.current);
      setCsvData(csv);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  // ── フェーズ①へ進む ──────────────────────────────────────────────
  const goToPhase1 = () => {
    if (results.length === 0) return;
    const entries: LogEntry[] = results.map((r, idx) => {
      // r.promptId は "P-01" のような行番号。prompts配列の対応インデックスから promptTypeId を取得する
      const promptIndex = parseInt(r.promptId.split('-')[1] ?? '1') - 1;
      const promptTypeId = prompts[promptIndex]?.promptTypeId || undefined;
      return {
        id:             String(idx + 1),
        promptId:       r.promptId,
        promptTypeId,
        prompt:         r.promptText,
        trialNo:        r.trialNo,
        appeared:       r.appeared,
        aiOutput:       r.answer,
        outputReason:   r.reason,
        sourceCategory: r.source,
        cId:  '',
        aId:  '',
        apId: '',
        kIds: [],
        eIds: [],
      };
    });
    setLogEntries(entries);
    setPhase(2);
  };

  // ── バリデーション ────────────────────────────────────────────────
  const canStart = !isRunning && companyName.trim().length > 0 && prompts.length > 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const appearedCount  = results.filter(r => r.appeared).length;
  const appearRate     = results.length > 0 ? Math.round((appearedCount / results.length) * 100) : 0;

  // ── レンダリング ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">01 ログ取得</h1>
        <p className="text-slate-500 text-sm mt-1">
          GPT / Gemini に複数回プロンプトを投げてAI出力ログを自動収集します。
          取得したログはそのまま 02 因果分析の入力データとして使用できます。
        </p>
      </div>

      {/* ① 基本設定 */}
      <Card>
        <CardHeader title="① 基本設定" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                会社名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="例：株式会社サンプル"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-slate-400 mt-1">判定キーワード未入力時は会社名で出現判定します</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                商材カテゴリ
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="例：AI出現設計"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              判定キーワード
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="例：アリエール, ファブリーズ, P&G（カンマ区切り）"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-slate-400 mt-1">
              カンマ区切りで複数指定可。いずれかが出力本文に含まれれば「出現」と判定します。未入力時は会社名を使用。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ② 実行回数設定 */}
      <Card>
        <CardHeader title="② 実行回数設定" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* モデル選択 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ログ取得モデル</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* 試行回数 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">試行回数</label>
              <select
                value={loopCount}
                onChange={e => setLoopCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {LOOP_COUNTS.map(n => (
                  <option key={n} value={n}>{n}回</option>
                ))}
              </select>
            </div>

            {/* 合計件数 */}
            <div className="flex items-end">
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                合計：<span className="font-bold text-indigo-700">{prompts.length * loopCount}</span> 件
                {prompts.length > 0 && (
                  <span className="text-xs text-slate-400 ml-1">（{prompts.length}プロンプト × {loopCount}回）</span>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ③ プロンプト設定 */}
      <Card>
        <CardHeader
          title="③ プロンプト設定"
          subtitle={`最大${MAX_PROMPTS}件まで登録できます`}
        />
        <CardBody>
          {/* プロンプト追加フォーム */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">プロンプト文</label>
              <div className="flex gap-2">
                <textarea
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addPrompt(); }}
                  placeholder="例：自社のサービスがChatGPTに出てこないんですが、どうすればいいですか？"
                  rows={2}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
                />
                <button
                  onClick={addPrompt}
                  disabled={!newText.trim() || prompts.length >= MAX_PROMPTS}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
                >
                  ＋ 追加
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Ctrl+Enter で追加 ／ P-IDは因果分析フェーズで自動分類されます</p>
            </div>
          </div>

          {/* 登録済みプロンプト一覧 */}
          {prompts.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500">登録済みプロンプト（{prompts.length}/{MAX_PROMPTS}件）</p>
              {prompts.map((p, idx) => {
                const isClassifying = classifyingIds.has(p.id);
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-2">
                    {/* プロンプト行 */}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-20 mt-0.5">
                        <div className="text-xs font-semibold text-slate-600">
                          Prompt #{String(idx + 1).padStart(2, '0')}
                        </div>
                      </div>
                      <p className="flex-1 text-sm text-slate-700 break-words">{p.promptText}</p>
                      <button
                        onClick={() => removePrompt(p.id)}
                        className="text-slate-400 hover:text-red-500 text-lg leading-none flex-shrink-0"
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                    {/* P-ID判定行 */}
                    <div className="flex items-center gap-2 pl-20">
                      {isClassifying ? (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          問いの型を判定中...
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">P-ID：</span>
                          <select
                            value={p.promptTypeId}
                            onChange={e => setPrompts(prev => prev.map(pt =>
                              pt.id === p.id ? { ...pt, promptTypeId: e.target.value } : pt
                            ))}
                            className="text-xs border border-slate-200 rounded px-2 py-0.5 text-indigo-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          >
                            {P_IDS.filter(x => x.pId !== 'P-99').map(x => (
                              <option key={x.pId} value={x.pId}>{x.pId} {x.label}</option>
                            ))}
                          </select>
                          {p.promptTypeReason?.includes('判定失敗') && (
                            <span className="text-xs text-amber-500 truncate max-w-xs hidden sm:inline">
                              ⚠ {p.promptTypeReason}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
              プロンプトをまだ追加していません
            </div>
          )}
        </CardBody>
      </Card>

      {/* ④ 実行 */}
      <Card>
        <CardHeader title="④ 実行" />
        <CardBody>
          {/* 実行・停止ボタン */}
          <div className="flex items-center gap-3">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                ■ 停止
              </button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={!canStart}
                className="px-6 py-2.5 text-sm"
              >
                ▶ ログ取得を開始する
              </Button>
            )}

            {!isRunning && !canStart && (
              <p className="text-xs text-slate-400">
                {!companyName.trim() ? '会社名を入力してください' :
                 prompts.length === 0 ? 'プロンプトを追加してください' : ''}
              </p>
            )}
          </div>

          {/* プログレスバー */}
          {(isRunning || completed > 0) && (
            <div className="mt-5 space-y-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>
                  {completed} / {total} 件
                  {isRunning && elapsedMs > 0 && (
                    <span className="ml-2 text-slate-400">経過：{formatTime(elapsedMs)}</span>
                  )}
                </span>
                <span className="font-semibold text-indigo-700">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    isRunning ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isRunning && (
                <p className="text-xs text-slate-400 animate-pulse">
                  AIに問い合わせ中... {BATCH_SIZE}件ずつ並列処理しています
                </p>
              )}
            </div>
          )}

          {/* 完了サマリー */}
          {!isRunning && results.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">✅ ログ取得完了</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800">{results.length}</p>
                    <p className="text-xs text-slate-500">取得件数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-700">{appearedCount}</p>
                    <p className="text-xs text-slate-500">出現件数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-600">{appearRate}%</p>
                    <p className="text-xs text-slate-500">出現率</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-600">
                      {finishedAt && startedAt
                        ? formatTime(finishedAt.getTime() - startedAt.getTime())
                        : '-'}
                    </p>
                    <p className="text-xs text-slate-500">所要時間</p>
                  </div>
                </div>
              </div>

              {/* エラーログ */}
              {errorLog.length > 0 && (
                <details className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <summary className="text-xs font-semibold text-amber-700 cursor-pointer">
                    ⚠ エラー {errorLog.length} 件（クリックで展開）
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {errorLog.map((e, i) => (
                      <li key={i} className="text-xs text-amber-800 font-mono break-all">{e}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* プレビューテーブル */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">取得結果プレビュー（先頭10件）</p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['P-ID', 'No', '出現', '出力本文（抜粋）', '出典'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-slate-600 font-semibold border-b border-slate-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(0, 10).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-mono text-indigo-700 whitespace-nowrap">{r.promptId}</td>
                          <td className="px-3 py-2 text-slate-500">{r.trialNo}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                              r.appeared ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {r.appeared ? '出現' : '非出現'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{r.answer.slice(0, 60)}{r.answer.length > 60 ? '…' : ''}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.length > 10 && (
                  <p className="text-xs text-slate-400 mt-1 text-right">他 {results.length - 10} 件</p>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => downloadCSV(csvData, `aisle_log_${companyName}_${new Date().toISOString().slice(0, 10)}.csv`)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ⬇ CSVダウンロード
                </button>
                <button
                  onClick={goToPhase1}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
                >
                  このログで 02 因果分析へ進む →
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
