/**
 * Question Resolver — L2 相当（Sprint 3）
 *
 * 責務: Template のスロット（{entityName} / {clusterLabel} 等）を
 *       Entity・Cluster・Relationship の情報で解決し、QuestionInstance を生成する。
 *
 * 純粋関数のみ。KV アクセス・AI 呼び出し・状態変更はゼロ。
 *
 * フロー確定:
 *   Question Resolution（本モジュール）
 *   ↓
 *   Coverage Check（L3 coverageEngine.ts）
 *   ↓
 *   Reference Generator（L5 / Sprint 4 以降）
 *
 * ── 配線状況（PL-008・2026-06-30確認） ──────────────────────────────────────
 * このファイルは現在どこからも import されていない。
 * tsconfig.api.json が src/ を含まないため、api/page-generate.ts /
 * api/qi-resolve.ts は同じロジック（resolveQITemplateText 等）をそれぞれ
 * インライン複製して使っている（本ファイルが複製元の正本）。
 *
 * 残している理由：将来 src/ 側（フロントエンド）で QuestionInstance 解決を
 * 直接行う機能（例: Entity Workspace での resolvedText プレビュー）を作る際、
 * このまま import して使える状態にしておくため。API 側のインライン実装
 * （特に CLUSTER_LABEL_MAP）を変更した場合はこのファイルにも反映すること。
 */

import type { QuestionTemplate, QuestionInstance } from '../types/index';

// ── Entity / Cluster の最小型定義 ──────────────────────────────────────────
// src/types/index.ts の RefBaseCompany をそのまま使えるが、
// Resolver が依存するフィールドだけを宣言し、依存を最小化する。

export interface EntityForResolver {
  /** KV slug — 主キー */
  id: string;
  /** 標準参照名（一般的に呼ばれる名前）。スロット解決の最優先ソース。 */
  canonicalName: string;
  /** UI 表示名（canonicalName が空の場合のフォールバック） */
  displayName?: string;
  /** 正式名称 */
  officialName?: string;
  /** 主 Cluster スラグ（例: "ai-assistant"） */
  primaryCluster?: string;
  /** 副 Cluster スラグ一覧 */
  secondaryClusters?: string[];
  /** 親 Entity スラグ（product 型なら親 company を持つ場合がある） */
  parentEntity?: string | null;
  /** entityType */
  entityType?: 'company' | 'product' | 'person' | string;
}

/**
 * Cluster の最小型。
 * Sprint ④（Cluster KV 実装）までは ClusterSlugMap から生成したオブジェクトを渡す。
 */
export interface ClusterForResolver {
  clusterSlug: string;
  /** Cluster の表示名（例: "AI Assistant"） */
  name: string;
  /** 日本語ラベル（任意） */
  nameJa?: string;
}

/**
 * Relationship の最小型（Sprint 3 では未使用だが、将来の {competitor} 等に備えて定義）。
 * Relationship KV が実装される Sprint ④ 以降に埋める。
 */
export interface RelationshipForResolver {
  entityId: string;
  /** R-10: competitorOf — 競合 Entity の slug 一覧 */
  competitorOf?: string[];
  /** R-11: alternativeTo — 代替 Entity の slug 一覧 */
  alternativeTo?: string[];
  /** R-04: primaryCluster（R-06: clusterOf の逆引き用） */
  clusterOf?: string;
}

// ── Resolver 出力型 ────────────────────────────────────────────────────────

/** 1スロットの解決結果 */
export interface ResolvedSlot {
  /** テンプレート内のスロット名（例: "entityName"） */
  slot: string;
  /** 解決された値（例: "ChatGPT"） */
  value: string;
  /** 解決に使用したデータソース */
  source: 'entity' | 'cluster' | 'relationship' | 'fallback';
}

/** Template 1件 × Entity 1件に対する解決結果 */
export interface QuestionResolutionResult {
  instance: QuestionInstance;
  resolvedSlots: ResolvedSlot[];
  /** 解決できなかったスロット（将来の {competitor} 等が未登録の場合） */
  unresolvedSlots: string[];
}

/** Entity 単位の解決結果（全 Template 分） */
export interface EntityResolutionReport {
  entityId: string;
  entityName: string;
  clusterLabel: string;
  results: QuestionResolutionResult[];
}

// ── Cluster スラグ → ラベル マッピング ────────────────────────────────────
// Sprint ④ で refbase:cluster:{slug} が実装されるまでの代替。
// ここに定義することで、Cluster KV がなくても {clusterLabel} を解決できる。

export const CLUSTER_LABEL_MAP: Record<string, { name: string; nameJa: string }> = {
  'ai-assistant':      { name: 'AI Assistant',            nameJa: 'AIアシスタント' },
  'ai-coding':         { name: 'AI Coding',               nameJa: 'AIコーディング' },
  'ai-company':        { name: 'AI Company & Research',   nameJa: 'AI企業・研究機関' },
  'ai-leaders':        { name: 'AI Leaders',              nameJa: 'AIリーダー' },
  'creative-design':   { name: 'Creative & Design',       nameJa: 'クリエイティブ・デザイン' },
  'marketing-crm':     { name: 'Marketing & CRM',         nameJa: 'マーケティング・CRM' },
  'entertainment-media': { name: 'Entertainment & Media', nameJa: 'エンタメ・メディア' },
  'sports-people':     { name: 'Sports & People',         nameJa: 'スポーツ・人物' },
  'e-commerce':        { name: 'E-Commerce',              nameJa: 'Eコマース' },
  'platform-business': { name: 'Platform Business',       nameJa: 'プラットフォームビジネス' },
  'ai-emergence':      { name: 'AI Emergence Design',     nameJa: 'AI出現設計' },
  'ai-image-generation': { name: 'AI Image Generation',  nameJa: 'AI画像生成' },
};

/**
 * Cluster スラグから表示ラベルを取得する。
 * マップにない場合は kebab-case → Title Case に変換して返す（フォールバック）。
 */
export function resolveClusterLabel(clusterSlug: string, locale: 'ja' | 'en' = 'ja'): string {
  const entry = CLUSTER_LABEL_MAP[clusterSlug];
  if (entry) return locale === 'ja' ? entry.nameJa : entry.name;
  // フォールバック: kebab-case → Title Case
  return clusterSlug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── スロット検出 ───────────────────────────────────────────────────────────

const SLOT_PATTERN = /\{([^}]+)\}/g;

/**
 * templateText 中のスロット名一覧を返す（重複なし）。
 * 例: "{entityName}とは何ですか？" → ["entityName"]
 */
export function extractSlots(templateText: string): string[] {
  const slots = new Set<string>();
  for (const m of templateText.matchAll(SLOT_PATTERN)) {
    slots.add(m[1]);
  }
  return [...slots];
}

// ── スロット解決マップ構築 ─────────────────────────────────────────────────

/**
 * Entity / Cluster / Relationship から、スロット名 → 値 の Map を構築する（純粋関数）。
 *
 * 対応スロット（Sprint 3 時点）:
 *   entityName    → Entity.canonicalName（優先）> displayName > officialName
 *   clusterLabel  → primaryCluster スラグ → CLUSTER_LABEL_MAP（日本語）
 *
 * 将来追加予定（Relationship KV 実装後）:
 *   competitor    → Relationship.competitorOf[0]（最初の競合 Entity 名）
 *   parentEntity  → Entity.parentEntity スラグ → Entity 名
 *   cluster       → clusterLabel と同義（英語版）
 */
export function buildSlotMap(
  entity: EntityForResolver,
  relationship?: RelationshipForResolver | null,
): Map<string, ResolvedSlot> {
  const map = new Map<string, ResolvedSlot>();

  // entityName
  const entityName = entity.canonicalName || entity.displayName || entity.officialName || entity.id;
  map.set('entityName', { slot: 'entityName', value: entityName, source: 'entity' });

  // clusterLabel（日本語）
  const primaryCluster = entity.primaryCluster ?? '';
  const clusterLabel = primaryCluster
    ? resolveClusterLabel(primaryCluster, 'ja')
    : entity.entityType === 'person' ? '人物' : '同分野';
  map.set('clusterLabel', { slot: 'clusterLabel', value: clusterLabel, source: 'cluster' });

  // 将来: competitor（Relationship KV 実装後に追加）
  if (relationship?.competitorOf && relationship.competitorOf.length > 0) {
    map.set('competitor', {
      slot: 'competitor',
      value: relationship.competitorOf[0],
      source: 'relationship',
    });
  }

  return map;
}

// ── スロット置換 ───────────────────────────────────────────────────────────

/**
 * templateText のスロットを slotMap で置換し、resolvedText を返す（純粋関数）。
 * 解決できなかったスロットはそのまま残す（例: "{competitor}" が未定義の場合）。
 */
export function resolveTemplateText(
  templateText: string,
  slotMap: Map<string, ResolvedSlot>,
): { resolvedText: string; resolvedSlots: ResolvedSlot[]; unresolvedSlots: string[] } {
  const usedSlots: ResolvedSlot[] = [];
  const unresolvedSlots: string[] = [];

  const resolvedText = templateText.replace(SLOT_PATTERN, (_, slotName: string) => {
    const slot = slotMap.get(slotName);
    if (slot) {
      usedSlots.push(slot);
      return slot.value;
    }
    unresolvedSlots.push(slotName);
    return `{${slotName}}`;  // 未解決のまま残す
  });

  return { resolvedText, resolvedSlots: usedSlots, unresolvedSlots };
}

// ── QuestionInstance 生成 ──────────────────────────────────────────────────

/**
 * instanceId の採番ルール:
 *   "QIN-{entityId}-{promptTypeId}-{templateId末尾3桁}"
 *   例: "QIN-chatgpt-P01-001"
 */
function buildInstanceId(entityId: string, template: QuestionTemplate): string {
  const suffix = template.templateId.slice(-3);  // "001"
  const pid = template.promptTypeId.replace('-', '');  // "P01"
  return `QIN-${entityId}-${pid}-${suffix}`;
}

// ── 主要関数: 1 Entity × 1 Template → QuestionResolutionResult ────────────

/**
 * 1つの Template を 1つの Entity に適用し、QuestionInstance を生成する（純粋関数）。
 */
export function resolveQuestion(
  entity: EntityForResolver,
  template: QuestionTemplate,
  relationship?: RelationshipForResolver | null,
): QuestionResolutionResult {
  const slotMap = buildSlotMap(entity, relationship);
  const { resolvedText, resolvedSlots, unresolvedSlots } = resolveTemplateText(
    template.templateText,
    slotMap,
  );

  const instance: QuestionInstance = {
    instanceId:   buildInstanceId(entity.id, template),
    templateId:   template.templateId,
    entityId:     entity.id,
    promptTypeId: template.promptTypeId,
    resolvedText,
    createdAt:    new Date().toISOString(),
  };

  return { instance, resolvedSlots, unresolvedSlots };
}

// ── Entity 単位の全 Template 解決 ─────────────────────────────────────────

/**
 * 1つの Entity に対して全 QuestionTemplate を適用し、EntityResolutionReport を返す（純粋関数）。
 */
export function resolveAllQuestions(
  entity: EntityForResolver,
  templates: QuestionTemplate[],
  relationship?: RelationshipForResolver | null,
): EntityResolutionReport {
  const entityName = entity.canonicalName || entity.displayName || entity.id;
  const clusterLabel = resolveClusterLabel(entity.primaryCluster ?? '', 'ja');

  const results = templates.map(t => resolveQuestion(entity, t, relationship));

  return { entityId: entity.id, entityName, clusterLabel, results };
}
