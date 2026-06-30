/**
 * Authoring Workbench — S4
 *
 * Generate → Validate → Publish を1画面のタブ遷移で行う。
 * 既存Phase4Implementation.tsx（page-generate.ts 一括投入フロー）とは独立。
 *
 * S4スコープ:
 *   既存Entityに対して qi-resolve → draft-generate → draft-validate → draft-publish を
 *   UIから実行できること。Entity新規作成・Evidence投入・Relationship編集は対象外。
 */

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardBody } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { authoringFetch, AuthoringApiError } from '../lib/authoringApi';
import type {
  AuthoringQuestionInstance,
  CoverageGateSkipped,
  Draft,
  ValidatedDraft,
  AuthoringReference,
  CoverageType,
  ResponseSchema,
  QIResolveResponse,
  DraftGenerateResponse,
  DraftValidateResponse,
  DraftPublishResponse,
} from '../types/authoring';

// ── P-ID別 定数（QuestionTemplate / responseSchema Registry 登録値と同一） ──
// 読み取り専用APIが未整備のため、登録済みKV内容をフロントにも複製する
// （page-generate.ts の PID_REQUIRED_TYPES 等と同じ duplication 方針）。

const ALL_PROMPT_TYPE_IDS = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'];

const PID_LABELS: Record<string, string> = {
  'P-01': '選定', 'P-02': '比較', 'P-03': 'ランキング',
  'P-04': '課題解決', 'P-05': '出典引用', 'P-06': '推薦理由',
};

const REQUIRED_COVERAGE_MAP: Record<string, CoverageType[]> = {
  'P-01': ['Capability'],
  'P-02': ['Capability', 'Differentiation'],
  'P-03': ['Credibility'],
  'P-04': ['Capability'],
  'P-05': ['Credibility'],
  'P-06': ['Capability', 'Differentiation'],
};

const RESPONSE_SCHEMA_MAP: Record<string, ResponseSchema> = {
  'P-01': { promptTypeId: 'P-01', citationRequired: false, sections: [
    { sectionId: 'summary', label: '概要', required: true },
    { sectionId: 'capabilities', label: '主な特徴・強み', required: true },
    { sectionId: 'usecases', label: '活用シーン', required: false },
  ] },
  'P-02': { promptTypeId: 'P-02', citationRequired: false, sections: [
    { sectionId: 'differentiators', label: '主な違い・優位性', required: true },
    { sectionId: 'comparison', label: '競合との対比', required: true },
    { sectionId: 'bestFor', label: '向いているケース', required: false },
  ] },
  'P-03': { promptTypeId: 'P-03', citationRequired: true, sections: [
    { sectionId: 'positioning', label: '位置づけ・注目度', required: true },
    { sectionId: 'rationale', label: '注目される理由', required: true },
    { sectionId: 'context', label: 'Cluster内の文脈', required: false },
  ] },
  'P-04': { promptTypeId: 'P-04', citationRequired: false, sections: [
    { sectionId: 'problem', label: '解決できる課題', required: true },
    { sectionId: 'solution', label: '解決の仕組み', required: true },
    { sectionId: 'usecase', label: '具体的な活用例', required: true },
  ] },
  'P-05': { promptTypeId: 'P-05', citationRequired: true, sections: [
    { sectionId: 'primarySource', label: '主要な情報源', required: true },
    { sectionId: 'supporting', label: '補足の根拠', required: false },
    { sectionId: 'reliability', label: '信頼性の評価', required: true },
  ] },
  'P-06': { promptTypeId: 'P-06', citationRequired: true, sections: [
    { sectionId: 'recommendation', label: '選ぶ理由・強み', required: true },
    { sectionId: 'evidence', label: '強みの根拠', required: true },
    { sectionId: 'context', label: '向いている用途', required: false },
  ] },
};

type TabId = 'generate' | 'validate' | 'publish';

function statusBadge(state: 'draft' | 'validated-ok' | 'validated-ng' | 'published') {
  switch (state) {
    case 'draft': return <Badge label="未検証" color="slate" />;
    case 'validated-ok': return <Badge label="検証OK" color="green" />;
    case 'validated-ng': return <Badge label="検証NG" color="red" />;
    case 'published': return <Badge label="公開済み" color="blue" />;
  }
}

export function AuthoringWorkbench() {
  const [activeTab, setActiveTab] = useState<TabId>('generate');

  const [clientSlug, setClientSlug] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [productCategory, setProductCategory] = useState('');

  const [resolving, setResolving] = useState(false);
  const [instances, setInstances] = useState<AuthoringQuestionInstance[]>([]);
  const [skipped, setSkipped] = useState<CoverageGateSkipped[]>([]);

  const [draftsByInstance, setDraftsByInstance] = useState<Record<string, Draft[]>>({});
  const [generatingInstanceId, setGeneratingInstanceId] = useState<string | null>(null);

  const [validatedByDraftId, setValidatedByDraftId] = useState<Record<string, ValidatedDraft>>({});
  const [validatingDraftId, setValidatingDraftId] = useState<string | null>(null);

  const [adoptedDraftId, setAdoptedDraftId] = useState<Record<string, string>>({});
  const [publishedByInstance, setPublishedByInstance] = useState<Record<string, AuthoringReference>>({});
  const [publishingInstanceId, setPublishingInstanceId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof AuthoringApiError) {
      setErrorMessage(err.isAuthError ? '認証エラー：管理者に確認してください' : err.message);
    } else {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // ── Generate: qi-resolve ────────────────────────────────────────────────
  const handleResolve = useCallback(async () => {
    if (!clientSlug.trim()) { setErrorMessage('clientSlug を入力してください'); return; }
    setErrorMessage(null);
    setResolving(true);
    try {
      const res = await authoringFetch<QIResolveResponse>('/api/qi-resolve', {
        clientSlug: clientSlug.trim(),
        companyName: companyName.trim() || undefined,
        perPID: ALL_PROMPT_TYPE_IDS.map(pid => ({ promptTypeId: pid, promptText: '' })),
        targetPromptTypeIds: ALL_PROMPT_TYPE_IDS,
      });
      setInstances(res.instances ?? []);
      setSkipped(res.coverageGate?.skipped ?? []);
    } catch (err) {
      handleError(err);
    } finally {
      setResolving(false);
    }
  }, [clientSlug, companyName, handleError]);

  // ── Generate: draft-generate ─────────────────────────────────────────────
  const handleGenerateDraft = useCallback(async (instance: AuthoringQuestionInstance) => {
    setErrorMessage(null);
    setGeneratingInstanceId(instance.instanceId);
    try {
      const existing = draftsByInstance[instance.instanceId] ?? [];
      const res = await authoringFetch<DraftGenerateResponse>('/api/draft-generate', {
        instanceId: instance.instanceId,
        clientSlug: clientSlug.trim(),
        companyName: companyName.trim(),
        productCategory: productCategory.trim(),
        promptTypeId: instance.promptTypeId,
        promptText: instance.resolvedText,
        attemptNumber: existing.length + 1,
      });
      if (res.draft) {
        setDraftsByInstance(prev => ({
          ...prev,
          [instance.instanceId]: [...(prev[instance.instanceId] ?? []), res.draft as Draft],
        }));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setGeneratingInstanceId(null);
    }
  }, [clientSlug, companyName, productCategory, draftsByInstance, handleError]);

  // ── Validate: draft-validate ──────────────────────────────────────────────
  const handleValidate = useCallback(async (draft: Draft) => {
    setErrorMessage(null);
    setValidatingDraftId(draft.draftId);
    try {
      const schema = RESPONSE_SCHEMA_MAP[draft.promptTypeId];
      const requiredCoverage = REQUIRED_COVERAGE_MAP[draft.promptTypeId] ?? [];
      const res = await authoringFetch<DraftValidateResponse>('/api/draft-validate', {
        draft,
        responseSchema: schema,
        requiredCoverage,
      });
      if (res.validatedDraft) {
        setValidatedByDraftId(prev => ({ ...prev, [draft.draftId]: res.validatedDraft as ValidatedDraft }));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setValidatingDraftId(null);
    }
  }, [handleError]);

  const handleAdopt = useCallback((instanceId: string, draftId: string) => {
    setAdoptedDraftId(prev => ({ ...prev, [instanceId]: draftId }));
  }, []);

  // ── Publish: draft-publish ────────────────────────────────────────────────
  const handlePublish = useCallback(async (instanceId: string) => {
    const draftId = adoptedDraftId[instanceId];
    const draft = (draftsByInstance[instanceId] ?? []).find(d => d.draftId === draftId);
    const validatedDraft = draftId ? validatedByDraftId[draftId] : undefined;
    if (!draft || !validatedDraft) return;

    setErrorMessage(null);
    setPublishingInstanceId(instanceId);
    try {
      const res = await authoringFetch<DraftPublishResponse>('/api/draft-publish', {
        draft,
        validatedDraft,
        companyName: companyName.trim(),
        productCategory: productCategory.trim(),
      });
      if (res.reference) {
        setPublishedByInstance(prev => ({ ...prev, [instanceId]: res.reference as AuthoringReference }));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setPublishingInstanceId(null);
    }
  }, [adoptedDraftId, draftsByInstance, validatedByDraftId, companyName, productCategory, handleError]);

  const allDrafts = Object.values(draftsByInstance).flat();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Authoring Workbench" subtitle="既存Entityに対して Generate → Validate → Publish を実行する" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">clientSlug（既存Entity）</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={clientSlug}
                onChange={e => setClientSlug(e.target.value)}
                placeholder="例: chatgpt"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">companyName</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">productCategory</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={productCategory}
                onChange={e => setProductCategory(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <Button onClick={handleResolve} loading={resolving} disabled={resolving}>
              Question を解決する（qi-resolve）
            </Button>
          </div>
          {skipped.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              LOCKED（Coverage不足）: {skipped.map(s => `${s.promptTypeId}(${s.missingTypes.join(',')})`).join(' / ')}
            </div>
          )}
        </CardBody>
      </Card>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {([
          ['generate', `Generate（${instances.length}）`],
          ['validate', `Validate（${allDrafts.length}）`],
          ['publish', `Publish（${Object.keys(adoptedDraftId).length}）`],
        ] as [TabId, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && (
        <div className="space-y-3">
          {instances.length === 0 && (
            <div className="text-center text-slate-400 py-8">qi-resolve を実行すると UNLOCKED な Question が表示されます</div>
          )}
          {instances.map(instance => {
            const drafts = draftsByInstance[instance.instanceId] ?? [];
            return (
              <Card key={instance.instanceId}>
                <CardHeader
                  title={`${PID_LABELS[instance.promptTypeId] ?? instance.promptTypeId}（${instance.promptTypeId}）`}
                  subtitle={instance.resolvedText}
                  action={
                    <Button
                      size="sm"
                      onClick={() => handleGenerateDraft(instance)}
                      loading={generatingInstanceId === instance.instanceId}
                      disabled={generatingInstanceId !== null && publishedByInstance[instance.instanceId] !== undefined}
                    >
                      {drafts.length === 0 ? 'Draft生成' : '再生成'}
                    </Button>
                  }
                />
                {drafts.length > 0 && (
                  <CardBody className="space-y-2">
                    {drafts.map(draft => {
                      const vd = validatedByDraftId[draft.draftId];
                      const isAdopted = adoptedDraftId[instance.instanceId] === draft.draftId;
                      const isPublished = !!publishedByInstance[instance.instanceId];
                      const state = isPublished && isAdopted
                        ? 'published'
                        : vd ? (vd.ok ? 'validated-ok' : 'validated-ng') : 'draft';
                      return (
                        <div key={draft.draftId} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {statusBadge(state)}
                            <span className="text-xs text-slate-400">attempt #{draft.generator.attemptNumber}</span>
                            {isAdopted && <Badge label="採用中" color="indigo" />}
                          </div>
                          <p className="text-sm text-slate-700">{draft.narrative.answer}</p>
                        </div>
                      );
                    })}
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'validate' && (
        <div className="space-y-3">
          {allDrafts.length === 0 && (
            <div className="text-center text-slate-400 py-8">Generateタブで Draft を生成してください</div>
          )}
          {Object.entries(draftsByInstance).map(([instanceId, drafts]) => (
            <div key={instanceId} className="space-y-2">
              {drafts.map(draft => {
                const vd = validatedByDraftId[draft.draftId];
                const isAdopted = adoptedDraftId[instanceId] === draft.draftId;
                return (
                  <Card key={draft.draftId}>
                    <CardHeader
                      title={`${draft.promptTypeId} / attempt #${draft.generator.attemptNumber}`}
                      subtitle={draft.promptText}
                      action={
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleValidate(draft)} loading={validatingDraftId === draft.draftId}>
                            検証する
                          </Button>
                          {vd?.ok && (
                            <Button size="sm" variant={isAdopted ? 'primary' : 'secondary'} onClick={() => handleAdopt(instanceId, draft.draftId)}>
                              {isAdopted ? '採用中' : 'この Draft を採用'}
                            </Button>
                          )}
                        </div>
                      }
                    />
                    {vd && (
                      <CardBody>
                        <div className="flex gap-2 mb-2">
                          <Badge label={`schema: ${vd.schemaCheck.ok ? 'OK' : 'NG'}`} color={vd.schemaCheck.ok ? 'green' : 'red'} />
                          <Badge label={`citation: ${vd.citationCheck.ok ? 'OK' : 'NG'}`} color={vd.citationCheck.ok ? 'green' : 'red'} />
                          <Badge label={`coverage: ${vd.coverageCheck.ok ? 'OK' : 'NG'}`} color={vd.coverageCheck.ok ? 'green' : 'red'} />
                        </div>
                        {vd.issues.length > 0 && (
                          <ul className="text-xs space-y-1">
                            {vd.issues.map((issue, i) => (
                              <li key={i} className={issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                                [{issue.severity}] {issue.field}: {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardBody>
                    )}
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'publish' && (
        <div className="space-y-3">
          {Object.keys(adoptedDraftId).length === 0 && (
            <div className="text-center text-slate-400 py-8">Validateタブで検証OKのDraftを採用してください</div>
          )}
          {Object.entries(adoptedDraftId).map(([instanceId, draftId]) => {
            const draft = (draftsByInstance[instanceId] ?? []).find(d => d.draftId === draftId);
            const vd = validatedByDraftId[draftId];
            const published = publishedByInstance[instanceId];
            if (!draft) return null;
            return (
              <Card key={instanceId}>
                <CardHeader
                  title={`${draft.promptTypeId}：${draft.promptText}`}
                  subtitle={published ? published.pageUrl : '未公開'}
                  action={
                    published ? (
                      <Badge label="公開済み" color="blue" />
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(instanceId)}
                        loading={publishingInstanceId === instanceId}
                        disabled={!vd?.ok}
                      >
                        承認して公開
                      </Button>
                    )
                  }
                />
                {published && (
                  <CardBody>
                    <a href={published.pageUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm underline">
                      {published.pageUrl}
                    </a>
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
