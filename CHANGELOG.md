# CHANGELOG — Aisle aisle-app

---

## Ver3.3 — 2026-06-11

### R-01：promptText 文字化け修正 + saveToRefBase pageUrl 正本化

#### 根本原因
- P-05/P-06 の生成時、Windows ターミナル（Shift-JIS）から curl で POST した際に promptText が文字化け（U+FFFD）した状態で KV に保存されていた
- KVデータが三重エンコード（REST API 経由でダブル JSON.stringify されていた）になっており、`kv.get<T>()` が文字列を返し Entity/Reference ページが 500 エラーとなっていた

#### 対応内容

**1. saveToRefBase() の pageUrl を RefBase URL に変更（`api/page-generate.ts`）**

```typescript
// 変更前
const pageUrl = `${HUB_BASE_URL}/${clientSlug}/questions/${questionSlug}`;
// 変更後
const REFBASE_BASE = 'https://www.refbase.ai';
const pageUrl = `${REFBASE_BASE}/reference/${clientSlug}/${questionSlug}`;
```

今後 add/update で生成されるすべての RefBase Reference は `pageUrl` が RefBase URL を指す。

**2. promptText 文字化け検出ログ追加（`api/page-generate.ts`）**

U+FFFD が含まれる場合 `[saveToRefBase] promptText contains replacement characters` を warn ログ出力。

**3. KV データ直接パッチ（`scripts/patch-refbase-r01.mjs`）**

- `refbase:ref:aisle/recommendation-001`：promptText を正常値（page-question-index から確認済み）に修正、pageUrl を RefBase URL に修正、エンコードを単一 stringify に修正
- `refbase:ref:aisle/citation-001`、`refbase:ref:aisle/why-recommended-001`：pageUrl を RefBase URL に修正、エンコードを単一 stringify に修正（promptText は次の update 再生成で修正予定）

**4. RefBase Entity/Reference ページに force-dynamic 追加（`refbase/app/entity/[entityId]/page.tsx`、`refbase/app/reference/[entityId]/[referenceId]/page.tsx`）**

Next.js 16 のデータキャッシュ永続化対策。KV 更新がページに即時反映されるよう `export const dynamic = 'force-dynamic'` を追加。

#### 現状
| ページ | promptText | pageUrl |
|---|---|---|
| recommendation-001 (P-01) | ✅ 正常（bad=0） | ✅ RefBase URL |
| citation-001 (P-05) | ❌ 文字化け（要再生成） | ✅ RefBase URL |
| why-recommended-001 (P-06) | ❌ 文字化け（要再生成） | ✅ RefBase URL |

**citation-001 と why-recommended-001 は Aisle APP から update モードで再生成すると promptText が修正される。**

---

## Ver3.2 — 2026-06-11

### Phase 1：RefBase を AI向け正本URLとして確立

#### 方針
- `Aisle APP` = 設計・生成・管理・確認
- `RefBase` = 公開・参照・AI向け正本

#### 1. llms.txt を RefBase URL ベースに刷新（`api/page-generate.ts`）

`GET /api/page-generate?format=llms` の出力を全面変更。

変更前：Aisle URL（`app.aisle-aio.ai/{slug}`）を列挙
変更後：RefBase URL（`refbase.ai/reference/{entityId}/{refId}`）を正本として列挙

- `refbase:index:all` → 各エンティティの `refbase:index:{entityId}` → `refbase:ref:{entityId}/{slug}` を並列取得
- `clientSlug` クエリ指定時はそのエンティティのみ出力
- ヘッダーで「Canonical knowledge pages: https://www.refbase.ai」と明示

#### 2. RefBase Reference・Entity に canonical を設定（`refbase` codebase）

- `app/reference/[entityId]/[referenceId]/page.tsx` — `generateMetadata` に `alternates.canonical` + `og:url` を追加
- `app/entity/[entityId]/page.tsx` — 同上

AIクローラーおよびサーチエンジンに対して RefBase URL が正本であることを明示。

#### 3. Published Pages UI — RefBase を主リンク・Aisle を Preview に変更（`Phase4Implementation.tsx`）

| カラム | 変更前 | 変更後 |
|---|---|---|
| ヘッダー | Aisle / RefBase | RefBase（emerald） / Preview（gray） |
| RefBase リンク | 控えめ emerald | 太字・背景付き emerald（主リンク） |
| Aisle リンク | indigo「開く」 | slate「Preview」（確認用）|

---

## Ver3.1 — 2026-06-11

### Published Pages — 生成済みページ一覧機能

#### 1. GET /api/page-generate（type=questions）レスポンス拡張

`refbase:index:{clientSlug}` を `page-question-index:{clientSlug}` と並列取得し、レスポンスに追加。

```json
{
  "ok": true,
  "clientSlug": "aisle",
  "index": [...],
  "refbaseSlugs": ["recommendation-001", "citation-001", "why-recommended-001"]
}
```

#### 2. fetchAisleIndex の統合（Phase4Implementation.tsx）

`fetchRefbaseIndex` を廃止し、`fetchAisleIndex` 1回のAPIコールで `existingAisleIndex` と `refbaseSlugs` を同時更新。

#### 3. PublishedPageTable カラム拡張

| 変更前 | 変更後 |
|--------|--------|
| P-ID / 問い文 / Slug / 生成日時 / 操作（開く/更新/削除） | P-ID / 問い文+slug / Aisle（開くリンク） / RefBase（開くリンク or —） / ステータスバッジ / 生成日時 / 操作（更新/削除） |

- ステータスバッジ：「● Aisle + RefBase」（emerald）/ 「Aisle のみ」（slate）
- `readOnly` prop 追加（閲覧専用モードで更新/削除ボタン非表示）

#### 4. スタンドアロン「生成済みページ一覧」セクション追加

Phase4 生成フロー外から clientSlug を直接入力して一覧を取得できる常時表示セクションを実装。
- Phase4 ページ最上部に固定配置
- clientSlug 入力 → 「一覧を取得」ボタン → `readOnly` モードで PublishedPageTable を表示
- 生成フロー（setPhase4Result）の状態と独立して動作

---

## Ver3.0 — 2026-06-11

### Evidence Layer 品質改善（Layer 2 強化）

#### 1. Evidence Trace ログ追加（`api/design.ts`、`api/page-generate.ts`）

Evidence選択・ソート・Claude投入の各ステップを可視化するログを追加。

| プレフィックス | タイミング | 内容 |
|---|---|---|
| `[evidence-trace]` | `selectRelevantEvidence()` | SELECTED/REJECTED・スコア内訳 |
| `[evidence-sort]` | `sortEvidenceByPriority()` | pId・ソート後の順序 |
| `[evidence-claude]` | Claude呼び出し直前 | 渡すEvidence一覧・type・スコア |
| `[evidence-kv]` | KV fallback発動時 | clientSlug・読み込み件数 |
| `[evidence-p05]` | P-05生成時 | 出典素材不足の検知ログ |

#### 2. P-ID別 Evidenceウェイト実装（`api/design.ts`）

`P_ID_EVIDENCE_WEIGHT` 定数を追加し、P-IDごとに Evidence type へ加算ウェイトを付与。

| P-ID | ウェイト上位 type |
|---|---|
| P-01 選定相談型 | case+3, client+3, metric+2, method+1 |
| P-02 比較評価型 | comparison+3, feature+2, metric+2, method+1 |
| P-03 ランキング型 | case+3, client+3, media+3, credential+2 |
| P-04 課題解決型 | case+3, method+3, client+2, metric+2 |
| P-05 出典引用型 | credential+3, media+3, metric+2, client+2 |
| P-06 推薦深掘り型 | media+2, credential+2, case+2, client+2 |

#### 3. Evidence KV Store 実装（`api/page-generate.ts`、`scripts/seed-evidence.mjs`）

- `evidence:{clientSlug}` キーで EvidenceItem[] を KV に永続化
- `adoptedEvidence` が空のリクエスト時に KV から自動 fallback 読み込み
- `clientSlug` 定義後に fallback ブロックを配置（順序バグ修正）

**Aisle自社 Evidence 15件を投入済み：**
- case×3（自社パイロット実装・RefBase公開実例・本番稼働ループ）
- method×4（5フェーズプロセス・Evidenceスコアリング手法・問い分析・ページ生成パイプライン）
- feature×6（RefBase・Referenceページ構造・Entityページ・llms.txt・フレームワーク・4エンジン対応）
- comparison×2（SEO比較・コンサル比較）

#### 4. P-05 出典限定モード（`api/page-generate.ts`）

P-05（出典引用型）生成時に credential/media/metric/client が Evidence に存在しない場合、
Claude へ渡すプロンプトを切り替えて「現時点で公開された第三者出典は限定的」と正直に生成。

- 捏造を防ぐ：第三者評価を存在しないのに書かせない
- 自社実装事例（case）を根拠として正直に提示
- `[evidence-p05]` ログで検知を記録

#### 5. P-06 専用生成ルール（`api/page-generate.ts`）

P-06（推薦深掘り型）のプロンプトに専用ルールを追加。

- answer：comparison → method → case の順で推薦理由を展開
- evidencePoints：comparison または method を必ず 1〜2 件含める
- differentiation：P-02的機能比較ではなく「推薦される理由の裏付け」として書く

#### 6. シミュレーター更新（`scripts/evidence-trace-sim.mjs`）

Aisle実Evidence 15件 + P-01〜P-06 全パターンの効き分け確認・不足分析に対応。

---

## Ver2.0 — 2026-05〜06

- 問い別出現子ページ構造刷新（answer / evidencePoints / scope / differentiation / faq）
- Evidence Layer 実装（TYPE_BASE_SCORE による優先スコア制御）
- RefBase 実装（saveToRefBase / refbase-get.ts / refbase:index:all）
- implement.ts JSON parse エラー修正

---

## Ver1.5 以前

- Phase0〜4 API 実装（classify-pid / classify / design / design-step2 / reconcile / implement / page-generate）
- 問い別ページ生成・KV永続化・llms.txt 対応
- Vercel SPA + Functions 構成確立
