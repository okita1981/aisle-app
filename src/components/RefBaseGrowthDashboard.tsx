import { useEffect, useState } from 'react';

interface GrowthMetrics {
  ok: boolean;
  generatedAt: string;
  summary: {
    entityCount: number;
    referenceCount: number;
    evidenceCount: number;
    clusterCount: number;
    clusterCountNote: string;
    relationshipCount: number | null;
    relationshipCountNote: string;
    parentEntitySetCount: number;
    verifiedRate: number | null;
    draftRate: number | null;
  };
  verificationStatus: Record<string, number>;
  coverage: {
    byEntityType: Record<string, number>;
    byCluster: Record<string, number>;
    byPromptTypeId: Record<string, number>;
  };
  backlog: {
    draftEntities: { slug: string; entityType?: string; primaryCluster?: string }[];
    unverifiedEvidence: { slug: string; evidenceId?: string; needsVerification?: boolean; sourceVerified?: boolean }[];
    credibilityGapEntities: string[];
  };
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function CountTable({ title, counts, note }: { title: string; counts: Record<string, number>; note?: string }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h3>
      {note && <p className="text-xs text-amber-600 mb-3">{note}</p>}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {entries.map(([key, count]) => (
            <tr key={key}>
              <td className="py-1.5 text-slate-600">{key}</td>
              <td className="py-1.5 text-right font-mono font-semibold text-slate-800">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RefBaseGrowthDashboard() {
  const [data, setData] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'RefBase Growth Dashboard (Internal)';
    setLoading(true);
    fetch('/api/refbase-growth-metrics', { headers: { 'x-aisle-admin': '1' } })
      .then(r => r.json())
      .then((j: GrowthMetrics) => {
        if (!j.ok) { setError('取得に失敗しました'); return; }
        setData(j);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <meta name="robots" content="noindex, nofollow" />
      <div>
        <h1 className="text-lg font-bold text-slate-800 mb-1">RefBase Growth Dashboard</h1>
        <p className="text-sm text-slate-500">内部運用専用（Read Only）。RefBase本番KVから集計。</p>
        {data && <p className="text-xs text-slate-400 mt-1">取得時刻: {data.generatedAt}</p>}
      </div>

      {loading && <p className="text-sm text-slate-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && (
        <>
          {/* 1. Summary Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <SummaryCard label="Entities" value={data.summary.entityCount} />
            <SummaryCard label="References" value={data.summary.referenceCount} />
            <SummaryCard label="Evidence" value={data.summary.evidenceCount} />
            <SummaryCard
              label="Relationships"
              value={data.summary.relationshipCount ?? '未実装'}
              sub={`参考: parentEntity設定済み ${data.summary.parentEntitySetCount}件`}
            />
            <SummaryCard label="Verified率" value={data.summary.verifiedRate !== null ? `${data.summary.verifiedRate}%` : '—'} />
            <SummaryCard label="Draft率" value={data.summary.draftRate !== null ? `${data.summary.draftRate}%` : '—'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard label="Cluster数（近似）" value={data.summary.clusterCount} sub={data.summary.clusterCountNote} />
            <SummaryCard label="Relationship数" value="未実装" sub={data.summary.relationshipCountNote} />
          </div>

          {/* 2. Verification Status */}
          <CountTable
            title="Verification Status"
            counts={data.verificationStatus}
            note="unset = verificationStatusフィールド未設定（Growth Sprintで追加した既存Entity）"
          />

          {/* 3. Coverage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CountTable title="P-ID別 Reference数" counts={data.coverage.byPromptTypeId} />
            <CountTable title="EntityType別件数" counts={data.coverage.byEntityType} />
            <CountTable title="Cluster別 Entity数" counts={data.coverage.byCluster} />
          </div>

          {/* 4. Backlog */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700">Backlog</h2>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                verificationStatus = draft のEntity（{data.backlog.draftEntities.length}件）
              </h3>
              <ul className="text-sm space-y-1">
                {data.backlog.draftEntities.map(e => (
                  <li key={e.slug} className="flex gap-3 text-slate-600">
                    <span className="font-mono">{e.slug}</span>
                    <span className="text-slate-400">{e.entityType} / {e.primaryCluster}</span>
                  </li>
                ))}
                {data.backlog.draftEntities.length === 0 && <li className="text-slate-400">該当なし</li>}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                未検証Evidence（sourceVerified=false または needsVerification=true）（{data.backlog.unverifiedEvidence.length}件）
              </h3>
              <ul className="text-sm space-y-1 max-h-64 overflow-auto">
                {data.backlog.unverifiedEvidence.map((e, i) => (
                  <li key={i} className="flex gap-3 text-slate-600">
                    <span className="font-mono">{e.slug}</span>
                    <span className="font-mono text-slate-400">{e.evidenceId}</span>
                    <span className="text-xs text-amber-600">
                      needsVerification={String(e.needsVerification)} / sourceVerified={String(e.sourceVerified)}
                    </span>
                  </li>
                ))}
                {data.backlog.unverifiedEvidence.length === 0 && <li className="text-slate-400">該当なし</li>}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Credibility Evidence不足Entity（{data.backlog.credibilityGapEntities.length}件）
              </h3>
              <ul className="text-sm space-y-1">
                {data.backlog.credibilityGapEntities.map(slug => (
                  <li key={slug} className="font-mono text-slate-600">{slug}</li>
                ))}
                {data.backlog.credibilityGapEntities.length === 0 && <li className="text-slate-400">該当なし</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
