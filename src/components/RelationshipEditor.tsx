/**
 * Relationship Editor — S5 (M-05)
 *
 * Entity間のRelationship（parentEntity / productOf / competitorOf / alternativeTo）の
 * 新規登録・編集（description/confidence/status）・削除（DEPRECATED化）を行う。
 *
 * 対象外: memberOfCluster（primaryCluster/secondaryClustersとの二重管理を避けるため）、
 * R-01〜R-22未実装17種、Entity Workspaceへの統合（将来タスク）。
 */

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardBody } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { authoringFetch, AuthoringApiError } from '../lib/authoringApi';

// ── 型定義 ───────────────────────────────────────────────────────────────────

type RelationshipType = 'parentEntity' | 'productOf' | 'competitorOf' | 'alternativeTo';
type Confidence = 'high' | 'medium' | 'low';
type RelationshipStatus = 'ACTIVE' | 'DEPRECATED' | 'DRAFT';

interface RelationshipItem {
  relationshipId: string;
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string;
  direction: 'directed' | 'bidirectional';
  description: string;
  confidence: Confidence;
  source: string;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

interface RelationshipListResponse {
  ok: boolean;
  entity?: string;
  items?: RelationshipItem[];
  error?: string;
}

interface RelationshipMutationResponse {
  ok: boolean;
  relationship?: RelationshipItem;
  error?: string;
}

const TYPE_LABELS: Record<RelationshipType, string> = {
  parentEntity: '親子関係（parentEntity）',
  productOf: 'プロダクト所属（productOf）',
  competitorOf: '競合（competitorOf）',
  alternativeTo: '代替候補（alternativeTo）',
};

const ALL_TYPES: RelationshipType[] = ['parentEntity', 'productOf', 'competitorOf', 'alternativeTo'];

const STATUS_COLOR: Record<RelationshipStatus, 'green' | 'slate' | 'yellow'> = {
  ACTIVE: 'green',
  DEPRECATED: 'slate',
  DRAFT: 'yellow',
};

export function RelationshipEditor() {
  const [entitySlug, setEntitySlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RelationshipItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 新規登録フォーム
  const [newTarget, setNewTarget] = useState('');
  const [newType, setNewType] = useState<RelationshipType>('competitorOf');
  const [newDescription, setNewDescription] = useState('');
  const [newConfidence, setNewConfidence] = useState<Confidence>('high');
  const [creating, setCreating] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof AuthoringApiError) {
      setErrorMessage(err.isAuthError ? '認証エラー：管理者に確認してください' : err.message);
    } else {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleLoad = useCallback(async () => {
    if (!entitySlug.trim()) { setErrorMessage('Entity slug を入力してください'); return; }
    setErrorMessage(null);
    setLoading(true);
    try {
      const resp = await fetch(`/api/relationship-manager?entity=${encodeURIComponent(entitySlug.trim())}`, {
        headers: { 'x-aisle-admin': '1' },
      });
      if (resp.status === 401) throw new AuthoringApiError(401, '認証エラー');
      const json = await resp.json() as RelationshipListResponse;
      if (!json.ok) throw new Error(json.error ?? '取得に失敗しました');
      setItems(json.items ?? []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [entitySlug, handleError]);

  const handleCreate = useCallback(async () => {
    if (!entitySlug.trim() || !newTarget.trim() || !newDescription.trim()) {
      setErrorMessage('Entity / 相手Entity / description は必須です');
      return;
    }
    setErrorMessage(null);
    setCreating(true);
    try {
      const res = await authoringFetch<RelationshipMutationResponse>('/api/relationship-manager', {
        action: 'create',
        sourceEntity: entitySlug.trim(),
        targetEntity: newTarget.trim(),
        relationshipType: newType,
        description: newDescription.trim(),
        confidence: newConfidence,
      });
      if (res.relationship) {
        setItems(prev => [...prev, res.relationship as RelationshipItem]);
        setNewTarget('');
        setNewDescription('');
      }
    } catch (err) {
      handleError(err);
    } finally {
      setCreating(false);
    }
  }, [entitySlug, newTarget, newType, newDescription, newConfidence, handleError]);

  const handleUpdateStatus = useCallback(async (relationshipId: string, status: RelationshipStatus) => {
    setErrorMessage(null);
    setSavingId(relationshipId);
    try {
      const res = await authoringFetch<RelationshipMutationResponse>('/api/relationship-manager', {
        action: status === 'DEPRECATED' ? 'delete' : 'update',
        relationshipId,
        ...(status !== 'DEPRECATED' ? { status } : {}),
      });
      if (res.relationship) {
        setItems(prev => prev.map(item => item.relationshipId === relationshipId ? res.relationship as RelationshipItem : item));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSavingId(null);
    }
  }, [handleError]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Relationship Editor" subtitle="Entity間の関係（親子・プロダクト所属・競合・代替候補）を管理する" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Entity slug</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={entitySlug}
                onChange={e => setEntitySlug(e.target.value)}
                placeholder="例: chatgpt"
              />
            </div>
            <Button onClick={handleLoad} loading={loading} disabled={loading}>読み込む</Button>
          </div>
        </CardBody>
      </Card>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errorMessage}
        </div>
      )}

      {items.length > 0 && (
        <Card>
          <CardHeader title={`既存Relationship（${items.length}件）`} />
          <CardBody className="space-y-2">
            {items.map(item => {
              const counterpart = item.sourceEntity === entitySlug.trim() ? item.targetEntity : item.sourceEntity;
              const arrow = item.direction === 'bidirectional' ? '↔' : (item.sourceEntity === entitySlug.trim() ? '→' : '←');
              return (
                <div key={item.relationshipId} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge label={item.relationshipType} color="indigo" />
                      <Badge label={item.status} color={STATUS_COLOR[item.status]} />
                      <span className="text-xs text-slate-400">{item.relationshipId}</span>
                    </div>
                    <p className="text-sm text-slate-700">{arrow} {counterpart}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </div>
                  {item.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleUpdateStatus(item.relationshipId, 'DEPRECATED')}
                      loading={savingId === item.relationshipId}
                    >
                      削除（DEPRECATED化）
                    </Button>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="新規登録" subtitle={entitySlug.trim() ? `${entitySlug.trim()} を起点に登録する` : 'Entity slug を先に入力してください'} />
        <CardBody className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">相手Entity slug</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              placeholder="例: claude-ai"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">relationshipType</label>
            <div className="flex gap-2 flex-wrap">
              {ALL_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">description</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">confidence</label>
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={newConfidence}
              onChange={e => setNewConfidence(e.target.value as Confidence)}
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={creating}>登録する</Button>
        </CardBody>
      </Card>
    </div>
  );
}
