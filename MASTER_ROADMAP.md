# Aisle Platform v1.0 — Master Roadmap

**策定日**: 2026-06-29  
**最終更新**: 2026-06-30（R5 Reference Finish 完了 / RefBase Finish Complete）  
**ステータス**: RefBase Finish Phase 完了 / R1〜R5 全完了  
**目的**: Studio / RefBase / Monitor / Scope / UI / Data Model / Pipeline / Knowledge Graph / Registry / ID体系 / Implementation の現在地を一枚で整理し、以降の作業が迷走しないようにする。

---

## 0. 全体構成図（現在地）

```
┌─────────────────────────────────────────────────────────────────┐
│                    Aisle Platform v1.0                          │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │ Aisle Studio │   │   RefBase    │   │ Aisle Monitor /  │   │
│  │ (生成・管理)  │──▶│  (公開・配信) │──▶│  Scope (観測)    │   │
│  │ app.aisle-   │   │ refbase.ai   │   │  未実装          │   │
│  │   aio.ai     │   │              │   │                  │   │
│  └──────────────┘   └──────────────┘   └──────────────────┘   │
│         │                  │                                    │
│         └─────── Vercel KV（共有）───────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. プロダクト別 現在地

### 1-A. Aisle Studio（`app.aisle-aio.ai`）

**役割**: 出現設計ワークフロー。診断 → 設計 → 生成 → 公開。

#### 現行 UI フロー（Phase 1〜5）

| Phase | 画面名 | ファイル | 機能 | 状態 |
|-------|--------|---------|------|------|
| P0 | ログ取得 | `Phase0LogCollect.tsx` | AI出力ログ自動収集 | ✅ 稼働中 |
| P1 | 因果分析 | `Phase1Evaluation.tsx` | K-ID・C-IDスコア算出 | ✅ 稼働中 |
| P2 | 出現設計 | `Phase2Design.tsx` | After構文・M-ID・E-ID設計 | ✅ 稼働中 |
| P3 | 突合検証 | `Phase3Reconciliation.tsx` | 設計と現状の差分診断 | ✅ 稼働中 |
| P4 | 実装設計 | `Phase4Implementation.tsx` | AI専用ページ生成・管理 | ✅ 稼働中 |
| — | レポート | `Report.tsx` | 診断レポート出力 | ✅ 稼働中 |
| — | Admin | `AdminPage.tsx` | Entity・Reference 管理 | ✅ 稼働中 |

#### 現行 API

| ファイル | 役割 | 状態 |
|---------|------|------|
| `api/classify.ts` | K-IDスコア・C-ID算出 | ✅ |
| `api/classify-pid.ts` (相当) | P-ID分類 | ✅ |
| `api/design.ts` | After構文・M-ID設計 | ✅ |
| `api/design-step2.ts` | E-ID設計 | ✅ |
| `api/design-step3.ts` | （追加ステップ） | ✅ |
| `api/reconcile.ts` | 突合診断・到達可能性算出 | ✅ |
| `api/implement.ts` | 実装計画策定 | ✅ |
| `api/page-generate.ts` | ページ生成（POST）・インデックス取得（GET） | ✅ |
| `api/page-get.ts` | 公開ページ取得 | ✅ |
| `api/page-delete.ts` | ページ削除・インデックス更新 | ✅ |
| `api/refbase-get.ts` | RefBase KV読み取り | ✅ |
| `api/evidence-extract.ts` | Evidence候補抽出・Tier判定 | ✅ |
| `api/entity-delete.ts` | Entity削除（Admin） | ✅ |
| `api/log-collect.ts` | ログ収集 | ✅ |
| `api/session.ts` | セッション管理 | ✅ |
| `api/competitor.ts` | 競合分析 | ✅ |
| `api/evaluate-axes.ts` | 軸評価 | ✅ |
| `api/fetch-url.ts` | URL取得 | ✅ |

#### 完了済み

- Reference 生成フロー（add / update / delete）
- Evidence Tier 設計（T1〜T4）と実装
- RefBase への保存（saveToRefBase）
- questionSlug 採番バグ修正
- EvidenceWarningPanel（不足type・T3除外の可視化）
- Admin UI（Entity 一覧・Reference 一覧・削除）

#### 未実装（Aisle Studio）

| ID | 内容 | 優先度 |
|----|------|--------|
| AS-01 | Coverage 画面（5軸の充足状況表示） | 高 |
| AS-02 | Relationship 登録 UI | 高 |
| AS-03 | QuestionTemplate 一覧・管理画面 | 中 |
| AS-04 | QuestionInstance 一覧・管理画面 | 中 |
| AS-05 | Quality Audit 結果画面（L6） | 中 |
| AS-06 | Evidence KV 投入 UI（現状は手動 Upstash 操作） | 中 |
| AS-07 | Draft 承認フロー（未承認 Reference を保存しない L7） | 低 |
| AS-08 | セッション管理画面（過去セッション一覧・再開） | 低 |
| AS-09 | clientSlug 重複管理 | 低 |
| AS-10 | llms.txt clientSlug 別対応 | 低 |

#### 技術的負債（Aisle Studio）

| ID | 内容 |
|----|------|
| TD-001 | ~~Coverage Check が Reference 生成前に存在しない~~（**Sprint 4 で解消**） | — |
| TD-002 | Question と Reference が密結合（promptText が Reference に直書き）| 未解消 |
| TD-003 | Quality Audit が存在しない（生成と保存が一体化） | 未解消 |
| TD-004 | responseSchema が存在しない（AI への指示が promptText のみ） | 未解消 |
| TD-005 | Publishing Layer が独立していない（L5 に生成と KV 保存が一体化） | 未解消 |
| TD-L07 | update モードで promptText 不一致時のフォールバックマッチングに誤適用リスク | 未解消 |
| TD-L08 | page-delete.ts の deleteFromIndex デフォルト false（幽霊エントリリスク） | 未解消 |
| **TD-COV-001** | Coverage Engine ロジックが `src/lib/coverageEngine.ts` / `api/coverage-report.ts` / `api/page-generate.ts` の3箇所に重複。推奨対応: `api/_coverage.ts` に共通化。**優先度: Medium**（Relationship Coverage 実装前に対応）。 | 未解消 |
| **TD-COV-002** | `registryAvailable=false` 時に Coverage Gate がバイパスされる（後方互換目的）。将来は strict mode（503返却）に切り替え。**優先度: Low〜Medium**（Observation Layer 整備後に再判断）。 | 意図的・将来対応 |
| **TD-QI-001** | QuestionInstance Resolver（`resolveQuestionInstance()` 等）が `api/page-generate.ts` にインライン実装されている。推奨対応: `api/_questionResolver.ts` に分離し、`qi-get` / 将来の Admin UI / Monitor と共通利用する。**優先度: Medium**（RefBase IA v2 または Relationship Resolver 実装前に対応）。 | 短期許容・将来対応 |

---

### 1-B. RefBase（`refbase.ai`）

**役割**: Question-first Knowledge Base。AI が引用・参照する公開エンドポイント。

#### 現在の情報構造（IA v2.0 完了後）

```
Level 0: /                          ← Entity 一覧 + Cluster カード（IA-1c 完了）
Level 1: /cluster/{id}              ← Cluster ページ（IA-1b 完了）✅
Level 2: /entity/{id}               ← Entity ハブ + Knowledge Graph（IA-4b 完了）
Level 3: /reference/{entityId}/{id} ← Reference ページ（citation[] JSON-LD 完了）
```

#### 現在の KV データ量

| データ種別 | 件数 | 状態 |
|----------|------|------|
| Entity | 31件 | ✅ |
| Reference | 160件 | ✅ |
| Evidence | 152件（31 Entity 分） | ✅ |
| Cluster Registry（`refbase:registry:clusters`） | 12件（ACTIVE:11 / DRAFT:1） | ✅ IA-1a 完了 |
| Relationship Registry（`refbase:registry:relationships`） | 56件（5 type） | ✅ IA-4a 完了 |
| QuestionTemplate Registry | 6件（v1.1） | ✅ |
| QuestionInstance KV（`refbase:qi:{entityId}:{promptTypeId}`） | 可変（生成時に冪等保存） | ✅ QI Sprint 完了 |

#### 公開エンドポイント

| エンドポイント | 状態 | 備考 |
|-------------|------|------|
| `/` | ✅ | Cluster カード + Entity 縦並び（IA-1c 完了） |
| `/cluster/{id}` | ✅ | Cluster ページ（IA-1b 完了） |
| `/entity/{id}` | ✅ | Entity ハブ + Knowledge Graph セクション（IA-4b 完了） |
| `/reference/{entityId}/{refId}` | ✅ | citation[] JSON-LD 付き（IA-2 完了） |
| `/llms.txt` | ✅ | Cluster セクション + Entity セクション（IA-3 完了） |
| `/sitemap.xml` | ✅ | Cluster URL + P-ID 別 priority（IA-3 完了） |
| `/api/cluster-registry` | ✅ | IA-1a 完了 |
| `/api/relationship-registry` | ✅ | IA-4a 完了（?entity / ?type / ?status フィルタ対応） |

#### JSON-LD / AI フレンドリー対応

| 要素 | 状態 |
|------|------|
| Organization / Product / Person Schema | ✅ |
| FAQPage Schema | ✅ |
| additionalType: Cluster URL | ✅ IA-2 完了 |
| citation[] in acceptedAnswer | ✅ IA-2 完了 |
| Cluster 別 llms.txt セクション | ✅ IA-3 完了 |
| P-ID 別 sitemap priority | ✅ IA-3 完了 |
| Entity Knowledge Graph 表示 | ✅ IA-4b 完了（UI のみ・JSON-LD は未実装） |
| Relationship JSON-LD（schema.org competitor / parentOrganization） | ❌ 未実装 |

#### 残課題（RefBase）

| ID | 内容 | 優先度 |
|----|------|--------|
| RB-10 | Relationship JSON-LD（Entity ページに competitor / parentOrganization を追加） | 中 |
| RB-11 | Evidence type 別分類表示（Reference ページで「実績・根拠」を type 別に整理） | 低〜中 |
| RB-08 | RefBase 専用 KV への分離（現状 Aisle KV 共有） | 低 |
| RB-09 | refbase:index:all の削除時同期 | 低 |

---

### 1-C. Aisle Monitor（未実装）

**役割**: AI出現を定点観測する Observation Layer。  
**現状**: 設計のみ確定。実装は未着手。Studio + RefBase の生成フロー安定後に設計を再開する。

| 機能 | 状態 | 備考 |
|------|------|------|
| Seed Mode A（生成時即時チェック） | ❌ 未実装 | Perplexity/ChatGPT への問い → 出現確認 |
| Seed Mode B（定期巡回） | ❌ 未実装 | cron ジョブで定点観測 |
| Test Mode（Perplexity 定点観測） | ❌ 未実装 | 特定 Question を定期送信して出現率計測 |
| Observation → Knowledge フィードバックループ | ❌ 未実装 | 出現結果を Coverage / Evidence に反映 |

**着手条件**: Studio Quality Audit（L6）+ Publishing（L7）完了後。  
**5軸評価**:
- Design: ✅ 設計確定（Seed Mode A/B / Test Mode）
- Backend: ❌ 0%
- UI: ❌ 0%
- Public: — 不要
- Monitoring: — 自身が Monitoring Layer

---

### 1-D. Aisle Scope（未実装）

**役割**: AI出現状況の可視化・スコアリングツール。  
**現状**: Evidence（`aisle-ev-014`）として定義あり。プロダクトとしては未着手。

**着手条件**: Monitor 完了後。  
**5軸評価**: Design / Backend / UI / Public / Monitoring すべて 0%。

---

---

### 1-E. 4プロダクト × 5軸 現在地マトリクス（2026-06-29 更新）

| プロダクト | Design | Backend | UI | Public | Monitoring |
|----------|:------:|:-------:|:--:|:------:|:----------:|
| **Aisle Studio** | ✅ 確定 | ✅ 稼働中 | ✅ 稼働中（Coverage/Relationship/QA 画面なし） | — | — |
| **RefBase** | ✅ 確定（IA v2.0 完了） | ✅ 稼働中（全エンドポイント） | ✅ 稼働中（Relationship JSON-LD のみ残） | ✅ 本番公開中 | ❌ 未接続 |
| **Aisle Monitor** | ✅ 設計確定 | ❌ 0% | ❌ 0% | — | — |
| **Aisle Scope** | ❌ 0% | ❌ 0% | ❌ 0% | — | — |

**RefBase IA v2.0 完成度**: **100%**（全 7 Sprint 完了）

---

## 2. Pipeline Architecture — 現在地

### 7 層アーキテクチャ vs 実装状況

| Layer | 役割 | 実装状態 | 場所 |
|-------|------|---------|------|
| **L1** Entity | KV から Entity 取得・提供 | ✅ 稼働中 | `refbase-get.ts` / Admin |
| **L2** Question Template | QuestionTemplate / QuestionInstance / responseSchema | ✅ KV 登録済み / ❌ UI なし / ✅ Instance KV 保存済み（QI Sprint） | `src/lib/questionResolver.ts` / `api/page-generate.ts` |
| **L3** Coverage Engine | requiredCoverage ⊆ coverageTypeSet の判定 | ✅ 純粋関数実装済み（Sprint 2） | `src/lib/coverageEngine.ts` |
| **L4** Evidence Resolver | coverageType フィルタで filteredEvidence を返す | ❌ 未実装（API 統合なし） | — |
| **L5** Reference Generator | filteredEvidence + responseSchema → Reference Draft | ⚠️ 現行 page-generate.ts（L3/L4 なし・ダイレクト生成） | `api/page-generate.ts` |
| **L6** Quality Audit | responseSchema の sections 充足・citation 検証 | ❌ 未実装 | — |
| **L7** Publishing | L6 承認済み Draft のみ KV 保存 | ❌ 未実装（L5 と一体化中） | — |
| **Orchestrator** | L5 → L6 → ok/ng のフロー制御 | ❌ 未実装 | — |

**現行の実態**: L5 と L7 が `page-generate.ts` の中で一体化している（TD-005）。L3/L4 を通らず直接生成・保存している（TD-001）。

---

## 3. Knowledge Graph — 現在地

### Registry（KV 登録済み）

| Registry | KV キー | バージョン | 件数 | 状態 |
|----------|--------|---------|------|------|
| CoverageTypes | `refbase:registry:coverageTypes` | v1.1 | 5軸 | ✅ |
| ResponseSchemas | `refbase:registry:responseSchemas` | v1.1 | 6件 | ✅ |
| QuestionTemplates | `refbase:registry:questionTemplates` | v1.1 | 6件 | ✅ |

### QuestionTemplate v1.1（確定）

| ID | P-ID | templateText | requiredCoverage | optionalCoverage |
|----|------|-------------|-----------------|-----------------|
| QT-P01-001 | P-01 | {entityName}とは何ですか？ | [Capability] | [Identity] |
| QT-P02-001 | P-02 | {entityName}と同分野の競合との違いは？ | [Capability, Differentiation] | [Identity] |
| QT-P03-001 | P-03 | {clusterLabel}の分野で注目されている… | [Credibility] | [Identity] |
| QT-P04-001 | P-04 | {entityName}が提供する価値で解決できる課題は？ | [Capability] | [Identity, UseCase] |
| QT-P05-001 | P-05 | {entityName}について信頼できる情報源は？ | [Credibility] | [Identity] |
| QT-P06-001 | P-06 | {entityName}を選ぶ理由として挙げられる強みは？ | [Capability, Differentiation] | [Identity] |

### Relationship Registry（IA-4a 完了）

| 種別 | 状態 | 備考 |
|------|------|------|
| `refbase:registry:relationships` | ✅ 完了 | version: 1.0 / 56件 |
| parentEntity / productOf（directed） | ✅ | 各6件 |
| competitorOf / alternativeTo（bidirectional） | ✅ | 7件 / 6件 |
| memberOfCluster（directed） | ✅ | 31件（全 Entity 分） |
| `/api/relationship-registry` | ✅ | ?entity / ?type / ?status フィルタ対応 |
| Relationship JSON-LD（schema.org） | ❌ 未実装 | competitor / parentOrganization |
| Relationship Coverage Check（L3 拡張） | ❌ 未実装 | Studio 側 Sprint で実装 |
| R-01〜R-22 全種 | ⚠️ 5 type のみ実装 | 17 type は未登録 |

### Cluster Registry（IA-1a 完了）

| 種別 | 状態 | 備考 |
|------|------|------|
| `refbase:registry:clusters` | ✅ 完了 | version: 1.0 / 12件（ACTIVE:11 / DRAFT:1） |
| `/cluster/{id}` ページ | ✅ 完了 | IA-1b 完了 |
| TOP ページ Cluster カード | ✅ 完了 | IA-1c 完了 |
| `/api/cluster-registry` | ✅ 完了 | read-only |
| Entity の `primaryCluster` / `secondaryClusters` フィールド | ✅ KV 付与済み（31 Entity 全件） |
| Entity JSON-LD `additionalType: Cluster URL` | ✅ 完了 | IA-2 完了 |

---

## 4. Evidence Architecture — 現在地

### フィールド付与状況（152件）

| フィールド | 付与率 | 備考 |
|-----------|--------|------|
| `evidenceId` | ✅ 100%（152件） | Quality Sprint で付与済み |
| `coverageType[]` | ✅ 100%（152件） | v1.1 適用済み |
| `tier`（T1〜T4） | ✅（一部） | evidence-extract で付与 |
| `sourceClass` | ⚠️ 一部のみ | Quality Sprint P3 でバッチ付与予定 |
| `supportedPromptTypes` | ⚠️ 一部のみ | 同上 |
| `evidenceId` per Entity | ✅ | `{slug}-ev-{連番}` 形式で採番済み |
| `sources[]`（1:N構造） | ❌ 未実装 | L4 Evidence Generator 刷新時 |
| `archived` | ❌ 未実装 | Data Model Review 後 |

### Evidence Coverage（Sprint 2 結果）

| Entity | UNLOCKED | 備考 |
|--------|---------|------|
| canva | 6/6 | ✅ |
| gemini | 6/6 | ✅ |
| cursor | 6/6 | ✅ |
| hubspot-crm | 6/6 | ✅ |
| chatgpt | 4/6 | P-03/P-05 LOCKED（Credibility Evidence なし — 正しい挙動） |
| uber | 2/6 | Evidence 3件のみ — 正しい挙動 |

---

## 5. Sprint 進捗

| Sprint | 名称 | 状態 | 完了内容 |
|--------|------|------|---------|
| 0 | Growth Sprint | ✅ 完了 | 31 Entity / 160 Reference / Cluster 設計 |
| 1 | Architecture Foundation | ✅ 完了 | 3 Registry KV 登録・RegistryEnvelope 構造 |
| 1.5 | Registry Envelope | ✅ 完了 | 60/60 チェック通過 |
| 2 | Coverage Engine | ✅ 完了 | `coverageEngine.ts` 純粋関数実装・テスト確認 |
| QS | Quality Sprint（CoverageType Assignment） | ✅ 完了 | 152件 coverageType 付与・Template v1.1 適用・Registry 更新 |
| 3 | Question Resolution | ✅ 完了 | `questionResolver.ts` 実装・186件生成確認・DoD 達成 |
| 4 | Reference Generator（Coverage 統合） | ✅ 完了 | Coverage Gate を page-generate.ts に統合。UNLOCKED のみ生成。31/31 PASS |
| QI | QuestionInstance Sprint | ✅ 完了 | QI KV 保存・resolvedText を L5 への正式入力へ統合・qi-get API 新設。31/31 PASS |
| IA-1a | Cluster Registry + API | ✅ 完了 | `refbase:registry:clusters` 12件・/api/cluster-registry。53/53 PASS |
| IA-1b | /cluster/{id} ページ | ✅ 完了 | ItemList + FAQPage JSON-LD / DRAFT 404 / Breadcrumb。20/20 PASS |
| IA-1c | TOP Cluster 表示 | ✅ 完了 | Cluster カード + Cluster ItemList JSON-LD。17/17 PASS |
| IA-2 | JSON-LD Enhancement | ✅ 完了 | additionalType + citation[]。19/19 PASS |
| IA-3 | Distribution Optimization | ✅ 完了 | llms.txt Cluster + sitemap P-ID priority。19/20 PASS（1件は正常動作の regex 差異） |
| IA-4a | Relationship Registry + API | ✅ 完了 | 56 Relationship / /api/relationship-registry。43/43 PASS |
| IA-4b | Entity Page Knowledge Graph | ✅ 完了 | Knowledge Graph セクション表示。18/18 PASS |
| 5 | Quality Audit | ⏳ 未着手 | L6 実装・responseSchema 検証フロー |
| 6 | Publishing | ⏳ 未着手 | L7 独立・Draft 承認フロー |

---

## 6. ID 体系 — 棚卸し

### 現在使っているID（残す）

| ID | 用途 | 状態 |
|----|------|------|
| **P-ID** | クエリ意図の分類（P-01〜P-06） | ✅ 中核・全システムで使用 |
| **CoverageType** | Evidence 分類軸（5軸） | ✅ KV 付与済み・L3 で使用 |
| **QuestionTemplate ID**（QT-P0n-001） | Template の主キー | ✅ KV 登録済み |
| **QuestionInstance ID**（QIN-{slug}-{pid}-{suffix}） | Instance の主キー | ✅ 生成ロジック確定・KV 未保存 |
| **evidenceId**（{slug}-ev-{連番}） | Evidence の主キー | ✅ 152件付与済み |
| **clientSlug / entitySlug** | 全システムの主キー | ✅ 不変 |
| **questionSlug** | Reference の副キー | ✅ 稼働中 |
| **Tier**（T1〜T4） | Evidence の所有者区分 | ✅ 設計確定・一部付与済み |
| **sourceClass** | Evidence の用途分類 | ✅ 設計確定・付与作業中 |
| **Cluster slug** | Cluster の主キー | ✅ Entity に付与済み・KV 未実装 |

### 将来残すID（未実装だが設計確定）

| ID | 用途 | 着手タイミング |
|----|------|-------------|
| **Relationship ID**（R-01〜R-22） | Relationship の種別 | Sprint 4 以降 |
| **evidenceStrength**（definitive/strong/moderate/weak） | Evidence の根拠強度 | Quality Sprint P3 |
| **citationType** | 引用の種別 | Quality Sprint P3 |

### 廃止候補ID（外部非公開・内部のみ）

| ID | 現状 | 方針 |
|----|------|------|
| **C-ID** | AI 出力の理由分類（Phase 1 で使用） | Studio 内部にのみ残す。RefBase・公開データには出さない |
| **K-ID** | 出現をブロックした競合要因 | Studio 内部にのみ残す |
| **M-ID** | Prompt → Product のセマンティックブロック | Studio 内部にのみ残す |
| **A-ID** | AI 出力の対象カテゴリ | Studio 内部にのみ残す |
| **E-ID** | 外部強化要因（E-A / E-B） | Studio 内部にのみ残す |
| **S-ID / T-ID / 構文ID** | 構文役割・骨格 | Studio 内部（Phase 2 設計ツール）にのみ残す |
| **SB-ID** | （旧設計アーティファクト） | 廃止検討 |

**ガードレール**: C-ID / K-ID / M-ID / A-ID / E-ID / S-ID / T-ID は生成 HTML・RefBase・llms.txt に一切出力しない（D-02 ルール）。

---

## 7. UI 棚卸し — Architecture との対応

### 現行 Studio UI が表現できているもの

| 概念 | 表示 | 備考 |
|------|------|------|
| Entity 一覧 | ✅ Admin | |
| Reference 一覧・削除 | ✅ Admin | |
| Evidence（生成済み） | ✅ EvidenceWarningPanel（Phase 4） | |
| P-ID（生成時選択） | ✅ Phase 4 | |
| Coverage（UNLOCKED/LOCKED） | ❌ 画面なし | |
| QuestionTemplate 一覧 | ❌ 画面なし | |
| QuestionInstance 一覧 | ❌ 画面なし | |
| Relationship 管理 | ❌ 画面なし | |
| Quality Audit 結果 | ❌ 画面なし | |
| Draft 承認フロー | ❌ 画面なし | |
| Evidence KV 投入（手動以外） | ❌ 画面なし | 現状は Upstash 直接操作 |
| Cluster 一覧・管理 | ❌ 画面なし | |

### 不足画面 一覧（優先度順）

| # | 画面名 | 役割 | 対応 Sprint |
|---|--------|------|-----------|
| 1 | **Coverage Panel** | Entity ごとの 5軸充足状況 / UNLOCKED・LOCKED Template 表示 | Sprint 4 |
| 2 | **Evidence Manager** | Evidence 一覧・coverageType・sourceClass・Tier の確認と編集 | Sprint 4 |
| 3 | **QuestionInstance Viewer** | 生成済み QuestionInstance の確認（resolvedText 表示） | Sprint 4 |
| 4 | **Relationship Editor** | R-01〜R-22 の登録・確認 | Sprint 5 |
| 5 | **Quality Audit Panel** | L6 検証結果（sections OK / NG / citationRequired 充足） | Sprint 5 |
| 6 | **Draft Approval** | L6 OK → L7 KV 保存の承認フロー | Sprint 6 |
| 7 | **Cluster Manager** | Cluster KV の管理・Entity 紐付け確認 | Cluster KV Sprint |

---

## 8. Sprint 管理ルール（今後）

### 分類基準

| 分類 | 定義 | アクション |
|------|------|-----------|
| **Critical** | 現在の Sprint が誤った方向に進む。アーキテクチャ違反。データ破壊リスク。 | 現 Sprint を即停止・先に解決 |
| **High** | 重要だが現 Sprint を妨げない。後で効果が大きい。 | Parking Lot へ追加・Sprint 完了後に再評価 |
| **Low** | 改善案・クリーンアップ・将来拡張。 | Technical Debt リストへ追加のみ |

**Critical 以外では現在の Sprint を中断しない。**

### Parking Lot（High 優先度・次 Sprint 以降）

| ID | 内容 | 追加日 | 状態 |
|----|------|--------|------|
| PL-001 | evidenceId 付与済み Evidence への sourceClass / supportedPromptTypes バッチ付与（Quality Sprint P3） | 2026-06-29 | 未着手 |
| ~~PL-002~~ | ~~Cluster KV / Entity 紐付け~~ | 2026-06-29 | ✅ IA-1a 完了 |
| ~~PL-003~~ | ~~llms.txt Cluster セクション追加~~ | 2026-06-29 | ✅ IA-3 完了 |
| ~~PL-004~~ | ~~QuestionInstance の KV 永続化~~ | 2026-06-29 | ✅ QI Sprint 完了 |
| ~~PL-005~~ | ~~RefBase /cluster/{id} ページ実装~~ | 2026-06-29 | ✅ IA-1b 完了 |
| PL-006 | Relationship JSON-LD（schema.org competitor / parentOrganization） | 2026-06-29 | 未着手（IA-4c 候補） |
| PL-007 | Coverage / QI Resolver 共通化（TD-COV-001 / TD-QI-001） | 2026-06-29 | 未着手（Refactor Sprint 候補） |

---

## 9. 次のアクション（Sprint 4 開始前の前提条件）

Sprint 4（Reference Generator × Coverage 統合）を開始する前に確認が必要な事項：

| # | 確認事項 | 状態 |
|---|---------|------|
| 1 | QuestionInstance の KV 保存タイミングを Sprint 3 で保存するか Sprint 4 で保存するか決定 | ✅ QI Sprint で完了（UNLOCKED 後に冪等保存） |
| 2 | L4 Evidence Resolver の入力仕様（entityId + requiredCoverage → filteredEvidence）を確定 | ✅ CLAUDE.md 設計済み |
| 3 | L5 Reference Generator のリファクタ方針（page-generate.ts の何を残し何を切るか）を確定 | ✅ Sprint 4 + QI Sprint で resolvedText → L5 接続完了 |
| 4 | responseSchema を System prompt に組み込む形式を確定 | ✅ KV 登録済み |

---

## 10. 完成度スコアカード

**最終更新**: 2026-06-29（RefBase IA v2.0 完了後）

| 領域 | 完成度 | 前回 | 主な残課題 |
|------|:-----:|:----:|----------|
| **Knowledge Layer**（Entity / Cluster / Relationship / Evidence / Template） | **80%** | 65% | Relationship JSON-LD・R-01〜R-22 全種 未登録 |
| **Generation Layer L1-L3**（Entity取得・Template・Coverage Engine） | 95% | 95% | 変化なし |
| **Generation Layer L4-L7**（Evidence Resolver・Generator・Audit・Publish） | 30% | 30% | L4/L6/L7 未実装。L5 は integraph 済み |
| **Distribution Layer**（RefBase 公開） | **95%** | 60% | Relationship JSON-LD のみ残存 |
| **Observation Layer**（Monitor / Scope） | 0% | 0% | 未着手 |
| **Studio UI**（診断〜生成フロー） | 70% | 70% | Coverage / Relationship / QI / Quality Audit 画面なし |
| **Admin UI** | 60% | 60% | Evidence 投入 UI・Draft 承認なし |
| **Data Model**（Registry / KV スキーマ） | 80% | 80% | sourceClass/supportedPromptTypes バッチ付与・sources[] 未実装 |
| **ID 体系** | 85% | 85% | 廃止候補の正式整理のみ |

---

## 11. 設計原則（再確認・変更なし）

Architecture v1.0 の 6 原則はすべて維持する。

| # | 原則 | 現状との整合 |
|---|------|------------|
| P1 | 単方向依存 | ✅（Observation → Knowledge のフィードバック設計は Monitor 未実装のため問題なし） |
| P2 | 単一責務 | ⚠️（L5 と L7 が一体化 → TD-005） |
| P3 | SSoT 優先 | ✅（Registry / Entity が SSoT） |
| P4 | Coverage ゲート | ✅（Sprint 4 で Coverage Gate 統合・QI Sprint で QI → L5 接続完了） |
| P5 | 後方互換性 | ✅（既存 Reference / Entity への変更はすべて新フィールド追加のみ） |
| P6 | AI First | ✅（RefBase 公開・llms.txt は維持） |

---

---

## 12. Sprint 4 完了記録（2026-06-29）

### 実施内容

- `api/page-generate.ts` に Coverage Gate（L3/L4）をインライン実装
- `collectCoverageTypeSet()`（L4相当）: Evidence[] から coverageType の集合を収集する純粋関数
- `checkCoverage()`（L3相当）: `requiredCoverage ⊆ coverageTypeSet` の充足判定純粋関数（KVアクセスなし・AI呼び出しなし）
- add / update の両モードで Coverage Gate を適用
- LOCKED の P-ID では Claude を呼ばない（`continue` でスキップ）
- UNLOCKED の P-ID のみ Reference 生成・KV保存・RefBase保存される
- `coverageGate: { registryAvailable, results, skipped }` をレスポンスに追加

### 検証結果（31/31 PASS）

| 確認項目 | 結果 |
|---------|------|
| `coverageGate.registryAvailable=true` | ✅ |
| chatgpt P-03/P-05 missingTypes = `[Credibility]` | ✅ |
| chatgpt P-03/P-05 で Claude が呼ばれない（`created=[]`） | ✅ |
| uber P-01/P-02/P-04/P-06 LOCKED、P-03/P-05 UNLOCKED | ✅ |
| canva P-01 生成可能（`created=[recommendation-001]`） | ✅ |
| add / update 両モードで同一挙動 | ✅ |
| 既存 Reference / Registry が破損しない | ✅ |

### 誤生成した Reference の原状回復

デプロイ前に検証スクリプトを実行したため、旧コードが以下を誤生成。すべて削除済み。

- `chatgpt/ranking-002` — 削除済み
- `chatgpt/citation-001` — 削除済み
- `canva/recommendation-001`（2回目テスト生成分）— 削除済み

---

## 13. Runbook — 生成系 API 検証手順

### 原則

生成系 API（page-generate / coverage-report 等）を検証するときは以下を守る。

| # | ルール |
|---|-------|
| 1 | **デプロイ後に検証スクリプトを実行する**。デプロイ前に本番 API へ検証スクリプトを当てない。 |
| 2 | 検証前に `vercel --prod`（または Preview URL）でデプロイ完了を確認する。 |
| 3 | 生成系 API の検証時は、テスト対象の Entity に既存 Reference がないか事前に確認する（`GET /api/page-generate?clientSlug={slug}`）。 |
| 4 | テストで Reference が作成された場合は必ず `page-delete` で削除し、`deleteFromIndex: true` で KV インデックスも更新する。 |
| 5 | 検証後に Entity インデックス（`refbase:index:{slug}`）と Registry（`refbase:registry:questionTemplates`）が破損していないか確認する。 |

### 検証スクリプト実行手順

```bash
# 1. デプロイ完了確認
vercel --prod

# 2. 検証スクリプト実行（本番 URL を指定する）
BASE_URL=https://app.aisle-aio.ai node scratchpad/verify-sprint4.mjs

# 3. 誤生成があれば即削除
# → page-delete API に { clientSlug, questionSlug, deleteFromIndex: true } を POST
```

### 誤生成 Reference が発生したときの対処

1. `GET /api/page-generate?clientSlug={slug}` でインデックスを確認し、誤生成 Reference の questionSlug を特定
2. `POST /api/page-delete` に `{ clientSlug, questionSlug, deleteFromIndex: true }` を送信
3. 削除後に再度 GET で確認し、インデックスから消えていることを確認
4. RefBase の `refbase:index:all` が正しく更新されているか Upstash で確認

---

## 14. 未完了領域の整理と次 Sprint 候補（2026-06-29 更新）

**前提**: RefBase IA v2.0（IA-1a/b/c / IA-2 / IA-3 / IA-4a/b）は全 Sprint 完了。

---

### 14-1. 未完了領域の整理

| 領域 | 目的 | 現在地 | 着手条件 | 優先度 | 依存関係 |
|------|------|--------|---------|:------:|---------|
| **Studio Quality Audit**（TD-003） | L6 による responseSchema 検証。品質未検証の Reference を保存しない | `page-generate.ts` で生成と保存が一体化（L5+L7）。L6 は存在しない | L5 の出力が安定していること | 中 | TD-004（responseSchema）が前提 |
| **Studio Publishing Layer**（TD-005） | L7 として KV 保存を独立させ、L6 承認後のみ保存する | L5（生成）と L7（保存）が `page-generate.ts` に一体化 | L6 Quality Audit が先に実装されていること | 低〜中 | Quality Audit Sprint の後 |
| **Coverage / QI Resolver 共通化**（TD-COV-001 / TD-QI-001） | `api/_coverage.ts` / `api/_questionResolver.ts` に共通関数を抽出し重複を解消 | Coverage ロジックが 3 箇所に重複。QI Resolver が page-generate.ts にインライン実装 | 現状は動作中。急いで直す必要はない | 低〜中 | L4 本格統合 or Relationship Coverage 実装前が望ましい |
| **Relationship JSON-LD** | Entity ページの schema.org に `competitor` / `parentOrganization` を追加し、AI が構造的に Relationship を理解できるようにする | Relationship は UI 表示のみ（IA-4b）。JSON-LD は未実装 | Relationship Registry（IA-4a）が完了していること → **既に完了** | 中 | なし（即着手可能） |
| **Monitor 接続** | RefBase の変化（Reference 更新 / 新規追加）を観測し、AI がどう参照したかを計測するフィードバックループを構築 | 設計のみ。Seed Mode A/B / Test Mode すべて未実装 | Studio + RefBase の生成フロー安定後 | 低（将来） | Studio 7 層完成が前提 |
| **Scope 保留** | AI 出現状況の可視化・スコアリング（Perplexity / ChatGPT 等への定点観測） | `aisle-ev-014` に Evidence 定義のみ。プロダクト未着手 | Monitor 完了後 | 未着手（保留） | Monitor 完了が前提 |
| **Admin UI 整理** | Evidence KV 投入 UI / Coverage Panel / Relationship Editor / Draft 承認フロー を Studio Admin から操作できるようにする | 現状は手動 Upstash 操作。画面なし | Studio 7 層アーキテクチャが固まってから | 低〜中 | Data Model が固まること |

---

### 14-2. 次 Sprint 候補（3つに絞る）

#### 候補 A — Relationship JSON-LD Sprint

| 項目 | 内容 |
|------|------|
| **Sprint 名** | IA-4c: Relationship JSON-LD |
| **目的** | Entity ページの schema.org に `competitor` / `parentOrganization` を追加。AI が競合・親子構造を構造化データから読めるようにする。 |
| **なぜ今か** | Relationship Registry（IA-4a）が完了しており、データはすでに KV にある。UI 表示（IA-4b）も完了。JSON-LD は 1 ファイル・1 関数の追加で完結する。 |
| **メリット** | AI がページを読まなくてもグラフ構造（competitor / parent）を理解できる。schema.org 準拠により Google / Bing のナレッジグラフとの接続可能性が生まれる。工数は小。 |
| **リスク** | 低。既存 JSON-LD に追加するだけ。Entity ページ以外への影響なし。 |
| **推奨度** | ★★★（即着手可能・工数小・効果大） |

---

#### 候補 B — Coverage / QI Resolver 共通化 Sprint（Refactor Sprint）

| 項目 | 内容 |
|------|------|
| **Sprint 名** | Refactor Sprint: TD-COV-001 + TD-QI-001 |
| **目的** | Coverage ロジックと QI Resolver を共通関数ファイルに抽出する。TD-COV-001 / TD-QI-001 の解消。 |
| **なぜ今か** | Relationship Coverage Check（L3 拡張）や Admin UI を実装する前に共通化しておかないと、分岐が増えるほど Technical Debt の影響が広がる。 |
| **メリット** | 今後の L4 本格統合・Relationship Coverage・Admin API が一貫した API を呼ぶようになる。バグ修正が 1 箇所で完結する。 |
| **リスク** | 低〜中。動作中のコードを移動するリファクタリングのため、検証を丁寧にやれば破壊的変更はない。ただし page-generate.ts は複雑なため時間がかかる。 |
| **推奨度** | ★★（IA-4c の後。次の新機能 Sprint 前に入れると安心） |

---

#### 候補 C — Studio Quality Audit Sprint（L6 実装）

| 項目 | 内容 |
|------|------|
| **Sprint 名** | Sprint 5: Quality Audit（L6 実装） |
| **目的** | Reference Draft が responseSchema を満たすか検証する Layer を実装。生成 → 検証 → 承認 → 保存 のフローを確立する。TD-003 / TD-004 解消。 |
| **なぜ今か** | 現在 160 Reference が品質検証なしで保存されている。Reference 数が増えるほど後から Quality Audit を差し込む影響範囲が広がる。 |
| **メリット** | 生成品質の担保。引用 citation が要求される P-03 / P-05 / P-06 で citationRequired チェックが機能する。TD-003 が解消され Architecture v1.0 の P2（単一責務）に近づく。 |
| **リスク** | 中。responseSchema に沿った構造化出力を Claude に要求するシステムプロンプト変更が必要。既存 Reference との品質差が生まれる可能性がある。段階移行（新規生成分のみ L6 通過必須）が安全。 |
| **推奨度** | ★★（Refactor Sprint の後が望ましい。Architecture 上の優先度は高いが影響範囲も大きい） |

---

**推奨実行順**: IA-4c（Relationship JSON-LD）→ Refactor Sprint → Quality Audit Sprint（L6）。

| 順序 | Sprint | 理由 |
|:---:|--------|------|
| 1 | **IA-4c Relationship JSON-LD** | KV 完備・工数小・即着手可能 |
| 2 | **Refactor Sprint** | L6/Admin UI 実装前に共通化しておくと将来の実装が楽になる |
| 3 | **Quality Audit Sprint** | TD-003 解消。Architecture v1.0 準拠に近づく最重要 Sprint |

---

---

## 15. QuestionInstance Sprint 完了記録（2026-06-29）

### 実施内容

- `api/page-generate.ts` に QuestionInstance Resolver（L2）をインライン実装
  - `resolveQuestionInstance()` / `resolveQITemplateText()` / `buildQIInstanceId()` 等の純粋関数
  - KV アクセスなし・AI 呼び出しなし（Coverage Engine と同じ方針）
- **KV キー**: `refbase:qi:{entityId}:{promptTypeId}`（例: `refbase:qi:chatgpt:P-01`）
  - Entity × P-ID で 1 件。冪等に上書き保存。
- **add モード**: Coverage Gate UNLOCKED 後に QI を生成・KV 保存し、`resolvedText` を L5 への正式入力とする
  - Registry unavailable / templateText 欠損 / resolver 失敗時は `promptText` を fallback として使用
  - fallback 発生時は `questionInstances[].fallbackReason` をレスポンスに明示
- **update モード**: 既存 QI KV → 新規 resolve+保存 → promptText fallback の 3 段階で処理
- **`api/qi-get.ts`** 新設（read-only）: `GET /api/qi-get?clientSlug=` で Entity の全 QI を返す
- `QuestionPageIndexEntry` に `instanceId?` フィールドを追加（後方互換）
- Entity KV（`refbase:company:{slug}`）と Registry KV を並列取得してパフォーマンス改善

### 検証結果（31/31 PASS）

| 確認項目 | 結果 |
|---------|------|
| `questionInstances[].saved=true`（UNLOCKED のみ） | ✅ |
| `questionInstances[].usedResolvedText=true` | ✅ |
| chatgpt P-01: `QIN-chatgpt-P01-001` が KV に保存 | ✅ |
| chatgpt P-01 resolvedText: `"ChatGPTとは何ですか？どのような存在・サービスですか？"` | ✅ |
| chatgpt P-03: LOCKED → QI 作成なし | ✅ |
| canva P-01: `QIN-canva-P01-001` が KV に保存 | ✅ |
| uber P-03: `QIN-uber-P03-001` が KV に保存 | ✅ |
| uber P-01: LOCKED → QI 作成なし | ✅ |
| qi-get API: `ok=true` / `count` / `instances[]` 正常返却 | ✅ |
| 既存 Reference / Registry が破損しない | ✅ |

### KV 状態（Sprint 後）

| エンティティ | QI KV | 備考 |
|------------|-------|------|
| chatgpt | P-01 のみ | P-03/P-05 は LOCKED |
| canva | P-01 のみ | 検証用。全6件は未生成 |
| uber | P-03 のみ | 他は LOCKED |
| （他 28 Entity） | なし | Reference 生成時に順次作成される |

QI は冪等保存のため、次の Reference 生成時に上書きされる。削除不要。

---

---

## 16. RefBase IA v2.0 Design Sprint 記録（2026-06-29）

**コード変更なし。設計・設計文書のみ。**

---

### 16-1. 現行 RefBase IA — 棚卸し

#### 情報構造（現状）

```
Level 0: /                          ← Entity 縦並び一覧
Level 2: /entity/{id}               ← Entity ハブ（Reference 一覧）
Level 3: /reference/{entityId}/{id} ← Reference ページ
（Level 1: /cluster/{id} は未実装）
```

#### サーフェス別現状

| サーフェス | ファイル | 現状 |
|-----------|--------|------|
| TOP | `app/page.tsx` | WebSite + ItemList JSON-LD ✅ / Entity縦並び一覧 ✅ / Cluster表示 ❌ |
| Entity Page | `app/entity/[entityId]/page.tsx` | Organization/ItemList/BreadcrumbList JSON-LD ✅ / additionalType: Cluster URL ❌ |
| Reference Page | `app/reference/[entityId]/[referenceId]/page.tsx` | FAQPage（primaryQA + faq） ✅ / citation[] ❌ / P-ID badge ❌ |
| Cluster Page | — | **未実装** |
| llms.txt | `app/llms.txt/route.ts` | Entity別フラット構造 ✅ / Cluster セクション ❌ |
| sitemap | `app/sitemap.ts` | `/`: 1.0 / `/entity`: 0.8 / `/reference`: 0.6（全一律）/ `/cluster`: ❌ / P-ID別 priority ❌ |
| Entity API | `app/api/entity/[entityId]/route.ts` | `{ entity, referenceIndex }` ✅ |
| Reference API | `app/api/reference/[entityId]/route.ts` | Reference 一覧 ✅ |

#### Reference ページの現在のコンテンツ構造

| セクション | フィールド | 状態 |
|-----------|----------|------|
| answer | `reference.answer` | ✅ |
| 実績・根拠 | `reference.evidencePoints[]` | ✅（ただし単一見出しで type 分類なし） |
| 向いている相談 | `reference.scope` | ✅ |
| 他の選択肢との違い | `reference.differentiation` | ✅ |
| よくある質問 | `reference.faq[]` | ✅ |
| 情報ソース | `reference.sourceEvidence[]` | ✅（title / value / sourceUrl / sourceType label） |
| P-ID バッジ・ラベル | — | ❌ 未表示（Entity ページには表示あり） |
| citation[] in JSON-LD | — | ❌ acceptedAnswer に citation なし |

---

### 16-2. Architecture v1.0 照合 — Gap Analysis

| Architecture v1.0 定義 | 現状 | Gap |
|-----------------------|------|-----|
| Level 1: `/cluster/{id}` | ❌ 未実装 | **大**（Distribution Layer の核心） |
| Entity JSON-LD `additionalType: Cluster URL` | ❌ 未実装 | **中**（AI がクラスター文脈を理解できない） |
| Reference JSON-LD `citation[]` | ❌ 未実装 | **中**（Evidence 引用の構造化なし） |
| llms.txt Cluster セクション | ❌ 未実装 | **中**（AI がクラスター横断で参照できない） |
| sitemap P-ID 別 priority（P-06: 0.9） | ❌ 一律 0.6 | **小〜中**（クローラーに優先度を伝えられない） |
| Cluster KV（前提条件） | ❌ 未実装 | **大**（Level 1 の前提） |
| Breadcrumb（Level 1 含む） | TOP/Entity間のみ ✅ | Cluster 経由の BreadcrumbList が欠落 |
| Relationship 露出 | ❌ 未実装 | **大**（Knowledge Graph としての構造が見えない） |
| P-ID 別 sections 構成（Reference） | 単一ページ ✅ | Architecture は P-ID 別 sections を定義済み — 現状は sections ではなくフィールドで分離済み（設計意図は満たされている） |

**設計原則 P6（AI First）との照合**:
- AI がクラスター横断で Entity を参照する導線（Level 1）が完全に欠落。
- Evidence の引用（citation[]）が JSON-LD に存在せず、AI が根拠を追えない。
- Relationship（競合・親子）が非構造のため、AI が文脈を把握できない。

---

### 16-3. RefBase IA v2.0 設計

#### 情報構造（v2.0）

```
Level 0: /
  ├── JSON-LD: WebSite + ItemList（Cluster 入口付き）
  ├── Cluster カード群（primaryCluster ごとにグループ表示）
  └── AI & Machine Access 表（llms.txt / Cluster ページ追加）

Level 1: /cluster/{clusterSlug}  ← 新設
  ├── JSON-LD: ItemList（Cluster 内 Entity 一覧）+ FAQPage（代表 Question）
  ├── Cluster 説明（description / representativeQuestions）
  ├── 所属 Entity 一覧（entityType / refCount / 代表 Reference）
  └── 関連 Cluster リンク

Level 2: /entity/{entityId}
  ├── JSON-LD: Organization/Product/Person
  │           + additionalType: Cluster URL  ← 追加
  ├── Cluster バッジ表示（primaryCluster / secondaryClusters）← 追加
  ├── Reference 一覧（P-ID バッジ付き）✅ 現状
  └── Relationship 露出セクション（competitor / parent）← 将来（IA-4）

Level 3: /reference/{entityId}/{referenceId}
  ├── JSON-LD: FAQPage
  │           + citation[] in acceptedAnswer  ← 追加
  ├── P-ID バッジ・ラベル表示  ← 追加
  ├── answer / evidencePoints / scope / differentiation / faq ✅
  └── sourceEvidence（Evidence type 別分類表示）← 将来（IA-2）
```

#### llms.txt v2.0 構造

```
# RefBase — Question-first Knowledge Layer
# Updated: {date}

## About
{説明文}

## How to Use
{利用手順}

## Clusters（NEW）
- /cluster/ai-assistant       — AI Assistant（ChatGPT / Claude / Gemini / Perplexity）
- /cluster/ai-company         — AI Company & Research（OpenAI / Anthropic / Google DeepMind）
- /cluster/creative-design    — Creative & Design（Canva / Adobe / Midjourney / Figma）
...（Established Cluster のみ列挙）

## Entities
- https://www.refbase.ai/entity/{id}
...

## References by Cluster（NEW）
### AI Assistant
#### ChatGPT（product）
- [選定] ChatGPTとは何ですか？: /reference/chatgpt/recommendation-001
- [比較] ChatGPTと競合との違いは？: /reference/chatgpt/comparison-001
...
### AI Company & Research
...

## References by Entity（後方互換・残す）
### ChatGPT (AI Assistant)
...
```

#### sitemap v2.0

| URL | priority | changeFrequency |
|-----|---------|-----------------|
| `/` | 1.0 | daily |
| `/cluster/{id}` | 0.9 | weekly ← 新設 |
| `/entity/{id}` | 0.8 | weekly |
| `/reference/{entityId}/{id}` P-06 | 0.9 | monthly ← P-ID 別 |
| `/reference/{entityId}/{id}` P-02 | 0.8 | monthly |
| `/reference/{entityId}/{id}` P-01 | 0.7 | monthly |
| `/reference/{entityId}/{id}` P-04/P-05 | 0.6 | monthly |
| `/reference/{entityId}/{id}` P-03 | 0.6 | monthly |

P-ID は `reference.promptTypeId` から判定。

#### JSON-LD v2.0

**Entity ページ（追加）**:
```json
{
  "@type": "Organization",
  "additionalType": "https://www.refbase.ai/cluster/ai-company",
  ...
}
```
Entity が複数 Cluster に属する場合は `additionalType` を配列にする。

**Reference ページ（追加）**:
```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Claudeとは何ですか？",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "...",
      "citation": [
        { "@type": "WebPage", "url": "https://...", "name": "Claude公式サイト" }
      ]
    }
  }]
}
```
`citation` の元データは `reference.sourceEvidence[].sourceUrl`。

#### Cluster ページ（新設）の設計仕様

| 要素 | 内容 |
|------|------|
| URL | `/cluster/{clusterSlug}` |
| JSON-LD | `ItemList`（所属 Entity 一覧）+ `FAQPage`（representativeQuestions 2〜4件） |
| Breadcrumb | RefBase / {Cluster名} |
| ヘッダー | Cluster 名・description・maturity |
| Entity 一覧 | entityType バッジ / refCount / 代表 Reference（P-01 or P-06）へのリンク |
| 関連 Cluster | `relatedClusters[]` から横断リンク |
| AI API 導線 | `/api/cluster/{clusterSlug}` JSON（将来実装）|

**前提条件**: `refbase:cluster:{slug}` KV が実装済みであること。

---

### 16-4. 実装優先順位

| ID | 実装内容 | Impact | Difficulty | Risk | Migration |
|----|---------|:------:|:----------:|:----:|:--------:|
| **IA-1a** | `refbase:cluster:{slug}` KV 実装（Cluster モデル） | 高 | 低 | 低 | 追加のみ |
| **IA-1b** | `/cluster/{id}` ページ（Level 1）新設 | 高 | 中 | 低 | 追加のみ |
| **IA-1c** | TOP ページ Cluster カード表示 | 中 | 低 | 低 | 変更（後方互換） |
| **IA-2a** | Reference JSON-LD に `citation[]` 追加 | 高 | 低 | 低 | 追加のみ |
| **IA-2b** | Entity JSON-LD に `additionalType: Cluster URL` 追加 | 高 | 低 | 低 | 追加のみ |
| **IA-2c** | Reference ページに P-ID バッジ・ラベル追加 | 中 | 低 | 低 | 追加のみ |
| **IA-3a** | llms.txt Cluster セクション追加 | 中 | 低 | 低 | 変更（後方互換残す） |
| **IA-3b** | sitemap P-ID 別 priority | 中 | 低 | 低 | 変更のみ |
| **IA-3c** | sitemap `/cluster/{id}` 追加 | 中 | 低 | 低 | 追加のみ |
| **IA-4a** | Relationship KV（R-01〜R-22）実装 | 高（長期） | 高 | 中 | 新規 |
| **IA-4b** | Entity ページへの Relationship 露出 | 高（長期） | 中 | 低 | 追加のみ |

**実装順序の原則**:
- IA-1a（Cluster KV）は IA-1b / IA-2b / IA-3a / IA-3c の前提条件。最初に実装する。
- IA-2a（citation[]）は IA-1 と独立して実装可能。sourceEvidence がすでにあるため難易度は低い。
- IA-4（Relationship）は他すべてと独立。Cluster Layer 完成後に設計・実装する。

---

### 16-5. Sprint 分解

#### Sprint IA-1: Cluster Layer（最優先）

**目的**: RefBase に Level 1 を追加する。AI が Cluster 横断で Entity を参照できるようにする。

| 作業 | 内容 | ID |
|------|------|---|
| `refbase:cluster:{slug}` KV 設計・投入 | Cluster モデル（11件）を KV に登録 | IA-1a |
| `/cluster/{id}` ページ新設 | ItemList + FAQPage JSON-LD / Entity 一覧 / Breadcrumb | IA-1b |
| TOP ページ Cluster 表示 | Cluster カード群に変更（Entity 縦並びと並立 or 置換） | IA-1c |

**前提条件**: Cluster モデル設計確定（CLAUDE.md Section 28 ⑤ に記載済み）。  
**後方互換**: `/entity/{id}` / `/reference/{id}/{id}` は変更なし。

---

#### Sprint IA-2: JSON-LD Enhancement

**目的**: AI が引用・推論しやすい構造化データを追加する。最小変更でシグナルを強化する。

| 作業 | 内容 | ID |
|------|------|---|
| Reference: `citation[]` in acceptedAnswer | `sourceEvidence[].sourceUrl` を WebPage citation に変換 | IA-2a |
| Entity: `additionalType: Cluster URL` | `primaryCluster` → `/cluster/{slug}` URL を additionalType に追加 | IA-2b |
| Reference: P-ID バッジ・ラベル | `promptTypeId` を画面上に表示 | IA-2c |

**前提条件**: IA-1a（Cluster KV）が完了していること（`/cluster/{slug}` URL が有効であること）。  
**後方互換**: JSON-LD のフィールド追加のみ。既存データ変更なし。

---

#### Sprint IA-3: Distribution Optimization

**目的**: クローラー・AI インデクサーへの情報品質を最適化する。工数が小さく効果が確実。

| 作業 | 内容 | ID |
|------|------|---|
| llms.txt Cluster セクション追加 | Cluster 別グルーピング（Established Cluster のみ）+ Entity 別は後方互換で残す | IA-3a |
| sitemap `/cluster/{id}` 追加 | priority 0.9 / weekly | IA-3b |
| sitemap P-ID 別 priority | `promptTypeId` を判定して priority を設定 | IA-3c |

**前提条件**: IA-1a（Cluster KV）が完了していること。  
**後方互換**: sitemap の変更は追加・修正のみ。llms.txt は既存 References by Entity を残す。

---

#### Sprint IA-4: Knowledge Graph Exposure

**目的**: Relationship を RefBase の公開データに露出する。AI が構造的文脈（競合・親子・統合）を読めるようにする。

| 作業 | 内容 | ID |
|------|------|---|
| Relationship KV 設計・実装 | `refbase:relationship:{slug}` KV モデル（R-01〜R-22 の一部） | IA-4a |
| Entity ページ Relationship 露出 | `competitorOf` / `parentEntity` / `primaryCluster` を構造化表示 | IA-4b |
| Entity JSON-LD Relationship 追加 | `competitor` / `parentOrganization` を schema.org に追加 | IA-4b |

**前提条件**: IA-1（Cluster Layer）完了後に設計・実装開始。  
**対象 Relationship 優先度**（着手初期）: R-10 competitorOf / R-01 parentEntity / R-04 primaryCluster。  
**備考**: Relationship Coverage Check（L3 拡張）は Studio 側 Sprint で並行して設計する。

---

### 16-6. Sprint IA-1〜IA-4 スケジュール方針

| Sprint | 着手条件 | 目安工数 |
|--------|---------|---------|
| IA-1 Cluster Layer | 即時着手可能（KV 設計確定済み） | 中（Cluster KV 11件投入 + 新ページ実装） |
| IA-2 JSON-LD | IA-1a 完了後（Cluster URL が有効になってから） | 小（ファイル数少・追加のみ） |
| IA-3 Distribution | IA-1a 完了後（Cluster KV 参照が必要） | 小（sitemap / llms.txt 2ファイル） |
| IA-4 Knowledge Graph | IA-1〜IA-3 完了後 | 大（Relationship 設計・KV・UI） |

**推奨実行順**: IA-1 → IA-2 + IA-3（並行可）→ IA-4。

---

## 17. Sprint 実施ログ

### 17-1. IA-1a 完了記録（2026-06-29）

**Sprint**: IA-1a — Cluster Registry + read-only API  
**ステータス**: ✅ 実装・実行検証完了（2026-06-29）

#### 実施内容

| 作業 | ファイル | 内容 |
|------|---------|------|
| Cluster Registry 登録スクリプト | `scripts/ia1a-register-cluster-registry.mjs` | `refbase:registry:clusters` に 12 Cluster（ACTIVE: 11 / DRAFT: 1）を RegistryEnvelope 形式で登録 |
| read-only API | `refbase/app/api/cluster-registry/route.ts` | `GET /api/cluster-registry` — `@vercel/kv` 使用。KV 読み取りのみ。書き込みなし。 |
| 検証スクリプト | `scripts/ia1a-verify-cluster-registry.mjs` | PASS/FAIL 形式。6カテゴリ・全 check 項目を検証。 |

#### 実行検証結果（本番: https://www.refbase.ai/api/cluster-registry）

**53/53 ALL PASS**

| カテゴリ | 結果 |
|---------|------|
| Registry 基本構造（version / clusters[] / count / totalCount） | ✅ |
| ACTIVE 11件 / DRAFT 1件 | ✅ |
| 全 ACTIVE Cluster に entitySlugs[] あり | ✅ |
| 全 31 Entity がカバーされ、重複登録なし | ✅ |
| maturity 正当性（established: 7 / growing: 4） | ✅ |
| スポット確認（anchor-artworks / ai-coding / ai-image-generation / aisle） | ✅ |

#### トラブルシュートメモ

- 初回デプロイで 500 エラー発生。原因: raw Upstash REST API は大きな JSON オブジェクトを文字列として返すことがあり、`registry.items` が undefined になった。
- 修正: `@vercel/kv` SDK（既存コードと同様）に切り替えて解消。

#### 登録 Cluster 一覧

| Cluster | slug | Entity 数 | maturity | status |
|---------|------|----------|----------|--------|
| AI Assistant | ai-assistant | 4 | established | ACTIVE |
| AI Company & Research | ai-company | 5 | established | ACTIVE |
| AI Leaders | ai-leaders | 4 | established | ACTIVE |
| Creative & Design | creative-design | 4 | established | ACTIVE |
| Marketing & CRM | marketing-crm | 3 | established | ACTIVE |
| Sports & People | sports-people | 3 | established | ACTIVE |
| Entertainment & Media | entertainment-media | 3 | established | ACTIVE |
| AI Coding | ai-coding | 2 | growing | ACTIVE |
| E-Commerce | e-commerce | 1 | growing | ACTIVE |
| Platform Business | platform-business | 1 | growing | ACTIVE |
| AI出現設計 | ai-emergence | 1 | growing | ACTIVE |
| AI Image Generation | ai-image-generation | 1 | growing | **DRAFT** |

**Entity カバレッジ**: ACTIVE Cluster 内 31 Entity（全 31 Entity をカバー）

#### 安全性確認

- RefBase 表示: 変更なし
- /cluster/{id} ページ: 未作成（IA-1b で実装）
- llms.txt / sitemap: 変更なし
- Entity / Reference / Evidence / QI: 変更なし
- AI 呼び出し: なし
- TypeScript エラー: なし

#### 次のステップ

~~1. **登録スクリプト実行**: `node scripts/ia1a-register-cluster-registry.mjs`~~  ✅ 完了  
~~2. **検証**: `node scripts/ia1a-verify-cluster-registry.mjs`~~  ✅ 53/53 ALL PASS  
~~3. **IA-1b**: `/cluster/{id}` ページ新設~~  ✅ 完了  
4. **IA-2 / IA-3**: 次のスプリント候補

---

### 17-2. IA-1b 完了記録（2026-06-29）

**Sprint**: IA-1b — `/cluster/{clusterId}` ページ新設  
**ステータス**: ✅ 実装・実行検証完了（2026-06-29）

#### 実施内容

| 作業 | ファイル | 内容 |
|------|---------|------|
| Cluster Page 新設 | `refbase/app/cluster/[clusterId]/page.tsx` | `/cluster/{slug}` — `@vercel/kv` でレジストリ取得 → Entity / Reference を並行フェッチ → 表示 |

#### 実装内容

- **データ取得**: `refbase:registry:clusters` → slug 一致 Cluster を検索 → Entity + Index を並行取得 → 代表 Reference（各 Entity 最初の 2件）を表示
- **表示**: Cluster名 / description / maturity / Entity一覧（name / entityType / referenceCount / リンク）/ 代表 Reference（P-IDバッジ / promptText / リンク）/ 代表的な問い / 関連 Cluster
- **JSON-LD**: WebPage + ItemList（所属 Entity）+ BreadcrumbList
- **404**: 存在しない slug または DRAFT Cluster は `notFound()`

#### 実行検証結果（本番: https://www.refbase.ai/cluster/）

**HTTP ステータス: 5/5 PASS**

| URL | 期待 | 結果 |
|-----|------|------|
| /cluster/ai-assistant | 200 | ✅ |
| /cluster/creative-design | 200 | ✅ |
| /cluster/marketing-crm | 200 | ✅ |
| /cluster/e-commerce | 200 | ✅ |
| /cluster/xxxx-not-found | 404 | ✅ |

**コンテンツ確認: 15/15 PASS**  
（Cluster名・Entity一覧・Referenceリンク・maturity・JSON-LD 3種・P-IDバッジ等）

#### 安全性確認

- TOP ページ: 変更なし
- llms.txt / sitemap: 変更なし
- Entity / Reference / Evidence / QI: 変更なし
- KV 書き込み: なし
- AI 呼び出し: なし
- TypeScript エラー: なし

#### 次のステップ

~~IA-1c: TOP ページ Cluster カード表示~~ ✅ 完了（17-3 参照）

- **IA-2**: JSON-LD Enhancement（citation[] / additionalType: Cluster URL）
- **IA-3**: Distribution Optimization（llms.txt Cluster セクション / sitemap P-ID priority）

---

### 17-3. IA-1c 完了記録（2026-06-29）

**Sprint**: IA-1c — TOP ページ Cluster 入口表示  
**ステータス**: ✅ 実装・実行検証完了（2026-06-29）

#### 実施内容

| 作業 | ファイル | 内容 |
|------|---------|------|
| TOP ページ Cluster セクション追加 | `refbase/app/page.tsx` | `refbase:registry:clusters` を並行取得 → ACTIVE Cluster カード群を Entity 一覧の前に表示 |

#### 実装内容

- **データ取得**: `getGlobalIndex()` と `kv.get('refbase:registry:clusters')` を `Promise.all` で並行取得
- **Cluster カード**: 名前 / description / maturity バッジ（Established / Growing）/ entityCount / 代表的な問い最大2件 / P-ID バッジ / `/cluster/{slug}` リンク
- **DRAFT 除外**: `status === 'ACTIVE'` のみ表示（ai-image-generation 非表示）
- **JSON-LD**: Cluster ItemList を既存 Entity ItemList とは別に追加（既存 JSON-LD 破壊なし）
- **AI & Machine Access テーブル**: Cluster Registry 行を追加

#### 実行検証結果（本番: https://www.refbase.ai/）

**17/17 ALL PASS**

| 確認項目 | 結果 |
|---------|------|
| Question Clusters セクション表示 | ✅ |
| ai-assistant / creative-design / marketing-crm 表示 | ✅ |
| ai-image-generation (DRAFT) 非表示 | ✅ |
| /cluster/ リンク・maturity バッジ・P-ID バッジ表示 | ✅ |
| 既存 Entity 一覧（Published Entities）が残存 | ✅ |
| JSON-LD: WebSite / Entity ItemList / Cluster ItemList 全て出力 | ✅ |
| Cluster API がテーブルに追加されている | ✅ |

#### 安全性確認

- /cluster/{id} ページ: 変更なし
- llms.txt / sitemap: 変更なし
- Entity / Reference / Evidence / QI: 変更なし
- KV 書き込み: なし
- AI 呼び出し: なし
- TypeScript エラー: なし

#### IA-1 Sprint 完了サマリー

| サブ Sprint | 内容 | 完了日 |
|-----------|------|--------|
| IA-1a | Cluster Registry KV 登録 + read-only API | 2026-06-29 |
| IA-1b | /cluster/{clusterId} ページ新設 | 2026-06-29 |
| IA-1c | TOP ページ Cluster 入口表示 | 2026-06-29 |

**IA-1 Cluster Layer 完全完了。次は IA-2（JSON-LD Enhancement）または IA-3（Distribution Optimization）。**

---

### 17-4. IA-3 完了記録（2026-06-29）

**Sprint**: IA-3 — Distribution Optimization  
**ステータス**: ✅ 実装・実行検証完了（2026-06-29）

#### 実施内容

| 作業 | ファイル | 内容 |
|------|---------|------|
| llms.txt Cluster セクション追加 | `refbase/app/llms.txt/route.ts` | `## Clusters` インデックス＋`## Cluster Details` 詳細セクション（ACTIVE のみ）を追加 |
| sitemap Cluster URL 追加 | `refbase/app/sitemap.ts` | ACTIVE Cluster を sitemap に追加（Established: 0.85 / Growing: 0.75）|
| sitemap Reference priority P-ID 別 | `refbase/app/sitemap.ts` | Reference priority を P-ID 別に変更（P-06: 0.85 / P-02: 0.80 / P-05: 0.75 / P-03: 0.70 / P-01: 0.65 / P-04: 0.60）|

#### llms.txt 追加内容

- `## Clusters` — ACTIVE Cluster の URL 一覧（DRAFT 除外）
- `## Cluster Details` — 各 Cluster の name / URL / entityCount / maturity / primaryPromptTypes / description / representativeQuestions 最大2件
- How to Use を Cluster 起点の案内に更新

#### sitemap priority 分布（本番）

| priority | 件数 | 該当 |
|---------|------|------|
| 1 | 1 | TOP ページ |
| 0.85 | 39 | Established Cluster + P-06 Reference |
| 0.80 | 63 | Entity ページ + P-02 Reference（Next.js が 0.8 として出力） |
| 0.75 | 23 | Growing Cluster + P-05 Reference |
| 0.70 | 14 | P-03 Reference |
| 0.65 | 33 | P-01 Reference |
| 0.60 | 30 | P-04 Reference（fallback）|

※ Next.js の仕様で `0.80` → `0.8` として出力。実装は正しく動作している。

#### 実行検証結果（本番）

**19/20 PASS（1件は検証スクリプトの正規表現の問題）**

| 確認項目 | 結果 |
|---------|------|
| llms.txt: Clusters / Cluster Details セクション | ✅ |
| llms.txt: ai-assistant / creative-design / marketing-crm 含まれる | ✅ |
| llms.txt: DRAFT(ai-image-generation) 含まれない | ✅ |
| llms.txt: representativeQuestions / primaryPromptTypes | ✅ |
| llms.txt: 既存 Entities / References by Entity 残存 | ✅ |
| sitemap: /cluster/ai-assistant 他 Cluster URL | ✅ |
| sitemap: DRAFT 含まれない | ✅ |
| sitemap: priority 0.85 / 0.75 / 0.65 正常出力 | ✅ |
| sitemap: priority 0.80 → 0.8 として出力（Next.js 仕様）| ✅（検証正規表現が `0.80` を期待していたが実装は正常）|
| sitemap: /entity/ / /reference/ 残存 | ✅ |

#### 安全性確認

- Cluster / TOP / Entity / Reference 表示: 変更なし
- JSON-LD: 変更なし
- KV 書き込み: なし / AI 呼び出し: なし
- TypeScript エラー: なし

---

---

### 17-5. IA-2 完了記録（2026-06-29）

**Sprint**: IA-2 — JSON-LD Enhancement（additionalType + citation）  
**ステータス**: ✅ 実装・実行検証完了（2026-06-29）

#### 実施内容

| 作業 | ファイル | 内容 |
|------|---------|------|
| Entity JSON-LD additionalType | `refbase/app/entity/[entityId]/page.tsx` | `refbase:registry:clusters` を並行取得 → entityId で primaryCluster / secondaryClusters を逆引き → `additionalType: [Cluster URLs]` を追加 |
| Reference JSON-LD citation | `refbase/app/reference/[entityId]/[referenceId]/page.tsx` | `sourceEvidence.sourceUrl` を Set で重複排除 → `citation: [{@type: WebPage, url}]` を FAQPage と primaryQA の acceptedAnswer に追加 |

#### 設計メモ

- **Cluster 逆引き**: `RefBaseEntity` 型に cluster フィールドがないため、Registry から `entitySlugs.includes(entityId)` で primaryCluster を特定。`secondaryEntitySlugs` で secondaryClusters を特定。
- **citation**: `sourceEvidence[].sourceUrl` が存在するもののみ。`Set` で重複排除。sourceUrl ゼロ件の場合は `citation` フィールド自体を省略（`...citationUrls.length > 0 ? {...} : {}`）。
- **UI 変更なし**: JSON-LD のみ変更。表示 UI は一切触らず。
- **Relationship JSON-LD**: 今回は未実装（IA-4 で実施）。

#### 実行検証結果（本番）

**19/19 ALL PASS**

| 確認項目 | 結果 |
|---------|------|
| /entity/chatgpt: additionalType あり、/cluster/ai-assistant を含む | ✅ |
| /entity/canva: additionalType あり、/cluster/creative-design を含む | ✅ |
| /entity/aisle: additionalType あり、/cluster/ai-emergence を含む | ✅ |
| 全 Entity ページ: JSON valid | ✅ |
| /reference/chatgpt/comparison-001: citation あり、重複なし | ✅ |
| /reference/canva/comparison-001: citation あり、重複なし | ✅ |
| /reference/aisle/...: sourceUrl なしでも JSON valid・壊れない | ✅ |

#### 安全性確認

- Cluster / TOP / llms.txt / sitemap: 変更なし
- Entity / Reference 表示 UI: 変更なし
- KV 書き込み: なし / AI 呼び出し: なし
- TypeScript エラー: なし

#### RefBase IA v2.0 Sprint 完了サマリー

| Sprint | 内容 | 完了日 |
|--------|------|--------|
| IA-1a | Cluster Registry KV + read-only API | 2026-06-29 |
| IA-1b | /cluster/{clusterId} ページ新設 | 2026-06-29 |
| IA-1c | TOP ページ Cluster 入口表示 | 2026-06-29 |
| IA-3 | llms.txt Cluster セクション + sitemap P-ID priority | 2026-06-29 |
| IA-2 | Entity additionalType + Reference citation JSON-LD | 2026-06-29 |

**IA-1 / IA-2 / IA-3 完了。残りは IA-4（Knowledge Graph Exposure）。**

---

### 17-6. RefBase IA v2.0 Integration Verification（2026-06-29）

**目的**: IA-1 / IA-2 / IA-3 の変更が RefBase 全体として正しく接続されているか確認  
**ステータス**: ✅ 96/96 ALL PASS — 新規実装なし・KV書き込みなし

#### 検証結果サマリー

| エリア | 確認項目 | 結果 |
|--------|---------|------|
| 1. TOP | Cluster セクション / JSON-LD 3種 / valid JSON | 6/6 ✅ |
| 2. Cluster Pages | 4 Cluster × 6項目 + DRAFT 404 + 存在しない 404 | 26/26 ✅ |
| 3. Entity Pages | 4 Entity × 6項目（additionalType / JSON-LD valid） | 24/24 ✅ |
| 4. Reference Pages | 4 Reference × 3-4項目（FAQPage / citation / 重複なし） | 14/14 ✅ |
| 5. Machine Access | llms.txt 8項目 + sitemap 10項目 | 18/18 ✅ |
| 6. API | cluster-registry 8項目（ACTIVE/DRAFT件数・entityCount） | 8/8 ✅ |
| **合計** | | **96/96 ALL PASS** |

#### RefBase IA v2.0 完成度

| Sprint | 内容 | 状態 |
|--------|------|------|
| IA-1a | Cluster Registry KV + read-only API | ✅ 完了 |
| IA-1b | /cluster/{clusterId} ページ新設 | ✅ 完了 |
| IA-1c | TOP ページ Cluster 入口表示 | ✅ 完了 |
| IA-2 | Entity additionalType + Reference citation | ✅ 完了 |
| IA-3 | llms.txt Cluster セクション + sitemap P-ID priority | ✅ 完了 |
| **IA-4a** | **Relationship Registry KV + read-only API** | **✅ 完了** |
| **IA-4b** | **Entity Page Relationship 表示** | **✅ 完了** |

**完成度: 7/7 Sprint 完了（100%）。RefBase IA v2.0 全 Sprint 完了。破壊的変更・不整合ゼロ。**

---

### 17-7. IA-4a 完了記録（2026-06-29）

**目的**: Relationship Registry KV 登録 + GET /api/relationship-registry 実装  
**ステータス**: ✅ 43/43 ALL PASS

#### 実装範囲

| 成果物 | 内容 |
|--------|------|
| `aisle-app/scripts/ia4a-register-relationship-registry.mjs` | KV 登録スクリプト（56 Relationship） |
| `aisle-app/scripts/ia4a-verify-relationship-registry.mjs` | 検証スクリプト（43チェック） |
| `refbase/app/api/relationship-registry/route.ts` | read-only API（entity/type/status フィルタ） |
| `refbase:registry:relationships` | KV キー（version: 1.0 / items: 56件） |

#### Relationship 内訳（56件）

| relationshipType | 件数 | direction |
|----------------|:----:|:--------:|
| parentEntity | 6 | directed |
| productOf | 6 | directed |
| competitorOf | 7 | bidirectional |
| alternativeTo | 6 | bidirectional |
| memberOfCluster | 31 | directed |

#### 安全条件確認

- Entity / Reference / Cluster / Evidence / QI への変更: なし ✅
- JSON-LD / llms.txt / sitemap への変更: なし ✅
- AI 呼び出し: なし ✅
- KV 書き込み: `refbase:registry:relationships` のみ ✅

#### 修正バグ（登録スクリプト）

`rel()` ヘルパー関数の destructuring naming conflict:
- `source` パラメータ（entity slug用）と `source: src`（attribution用）が同じキーを参照
- `memberRelationships` の呼び出し側でも `source:` が2回定義され、後者の `'cluster-registry'` が優先
- 結果: `sourceEntity` が undefined となり `?entity=chatgpt` フィルタが機能しなかった
- 修正: `knowledgeSource` に改名し duplicate key を解消

#### 検証スコア

```
43/43 ALL PASS
  1. 基本 API 疎通:   8/8
  2. 件数・種別:      7/7
  3. direction:      5/5
  4. chatgpt スポット: 5/5
  5. ?type フィルタ:  3/3
  6. ?status フィルタ: 3/3
  7. 必須フィールド:  11/11
```

---

### 17-8. IA-4b 完了記録（2026-06-29）

**目的**: Entity Page に Knowledge Graph セクションを追加し、Relationship Registry の関係性を UI 表示する  
**ステータス**: ✅ 18/18 ALL PASS

#### 実装内容

**変更ファイル**: `refbase/app/entity/[entityId]/page.tsx`

追加した処理:
1. `RelationshipItem` / `RelationshipRegistry` インターフェース（インライン定義）
2. `REL_TYPE_LABELS` ラベルマップ（5 Relationship タイプ）
3. `kv.get<RelationshipRegistry>('refbase:registry:relationships')` を既存フェッチに並列追加
4. `entityRels` — ACTIVE かつ `sourceEntity === entityId || targetEntity === entityId` でフィルタ
5. "Knowledge Graph" セクション — Relationship がある場合のみ表示（条件レンダリング）

#### 表示仕様

| 要素 | 内容 |
|------|------|
| セクション見出し | "Knowledge Graph" |
| 表示条件 | entityRels.length > 0 のみ表示（0件なら非表示） |
| リンク | memberOfCluster → /cluster/{target}、その他 → /entity/{slug} |
| direction 表示 | directed = `→` or `←`（逆向き）、bidirectional = `↔` |
| confidence バッジ | 各 Relationship に small badge で表示 |
| description | 各 Relationship の説明文を小テキストで表示 |

#### 安全条件確認

- JSON-LD 変更: なし ✅
- Reference Page 変更: なし ✅
- Cluster Page 変更: なし ✅
- llms.txt / sitemap 変更: なし ✅
- KV 書き込み: なし ✅
- AI 呼び出し: なし ✅

#### 検証スコア（本番確認）

```
18/18 ALL PASS
  /entity/chatgpt      : openai / claude-ai / gemini / ai-assistant / cluster/ai-assistant ✅
  /entity/claude-ai    : anthropic / chatgpt / gemini / ai-assistant ✅
  /entity/github-copilot: microsoft / cursor / ai-coding / cluster/ai-coding ✅
  /entity/canva        : adobe / creative-design / cluster/creative-design ✅
  /entity/aisle        : ai-emergence / cluster/ai-emergence ✅
```

---

**RefBase IA v2.0 — 全 Sprint 完了 ✅**

| Sprint | 内容 | ステータス |
|--------|------|---------|
| IA-1a | Cluster Registry KV + read-only API | ✅ 完了 |
| IA-1b | /cluster/{clusterId} ページ新設 | ✅ 完了 |
| IA-1c | TOP ページ Cluster 入口表示 | ✅ 完了 |
| IA-2  | Entity additionalType + Reference citation JSON-LD | ✅ 完了 |
| IA-3  | llms.txt Cluster セクション + sitemap P-ID priority | ✅ 完了 |
| IA-4a | Relationship Registry KV + read-only API | ✅ 完了 |
| IA-4b | Entity Page Relationship 表示 | ✅ 完了 |

---

---

## 18. Platform Roadmap Policy v1.0（2026-06-29 確定）

> **この Policy は Sprint 選択・実装判断・Studio 凍結判断のすべてに優先する。**

### 18-1. 開発の順序原則（Platform → Product → Sprint）

```
Platform（全体の方向性・フェーズ定義）
    ↓
Product（どのプロダクトの何を完成させるか）
    ↓
Sprint（具体的な実装タスク）
```

新しいアイデアが出たとき、先に MASTER_ROADMAP に記録し Product Goal との整合を確認してから実装に進む。
**実装から始めない。**

### 18-2. 新ルール — 新アイデアは MASTER_ROADMAP 先行

| ルール | 内容 |
|--------|------|
| **アイデア → MASTER_ROADMAP** | 新しい機能・仕様案は、まず本 Roadmap に記録してから実装判断を行う |
| **Product Goal 確認先行** | 「このアイデアは現フェーズの Product Goal に寄与するか」を先に確認する |
| **実装なしで記録してよい** | Parking Lot / 保留 に記録することで、記録と実装を分離する |

### 18-3. 4フェーズ構造

| Phase | 名称 | 完了条件 |
|-------|------|---------|
| **Phase 1** | **RefBase Finish** | R1〜R5 完了。RefBase が単独プロダクトとして完成した状態 |
| **Phase 2** | **Aisle Studio Complete** | Studio が 7層アーキテクチャで完全稼働。RefBase との連携確立 |
| **Phase 3** | **Aisle Monitor** | 出現観測フロー（Seed Mode A / B / Test Mode）の実装・稼働 |
| **Phase 4** | **Aisle Scope** | Scope（出現状況の可視化・レポート）の設計・実装 |

現在地: **Phase 1 — RefBase Finish 開始**

### 18-4. Phase 1 — RefBase Finish タスク一覧（2026-06-30 更新）

| ID | タスク | 優先度 | 内容 | 状態 |
|----|--------|:------:|------|------|
| **R1** | **Product Definition Refresh** | 🔴 最高 | サイトのコピー・IA・ポジショニングを「AI Knowledge Infrastructure」思想に更新する。Hero / About / Why / Metadata を全面見直し | ✅ 完了 |
| **R2** | **TOP IA Redesign + /directory 新設** | 高 | TOP を Product Landing に一本化。/directory を独立ページとして新設 | ✅ 完了 |
| **R3** | **Browse by Entity Type** | 高 | /directory に Entity Type 別探索軸を追加。2軸 Directory IA 完成 | ✅ 完了 |
| **R4** | **Relationship Finish** | 中 | Knowledge Graph UI / Relationship 表示 / Relationship JSON-LD をまとめて完成させる。AI がグラフ構造を構造化データから読める状態にする | 🔄 進行中 |
| **R5** | **Reference Finish** | 中 | Reference ページを AI が最も読むページとして完成させる。metadata / OG / JSON-LD / Evidence 表示 / Trust / llms.txt を整合させる | ⏳ 未着手 |

> **Branding（OG 画像・ファビコン・サイト名）は RefBase Finish から除外。**  
> Studio / RefBase / Monitor / Scope の 4 プロダクトが揃った段階で「Platform Branding」として実施する（Phase 4 以降）。

#### RefBase Finish ロードマップ

```
R4 Relationship Finish
    ↓
R5 Reference Finish
    ↓
RefBase Finish Complete → Phase 2（Aisle Studio Complete）へ
```

#### R4 完了条件

- Entity ページの Relationship が UI・JSON-LD・表示の三点セットで完成している
- `competitorOf` / `alternativeTo` / `parentEntity` / `productOf` が schema.org 準拠の JSON-LD で出力されている
- Knowledge Graph セクションが「AI が読む」視点でも「人間が読む」視点でも整合している
- Relationship が存在しない Entity ページで表示が崩れない

#### R5 完了条件

- Reference ページの metadata description が "AI Knowledge Infrastructure" ポジショニングと整合している
- OG title / description が Reference ページとして適切に設定されている
- JSON-LD（FAQPage / citation[]）が完全な状態
- Evidence（sourceEvidence）の表示が信頼性を伝える形になっている
- llms.txt が Reference を適切に表現している

### 18-5. Aisle Studio — 凍結ポリシー

**Studio は Phase 1（RefBase Finish）完了まで凍結する。**

| 対象 | 判断 |
|------|------|
| Critical Bug（本番で動作不能になるもの） | ✅ 対応可 |
| 新機能・UI 改善・リファクタ | ❌ Phase 2 まで保留 |
| 7層アーキテクチャ移行 | ❌ Phase 2 で実施 |

凍結中に出たアイデアは本 Roadmap の Parking Lot（Section 8）に記録する。

---

---

## 19. R1 Product Definition Refresh 完了記録（2026-06-29）

**Sprint**: R1 — Product Definition Refresh  
**ステータス**: ✅ 実装・検証完了（2026-06-29）  
**対象ファイル**: `refbase/app/layout.tsx` / `refbase/app/page.tsx` / `refbase/app/entity/[entityId]/page.tsx` / `refbase/app/cluster/[clusterId]/page.tsx`

### 設計確定事項

| 層 | 表現 | 使用箇所 |
|---|---|---|
| 上位定義 | AI Knowledge Infrastructure | Hero / metadata / OG / footer |
| Browse 導線 | AI Knowledge Directory | TOPページ Clusters セクション見出し |
| Clusters 補足 | Question Clusters（文中残存） | Clusters 導入テキスト・Cluster カード Q. 表示 |
| 廃止 | ~~Reference Layer~~ / ~~AI-Friendly Company Directory~~ | — |

### 実施内容

| ファイル | 変更内容 |
|---------|---------|
| `layout.tsx` | title / description を AI Knowledge Infrastructure ベースに統一 |
| `page.tsx`（TOP） | Hero コピー・CTA・Why RefBase・Structure（5層+KG）・セクション順・AI Knowledge Directory 見出し・JSON-LD 3ブロック・footer |
| `entity/[entityId]/page.tsx` | metadata description / `References — 問い別の知識` / `データアクセス` / footer |
| `cluster/[clusterId]/page.tsx` | metadata description（スラグ文字列廃止）/ 見出し3箇所 / 関連Clusterリンク表示名化 / `getClusterData` リファクタ / footer |

### 変更一覧

**Hero（TOPページ）**
- Before: `RefBase is a reference layer for AI-generated answers.`
- After: `RefBase is an AI Knowledge Infrastructure.`

**サブコピー**
- Before: 「企業・サービスについて、AIが回答時に参照できる問い別の回答・根拠・FAQを構造化して公開する知識基盤です。」
- After: 「企業・サービス・商品に関する知識を、AI が理解・比較・推論・推薦できる形へ構造化する基盤。」

**CTA**（新設）: `Explore AI Knowledge Directory →`（`#knowledge-directory` へのアンカーリンク）

**Why RefBase 行**
- Before: `Designed as a reference layer for AI-generated answers`
- After: `Designed as an AI Knowledge Infrastructure`

**Why RefBase 補足**
- Before: 「生成AIはページ全体を読むのではなく…知識レイヤーです。」
- After: 「引用は手段。目的は…自然に出現できる状態をつくること。Question → Cluster → Entity → Reference → Evidence の5層で…」

**Structure セクション**
- Before: Entity / Reference の2層
- After: Question / Cluster / Entity / Reference / Evidence の5層 + Knowledge Graph（別ブロック）

**セクション順**
- Before: Why → Structure → AI & Machine Access → Clusters → Entities → Footer
- After: Why → Structure → AI Knowledge Directory（Clusters）→ Entities → AI & Machine Access → Footer

**Cluster ページ見出し**

| 旧 | 新 |
|---|---|
| このClusterに集まる問い | このカテゴリに集まる問い |
| 所属 Entity — N件 | 企業・サービス・商品 — N件 |
| 代表 Reference | 代表的な問いと回答 |
| 関連 Cluster（スラグ表示） | 関連 Cluster（表示名表示） |

### 検証結果

| 項目 | 結果 |
|------|------|
| TypeScript エラー | **0** ✅ |
| `next build --webpack` | **14ルート全成功** ✅ |
| コード精査（全 `Reference Layer` / `参照知識Hub` 表現）| 残存なし ✅ |
| JSON-LD（WebSite / Cluster ItemList）新コピーに更新 | ✅ |
| `#knowledge-directory` アンカー整合 | ✅ |
| Cluster 関連リンク表示名化 | ✅ |

### 次のアクション

R2 へ進む。→ 完了（Section 20 参照）

---

## 20. R2 TOP IA Redesign + /directory 新設 完了記録（2026-06-30）

**Sprint**: R2 — TOP IA Redesign + /directory 新設  
**ステータス**: ✅ 実装・検証・本番確認完了（2026-06-30）  
**コミット**: `08c4742`  
**対象ファイル**: `refbase/app/page.tsx`（改修） / `refbase/app/directory/page.tsx`（新規）

### 設計方針（確定）

| 方針 | 内容 |
|------|------|
| TOP の役割 | Product Landing に一本化。知識探索は /directory へ委ねる |
| /directory | 全 Cluster を探索する独立ページ（新設） |
| Featured Clusters | TOP に先頭 6件のみ表示。全件は /directory |
| Entity 全件削除 | Published Entities セクションを TOP から完全削除 |
| KV アクセス | TOP: ClusterRegistry 1回のみ（Entity 全件フェッチ廃止） |

### 実施内容

| ファイル | 変更内容 |
|---------|---------|
| `page.tsx`（TOP） | Entity 全件フェッチ・表示を削除 / Clusters を Featured 6件に縮小 / Hero CTA を `/directory` へ / `View all clusters →` CTA 追加 / Entity ItemList JSON-LD 削除 / Cluster JSON-LD 削除（/directory 側へ移動） |
| `directory/page.tsx`（新規） | `/directory` ページ新設 / 全 Cluster 一覧 / ItemList + WebPage + BreadcrumbList JSON-LD / 将来の Search/Filter/Sort 用プレースホルダー設置 |

### TOPセクション構成変更

| Before | After |
|--------|-------|
| Hero → Why RefBase → Structure → AI Knowledge Directory（全件）→ Published Entities → AI & Machine Access | Hero → Why RefBase → Structure → Featured AI Knowledge Directory（6件）→ AI & Machine Access |

### 検証結果

| 項目 | 結果 |
|------|------|
| TypeScript エラー | **0** ✅ |
| `next build --webpack` | **15ルート全成功**（/directory 追加）✅ |
| TOP: Published Entities 削除 | ✅ |
| TOP: Cluster 全件 → Featured 6件 | ✅（11件中6件表示確認） |
| TOP: Hero CTA → `/directory` | ✅ |
| TOP: `View all clusters →` CTA | ✅ `/directory` 向き |
| TOP: Entity ItemList JSON-LD 削除 | ✅ |
| `/directory` ページ表示 | ✅ h1「AI Knowledge Directory」確認 |
| `/directory`: canonical URL | ✅ `https://www.refbase.ai/directory` |
| `/directory`: 全 Cluster 11件表示 | ✅ |
| `/directory`: 各 Cluster → `/cluster/{slug}` リンク | ✅ 11件全確認 |
| `/cluster/ai-assistant` 破損なし | ✅ |
| `/entity/chatgpt` 破損なし | ✅ |
| `/reference/chatgpt/comparison-001` 破損なし | ✅ |

### Parking Lot（今回対象外）

- Search / Category filter / Sort
- Popular / New
- Cluster category フィールド追加
- Entity / Reference 横断検索
- Featured Knowledge セクション（KV 追加取得を避けるため今回は除外）

### 次のアクション

R3 以降（R3〜R5）の優先順位を MASTER_ROADMAP で整理して決定する。

---

## 21. R3 Browse by Entity Type 完了記録（2026-06-30）

**Sprint**: R3 — /directory Browse by Entity Type 追加  
**ステータス**: ✅ 実装・検証・本番確認完了（2026-06-30）  
**コミット**: `ec7e753`  
**対象ファイル**: `refbase/app/directory/page.tsx`（改修のみ）

### 設計方針（確定）

| 方針 | 内容 |
|------|------|
| 探索軸 | Browse by Cluster（問いから探す）+ Browse by Entity Type（対象から探す）の2軸 |
| 分類フィールド | `entityType`（`RefBaseEntity`の既存フィールド）を使用。`additionalType`（JSON-LD概念）は使わない |
| 表示対象 | 存在するtypeのみ表示。データにないtypeはカード・セクションとも表示しない |
| サブページ | 今回は作らない。`/directory` 内のアンカーで完結（`#entities-company` 等） |
| JSON-LD | WebPage + Cluster ItemList + BreadcrumbListのみ。Entity全件ItemListは追加しない（スケール考慮） |

### 実施内容

| セクション | 内容 |
|-----------|------|
| Browse by Cluster | 見出し・説明文を追加（Cluster一覧は変更なし） |
| Browse by Entity Type（サマリーカード） | Type名 / 説明 / Entity数 / 代表Entity×3 / `View entities →` アンカーCTA |
| Type別Entity一覧（アンカーセクション） | `#entities-{type}` / Entity名 / category / ref数 / `/entity/{id}` リンク |
| Header | 2軸の説明文 + `11 clusters · 31 entities` 表示 |

### 本番確認結果

| 確認項目 | 結果 |
|---------|------|
| Browse by Cluster 表示（11件） | ✅ |
| Browse by Entity Type 表示 | ✅ Companies(13) / Products(11) / People(7) |
| 存在しないtypeは非表示 | ✅（service / organization / concept / other は非表示） |
| Typeカードのアンカーリンク | ✅ `#entities-company` / `#entities-product` / `#entities-person` |
| Type別Entity一覧 | ✅ 3セクション |
| Entity → `/entity/{id}` リンク | ✅（openai / chatgpt / sam-altman 等で確認） |
| JSON-LD（3種類のみ） | ✅ Entity全件ItemListなし |
| TOP（破損なし） | ✅ |
| `/cluster/ai-assistant`（破損なし） | ✅ |
| `/entity/shopify`（破損なし） | ✅ |

### KVアクセス構成（現在）

```
ClusterRegistry   : 1回（kv.get）
refbase:index:all : 1回（getGlobalIndex）
Entity本体        : N回 並行（getEntity × 31）
EntityIndex       : N回 並行（getEntityIndex × 31）
合計              : 2 + 2N = 64回（31 Entity時点）
```

スケール問題は別途 Entity Summary Registry で解決予定（Section 22参照）。

---

## 22. Studio Publish → RefBase Directory 連携設計メモ（2026-06-30 確定）

> **実装はR3対象外。将来のStudio連携フェーズで参照する設計資産として記録する。**

---

### Directory への反映ルール（確定）

Aisle StudioがEntityをPublishしたとき、RefBase Directoryに以下のように反映される。

| Studioから送るデータ | RefBase側の反映先 |
|-------------------|----------------|
| `entityType = "company"` | `/directory` Browse by Entity Type → Companies に出る |
| `entityType = "product"` | `/directory` Browse by Entity Type → Products に出る |
| `entityType = "person"` | `/directory` Browse by Entity Type → People に出る |
| `primaryCluster = "ai-assistant"` | ClusterRegistryの`entitySlugs[]`に追加 → Browse by Clusterに出る |
| `secondaryClusters[]` | 副Clusterにも同様に反映 |
| Reference（1件以上） | `/entity/{id}` ページ / `/reference/{id}/{refId}` ページ / llms.txt / sitemap に出る |
| Evidence（sourceEvidence） | `/reference` ページ内のEvidence表示に出る |

### Studio側で必須化すべき項目（推奨）

現在 `RefBaseEntity.entityType` はオプション（`?`付き）だが、Directory IA上は事実上必須。

| フィールド | 現状 | 推奨 | 理由 |
|-----------|------|------|------|
| `entityType` | `EntityType?`（省略可・default: company） | **必須化** | Browse by Entity Typeの正確な分類。未設定は全件companyに入り誤分類が起きる |
| `primaryCluster` | なし（ClusterRegistry側のみ） | **必須化** | Browse by Clusterへの反映に必要。現在はAdmin側でClusterRegistryを手動更新している |
| `category` | 必須（現行） | 維持 | Entity cardの説明文として使用中 |
| `name` | 必須（現行） | 維持 | — |

### Studio → RefBase Publish Schema（将来設計）

StudioからRefBaseへのPublishに必要な最小データセット:

```typescript
interface RefBasePublishPayload {
  // Entity（必須）
  entity: {
    id: string;                     // entityId・URL構成要素
    name: string;
    category: string;
    entityType: EntityType;         // 必須化推奨（現在はoptional）
    primaryCluster: string;         // 必須化推奨（現在はClusterRegistry側のみ）
    secondaryClusters?: string[];
    externalLinks?: Array<{ type: string; url: string }>;
  };

  // Reference（0件以上）
  references: Array<{
    id: string;
    promptText: string;
    promptTypeId: string;           // P-01〜P-06
    answer: string;
    evidencePoints: string[];
    scope: string;
    differentiation: string;
    faq: Array<{ question: string; answer: string }>;
    sourceEvidence: SourceEvidence[];
  }>;
}
```

**現在の課題**: `primaryCluster` はEntityのKV（`refbase:company:{id}`）ではなく、ClusterRegistry（`refbase:registry:clusters`）の `entitySlugs[]` で管理されている。PublishフローでEntityとClusterの紐付けを一元化するには、いずれかの方針を選択する必要がある:

- **案A**: Entity KVに`primaryCluster`フィールドを追加し、RefBase側がEntityのprimaryClusterを読んでClusterRegistryを自動更新する
- **案B**: Studio PublishがClusterRegistryも同時に更新する
- **案C**: 現行通りAdmin側でClusterRegistryを手動管理する（今はこれ）

---

### Entity Summary Registry 構想（スケール対応）

**問題**: 現在の`/directory`は、全EntityのKVを個別取得する設計（2 + 2N回）。1,000 Entity超で実用的な応答速度を保てなくなる。

**解決策**: ClusterRegistryと対称的な **Entity Summary Registry** を導入する。

```
KVキー: refbase:registry:entities
型:     EntitySummaryRegistry { version, updatedAt, items: EntitySummaryItem[] }

interface EntitySummaryItem {
  id: string;
  name: string;
  category: string;
  entityType: EntityType;
  primaryCluster: string;
  refCount: number;        // Referenceの件数
  updatedAt: string;
}
```

**導入後のKVアクセス**:

```
/directory のKVアクセス:
  Before: ClusterRegistry(1) + indexAll(1) + Entity×N + EntityIndex×N = 2 + 2N
  After:  ClusterRegistry(1) + EntityRegistry(1) = 2回（Entity数に依存しない）
```

**更新タイミング**:
- Studio → RefBase Publishのたびに `refbase:registry:entities` をupsert
- `refCount` はReference追加・削除のたびに更新

**移行タイミングの目安**: 1,000 Entity超で個別KV取得からRegistry取得へ移行する。それ以下の規模では現行設計で十分。

---

### Parking Lot（今回対象外）

| 項目 | 理由 |
|------|------|
| `/directory/companies` 等のサブページ | Entity数が少ない今は過剰設計 |
| Search | 1,000 Entity超で外部検索インデックス（Algolia等）と合わせて設計 |
| Sort（Reference数順 / 追加順） | Entity Summary Registryが前提 |
| Popular / New | 観測Layer（Observation Layer）との連携が前提 |
| Reference横断検索 | Phase 3（100,000 Reference規模）で設計 |
| P-ID Filter | Directory IA Phase 3以降 |
| Category フィールド追加 | Clusterの細分化が必要になった段階で検討 |

---

---

## 23. R4 Relationship Finish 完了記録（2026-06-30）

**Sprint**: R4 — Relationship Finish  
**ステータス**: ✅ 実装・検証・本番確認完了（2026-06-30）  
**コミット**: `f7c36b5`  
**対象ファイル**: `refbase/app/entity/[entityId]/page.tsx`（改修のみ）

### 設計方針（確定）

| 方針 | 内容 |
|------|------|
| Knowledge Graph UI | Relationship Type ごとにグループ化（Competitors / Alternatives / Parent Organization / Subsidiaries / Part of / Products） |
| Entity 名表示 | counterSlug → counter-Entity の正式名を並行取得（getEntity × N）して表示 |
| memberOfCluster | Knowledge Graph から除外。Entity ヘッダーの Cluster バッジに移動 |
| Cluster バッジ | primaryCluster（emerald）+ secondaryClusters（gray）を Entity ヘッダーに表示。複数 Cluster に対応 |
| confidence バッジ | 公開 UI から削除（Studio 内部用） |
| Breadcrumb | RefBase / {Entity名} のまま維持（将来の複数 Cluster 所属に対応するため Cluster を含めない） |
| Relationship JSON-LD | schema.org で表現できる 3 プロパティのみ追加（competitor / parentOrganization / isPartOf） |
| 独自 JSON-LD プロパティ | 追加しない（alternativeTo は UI のみ・JSON-LD には出力しない） |

### 実施内容

| 変更 | 内容 |
|------|------|
| Entity ヘッダー | primaryCluster / secondaryClusters バッジ追加（各 `/cluster/{slug}` リンク付き） |
| Knowledge Graph UI | Type 別グループ表示 / slug → 正式名 / confidence 非表示 / memberOfCluster 除外 |
| counter-Entity 取得 | `getEntity()` を非クラスター Relationship 分だけ並行取得（KV +N 回） |
| Relationship JSON-LD | orgLd に `competitor` / `parentOrganization` / `isPartOf` を条件付き追加 |
| KV 変更 | なし（読み取りのみ） |

### 本番確認結果

| 確認項目 | 結果 |
|---------|------|
| Entity ヘッダーに Cluster バッジ表示（`/entity/chatgpt` → AI Assistant） | ✅ |
| Cluster バッジが `/cluster/{slug}` へリンク | ✅ |
| Breadcrumb が `RefBase / ChatGPT` のみ（Cluster なし） | ✅ |
| Knowledge Graph がグループ表示（Competitors / Alternatives / Parent Organization） | ✅ |
| Knowledge Graph に正式名表示（Claude / Gemini 等、slug でない） | ✅ |
| confidence バッジ非表示 | ✅ |
| memberOfCluster が Knowledge Graph に出ない | ✅ |
| `/entity/openai`: Subsidiaries（ChatGPT）/ Products（ChatGPT）表示 | ✅ |
| `/entity/aisle`: Knowledge Graph 非表示 / Cluster バッジ ✅ / References ✅ | ✅ |
| Breadcrumb に Cluster が含まれない（全ページ） | ✅ |
| Knowledge Graph がナビゲーションとして機能（関連 Entity へのリンク） | ✅ |
| schema.org 外の独自 JSON-LD プロパティが追加されていない（コード確認済み） | ✅ |
| Relationship のない Entity でページが自然に表示される | ✅ |
| TOP / Cluster / Reference ページ 破損なし | ✅ |
| TypeScript 0 エラー / build 15 ルート全成功 | ✅ |

### 設計メモ

**OpenAI の Subsidiaries と Products 両方に ChatGPT が表示される件**:  
Relationship Registry に `parentEntity`（chatgpt → openai）と `productOf`（chatgpt → openai）の両方が登録されているためで、実装の挙動は正しい。Relationship データとして親子と製品所属を別概念で管理している設計を反映している。データ側での整理が必要な場合は Relationship Registry の更新で対応（コード変更不要）。

**JSON-LD の Relationship カバレッジ**:

| relationshipType | UI 表示 | JSON-LD |
|-----------------|:-------:|:-------:|
| competitorOf | ✅ Competitors | ✅ `competitor` |
| alternativeTo | ✅ Alternatives | ❌（schema.org 対応なし・意図的除外） |
| parentEntity | ✅ Parent Organization / Subsidiaries | ✅ `parentOrganization` |
| productOf | ✅ Part of / Products | ✅ `isPartOf` |
| memberOfCluster | ✅ Cluster バッジ | ✅ `additionalType`（既存） |

### 次のアクション

→ **R5 Reference Finish** へ進む。

---

## 24. R5 Reference Finish 完了記録（2026-06-30）

**Sprint**: R5 — Reference Finish  
**ステータス**: ✅ 実装・検証・本番確認完了（2026-06-30）  
**コミット**: `cf2b2d7`  
**対象ファイル**:
- `refbase/app/reference/[entityId]/[referenceId]/page.tsx`（改修）
- `refbase/app/llms.txt/route.ts`（2行変更）

### 設計方針（確定）

| 方針 | 内容 |
|------|------|
| P-ID バッジ | h1 の上に `{P-ID}` + P-ID ラベルテキストを表示（IA-2c 実装） |
| twitter card | `summary_large_image` を metadata に追加 |
| JSON-LD `url` | FAQPage に `url`（canonical URL）を追加 |
| JSON-LD `about.@id` | `about` に `@id`（Entity URL）を追加 |
| JSON-LD `description` | `answer.slice(0, 300)` に短縮（SEO 最適化） |
| JSON-LD schemaType | `entity.entityType` から動的に `Organization / Service / Product / Person` 等に変換 |
| sourceType ラベル | 「Official / Company / Third-party / Community / Source」のサブタイルなグレーバッジ |
| バッジスタイル | `border-gray-200 text-gray-400 bg-white`（色なし・ミニマル） |
| データ取得 | `getAllReferences()` で全 Reference を一括取得（`getReference` + `getEntityIndex` コンボを廃止） |
| 他のReference | `r.id`（referenceId）ではなく `r.promptText` を表示 |
| Footer | 「RefBase — AI Knowledge Infrastructure」に統一 |
| Footer URL | `canonicalUrl`（現在ページの正規 URL）を mono gray で表示 |
| llms.txt タイトル | "AI Reference Knowledge Base" → "AI Knowledge Infrastructure" |
| llms.txt About | AI Knowledge Infrastructure としての説明文に更新 |

### 実施内容

| 変更 | 内容 |
|------|------|
| P-ID バッジ | `pidClass()` ヘルパー + `PID_LABELS` / `PID_COLORS` を使用して h1 上に表示 |
| twitter card | `generateMetadata` の return に `twitter: { card, title, description }` 追加 |
| JSON-LD | `url` / `about.@id` / `schemaType` 動的変換 / `description` 300文字 |
| SOURCE_TYPE_CONFIG | sourceType → `{label, linkText}` のマッピング定数を追加 |
| sourceEvidence 表示 | 各 Evidence に `cfg.label` バッジ（subtle gray）を追加 |
| データ取得 | `getAllReferences(entityId)` に統一 / `allReferences.find()` で current reference を取得 |
| otherRefs | `r.promptText` を `<a>` テキストとして表示 |
| footer | "AI Knowledge Infrastructure" に統一 / `canonicalUrl` を mono gray で表示 |
| llms.txt | title 行・About 2行を更新 |

### 本番確認結果（`/reference/canva/comparison-001`）

| 確認項目 | 結果 |
|---------|------|
| P-ID バッジ表示（h1 上に `P-02` + `比較・選定候補提示`） | ✅ |
| sourceType ラベル（subtle gray / "Official" 表示） | ✅ |
| footer が "RefBase — AI Knowledge Infrastructure" | ✅ |
| 他の Reference が `promptText` で表示（referenceId でない） | ✅ |
| footer URL が `canonicalUrl`（現在ページ URL / legacy `pageUrl` フィールドでない） | ✅ |
| llms.txt タイトル "AI Knowledge Infrastructure" | ✅（キャッシュ後確認） |

### 設計メモ

**footer URL について**:  
`canonicalUrl = https://www.refbase.ai/reference/{entityId}/{referenceId}` を footer に表示。旧 `reference.pageUrl` フィールドの表示ではない。Entity / Cluster ページと同じパターン（canonical URL を mono gray で表示）に統一したもの。

**SOURCE_TYPE_CONFIG**:  
`official_site` / `pdf` → `Official`、`note` → `Company`、`media` → `Third-party`、`sns` → `Community`、`manual` / `other` → `Source`。色分けは行わず、border のみの subtle なバッジ。

**llms.txt キャッシュ**:  
WebFetch の 15 分キャッシュにより、実装直後は旧コンテンツが返ることがある。Vercel デプロイ完了後のキャッシュクリア後に確認。

### 次のアクション

→ **RefBase Finish 完了**。Phase 2（Aisle Studio Complete）へ移行。

---

## 30. Phase 2 — Aisle Studio Complete：S0〜S3 完了記録（2026-06-30）

**前提**: RefBase Finish（R1〜R5）完了後、Phase 2 を以下のサブフェーズに分解して進行した。

```
S0 Product Audit → S1 Product Definition → S2 IA/UX Design → S2.5 Screen Flow Review
  → S3 Authoring Engine（実装）→ S4 Authoring Workbench UI（次フェーズ）
```

### S0 — Studio Product Audit

現行 Studio（Phase0〜5 + Admin）の棚卸し。「出現設計ツール」という定義が Knowledge Authoring Platform 思想とズレていることを確認。Must/Should/Could/Parking Lot に分類。

**重要な訂正**：棚卸し時点では「Coverage Panel / Evidence Manager は未実装」としていたが、実際には Sprint 3.5B/3.5C で実装済み（`AdminPage.tsx` 内タブとして統合済み）だったことが S2 設計時に判明。MASTER_ROADMAP の「未実装」表記は誤りだったため、本記録で訂正する。

### S1 — Studio Product Definition

Studio を「出現設計ツール」から「**Knowledge Authoring Platform**」として再定義。

- 成果物 = **Publishable Knowledge**（Knowledge → Quality Verified Knowledge → Publishable Knowledge → RefBase の段階を経たもの）
- Authoring Journey（6ステップ）: Understand → Structure → Evidence → Generate → Validate → Publish
- Platform全体循環: Monitor（観測）→ Studio（製造・検証）→ RefBase（公開）→ Monitor（観測）

### Knowledge Object Model v1.0

Studioが扱う7 Knowledge Object（Entity / Cluster / Relationship / Evidence / QuestionTemplate / QuestionInstance / Reference）を「発見・設計・育成される対象」として定義。Coverage はRuntime判定結果でありKnowledge Objectではないことを明確化。無名企業・スタートアップでも成立する設計（DP-001 Unknown Entity Test）を前提とした。

### S2 / S2.5 — IA・UX設計・Screen Flow Review

6ステップを画面に対応付け。Entity Workspace（新設）/ Evidence Workbench（既存Coverage Panel・Evidence Managerを移設＋投入UI新設）/ Authoring Workbench（新設・Generate/Validate/Publish 3タブ）の構成を確定。`page-generate.ts` のGenerate/Validate/Publish混在（TD-005の核心）を、画面とAPIの両面で分離する方針を確定した。

### Knowledge Object Lifecycle 修正（実装直前の重要な設計修正）

当初の `ReferenceDraft` という1型ですべてを表現する設計を破棄し、以下のライフサイクルへ修正：

```
Question Instance（独立Object・1:N）
  → Draft（複数LLM・複数試行を許容）
  → Validated Draft（schema/citation/coverage検証通過。まだ非公開）
  → Reference（採用されたValidated Draftから合成される最終成果物）
  → Publish（RefBase KV保存）
```

ReferenceにinstanceId / draftIdを持たせ、どの問い・どの生成からReferenceが生まれたかを追跡可能にした。

### S3 — Authoring Engine 実装（S3-1〜S3-5・全完了）

| Sub-Sprint | 内容 | 状態 |
|-----------|------|------|
| S3-1 | `api/_draft-types.ts`（共有型）+ `api/qi-resolve.ts`（Coverage Gate + QI解決。QIのみKV保存）+ `api/draft-generate.ts`（Claude生成。KV保存なし。1リクエスト=1 Draft試行・attemptNumber対応） | ✅ |
| S3-2 | `api/draft-validate.ts`（responseSchema sections・citationRequired・Coverage整合の3点検証。KV/AI呼び出しなし・純粋関数） | ✅ |
| S3-3 | `api/draft-publish.ts`（Draft+ValidatedDraft→Reference合成。RefBase KV保存はこのAPIのみで発生。5ガード実装） | ✅ |
| S3-4 | API Integration Test（`scripts/verify-s3-4-draft-chain.mjs`）。テストEntity `test-s34-draftchain` で qi-resolve→draft-generate→draft-validate→draft-publish のチェーンを本番で実行・検証 | ✅ 27/27 PASS |
| S3-5 | Auth Guard追加。4 API全てに `isAuthorized()`（`x-aisle-admin` ヘッダー or `Bearer EM_SHARED_SECRET`）を追加。S3-4実装時点では認証なしだった欠落を解消 | ✅ |

**draft-publish の5ガード**：
1. `validatedDraft.ok !== true` → 400・保存しない
2. `validatedDraft.draftId !== draft.draftId` → 400・保存しない
3. 必須フィールド不足 → 400・保存しない
4. questionSlug衝突をPublish時点で再確認（Draftはslugを保持しない設計のため必然的にPublish時一発確定）
5. RefBase KVへの書き込みはdraft-publishのみで発生（qi-resolveはQIキーのみ、draft-generate/draft-validateはKV書き込みなし）

**page-generate.ts の扱い**：レガシー一括投入用として維持。冒頭にコメントを追加した以外、ロジック変更なし。

**コミット**：
```
59b3b00  feat: add Authoring Engine APIs (qi-resolve / draft-generate / draft-validate / draft-publish)
0f4d4af  feat: add auth guard to Authoring Engine APIs (S3-5)
```

**テストEntity後始末（2026-06-30）**：`test-s34-draftchain` および関連Reference（recommendation-001/002）・QI（`refbase:qi:test-s34-draftchain:P-01`）・index類を全削除。`entity-delete.ts` API + 直接KV削除（QIキーはentity-delete.tsの削除対象外だったため手動削除）で実施。削除後、`/reference/test-s34-draftchain/*` 404・`/entity/test-s34-draftchain` 404・`/directory`/`llms.txt` 非掲載・`refbase-get` で `company: null` を確認済み。

**既知の技術的負債（新規）**：
- `api/entity-delete.ts` は `refbase:qi:{slug}:{promptTypeId}` キーを削除対象に含んでいない（QI Sprintより後に追加されたキーのため）。将来Entity削除運用が増える前に対応が必要。

### 次のアクション

→ **S4 Authoring Workbench UI** の設計レビューへ進む。

---

## 31. S4 Authoring Workbench UI 完了記録（2026-06-30）

### 実装内容

| ファイル | 内容 |
|---------|------|
| `src/types/authoring.ts` | フロント側の共有型（`api/_draft-types.ts`のミラー。後述の理由により`src/types/index.ts`に依存しない自己完結設計） |
| `src/lib/authoringApi.ts` | 4 API共通fetchラッパー。`x-aisle-admin`ヘッダー付与・401を`AuthoringApiError`として判別 |
| `src/components/AuthoringWorkbench.tsx` | Generate/Validate/Publish 3タブのメイン画面。`Phase4Implementation.tsx`とは完全独立 |
| `src/components/Sidebar.tsx` / `src/App.tsx` | `/authoring`ルート追加（`/admin`と同パターン。最小差分） |
| `vercel.json` | `/authoring`の明示的rewrite追加（汎用`/:slug`ルールに飲み込まれるバグを防止） |

**S4スコープ**：既存EntityでGenerate→Validate→Publishの一連操作をUIから実行できること。Entity新規作成・Evidence投入・Relationship編集は対象外。

### 重大インシデント：本番デプロイ失敗と原因究明（2026-06-30）

S4初回push（`1045b76`）はVercelビルドが**失敗**（9秒でエラー終了）。ローカル`tsc -b`は成功していたため発覚が遅れた。

**根本原因**：`src/types/authoring.ts`が`src/types/index.ts`の`CoverageType`/`ResponseSchema`をimportしていたが、**`index.ts`自体が当時未コミット**（Sprint 1/1.5 Architecture Foundation由来）だった。ローカル作業ディレクトリには未コミットファイルが残っていたため`tsc -b`が誤って成功し、Vercelのクリーンclone環境では該当exportが存在せず`TS2305`でビルドが落ちた。

**調査手法**：`npx vercel ls` / `npx vercel inspect --logs`でVercel CLIから直接ビルドログを取得し、エラーメッセージを特定。さらにcommitted treeのみをscratchpadへ`git clone`し、`npm install && npm run build`をVercelと同条件で再現・検証してから修正を確定させた（以後の全コミットでこの「クリーンclone事前検証」を踏襲）。

**修正**：`authoring.ts`を`index.ts`に依存しない自己完結型に変更（`CoverageType`/`ResponseSchema`/`AuthoringEvidenceItem`をファイル内に複製。`api/_draft-types.ts`と同じ「tsconfig境界をまたぐ複製」方針を踏襲）。コミット`6b57788`で解消・本番反映確認済み。

### 副次的発見：Coverage Panel / Evidence Manager も本番未デプロイだった

調査の過程で、`src/types/index.ts`に依存する`CoveragePanel.tsx` / `EvidenceManager.tsx`（Sprint 3.5B/3.5C実装）も**一度もコミットされておらず、本番に存在しなかった**ことが判明。Section 32で棚卸し・対応済み。

### 検証結果（S4・修正後）

| 項目 | 結果 |
|------|------|
| クリーンclone環境でのbuild | ✅（Vercel同条件で事前検証） |
| `/authoring`本番アクセス | ✅ HTTP 200 |
| 既存Entityでの qi-resolve→draft-generate→draft-validate→draft-publish | ✅ APIチェーン27/27 PASS（テストEntityで実施・削除済み） |
| 既存Phase0〜5 | ✅ 影響なし |
| `page-generate.ts` | ✅ 変更なし |

### コミット

```
1045b76  feat: add Authoring Workbench UI (S4)                       ← ビルド失敗
6b57788  fix: make src/types/authoring.ts self-contained             ← 修正・デプロイ成功
```

---

## 32. Coverage Panel / Evidence Manager 未デプロイ積み残し 棚卸し・対応記録（2026-06-30）

### 棚卸し結果サマリー

S4のビルド障害調査の過程で、`src/types/index.ts`の未コミット差分（110行・純粋追加のみ）に、`CoveragePanel.tsx` / `EvidenceManager.tsx`（Sprint 3.5B/3.5C実装）を含む複数の未コミットファイルが依存していることが判明。本番に一度もデプロイされていなかった。

| 確認observation | 結果 |
|------|------|
| `index.ts`差分の性質 | 純粋追加（`RegistryEnvelope` / `CoverageType` / `SourceClass` / `ResponseSchema` / `QuestionTemplate` / `QuestionInstance` + `EvidenceItem`への後方互換フィールド）。既存フィールド変更なし |
| 設計上の必要性 | 必要。Architecture v1.0 / Knowledge Object Model v1.0の中核概念と完全整合 |
| Coverage Panel/Evidence Managerの配置 | S2.5で「将来AdminPageから独立させ、Authoring JourneyのEvidenceステップへ移設」と設計済み。現状はAdminPageタブのまま。**意図的な先送りであり矛盾ではない** |
| 孤立ファイル | `src/lib/coverageEngine.ts` / `src/lib/questionResolver.ts` / `api/qi-get.ts` の3ファイルはフロントのどこからも参照されていない（API側はインライン実装が正本のため、src/lib側は未配線のまま） |

### 対応（案A採用）

**コミット対象（6ファイルのみ）**：
```
src/types/index.ts
src/components/AdminPage.tsx
src/components/CoveragePanel.tsx
src/components/EvidenceManager.tsx
api/coverage-report.ts
api/evidence-manager.ts
```

**除外（Parking Lotへ）**：`src/lib/coverageEngine.ts` / `src/lib/questionResolver.ts` / `api/qi-get.ts`。実行経路が不明な孤立ファイルのため、今回はコミットせず技術的負債として記録（PL-008、後述）。

### 検証結果

| 項目 | 結果 |
|------|------|
| クリーンclone環境でのbuild | ✅（コミット前にVercel同条件で事前検証） |
| Vercelデプロイ（`1f860c3`） | ✅ Ready（`npx vercel ls`で直接確認） |
| `/admin`アクセス | ✅ HTTP 200 |
| 本番バンドルに"Coverage Panel"/"Evidence Manager"文字列 | ✅ 各1件確認 |
| `coverage-report` / `evidence-manager` 認証なし | ✅ 401 |
| `coverage-report` / `evidence-manager` 認証あり（`x-aisle-admin: 1`） | ✅ 200 |
| 既存`/`・`/authoring`・S3-4 APIチェーン | ✅ 影響なし（27/27 PASS） |

### コミット

```
1f860c3  feat: deploy Coverage Panel / Evidence Manager (Sprint 3.5B/3.5C catch-up)
```

### Parking Lot追加

| ID | 内容 | 追加日 |
|----|------|--------|
| PL-008 | `src/lib/coverageEngine.ts` / `src/lib/questionResolver.ts` / `api/qi-get.ts` の扱い未決定（コミットして将来配線するか、削除するか）。API側のインライン実装と重複しており、src/lib側を使う設計意図があったかどうかを次回確認の上で判断する | 2026-06-30 |
| PL-009 | Coverage Panel / Evidence ManagerをAdminPageから独立させ、Authoring WorkbenchのEvidenceステップへ統合する（S2.5設計の実行）。S4スコープ外として先送り済み | 2026-06-30 |

---

## 33. 運用ルール — Sprint完了時の必須手順（2026-06-30 確定）

> **このルールは今後の全Sprintに適用する。S4でのビルド失敗（未コミット依存に気づかずpushし、本番が壊れた状態を見逃しかけた）を踏まえて制定する。**

実装作業が完了し、ユーザーが次のSprintへ進む許可を出す前に、必ず以下を順番に実施する。

```
1. git status 確認
   → 変更ファイルの全体像を把握する（意図したファイル以外が紛れていないか）

2. 変更ファイルのスコープ確認
   → 今回のSprintで触ってよいファイルだけが対象になっているか
   → 他セッション由来の未コミット差分（混入リスク）がないか確認する

3. commit対象の明示
   → どのファイルをコミットするか・しないかをユーザーに明示してから実行する
   → 含めないファイルがある場合は理由を記録する

4. commit

5. push

6. 本番デプロイ確認
   → curlでの間接確認だけに頼らない。ビルドが失敗していても旧バンドルが
     残ったまま200を返すため、curlポーリングだけでは検知できない
   → `npx vercel ls` / `npx vercel inspect --logs` でビルドステータスを
     直接確認する（Ready / Error を実際に見る）
   → Errorの場合はログを取得し、原因を特定してから再修正・再pushする

7. 本番動作確認
   → 対象機能が実際に動作することを本番URLで確認する
   → 認証が絡む場合は「認証なし→401」「認証あり→200」の両方を確認する
   → 既存の壊れていないことの確認（回帰確認）も毎回行う

8. MASTER_ROADMAP更新
   → 実施内容・検証結果・コミットハッシュを記録する
   → 新たに見つかった技術的負債・Parking Lot項目があれば追記する
```

**教訓**：ローカルの`tsc -b`成功は、未コミットファイルが作業ディレクトリに残っている場合に誤った安心感を与える。**コミット前にクリーンcloneでのビルド検証を行うことが望ましい**（scratchpad等へ`git clone`して`npm install && npm run build`を実行する）。これは特に「他ファイルへの新規依存を追加した」変更で重要になる。

### 次のアクション

→ Phase 2完了判定、またはS5以降の計画策定へ進む。

---

## 34. Phase 2完了判定レビュー（2026-06-30）

S0〜S4・Coverage/Evidence本番反映を踏まえて完了判定を実施。結論：**Must未消化（M-05 Relationship Editor UI）が残るため、この時点では正式完了ではなく「ほぼ完了」と判定。**

### 観点別状況

| 観点 | 状態 |
|------|------|
| S0 Product Audit | ✅ 完了（棚卸し誤りは事後訂正済み） |
| S1 Product Definition | ✅ 完了 |
| Knowledge Object Model | ✅ 完了（実装直前にDraft/ValidatedDraft/Reference分離の修正あり） |
| S2 IA/UX・S2.5 Screen Flow | ✅ 完了 |
| S3 Authoring Engine API | ✅ 完了（qi-resolve/draft-generate/draft-validate/draft-publish + 認証ガード） |
| S4 Authoring Workbench UI | ✅ 完了（初回ビルド失敗から復旧） |
| Coverage Panel/Evidence Manager本番反映 | ✅ 完了（Section 32） |
| Must（M-01〜M-05） | M-01〜M-04 ✅ / **M-05 未着手** |

### 完了前の残タスク（優先順位確定）

1. M-05 Relationship Editor UI
2. 未追跡ドキュメント4件（`CHANGELOG.md` / `COVERAGE_POLICY_V1.md` / `STUDIO_UX_SEPARATION_REPORT.md` / `UI_UX_RECONCILIATION_REPORT.md`）の内容確認
3. PL-008（孤立3ファイルの扱い）判断

S-03/S-04/S-05・Could群はPhase 2完了のブロッカーにしない。Phase 3（Aisle Monitor）は上記3点の処理後に着手判断する。

---

## 35. M-05 Relationship Editor UI 完了記録（2026-06-30）

### 設計方針（確定）

| 方針 | 内容 |
|------|------|
| 対象relationshipType | `parentEntity` / `productOf` / `competitorOf` / `alternativeTo` の4種のみ（RefBase側が表示・JSON-LD化済みの種類に限定） |
| 対象外 | `memberOfCluster`（primaryCluster/secondaryClustersとの二重管理回避）、R-01〜R-22未実装17種、Entity Workspace統合、RefBase側表示ロジック変更 |
| direction | relationshipType選択時に自動決定（ユーザーに選択させない誤入力防止） |
| 削除 | 物理削除ではなく`status: 'DEPRECATED'`化 |
| relationshipId採番 | Write直前にRegistryを再取得して最大値を再確認してから採番（draft-publishのquestionSlug確定と同パターン。同時実行対策） |
| 配置 | AdminPageへ新規タブとして追加（Coverage Panel/Evidence Managerと同パターン。Entity Workspaceへの統合は将来タスク） |

### 実装内容

| ファイル | 内容 |
|---------|------|
| `api/relationship-manager.ts` | GET（entity別取得）+ POST（create/update/delete）。`isAuthorized()`ガード。type allowlist・自己参照拒否・存在しないEntity拒否の3ガード |
| `src/components/RelationshipEditor.tsx` | 読み込み・新規登録・DEPRECATED化のUI |
| `src/components/AdminPage.tsx` | 「Relationship Editor」タブ追加（最小差分） |

### 検証結果（本番）

| 項目 | 結果 |
|------|------|
| クリーンclone環境でのbuild | ✅（コミット前に実施） |
| Vercelデプロイ（`1bfd156`） | ✅ Ready（`npx vercel ls`で確認） |
| 認証なし→401（GET/POST） | ✅ |
| 認証あり→GET正常応答 | ✅ |
| create正常系 | ✅（`REL-057`採番。既存最大`REL-056`+1で正しく動作） |
| update（confidence変更） | ✅ |
| delete | ✅ 物理削除ではなく`status: 'DEPRECATED'`化を確認（GET再取得でも残存） |
| `memberOfCluster`作成拒否 | ✅ |
| 未対応type（`foundedBy`）拒否 | ✅ |
| 自己参照拒否 | ✅ |
| 存在しないEntity拒否 | ✅ |
| AdminPageにタブ表示 | ✅ 本番バンドルに"Relationship Editor"文字列確認 |
| 既存`/`・`/admin`・`/authoring` | ✅ 影響なし |
| Coverage/Evidence API | ✅ 影響なし |
| S3-4 APIチェーン | ✅ 27/27 PASS継続 |

### インシデント：curl経由の文字化け（API側の問題ではない）

検証中、Windows git-bashから`curl -d '...'`でJapanese文字列を直接渡すと文字化けする事象が発生（`REL-057`のdescriptionが化けて保存された）。UTF-8ファイル経由で同じリクエストを送ると正常に保存されることを確認し、**シェル側の引数エンコード問題であり`api/relationship-manager.ts`自体には問題がないことを切り分け済み**。化けたテストレコードは`DEPRECATED`化して後始末済み。今後同様の検証では`--data-binary @file.json`（UTF-8ファイル）を使うこと。

### テストデータ後始末

`aisle-test-rel-a` / `aisle-test-rel-b`（Entity）・`REL-057`/`REL-058`（Relationship、DEPRECATED化）・`test-s34-draftchain`（S3-4テストEntity再利用分）をすべて削除・後始末済み。

### コミット

```
1bfd156  feat: add Relationship Editor UI (S5 / M-05)
```

### 次のアクション

→ Phase 2完了前の残タスク②（未追跡ドキュメント4件の内容確認）へ進む。

---

## 36. 未追跡ドキュメント4件 棚卸し・コミット記録（2026-06-30）

Phase 2完了前の残タスク②。2026-06-29（S0着手前日）に作成されたまま一度もコミットされていなかった4ファイルを棚卸しし、全件コミット対象と判定した。

### 棚卸し結果

| ファイル | 内容 | Phase 2完了判定への影響 | 判定 |
|---------|------|----------------------|------|
| `CHANGELOG.md` | Ver1.5〜3.3（2026-06-11付近）の実装変更履歴 | なし。CLAUDE.md Section 16〜18に同内容がより詳細に記載済み | コミット（価値は低いが実害なし） |
| `COVERAGE_POLICY_V1.md` | CoverageType判定基準の完全版（境界ケース・誤付与パターン・Unknown Entity Test 3ケース・Entity別推奨対応）。CLAUDE.md Section 29は本ファイルの要約 | なし | コミット（**Evidence Classification Policy v1.0の原本**。Evidence Manager運用の判断基準として今後も使用） |
| `STUDIO_UX_SEPARATION_REPORT.md` | Diagnosis Mode / Knowledge Design Mode分離設計。Coverage Panel/Evidence Manager/Relationship Manager/Quality Audit/Publishing Statusの実装根拠 | なし（提案のP0/P1項目はS0〜S5で実現済み） | コミット（実装の設計根拠として保存） |
| `UI_UX_RECONCILIATION_REPORT.md` | Architecture概念とStudio UIのギャップ総棚卸し。S0棚卸しの先行版。K-ID/M-ID/C-ID/A-ID/E-IDの維持・廃止判定を含む | なし（P0-1〜P0-4はS0〜S5で解消済み） | コミット（ID体系整理の参照資料として保存） |

**結論**：4ファイルとも新たなMust級ブロッカーは含まない。Phase 2完了判定は変わらず「M-05完了・残タスク②完了・残タスク③（PL-008判断）待ち」。

### Parking Lot追加

| ID | 内容 | 出典 |
|----|------|------|
| PL-010 | Sidebar Mode Separation（Diagnosis Mode / Knowledge Design Mode / Admin の3セクション分け）。`STUDIO_UX_SEPARATION_REPORT.md`が提案。現在は`/authoring`独立ルート＋`/admin`タブという別方針で実装済みのため、再設計するかは要判断。PL-009（Coverage/Evidence/RelationshipのAuthoring Workbench統合）と統合して検討する | `STUDIO_UX_SEPARATION_REPORT.md` |
| PL-011 | A-ID廃止検討。P-IDとの重複が高いため、Phase 1からの段階的削除を検討する | `UI_UX_RECONCILIATION_REPORT.md` Section 4-B |
| PL-012 | K-ID/M-ID/C-ID/E-IDはStudio内部診断用として維持する方針を正式採用。Coverage/Relationshipでは完全代替できない診断次元（意味競合・構文分断・量的優位等）が残るため | `UI_UX_RECONCILIATION_REPORT.md` Section 4-B |

### Evidence Classification Policy v1.0の原本について

CLAUDE.md Section 29「Evidence Classification Policy v1.0」は要約版であり、**完全版は`COVERAGE_POLICY_V1.md`** にある。境界ケース・誤付与パターン一覧・Unknown Entity Test（3ケース）・Entity別推奨対応（chatgpt/uber）・sourceClass相関分析は完全版にのみ記載されている。Evidence Managerでの分類判断に迷った場合は`COVERAGE_POLICY_V1.md`を参照すること。

### コミット

```
（次コミットで記録）
```

### 次のアクション

→ Phase 2完了前の残タスク③（PL-008 孤立3ファイルの扱い判断）へ進む。

---

## 37. PL-008 クローズ記録（2026-06-30）

Phase 2完了前の残タスク③。`src/lib/coverageEngine.ts` / `src/lib/questionResolver.ts` / `api/qi-get.ts`の扱いを、実際の参照関係（`import`文・API呼び出し元）を repo 全体で確認した上で判定した。

### 調査結果

| ファイル | 実行時import/呼び出し元 | API実装との重複度 |
|---------|----------------------|------------------|
| `src/lib/coverageEngine.ts` | **0件**（`page-generate.ts`等の言及は全てコメントのみ） | `api/coverage-report.ts`と関数名・ロジックがほぼ完全一致。本ファイルが複製元 |
| `src/lib/questionResolver.ts` | **0件**（同上） | `api/qi-resolve.ts`の`resolveQITemplateText`等とほぼ完全一致。本ファイルが複製元 |
| `api/qi-get.ts` | **0件**（src/・scripts/・RefBaseリポジトリいずれからも呼び出しなし） | 重複ではなく単純未配線 |

tsconfig.api.json が`src/`を含まないため、API層は`src/lib/`を直接importできず、ロジックをインライン複製している（既存コードのコメントで明記されている設計方針）。`coverageEngine.ts`/`questionResolver.ts`はこの複製元の**正本**にあたる。

### 判断（確定）

| ファイル | 判断 | 対応 |
|---------|------|------|
| `src/lib/coverageEngine.ts` | **残す** | API側インライン実装の正本候補として明記するコメントを追加 |
| `src/lib/questionResolver.ts` | **残す** | 同上 |
| `api/qi-get.ts` | **削除しない・残す** | 未配線のレガシー候補として明記するコメントを追加。将来QuestionInstance Viewer実装時に再評価 |

ロジック変更は一切なし（コメント追加のみ）。

### 検証

| 項目 | 結果 |
|------|------|
| TypeScript 0エラー | ✅ |
| stage範囲 | ✅ 3ファイルのみ（`git status`で確認） |

### コミット

```
92af50c  docs: annotate orphaned files with wiring status (PL-008)
```

### PL-008 ステータス：クローズ

---

## 38. Phase 2完了前タスク 完了サマリー（2026-06-30）

優先順位確定分3点がすべて完了した。

| # | タスク | 状態 | 記録 |
|---|--------|------|------|
| 1 | M-05 Relationship Editor UI | ✅完了 | Section 35 |
| 2 | 未追跡ドキュメント4件の内容確認 | ✅完了 | Section 36 |
| 3 | PL-008 孤立3ファイルの扱い判断 | ✅完了（クローズ） | Section 37 |

S-03/S-04/S-05・Could群は引き続きPhase 2完了のブロッカーとしない。

### 次のアクション

→ Phase 2正式完了判定 または Phase 3（Aisle Monitor）着手判断へ進む。

---

## 39. Phase 2 正式完了判定（2026-06-30）

S0〜S5・Coverage/Evidence本番反映・M-05・未追跡ドキュメント整理・PL-008を踏まえ、正式完了判定を実施した。

### 完了の定義

> Phase 2「Aisle Studio Complete」は、**Knowledge Authoring Platformとしての中核ライフサイクル（Question Instance → Draft → Validated Draft → Reference → Publish）が、設計・実装・本番デプロイ・動作確認のすべてにおいて一貫して完成し、RefBaseへ知識を届けられる状態になったこと**をもって完了とする。

「Studioの全機能が完成した」という意味ではない。レポート品質・responseSchema準拠生成・Draft永続化・Entity Workspace・Evidence投入UI・Monitor連携・UX統合・Search/Filter等は、Phase 2完了の定義に含めず、Should/Could/Parking Lotとして継続管理する（Aisle Platform Specification Ver3.0 Section 8参照）。

### 判定

| 項目 | 判定 |
|------|:----:|
| Phase 2を完了扱いにする | ✅ |
| Must（M-01〜M-05） | ✅ 全完了・未消化なし |
| Phase 3（Aisle Monitor）着手 | ✅ 進んでよい（着手条件「L6+L7完了後」を充足） |

### ステータス変更

**Phase 2「Aisle Studio Complete」: 正式完了（2026-06-30）**

---

## 40. Design Freeze — Specification Ver3.0 作成完了（2026-06-30）

Phase 2正式完了を受け、現時点の実装・設計・思想・既知課題を仕様書として確定（Design Freeze）。仕様書作成のための実装変更は行っていない。

### 作成した仕様書

| 仕様書 | 対象 | 状態 |
|--------|------|:----:|
| `AISLE_PLATFORM_SPECIFICATION_V3.md` | Platform全体・Studio・API・Data Model・Roadmap | ✅作成完了 |
| `REFBASE_SPECIFICATION_V1.md` | RefBase専用（Question First思想・実装済み機能・未実装・今後の課題） | ✅作成完了（新規） |
| `MONITOR_SPECIFICATION_V1.md` | Aisle Monitor（現状は実装ゼロであることを正確に記録） | ✅作成完了（新規） |

### 作成方針

- 既存コード・MASTER_ROADMAP.md・CLAUDE.md・既存設計資料（COVERAGE_POLICY_V1.md・STUDIO_UX_SEPARATION_REPORT.md・UI_UX_RECONCILIATION_REPORT.md）を根拠に実装ベースで記述
- 推測・将来構想は現在仕様として書かず、Known Limitations / Technical Debt / Parking Lotに分離
- 3冊間で同一概念（Publishable Knowledge・Relationship・Coverage・Question Instance等）の定義を統一
- 仕様書作成のためのコード変更は一切なし

### 運用ルール（正式採用）

> **今後はSprint完了時に仕様書も同時更新することを正式運用とする。**

Section 33の「Sprint完了時の必須手順」に以下を追加する：

```
1. git status確認
2. 変更ファイルのスコープ確認
3. commit対象の明示
4. commit
5. push
6. 本番デプロイ確認（vercel ls / vercel inspect --logs）
7. 本番動作確認
8. MASTER_ROADMAP更新
9. ★ 該当する仕様書（AISLE_PLATFORM_SPECIFICATION / REFBASE_SPECIFICATION / MONITOR_SPECIFICATION）を更新（新規追加）
```

Sprintの内容がPlatform全体・Studio・API・Data Modelに関わる場合は`AISLE_PLATFORM_SPECIFICATION_V3.md`を、RefBase（別リポジトリ）に関わる場合は`REFBASE_SPECIFICATION_V1.md`を、Monitor着手後は`MONITOR_SPECIFICATION_V1.md`を更新する。MASTER_ROADMAPが「現在地の地図（経緯・記録）」であるのに対し、仕様書群は「現時点の到達点（設計書・引継ぎ資料）」という役割分担とする。

### 次のアクション

→ Phase 3 Aisle Monitor キックオフ（設計レビューから開始）。

### 補足：仕様書の正本管理（2026-06-30確定）

Markdown版（`AISLE_PLATFORM_SPECIFICATION_V3.md` / `REFBASE_SPECIFICATION_V1.md` / `MONITOR_SPECIFICATION_V1.md`、本リポジトリ管理）が**正本**。`.docx`版（`C:\Users\kousu\OneDrive\Desktop\AIsle\`配下）はMarkdown版から都度変換して出力する**派生物**であり、`.docx`側を直接編集しない。

---

*このドキュメントは「実装の記録」ではなく「現在地の地図」。実装の変更はコードを変えること。このドキュメントは Sprint が進むたびに更新する。*
