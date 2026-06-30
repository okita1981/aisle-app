/**
 * Aisle Monitor Workbench — M2
 *
 * Dashboard / Manual Contact / Appearance Monitoring / Crawl Log を
 * 1画面のタブ遷移で確認・実行できるUI。M1で実装済みの6 APIをそのまま呼び出す。
 *
 * ── 因果断定の禁止（UI表現にも徹底） ─────────────────────────────────────────
 * Contact / Crawl / Appearance は常に独立した指標として表示する。
 * 「Contact実行により出現率が向上した」のような効果断定、Crawl Logの
 * relatedContactRunsを「原因」として図示すること（矢印・causes等）は行わない。
 * 時間差（timeDeltaMinutes）を伴う co-occurrence の事実提示に留める。
 *
 * M2でやらないこと: Scheduled Contact / ChatGPT・Gemini実行 / Monitor→Studio
 * フィードバック / グラフ可視化 / リアルタイム更新 / サブルーティング。
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardBody } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { monitorGet, monitorPost, MonitorApiError } from '../lib/monitorApi';
import type {
  MonitorProviderId,
  MonitorEntitySummary,
  EntitiesResponse,
  ContactRun,
  ContactItem,
  MonitorContactPostResponse,
  MonitorContactGetResponse,
  MonitoringRun,
  MonitoringItem,
  MonitorAppearancePostResponse,
  MonitorAppearanceGetResponse,
  CrawlLogEntry,
  MonitorCrawlLogGetResponse,
  MonitorPeriod,
  EntityDashboardRow,
  DashboardResponse,
} from '../../api/_monitor-types';

type TabId = 'dashboard' | 'contact' | 'appearance' | 'crawl-log';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'contact', label: 'Manual Contact', icon: '📡' },
  { id: 'appearance', label: 'Appearance Monitoring', icon: '🔎' },
  { id: 'crawl-log', label: 'Crawl Log', icon: '🕷️' },
];

// M1時点で実稼働しているProviderはperplexityのみ。他は型としては存在するがUI上disabled表示。
const PROVIDER_OPTIONS: { id: MonitorProviderId; label: string; available: boolean }[] = [
  { id: 'perplexity', label: 'Perplexity', available: true },
  { id: 'chatgpt', label: 'ChatGPT', available: false },
  { id: 'gemini', label: 'Gemini', available: false },
];

function SimulatedBadge({ simulated }: { simulated: boolean }) {
  return simulated
    ? <Badge label="🧪 Simulated" color="yellow" />
    : <Badge label="Real" color="green" />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ja-JP', { hour12: false });
}

export function MonitorWorkbench() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [entities, setEntities] = useState<MonitorEntitySummary[]>([]);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);

  // Entity一覧はタブ共通で使うため最初に一度だけ取得する
  useEffect(() => {
    monitorGet<EntitiesResponse>('/api/monitor-entities')
      .then(res => setEntities(res.entities ?? []))
      .catch(err => setEntitiesError(err instanceof MonitorApiError ? err.message : 'Entity一覧の取得に失敗しました'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Aisle Monitor</h1>
        <p className="text-slate-500 text-sm mt-1">
          AI出現の観測。Contact・Crawl・Appearanceは独立した指標として表示します（因果断定はしません）。
        </p>
      </div>

      {entitiesError && <ErrorBanner message={entitiesError} />}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'contact' && <ContactTab entities={entities} />}
      {activeTab === 'appearance' && <AppearanceTab entities={entities} />}
      {activeTab === 'crawl-log' && <CrawlLogTab entities={entities} />}
    </div>
  );
}

// ── Dashboard タブ ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [period, setPeriod] = useState<MonitorPeriod>('all');
  const [rows, setRows] = useState<EntityDashboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: MonitorPeriod) => {
    setLoading(true);
    setError(null);
    monitorGet<DashboardResponse>(`/api/monitor-dashboard?period=${p}`)
      .then(res => setRows(res.summary ?? []))
      .catch(err => setError(err instanceof MonitorApiError ? err.message : '集計の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  return (
    <Card>
      <CardHeader
        title="Entity別 集計"
        subtitle="Contact / Crawl / Appearance はそれぞれ独立に集計しています（合成スコアではありません）"
        action={
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as MonitorPeriod)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="7d">過去7日</option>
            <option value="30d">過去30日</option>
            <option value="all">全期間</option>
          </select>
        }
      />
      <CardBody>
        {error && <ErrorBanner message={error} />}
        {loading && <p className="text-slate-400 text-sm">読み込み中...</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-slate-400 text-sm">この期間のデータはありません。</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Crawl</th>
                  <th className="py-2 pr-4">Appearance</th>
                  <th className="py-2 pr-4">Appearance率</th>
                  <th className="py-2 pr-4">Citation</th>
                  <th className="py-2 pr-4">最終Contact</th>
                  <th className="py-2 pr-4">最終Crawl</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.entityId} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-700">{row.entityId}</td>
                    <td className="py-2 pr-4">{row.contactCount}</td>
                    <td className="py-2 pr-4">{row.crawlCount}</td>
                    <td className="py-2 pr-4">{row.appearanceCount}</td>
                    <td className="py-2 pr-4">{(row.appearanceRate * 100).toFixed(0)}%</td>
                    <td className="py-2 pr-4">{row.citationCount}</td>
                    <td className="py-2 pr-4 text-slate-400">{formatDate(row.lastContactedAt)}</td>
                    <td className="py-2 pr-4 text-slate-400">{formatDate(row.lastCrawledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Entity / Reference / Provider 選択（Contact・Appearance共通） ─────────────

function EntitySelect({
  entities, value, onChange,
}: { entities: MonitorEntitySummary[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
    >
      <option value="">Entityを選択...</option>
      {entities.map(e => (
        <option key={e.id} value={e.id}>{e.name}（{e.entityType ?? e.category}）</option>
      ))}
    </select>
  );
}

function ProviderSelect({
  value, onChange,
}: { value: MonitorProviderId; onChange: (v: MonitorProviderId) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as MonitorProviderId)}
      className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
    >
      {PROVIDER_OPTIONS.map(p => (
        <option key={p.id} value={p.id} disabled={!p.available}>
          {p.label}{!p.available ? '（未対応）' : ''}
        </option>
      ))}
    </select>
  );
}

// ── Manual Contact タブ ───────────────────────────────────────────────────────

function ContactTab({ entities }: { entities: MonitorEntitySummary[] }) {
  const [entityId, setEntityId] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [provider, setProvider] = useState<MonitorProviderId>('perplexity');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ContactRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastResult, setLastResult] = useState<ContactItem[] | null>(null);

  const selectedEntity = entities.find(e => e.id === entityId);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    monitorGet<MonitorContactGetResponse>('/api/monitor-contact?limit=20')
      .then(res => setRuns(res.runs ?? []))
      .catch(() => { /* 履歴取得失敗は実行操作をブロックしない */ })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRun = async () => {
    if (!entityId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await monitorPost<MonitorContactPostResponse>('/api/monitor-contact', {
        entityId,
        referenceId: referenceId || undefined,
        providers: [provider],
      });
      setLastResult(res.items ?? null);
      loadHistory();
    } catch (err) {
      setError(err instanceof MonitorApiError ? err.message : 'Contact実行に失敗しました');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Manual AI Contact 実行" subtitle="RefBase URLへの到達性チェックを実行します（M1時点は全件 simulated）" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EntitySelect entities={entities} value={entityId} onChange={v => { setEntityId(v); setReferenceId(''); }} />
            <select
              value={referenceId}
              onChange={e => setReferenceId(e.target.value)}
              disabled={!selectedEntity}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Reference未指定（Entityハブ）</option>
              {selectedEntity?.references.map(r => (
                <option key={r.questionSlug} value={r.questionSlug}>{r.promptTypeId} — {r.questionSlug}</option>
              ))}
            </select>
            <ProviderSelect value={provider} onChange={setProvider} />
          </div>
          {error && <ErrorBanner message={error} />}
          <Button onClick={handleRun} disabled={!entityId} loading={running}>
            Contact実行
          </Button>
          {lastResult && (
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">直近の実行結果</div>
              {lastResult.map(item => (
                <div key={item.itemId} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">{item.provider}</span>
                  <Badge label={item.success ? '成功' : '失敗'} color={item.success ? 'green' : 'red'} />
                  <SimulatedBadge simulated={item.simulated} />
                  {item.httpStatus && <span className="text-slate-400 text-xs">HTTP {item.httpStatus}</span>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="実行履歴" action={<Button variant="ghost" size="sm" onClick={loadHistory}>再取得</Button>} />
        <CardBody>
          {loadingHistory && <p className="text-slate-400 text-sm">読み込み中...</p>}
          {!loadingHistory && runs.length === 0 && <p className="text-slate-400 text-sm">実行履歴はありません。</p>}
          {!loadingHistory && runs.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {runs.map(run => (
                <li key={run.runId} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-700">{run.targetEntityIds.join(', ')}</span>
                    <span className="text-slate-400 ml-2">{run.providers.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{formatDate(run.startedAt)}</span>
                    <Badge
                      label={run.status === 'completed' ? '完了' : run.status === 'partial_failure' ? '一部失敗' : run.status === 'failed' ? '失敗' : '実行中'}
                      color={run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'yellow'}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Appearance Monitoring タブ ─────────────────────────────────────────────────

function AppearanceTab({ entities }: { entities: MonitorEntitySummary[] }) {
  const [entityId, setEntityId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [provider, setProvider] = useState<MonitorProviderId>('perplexity');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<MonitoringRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastResult, setLastResult] = useState<MonitoringItem[] | null>(null);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    monitorGet<MonitorAppearanceGetResponse>('/api/monitor-appearance?limit=20')
      .then(res => setRuns(res.runs ?? []))
      .catch(() => { /* 履歴取得失敗は実行操作をブロックしない */ })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRun = async () => {
    if (!entityId || !questionText.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await monitorPost<MonitorAppearancePostResponse>('/api/monitor-appearance', {
        entityId,
        questionText: questionText.trim(),
        providers: [provider],
      });
      setLastResult(res.items ?? null);
      loadHistory();
    } catch (err) {
      setError(err instanceof MonitorApiError ? err.message : 'Appearance Monitoring実行に失敗しました');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Appearance Monitoring 実行"
          subtitle="質問文をAIに送り、Entity名・URLが応答に含まれるかを文字列包含で確認します（意味評価は行いません）"
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntitySelect entities={entities} value={entityId} onChange={setEntityId} />
            <ProviderSelect value={provider} onChange={setProvider} />
          </div>
          <textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="例：生成AIの検索結果に自社サービスを出現させたい。どこに相談すればいいですか？"
            rows={2}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
          />
          {error && <ErrorBanner message={error} />}
          <Button onClick={handleRun} disabled={!entityId || !questionText.trim()} loading={running}>
            Appearance Monitoring実行
          </Button>
          {lastResult && (
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">直近の実行結果</div>
              {lastResult.map(item => (
                <div key={item.itemId} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">{item.provider}</span>
                  <Badge label={item.appeared ? '出現あり' : '出現なし'} color={item.appeared ? 'green' : 'slate'} />
                  <Badge label={item.citationFound ? 'Citationあり' : 'Citationなし'} color={item.citationFound ? 'blue' : 'slate'} />
                  <SimulatedBadge simulated={item.simulated} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="実行履歴" action={<Button variant="ghost" size="sm" onClick={loadHistory}>再取得</Button>} />
        <CardBody>
          {loadingHistory && <p className="text-slate-400 text-sm">読み込み中...</p>}
          {!loadingHistory && runs.length === 0 && <p className="text-slate-400 text-sm">実行履歴はありません。</p>}
          {!loadingHistory && runs.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {runs.map(run => (
                <li key={run.runId} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-700">{run.targetEntityIds.join(', ')}</span>
                    <span className="text-slate-400 ml-2">{run.providers.join(', ')}</span>
                  </div>
                  <span className="text-slate-400">{formatDate(run.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Crawl Log タブ ────────────────────────────────────────────────────────────

function CrawlLogTab({ entities }: { entities: MonitorEntitySummary[] }) {
  const [entityFilter, setEntityFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [entries, setEntries] = useState<CrawlLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (entityFilter) params.set('entityId', entityFilter);
    if (providerFilter) params.set('provider', providerFilter);
    monitorGet<MonitorCrawlLogGetResponse>(`/api/monitor-crawl-log?${params.toString()}`)
      .then(res => setEntries(res.entries ?? []))
      .catch(err => setError(err instanceof MonitorApiError ? err.message : 'Crawl Logの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [entityFilter, providerFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader
        title="Crawl Log"
        subtitle="AI Botの巡回記録。「関連Contact」は同時期に実行されたContactの参考情報であり、因果関係を示すものではありません"
        action={
          <div className="flex gap-2">
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">全Entity</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">全Provider</option>
              {PROVIDER_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        }
      />
      <CardBody>
        {error && <ErrorBanner message={error} />}
        {loading && <p className="text-slate-400 text-sm">読み込み中...</p>}
        {!loading && entries.length === 0 && <p className="text-slate-400 text-sm">Crawl Logはありません。</p>}
        {!loading && entries.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {entries.map(entry => (
              <li key={entry.logId} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{entry.entityId ?? '（Entity不明）'}</span>
                    {entry.inferredProvider && <Badge label={entry.inferredProvider} color="indigo" />}
                  </div>
                  <span className="text-slate-400">{formatDate(entry.detectedAt)}</span>
                </div>
                <div className="text-slate-400 text-xs mt-0.5">{entry.botUserAgent}</div>
                {entry.relatedContactRuns && entry.relatedContactRuns.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    参考：同時期に実行されたContact —{' '}
                    {entry.relatedContactRuns.map(r => `${r.runId.slice(0, 12)}...（${r.timeDeltaMinutes}分差）`).join(' / ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
