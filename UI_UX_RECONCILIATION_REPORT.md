# Aisle Platform UI/UX Reconciliation Report v1.0

**作成日**: 2026-06-29  
**目的**: 新Architecture（7層 / Coverage Engine / Knowledge Graph）が、現行の Studio / RefBase / Admin 画面にどう接続されているかを棚卸しする。  
**制約**: 実装なし・コード変更なし・新設計概念の追加なし。

---

## 1. Studio UI 現状とギャップ

### 1-A. 現行画面構成と表示内容

#### Phase 0 — ログ取得（`Phase0LogCollect.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | AIモデル選択（GPT-4.1 / 4o / 4o-mini）/ プロンプト群・P-ID / 試行回数 / 出現有無 / 出力本文 / 出力理由 / 出典分類 |
| **編集できるもの** | プロンプト入力・P-ID紐付け・試行設定 |
| **新Architectureで必要だが表示なし** | なし（この画面は観測層。Architecture変更の影響を受けない） |
| **不要になった可能性** | なし |
| **画面上の役割** | Observation Layer の入口。AIが今どう答えているかのデータ収集。 |

---

#### Phase 1 — 因果分析（`Phase1Evaluation.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | C-ID（C-01〜C-06）/ A-ID / K-ID スコアマトリクス / E-ID / ソース行列 / 出現率 / 競合分析 |
| **編集できるもの** | 分析実行のみ（AI呼び出し） |
| **新Architectureで必要だが表示なし** | Coverage（P-IDとKnowledge Layerの関係）/ QuestionTemplate との対応 |
| **不要になった可能性** | なし（診断ロジックは維持。Knowledge Layerとの接続が追加される） |
| **画面上の役割** | なぜ出ないかを K-ID / C-ID で分析する。Generation Layer への前処理。 |

---

#### Phase 2 — 出現設計（`Phase2Design.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | M-ID マッピング / After構文 / ポートフォリオ / 接続順 / E-ID補完 / 到達可能性評価 |
| **編集できるもの** | E-ID補完選択 / ステップ別生成実行 |
| **新Architectureで必要だが表示なし** | Evidence の sourceClass / coverageType（どの軸が補完されているかが見えない） |
| **不要になった可能性** | M-ID は内部処理として残すが、ユーザー向けの表示に M-ID ラベルを出す必要があるか要検討 |
| **画面上の役割** | After構文とE-IDで「どこに何を書けばAIに届くか」を設計する。 |

---

#### Phase 3 — 突合検証（`Phase3Reconciliation.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | SB-ID / 意味接点 / 困難要因分類（接続欠落・主語浮き・意味競合・構文分断）/ K-ID 名称 / M-ID 名称 / 到達可能性（低・中・高）/ 設計指針 |
| **編集できるもの** | 分析実行のみ |
| **新Architectureで必要だが表示なし** | Coverage Score との対応（どの Coverage 軸が足りないから到達可能性が低いか） |
| **不要になった可能性** | SB-ID（Syntax Block ID）は新Architectureでの対応概念が QuestionInstance に移行予定。ただし診断用途なら残してよい |
| **画面上の役割** | After構文×現在地の差分を機械的に可視化する。Phase 4 の実装判断材料。 |

---

#### Phase 4 — 実装設計（`Phase4Implementation.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | 実装計画テーブル（優先度 / アクション / 配置先ページ / E-ID / 期待効果）/ 公開済みページ一覧（P-ID / 問い文 / RefBase URL / Aisle Preview URL / ステータス "Aisle+RefBase" or "Aisleのみ" / 生成日時）/ EvidenceWarningPanel（verified件数 / needsVerification件数 / 不足type） |
| **編集できるもの** | Reference 生成（add）/ Reference 更新（update）/ Reference 削除 / clientSlug 設定 |
| **新Architectureで必要だが表示なし** | **Coverage（5軸 UNLOCKED/LOCKED）** / QuestionInstance（解決済みプロンプトの確認）/ Evidence coverageType 一覧 / Evidence sourceClass / Quality Audit 結果（responseSchema充足）/ Publishing 状態（Draft / Approved） |
| **不要になった可能性** | E-ID表示（`filterIds`で一部フィルタ済み）は生成HTML用の指示情報。新Architecture移行後は responseSchema が役割を引き継ぐ |
| **画面上の役割** | **現行の最重要画面。**ここで Reference を生成・管理する。新Architectureの L5〜L7 と最も直接的に対応する画面。 |

---

#### Report（`Report.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | 出現率チャート / C-ID 分布（棒グラフ）/ K-ID スコア / M-ID 分布 / E-ID 勝因接続 / 実装優先度マトリクス |
| **新Architectureで必要だが表示なし** | Coverage 充足率の可視化（5軸 × Entity）/ Question Coverage（P-ID別 UNLOCKED/LOCKED 率） |
| **不要になった可能性** | なし（診断レポートとして独立して価値がある） |
| **画面上の役割** | 出現設計の診断結果サマリ。クライアントへの共有用。 |

---

#### Admin（`AdminPage.tsx`）

| 項目 | 現状 |
|------|------|
| **表示しているもの** | Entity 情報（id / name / category / entityType / externalLinks / updatedAt）/ Reference 一覧（P-ID / questionSlug / promptText / RefBase URL / 生成日時）/ Reference 詳細プレビュー（answer / evidencePoints / faq / scope / differentiation / sourceEvidence）/ Entity 削除・Reference 削除 |
| **編集できるもの** | 削除のみ（Entity 削除 / Reference 削除）|
| **新Architectureで必要だが表示なし** | **Evidence 一覧**（coverageType / sourceClass / tier / evidenceId）/ Coverage 状態（5軸充足 / UNLOCKED Template 数）/ Relationship 登録・確認 / QuestionTemplate 状態 / QuestionInstance 確認 / canonicalName / primaryCluster / secondaryClusters の表示・編集 |
| **不要になった可能性** | なし |
| **画面上の役割** | Entity × Reference の確認・削除。KV 直接操作の代替。現状は読み取り＋削除のみで編集機能なし。 |

---

### 1-B. Architecture 概念のUI存在チェック

| Architecture概念 | Studio UIに存在するか | 備考 |
|----------------|:------------------:|------|
| **Coverage（5軸充足）** | ❌ | 完全に不在。最重要ギャップ。 |
| **Coverage Score** | ❌ | 不在 |
| **Missing Coverage** | ❌ | EvidenceWarningPanel が代替（不足 type 表示）だが Coverage Engine とは非連動 |
| **QuestionTemplate** | ❌ | 不在 |
| **QuestionInstance** | ❌ | 不在（生成後の resolvedText が確認できない） |
| **Relationship** | ❌ | 不在 |
| **Evidence sourceClass** | ❌ | 不在 |
| **Evidence coverageType** | ❌ | 不在 |
| **Evidence evidenceId** | ❌ | 不在 |
| **Quality Audit** | ❌ | 不在（L6 未実装） |
| **Publishing 状態** | ⚠️ 部分的 | "Aisle+RefBase" / "Aisleのみ" の二択のみ。Draft/Approved の概念なし |
| **Registry** | ❌ | 不在 |
| **Policy** | ❌ | 不在 |
| **P-ID** | ✅ | Phase 0〜4 全体で表示・使用 |
| **K-ID** | ✅ | Phase 1 / Phase 3 / Report で表示 |
| **M-ID** | ✅ | Phase 2 / Phase 3 / Report で表示 |
| **C-ID** | ✅ | Phase 1 / Report で表示 |
| **E-ID** | ✅ | Phase 2 / Phase 3 / Phase 4 で表示 |
| **SB-ID** | ✅ | Phase 3 / Phase 4 で表示（新Architecture相当概念: QuestionInstance） |
| **Evidence Tier（T1〜T4）** | ⚠️ 部分的 | EvidenceWarningPanel で verified / needsVerification は見えるが Tier ラベルなし |

---

## 2. RefBase UI / IA 現状とギャップ

### 2-A. 現在の公開画面

| ページ | 現在表示しているもの | AI向け露出 | 人間向け露出 |
|--------|-------------------|-----------|------------|
| **Top（/）** | Entity 縦並び一覧 / entityType / 簡易説明 / Reference へのリンク | 低（Cluster構造なし）| 普通（一覧は見られる） |
| **Entity Page（/entity/{id}）** | canonicalName / officialName / entityType / Reference 一覧（P-ID別）/ shortDescription / externalLinks | 中 | 良 |
| **Reference Page（/reference/{entityId}/{refId}）** | answer / evidencePoints / faq / scope / differentiation / P-ID / 生成日時 | 中（JSON-LDあり）| 良 |
| **llms.txt** | Entity 別フラット構造（Entity名 + Reference URL 一覧）| 良 | 低（機械読み取り用）|
| **sitemap.xml** | 全ページ URL 一覧 | 中 | 低 |

---

### 2-B. 新Architectureで表示すべきものとギャップ

#### Top Page（`/`）

| 項目 | 現状 | 目標 | ギャップ |
|------|------|------|---------|
| Entity 一覧 | 縦並び | Cluster 別グルーピング | **Cluster Page 実装後に変更** |
| Cluster 導線 | なし | Cluster 別セクション | Cluster KV 未実装 |
| AI 向け説明文 | 最小限 | Question-first Knowledge Base の説明 | コンテンツ不足 |

#### Entity Page（`/entity/{id}`）

| 項目 | 現状 | 目標 | ギャップ |
|------|------|------|---------|
| Cluster 表示 | なし | primaryCluster / secondaryClusters の表示 | フィールドはあるがUI非表示 |
| Relationship | なし | competitorOf / alternativeTo 等の表示 | Relationship KV 未実装 |
| additionalType | なし（JSON-LD） | Cluster URL を schema.org/additionalType に追加 | JSON-LD 未対応 |
| Evidence / Source | なし | 引用可能ソース一覧（公開レベル） | RefBase Constitution では Entity主役でないため慎重に判断 |

#### Reference Page（`/reference/{entityId}/{refId}`）

| 項目 | 現状 | 目標 | ギャップ |
|------|------|------|---------|
| responseSchema 構造 | なし（回答本文のみ） | sections（summary / capabilities 等）に沿った表示 | responseSchema が HTML に未反映 |
| citation[] | なし（JSON-LD） | acceptedAnswer に citation[] を追加 | JSON-LD 未対応 |
| Evidence 引用表示 | evidencePoints（テキスト）のみ | sourceClass / evidenceId の表示 | 内部情報のため一部のみ露出 |
| P-ID ラベル | コード（P-01等）のみ | 日本語ラベル併記 | UX の問題（実装は簡単） |

#### Cluster Page（`/cluster/{id}`）— 未実装

| 項目 | 必要か | 理由 |
|------|:-----:|------|
| Cluster Page は必要か | **Yes** | `Question → Cluster → Entity → Reference` 導線の中心。AI がクラスター横断の質問に答えるための起点。P-03（ランキング型）の主要参照先になりうる |
| 所属 Entity 一覧 | Yes | Cluster ページの主コンテンツ |
| 代表 Question 一覧 | Yes | AI が引用しやすい構造化された問い群の提示 |
| 関連 Cluster リンク | Yes | AI の横断参照を支援 |
| maturity 表示 | No（内部情報） | Growing/Established は内部管理用 |

#### Question Page — 是非の判断

| 判断 | 理由 |
|------|------|
| **現時点では不要** | Question（promptText）は Reference Page に内包されている。独立した Question Page を作ると URL 構造が複雑化し、AI が重複して参照する可能性がある |
| **将来的に検討** | Question Coverage が高まり、同一 Question に複数 Reference が対応するようになったとき（例: 企業 A と企業 B の P-01 を比較する Question Page）に検討する |

---

### 2-C. AI向け vs 人間向け 露出判断

#### 露出すべきもの（AI向け）

| 要素 | 露出先 | 理由 |
|------|--------|------|
| Cluster 情報（name / description / entitySlugs） | llms.txt Cluster セクション / Cluster Page | AI がクラスター横断のランキング質問に答える際の参照元 |
| canonicalName / alias / searchKeywords | JSON-LD / llms.txt | AI の名前解決・同義語処理を支援 |
| citation[]（ソース URL 付き） | Reference Page JSON-LD | AI が事実の一次情報を引用できるようにする |
| primaryCluster（additionalType） | Entity Page JSON-LD | AI が Entity のカテゴリを構造的に理解できるようにする |
| responseSchema sections の構造 | Reference Page HTML | FAQPage Schema に沿った構造化で AI の理解精度を上げる |

#### 露出しない方がよい内部情報

| 要素 | 理由 |
|------|------|
| evidenceId | 内部管理用。AI の引用対象にすべきでない |
| sourceClass / coverageType | 内部分類。AI に見せると学習ノイズになりうる |
| Coverage Score / UNLOCKED/LOCKED | 内部品質指標。公開不要 |
| QuestionInstance ID（QIN-xxx） | 内部キー |
| K-ID / M-ID / C-ID / S-ID / T-ID / E-ID | 内部診断 ID。RefBase Constitution D-02 で禁止済み |
| Tier（T1〜T4） | 内部品質管理 |
| needsVerification フラグ | 内部検証状態 |

---

### 2-D. llms.txt / JSON-LD / sitemap ギャップ

#### llms.txt

| 項目 | 現状 | 目標 | 優先度 |
|------|------|------|--------|
| 構造 | Entity 別フラット（全件縦並び）| Cluster 別セクション | Cluster KV 実装後 |
| Question 情報 | なし | 代表 Question（resolvedText）の列挙 | 検討中 |
| Entity 数 | 31件 対応 | 変更なし | — |

#### JSON-LD

| 項目 | 現状 | 目標 | 優先度 |
|------|------|------|--------|
| Organization / Product / Person | ✅ | 変更なし | — |
| FAQPage | ✅ | 変更なし | — |
| additionalType: Cluster URL | ❌ | 追加 | P1 |
| citation[] in acceptedAnswer | ❌ | 追加（sourceUrl から生成）| P1 |
| competitorOf / alternativeTo | ❌ | Relationship 実装後に追加 | P2 |

#### sitemap

| 項目 | 現状 | 目標 | 優先度 |
|------|------|------|--------|
| P-ID 別 priority | ❌ | P-06:0.9 / P-02:0.8 / P-01:0.7 / P-04:0.6 | P2 |
| Cluster Page URL | ❌ | Cluster KV 実装後に追加 | Cluster KV Sprint |

---

## 3. Admin / Internal UI — 必要画面一覧

### 3-A. 現在の Admin 画面が持つもの

- Entity 検索（部分一致）・読み込み
- Reference 一覧・プレビュー・削除
- Entity 削除（slug 確認入力あり）

### 3-B. 必要な追加画面と優先度

| # | 画面名 | 役割 | 優先度 | 備考 |
|---|--------|------|:------:|------|
| 1 | **Coverage Panel** | Entity 別 5軸充足状況 / UNLOCKED・LOCKED Template 表示 | **P0** | Coverage Engine は実装済み（Sprint 2）。画面がないだけ。 |
| 2 | **Evidence Manager** | Entity の Evidence 一覧・coverageType / sourceClass / tier / evidenceId の確認 | **P0** | 現状は Upstash コンソール直接操作。Admin から確認できないと運用できない。 |
| 3 | **Entity Editor** | canonicalName / officialName / primaryCluster / secondaryClusters / alias / searchKeywords の編集 | **P1** | 現状は削除のみ可能。編集手段がない。 |
| 4 | **QuestionInstance Viewer** | Entity 別の resolvedText 確認（Sprint 3 成果物）| **P1** | KV 保存前でもプレビューできれば十分 |
| 5 | **Relationship Editor** | R-01〜R-22 の登録・確認 | **P1** | Relationship KV 実装のタイミングで必要 |
| 6 | **Quality Audit Panel** | L6 検証結果（responseSchema sections OK/NG / citation 充足）| **P1** | L6 実装と同時 |
| 7 | **Registry Viewer** | coverageTypes / responseSchemas / questionTemplates Registry の確認 | **P2** | 現状は KV 直接確認のみ。変更頻度が低いので優先度は低め |
| 8 | **Draft Approval Queue** | L6 承認待ち Reference の確認・承認・差し戻し | **P2** | L7 Publishing Layer 実装時に必要 |
| 9 | **Evidence KV Uploader** | Evidence の投入・更新 UI（現状は Upstash 直接操作）| **P2** | 運用コスト削減。Evidence Architecture v2.0 の sourceClass/supportedPromptTypes 付与も行う |
| 10 | **Technical Debt / Parking Lot** | 既知の負債・保留案件の一覧表示 | Parking Lot | MASTER_ROADMAP.md で代替可能 |

---

## 4. ID 体系のUI扱い

### 4-A. 表示 / 内部 / 廃止の判定

| ID | Studio UIへの表示 | RefBase公開への露出 | 内部処理 | 廃止候補 | 判定根拠 |
|----|:----------------:|:------------------:|:-------:|:-------:|---------|
| **P-ID** | ✅ 表示（全 Phase） | ✅ 表示（Reference Page の分類ラベル） | ✅ | ❌ | 中核 ID。ユーザーもAIも参照する |
| **QT-ID**（QuestionTemplate） | ⚠️ 内部のみ推奨 | ❌ 非露出 | ✅ | ❌ | 管理用 ID。ユーザーには P-ID + Template 文で十分 |
| **QuestionInstance ID** | ⚠️ 内部のみ推奨 | ❌ 非露出 | ✅ | ❌ | KV キー。ユーザーには questionSlug で十分 |
| **Reference ID**（questionSlug） | ✅ 表示（Admin / Phase 4）| ✅ URL 構成要素 | ✅ | ❌ | URL の一部として必要 |
| **Evidence ID**（evidenceId） | ⚠️ Admin のみ | ❌ 非露出 | ✅ | ❌ | 内部追跡・Quality Audit 用 |
| **Cluster ID**（cluster slug） | ✅ 表示（将来 Cluster 画面）| ✅ URL 構成要素 | ✅ | ❌ | Cluster Page の主キー |
| **Relationship ID**（R-01〜R-22） | ⚠️ Admin のみ | ❌ 非露出（RelationshipのValueは露出）| ✅ | ❌ | 内部グラフ構造の管理 |
| **CoverageType** | ✅ Coverage Panel で表示 | ❌ 非露出 | ✅ | ❌ | 内部品質指標。ユーザー（オペレーター）向けに表示する |
| **sourceClass** | ⚠️ Admin Evidence Manager のみ | ❌ 非露出 | ✅ | ❌ | 内部分類。オペレーター向け確認用 |
| **K-ID** | ✅ 表示（Phase 1 / 3 / Report）| ❌ 非露出 | ✅ | ❌ | 診断用として Studio 内部で維持する |
| **M-ID** | ✅ 表示（Phase 2 / 3 / Report）| ❌ 非露出 | ✅ | **要検討** | 後述 |
| **C-ID** | ✅ 表示（Phase 1 / Report） | ❌ 非露出 | ✅ | **要検討** | 後述 |
| **E-ID** | ✅ 表示（Phase 2 / 3 / 4） | ❌ 非露出 | ✅ | **要検討** | 後述 |
| **A-ID** | ✅ 表示（Phase 1） | ❌ 非露出 | ✅ | **要検討** | 後述 |
| **S-ID / T-ID / 構文ID** | ✅ Phase 2 設計ツール内 | ❌ 非露出 | ✅ | **要検討** | 後述 |

---

### 4-B. K-ID / M-ID は新Architectureで必要か

**現在の K-ID / M-ID の役割（Phase 1〜3 の診断ロジック）**

```
AIログ（Observation）
    ↓
K-ID = なぜ出ないかの妨害要因（意味競合・主語浮き・出典競合 等）
C-ID = AI出力の意味パターン分類（信頼形成型・比較評価型 等）
M-ID = Prompt → 出力のセマンティックブロック（認知・差別化・推薦 等）
E-ID = 出現を強化する外部補強要因
A-ID = AI出力の主題カテゴリ（情報提供型・比較型 等）
```

**新Architecture（Coverage Engine / Knowledge Graph）との関係**

| 旧概念 | 新Architecture対応概念 | 吸収されたか |
|--------|----------------------|------------|
| K-ID（妨害要因）| Coverage 不足（Missing CoverageType）/ Relationship 不足 | **部分的に吸収**。Coverage が足りない理由を構造的に説明するが、「意味競合」「構文分断」は Coverage では説明できない診断次元が残る |
| M-ID（セマンティックブロック）| responseSchema の sections / CoverageType | **部分的に吸収**。M-07「解決策提示」→ UseCase Coverage / M-02「差別化」→ Differentiation Coverage。だが 1:1 対応ではない |
| C-ID（AI出力パターン）| P-ID（クエリ意図） | **吸収不完全**。C-ID は「AIがどう答えたか」、P-ID は「ユーザーがどう聞いたか」で視点が異なる。C-ID は診断用として維持価値あり |
| E-ID（補強要因）| Relationship（R-14 integrationOf / R-15 builtOn 等）| **部分的に吸収**。外部接続要因は Relationship で構造化できるが、E-ID の「量的優位」「セマンティック強度」は Relationship に対応なし |
| A-ID（主題カテゴリ）| P-ID との重複が高い | **廃止候補が最も強い**。A-ID の分類（情報提供・比較・選定 等）は P-ID と高度に重複 |

**判定サマリー**

| ID | 判定 | 理由 |
|----|------|------|
| K-ID | **維持（Studio 内部診断用）** | Coverage で説明できない診断次元（意味競合・構文分断）が残る |
| M-ID | **維持（Studio 内部）・段階的に CoverageType と並列表示へ** | 吸収不完全。P-ID / CoverageType と対応表を作成して接続する |
| C-ID | **維持（Studio 内部診断用）** | P-ID と視点が異なる。廃止するとログ診断の解像度が下がる |
| E-ID | **維持（Studio 内部）・Relationship KV 実装後に対応関係を整理** | 外部補強要因として有効。Relationship で代替できない部分がある |
| A-ID | **廃止候補（P-ID と重複）** | P-ID が普及した後は不要になる可能性が高い。Phase 1 から段階的に削減を検討 |
| S-ID / T-ID | **Studio 内部設計ツール専用** | RefBase・生成 HTML には一切出さない（D-02 準拠）。Studio Phase 2 の設計支援にのみ使う |

---

## 5. 実装優先順位

### P0 — これがないと新Architectureを使えない

| # | 実装項目 | 対応Sprint | 現状 |
|---|---------|-----------|------|
| P0-1 | **Coverage Panel**（Admin / Phase 4 に追加）| Sprint 4 開始時 | Coverage Engine は実装済み。画面がない |
| P0-2 | **Evidence Manager**（Admin に追加）| Sprint 4 開始時 | coverageType / sourceClass / tier が Admin で確認できない |
| P0-3 | **QuestionInstance KV 保存**（Sprint 3 の成果を永続化）| Sprint 4 | 現状は生成のみ・KV 未保存 |
| P0-4 | **L4 Evidence Resolver 実装**（L3 との統合）| Sprint 4 | L3 は純粋関数で完成。L4 が未実装で L3 が実際の生成に繋がっていない |

### P1 — あると品質・運用性が大きく上がる

| # | 実装項目 | 対応Sprint | 現状 |
|---|---------|-----------|------|
| P1-1 | **Entity Editor**（Admin に編集機能追加）| Sprint 4 / 5 | 現状は削除のみ。canonicalName / primaryCluster 等が編集できない |
| P1-2 | **JSON-LD: citation[] 追加**（Reference Page）| Sprint 4 / 5 | Evidence の sourceUrl から生成可能 |
| P1-3 | **JSON-LD: additionalType Cluster URL 追加** | Cluster KV Sprint | Cluster KV 実装後 |
| P1-4 | **Quality Audit Panel**（L6 と同時）| Sprint 5 | L6 未実装 |
| P1-5 | **Relationship Editor**（Admin に追加）| Relationship KV Sprint | Relationship KV 未実装 |
| P1-6 | **llms.txt Cluster セクション化** | Cluster KV Sprint | Cluster KV 実装後 |

### P2 — 後回しでよい

| # | 実装項目 | 対応Sprint | 現状 |
|---|---------|-----------|------|
| P2-1 | Registry Viewer（Admin）| Sprint 5 以降 | KV 直接確認で代替可能 |
| P2-2 | Draft Approval Queue | Sprint 6 | L7 実装時 |
| P2-3 | Evidence KV Uploader UI | Sprint 5 以降 | Upstash 直接操作で代替中 |
| P2-4 | sitemap P-ID 別 priority | Sprint 6 以降 | AI 参照への影響は軽微 |
| P2-5 | Cluster Page（/cluster/{id}）| Cluster KV Sprint | Cluster KV 実装後 |
| P2-6 | A-ID 廃止（Phase 1 からの削除）| Sprint 5 以降 | 診断精度への影響を確認してから |

### Parking Lot — 今はやらない

| # | 実装項目 | 理由 |
|---|---------|------|
| PL-1 | Aisle Monitor / Seed Mode | Studio 7層 完成後に設計 |
| PL-2 | Aisle Scope | Monitor 完成後 |
| PL-3 | clientSlug 重複管理 | 現状は手動管理で問題なし |
| PL-4 | RefBase 専用 KV 分離 | Aisle KV 共有で問題なし（規模次第） |
| PL-5 | Question Page（独立 URL）| Question Coverage 拡張後に再評価 |
| PL-6 | M-ID × CoverageType 対応表作成 | Studio 7層完成後に整理 |
| PL-7 | evidenceStrength × P-ID の自動スコアリング | Data Model Review 後 |

---

## 6. 次に実装すべき Sprint 候補

### 推奨 Sprint 順序

```
現在: Sprint 3 完了（QuestionResolver 純粋関数・186件生成確認）
         ↓
Sprint 3.5（任意）: QuestionInstance KV 保存 + Admin Evidence Manager
  → 目的: Sprint 3 の成果を永続化し、オペレーター（自分たち）が Coverage / Evidence を確認できるようにする
  → 実装: KV 保存ロジック追加 / Admin に Evidence 一覧・Coverage 表示
         ↓
Sprint 4: Reference Generator リファクタ（L4 Evidence Resolver + L3 Coverage Check 統合）
  → 目的: TD-001（Coverage Check なしで生成）を解消する
  → 実装: L4 Evidence Resolver 純粋関数 / page-generate.ts への L3/L4 統合
         ↓
Sprint 5: Quality Audit（L6）+ responseSchema 検証
  → 目的: TD-003 / TD-004 を解消する
  → 実装: L6 純粋関数 / Quality Audit Panel UI
         ↓
Sprint 6: Publishing Layer 独立（L7）
  → 目的: TD-005 を解消する。Draft 承認フローの確立。
         ↓
Cluster KV Sprint: Cluster KV 実装 + Cluster Page + llms.txt Cluster セクション
```

### Sprint 3.5 を挟むかどうかの判断

| 挟む場合のメリット | 挟まない場合のメリット |
|-------------------|---------------------|
| Coverage / Evidence が Admin で確認できるようになる | Sprint 4 に早く入れる |
| Sprint 4 でのデバッグが楽になる（Evidence の内容が画面で確認できる）| Coverage は Script で代替可能 |
| QI KV 保存がないと Sprint 4 の動作確認が難しい | |

**推奨: Sprint 3.5 を実施する**。理由：Coverage Panel と Evidence Manager がないと、Sprint 4 以降で「L4 が正しく動いているか」の確認手段が Script 実行のみになり、運用コストが高い。

---

## 7. 補足：現行 Studio の「2つのモード」問題

現行の Aisle Studio は実態として **2つの異なるモード**が共存している。

### モード A — 診断モード（Phase 0〜Report）

```
AI出力ログ（観測）→ K-ID / C-ID / M-ID 分析 → After構文設計 → 突合検証 → 実装計画
```

目的：「なぜ出ないか」の診断と、「どこに何を書けばいいか」の設計指針の提示。  
現状：**稼働中。新Architectureの影響を直接受けない。**

### モード B — 生成・管理モード（Phase 4 の後半部分 + Admin）

```
Entity 登録 → Evidence 投入 → Reference 生成 → KV 保存 → RefBase 公開
```

目的：Knowledge Base の構築・管理。RefBase に公開する Reference を生成・管理する。  
現状：**稼働中だが、新Architecture（7層 / Coverage / QuestionTemplate）と未統合。**

### このギャップが何を意味するか

- モード A と モード B は現状で**UI 上に境界線がない**。Phase 4 が診断の出口かつ生成の入口になっている。
- 新Architecture の 7層 Pipeline は**モード B に対応する**。
- モード A（診断側）の K-ID / M-ID / C-ID / E-ID は、モード B のどのフィールドに対応するかが**明示されていない**。
- これが「Coverage があるのにE-IDも必要か？」「M-IDとCoverageTypeは同じものか？」という混乱の根本原因。

**UI上での分離方針（提案・今回は設計のみ）**

```
Aisle Studio
  ├── 診断モード（Phase 0〜Report）: 出現/非出現 → K-ID/M-ID 診断 → 実装指針
  └── 知識管理モード（新設）: Entity → Evidence → Coverage Check → Reference 生成・管理
```

2つのモードを同一アプリに共存させるか、別アプリに分離するかは、今後の設計判断。今回は**現状の確認にとどめる**。

---

*このレポートは現在地の記録。実装の指示ではない。各ギャップの解消タイミングは 5節の優先順位に従う。*
