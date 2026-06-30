# Aisle Studio UX Separation Report v1.0

**作成日**: 2026-06-29  
**目的**: Aisle Studio を「Diagnosis Mode」と「Knowledge Design Mode」に UX 上で分離するための設計整理。  
**制約**: 実装なし・コード変更なし・新設計概念の追加なし。

---

## 0. なぜ分離するのか

現在の Aisle Studio は一本の Phase フローとして構成されているが、内部に性質の異なる2つの仕事が混在している。

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Report
  観測       診断       設計       突合       実装・生成    サマリ
  ↑─────────────────────────────────────────────↑
           これが Diagnosis Mode の領域
                                  ↑──────────────↑
                      ここが Knowledge Design Mode に近いが
                          2つが相乗りしている
```

Phase 4 に「実装計画（診断の出力）」と「Reference 生成（知識の構築）」が同居しているため、次の問題が起きている：

1. `K-ID / M-ID / C-ID` と `CoverageType / Evidence` のどちらがどこに属するかが曖昧
2. Coverage Panel を Phase 4 に追加しようとすると、診断情報と知識管理情報が混在した画面になる
3. 「診断なしに Knowledge Design Mode を使いたい」ユースケースに対応できない（例：新しい Entity を登録して Coverage を確認するだけ）

**分離の目的は「Phaseフローの解体」ではない。** 診断フロー（Phase 0〜Report）は現状のまま維持する。Knowledge Design Mode を**別途アクセスできる領域**として追加する設計にする。

---

## 1. Diagnosis Mode の定義

### 1-A. 属する画面

| Phase | 画面名 | Diagnosis Mode に属するか | 理由 |
|-------|--------|:-:|------|
| Phase 0 | ログ取得 | ✅ | AI出力の観測。Observation Layer の入口 |
| Phase 1 | 因果分析 | ✅ | K-ID / C-ID / A-ID による出現失敗要因の分析 |
| Phase 2 | 出現設計 | ✅ | M-ID / E-ID による After構文・補強設計 |
| Phase 3 | 突合検証 | ✅ | 設計案 × 現在地の差分診断（到達可能性算出）|
| Phase 4（前半）| 実装計画 | ✅ | 突合診断の出力を実装アクションに変換する部分 |
| Phase 4（後半）| Reference 生成・管理 | ❌ | Knowledge Design Mode に属する |
| Report | 診断レポート | ✅ | 診断全体のサマリ出力 |

### 1-B. 目的

> AIが自社・自サービスをなぜ出力しないか（または誤った文脈で出力するか）の構造的要因を分析し、改善の設計指針を提供する。

**入力**: AI出力ログ（appeared / not appeared）/ 競合分析結果 / 会社名  
**出力**:
- K-ID スコアマトリクス（出現阻害要因の優先度）
- C-ID 分布（AI出力の意味パターン）
- M-ID マッピング（必要な意味接点の特定）
- After構文案（E-ID補完つき）
- 到達可能性スコア（SB-ID 別）
- 実装アクションリスト（優先度・配置先ページ・期待効果）

### 1-C. Knowledge Design Mode に渡すべきもの

| 渡すもの | 渡す理由 |
|---------|---------|
| **不足 CoverageType のヒント** | K-ID の分析結果から「Differentiation Evidence が弱い（K-01 意味競合）」等、Evidence 補強の方向性を Knowledge Design Mode に接続できる |
| **実装アクションリスト** | Phase 4 の実装計画を「どの P-ID の Reference を生成すべきか」の指示として Knowledge Design Mode に引き渡す |
| **clientSlug** | 分析対象の Entity を Knowledge Design Mode で引き続き作業するための識別子 |

### 1-D. Diagnosis Mode だけで完結するもの

| 完結するもの | 理由 |
|------------|------|
| K-ID / M-ID / C-ID の算出・表示 | Knowledge Design Mode に持ち込む必要がない内部診断情報 |
| 到達可能性スコア | 診断値。知識管理には直接不要 |
| After構文の設計 | Reference 生成の素材にもなりうるが、診断側で完結させてよい |
| 診断レポート出力 | クライアントへの説明用。Knowledge Design Mode は関与しない |

---

## 2. Knowledge Design Mode の定義

### 2-A. 属する画面（現行 UI より）

| 現行 UI | Knowledge Design Mode に属するか | 理由 |
|--------|:-:|------|
| Phase 4（後半）— Reference 生成・管理テーブル | ✅ | Entity に紐づく Reference の生成・更新・削除 |
| Admin — Entity 検索・確認 | ✅ | Entity の読み込みと状態確認 |
| Admin — Reference プレビュー | ✅ | Reference の内容確認 |
| Admin — Entity 削除 | ✅ | Entity ライフサイクル管理 |
| Admin — Reference 削除 | ✅ | Reference ライフサイクル管理 |
| Phase 4（前半）— EvidenceWarningPanel | △ | Evidence の不足状況の表示は Knowledge Design Mode 寄りだが、診断の出力でもある |

**現行 UI で存在しない Knowledge Design Mode の領域**:

| 領域 | 現在の代替手段 |
|------|-------------|
| Coverage Panel（5軸充足確認）| Script 実行のみ |
| Evidence Manager（一覧・coverageType / sourceClass 確認） | Upstash コンソール直接操作 |
| Entity Editor（canonicalName / primaryCluster 等の編集）| なし（削除→再作成のみ）|
| Relationship Manager | なし（未実装）|
| QuestionInstance Viewer | なし（KV 未保存）|
| Quality Audit Panel | なし（L6 未実装）|
| Publishing Status | 部分的（"Aisle+RefBase" / "Aisleのみ" の二択のみ）|

### 2-B. 目的

> Entity・Evidence・Relationship・Reference を構造的に設計・管理し、RefBase に高品質な知識を公開する。

**入力**:
- Entity 情報（canonicalName / entityType / primaryCluster 等）
- Evidence（title / description / sourceClass / coverageType / tier 等）
- QuestionTemplate（KV 登録済み・6件）
- Diagnosis Mode から受け取った「注力すべき P-ID のヒント」（任意）

**出力**:
- KV に保存された QuestionInstance
- Coverage 充足状況（UNLOCKED / LOCKED の P-ID 一覧）
- KV に保存された Reference（L6 承認後）
- RefBase に公開された Reference ページ

### 2-C. RefBase に渡すもの

| 渡すもの | KV キー |
|---------|---------|
| Entity メタデータ | `refbase:company:{slug}` |
| Evidence | `evidence:{slug}` |
| QuestionInstance | `refbase:questioninstance:{slug}/*`（Sprint 3.5 以降）|
| Reference（L6 承認済み）| `refbase:ref:{slug}/{questionSlug}` |
| Reference インデックス | `refbase:index:{slug}` / `refbase:index:all` |

### 2-D. Monitor に渡すもの（将来）

| 渡すもの | 理由 |
|---------|------|
| Reference URL 一覧 | Monitor が巡回対象とする URL リスト |
| Entity × P-ID マトリクス | どの質問パターンで出現を確認すべきかの定義 |
| Coverage 充足状況 | Monitor の観測優先度（UNLOCKED の P-ID を優先確認）|

---

## 3. K-ID / M-ID / C-ID / CoverageType の役割整理

### 3-A. 各IDの定義と「何を答えるか」

| ID | 答える問い | 視点 | データソース |
|----|-----------|------|-------------|
| **K-ID** | なぜ AI はこの Entity を出力しなかったか | AI 出力の失敗分析 | Appearance Log（非出現パターン）|
| **M-ID** | この Entity が AI に届くために何の意味接点が必要か | 構文・意味設計 | Appearance Log + 構文分析 |
| **C-ID** | AI の出力はどんな意味パターンで構成されているか | AI 出力の特徴分類 | Appearance Log（出現・非出現両方）|
| **A-ID** | AI は何について答えているか（主題カテゴリ）| AI 出力の主題分類 | Appearance Log |
| **CoverageType** | この Entity の知識は何軸で充足しているか | Knowledge の充足度 | Evidence KV |

### 3-B. 仮説検証：分離か統合か

仮説：**K-ID / M-ID / C-ID は Diagnosis Mode に残し、CoverageType は Knowledge Design Mode に置く**

| 仮説の要素 | 妥当か | 根拠 |
|-----------|:------:|------|
| K-ID は Coverage に吸収しない | ✅ 妥当 | K-ID は「AI 回答上の失敗要因」（意味競合・構文分断・出典競合 等）。Coverage は「Knowledge の充足」。全く異なる次元を測っている。例: Capability Evidence が十分でも「意味競合（K-01）」で出ないことがある |
| M-ID は Coverage に吸収しない | ✅ 妥当 | M-ID は「AI が出力するために必要な意味接点の構造」（どんな論理の流れで推薦されるか）。Coverage は「知識の軸が揃っているか」。例: M-07「解決策提示」は UseCase Coverage と近いが、M-05「世界観・価値観提示」は Coverage に対応軸がない |
| C-ID は P-ID と異なる | ✅ 妥当 | P-ID は「ユーザーの質問意図」、C-ID は「AI の出力パターン」。視点が逆。同じプロンプト（P-01）でも C-01「信頼形成型」/ C-02「比較評価型」等の異なる C-ID の回答が返ってくる |
| A-ID は P-ID と重複する | ✅ 妥当・廃止候補 | A-ID（情報提供型・比較型・選定型 等）は P-ID（P-01 選定 / P-02 比較 等）とほぼ同義。診断精度への影響を確認しながら段階的に削減を検討する |
| CoverageType は Knowledge Design Mode に置く | ✅ 妥当 | CoverageType は Evidence の分類軸であり、Knowledge の質を管理するための概念。Appearance Log には依存しない |

### 3-C. UI での表示分担

```
Diagnosis Mode の画面に表示するもの:
  K-ID（出現阻害要因）
  M-ID（意味接点）
  C-ID（AI出力パターン）
  E-ID（補強要因）
  SB-ID / 到達可能性
  ─────────────────────────────────────────
  ↓ Diagnosis Mode から Knowledge Design Mode へのブリッジ
  「P-01 と P-03 に注力せよ」「Differentiation が弱い可能性あり」等のヒント

Knowledge Design Mode の画面に表示するもの:
  CoverageType（Identity / Capability / Differentiation / Credibility / UseCase）
  Coverage Score（UNLOCKED / LOCKED）
  Evidence（sourceClass / tier / coverageType）
  QuestionTemplate / QuestionInstance
  Relationship
  Reference（Draft / Published）
  Quality Audit 結果
```

### 3-D. 交差する概念の扱い

| 概念 | Diagnosis Mode での扱い | Knowledge Design Mode での扱い |
|------|------------------------|-------------------------------|
| **P-ID** | ログ分類・分析軸として使用 | Reference 生成・Coverage の軸として使用 |
| **E-ID** | 補強要因の設計（Phase 2）| Relationship（R-14 integrationOf 等）が将来代替 |
| **EvidenceWarningPanel** | 診断出力として現 Phase 4 に表示 | Knowledge Design Mode の Evidence Manager に移管推奨 |

---

## 4. Studio 全体の新しい画面構成案

### 設計方針

1. **既存の Phase 0〜5 フローは崩さない。** Diagnosis Mode としてそのまま維持する。
2. **Knowledge Design Mode は既存フローとは独立したエントリーポイントで追加する。** Sidebar に新しいセクションを追加する形。
3. **Phase 4 は「橋渡し」として残す。** 実装計画（診断出力）と、知識管理への導線リンクを持つ画面として機能させる。

### Sidebar 再設計案

```
┌──────────────────────────────┐
│  Aisle Studio                │
├──────────────────────────────┤
│  ── Diagnosis Mode ──        │
│  [ Phase 0 ]  ログ取得        │
│  [ Phase 1 ]  因果分析        │
│  [ Phase 2 ]  出現設計        │
│  [ Phase 3 ]  突合検証        │
│  [ Phase 4 ]  実装設計        │
│  [ Report  ]  診断レポート     │
├──────────────────────────────┤
│  ── Knowledge Design ──      │
│  [ Entity     ]  Entity管理   │
│  [ Evidence   ]  Evidence管理 │
│  [ Coverage   ]  Coverage確認 │
│  [ Relation.  ]  関係管理     │（将来）
│  [ Questions  ]  問い管理     │（将来）
│  [ References ]  Reference管理│
│  [ Audit      ]  品質確認     │（将来）
├──────────────────────────────┤
│  ── Admin ──                 │
│  [ Admin ]  管理・削除         │
└──────────────────────────────┘
```

---

### Diagnosis Mode 画面

#### D-1. Emergence Log Collector（現 Phase 0）

| 項目 | 内容 |
|------|------|
| 目的 | AI出力ログの収集・P-ID分類 |
| 表示するデータ | 試行結果（appeared / not appeared）/ 出力本文 / P-ID |
| 編集できるデータ | プロンプト入力 / AIモデル選択 / 試行回数 |
| 参照するID | P-ID |
| 優先度 | **P0**（稼働中） |

#### D-2. Emergence Analysis（現 Phase 1）

| 項目 | 内容 |
|------|------|
| 目的 | K-ID / C-ID / A-ID による出現失敗要因の分析 |
| 表示するデータ | K-ID スコアマトリクス / C-ID 分布 / A-ID / 出現率 / 競合分析 |
| 編集できるデータ | なし（AI 分析の実行のみ）|
| 参照するID | K-ID / C-ID / A-ID / P-ID |
| 優先度 | **P0**（稼働中） |

#### D-3. Appearance Design（現 Phase 2）

| 項目 | 内容 |
|------|------|
| 目的 | M-ID / E-ID による After構文設計と意味補強 |
| 表示するデータ | M-ID マッピング / After構文 / E-ID補完 / 到達可能性評価 |
| 編集できるデータ | E-ID補完の選択 |
| 参照するID | M-ID / E-ID / P-ID |
| 優先度 | **P0**（稼働中） |

#### D-4. Gap Verification（現 Phase 3）

| 項目 | 内容 |
|------|------|
| 目的 | 設計案 × 現在地の差分を可視化。SB-ID 別到達可能性算出 |
| 表示するデータ | SB-ID / 意味接点 / 困難要因（接続欠落・主語浮き・意味競合・構文分断）/ K-ID / 到達可能性 / 設計指針 |
| 編集できるデータ | なし（AI 分析の実行のみ）|
| 参照するID | SB-ID / K-ID / M-ID / P-ID |
| 優先度 | **P0**（稼働中） |

#### D-5. Implementation Roadmap（現 Phase 4 前半）

| 項目 | 内容 |
|------|------|
| 目的 | 突合診断の出力を実装アクションリストに変換する。Knowledge Design Mode への引き渡し |
| 表示するデータ | 実装アクションテーブル（優先度 / アクション / 配置先 / E-ID / 期待効果）/ 「Knowledge Design に移動」リンク |
| 編集できるデータ | 実装対象 SB-ID の選択 |
| 参照するID | SB-ID / E-ID / P-ID |
| 優先度 | **P0**（稼働中） |
| **新規追加** | Knowledge Design Mode への導線リンク（「この Entity の Coverage を確認する」ボタン等）|

#### D-6. Diagnosis Report（現 Report）

| 項目 | 内容 |
|------|------|
| 目的 | 出現設計の診断結果サマリ。クライアント共有用 |
| 表示するデータ | 出現率チャート / C-ID 分布 / K-ID スコア / M-ID 分布 / E-ID 勝因 / 実装優先度マトリクス |
| 編集できるデータ | なし（印刷・エクスポートのみ）|
| 参照するID | K-ID / M-ID / C-ID / E-ID / P-ID |
| 優先度 | **P0**（稼働中） |

---

### Knowledge Design Mode 画面

#### K-1. Entity Overview

| 項目 | 内容 |
|------|------|
| 目的 | Entity の全体状態を1画面で確認する。Coverage・Reference 数・Evidence 数を一覧表示 |
| 表示するデータ | Entity 一覧（slug / canonicalName / entityType / primaryCluster / Coverage スコア / UNLOCKED Template 数 / Reference 数 / Evidence 数）|
| 編集できるデータ | なし（Overview は読み取り専用）|
| 参照するID | entitySlug / Cluster slug / CoverageType |
| 優先度 | **P1** |
| 備考 | 現行 Admin の Entity 検索を拡張する形で実装可能 |

#### K-2. Evidence Manager

| 項目 | 内容 |
|------|------|
| 目的 | Entity の Evidence 一覧を確認・整理する |
| 表示するデータ | Evidence 一覧（evidenceId / title / sourceClass / coverageType[] / tier / needsVerification / confidence）|
| 編集できるデータ | coverageType の手動上書き / sourceClass の確認・修正（Override Table 操作）|
| 参照するID | evidenceId / CoverageType / sourceClass / Tier（T1〜T4）|
| 優先度 | **P0** |
| 備考 | 現状は Upstash コンソール直接操作のみ。これがないと Evidence の状態を確認できない |

#### K-3. Coverage Panel

| 項目 | 内容 |
|------|------|
| 目的 | Entity ごとの 5軸 Coverage 充足状況と UNLOCKED / LOCKED Template を確認する |
| 表示するデータ | CoverageType 5軸の充足状況（✅ / ❌）/ UNLOCKED Template 一覧（promptTypeId / templateText）/ LOCKED Template と missingTypes |
| 編集できるデータ | なし（Coverage は Evidence から算出。Evidence Manager で Evidence を変更して Coverage を変える）|
| 参照するID | CoverageType / QuestionTemplate ID / P-ID |
| 優先度 | **P0** |
| 備考 | Coverage Engine は Sprint 2 で実装済み。API を呼ぶだけで表示できる |

#### K-4. Reference Manager（現 Phase 4 後半を移管）

| 項目 | 内容 |
|------|------|
| 目的 | Entity に紐づく Reference の生成・確認・更新・削除 |
| 表示するデータ | Reference 一覧（P-ID / resolvedText / RefBase URL / Publishing ステータス / 生成日時）|
| 編集できるデータ | Reference 生成（add）/ 更新（update）/ 削除 |
| 参照するID | P-ID / questionSlug / QuestionInstance ID |
| 優先度 | **P0**（現行 Phase 4 から移管。機能は変えない） |
| 備考 | 現行 Phase 4 後半の PublishedPageTable をそのまま移植する |

#### K-5. Relationship Manager

| 項目 | 内容 |
|------|------|
| 目的 | Entity 間の Relationship（R-01〜R-22）を登録・確認する |
| 表示するデータ | Relationship 一覧（entityId / type / targetEntityId）/ 未登録の必須 Relationship（P-ID 別）|
| 編集できるデータ | Relationship の登録・削除 |
| 参照するID | Relationship ID（R-01〜R-22）|
| 優先度 | **P1** |
| 備考 | Relationship KV 実装（Sprint 4 以降）と同時 |

#### K-6. Question Panel

| 項目 | 内容 |
|------|------|
| 目的 | QuestionTemplate の確認と、Entity 別 QuestionInstance の閲覧 |
| 表示するデータ | QuestionTemplate 一覧（templateId / promptTypeId / templateText / requiredCoverage）/ Entity 別 QuestionInstance（instanceId / resolvedText / UNLOCKED 状態）|
| 編集できるデータ | なし（Template は Registry 管理・Instance は自動生成）|
| 参照するID | QT-ID / QIN-ID / P-ID / CoverageType |
| 優先度 | **P1** |
| 備考 | Sprint 3 の QuestionResolver 成果物を表示する画面 |

#### K-7. Quality Audit Panel

| 項目 | 内容 |
|------|------|
| 目的 | Reference Draft が responseSchema を満たしているかを確認する（L6 の UI）|
| 表示するデータ | sections チェックリスト（required / optional / citationRequired 充足）/ issues 一覧 |
| 編集できるデータ | 差し戻し（ng）/ 承認（ok）|
| 参照するID | P-ID / QT-ID / responseSchema sections |
| 優先度 | **P1** |
| 備考 | L6 実装（Sprint 5）と同時 |

#### K-8. Publishing Status

| 項目 | 内容 |
|------|------|
| 目的 | Reference の公開状態を管理する（L7 の UI）|
| 表示するデータ | Draft / Approved / Published の状態 / RefBase URL / 最終更新日時 |
| 編集できるデータ | 承認（Draft → Approved）/ 公開（Approved → Published）|
| 参照するID | questionSlug / P-ID |
| 優先度 | **P2** |
| 備考 | L7 実装（Sprint 6）と同時 |

---

## 5. UI 実装優先順位

### P0 — これがないと知識管理ができない

| # | 画面 | 対応 Sprint |
|---|------|-----------|
| 1 | K-2 Evidence Manager | **Sprint 3.5** |
| 2 | K-3 Coverage Panel | **Sprint 3.5** |
| 3 | K-4 Reference Manager（Phase 4 後半を移管） | **Sprint 3.5** |
| 4 | K-2/K-3 のための QuestionInstance KV 保存 | **Sprint 3.5** |

### P1 — あると品質・判断が大きく改善する

| # | 画面 | 対応 Sprint |
|---|------|-----------|
| 5 | K-1 Entity Overview | Sprint 4 |
| 6 | K-6 Question Panel | Sprint 4 |
| 7 | D-5 に Knowledge Design への導線リンク追加 | Sprint 4 |
| 8 | K-5 Relationship Manager | Relationship KV Sprint |
| 9 | K-7 Quality Audit Panel | Sprint 5 |

### P2 — 後回しでよい

| # | 画面 | 対応 Sprint |
|---|------|-----------|
| 10 | K-8 Publishing Status | Sprint 6 |
| 11 | Sidebar の Mode 分離（現行フローを崩さない形） | Sprint 4〜5 |
| 12 | Registry Viewer | Sprint 5 以降 |

### Parking Lot — 今はやらない

| # | 画面 |
|---|------|
| 13 | Monitor 連携画面 |
| 14 | Scope（出現観測ダッシュボード）|
| 15 | A-ID 廃止・Phase 1 の簡略化 |
| 16 | M-ID × CoverageType の対応表ビュー |

---

## 6. 次に実装すべき 1 Sprint の提案

### 推奨: Sprint 3.5B — Coverage Panel + Evidence Manager

**理由**: Sprint 3.5A（Mode Separation Shell）は Sidebar の再構成であり、既存のフローを壊さないための骨格作業。しかし「画面の枠だけ作る」作業は優先度が低い。

**Coverage Panel と Evidence Manager を先に実装する**ことで：

1. **Coverage Engine（Sprint 2 実装済み）が初めて画面で確認できる**
2. **Evidence の coverageType / sourceClass の状態が Admin から見える**（現状は Upstash コンソール直接操作のみ）
3. **Sprint 4 の L4 Evidence Resolver の動作確認が画面で行える**
4. Mode Separation は Coverage Panel / Evidence Manager を「追加する場所」を決める設計であるため、実装しながら自然に決まる

### Sprint 3.5B の定義

```
Sprint 3.5B — Coverage Panel + Evidence Manager

目的:
  Coverage Engine の結果を画面で確認できるようにする。
  Evidence の状態（coverageType / sourceClass / tier）を Admin から確認できるようにする。

実装対象:
  1. Admin 画面に Coverage タブを追加
     - Entity 選択後、5軸 Coverage の UNLOCKED / LOCKED を表示
     - UNLOCKED Template の resolvedText を一覧表示
  
  2. Admin 画面に Evidence タブを追加
     - Entity の Evidence 一覧を表示（evidenceId / title / sourceClass / coverageType[] / tier）
     - 件数・分布サマリの表示

  3. QuestionInstance の KV 保存
     - Sprint 3 の resolveAllQuestions() を使い、KV に保存するスクリプトを追加
     - Coverage Panel から「解決済み問い文」を確認できるようにする

KV 書き込み: QuestionInstance のみ（Coverage は算出のみ・KV 保存しない）
AI 呼び出し: なし
Reference 生成: なし
既存機能の変更: なし（Admin の既存タブ・既存フローは維持）

Definition of Done:
  - Admin 画面で Entity を選択 → Coverage Panel タブ → 5軸充足 + UNLOCKED Template が確認できる
  - Admin 画面で Entity を選択 → Evidence タブ → Evidence 一覧が確認できる
  - QuestionInstance が KV に保存されている（refbase:questioninstance:{entityId}/* 等）
```

### Sprint 3.5A（Mode Separation Shell）を先に実施すべき場合

次のような理由がある場合は 3.5A を先にすることを推奨する：

- Phase 4 に Coverage Panel を置くことへの抵抗感がある（モードが混在する）
- Sidebar の Knowledge Design Mode セクションに Coverage / Evidence を最初から配置したい
- 複数人で開発する場合に「画面の場所」を先に決めておきたい

ただし現状は 1 人での運用のため、**Sprint 3.5B（機能優先）を推奨する。**

---

*このレポートは設計の整理であり、実装の指示ではない。次の実装 Sprint は Sprint 3.5B — Coverage Panel + Evidence Manager。*
