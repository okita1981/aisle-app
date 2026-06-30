# RefBase Specification Ver1.0

**策定日**: 2026-06-30
**位置づけ**: Phase 1「RefBase Finish」完了時点（2026-06-30）の実装ベース仕様書。Aisle Platform Specification Ver3.0と整合する用語・定義を使用する。
**対象リポジトリ**: `C:\Users\kousu\refbase`（別リポジトリ。Studioと同一Vercel KVを共有）
**本番URL**: `https://www.refbase.ai`

---

## 1. Product Vision

### 1.1 RefBaseとは何か

RefBase は **AI Knowledge Infrastructure** である（R1 Product Definition Refreshで確定。旧称「Reference Layer」「AI-Friendly Company Directory」は廃止済み）。

企業・サービス・商品に関する知識を、AIが理解・比較・推論・推薦できる形へ構造化する基盤。引用は手段であり、目的はAIが自然に出現できる状態をつくることにある。

### 1.2 Question First思想（RefBase Constitution v1）

> RefBaseは企業データベースではない。AIが課題解決のために参照する **Question-first Knowledge Base** である。

優先順位は絶対に崩さない：

```
Question
  ↓
Reference
  ↓
Evidence
  ↓
Source
```

**Entityは主役ではない。Referenceを整理するインデックスである。** 新機能を作る前に必ず「これはQuestion/Reference/Evidence/Sourceのどれを強くするか」を確認し、いずれにも該当しなければ後回しにする。

### 1.3 KPI方針

Entity数ではなく、**Question数 / Reference数 / Question Coverage / Reference Health** を重視する（RefBase Constitution v1 Section 4）。

---

## 2. 実装済み機能

### 2.1 情報構造（IA v2.0・全7 Sprint完了）

```
Level 0: /                          ← Product Landing（R2でTOP IA刷新）
Level 0.5: /directory                ← Browse by Cluster + Browse by Entity Type（R2/R3）
Level 1: /cluster/{clusterId}        ← Cluster ページ
Level 2: /entity/{entityId}          ← Entity ハブ + Knowledge Graph（R4）
Level 3: /reference/{entityId}/{referenceId} ← Reference ページ（R5）
```

### 2.2 Registry

| Registry | KVキー | 件数 |
|----------|--------|------|
| Cluster Registry | `refbase:registry:clusters` | 12件（ACTIVE:11/DRAFT:1） |
| Relationship Registry | `refbase:registry:relationships` | 58件（5 relationshipType） |
| QuestionTemplate Registry | `refbase:registry:questionTemplates` | 6件 |

### 2.3 Entity

`/entity/{entityId}`：

- canonicalName / officialName / entityType / shortDescription / externalLinks
- **Clusterバッジ**（primaryCluster=emerald / secondaryClusters=gray、各`/cluster/{slug}`リンク）
- **Knowledge Graph セクション**：Relationship Typeごとにグループ化表示（Competitors / Alternatives / Parent Organization / Subsidiaries / Part of / Products）。Relationshipがない場合は非表示
- Reference一覧（P-IDバッジ付き）

### 2.4 Reference

`/reference/{entityId}/{referenceId}`：

- P-IDバッジ（h1上部）
- answer / evidencePoints / scope / differentiation / faq
- sourceEvidenceのsourceTypeラベル（Official/Company/Third-party/Community/Source、subtle gray）
- 他のReferenceへのリンク（promptText表示）
- footer：「RefBase — AI Knowledge Infrastructure」+ canonicalUrl

### 2.5 Relationship

実装済み4種＋1種：

| relationshipType | UI表示 | JSON-LD |
|------------------|:------:|:-------:|
| `competitorOf` | ✅ Competitors | ✅ `competitor` |
| `alternativeTo` | ✅ Alternatives | ❌（schema.org対応なし・意図的） |
| `parentEntity` | ✅ Parent Organization / Subsidiaries | ✅ `parentOrganization` |
| `productOf` | ✅ Part of / Products | ✅ `isPartOf` |
| `memberOfCluster` | Clusterバッジとして別枠表示（Knowledge Graphには含まない） | ✅ `additionalType` |

R-01〜R-22のうち実装済みは5種のみ。残り17種（R-07 foundedBy、R-09 acquiredBy、R-14 integrationOf等）は未実装。

### 2.6 Cluster

`/cluster/{clusterId}`：所属Entity一覧・代表Reference・関連Clusterリンク。maturity（Growing/Established）はEntity 3件以上でEstablished。`/directory`にBrowse by Cluster（全件）+ Browse by Entity Type（company/product/person別）の2軸探索。

### 2.7 JSON-LD

| 要素 | 状態 |
|------|:----:|
| Organization / Product / Person Schema | ✅ |
| FAQPage Schema | ✅ |
| `additionalType`（Cluster URL） | ✅ |
| `citation[]`（acceptedAnswer内、sourceEvidence.sourceUrlから生成） | ✅ |
| `competitor` / `parentOrganization` / `isPartOf` | ✅ |
| ItemList / BreadcrumbList | ✅ |

### 2.8 llms.txt / sitemap

- `llms.txt`：Cluster別セクション + Entity別セクション（後方互換）。タイトル「AI Knowledge Infrastructure」
- `sitemap.xml`：Cluster URL（Established:0.85/Growing:0.75）+ P-ID別Reference priority（P-06:0.85 〜 P-04:0.60）

### 2.9 API（read-only）

| API | 用途 |
|-----|------|
| `GET /api/cluster-registry` | Cluster Registry読み取り |
| `GET /api/relationship-registry` | Relationship Registry読み取り（`?entity`/`?type`/`?status`フィルタ） |
| `GET /api/entity/{entityId}` | Entity + referenceIndex |
| `GET /api/reference/{entityId}` | Reference一覧 |
| `GET /api/reference/{entityId}/{referenceId}` | Reference単体 |
| `GET /llms.txt` | AI向けインデックス |

**注**：RefBase側に**書き込みAPIは存在しない**。書き込みはすべてStudio側（`api/draft-publish.ts`等）が同一KVへ直接行う。

### 2.10 KV構造（Studioと共有）

詳細はAisle Platform Specification Ver3.0 Section 6を参照。RefBaseは以下のキーを**読み取り専用**で参照する：

```
refbase:company:{slug}
refbase:ref:{slug}/{questionSlug}
refbase:index:{slug}
refbase:index:all
refbase:registry:clusters
refbase:registry:relationships
refbase:registry:questionTemplates
```

---

## 3. 未実装

| 項目 | 詳細 |
|------|------|
| RefBase専用KV分離 | 現状Studioと同一KVを共有（PL-004相当） |
| `refbase:index:all`の削除時同期 | Entity削除時にindexから漏れるケースがある |
| R-01〜R-22のうち未実装17種 | Relationship Registryは5種のみ |
| Question Page（独立URL） | 現時点では不要と判断（Reference Pageに内包）。Question Coverageが高まった場合に再検討 |
| Search / Filter | Entity数が小規模（31件）のため未実装。1,000 Entity超で再検討 |
| Crawl（能動的クロール） | RefBaseは公開ページとして待機するのみ。AIクローラーへの能動的な働きかけは行わない |

---

## 4. 今後の課題

| ID | 内容 |
|----|------|
| RB-10 | Relationship JSON-LD拡張（R4で主要4種は実装済み。残り17種への拡張） |
| RB-11 | Evidence type別分類表示（Reference ページで「実績・根拠」をtype別に整理） |
| Entity Summary Registry | `/directory`が現状Entity個別KV取得（2+2N回）。1,000 Entity超でRegistry方式へ移行 |
| primaryCluster一元管理 | Entity KV・Cluster Registry・Relationship Registry(memberOfCluster)の3箇所重複の解消（Aisle Platform Specification Ver3.0 PL-009/S-04と連動） |

---

## Current Status

✅ **完了しているもの**：IA v2.0全7 Sprint（Cluster Layer・JSON-LD Enhancement・Distribution Optimization・Knowledge Graph Exposure）、Product Definition Refresh（R1）、TOP IA刷新+Directory新設（R2）、Browse by Entity Type（R3）、Relationship Finish（R4）、Reference Finish（R5）。Phase 1「RefBase Finish」は2026-06-30完全完了。

❌ **Known Limitations**：3章参照（専用KV分離、index同期、未実装Relationship 17種、Search/Filter、能動的Crawlなし）

📋 **今後の課題**：4章参照（RB-10/RB-11、Entity Summary Registry、primaryCluster一元管理）

---

*本書はPhase 1「RefBase Finish」完了時点の実装を記録したもの。RefBaseリポジトリ側での変更時は本書も同時更新すること。*
