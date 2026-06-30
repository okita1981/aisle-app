# Aisle Platform Specification Ver3.0

**策定日**: 2026-06-30
**位置づけ**: Phase 2「Aisle Studio Complete」正式完了時点（Design Freeze）の仕様書。設計書・運用書・引継ぎ資料を兼ねる。
**作成方針**: 既存コード・MASTER_ROADMAP.md・CLAUDE.md・各種設計資料を根拠に、実装ベースで記述する。推測・将来構想は「Roadmap」「Known Limitations」に明確に分離する。
**対象リポジトリ**: `C:\Users\kousu\OneDrive\Desktop\CLAUDE Aisle\aisle-app`（Studio）

---

## 1. Platform Vision

### 1.1 Aisleとは何か

Aisle は「企業・サービスに関する情報を、生成AI（GPT / Perplexity / Gemini 等）が正確に理解・引用・推薦できる形に構造化し、公開するインフラ」である。フレームワーク名は **出現設計（Emergence Design）**。

唯一の成功指標は **「出た」という現象（Appearance）** であり、「書いた」ことではない（CLAUDE.md冒頭原則）。

### 1.2 Platform思想

- **Aisle as Infrastructure**：個別の制作案件ではなく、クライアントごとにAI向け公開インフラを設計・展開するシステム
- **クライアント主語**：生成される知識・公開ページにAisleの名称・内部IDを表示しない
- **構造優先**：人間の可読性（SEO）ではなく、AIが学習・引用しやすい構造を優先する（AI First）

### 1.3 Knowledge Authoring Platformとは

Studioは当初「出現設計ワークフローツール」と位置づけられていたが、Phase 2の設計検討（S1, 2026-06-30）で再定義された。

> Studioは、RefBaseに公開される知識を、**品質を担保しながら**製造・管理する **Knowledge Authoring Platform** である。

CMSとの違いは、「作る」だけでなく「検証して承認まで届ける」プロセスを構造として持つことにある。

### 1.4 Publishable Knowledgeとは

Studioの成果物の定義。知識は以下の段階を経て初めてPublishable Knowledge（公開可能な知識）になる。

```
Knowledge
  ↓
Quality Verified Knowledge（Coverage / responseSchema / Citation検証通過）
  ↓
Publishable Knowledge（承認・公開確定）
  ↓
RefBase
```

この定義により、Quality検証はStudioの「オプション機能」ではなく「中核機能」として位置づけられる。

### 1.5 Platform循環

```
Monitor（出現観測）
   ↓ 出現データ・改善示唆
Studio（知識の製造・検証）
   ↓ Publishable Knowledge
RefBase（公開・配信）
   ↓ AI Knowledge Infrastructure
AI（GPT / Perplexity / Gemini 等）
   ↓ 出現（Appearance）
Monitor（観測へ戻る）
```

### 1.6 Studio・RefBase・Monitorの役割

| プロダクト | 中心の問い | 責務 |
|----------|----------|------|
| **Studio** | 何を知っているか、品質は十分か | 知識の製造・検証・承認（Knowledge Authoring Platform） |
| **RefBase** | AIにどう届けるか | 知識の公開・配信・構造化（AI Knowledge Infrastructure） |
| **Monitor** | 出現したか、どう評価されたか | 観測・フィードバック（**未実装**。詳細はMonitor Specification Ver1.0参照） |
| **Scope** | 出現状況を可視化・スコアリング | レポーティング（**未着手**） |

---

## 2. Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Aisle Platform                            │
│                                                                   │
│   ┌───────────┐     ┌───────────┐     ┌───────────┐             │
│   │  Studio   │────▶│  RefBase  │────▶│    AI     │             │
│   │ (製造・検証)│     │ (公開・配信)│     │ (GPT等)   │             │
│   └─────┬─────┘     └─────┬─────┘     └─────┬─────┘             │
│         │                  │                  │                  │
│         │      Vercel KV（共有）               │ 出現             │
│         └──────────────────┘                  ▼                  │
│                                          ┌───────────┐            │
│                                          │  Monitor  │            │
│                                          │ (観測・未実装)│           │
│                                          └─────┬─────┘            │
│                                                │ Feedback         │
│                                                ▼                  │
│                                          Studio へ還元（未実装）    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 7層アーキテクチャ（Generation Layer詳細）

```
L1  Entity              KVからEntity取得・提供（Read）
L2  Question Template   QuestionTemplate / QuestionInstance / responseSchema
L3  Coverage Engine     requiredCoverage ⊆ coverageTypeSet の充足判定（純粋関数）
L4  Evidence Resolver   coverageTypeに基づきEvidenceを抽出
L5  Reference Generator Claude呼び出しでDraft生成
L6  Quality Audit       responseSchema sections / citationRequired / Coverage整合の検証
L7  Publishing          承認済みDraftのみKV保存
```

| Layer | 実装状態 | 対応する実装 |
|-------|---------|------------|
| L1 | ✅稼働中 | `refbase-get.ts` / Admin |
| L2 | ✅稼働中 | `refbase:registry:questionTemplates` + `api/qi-resolve.ts` |
| L3 | ✅稼働中（純粋関数） | `api/qi-resolve.ts`内`checkCoverage()`、`src/lib/coverageEngine.ts`（正本・未配線） |
| L4 | ✅稼働中（純粋関数） | `api/qi-resolve.ts`内`collectCoverageTypeSet()` |
| L5 | ✅稼働中 | `api/draft-generate.ts` |
| L6 | ✅稼働中（純粋関数） | `api/draft-validate.ts` |
| L7 | ✅稼働中 | `api/draft-publish.ts` |

**Layer間の依存原則**：データは下位（L1）から上位（L7）への一方向のみ。下位層が上位層を変更しない（Architecture v1.0 P1）。

---

## 3. Knowledge Object Model（最新版）

Knowledge Objectは「管理対象（CRUD対象）」ではなく、**発見・設計・育成される対象**として定義する（DP-001 Unknown Entity Test：無名企業・スタートアップでも成立する設計）。

### 3.1 オブジェクト一覧とライフサイクル

```
Entity ──┬── Cluster（所属）
         ├── Relationship（他Entityとの関係）
         ├── Evidence（根拠）
         └── Question Template ──→ Question Instance
                                          │
                                          │ 1 : N（複数LLM・複数試行を許容）
                                          ▼
                                        Draft
                                          │ Validate実行
                                          ▼
                                  Validated Draft（まだ非公開）
                                          │ 採用・承認
                                          ▼
                                      Reference（Studioの最終成果物）
                                          │ Publish
                                          ▼
                                       RefBase
```

### 3.2 各オブジェクトの定義

| Object | 役割 | 永続化キー | 育ち方 |
|--------|------|-----------|--------|
| **Entity** | 知識が積み上がる器。会社・商品・サービス・人物等 | `refbase:company:{slug}` | 最小輪郭→Reference蓄積で厚みを増す。**Entityは主役ではなくIndex**（RefBase Constitution v1） |
| **Question (Template)** | P-IDごとの問いの型。Entity非依存。6種類確定 | `refbase:registry:questionTemplates` | Platform共通資産。滅多に増えない |
| **Question Instance** | Entity×Templateから解決された個別の問い | `refbase:qi:{clientSlug}:{promptTypeId}` | Coverage GateがUNLOCKEDになった時のみ実体化（「聞かれる準備ができた問いだけが生まれる」） |
| **Evidence** | Referenceを支える根拠。CoverageType（5軸）で分類 | `evidence:{slug}` | 育成の中心。不足を自覚しながら強化する |
| **Relationship** | Entity間の構造的つながり（4種実装：parentEntity / productOf / competitorOf / alternativeTo） | `refbase:registry:relationships` | わかっている関係から少しずつ追加 |
| **Draft** | LLMが生成した、まだ検証されていない回答候補。1 instanceにつき複数存在しうる | フロントstateのみ（KV保存なし） | 複数LLM・複数試行を許容 |
| **Validated Draft** | schema/citation/coverage検証を通過した状態。まだ非公開 | フロントstateのみ（KV保存なし） | 合格証。落ちた記録も保持しうる |
| **Reference** | 採用されたValidated Draftから合成される、Studioの最終成果物 | `refbase:ref:{slug}/{questionSlug}` | 積み上げの最後に実る成果物。`instanceId`/`draftId`で生成履歴を追跡可能 |
| **Cluster** | Entityが属する問いの文脈 | `refbase:registry:clusters` | Entityが増える過程で自然成熟（Growing→Established） |
| **Coverage** | Knowledge Objectではない。Runtime判定結果（KV非保存） | — | Evidence×Templateを毎回計算する純粋関数の出力 |

### 3.3 ライフサイクル上の重要な設計判断

- **Question Instance : Draft は 1 : N**。同一instanceIdに対して複数Draft（複数LLM・複数試行）が並存できる
- **DraftとReferenceは同一視しない**。Generate直後はDraft、Validate通過後もまだReferenceではなく「採用」操作を経て初めてReferenceとして合成・Publishされる
- **Referenceに`instanceId`/`draftId`を保持**し、どの問い・どの生成からReferenceが生まれたかを追跡可能にしている（既存160件のReferenceにはこれらのフィールドはなく、後方互換のためoptional）

---

## 4. Studio Specification

### 4.1 全体UI構成

```
Aisle Studio
├── Diagnosis（Phase 0〜5・Report）─ 既存フロー。出現診断・実装計画策定
│   ├── Phase 0: ログ取得
│   ├── Phase 1: 因果分析
│   ├── Phase 2: 出現設計
│   ├── Phase 3: 突合検証
│   ├── Phase 4: 実装設計（page-generate.tsによるレガシー一括投入を含む）
│   └── Report: 診断レポート
├── /admin（独立ルート）
│   ├── Entity / Reference タブ：一覧・削除
│   ├── Coverage Panel タブ：5軸充足状況の可視化（Read-Only）
│   ├── Evidence Manager タブ：coverageType/sourceClass/supportedPromptTypes編集
│   └── Relationship Editor タブ：Relationship新規登録・DEPRECATED化
└── /authoring（独立ルート）= Authoring Workbench
    ├── Generateタブ：qi-resolve実行 → Draft生成
    ├── Validateタブ：draft-validate実行 → 検証結果・issues表示
    └── Publishタブ：採用済みDraftの承認・公開
```

### 4.2 Authoring Journey（6ステップ・設計概念）

S1で定義した概念モデル。現行UIへの完全な1:1実装はされていない（Understand/Structureステップ専用画面は未実装。詳細はKnown Limitations参照）。

| Step | 内容 | 現行UIでの対応 |
|------|------|---------------|
| ① Understand | AIログ診断・因果分析を入力とする | Phase 0/1（既存のまま） |
| ② Structure | Entity / Cluster / Relationship設計 | Admin（Entity一部）+ Relationship Editor |
| ③ Evidence | Evidence収集・Coverage確認 | Evidence Manager + Coverage Panel（投入UIは未実装） |
| ④ Generate | Question Instance→Draft生成 | Authoring Workbench Generateタブ |
| ⑤ Validate | responseSchema/citation/coverage検証 | Authoring Workbench Validateタブ |
| ⑥ Publish | 承認・RefBase公開 | Authoring Workbench Publishタブ |

### 4.3 Authoring Workbench（`/authoring`）詳細

| タブ | 扱うObject | 主要操作 |
|------|-----------|---------|
| Generate | QuestionTemplate → Question Instance → Draft | clientSlug/companyName/productCategory入力 → 「Questionを解決する」（qi-resolve）→ 各UNLOCKED P-IDごとに「Draft生成」（同一instanceIdへの複数回生成で`attemptNumber`が増分） |
| Validate | Draft → Validated Draft | Draft選択 → 「検証する」（draft-validate）→ schema/citation/coverage 各OK/NGバッジ・issues一覧表示 → OKなら「この Draft を採用」 |
| Publish | 採用済みDraft → Reference | 採用済みDraft一覧 → 「承認して公開」（draft-publish）→ RefBase URL表示 |

認証：`x-aisle-admin: 1`ヘッダー（簡易ガード。詳細は8章参照）。

### 4.4 Coverage Panel（`/admin` タブ）

全Entityの5軸Coverage（Identity/Capability/Differentiation/Credibility/UseCase）充足状況を一覧表示するRead-Onlyパネル。`api/coverage-report.ts`を呼ぶ。KV書き込みゼロ。

### 4.5 Evidence Manager（`/admin` タブ）

Evidence一覧を表示し、`coverageType[]` / `sourceClass` / `supportedPromptTypes[]` の3フィールドのみ編集可能（本文編集・新規作成・削除は対象外）。`api/evidence-manager.ts`を呼ぶ。

### 4.6 Relationship Editor（`/admin` タブ）

Entity間Relationshipの新規登録・DEPRECATED化（削除は物理削除ではなくstatus変更）。対象は`parentEntity` / `productOf` / `competitorOf` / `alternativeTo`の4種のみ。`memberOfCluster`は対象外（primaryCluster/secondaryClustersとの二重管理回避のため）。`api/relationship-manager.ts`を呼ぶ。

### 4.7 Quality Audit

専用画面はなく、Authoring WorkbenchのValidateタブに統合されている。`api/draft-validate.ts`が実体（5章参照）。

---

## 5. API Specification

すべて`api/*.ts`（Vercel Functions、`maxDuration`は個別指定）。認証方式は2種類：

- **未認証（公開API）**：`page-get.ts` / `page-generate.ts`（GET） / `refbase-get.ts`の一部 等
- **`isAuthorized()`ガード必須**：`x-aisle-admin: 1`ヘッダー、または`Bearer {EM_SHARED_SECRET}`

### 5.1 Authoring Engine API（S3, Phase 2の中核）

| API | メソッド | 責務 | 認証 | KV書き込み |
|-----|---------|------|:----:|:---------:|
| `/api/qi-resolve` | POST | Coverage Gate（L3/L4）+ QuestionInstance解決（L2） | ✅必須 | QIのみ（`refbase:qi:*`） |
| `/api/draft-generate` | POST | Claude呼び出しでDraft生成（L5）。1リクエスト=1試行 | ✅必須 | なし |
| `/api/draft-validate` | POST | responseSchema/citation/coverage検証（L6）。純粋関数 | ✅必須 | なし・AI呼び出しなし |
| `/api/draft-publish` | POST | Draft+ValidatedDraft→Reference合成・KV保存（L7） | ✅必須 | **唯一の書き込み経路**（`refbase:ref:*`, `refbase:company:*`, `refbase:index:*`, `page-question-index:*`） |

`draft-publish`の5ガード：①`validatedDraft.ok !== true`で拒否 ②`draftId`不一致で拒否 ③必須フィールド不足で拒否 ④questionSlug衝突をWrite直前に再確認 ⑤RefBase KV書き込みはこのAPIのみで発生。

### 5.2 Coverage / Evidence / Relationship 管理API

| API | メソッド | 責務 | 認証 |
|-----|---------|------|:----:|
| `/api/coverage-report` | GET | 全Entity or 単一EntityのCoverage判定結果 | ✅必須 |
| `/api/evidence-manager` | GET/PATCH | Evidence一覧取得・3フィールドのみ更新 | ✅必須 |
| `/api/relationship-manager` | GET/POST | Relationship取得・create/update/delete（DEPRECATED化） | ✅必須 |
| `/api/qi-get` | GET | QuestionInstance読み取り専用。**未配線**（呼び出し元ゼロ。詳細はKnown Limitations） | なし |

### 5.3 レガシー一括投入・Diagnosis系API

| API | メソッド | 責務 |
|-----|---------|------|
| `/api/page-generate` | POST/GET | レガシー一括投入（aisleMode: add/update/refbaseEntityUpdate）。llms.txt生成（format=llms）。**Section 2.1のL2〜L7相当ロジックがインライン実装されている（page-generate.ts自体は変更していない）** |
| `/api/page-get` | GET | 公開ページ取得（`/{slug}`ルーティング先） |
| `/api/page-delete` | POST | ページ削除・インデックス更新 |
| `/api/entity-delete` | POST | Entity削除（confirmSlug再入力必須）。**`refbase:qi:*`キーは削除対象に含まれない（既知の負債）** |
| `/api/refbase-get` | GET | RefBase KV読み取り（Admin用。`type=all`で全件） |
| `/api/evidence-extract` | POST | 公式サイトからEvidence候補抽出・Tier判定 |
| `/api/classify-pid` | POST | Phase0: P-ID分類 |
| `/api/classify` | POST | Phase1: K-IDスコア・C-ID算出 |
| `/api/design` / `/api/design-step2` / `/api/design-step3` | POST | Phase2: After構文・M-ID・E-ID設計 |
| `/api/reconcile` | POST | Phase3: 突合診断・到達可能性算出 |
| `/api/implement` | POST | Phase4: 実装計画策定 |
| `/api/competitor` | POST | 競合分析 |
| `/api/evaluate-axes` | POST | 軸評価 |
| `/api/fetch-url` | POST | URL取得 |
| `/api/log-collect` | POST | ログ収集 |
| `/api/session` | POST/GET | セッション保存・読み出し・RefBaseプレビュー統合エンドポイント |
| `/api/_llm.ts` | （内部ユーティリティ） | LLM呼び出し共通化。claude-sonnet-4-6 → claude-haiku-4-5 → gemini-2.5-flash のフォールバック順 |
| `/api/_draft-types.ts` | （型定義のみ） | Authoring Engine共有型 |

---

## 6. Data Model

### 6.1 Registry（`refbase:registry:*`）

| Registry | KVキー | 形式 | 件数 |
|----------|--------|------|------|
| CoverageTypes | `refbase:registry:coverageTypes` | RegistryEnvelope | 5軸 |
| ResponseSchemas | `refbase:registry:responseSchemas` | RegistryEnvelope | 6件（P-01〜P-06） |
| QuestionTemplates | `refbase:registry:questionTemplates` | RegistryEnvelope | 6件 |
| Clusters | `refbase:registry:clusters` | RegistryEnvelope | 12件（ACTIVE:11/DRAFT:1） |
| Relationships | `refbase:registry:relationships` | RegistryEnvelope | 58件（5 relationshipType。うち4種がStudio編集可能） |

RegistryEnvelope共通形式：

```typescript
interface RegistryEnvelope<T> {
  registryId: string;
  version: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  description: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  items: T[];
}
```

### 6.2 Entity

```typescript
// KV: refbase:company:{slug}
interface RefBaseCompany {
  id: string;                 // slug。不変
  name: string;
  category: string;
  entityType?: 'company' | 'service' | 'product' | 'person' | 'organization' | 'concept' | 'other';
  officialName?: string;
  canonicalName?: string;
  displayName?: string;
  alias?: string[];
  searchKeywords?: string[];
  primaryCluster?: string;
  secondaryClusters?: string[];
  parentEntity?: string | null;
  externalLinks?: Array<{ type: string; url: string }>;
  updatedAt: string;
}
```

### 6.3 Reference

```typescript
// KV: refbase:ref:{clientSlug}/{questionSlug}
interface Reference {
  id: string;                 // questionSlug
  companyId: string;
  questionId: string;
  instanceId?: string;        // ← S3で追加。後方互換のためoptional
  draftId?: string;           // ← S3で追加。後方互換のためoptional
  promptText: string;
  promptTypeId: string;       // P-01〜P-06
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
  pageUrl: string;
  sourceEvidence: EvidenceItem[];
  generatedAt: string;
}
```

### 6.4 Relationship

```typescript
// KV: refbase:registry:relationships（items[]の1件）
interface RelationshipItem {
  relationshipId: string;     // "REL-001"連番
  sourceEntity: string;
  targetEntity: string;
  relationshipType: 'parentEntity' | 'productOf' | 'competitorOf' | 'alternativeTo' | 'memberOfCluster';
  direction: 'directed' | 'bidirectional';
  description: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;              // 'manual' | 'cluster-registry'
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
}
```

### 6.5 Question Instance

```typescript
// KV: refbase:qi:{clientSlug}:{promptTypeId}
interface QuestionInstance {
  instanceId: string;          // "QIN-{entityId}-{pid}-001"
  templateId: string;
  entityId: string;
  promptTypeId: string;
  resolvedText: string;
  unresolvedSlots: string[];
  createdAt: string;
  updatedAt?: string;
}
```

### 6.6 Draft / Validated Draft

**KV非保存**（フロントstateのみ。Generate→Validate→Publishが同一セッション内操作である前提）。

```typescript
interface Draft {
  draftId: string;             // crypto.randomUUID()
  instanceId: string;
  clientSlug: string;
  promptTypeId: string;
  promptText: string;
  generator: { model: string; generatedAt: string; attemptNumber: number };
  narrative: { answer: string; evidencePoints: string[]; scope: string; differentiation: string; faq: Array<{question:string;answer:string}> };
  sourceEvidence: EvidenceItem[];
}

interface ValidatedDraft {
  draftId: string;
  validatedAt: string;
  schemaCheck: { ok: boolean; requiredSections: string[]; missingSections: string[] };
  citationCheck: { required: boolean; ok: boolean; citationCount: number };
  coverageCheck: { ok: boolean; missingTypes: CoverageType[] };
  issues: Array<{ field: string; severity: 'error'|'warning'; message: string }>;
  ok: boolean;
}
```

### 6.7 Evidence

```typescript
// KV: evidence:{slug}（配列）
interface EvidenceItem {
  type: string;                // case/client/feature/metric/credential/review/media/method/availability/comparison/other
  title: string;
  description: string;
  entityRole: string;
  tags: string[];
  sourceUrl?: string;
  sourceType?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidenceId?: string;         // "{slug}-ev-{連番4桁}"
  coverageType?: CoverageType[];
  sourceClass?: SourceClass;
  supportedPromptTypes?: string[];
  tier?: 'T1' | 'T2' | 'T3' | 'T4';
  needsVerification?: boolean;
  sourceVerified?: boolean;
}
```

### 6.8 その他主要KVキー

| キー | 内容 |
|------|------|
| `refbase:index:{slug}` | EntityのReference questionSlug一覧 |
| `refbase:index:all` | 全Entity slug一覧 |
| `page-question-index:{slug}` | QuestionPageIndexEntry配列（Studio内部のページindex） |
| `page:question:{slug}/{questionSlug}` | レガシー一括投入用HTML（page-generate.ts add/updateのみ生成） |
| `page:index:{slug}` | レガシー親ページHTML |

---

## 7. Known Limitations

### 7.1 現在未実装

| 項目 | 詳細 |
|------|------|
| Entity Workspace | Structureステップ専用画面。S4スコープ外として未着手 |
| Evidence投入UI | evidence-extract結果をワンクリックでKV投入する機能なし。現状はUpstash直接操作 |
| QuestionInstance Viewer | 専用画面なし。Authoring WorkbenchのGenerateタブで簡易表示のみ |
| Draft永続化 | フロントstateのみ。ブラウザ離脱で消える |
| 複数LLM選択UI | `draft-generate`はAPIレベルで`model`パラメータに対応済みだがUIに選択肢なし |
| R-01〜R-22のうち未実装17種 | Relationship Editorは4種（parentEntity/productOf/competitorOf/alternativeTo）のみ対応 |
| Sidebar Mode Separation | Diagnosis Mode / Knowledge Design Mode / Adminの3セクション分け（提案のみ。`/authoring`独立ルート＋`/admin`タブという別方針で実装済み） |

### 7.2 既知課題

| ID | 内容 |
|----|------|
| L-07 | updateモードでpromptText不一致時のフォールバックマッチングに誤適用リスク |
| L-08 | `page-delete.ts`の`deleteFromIndex`デフォルトfalse。幽霊エントリ発生しうる |
| TD-COV-001 | Coverage Engineロジックが`coverageEngine.ts`/`coverage-report.ts`/`page-generate.ts`/`qi-resolve.ts`の4箇所に重複 |
| TD-QI-001 | QuestionInstance Resolverが`page-generate.ts`にインライン実装。`api/_questionResolver.ts`への分離が未対応 |
| TD-004 | `draft-generate`（L5）がresponseSchema構造で生成しておらず、`draft-validate`側で暫定マッピング（`SECTION_FIELD_MAP`）により対応。未定義sectionIdはwarning扱い |
| **新規** | `api/entity-delete.ts`が`refbase:qi:{slug}:{promptTypeId}`キーを削除対象に含んでいない |
| **新規** | `primaryCluster`/`secondaryClusters`がEntity KV・Cluster Registry・Relationship Registry(`memberOfCluster`)の3箇所で表現が重複（二重管理問題） |

### 7.3 技術的負債

CLAUDE.md / MASTER_ROADMAP記載のTD-001〜TD-005のうち、TD-001（Coverage Check）・TD-003（Quality Audit）・TD-005（Publishing分離）はS3で解消済み。TD-002（Question/Reference密結合）はQuestionTemplate/QuestionInstance分離により実質解消。**TD-004（responseSchema未準拠生成）のみ未解消**で、`draft-validate`の暫定対応で運用している。

---

## 8. Roadmap

### Must（Phase 2完了に必要だった項目。全て解消済み）

| ID | 内容 | 状態 |
|----|------|:----:|
| M-01〜M-05 | Coverage Panel / Evidence Manager UI / Quality Audit / Publishing分離 / Relationship Editor | ✅全完了 |

### Should（Phase 2完了のブロッカーにしない）

| ID | 内容 |
|----|------|
| S-01 | Entity Authoring UI正式化 |
| S-02 | QuestionInstance Viewer |
| S-03 | Coverage/QI Resolver共通化（TD-COV-001/TD-QI-001） |
| S-04 | Studio→RefBase Publish Schema確定（primaryCluster二重管理解消） |
| S-05 | Discovery Layer分離（P0/P1の位置づけ明確化） |

### Could

| ID | 内容 |
|----|------|
| C-01 | responseSchema準拠生成（L5リファクタ。TD-004解消） |
| C-02 | Draft一時保存ストレージ設計 |
| C-03 | Evidence Discovery Layer（T2自動発見） |
| C-04 | セッション管理画面 |
| C-05 | clientSlug重複管理 |
| C-06 | L-07解消 |

### Parking Lot

| ID | 内容 |
|----|------|
| PL-008 | （クローズ済み）孤立3ファイル（coverageEngine.ts/questionResolver.ts/qi-get.ts）は保持と判断 |
| PL-009 | Coverage Panel/Evidence Manager/Relationship EditorのAuthoring Workbenchへの統合 |
| PL-010 | Sidebar Mode Separation（Diagnosis Mode/Knowledge Design Mode/Admin） |
| PL-011 | A-ID廃止検討（P-IDとの重複） |
| PL-012 | K-ID/M-ID/C-ID/E-IDのStudio内部診断用維持方針（正式採用済み） |
| 認証強化 | `x-aisle-admin`ヘッダーは簡易ガード。正式な認証方式への置き換えが将来必要 |

---

## Current Status

✅ **完了しているもの**：Knowledge Authoring Platformとしての定義（S1）、Knowledge Object Model v1.0、Generate/Validate/Publish分離（S3）、Quality Audit（draft-validate）、Coverage Panel、Evidence Manager、Relationship Editor（S5/M-05）、RefBase Publish導線（draft-publish）。Must項目（M-01〜M-05）はすべて解消。

❌ **Known Limitations**：7.1節参照（Entity Workspace、Evidence投入UI等は未実装）

⚠️ **Technical Debt**：7.2/7.3節参照（TD-004 responseSchema未準拠生成が主要な残課題）

📋 **Parking Lot**：8章参照（PL-009〜PL-012、認証強化）

---

*本書はPhase 2「Aisle Studio Complete」正式完了時点（2026-06-30）のDesign Freeze版。今後はSprint完了時に本書も同時更新する運用とする（MASTER_ROADMAP Section 39参照）。*
