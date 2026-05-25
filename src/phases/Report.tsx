import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { Badge } from '../components/Badge';
import { filterIds } from '../utils/idFilter';
import { translatePId, translateKIdLabel, translateEIds } from '../utils/clientTranslation';

// ─── 定数 ──────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#f97316'];

const M_ID_NAMES: Record<string, string> = {
  'M-01': '認知・話題性', 'M-02': '差別化・独自性', 'M-03': '導入実績・信頼',
  'M-04': '専門性・技術性', 'M-05': '世界観・価値観提示', 'M-06': '課題提起・共感形成',
  'M-07': '解決策・方法提示', 'M-08': '比較軸・検討材料提示', 'M-09': '推薦・第三者視点',
  'M-10': '行動喚起・次アクション', 'M-11': '先進性・未来価値', 'M-12': '構造設計・包括性',
  'M-13': '対象特化・業界焦点',
};

// C-IDは出力意味特徴の補助特徴量（K-ID/E-ID導出の前段）。新定義はC-01〜C-06の6分類。
// C-07〜C-10は廃止済み（既存データ表示のため残存）。
const C_ID_LABELS: Record<string, string> = {
  'C-01': '信頼形成型',
  'C-02': '比較評価型',
  'C-03': '構造理解型',
  'C-04': '世界観共鳴型',
  'C-05': '利用文脈型',
  'C-06': '話題性・先進性型',
  // 旧分類（廃止済み — 既存データ表示のためのフォールバック）
  'C-07': '問題提起・社会性型（廃止）',
  'C-08': 'エモーショナル訴求型（廃止）',
  'C-09': 'FAQ・ナビゲーション型（廃止）',
  'C-10': '利用文脈共有型（廃止）',
};

// K_ID_LABELS は廃止 → clientTranslation.ts の translateKIdLabel() を使用

// ─── 共通コンポーネント ─────────────────────────────────────────

function SectionHeader({
  num, title, subtitle, color,
}: { num: string; title: string; subtitle: string; color: string }) {
  return (
    <div className={`flex items-center gap-4 mb-6 mt-2 pb-4 border-b-2 ${color} print:mt-0`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${color.replace('border-', 'bg-').replace('-400', '-600').replace('-300', '-500')}`}>
        {num}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${color}`}>
      <div className="text-3xl font-bold leading-none">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
      <div className="text-xs font-semibold mt-2 opacity-80">{label}</div>
    </div>
  );
}

function NoData({ phase }: { phase: string }) {
  return (
    <div className="flex items-center justify-center h-32 rounded-xl bg-slate-50 border border-dashed border-slate-300">
      <p className="text-slate-400 text-sm">{phase} のデータがありません</p>
    </div>
  );
}

// ─── Section 1: 出力評価 ────────────────────────────────────────

function AppearanceBarChart({ data }: { data: { name: string; rate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <Tooltip formatter={(v) => v != null ? `${Number(v)}%` : ''} />
        <Bar dataKey="rate" name="出現率" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CIdPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => v != null ? `${Number(v)}件` : ''} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function KIdBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={200} />
        <Tooltip />
        <Bar dataKey="value" name="頻度スコア" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Section 3: 突合診断グラフ ──────────────────────────────────

function GapBarChart({ appeared, notAppeared }: { appeared: number; notAppeared: number }) {
  const data = [
    { name: '出現あり', count: appeared, fill: '#10b981' },
    { name: '出現なし', count: notAppeared, fill: '#ef4444' },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip formatter={(v) => v != null ? `${Number(v)}件` : ''} />
        <Bar dataKey="count" name="件数" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DifficultyBarChart({ data }: { data: { name: string; count: number; fill: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip formatter={(v) => v != null ? `${Number(v)}件` : ''} />
        <Bar dataKey="count" name="件数" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Section 4: 優先度ロードマップ ─────────────────────────────

function RoadmapCard({
  priority, color, bg, border, items,
}: {
  priority: string;
  color: string;
  bg: string;
  border: string;
  items: { sbId: string; action: string; targetPage: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4`}>
      <div className={`text-sm font-bold mb-3 ${color}`}>
        優先度：{priority}（{items.length}件）
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white/70 rounded-lg px-3 py-2 flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-[10px]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 leading-relaxed">{filterIds(item.action)}</p>
              <p className="text-xs text-slate-400 mt-0.5">📍 {item.targetPage}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── メインレポートコンポーネント ──────────────────────────────

export function Report() {
  const { phase1Result, phase2Result, phase3Result, phase4Result, phase0Data, logEntries, competitorAnalysis } = useAppStore();
  // ── データ変換 ──────────────────────────────────────────────

  // Executive Summary KPI
  const avgAppearanceRate = phase1Result
    ? Math.round(
        phase1Result.sub1.appearanceRates.reduce(
          (s, r) => { const v = parseFloat(r.rate); return s + (Number.isFinite(v) ? v : 0); }, 0
        ) / Math.max(phase1Result.sub1.appearanceRates.length, 1)
      )
    : null;

  const totalSbIds = phase2Result
    ? phase2Result.perPID.reduce((s, p) => s + p.portfolio.length, 0)
    : null;

  const reconciledRate = phase3Result && phase3Result.detailReport.length > 0
    ? Math.round(phase3Result.detailReport.filter(r => r.appeared).length / phase3Result.detailReport.length * 100)
    : null;

  const planCount = phase4Result?.planRows.length ?? null;

  // Section 1: 出現率チャート
  const appearanceChartData = phase1Result
    ? phase1Result.sub1.appearanceRates.map(r => ({
        name: r.promptId,
        rate: (() => { const v = parseFloat(r.rate); return Number.isFinite(v) ? v : 0; })(),
      }))
    : [];

  // Section 1: C-ID分布
  const cIdTotals: Record<string, number> = {};
  if (phase1Result) {
    phase1Result.sub2.cIdMatrix.forEach(row => {
      Object.entries(row.counts).forEach(([key, val]) => {
        cIdTotals[key] = (cIdTotals[key] || 0) + val;
      });
    });
  }
  const cIdData = Object.entries(cIdTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value]) => ({ name: key, label: C_ID_LABELS[key] ?? key, value }));

  // Section 1: K-ID阻害要因
  const kIdTotals: Record<string, number> = {};
  if (phase1Result) {
    phase1Result.sub3.kIdMatrix.forEach(row => {
      Object.entries(row.rates).forEach(([key, val]) => {
        const rate = parseFloat(val);
        const safeRate = Number.isFinite(rate) ? rate : 0;
        if (safeRate > 0) kIdTotals[key] = (kIdTotals[key] || 0) + safeRate;
      });
    });
  }
  const kIdData = Object.entries(kIdTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, value]) => ({
      name: translateKIdLabel(key),
      value: Math.round(value),
    }));

  // Section 3: 突合
  const appearedCount = phase3Result?.detailReport.filter(r => r.appeared).length ?? 0;
  const notAppearedCount = (phase3Result?.detailReport.length ?? 0) - appearedCount;
  // 到達可能性スコア別（低=要対応）
  const difficultyData = [
    { name: '到達：低', count: phase3Result?.matrixReport.filter(r => r.reachabilityScore === '低').length ?? 0, fill: '#ef4444' },
    { name: '到達：中', count: phase3Result?.matrixReport.filter(r => r.reachabilityScore === '中').length ?? 0, fill: '#f59e0b' },
    { name: '到達：高', count: phase3Result?.matrixReport.filter(r => r.reachabilityScore === '高').length ?? 0, fill: '#10b981' },
  ];

  // Section 4: 優先度別
  const highPlans = phase4Result?.planRows.filter(r => r.priority === '高') ?? [];
  const midPlans = phase4Result?.planRows.filter(r => r.priority === '中') ?? [];
  const lowPlans = phase4Result?.planRows.filter(r => r.priority === '低') ?? [];

  // 会社名・商材
  const companyName = phase2Result?.companyName ?? phase3Result?.companyName ?? phase4Result?.companyName ?? '—';
  const productCategory = phase2Result?.productCategory ?? phase3Result?.productCategory ?? phase4Result?.productCategory ?? '—';

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body * { visibility: hidden; }
          #aisle-report, #aisle-report * { visibility: visible; }
          #aisle-report { position: absolute; left: 0; top: 0; width: 100%; }
          table { break-inside: avoid; }
          tr { break-inside: avoid; }
          .recharts-wrapper { break-inside: avoid; }
        }
      `}</style>
      <div className="space-y-8 pb-16">

      {/* エクスポートボタン（印刷時は非表示） */}
      <div className="flex justify-end gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
        >
          📄 PDFとして保存する
        </button>
      </div>

      {/* ここからがPDF出力対象 */}
      <div id="aisle-report" className="space-y-8 bg-slate-50 rounded-2xl p-6">

      {/* ── カバー ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-8 text-white print:rounded-none print:mb-8">
        <div className="text-xs font-semibold tracking-widest text-indigo-300 mb-2 uppercase">
          AI出現設計診断レポート
        </div>
        <h1 className="text-3xl font-bold mb-1">出現設計 総合レポート</h1>
        <p className="text-indigo-200 text-sm">ログ取得 ・ 因果分析 ・ 出現設計 ・ 設計レビュー ・ 実装設計の統合診断レポート</p>
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-indigo-300 text-xs">会社名</span>
            <div className="font-semibold">{companyName}</div>
          </div>
          <div>
            <span className="text-indigo-300 text-xs">商材カテゴリ</span>
            <div className="font-semibold">{productCategory}</div>
          </div>
          <div>
            <span className="text-indigo-300 text-xs">レポート生成日</span>
            <div className="font-semibold">{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* ── Aisleのアプローチについて ─────────────────────────── */}
      <div className="border-l-4 border-blue-500 bg-slate-100 rounded-r-xl px-6 py-5">
        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Aisleのアプローチについて</div>
        <p className="text-sm text-slate-700 leading-relaxed">
          Aisleは「AI出現設計」の専門フレームワークです。SEOが検索エンジンのアルゴリズム向けに人間が読むコンテンツを最適化するのに対し、Aisleは生成AI（ChatGPT・Perplexityなど）が回答を生成する際に、あなたの商材・ブランドが自然に引用・推薦されるよう、意味構造・構文設計・外部接点を体系的に整備します。成功の唯一の指標は「出現したか」——コンテンツを書いたかどうかではなく、AIの回答の中に現れたかどうかです。本レポートはその一連の診断と設計の統合結果です。
        </p>
      </div>

      {/* ── エグゼクティブサマリー ─────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-slate-500 uppercase tracking-widest mb-4">Executive Summary</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="平均出現率（因果分析）"
            value={avgAppearanceRate !== null ? `${avgAppearanceRate}%` : '—'}
            sub="P-ID全体の平均"
            color="bg-indigo-50 border-indigo-200 text-indigo-700"
          />
          <StatCard
            label="設計構文数（出現設計）"
            value={totalSbIds !== null ? `${totalSbIds}件` : '—'}
            sub="設計構文数"
            color="bg-blue-50 border-blue-200 text-blue-700"
          />
          <StatCard
            label="出現率（設計レビュー）"
            value={reconciledRate !== null ? `${reconciledRate}%` : '—'}
            sub="構文 × P-ID 出現率"
            color="bg-purple-50 border-purple-200 text-purple-700"
          />
          <StatCard
            label="実装施策数（実装設計）"
            value={planCount !== null ? `${planCount}件` : '—'}
            sub="優先設計施策"
            color="bg-green-50 border-green-200 text-green-700"
          />
        </div>

        {/* フロー図 */}
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">診断フロー</div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { num: '02', label: '因果分析', sub: 'なぜ出ないか', color: 'bg-indigo-600', done: !!phase1Result },
              { num: '03', label: '出現設計', sub: 'AIに読ませる説明文設計', color: 'bg-blue-600', done: !!phase2Result },
              { num: '04', label: '設計レビュー', sub: '実装前確認', color: 'bg-purple-600', done: !!phase3Result },
              { num: '05', label: '実装設計', sub: 'AI専用ページ生成', color: 'bg-green-600', done: !!phase4Result },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm ${step.done ? step.color : 'bg-slate-300'}`}>
                  <span className="font-bold">{step.num}</span>
                  <div>
                    <div className="font-semibold leading-none">{step.label}</div>
                    <div className="text-xs opacity-80">{step.sub}</div>
                  </div>
                  {step.done && <span className="text-xs ml-1">✓</span>}
                </div>
                {i < 3 && <span className="text-slate-400 font-bold text-lg">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Ver1 スコープ注記 ──────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 print:hidden">
        <div className="text-xs font-bold text-amber-700 mb-2">📌 Ver1 診断スコープについて</div>
        <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
          <li>出現阻害要因の導出はAIによる因果仮説であり、確定原因ではありません</li>
          <li>appeared=trueの問いはVer1では出現品質分析まで行っていません</li>
          <li>比較型問い（P-02/P-03）はVer2での強化対象です</li>
          <li>カテゴリ吸収・誤認検知はVer2で扱います</li>
          <li>出現検証ループ・モニタリング・Phase0への自動戻しはVer2対象です</li>
        </ul>
      </div>

      {/* ── SECTION 1: 出力評価 ────────────────────────────────── */}
      <div className="print:break-before-page">
        <SectionHeader
          num="02"
          title="因果分析"
          subtitle="GPT出力ログの出現率・AI回答の特徴と出現しにくい要因を分析"
          color="border-indigo-400 bg-indigo-400"
        />

        {!phase1Result ? <NoData phase="因果分析" /> : (
          <div className="space-y-6">
            {/* 出現率グラフ */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-sm font-bold text-slate-700 mb-1">P-ID別 出現率</div>
              <div className="text-xs text-slate-400 mb-4">プロンプトタイプごとのGPT出現率（%）</div>
              <AppearanceBarChart data={appearanceChartData} />
            </div>

            {/* C-ID / K-ID */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-sm font-bold text-slate-700 mb-1">AIが回答で使った情報の特徴</div>
                <div className="text-xs text-slate-400 mb-3">出現時のAI出力に見られる意味特徴の内訳（上位6件）</div>
                {cIdData.length > 0 ? (
                  <>
                    <CIdPieChart data={cIdData.map(d => ({ name: d.label, value: d.value }))} />
                    <div className="mt-3 space-y-1">
                      {cIdData.slice(0, 4).map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                          <span className="text-slate-600">{d.label}</span>
                          <span className="ml-auto font-semibold text-slate-700">{d.value}件</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <div className="text-center text-slate-400 text-xs py-8">データなし</div>}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-sm font-bold text-slate-700 mb-1">出現阻害要因</div>
                <div className="text-xs text-slate-400 mb-3">出現を妨げた要因の頻度スコア（上位8件）</div>
                {kIdData.length > 0
                  ? <KIdBarChart data={kIdData} />
                  : <div className="text-center text-slate-400 text-xs py-8">データなし</div>
                }
              </div>
            </div>

            {/* 出現しにくい理由の整理（構造接続サマリー） */}
            {(phase1Result.sub3.structureSummary?.length ?? 0) > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="text-sm font-bold text-slate-700">出現しにくい理由の整理</div>
                  <div className="text-xs text-slate-400 mt-0.5">問いタイプごとの出現構造・阻害要因・競合との差分</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50">
                        {['問いタイプ', '出現率', '出現構造', '阻害構造', '競合が出現している理由', '所見'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {phase1Result.sub3.structureSummary.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <Badge label={translatePId(row.promptTypeId ?? row.promptId)} color="indigo" />
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{row.rate}</td>
                          <td className="px-4 py-2.5 text-slate-600 max-w-[160px] leading-relaxed">{filterIds(row.appearStructure)}</td>
                          <td className="px-4 py-2.5 text-amber-800 max-w-[160px] leading-relaxed">{filterIds(row.blockStructure)}</td>
                          <td className="px-4 py-2.5 text-slate-600 max-w-[180px] leading-relaxed">{filterIds(row.complementStructure)}</td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-[180px] leading-relaxed italic">{filterIds(row.comment)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 競合分析サマリー */}
            {(() => {
              const rows = phase1Result?.sub3.eIdMatrix.filter(r => r.competitorEntity && r.competitorEntity !== '—') ?? [];
              if (rows.length === 0) return null;
              return (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-700">競合出現分析</div>
                    <div className="text-xs text-slate-400 mt-0.5">自社の代わりに出現した競合エンティティと競合が出現できている理由の一覧（上位10件）</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50">
                          {['問いタイプ', '出現していた競合', '競合が持つ強み', '競合が出現できた理由', '自社が欠けている点', '実装方針'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <Badge label={translatePId(r.promptTypeId || r.pId)} color="indigo" />
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{r.competitorEntity}</td>
                            <td className="px-4 py-2.5">
                              {r.winningEId && r.winningEId !== '—'
                                ? (
                                  <div className="flex gap-1 flex-wrap">
                                    {translateEIds(r.winningEId).map((label, i) => (
                                      <Badge key={i} label={label} color="green" />
                                    ))}
                                  </div>
                                )
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-[180px] leading-relaxed">
                              {r.winningFactor?.slice(0, 80)}{(r.winningFactor?.length ?? 0) > 80 ? '…' : ''}
                            </td>
                            <td className="px-4 py-2.5 text-amber-800 max-w-[160px] leading-relaxed">
                              {r.gapToAisle?.slice(0, 80)}{(r.gapToAisle?.length ?? 0) > 80 ? '…' : ''}
                            </td>
                            <td className="px-4 py-2.5">
                              {r.implementationDirection && r.implementationDirection !== '—' ? (
                                <span className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight
                                  ${r.implementationDirection === '再現' ? 'bg-green-50 border-green-200 text-green-700'
                                    : r.implementationDirection === '代替' ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                  {r.implementationDirection}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* competitorAnalysis がある場合はエンティティランキングも表示 */}
            {competitorAnalysis && competitorAnalysis.entityRanking.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">🏆 競合エンティティ 出現頻度ランキング</div>
                <div className="flex flex-wrap gap-2">
                  {competitorAnalysis.entityRanking.slice(0, 8).map((e, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-bold text-slate-400">#{e.rank}</span>
                      <span className="font-medium text-slate-700">{e.entity}</span>
                      <span className="text-slate-400">{e.count}件</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 出現率テーブル */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-700">出現率詳細テーブル</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">P-ID</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">プロンプトタイプ</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500">試行数</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500">出現数</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500">出現率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {phase1Result.sub1.appearanceRates.map((r, i) => {
                    const rate = (() => { const v = parseFloat(r.rate); return Number.isFinite(v) ? v : 0; })();
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-5 py-3"><Badge label={r.promptId} color="indigo" /></td>
                        <td className="px-5 py-3 text-slate-700">{r.typeName}</td>
                        <td className="px-5 py-3 text-center text-slate-600">{r.trialCount}</td>
                        <td className="px-5 py-3 text-center text-slate-600">{r.appearedCount}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(rate, 100)}%`,
                                  backgroundColor: rate >= 50 ? '#10b981' : rate >= 25 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                            <span className={`font-bold text-sm ${rate >= 50 ? 'text-green-600' : rate >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {r.rate}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 測定条件 */}
            {(phase0Data || phase1Result) && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">📋 測定条件</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                  {phase0Data?.companyName && (
                    <span><span className="text-slate-400">判定企業名：</span>{phase0Data.companyName}</span>
                  )}
                  {phase0Data?.keywords && (
                    <span><span className="text-slate-400">判定キーワード：</span>{phase0Data.keywords}</span>
                  )}
                  {phase1Result && (
                    <span>
                      <span className="text-slate-400">試行数（P-IDあたり）：</span>
                      {phase1Result.sub1.appearanceRates[0]?.trialCount ?? '—'}回
                    </span>
                  )}
                  {phase1Result && (
                    <span>
                      <span className="text-slate-400">測定P-ID数：</span>
                      {phase1Result.sub1.appearanceRates.length}件
                    </span>
                  )}
                  <span><span className="text-slate-400">判定基準：</span>企業名・商材名の明示的言及</span>
                </div>
              </div>
            )}

            {/* 出力ログサンプル */}
            {logEntries.length > 0 && (() => {
              // P-IDごとに出現あり1件・出現なし1件を抽出
              const pidMap = new Map<string, { promptText: string; appeared: string | undefined; notAppeared: string | undefined }>();
              for (const entry of logEntries) {
                const pid = entry.promptId;
                if (!pidMap.has(pid)) {
                  pidMap.set(pid, { promptText: entry.prompt, appeared: undefined, notAppeared: undefined });
                }
                const rec = pidMap.get(pid)!;
                if (entry.appeared && !rec.appeared) rec.appeared = entry.aiOutput;
                if (!entry.appeared && !rec.notAppeared) rec.notAppeared = entry.aiOutput;
              }
              const pids = [...pidMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
              if (pids.length === 0) return null;
              return (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-700">📋 出力ログサンプル</div>
                    <div className="text-xs text-slate-400 mt-0.5">P-IDごとに出現あり・出現なし各1件の抜粋</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pids.map(([pid, rec]) => (
                      <div key={pid} className="px-5 py-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge label={pid} color="indigo" />
                          <span className="text-xs text-slate-500 truncate">{rec.promptText}</span>
                        </div>
                        {rec.appeared && (
                          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 text-xs">
                            <span className="font-semibold text-green-700 mr-2">✅ 出現あり</span>
                            <span className="text-slate-600 leading-relaxed">
                              {rec.appeared.slice(0, 200)}{rec.appeared.length > 200 ? '…' : ''}
                            </span>
                          </div>
                        )}
                        {rec.notAppeared && (
                          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 text-xs">
                            <span className="font-semibold text-red-600 mr-2">✕ 出現なし</span>
                            <span className="text-slate-600 leading-relaxed">
                              {rec.notAppeared.slice(0, 200)}{rec.notAppeared.length > 200 ? '…' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 診断サマリー */}
            {phase1Result.strategy.priorityMatrix.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                <div className="text-sm font-bold text-indigo-800 mb-3">📋 診断サマリー・優先施策</div>
                <div className="space-y-2">
                  {phase1Result.strategy.priorityMatrix.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <Badge
                        label={p.priority}
                        color={p.priority === '高' ? 'red' : p.priority === '中' ? 'yellow' : 'green'}
                      />
                      <div>
                        <span className="font-medium text-slate-700">{p.category}：</span>
                        <span className="text-slate-600">{filterIds(p.action)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: 出現設計 ────────────────────────────────── */}
      <div className="print:break-before-page">
        <SectionHeader
          num="03"
          title="出現設計"
          subtitle="出現設計の狙い・構文ポートフォリオ・AIに読ませる説明文"
          color="border-blue-400 bg-blue-400"
        />

        {!phase2Result ? <NoData phase="出現設計" /> : (
          <div className="space-y-5">
            {/* 設計概要カード */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{phase2Result.perPID.length}</div>
                <div className="text-xs text-slate-500 mt-1">設計P-ID数</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{totalSbIds}</div>
                <div className="text-xs text-slate-500 mt-1">設計構文数</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {[...new Set(phase2Result.perPID.flatMap(p => p.portfolio.map(r => r.mId)))].length}
                </div>
                <div className="text-xs text-slate-500 mt-1">出現設計の観点</div>
              </div>
            </div>

            {/* P-ID別 設計詳細 */}
            {phase2Result.perPID.map((pid, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="text-xs font-semibold text-slate-600">
                      Prompt #{pid.pId.split('-')[1]}
                    </div>
                    <div className="text-[10px] text-indigo-600 mt-0.5 leading-tight">
                      問いタイプ：{pid.promptTypeLabel || translatePId(pid.promptTypeId ?? pid.pId.split('-').slice(0, 2).join('-'))}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">{pid.promptText}</span>
                  <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{pid.portfolio.length}構文設計</span>
                </div>

                {/* M-IDマッピング */}
                <div className="px-5 py-3 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-2">出現設計の狙い</div>
                  <div className="space-y-2">
                    {pid.mIdMapping.map((m, j) => {
                      const necessity = m.designNecessity ?? '';
                      const necessityColor = necessity.startsWith('必須')
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : necessity === '補助（K-ID補正）'
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          : 'bg-slate-100 border-slate-200 text-slate-600';
                      return (
                        <div key={j} className="flex flex-col gap-0.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-blue-800">{m.name}</span>
                            {necessity && (
                              <span className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${necessityColor}`}>
                                {necessity === '補助（K-ID補正）' ? '補強設計（出現しにくい理由への対応）' : necessity}
                              </span>
                            )}
                          </div>
                          {m.semanticRole && (
                            <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                              {m.semanticRole}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 出現設計の考え方 */}
                {pid.connectionComment && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                    <div className="text-xs font-semibold text-slate-500 mb-1">出現設計の考え方</div>
                    <p className="text-xs text-slate-700 leading-relaxed">{filterIds(pid.connectionComment)}</p>
                  </div>
                )}

                {/* 出現到達性評価サマリー */}
                {pid.appearanceSummary?.overallImpression && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-blue-50/40">
                    <div className="text-xs font-semibold text-blue-600 mb-1">出現到達性 総評</div>
                    <p className="text-xs text-slate-700 leading-relaxed">{filterIds(pid.appearanceSummary.overallImpression)}</p>
                  </div>
                )}

                {/* E-ID勝因接続（主要3件まで） */}
                {pid.eIdComplement && pid.eIdComplement.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 mb-2">競合が出現できている理由</div>
                    <div className="space-y-2">
                      {pid.eIdComplement.slice(0, 3).map((e, k) => {
                        const eid = e.winningEId ?? e.requiredEId ?? '';
                        const factor = e.winningFactor ?? e.resourceExample ?? '';
                        const gap = e.gapToAisle ?? '';
                        return (
                          <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              {eid && translateEIds(eid).map((label, i) => (
                                <Badge key={i} label={label} color="green" />
                              ))}
                              {(e.kId ?? e.kIdMatch) && (
                                <Badge label={translateKIdLabel(e.kId ?? e.kIdMatch ?? '')} color="red" />
                              )}
                              {e.reproducibility && (
                                <span className="text-slate-400">再現性：{e.reproducibility}</span>
                              )}
                            </div>
                            {factor && <p className="text-slate-600 leading-relaxed">{factor}</p>}
                            {gap && <p className="text-amber-700 mt-0.5">自社差分: {gap}</p>}
                          </div>
                        );
                      })}
                      {pid.eIdComplement.length > 3 && (
                        <p className="text-xs text-slate-400">… 他 {pid.eIdComplement.length - 3}件</p>
                      )}
                    </div>
                  </div>
                )}

                {/* AIに読ませる説明文 + 設計理由 */}
                <div className="px-5 py-3">
                  <div className="text-xs font-semibold text-slate-500 mb-2">AIに読ませる説明文（全件）</div>
                  <div className="space-y-3">
                    {pid.afterBun.map((b, j) => {
                      const portfolioItem = pid.portfolio.find(p => p.sbId === b.sbId);
                      const adoptionReason = portfolioItem?.adoptionReason?.trim();
                      const kIdCorrection = portfolioItem?.kIdCorrection?.trim();
                      const hasKIdCorrection = kIdCorrection && kIdCorrection !== 'なし' && kIdCorrection !== '';
                      return (
                        <div key={j} className="flex items-start gap-2 text-xs">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[10px]">
                            {j + 1}
                          </span>
                          <div className="flex-1">
                            <span className="text-slate-600 leading-relaxed block">{b.afterText}</span>
                            {adoptionReason && (
                              <p className="text-[11px] text-blue-600 mt-1 leading-snug">
                                💡 なぜこの説明文を設計したか：{filterIds(adoptionReason)}
                              </p>
                            )}
                            {hasKIdCorrection && (
                              <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                                🔧 出現しにくい理由への対応：{filterIds(kIdCorrection!)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 3: 設計レビュー ────────────────────────────── */}
      <div className="print:break-before-page">
        <SectionHeader
          num="04"
          title="出現設計レビュー"
          subtitle="出現設計で作成した説明文を実装前に確認し、到達可能性・優先対応箇所を整理"
          color="border-purple-400 bg-purple-400"
        />

        {/* Phase3→Phase4 連携メモ */}
        <div className="mb-5 bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">📎 設計レビューの位置づけ：</span>
          設計レビュー結果は、実装計画の優先判断に使用します。ページ生成には出現設計で作成したAIに読ませる説明文を使用します。レビュー結果のページ生成への自動反映はVer2対象です。
        </div>

        {!phase3Result ? <NoData phase="設計レビュー" /> : (
          <div className="space-y-5">
            {/* 設計レビューサマリー（冒頭） */}
            {phase3Result.overallSummary && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
                <div className="text-sm font-bold text-purple-800 mb-2">📋 設計レビュー 総合コメント</div>
                <p className="text-sm text-slate-700 leading-relaxed">{filterIds(phase3Result.overallSummary)}</p>
              </div>
            )}

            {/* ギャップグラフ */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-sm font-bold text-slate-700 mb-1">出現ギャップ分析</div>
                <div className="text-xs text-slate-400 mb-3">構文 × P-IDの出現有無内訳</div>
                <GapBarChart appeared={appearedCount} notAppeared={notAppearedCount} />
                <div className="flex justify-center gap-6 mt-3 text-xs text-slate-500">
                  <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />出現あり: {appearedCount}件</span>
                  <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />出現なし: {notAppearedCount}件</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-sm font-bold text-slate-700 mb-1">出現困難度 分布</div>
                <div className="text-xs text-slate-400 mb-3">構文の困難度レベル別内訳</div>
                <DifficultyBarChart data={difficultyData} />
                <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
                  {difficultyData.map((d, i) => (
                    <span key={i}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: d.fill }} />
                      {d.name}: {d.count}件
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 横型マトリクス */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-700">横型マトリクス（全体俯瞰）</div>
                <div className="text-xs text-slate-400 mt-0.5">構文単位の到達可能性・困難要因・実装指針</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50">
                      {['No.', '設計の狙い', '到達可能性', '主要困難要因', '優先度', '補強・再設計指針'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {phase3Result.matrixReport.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{row.mId ? (M_ID_NAMES[row.mId] ?? M_ID_NAMES[row.mId.match(/^(M-\d+)/)?.[1] ?? ''] ?? row.mId) : ''}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={row.reachabilityScore}
                            color={row.reachabilityScore === '高' ? 'green' : row.reachabilityScore === '中' ? 'yellow' : 'red'}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{row.mainDifficultyType}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={row.priority}
                            color={row.priority === '高' ? 'red' : row.priority === '中' ? 'yellow' : 'green'}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{filterIds(row.guideline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 実装前に確認すべき構文（詳細レビューレポート） */}
            {(() => {
              const priorityRows = phase3Result.detailReport
                .filter(r => r.reachabilityScore === '低' || r.reachabilityScore === '中')
                .sort((a, b) => {
                  const order: Record<string, number> = { '低': 0, '中': 1, '高': 2 };
                  return (order[a.reachabilityScore] ?? 3) - (order[b.reachabilityScore] ?? 3);
                })
                .slice(0, 10);
              if (priorityRows.length === 0) return null;
              return (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-700">実装前に確認すべき構文</div>
                    <div className="text-xs text-slate-400 mt-0.5">到達可能性が低い・中の説明文を優先表示（上位{priorityRows.length}件）</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {priorityRows.map((row, i) => (
                      <div key={i} className="px-5 py-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            label={`到達：${row.reachabilityScore}`}
                            color={row.reachabilityScore === '低' ? 'red' : 'yellow'}
                          />
                          <span className="text-[10px] text-slate-400">設計文案 {i + 1}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {(row.afterText ?? '').slice(0, 120)}{(row.afterText ?? '').length > 120 ? '…' : ''}
                        </p>
                        {row.difficultyDetail && (
                          <p className="text-xs text-amber-700 leading-relaxed">
                            ⚠ 課題：{filterIds(row.difficultyDetail)}
                          </p>
                        )}
                        {row.guideline && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            → 補強・再設計の指針：{filterIds(row.guideline)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 優先対応が必要な設計文案（高優先度・到達困難） */}
            {(() => {
              const highPriorityRows = phase3Result.matrixReport
                .filter(r =>
                  (r.priority === '高' || r.priority === '最高') &&
                  (r.reachabilityScore === '低' || r.reachabilityScore === '中')
                )
                .slice(0, 5);
              if (highPriorityRows.length === 0) return null;
              return (
                <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-red-100 bg-red-50/60">
                    <div className="text-sm font-bold text-red-800">🔴 優先対応が必要な設計文案</div>
                    <div className="text-xs text-red-600 mt-0.5">優先度「高」かつ到達可能性「低・中」の構文（上位{highPriorityRows.length}件）</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {highPriorityRows.map((row, i) => (
                      <div key={i} className="px-5 py-4 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-500">設計文案 {i + 1}</span>
                          <Badge
                            label={`到達：${row.reachabilityScore}`}
                            color={row.reachabilityScore === '低' ? 'red' : 'yellow'}
                          />
                          <Badge
                            label={`優先度：${row.priority}`}
                            color="red"
                          />
                        </div>
                        {row.mainDifficultyType && (
                          <p className="text-xs text-amber-700 leading-relaxed">
                            ⚠ 主な課題：{filterIds(row.mainDifficultyType)}
                          </p>
                        )}
                        {row.guideline && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            → 補強・再設計の指針：{filterIds(row.guideline)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 困難要因パターン */}
            {phase3Result.patternTable && phase3Result.patternTable.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="text-sm font-bold text-slate-700">出現困難要因パターン</div>
                  <div className="text-xs text-slate-400 mt-0.5">設計文案単位で共通する困難要因の分類と対策</div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {['困難要因タイプ', '説明', '該当数', '対応施策'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {phase3Result.patternTable.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{p.difficultyType}</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-[200px] leading-relaxed">{p.description}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-purple-700">{p.count}件</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-[220px] leading-relaxed">{filterIds(p.measures)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── SECTION 4: 実装設計 ────────────────────────────────── */}
      <div className="print:break-before-page">
        <SectionHeader
          num="05"
          title="実装設計"
          subtitle="出現率向上のための具体的施策・優先度ロードマップ"
          color="border-green-400 bg-green-400"
        />

        {!phase4Result ? <NoData phase="実装設計" /> : (
          <div className="space-y-5">
            {/* 優先度サマリー */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{highPlans.length}</div>
                <div className="text-xs text-slate-500 mt-1">優先度：高</div>
                <div className="text-xs text-red-400 mt-0.5">即時対応推奨</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{midPlans.length}</div>
                <div className="text-xs text-slate-500 mt-1">優先度：中</div>
                <div className="text-xs text-yellow-500 mt-0.5">1〜2ヶ月以内に対応</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{lowPlans.length}</div>
                <div className="text-xs text-slate-500 mt-1">優先度：低</div>
                <div className="text-xs text-green-500 mt-0.5">中長期で対応</div>
              </div>
            </div>

            {/* 実装サマリー */}
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
              <div className="text-sm font-bold text-green-800 mb-2">📋 実装サマリー・ロードマップ</div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{filterIds(phase4Result.prioritySummary ?? '')}</p>
            </div>

            {/* ロードマップカード */}
            <div className="space-y-3">
              <RoadmapCard priority="高" color="text-red-700" bg="bg-red-50" border="border-red-200"
                items={highPlans.map(r => ({ sbId: r.sbId, action: r.action, targetPage: r.targetPage }))} />
              <RoadmapCard priority="中" color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200"
                items={midPlans.map(r => ({ sbId: r.sbId, action: r.action, targetPage: r.targetPage }))} />
              <RoadmapCard priority="低" color="text-green-700" bg="bg-green-50" border="border-green-200"
                items={lowPlans.map(r => ({ sbId: r.sbId, action: r.action, targetPage: r.targetPage }))} />
            </div>

            {/* 施策テーブル */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-700">実装施策 全件テーブル</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50">
                      {['優先度', 'No.', '実装アクション', '配置先ページ', '外部接点', '期待効果'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {phase4Result.planRows.map((row, i) => (
                      <tr key={i} className={`hover:bg-slate-50 ${row.priority === '高' ? 'bg-red-50/40' : row.priority === '中' ? 'bg-yellow-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <Badge
                            label={row.priority}
                            color={row.priority === '高' ? 'red' : row.priority === '中' ? 'yellow' : 'green'}
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 max-w-[240px]">{filterIds(row.action)}</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-50 border border-green-100 rounded px-2 py-0.5 text-xs text-green-800">
                            {row.targetPage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{filterIds(row.eIdRequired)}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">{row.expectedEffect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="border-t border-slate-200 pt-6 text-center print:mt-8">
        <p className="text-xs text-slate-400">
          AI出現設計エンジン v1.0 ｜ Generated: {new Date().toLocaleString('ja-JP')}
        </p>
      </div>

      </div>{/* /aisle-report */}
    </div>
    </>
  );
}
