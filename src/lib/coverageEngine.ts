/**
 * Coverage Engine — L3（Sprint 2）
 *
 * 純粋関数のみ。KV アクセス・AI 呼び出し・状態変更はゼロ。
 * 入力: QuestionTemplate.requiredCoverage + EvidenceItem.coverageType[]
 * 出力: TemplateCheckResult / EntityCoverageReport
 *
 * ── 配線状況（PL-008・2026-06-30確認） ──────────────────────────────────────
 * このファイルは現在どこからも import されていない。
 * tsconfig.api.json が src/ を含まないため、api/coverage-report.ts /
 * api/page-generate.ts / api/qi-resolve.ts は同じロジックをそれぞれインライン
 * 複製して使っている（本ファイルが複製元の正本）。
 *
 * 残している理由：将来 src/ 側（フロントエンド）で Coverage 判定を直接行う
 * 機能（例: Entity Workspace での保存前プレビュー計算）を作る際、このまま
 * import して使える状態にしておくため。API 側のインライン実装を変更した
 * 場合はこのファイルにも反映し、正本として同期を保つこと。
 */

import type { CoverageType, CoverageResult, EvidenceItem, QuestionTemplate } from '../types/index.js';

// ── 出力型 ────────────────────────────────────────────────────────────────

/** 1テンプレートに対する Coverage 判定結果 */
export interface TemplateCheckResult extends CoverageResult {
  templateId: string;
  promptTypeId: string;
  /** UNLOCKED: requiredCoverage が全て充足されている / LOCKED: 不足あり */
  status: 'UNLOCKED' | 'LOCKED';
}

/** Entity 単位の Coverage 判定レポート */
export interface EntityCoverageReport {
  entityId: string;
  /** 充足済み: 全 requiredCoverage が揃っている Template */
  unlockedTemplates: TemplateCheckResult[];
  /** 未充足: 1つ以上 requiredCoverage が不足している Template */
  lockedTemplates: TemplateCheckResult[];
  coverageSummary: CoverageSummary;
}

export interface CoverageSummary {
  /** Evidence から収集できた全 coverageType の集合（重複なし） */
  coveredTypes: CoverageType[];
  /** Evidence に coverageType が付与されていないアイテム数 */
  evidenceWithoutCoverageType: number;
  /** Evidence 総数 */
  totalEvidence: number;
  /** coverageType 付与済みの Evidence 数 */
  labelledEvidence: number;
}

// ── 純粋関数 ──────────────────────────────────────────────────────────────

/**
 * Evidence リストから coverageType の集合（Set）を収集する。
 * coverageType が付与されていない Evidence は無視する（推定しない）。
 */
export function collectCoverageTypeSet(evidenceList: EvidenceItem[]): Set<CoverageType> {
  const set = new Set<CoverageType>();
  for (const ev of evidenceList) {
    if (Array.isArray(ev.coverageType)) {
      for (const ct of ev.coverageType) {
        set.add(ct);
      }
    }
  }
  return set;
}

/**
 * 1つの QuestionTemplate に対して Coverage を判定する（純粋関数）。
 *
 * coverageScore = coveredTypes ÷ requiredCoverage.length（0〜1）
 * requiredCoverage が空の場合は score = 1.0 として UNLOCKED 扱い。
 */
export function checkTemplateCoverage(
  template: QuestionTemplate,
  coverageTypeSet: Set<CoverageType>
): TemplateCheckResult {
  const required = template.requiredCoverage;
  const coveredTypes = required.filter(ct => coverageTypeSet.has(ct));
  const missingTypes = required.filter(ct => !coverageTypeSet.has(ct));
  const coverageScore = required.length === 0 ? 1.0 : coveredTypes.length / required.length;
  const ok = missingTypes.length === 0;

  return {
    templateId: template.templateId,
    promptTypeId: template.promptTypeId,
    ok,
    coveredTypes,
    missingTypes,
    coverageScore,
    status: ok ? 'UNLOCKED' : 'LOCKED',
  };
}

/**
 * Entity 単位の Coverage 判定レポートを生成する（純粋関数）。
 *
 * - evidenceList の coverageType[] から coverageTypeSet を収集
 * - 全 QuestionTemplate に対して checkTemplateCoverage を実行
 * - UNLOCKED / LOCKED に分類
 */
export function buildEntityCoverageReport(
  entityId: string,
  evidenceList: EvidenceItem[],
  questionTemplates: QuestionTemplate[]
): EntityCoverageReport {
  const coverageTypeSet = collectCoverageTypeSet(evidenceList);
  const labelledEvidence = evidenceList.filter(
    ev => Array.isArray(ev.coverageType) && ev.coverageType.length > 0
  ).length;

  const coverageSummary: CoverageSummary = {
    coveredTypes: [...coverageTypeSet] as CoverageType[],
    totalEvidence: evidenceList.length,
    labelledEvidence,
    evidenceWithoutCoverageType: evidenceList.length - labelledEvidence,
  };

  const results = questionTemplates.map(t => checkTemplateCoverage(t, coverageTypeSet));
  const unlockedTemplates = results.filter(r => r.status === 'UNLOCKED');
  const lockedTemplates = results.filter(r => r.status === 'LOCKED');

  return {
    entityId,
    unlockedTemplates,
    lockedTemplates,
    coverageSummary,
  };
}
