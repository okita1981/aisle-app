# CLAUDE.md — Aisle aisle-app 実装ガイダンス

最終更新: 2026-07-01（Entity追加 Sprint — Developer Ecosystem Super Cluster パイロット完了）
本番URL: https://app.aisle-aio.ai
リポジトリ: `C:\Users\kousu\OneDrive\Desktop\CLAUDE Aisle\aisle-app`

---

## 0a. Entity追加 Sprint — Developer Ecosystem Super Cluster（2026-07-01・パイロット完了）

### Cluster階層設計（確定）

`developer-ecosystem` を **Super Cluster** とし、将来的に機能軸の Sub Cluster へ分割する設計とする。

```
developer-ecosystem（Super Cluster）
  ├── hosting（Vercel等）
  ├── backend-platform（Supabase等）
  ├── container（Docker等・未着手）
  ├── devops（GitHub, GitLab等）
  └── infrastructure-as-code（HashiCorp等・未着手）
```

現状の実装：Entity の `primaryCluster` にSub Cluster名を、`secondaryClusters` に`developer-ecosystem`を設定する形で表現する（Cluster自体のKVレジストリ`refbase:cluster:*`は未実装のため、Entityフィールドのみで表現）。

### パイロット完了：GitHub / Vercel / Supabase（2026-07-01）

| slug | entityType | primaryCluster | secondaryClusters | parentEntity |
|---|---|---|---|---|
| github | company | devops | developer-ecosystem | microsoft |
| vercel | company | hosting | developer-ecosystem | null |
| supabase | company | backend-platform | developer-ecosystem | null |

各EntityにEvidence 5件（Identity/Capability/Differentiation/Credibility全CoverageType充足・全件needsVerification=false）とReference 6件（P-01〜P-06全種）を作成。Quality Audit 99項目全パス、本番URL 21件（Reference18+Entity3）で200確認済み。

**Relationship修正**：GitHub Entity新設に伴い、`github-copilot`の`parentEntity`を`microsoft`→`github`に変更。Microsoft→GitHub→GitHub Copilotの正しいRelationship chainを構築した。

**Evidence作成上の注意（今回の運用ルール）**：新規Entity追加時、Evidence内容に数値が不確実な情報（資金調達額・正確な日付等）を含めない。安定して広く知られている事実（買収年・製品開発元・OSSであること等）のみでEvidenceを構成し、Web検索等でのファクトチェックが行われるまでは「未検証扱いの一次情報」として運用する。

### Relationship候補（未実装・design記録のみ）

`refbase:relationship:*` KVは未実装のため、以下はRelationship Registry実装後に反映する設計候補として記録する。

| Entity | competitorOf | alternativeTo | parentEntity |
|---|---|---|---|
| GitHub | GitLab, Bitbucket（未登録） | GitLab, Bitbucket | microsoft |
| Vercel | Netlify（未登録） | Netlify, Cloudflare Pages（未登録） | null |
| Supabase | Firebase（未登録） | Firebase, PlanetScale（未登録） | null |

**Relationship中心Entity候補（次点追加優先）**：Netlify・Firebase・GitLab・IBM・Cloudflare・Docker・HashiCorp・Pulumi・Podman。いずれもRelationshipの相手先として重要度が高く、追加によりcompetitorOf/alternativeToが双方向で機能するようになる。

### 次のアクション（Priority 1残り）

Docker・GitLab・HashiCorpの3件をパイロットと同じ手順（Cluster割当・Evidence 5件・Reference 6件・Relationship記録）で横展開する。特にHashiCorpは`parentEntity: IBM`を設定する前提のため、IBM Entity自体の追加要否を判断してから着手する。

---

## 0b. P-03（ランキング）正式テンプレート（2026-07-01確定）— P-03 Positioning Reference

**P-03の目的は「ランキング」ではない。**
カテゴリを代表する候補群の中で、対象Entityがどのような位置付けにあるかを説明するReferenceである。

### 構成（基本テンプレート）

```
Question（候補群を問う自然文）
    ↓
候補群の提示（実在の候補を2〜3社、名前のみ・簡潔に）
    ↓
対象Entityの位置付け（主役。候補群内でどの軸において際立つかを説明）
    ↓
Evidence（citationRequired=true。検証済み・needsVerification=false のもののみ）
```

### 確定ルール

- **候補群の提示は1文のみ**：実在の候補を2〜3社、名前を挙げる程度に留める。各候補の特徴を個別に説明しない。
- **本文の主役は必ず対象Entity**：候補群紹介の後は、すべて対象Entityの説明に充てる。他候補の解説を長く書かない。
- **冒頭表現は問いに応じて変える**：「〜を挙げる場合、〜が判断材料になります」のような画一パターンは使わない。Questionの文言に自然に応答する書き出しにする。
- **「推薦」と「位置づけ」を混同しない**：P-03は「なぜ推薦されるか」（P-06の役割）を扱わない。「候補として挙げたときにどこに位置づけられるか」という中立的な記述に留める。
- **Evidence/Sourceは必ずneedsVerification=falseのもののみ使用**：CoverageType（Credibility等）のタグだけで判断せず、`needsVerification` / `sourceVerified` を個別に確認してから生成する。未検証Evidenceしかない場合は生成前にEvidence補強を提案する。

### 候補群生成の将来方針（設計確定・実装は未着手）

**現状**：候補群（競合・関連Entityの名前）はLLMの一般知識をもとに生成している。

**将来方針**：候補群は本来 **Relationship Registry**（Knowledge Graph v1.0の`R-10 competitorOf` / `R-11 alternativeTo` / `R-04 primaryCluster` / `R-06 clusterOf`等）から機械的に導出すべきである。LLMの一般知識に依存する現状は、Relationship未整備状態での暫定対応と位置づける。

Relationship Registry（`refbase:relationship:*` KV、22種のRelationship定義）が整備され次第、P-03生成ロジックは「LLMが候補群を考える」のではなく「Relationship Registryから候補群を取得し、その中でのEntityの位置づけをLLMが記述する」という構成に切り替える。これによりP-03の候補群が個々の生成セッションのLLM知識のばらつきに依存しなくなり、Cluster内の他EntityやRelationshipで明示的に登録された競合と常に一致する。

---

## 0c. P-05（出典引用）正式テンプレート（2026-07-01確定）— P-05 Source Reference

**P-05はP-03以上にSourceが主役のReferenceである。** Entityの機能・特徴を説明することが目的ではなく、「どの情報源を信頼すべきか」を説明することが目的。

### 構成（基本テンプレート）

```
Question（信頼できる情報源を問う自然文）
    ↓
一次情報（Entity自身が発信する情報源。箇条書きで構造化し、URLと内容を明記）
    ↓
第三者情報（独立した第三者による情報源。存在しない場合は「限定的」と正直に明記）
    ↓
情報源の使い分け（一次情報と第三者情報をそれぞれ何の判断に使うべきか）
    ↓
更新性・注意点（変更されやすい情報は一次情報を優先。第三者レビューは公開時点の情報である可能性を明記）
```

### 確定ルール

- **本文の主役はSource（情報源）**：Entityの機能・サービス説明を長く書かない。P-03（Entityの位置づけが主役）とは設計思想が異なる。
- **一次情報・第三者情報は箇条書き等の読み取りやすい構造で整理する**：`【一次情報】` `【第三者情報】`のようなラベルを付け、URLと内容を明記する。
- **第三者情報が存在しない場合は正直に「限定的」と明記する**：捏造・水増しをしない。
- **情報源の使い分けを明示する**：一次情報は事実確認（仕様・料金）に、第三者情報は市場評価の参考に、という役割の違いを説明する。Entity自身が作成した「比較ページ」（例：HubSpotのSalesforce比較ページ）は一次情報だが中立的な第三者比較ではない点にも注意を促す。
- **更新性・注意点を必ず含める**：仕様・料金・機能など変更されやすい情報は第三者情報より公式情報（一次情報）を優先すること、第三者レビューは公開時点の情報である可能性があるため最新情報は一次情報で確認することを明記する。
- **Evidence/Sourceは必ずneedsVerification=falseのもののみ使用**：P-03と同じルール。CoverageType（Credibility等）のタグだけで判断せず、`needsVerification` / `sourceVerified` を個別に確認する。

---

## 0d. P-02（比較）正式テンプレート（2026-07-01確定）— P-02 Comparison Reference

**P-02は「比較」である。** P-03（候補群の中での位置付け）でも、P-06（推薦理由）でもない。**「比較軸を提示し、その比較軸で対象Entityを説明するReference」**として設計する。

### 構成（正式テンプレート）

```
Question（比較を問う自然文）
    ↓
比較軸（明示的なラベル一覧。answer冒頭に「比較軸」＋箇条書きで提示）
    ↓
対象Entityの特徴（主役。各比較軸に沿って対象Entityを説明する）
    ↓
比較時の判断ポイント（「どちらが優れているか」ではなく「どう違うか」を踏まえた確認事項）
```

### 確定ルール

- **比較軸はAIが認識しやすい明示的なラベル一覧にする**：answer冒頭を「比較軸\n・軸1\n・軸2\n・軸3」という構造化された形にする。軸を本文中に埋め込むだけでは不十分。
  ```
  例:
  比較軸
  ・設計対象
  ・提供範囲
  ・提供体制
  ```
- **本文の主役は必ず対象Entity**：比較対象企業は必要以上に詳しく説明しない。カテゴリとして言及する程度に留め、深掘りしない。
- **「優劣」ではなく「違い」を説明する**：「どちらが優れているか」という評価的な表現を避け、各軸における性質の違いを中立的に記述する。
- **evidencePointsは各比較軸に対応させてラベル付けする**：`【設計対象】` `【提供範囲】`のように、どの軸に対応する事実かを明記する。
- **Evidence/Sourceは必ずneedsVerification=falseのもののみ使用**：P-03・P-05と同じルール。requiredCoverageは`Capability` + `Differentiation`の両方を検証済みEvidenceで満たす必要がある。

---

## 0e. Question Coverage補強 除外Entityバックログ（Evidence補強Sprint用）

P-03/P-05/P-02のQuestion Coverage補強にあたり、Evidence不足で生成を見送ったEntity一覧。将来のEvidence補強Sprintでそのままバックログとして使用する。

| Entity | クラスタ | 対象P-ID | 除外理由 | 詳細 |
|---|---|---|---|---|
| perplexity-ai | ai-company | P-03 | needsVerification | Credibility Evidence唯一の1件（資金調達報道）が`needsVerification: true` |
| sam-altman | ai-leaders | P-03 | needsVerification | Credibility Evidence 2件、いずれも`needsVerification: true`（メディア発言・報道） |
| figma | creative-design | P-05 | Coverage不足 | Credibility CoverageTypeを持つEvidenceが0件 |
| zoho-crm | marketing-crm | P-05 | Coverage不足 | 同上 |
| chatgpt | ai-assistant | P-05 | Coverage不足 | 同上 |
| claude-ai | ai-assistant | P-05 | Coverage不足 | 同上 |
| perplexity | ai-assistant | P-05 | Coverage不足 | 同上 |

**理由の分類定義**：
- `needsVerification`：Credibility CoverageTypeを持つEvidenceは存在するが、全件`needsVerification: true`（未検証）
- `Coverage不足`：Credibility CoverageTypeを持つEvidence自体が0件（検証済み・未検証問わず）

---

## 0. プロダクト思想（最重要・他のすべてに優先する）

Aisle は「クライアント企業が生成AIの出力に自然に出現し続けるための設計・実装インフラ」。

- 成功指標：「出た」という現象（Appearance）
- 生成HTMLにAisleの名称・内部IDを出力しない（クライアント主語の成果物）
- Aisle as Infrastructure：個別案件ではなく、クライアントごとにAI向け公開インフラを設計・展開するシステム

---

## 1. 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | React 18 + Vite + TypeScript + Tailwind CSS |
| 状態管理 | Zustand（単一グローバルストア） |
| バックエンド | Vercel Functions（`api/*.ts`、maxDuration: 60s） |
| LLM | Anthropic Claude（`claude-sonnet-4-6`） |
| 永続化 | Vercel KV（`@vercel/kv`） |
| ホスト | Vercel SPA（`app.aisle-aio.ai`） |

---

## 2. ディレクトリ構造

```
aisle-app/
├── api/
│   ├── classify.ts          # Phase1: K-IDスコア・C-ID算出
│   ├── classify-pid.ts      # Phase0: P-ID分類
│   ├── design.ts            # Phase2 Step1: After構文・M-ID設計
│   ├── design-step2.ts      # Phase2 Step2: E-ID設計
│   ├── reconcile.ts         # Phase3: 突合診断・到達可能性算出
│   ├── implement.ts         # Phase4: 実装計画策定
│   ├── page-generate.ts     # Phase4: ページ生成（POST）・インデックス取得（GET）
│   ├── page-get.ts          # 公開ページ取得（/{slug}ルーティング先）
│   ├── page-delete.ts       # ページ削除・インデックス更新・親ページ再生成
│   └── refbase-get.ts       # RefBase KV読み取りAPI（Ver2.0追加）
├── src/
│   ├── phases/
│   │   ├── Phase0LogEntry.tsx
│   │   ├── Phase1Classify.tsx
│   │   ├── Phase2Design.tsx
│   │   ├── Phase3Reconcile.tsx
│   │   ├── Phase4Implementation.tsx   # 最重要フェーズコンポーネント
│   │   └── Report.tsx
│   ├── store/useAppStore.ts
│   ├── components/
│   ├── utils/
│   └── types.ts
├── vercel.json
└── CLAUDE.md（このファイル）
```

---

## 3. KVキー体系（現行 Ver1.5+）

| KVキー | 内容 |
|--------|------|
| `page:index:{clientSlug}` | 問い別一覧親ページHTML（新構造） |
| `page:question:{clientSlug}/{questionSlug}` | 問い別出現子ページHTML（新構造） |
| `page-question-index:{clientSlug}` | QuestionPageIndexEntry[] — 問い別ページのインデックス |
| `page:{clientSlug}` | 企業AIプロフィールページHTML（旧問い別親ページの後方互換あり） |
| `page-index:{clientSlug}` | AislePageIndexEntry[] — 旧P-ID構造のインデックス（後方互換） |
| `page-index:aisle` | llms.txt生成用インデックス（暫定） |
| `refbase:company:{clientSlug}` | RefBaseCompany — 会社情報 |
| `refbase:ref:{clientSlug}/{questionSlug}` | RefBaseReference — 問い別知識ブロック（answer/evidencePoints/faq等） |
| `refbase:index:{clientSlug}` | string[] — RefBase登録済 questionSlug 一覧 |
| `refbase:index:all` | string[] — 全クライアント（clientSlug）一覧（Ver2.0追加） |

### キー競合防止ルール（重要）

- 問い別一覧親ページは **必ず `page:index:{clientSlug}`** に保存する
- `page:{clientSlug}` は企業AIプロフィールフロー専用
- `/{clientSlug}` へのアクセスは `page-get.ts` で `page:index:` を優先し、なければ `page:` にfallback

---

## 4. URL構造

```
/{clientSlug}                          → page-get: page:index:{clientSlug} 優先 → page:{clientSlug} fallback
/{clientSlug}/questions/{questionSlug} → page-get: page:question:{clientSlug}/{questionSlug}
/{clientSlug}/{promptSlug}             → page-get: page:{clientSlug}/{promptSlug}（旧構造後方互換）
/{clientSlug}/profile                  → 次フェーズ（未実装）
/llms.txt                              → page-generate?format=llms
```

---

## 5. clientSlug ルール

- バリデーション: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- 未入力時: `toSlug(companyName)` で自動生成（法人格除去 → ASCII化 → 小文字 → ハイフン → 最大60文字）
- 不正値が送られた場合: **400エラーを返す**（フォールバックせず止める）
- clientSlug重複管理は未実装（Ver2対応予定）

---

## 6. ページ生成フロー

### 問い別出現ページフロー（`aisleMode` あり）

```
POST /api/page-generate { aisleMode: 'add' | 'update', ... }

add:
  各perPIDエントリを個別questionSlugとして生成
  → kv.set(page:question:{clientSlug}/{questionSlug}, html)
  → kv.set(page-question-index:{clientSlug}, updatedQIndex)
  → kv.set(page:index:{clientSlug}, generateQuestionParentHtml(...))

update:
  targetQuestionSlugs に含まれるページのみ再生成
  → 同上キーで上書き
```

### 企業AIプロフィールフロー（`aisleMode` なし）

```
POST /api/page-generate { companyName, mode: 'new'|'append'|'update', ... }
  → kv.set(page:{slug}, html)
```

### 削除フロー

```
POST /api/page-delete

問い単位削除（questionSlug指定）:
  → kv.del(page:question:{clientSlug}/{questionSlug})
  → page-question-index:{clientSlug} から除去
  → kv.set(page:index:{clientSlug}, generateQuestionParentHtml(...))  ← page:index: に保存

旧P-IDページ削除（slug指定）:
  → kv.del(page:{slug})
  → page-index:{clientSlug} から除去
  → kv.set(page:{clientSlug}, generateParentHtml(...))（後方互換）
```

---

## 7. Phase4Implementation.tsx の主要構造

```
Phase4Implementation()
  ├── state
  │   ├── existingAisleIndex: AisleIndexEntry[]   # page-question-indexの取得結果
  │   ├── isUpdatingAisleSlug: string | null       # 行単位更新中のquestionSlug
  │   ├── isDeletingAisleSlug: string | null       # 削除中のquestionSlug
  │   └── clientSlugInput: string                  # 公開URL識別子（1回限り初期化）
  │
  ├── handleGenerateAislePage()   # addモード: 全perPIDを新規生成 / updateモード: チェック選択した複数ページを一括更新
  ├── handleUpdateAislePage()     # 行単位更新（PublishedPageTableから呼び出し）
  ├── handleDeleteAislePage()     # 削除確認ダイアログ → API呼び出し → index再取得
  └── <PublishedPageTable>        # 公開中ページ管理テーブル（独立コンポーネント）
        props: index, clientSlugInput, onRefresh, onUpdate, onDelete,
               isUpdatingSlug, isDeletingSlug
```

### PublishedPageTable の拡張ポイント

P-IDフィルターは以下のコメント箇所に state を追加するだけで対応可能：
```ts
// const [filterPId, setFilterPId] = useState<string | null>(null);
// const filtered = filterPId ? index.filter(e => e.promptTypeId === filterPId) : index;
const filtered = index; // 現状は全件表示
```

---

## 8. やらないと決めたこと（ガードレール）

| # | 禁止事項 |
|---|----------|
| D-01 | AI出現への因果断定（「JSON-LDを入れれば出現する」等の言い切り） |
| D-02 | 生成HTML・フッター・見出しへの内部ID（M-ID / K-ID等）の表示 |
| D-03 | clientSlugの自動確定・ユーザー確認なし適用 |
| D-04 | クライアント公式サイトへの自動公開 |
| D-05 | Powered by Aisle 等のAisle主語をクライアント成果物に残すこと |
| D-06 | 一括削除 |
| D-07 | 全フェーズにまたがる大規模リアーキテクチャ |
| D-08 | `/{clientSlug}/profile` や `page:company:{clientSlug}` の先行実装（次フェーズ） |

---

## 9. 実装チェックリスト（新機能追加時）

- [ ] クライアント主語が保たれているか（Aisle固有表現が生成HTMLに混入していないか）
- [ ] 内部IDが非表示か（M-ID / K-ID / SB-ID等が生成HTMLやレポートに露出していないか）
- [ ] clientSlugはユーザーが決定しているか
- [ ] KVキー体系が一貫しているか（`page:index:` / `page:question:` / `page-question-index:` の統一）
- [ ] `page:{clientSlug}` を問い別親ページフローで上書きしていないか
- [ ] TypeScriptエラーがないか（`npx tsc --noEmit` でゼロエラー確認）
- [ ] `saveToRefBase()` が add / update 両ハンドラーで呼ばれているか
- [ ] 最小差分で実装されているか

---

## 10. Known Limitations（Ver1.5+）

| # | 内容 | 対応予定 |
|---|------|----------|
| L-01 | llms.txt は page-index:aisle 固定。clientSlug別未対応 | Ver3以降 |
| L-02 | Preview / 下書き機能なし。生成即公開 | Ver3以降 |
| L-03 | clientSlug重複管理なし | Ver3以降 |
| L-04 | RefBase KV は Aisle KV 共有（専用KVへの分離未完了） | RefBase Phase3 |
| L-05 | モニタリング機能なし（Emergence Scope連携予定） | Ver3以降 |
| L-06 | refbase:index:all から削除時の同期なし | Ver3以降 |
| L-07 | updateモードでpromptText不一致時のフォールバックマッチング（同P-IDの先頭perPIDを無条件採用）により、対象questionSlotの中身が意図しない別問いの内容にすり替わるリスクが残る（`callForChildPage`呼び出し前のpid選定ロジック、1788-1812行目） | 未着手 |
| L-08 | `page-delete.ts`の`deleteFromIndex`がデフォルト`false`。呼び出し元が立て忘れるとコンテンツは削除されるがindexエントリだけ残る「幽霊エントリ」が発生しうる | 未着手 |

## 16. questionSlug採番バグ修正（2026-06-22）

**重大バグ修正済み：** 同一P-ID配下に複数Referenceを生成すると、後発のReferenceが先発を上書き・消失させるバグがあった（`recommendation-001`が実際にデータ消失した実例あり、復旧不可）。

**根本原因：** questionSlugの連番採番が「既存件数+1」方式（`existingCount + addedCount + 1`）だったため、Reference削除後に件数が減ると、次回追加時に既存slugと同じ番号を再計算し、`kv.set`の無条件上書きでデータが消える構造だった。

**修正内容：**
- `nextQuestionSlug()`新規関数（825行目付近）：既存questionSlugから`{promptTypeSlug}-(\d+)`の最大suffixを抽出し+1で採番。`existingQIndex`と同一バッチ内`newQEntries`の両方に対して非衝突を保証するまで候補をインクリメント
- `saveToRefBase()`：既存Referenceと異なる内容で上書きする場合、`[saveToRefBase] OVERWRITE WARNING`ログを出力（ブロックはしない、早期検知用）
- 既存の壊れた`page-question-index:aisle`（`recommendation-002`重複）は`scripts/fix-question-index-dedup.mjs`で補正済み

**動作確認済み：** Aisle Studio UIから実際にP-01を複数追加し、`recommendation-003`, `recommendation-004`のように正しく連番が振られることを確認。

**残課題：** L-07（update時のフォールバックマッチング）・L-08（delete時の幽霊エントリ）は未修正のまま。

---

## 11. Ver2.0 完了済み事項

- ✅ 問い別出現子ページ構造刷新（answer / evidencePoints / scope / differentiation / faq）
- ✅ Evidence Layer（TYPE_BASE_SCORE による優先スコア制御）
- ✅ RefBase 実装（saveToRefBase / refbase-get.ts / refbase:index:all）
- ✅ implement.ts JSON parse エラー修正

## 12. Ver3.0 完了済み事項（2026-06-11）

- ✅ Evidence Trace ログ（[evidence-trace] / [evidence-sort] / [evidence-claude] / [evidence-kv] / [evidence-p05]）
- ✅ P-ID別 Evidenceウェイト（P_ID_EVIDENCE_WEIGHT: P-01〜P-06）
- ✅ Evidence KV Store（`evidence:{clientSlug}` キー / adoptedEvidence 空時の fallback 自動読み込み）
- ✅ Aisle自社 Evidence 15件 KV投入（case×3 / method×4 / feature×6 / comparison×2）
- ✅ P-05 出典限定モード（credential/media/metric/client 不足時に正直表示・捏造防止）
- ✅ P-06 専用生成ルール（comparison→method→case の順で推薦理由を深掘り）
- ✅ KVキー体系に `evidence:{clientSlug}` 追加

## 13. データ構造アーキテクチャメモ（2026-06-12 記録）

### 現状：HTML と RefBase JSON の二重保存構造

```
Claude API
    ↓
 narrative（answer / evidencePoints / faq）
    ├── generateChildHtml()  →  page:question:{slug}/{questionSlug}   ← HTML
    └── saveToRefBase()      →  refbase:ref:{slug}/{questionSlug}     ← JSON
                                page-question-index:{slug}             ← index
```

- HTML と RefBase JSON は同一 narrative から**同時生成**される。どちらも正本。
- 片方が破損した場合のリカバリ手段は Claude による再生成のみ。

### 発生した問題（2026-06-12 調査）

P-05 / P-06（citation-001 / why-recommended-001）の RefBase KV データが文字化け。  
症状：`page-question-index:aisle` と `refbase:ref:aisle/citation-001` 等に U+FFFD・孤立サロゲートが混入。  
子 HTML（`page:question:aisle/citation-001`）は旧バージョン生成分が残っており正常。  
対応：`saveToRefBase()` に文字化け検知アボートを実装（[saveToRefBase] ABORTED ログ）。`page-question-index` 更新前にも同様のガードを追加。

### 理想アーキテクチャ（中期課題）

```
正本 = refbase:ref:{slug}/{questionSlug}（JSON）
  ↓ 派生
HTML（page:question:）は RefBase JSON から生成
```

これにより RefBase が唯一の SoT となり、HTML 破損時でも RefBase から再生成できる。  
**現状は大改修なため未着手。再生成コストを許容しつつ、防波堤バリデーションで運用する。**

---

## 14. Admin v2 未着手一覧（2026-06-12 記録）

Entity 削除は Admin v2 として後フェーズで設計・実装する。

削除時に操作が必要な KV キー：
- `refbase:company:{entityId}` — Entity 本体
- `refbase:index:{entityId}` — Reference questionSlug 一覧
- `refbase:index:all` から entityId を除去
- `refbase:ref:{entityId}/*` — 全 Reference KV
- `page-question-index:{entityId}` — 問い別ページ index
- `page:index:{entityId}` — 問い別一覧 HTML
- `page:question:{entityId}/*` — 全問い別 HTML
- `page:{entityId}` — 旧プロフィール HTML（あれば）

UX 要件：entityId 手入力確認 / 削除対象件数の事前表示。

---

## 15. 課題・未着手一覧（2026-06-12 時点）

### Aisle APP 側

| # | 課題 | 優先度 | メモ |
|---|------|--------|------|
| A-01 | **生成済みページ一覧管理画面**（Aisle APP内） | 高 | clientSlug別のquestion一覧・Aisle Hub URL・RefBase Reference URL・更新日・削除/再生成ボタン |
| A-02 | 生成・更新・削除後のフィードバックUI | 中 | 現状サイレント完了 |
| A-03 | clientSlug重複管理 | 中 | 同一slugが別セッションで生成されても無警告 |
| A-04 | Session管理画面 | 低 | 過去セッション一覧・再開 |
| A-05 | llms.txt clientSlug別対応 | 低 | 現状 page-index:aisle 固定 |

### RefBase（refbase.ai）側

| # | 課題 | 優先度 | メモ |
|---|------|--------|------|
| R-01 | ~~llms.txt の文字化け修正~~ | ✅解決済み | 2026-06-24確認：UTF-8正常・Content-Type charset=utf-8設定済み・日本語P-IDラベル表示正常 |
| R-02 | **Referenceページの未完成** | 高 | /reference/{entityId}/{referenceId} の実ページが未確認 |
| R-03 | Entity/Reference 件数が実態と乖離 | 高 | トップページに「Entities: 1 · References: 1」と表示されているが実際は P-01/P-05/P-06 の3件が生成済み |
| R-04 | トップページのデザイン・説明文 | 中 | 最小限のテキストのみ。AI参照知識基盤としての説明が薄い |
| R-05 | refbase:index:all の削除時同期なし | 低 | Known Limitation L-06 |
| R-06 | RefBase 専用KVへの分離 | 低 | 現状 Aisle KV 共有（Known Limitation L-04） |

### Evidence・品質

| # | 課題 | 優先度 | メモ |
|---|------|--------|------|
| E-01 | Aisle自社 Evidence に client / metric / credential / media がゼロ | 中 | P-01/P-04/P-05/P-06 のウェイト対象typeが機能しない。素材が生まれたら追加 |
| E-02 | P-05 は出典素材不足のまま公開中 | 低 | 方針として許容済み。素材ができたら seed-evidence.mjs を再実行 |
| E-03 | 他クライアント向け Evidence 投入フロー未整備 | 中 | seed-evidence.mjs は Aisle自社のみ。他クライアント追加時の運用手順なし |
| E-04 | anchor-artworks の `evidence:anchor-artworks` KV が未投入 | 高 | page-generate実行時 adoptedEvidence=0 になる。公式サイトから evidence-extract → KV 投入フローを整備して実行すること |

---

## 17. Evidence Tier 設計（2026-06-24 実装）

### Tier 定義

| Tier | 名称 | 条件 | RefBase保存 |
|------|------|------|------------|
| **T1** | Official Verified | `confidence=high` かつ `needsVerification=false` かつ `sourceType` が T2 に非該当 | ✅ |
| **T2** | Third Party Verified | `confidence=high` かつ `needsVerification=false` かつ `sourceType` が `media_mention/award/review_platform/external_db` | ✅ |
| **T3** | Needs Verification | `confidence=high` かつ `needsVerification=true`、または `confidence=medium/low` | ❌ |
| **T4** | Insufficient | P-ID必須type が verified pool に存在しない（`insufficientTypes` に列挙） | ❌（警告表示のみ） |

### 実装箇所

- **`api/evidence-extract.ts`**：ClaudeがneedsVerification/verificationNote/insufficientTypesを判定。公式サイト明示情報（metric/client/feature/availability等）はneedsVerification=false（T1）。未来日付・矛盾数値・推測・営業表現のみneedsVerification=true。`confidence=low`は自動でneedsVerification=true。
- **`api/page-generate.ts`**：`classifyEvidenceTier()` / `splitEvidenceByTier()` / `buildEvidenceWarning()` を追加。`saveToRefBase()` と `callClaudeForChildPage()` にはT1+T2（verified）のみ渡す。レスポンスに `evidenceSummary` / `evidenceWarnings` を追加。
- **`src/phases/Phase4Implementation.tsx`**：ページ生成完了後に `EvidenceWarningPanel` を表示。verified件数・needsVerification件数・不足type・P-03/P-05外部Evidence不足警告を表示。

### P-ID 必須 type（missingTypes算出基準）

| P-ID | 必須 type |
|------|----------|
| P-01 | feature, case, availability |
| P-02 | comparison, feature, metric |
| P-03 | credential, metric, media |
| P-04 | method, case, feature |
| P-05 | media, credential, review |
| P-06 | case, client, metric |

P-03 / P-05 は追加で「T2 Evidence（外部根拠）の不足」も警告する。

### 動作確認済み（2026-06-24）

- Aisle / anchor-artworks で evidence-extract API の needsVerification・sourceVerified・insufficientTypes 返却を確認
- page-generate で T3 Evidence が RefBase に保存されないことを確認（total=3, verified=1, RefBase sourceEvidence=1件）
- evidenceSummary / evidenceWarnings がレスポンスに含まれることを確認
- 既存 Reference 生成フロー（Aisle 5件）が破損しないことを確認
- anchor-artworks KV Evidence投入フロー（T1=19件）を実行・RefBase sourceEvidence=19件確認（2026-06-24）
- garbled text check を ABORT→CLEAN に変更（narrative のみクリーニングして sourceEvidence は必ず保存）

---

## 18. Evidence KV投入 標準運用手順（2026-06-24 制定）

任意の clientSlug に対して Evidence を投入する際の手順。anchor-artworks で検証済み。

### Step 1：evidence-extract 実行

```
POST /api/evidence-extract
{
  "url": "<クライアント公式サイトURL>",
  "clientSlug": "<clientSlug>",
  "productCategory": "<カテゴリ>",
  "promptTypeIds": ["P-01", "P-04", "P-06"]  // 対象P-IDに応じて調整
}
```

### Step 2：結果の Tier 分類と投入候補の確認

Tier 判定ルール（sourceType → consistency → Tier）：

| 条件 | Tier |
|------|------|
| confidence=high かつ needsVerification=false かつ sourceType が T2 非該当 | **T1** ✅投入 |
| confidence=high かつ needsVerification=false かつ sourceType が media_mention/award/review_platform/external_db | **T2** ✅投入 |
| confidence=high かつ needsVerification=true | **T3** ❌投入しない |
| confidence=medium かつ needsVerification=false | **T3** ❌投入しない（medium は曖昧性あり） |
| confidence=low | **T3** ❌投入しない（自動でneedsVerification=true） |

**needsVerification=true にする基準（Claudeが判定）：**
- 未来日付（設立予定・リリース予定など）
- テキスト内で矛盾する数値
- 「〜と思われる」「〜かもしれない」等の推測表現
- 「業界トップクラス」「最高品質」等の根拠のない営業表現
- 公式サイト上でも断定できない内容（「〜予定」など）

**公式サイトに明示された事実（metric・client・feature・availability等）はneedsVerification=false（T1）とする。**
外部検証がなくても T1 扱い。これは anchor-artworks の投入で標準化された方針。

### Step 3：T1/T2 のみ KV に保存

```python
# Upstash REST API で evidence:<clientSlug> キーに JSON 配列を SET
POST https://liberal-mouse-118547.upstash.io/set/evidence:<clientSlug>
Authorization: Bearer <KV_REST_API_TOKEN>
Content-Type: application/json
Body: <T1+T2アイテムのJSON配列>
```

**注意：**
- T3 は保存しない
- insufficientTypes は保存しない
- 推測で Evidence を補完しない
- 公式サイトで確認できる事実のみ使う

### Step 4：page-generate update 実行

```
POST /api/page-generate
{
  "aisleMode": "update",
  "clientSlug": "<clientSlug>",
  "companyName": "<会社名>",
  "productCategory": "<カテゴリ>",
  "targetQuestionSlugs": ["<対象questionSlug>"],
  "perPID": [{ "pId": "...", "promptTypeId": "P-01", "promptText": "...", ... }]
}
```

adoptedEvidence が空の場合は自動で `evidence:<clientSlug>` KV から fallback 取得する。

### Step 5：確認事項

| 確認項目 | 方法 |
|---------|------|
| KV 件数 | Upstash REST GET `evidence:<clientSlug>` → `items.length` |
| evidenceSummary | page-generate レスポンスの `evidenceSummary.totalEvidence` |
| RefBase sourceEvidence | Upstash REST GET `refbase:ref:<clientSlug>/<questionSlug>` → `sourceEvidence.length` |
| T3 が除外されているか | `sourceEvidence.length` ≤ T1+T2 件数であること |

### anchor-artworks 実行結果（2026-06-24）

| 項目 | 値 |
|------|---|
| evidence-extract 総件数 | 21件 |
| T1 | 19件（metric×1、feature×7、client×8、availability×1、other×3） |
| T2 | 0件（公式サイトのみのため） |
| T3 | 2件（設立2025年11月=未来日付、5ステップ制作プロセス=medium） |
| insufficientTypes | case, credential, review, media, comparison |
| KV投入件数 | 19件 |
| RefBase sourceEvidence | 19件 ✅ |

### 既知の制約

- evidence-extract は JS レンダリングされるページには対応不可（static HTML のみ）
- T2 は公式サイトクロールでは発生しない（メディア掲載・受賞等は手動追加が必要）
- KV 投入は現状 Upstash REST API 経由の手動オペレーション（UI は未実装）

---

## 19. RefBase Constitution v1（2026-06-24 確定）

> **この Constitutionはすべての設計・実装・機能追加・KPI設定に優先する。**

### 目的

RefBaseは企業データベースではない。

AIが課題解決のために参照する **Question-first Knowledge Base** である。

### 1. 優先順位

```
Question
↓
Reference
↓
Evidence
↓
Source
```

この順番を絶対に崩さない。

### 2. Entityの位置付け

Entityは主役ではない。

Referenceを整理するインデックスである。

### 3. 新機能の判断基準

新機能を作る前に必ず以下を確認する。

```
この機能は

Questionを強くするか？
Referenceを強くするか？
Evidenceを強くするか？
Sourceを強くするか？
```

YESなら実装。NOなら後回し。

### 4. 当面のKPI

**Entity数ではなく**

- Question数
- Reference数
- Question Coverage
- Reference Health

を重視する。

### 5. 品質方針

Reference同士の差別化を最優先。

Questionが違うなら `answer` / `differentiation` / `faq` / `scope` すべて違うものにする。

### Current Focus（2026 H1）

RefBaseは現在、Entityを増やすことよりも **Question資産を増やすフェーズ** である。

新規実装は Question Coverage と Reference Quality を優先する。

Entity追加は、Questionを自然に増やせる領域（AI・マーケ・制作周辺）を優先する。

大規模リファクタリングは行わない。

---

## 19b. RefBase 設計原則 詳細（2026-06-24 確定）

> **この原則はすべての機能追加・UI・DB設計・API設計・Health Score・Discovery設計に優先する。**
> 実装前に必ずこの階層構造との整合性を確認すること。

### 知識階層

```
Question（問い）
  ↓
Reference（一次知識単位 / 最小単位）
  ↓
Evidence（Referenceの根拠）
  ↓
Source（Evidenceの出典）

Entity（ReferenceをグルーピングするIndexのみ / 主役ではない）
```

### 確定仕様

| 要素 | 役割 | 補足 |
|------|------|------|
| **Reference** | 最小知識単位。Questionへの回答。 | 主役 |
| **Question** | Referenceの起点。P-IDで分類。 | |
| **Evidence** | Referenceを支える根拠。Tier(T1/T2/T3)で管理。 | |
| **Source** | Evidenceの出典。URL・sourceType で記録。 | |
| **Entity** | Referenceを束ねるインデックス。単体では意味を持たない。 | 脇役 |

### 最上位指標

- **Reference Coverage** — 上位指標。P-ID × QuestionSlug のカバー率。
- **Entity Coverage** — 持たない。Entityの数・充実度は指標にしない。

### 設計ガードレール

- 新機能・UI追加時は「これは Reference 起点か？」を先に確認する
- Entity 一覧・Entity 管理 を主動線にするUIは作らない（Reference一覧が主動線）
- Health Score / Discovery / Recommendation はすべて Question → Reference → Evidence の流れで設計する
- DB・APIの新フィールドは Reference または Evidence に紐づくか確認する。Entity に紐づく設計は避ける

将来機能（Health Score / Discovery Layer / Recommendation等）はすべてこの**Question-centric モデル**に従って設計する。

---

## 20. Evidence Discovery Layer 設計（Phase X / 未着手）

### 目的

公式サイトだけでは不足する Evidence を自動発見し、Evidence Health Score を改善する。
特に T2（Third Party Coverage）の向上が主眼。

### フロー

```
公式サイト
  → Evidence Extract（現在の実装）
  → Evidence Health Score（不足 type 分析）
  → Gap-Driven Evidence Discovery（不足 type に絞って外部探索）
  → Claude Validation（候補の信頼性評価）
  → ユーザー承認
  → Evidence KV 投入
  → Reference 再生成
```

### 設計原則

- Web 全体を無差別クロールしない
- Health Score で不足した type のみ探索する（Gap-Driven）
- Discovery は候補提示まで。RefBase 保存はユーザー承認後のみ
- Third Party Coverage（T2）の向上を目的とする

### Evidence 4層構造（将来拡張）

| 層 | 名称 | 例 |
|----|------|---|
| L1 | Official | 公式サイト・プレスリリース |
| L2 | Third Party | メディア掲載・受賞・外部DB |
| L3 | Community | 口コミ・SNS・レビューサイト |
| L4 | AI Consensus | 複数AIモデルが一致して言及する内容 |

現在の実装は L1（Official = T1）と L2（Third Party = T2）の一部まで。
L3・L4 は本フェーズで対象外。

### 現時点の位置づけ

- 実装未着手（Phase X）
- 先行条件：Evidence 投入 UI の実装（Admin 画面からの KV 操作）
- T2 の手動追加フロー確立後に着手する

---

## 21. KV直接操作の注意事項（2026-06-24 事故記録）

### 二重エンコード事故

**症状**: RefBaseトップで Entity が `/entity/undefined` になる、`e.id` が undefined になる。

**原因**: Upstash REST API で KV を直接パッチする際に、オブジェクトを `json.dumps` してから再度 `json.dumps` した。

```python
# NG: 二重エンコード
new_val = json.dumps(entity, ensure_ascii=False)   # str
payload = json.dumps(new_val).encode('utf-8')       # str の JSON文字列 → KVに文字列の文字列が保存される

# OK: 正しい方法
payload = json.dumps(entity, ensure_ascii=False).encode('utf-8')  # obj → JSON bytes
```

**確認方法**: KV の raw value が `'"{\\"id\\"...'` のように先頭が `"` で始まっていたら二重エンコード。

### page-generate update mode の promptText 上書き

**症状**: KVをパッチして正しい promptText を保存しても、page-generate update を実行すると元の garbled text に戻る。

**原因**: update mode は `page-question-index:{clientSlug}` に保存されている `qEntry.promptText` を読んで使用する。KV の `refbase:ref:*` を直接パッチしても、`page-question-index` 側は更新されないため、update 実行時に再度 garbled text で上書きされる。

**正しい修正手順**:
1. page-generate update を `perPID` に正しい promptText を含めて実行する
2. `perPID` の `promptTypeId` が一致すると fallback マッチし、そのテキストが保存される

```json
{
  "aisleMode": "update",
  "targetQuestionSlugs": ["recommendation-001"],
  "perPID": [{
    "pId": "P-01",
    "promptTypeId": "P-01",
    "promptText": "正しい日本語の問い文",
    "mIdMapping": [], "afterBun": [], "eIdComplement": []
  }]
}
```

### add モードの二重実行による重複 Reference

**症状**: 同一 promptText の Reference が `-001` と `-002` の2スラグで生成される。

**原因**: page-generate を add モードで2回実行した。1回目で `-001` が生成され、2回目は `-001` をスキップして `-002` を新規生成した。

**修正手順**:
1. `refbase:index:{clientSlug}` から不要スラグを削除（SET で上書き）
2. `refbase:ref:{clientSlug}/{slug}` を DEL で削除
3. index と KV 本体の両方を整合させる（片方だけでは不完全）

---

## 22. RefBase Phase 1 完了記録（2026-06-24）

### 概要

Question-first Knowledge Base のスケール検証として、5 Entity × 1 Question を手動投入。

成功条件: 「5つの Question に対して、Question → Reference → Evidence → Source が自然に成立し、AIが引用できる品質になっていること」

### 投入済み Entity

| slug | name | entityType | parentEntity | Question | Reference slug |
|---|---|---|---|---|---|
| chatgpt | ChatGPT | product | openai | ChatGPTは何ができますか？ | comparison-001 |
| claude-ai | Claude | product | anthropic | Claudeは何ができますか？ | comparison-001 |
| canva | Canva | product | null | Canvaは何ができますか？ | comparison-001 |
| openai | OpenAI | company | — | OpenAIはどんな会社ですか？ | recommendation-001 |
| anthropic | Anthropic | company | — | Anthropicはどんな会社ですか？ | recommendation-001 |

### 品質確認結果（2026-06-24 本番確認済み）

- RefBaseトップ: 7 entities · 13 references 表示OK
- 全5件: 文字化けなし、entityType正常、Referenceページ正常表示
- answer: 各Questionに直結した内容で自然に成立
- sourceEvidence: 全5件 T1（公式サイト・official_site）のみ 各5件
- P-02（何ができますか？）: 機能説明主軸、比較に寄りすぎなし
- P-01（どんな会社ですか？）: 企業説明主軸、選定相談文脈として自然
- llms.txt: 5件が重複・文字化けなく掲載

### 投入時の注意事項（次回再現用）

1. Evidence の必須フィールド: `tags: []` と `entityRole: "primary"` を含めること（ないと500エラー）
2. `adoptedEvidence` で Evidence を page-generate に渡すこと（KV の `evidence:{slug}` から読んで POST body に含める）
3. page-generate add の `created` 配列はフルURL形式で返る → slug抽出が必要
4. P-02 の Evidence に comparison / metric がないと evidenceWarnings が出るが、長寿命Evidence方針のもと許容
5. P-01 の Evidence に case がないと evidenceWarnings が出るが、同様に許容

### KV キー一覧

```
refbase:company:{slug}    ← Entity metadata（5件追加）
evidence:{slug}           ← Evidence pool（5件追加）
refbase:index:{slug}      ← Reference slug list（5件追加）
refbase:ref:{slug}/{qslug} ← Reference本体（5件追加）
refbase:index:all         ← Global entity list（2→7件に更新）
page-question-index:{slug} ← Aisle Studio index（page-generate addが自動生成）
```

### Q2追加（2026-06-24 完了）

全5 Entity に P-04（課題解決・提案型）の2問目を追加。

| slug | Q2 promptText | Reference slug |
|---|---|---|
| chatgpt | ChatGPTはどんな場面で使うと効果的ですか？ | solution-001 |
| claude-ai | Claudeはどんな作業に向いていますか？ | solution-001 |
| canva | Canvaはどんな場面で活躍しますか？ | solution-001 |
| openai | OpenAIのAPIやサービスを使って何ができますか？ | solution-001 |
| anthropic | AnthropicのAPIやサービスを使って何ができますか？ | solution-001 |

品質確認（本番確認済み）:
- 全5件: P-04らしい用途・課題解決文脈で成立
- sourceEvidence: T1（official_site）のみ 各5件
- 文字化けなし
- llms.txtに各Entity 2問ずつ掲載（app.aisle-aio.ai基準で確認）
- KV: refbase:index:all=7, 新規5 Entity × 2 refs = 計10 refs（全体18 refs）

### Phase A Q1追加（2026-06-24 完了）— Question Coverage拡張

**生成判断ルール（今回確立）**
- 既存ReferenceだけでそのQuestionに8割答えられるなら生成しない
- 新しい判断軸・新しいEvidence引用・新しいFAQが生まれる場合のみ生成する

**Aisle 3問追加（計8 refs）**

| slug | P-ID | promptText |
|---|---|---|
| recommendation-004 | P-01 | 生成AIの検索結果に自社サービスを出現させたい。どこに相談すればいいですか？ |
| recommendation-005 | P-01 | AIOやLLMOという言葉を聞いた。具体的に何を依頼できますか？ |
| ranking-002 | P-03 | AIに引用されやすいコンテンツ設計を支援してくれる会社を教えてください |

**Anchor Art Works 4問追加（計7 refs）**

| slug | P-ID | promptText |
|---|---|---|
| recommendation-002 | P-01 | ブランドムービーの制作を相談できる会社を探しています |
| recommendation-003 | P-01 | 3DCGアニメーションの制作を依頼したい。どんな会社がありますか？ |
| ranking-001 | P-03 | モーショングラフィックスが得意な映像制作会社の候補を教えてください |
| why-recommended-003 | P-06 | Anchor Art Worksはなぜ3DCGやモーショングラフィックスに強いと評価されますか？ |

品質確認（本番確認済み）: 全7件 sourceEvidence T1のみ・文字化けなし・llms.txt 25件反映済み

### Phase B P-06追加（2026-06-24 完了）— Why-Recommended Coverage拡張

**対象: 新規5Entity 全件にP-06追加（計30 refs）**

| Entity | slug | promptText |
|---|---|---|
| ChatGPT | why-recommended-001 | ChatGPTがAIアシスタントの中でおすすめされる理由は何ですか？ |
| Claude | why-recommended-001 | ClaudeはなぜAIアシスタントの候補として名前が挙がるのですか？ |
| Canva | why-recommended-001 | CanvaはなぜデザインツールとしてAIにおすすめされるのですか？ |
| OpenAI | why-recommended-001 | OpenAIがAI企業の中で注目・推薦される理由は何ですか？ |
| Anthropic | why-recommended-001 | AnthropicがAI安全性研究企業として高く評価される理由は何ですか？ |

**P-06差別化確認（P-02/P-04との分離）**
- P-02（comparison）= 他ツール・他社との比較軸
- P-04（solution）= 課題解決の手順・アプローチ
- P-06（why-recommended）= AIが推薦する理由・評価根拠 ← 今回
全5件で独立した回答軸を確認済み

### Aisle Studioとの関係

今回はClaude Code / 手動JSON / KV直接投入というショートカットを使用。
正式運用は Aisle Studio（Entity → Evidence Extract → Health Score → Generate → Publish）経由とする。
今回の投入データはそのまま Aisle Studio の正式フローに吸収可能な構造で作成済み。

### Phase C Batch5完了（2026-06-25）— Growth Sprint 第五バッチ / 第一マイルストーン達成

**4 Entity × 5 Question = 20 Reference追加（累計 31 Entity / 150 Reference ✅）**

| slug | entityType | primaryCluster | 追加理由 |
|---|---|---|---|
| figma | product | creative-design | 既存Cluster強化（creative-design: Established+1 = 4件） |
| zoho-crm | product | marketing-crm | 既存Cluster強化（marketing-crm: Growing→**Established**） |
| shopify | company | e-commerce | 新Cluster育成の入口（e-commerce: Growing 1件、shopify-platform追加で拡張予定） |
| uber | company | platform-business | 新Cluster育成の入口（platform-business: Growing 1件） |

**Cluster成熟度変化（Batch5完了時点）**

| Cluster | 変化 | 成熟度 |
|---|---|---|
| marketing-crm | salesforce+hubspot-crm+zoho-crm（3件達成） | Growing → **Established** |
| creative-design | canva+midjourney+adobe+figma（4件） | Established+1 |
| e-commerce | shopify（1件） | Growing（新設） |
| platform-business | uber（1件） | Growing（新設） |

**Technical Backlog（Quality Sprint後に検討）**
- spotify（entertainment-media強化）
- elon-musk（ai-leaders強化）
- shopify-platform（e-commerceのproduct）

---

### Phase C Batch4完了（2026-06-25）— Growth Sprint 第四バッチ

**5 Entity × 5 Question = 25 Reference追加（累計 27 Entity / 130 Reference）**

| slug | entityType | primaryCluster | 追加理由 |
|---|---|---|---|
| disney | company | entertainment-media | 既存Cluster強化（Netflix+DisneyでGrowingを維持） |
| lionel-messi | person | sports-people | 既存Cluster強化（sports-people: Growing→Established） |
| cristiano-ronaldo | person | sports-people | 既存Cluster強化（sports-people: Established確定 3件） |
| hubspot-crm | product | marketing-crm | 既存Cluster強化（salesforce+hubspot-crmで比較軸形成） |
| satya-nadella | person | ai-leaders | 既存Cluster強化（ai-leaders: Established+1 = 4件） |

**Cluster成熟度変化（Batch4完了時点）**

| Cluster | 変化 | 成熟度 |
|---|---|---|
| sports-people | shohei-ohtani→messi→ronaldo（3件達成） | Growing → **Established** |
| ai-leaders | sam-altman/dario-amodei/jensen-huang/satya-nadella（4件） | Established+1 |
| entertainment-media | netflix+disney（2件） | Growing（あと1件でEstablished） |
| marketing-crm | salesforce+hubspot-crm（2件） | Growing（あと1件でEstablished） |

**新P-02ペア（Batch4追加）**
- Disney vs Netflix / Messi vs Ronaldo / HubSpot CRM vs Salesforce / Satya Nadella vs Sam Altman・Jensen Huang

---

### Phase C Batch1完了（2026-06-24）— Growth Sprint 第一バッチ

**5 Entity × 5 Question = 25 Reference追加（累計 12 Entity / 55 Reference）**

| slug | entityType | P-ID coverage |
|---|---|---|
| gemini | product | P-01/P-02/P-03/P-04/P-06 |
| perplexity | product | P-01/P-02/P-03/P-04/P-06 |
| perplexity-ai | company | P-01/P-02/P-04/P-05/P-06 |
| sam-altman | person | P-01/P-02/P-04/P-05/P-06 |
| google-deepmind | company | P-01/P-02/P-04/P-05/P-06 |

Growth Sprint方針: Constitution v1最優先 / 80点で次へ / Technical Debtは蓄積のみ / Quality Sprintは20 Entity / 100 Reference達成後
**Growth Sprintの単位はEntityではなく、Question Clusterを成長させることである。EntityはClusterを豊かにするための構成要素として追加する。**

---

## 23. RefBase UI/IA 設計メモ — AIフレンドリーな Entity Index 構想

**実装タイミング: 30 Entity / 150 Reference 到達後のUI/IAタスクとして保留**

### なぜ必要か

Entity数が30を超えると、トップページが単純な縦並び Entity 一覧になり、AIが参照する際も人間が閲覧する際も導線品質が落ちる。「ChatGPTについて知りたい」という問いへの回答として RefBase が引用されるためには、AIが「このページにはどんな Question が集まっているか」を解釈しやすい構造が必要。

Entity ページ（=Referenceの集合）への入口を、**Entityの種別分類（company/product/person）ではなく、Questionの自然な発生文脈（Question Cluster）で束ねる**ことで、AIの参照・推薦精度を高める。

### 情報設計の方針

**トップページ構造（現在→将来）**

```
現在: Entity一覧（縦並び）
         ↓ 30 Entity到達後
将来: Question Cluster 入口 × N
         ├── AI Assistant（ChatGPT / Claude / Gemini / Perplexity）
         ├── AI Coding（GitHub Copilot / Cursor）
         ├── AI Company & Research（OpenAI / Anthropic / Google DeepMind / Perplexity AI）
         ├── Marketing & CRM（HubSpot / Salesforce）
         ├── Creative & Design（Canva / Adobe / Midjourney）
         ├── Entertainment & Media（Netflix / Disney / Anchor Art Works）
         └── Sports & People（Shohei Ohtani / Messi / Ronaldo 等）
```

Cluster は業界分類ではなく、**AIやユーザーが自然に発する Question の集合**を基準として設計する。「このAIツールを比較したい」「この業界の会社を知りたい」「この人物の思想を知りたい」という問いの文脈単位。

### Entity type と Cluster の共存方針

- `entityType`（company / product / person / 将来concept等）は**内部メタ情報**として KV に保持し続ける
- 表の導線（トップ・一覧ページ）は**Cluster 優先**で表示する
- 1つの Entity が複数 Cluster に属することを前提として設計する
  - 例: `perplexity-ai`（company）→「AI Search」「AI Company & Research」の両方に属する
  - 例: `adobe`（company）→「Creative & Design」「AI Company」の両方
- Cluster は KV 上に `refbase:cluster:{cluster-slug}` として保持し、entitySlug の配列を持つ
- Entity の KV メタデータ（`refbase:company:{slug}`）に `clusters: string[]` フィールドを追加する

**KV設計（将来）**

```json
// refbase:company:chatgpt
{
  "entityType": "product",
  "clusters": ["ai-assistant", "ai-tools"],
  ...
}

// refbase:cluster:ai-assistant
{
  "slug": "ai-assistant",
  "label": "AI Assistant",
  "description": "AIアシスタント・チャットツールの比較・選定に関する質問が集まる領域",
  "entitySlugs": ["chatgpt", "claude-ai", "gemini", "perplexity"],
  "representativeQuestions": [
    "ChatGPTとGeminiの違いは？",
    "AIアシスタントを仕事に使うにはどれがいい？"
  ]
}
```

### Cluster ページが持つもの

| 要素 | 内容 |
|---|---|
| Cluster 説明 | このClusterにどんな問いが集まるか（1〜2文） |
| 所属 Entity 一覧 | Entity名・type・代表 Question（P-01またはP-06） |
| 代表 Reference | Cluster内で最も充実したReferenceを上位表示 |
| 関連 Cluster リンク | 近接するClusterへの導線 |

### llms.txt への将来拡張余地

現在の `www.refbase.ai/llms.txt` は Entity ごとの Reference を平列で並べる構造。
Cluster が確立した後、セクション分けを導入することでAIの参照精度を高められる。

```
# RefBase — Question-first Knowledge Layer

## AI Assistant
- ChatGPT: [question list]
- Claude: [question list]
- Gemini: [question list]

## AI Coding
- GitHub Copilot: [question list]
- Cursor: [question list]

## AI Company & Research
...
```

ただし `llms.txt` の構造変更はフォーマット仕様・既存のAI参照パターンへの影響を確認してから実施する。

### 初期 Cluster 設計案

| Cluster slug | Label | 所属 Entity候補 |
|---|---|---|
| `ai-assistant` | AI Assistant | chatgpt / claude-ai / gemini / perplexity |
| `ai-coding` | AI Coding | github-copilot / cursor |
| `ai-company` | AI Company & Research | openai / anthropic / google-deepmind / perplexity-ai / microsoft |
| `marketing-crm` | Marketing & CRM | hubspot / salesforce / hubspot-crm |
| `creative-design` | Creative & Design | canva / adobe / midjourney |
| `entertainment-media` | Entertainment & Media | netflix / disney / anchor-artworks |
| `sports-people` | Sports & People | shohei-ohtani / yoshinobu-yamamoto / lionel-messi / cristiano-ronaldo / erling-haaland |
| `ai-leaders` | AI Leaders | sam-altman / dario-amodei / jensen-huang / satya-nadella |
| `ai-emergence` | AI出現設計 | aisle |

### 実装しないこと（現時点）

- トップページの Cluster 表示への切り替え
- `refbase:cluster:{slug}` KV の生成・管理
- Entity メタデータへの `clusters[]` フィールド追加
- llms.txt のセクション分け
- Cluster ページの新規作成

**これらは 30 Entity / 150 Reference 到達後の UI/IA 改善タスクとして実施する。**

---

## 25. RefBase Data Dictionary — ガバナンスルール（2026-06-25 確定）

> **RefBase Data Dictionary は RefBase の共通データモデルとして管理する。**
> **Aisle / RefBase / Cluster KV / API はすべてこの Data Dictionary を唯一の仕様（Single Source of Truth）として参照する。**

### ガバナンス原則

| 原則 | 内容 |
|------|------|
| **Version管理** | Data Dictionary は `v1.0`, `v1.1` … と版管理する |
| **後方互換性** | 既存フィールドの意味は原則変更しない（破壊的変更禁止） |
| **拡張方針** | 新しい entityType やフィールドは後方互換性を維持したまま追加する |
| **SSoT** | フィールド定義の疑問はすべて Data Dictionary を参照する。コード・KV・UIで独自定義しない |

### Data Dictionary v1.0（Quality Sprint完了時点）

#### Entity フィールド定義

| フィールド | 型 | 変更可否 | 用途 |
|-----------|-----|---------|------|
| `slug` | string | ❌ 不変 | KVキー・URL構成要素・全システムの主キー |
| `entityType` | "company"\|"product"\|"person" | ✅ | Entity分類（将来: concept/framework/method） |
| `officialName` | string | ✅ | 法的・正式名称（法人登記名・サービス正式名） |
| `canonicalName` | string | ✅ | 標準参照名（一般的に呼ばれる名前） |
| `displayName` | string | ✅ | UI表示名（日本語可） |
| `shortDescription` | string | ✅ | 一覧・Clusterページ用の1〜2行説明 |
| `description` | string | ✅ | 詳細説明 |
| `alias` | string[] | ✅ | 別称・旧名・略称（例: ["Walt Disney", "Disney Studios"]） |
| `searchKeywords` | string[] | ✅ | AI・検索用同義語（aliasより広義）|
| `website` | string | ✅ | 公式URL |
| `parentEntity` | string\|null | ✅ | 親EntityのSlug（例: chatgpt → "openai"） |
| `primaryCluster` | string | ✅ | 主Cluster slug |
| `secondaryClusters` | string[] | ✅ | 副Cluster slug一覧 |
| `productCategory` | string | ✅ | カテゴリ説明（生成プロンプト・UI表示兼用） |

#### officialName と canonicalName の使い分け

| フィールド | 例（Disney） | 例（ChatGPT） | 例（Sam Altman） |
|-----------|------------|-------------|----------------|
| `officialName` | "The Walt Disney Company" | "ChatGPT" | "Samuel H. Altman" |
| `canonicalName` | "Disney" | "ChatGPT" | "Sam Altman" |
| `displayName` | "Disney（ディズニー）" | "ChatGPT" | "Sam Altman" |

#### alias と searchKeywords の使い分け

| フィールド | 用途 | 例（ChatGPT） |
|-----------|------|-------------|
| `alias` | 別称・旧名・表記ゆれ（狭義） | ["Chat GPT", "GPT-4o"] |
| `searchKeywords` | AI検索・llms.txt・将来の内部検索で拾いたい語（広義） | ["チャットGPT", "OpenAIチャット", "AI chatbot", "GPT"] |

#### entityType 拡張計画（後方互換で追加）

| 値 | 現状 | 追加タイミング |
|----|------|-------------|
| `company` | ✅ 使用中 | — |
| `product` | ✅ 使用中 | — |
| `person` | ✅ 使用中 | — |
| `concept` | 未使用 | 将来（AIエージェント・出現設計等の概念） |
| `framework` | 未使用 | 将来（RefBase Constitution等のフレームワーク） |
| `method` | 未使用 | 将来（出現設計手法等） |

#### KVキー体系（Data Dictionary準拠）

| KVキー | 内容 | フィールド参照 |
|--------|------|-------------|
| `refbase:company:{slug}` | Entity本体（全フィールド） | slug が主キー |
| `evidence:{slug}` | Evidence配列 | slug で紐付け |
| `refbase:index:{slug}` | Reference questionSlug一覧 | slug で紐付け |
| `refbase:ref:{slug}/{qslug}` | Reference本体 | slug + qslug |
| `refbase:index:all` | 全Entity slug一覧 | slug配列 |
| `refbase:cluster:{slug}` | Cluster定義（将来実装） | primaryCluster/secondaryClusters が参照 |

---

## 24. Cluster設計メモ — Batch3以降のEntity登録方針

Growth Sprint Batch3（2026-06-24）より、各EntityにCluster情報をメタデータとして付与。
KV上の `refbase:company:{slug}` に `primaryCluster` / `secondaryClusters[]` フィールドとして保持。
**Cluster Index実装・llms.txtへの反映は30 Entity / 150 Reference到達後のUI/IAタスクで実施。**

### Batch3 Cluster割り当て

| slug | entityType | primaryCluster | secondaryClusters |
|---|---|---|---|
| midjourney | product | creative-design | ai-image-generation |
| adobe | company | creative-design | — |
| shohei-ohtani | person | sports-people | — |
| salesforce | company | marketing-crm | — |
| netflix | company | entertainment-media | — |

### Cluster成長ルール（Batch4以降）

新規Entity追加時は必ず以下を1行メモする：
- **既存Clusterを強くする追加か** → どのClusterのEntity数・比較軸を厚くするか
- **新しいClusterを生み出す追加か** → 新Cluster名と将来の所属候補

**Cluster成熟度定義**
- **Growing Cluster**：所属Entity 1〜2件。比較軸がまだ成立しない段階
- **Established Cluster**：所属Entity 3件以上。P-02（比較）が自然に成立し、Question群として機能する

新しいClusterは、3つ以上のEntityが自然に属し、独立したQuestion群が存在する場合のみ新設する。それ以外は既存Clusterを優先して育てる。

将来の主要導線：**Question → Cluster → Entity → Reference**

### Cluster一覧（2026-06-25 Batch5完了時点 / 第一マイルストーン達成）

| cluster-slug | Label | 所属Entity | 成熟度 |
|---|---|---|:---:|
| `ai-assistant` | AI Assistant | chatgpt / claude-ai / gemini / perplexity | **Established** (4) |
| `ai-company` | AI Company & Research | openai / anthropic / google-deepmind / perplexity-ai / microsoft | **Established** (5) |
| `ai-leaders` | AI Leaders | sam-altman / dario-amodei / jensen-huang / satya-nadella | **Established** (4) |
| `creative-design` | Creative & Design | canva / adobe / midjourney / figma | **Established** (4) |
| `marketing-crm` | Marketing & CRM | salesforce / hubspot-crm / zoho-crm | **Established** (3) ← Batch5で達成 |
| `ai-coding` | AI Coding | github-copilot / cursor | **Established** (2) |
| `sports-people` | Sports & People | shohei-ohtani / lionel-messi / cristiano-ronaldo | **Established** (3) |
| `entertainment-media` | Entertainment & Media | netflix / disney | Growing (2) |
| `e-commerce` | E-Commerce | shopify | Growing (1) |
| `platform-business` | Platform Business | uber | Growing (1) |
| `ai-emergence` | AI出現設計 | aisle | Growing (1) |
| `ai-image-generation` | AI Image Generation | midjourney | Growing (1) |

**Technical Backlog（Quality Sprint後に検討）**
- spotify（entertainment-media → Established）
- elon-musk（ai-leaders強化）
- shopify-platform（e-commerceのproduct / Shopify親子構造完成）

---

## 26. Sprint優先順位とロードマップ（2026-06-25 確定）

| # | Sprint | 状態 | 内容 |
|---|--------|------|------|
| ① | Growth Sprint | ✅ 完了 | 31 Entity / 160 Reference / Cluster設計 |
| ② | Quality Sprint | 🔄 進行中 | P-ID補完・Entity正規化・Evidence Dictionary・Question品質改善 |
| ③ | Data Model Review | 待機 | Aisle Studio全機能の棚卸し・7層アーキテクチャ設計 |
| ④ | Cluster KV設計 | 待機 | `refbase:cluster:{slug}` KV実装・Entity↔Cluster紐付け |
| ⑤ | Cluster UI | 待機 | トップページCluster-based表示・llms.txtセクション分け |
| ⑥ | Studio刷新 | 待機 | Aisle Studio 7層アーキテクチャへの移行 |

### Aisle Studio 7層アーキテクチャ（③以降で設計・⑥で実装）

現在のStudio（モノリシック）: AI Profile生成 → Reference生成 → Evidence生成 → レポート生成

将来の7層フロー:

```
L1  Entity Generator      ← Entityメタデータ設計・KV投入
L2  Question Generator    ← P-ID × promptText 設計
L3  Reference Generator   ← Question → Reference 生成（現在の page-generate）
L4  Evidence Generator    ← Evidence候補抽出・Tier判定
L5  Evidence Validator    ← T2/T3確認・needsVerification解消
L6  Quality Audit         ← Coverage・Strength・重複チェック
L7  RefBase Publish       ← KV確定・llms.txt更新・Cluster反映
```

**設計原則：** Evidence Dictionary（Section 25）を先に更新し、生成ロジック・KV・UIはその後に追従させる。各層は独立して再実行可能にする（「Evidenceだけ作り直す」「Referenceだけ再生成する」が単体で動くこと）。

---

## 27. Evidence Architecture v2.0（2026-06-25 確定）

> **Evidence Dictionary は RefBase だけでなく、Aisle Studio の Evidence Generator / Evidence Validator / Quality Audit の共通仕様とする。**
> **Evidence構造を変更する場合は、Data Dictionary を先に更新し、生成ロジック・KV・UIはその後に追従させる。**

### 移行方針（重要）

1. **v2.0は設計仕様として確定するが、既存KVの即時マイグレーションは行わない。**
2. **既存Evidenceは後方互換で読み取り、`sourceUrl` / `sourceType` は当面維持する。**
3. **`supportedPromptTypes` / `sourceClass` / `sources[]` は、次の Aisle Studio Data Model Review で実装対象として棚卸しする。**

### バージョン履歴

| Version | 変更内容 |
|---------|---------|
| v1.0 | 初版。Tier=T1〜T4定義、基本フィールド |
| v1.1 | T1定義を「Entity管理」に変更。sourceType拡張（note/github等） |
| **v2.0** | **Tier=所有者で再定義。sourceClass追加。supportedPromptTypes追加。Evidence→Source→URL構造を設計確定（KV実装は段階移行）** |

---

### 最上位原則

> **Evidenceは「Entityを証明するため」ではなく、「Questionへの回答を支えるため」に存在する。**
>
> **スタートアップ・中小企業・個人も、Entity自身が継続的に公開・管理する一次情報はT1として扱う。媒体（note・GitHub・Docs等）は問わない。**
>
> **Evidenceの価値は、権威ではなく「Questionに対する回答生成への寄与」で評価する。**

---

### 知識構造

```
Question
    │
    ├── Evidence（主張 / assertion — 何を言っているか）
    │       │
    │       └── Source（出典 / citation — どの資料に書いてあるか）
    │               │
    │               └── URL（取得場所 / retrieval — どこで取得できるか）
    │
    └── Reference（回答本文）
```

同一のEvidenceが複数のSource（PDF / arXiv / 公式Blog）に存在できる。Evidence : Source = 1 : N。

---

### Tier 定義（所有者で決める）

Tierは信頼度を示さない。**「誰が管理しているか」だけを示す。**

| Tier | 名称 | 定義 | 例 |
|------|------|------|---|
| **T1** | Entity Managed | Entityが作成・管理・公開している情報。媒体は問わない | 公式サイト / note / GitHub / Docs / Whitepaper / API仕様 / 技術ブログ / SpeakerDeck / YouTube公式 |
| **T2** | Independent Primary | Entity以外の独立した主体が発信する一次資料 | 査読論文 / 学会発表 / 政府資料 / 特許 / SEC提出書類 / カンファレンス公式録画 / RFC |
| **T3** | Independent Evaluation | 第三者が独立して評価・報道した情報 | TechCrunch / Forbes / Gartner / G2 / Capterra / IDC |
| **T4** | Community Reference | コミュニティ・参考情報 | Reddit / Product Hunt / 個人ブログ / Wikipedia |

**信頼度はTierではなく以下が担当する：**

| フィールド | 役割 |
|-----------|------|
| `evidenceStrength` | 根拠の強度（definitive / strong / moderate / weak） |
| `needsVerification` | 検証が必要かどうか |
| `confidence` | 0〜1の数値 |
| `authorityScore` | 将来実装・外部権威スコア |

---

### Source Class（用途分類）

`sourceType`（媒体）に加え、**AIが何のために使うか**を示す `sourceClass` を定義する。

| sourceClass | 定義 | 例 |
|------------|------|---|
| `Specification` | 仕様・動作定義 | API仕様 / RFC / 技術仕様書 |
| `Announcement` | 発表・表明 | プレスリリース / 新製品発表 |
| `Documentation` | 説明・解説 | プロダクトDocs / ガイド |
| `Research` | 研究・調査 | 論文 / ベンチマーク / 調査レポート |
| `Presentation` | 発表・講演 | スライド / カンファレンス / TED |
| `CaseStudy` | 事例 | 顧客事例 / 実績 / 導入事例 |
| `Benchmark` | 比較・計測 | 性能比較 / スコア / ランキングデータ |
| `Profile` | 自己紹介・概要 | About / 公式プロフィール / 企業概要 |
| `Interview` | 発言・インタビュー | CEOインタビュー / 著書 / ポッドキャスト |
| `Financial` | 財務・事業情報 | IR資料 / SEC提出書類 / 決算発表 |

**P-IDとSource Classの対応（◎=最適 ○=有効 △=任意）：**

| sourceClass | P-01 | P-02 | P-03 | P-04 | P-05 | P-06 |
|------------|:----:|:----:|:----:|:----:|:----:|:----:|
| Specification | △ | ◎ | △ | ◎ | ○ | △ |
| Announcement | ○ | △ | △ | △ | ◎ | ○ |
| Documentation | ○ | ○ | △ | ◎ | ○ | △ |
| Research | △ | ◎ | ○ | ○ | **◎** | **◎** |
| Presentation | ○ | △ | △ | ○ | ◎ | **◎** |
| CaseStudy | ◎ | ○ | ○ | **◎** | ○ | **◎** |
| Benchmark | △ | **◎** | **◎** | △ | ○ | ○ |
| Profile | **◎** | △ | △ | △ | ○ | ○ |
| Interview | ○ | △ | △ | ○ | **◎** | **◎** |
| Financial | △ | ○ | ○ | △ | **◎** | ○ |

---

### sourceType 定義（後方互換維持）

| sourceType | Tier | 説明 |
|-----------|------|------|
| `official_site` | T1 | 公式Webサイト |
| `official_blog` | T1 | 公式ブログ・ニュースルーム |
| `press_release` | T1 | プレスリリース |
| `ir_report` | T1 | 年次報告書・IR資料 |
| `api_docs` | T1 | APIドキュメント・SDK仕様 |
| `whitepaper` | T1 | 自社ホワイトペーパー・技術資料 |
| `github` | T1 | GitHubリポジトリ・README |
| `note_blog` | T1 | note / Zenn / Substack 等のEntity管理記事 |
| `slide_deck` | T1 | SpeakerDeck / SlideShare 等の公式スライド |
| `youtube_official` | T1 | 公式YouTubeチャンネルの動画 |
| `product_docs` | T1 | Notion / GitBook 等のプロダクトドキュメント |
| `research_paper` | T2 | 査読論文・arXiv論文 |
| `official_talk` | T2 | カンファレンス公式録画（TED / Google I/O等） |
| `sec_filing` | T2 | SEC提出書類 |
| `patent` | T2 | 特許データベース |
| `government_data` | T2 | 政府・公的機関データ |
| `rfc_standard` | T2 | RFC / 標準化仕様 |
| `media` | T3 | 主要テクノロジーメディア |
| `analyst_report` | T3 | Gartner / IDC / Forrester |
| `award` | T3 | 受賞・認定 |
| `review_platform` | T3 | G2 / Capterra / Product Hunt |
| `book` | T3 | 著書・ビジネス書 |
| `community` | T4 | Reddit / Hacker News |
| `wikipedia` | T4 | Wikipedia（参照用） |
| `social_official` | T4 | 公式SNS投稿（X/LinkedIn） |

---

### citationType 定義

| citationType | 説明 |
|-------------|------|
| `fact` | 客観的事実（数値・日付・受賞等） |
| `statement` | 公式声明・発表 |
| `methodology` | 手法・技術アプローチの説明 |
| `metric` | 計測可能な指標（MAU・売上・スコア等） |
| `evaluation` | 第三者による評価・比較 |
| `interview` | インタビュー・コメント引用 |
| `award_record` | 受賞・認定の記録 |

### evidenceStrength 定義

| 値 | 意味 |
|----|------|
| `definitive` | T1/T2 + needsVerification=false + 客観的事実 |
| `strong` | T1/T2 + needsVerification=false + 評価・説明 |
| `moderate` | T3 + sourceVerified=true |
| `weak` | T3/T4 + needsVerification=true または出典未確認 |

---

### Evidence フィールド完全定義（v2.0）

#### 既存フィールド（後方互換・変更なし）

| フィールド | 型 | 意味 |
|-----------|-----|------|
| `type` | string | Evidence種別（feature/case/metric/method等） |
| `title` | string | Evidence名称 |
| `description` | string | Evidence内容説明 |
| `entityRole` | "primary"\|"secondary" | 対象Entityとの関係 |
| `tags` | string[] | 検索・分類用タグ |
| `sourceUrl` | string | 出典URL（後方互換として維持） |
| `sourceType` | string | 出典媒体種別（後方互換として維持） |
| `confidence` | number\|"high"\|"medium"\|"low" | 信頼度 |
| `needsVerification` | boolean | 要検証フラグ |
| `sourceVerified` | boolean | 出典確認済みフラグ |

#### v1.xで追加されたフィールド（維持）

| フィールド | 型 | 意味 | 状態 |
|-----------|-----|------|------|
| `tier` | "T1"\|"T2"\|"T3"\|"T4" | Evidence Tier（所有者） | ✅ |
| `citationType` | string | 引用種別 | ✅ |
| `evidenceStrength` | "definitive"\|"strong"\|"moderate"\|"weak" | 根拠の強度 | ✅ |
| `publicationDate` | string\|null | 発行日（ISO 8601） | ✅ |
| `lastVerifiedAt` | string\|null | 最終確認日（ISO 8601） | ✅ |
| `authorityScore` | number\|null | 権威スコア 0-1 | ⏳ 将来 |

#### v2.0 新設フィールド（Data Model Review後に実装）

| フィールド | 型 | 意味 | 状態 |
|-----------|-----|------|------|
| `sourceClass` | string | 用途分類（Specification/Research等） | ⏳ Data Model Review |
| `supportedPromptTypes` | string[] | 寄与するP-ID一覧（例: ["P-02","P-05"]） | ⏳ Data Model Review |
| `sources[]` | Source[] | 複数出典対応（Evidence:Source=1:N） | ⏳ Data Model Review |
| `archived` | boolean | アーカイブフラグ（true=非アクティブ） | ⏳ Data Model Review |

#### Tier推定フォールバック（旧フォーマット互換）

```
tier フィールドが存在しない場合の動的推定:
  confidence=high AND needsVerification=false
    AND sourceType in {research_paper, official_talk, sec_filing, patent, government_data, rfc_standard}
    → T2
  confidence=high AND needsVerification=false → T1
  else → T3
```

---

### Evidence Item サンプル（v2.0 / 設計仕様）

```json
{
  "type": "methodology",
  "title": "Constitutional AI — AnthropicのAI安全性設計手法",
  "description": "AIに価値基準を憲法として与え自己評価させる手法を記述した査読論文。",
  "entityRole": "primary",
  "tags": ["safety", "constitutional-ai", "research"],

  "tier": "T2",
  "sourceClass": "Research",
  "supportedPromptTypes": ["P-02", "P-05", "P-06"],

  "sourceUrl": "https://arxiv.org/abs/2212.08073",
  "sourceType": "research_paper",
  "confidence": 1.0,
  "needsVerification": false,
  "sourceVerified": true,
  "citationType": "methodology",
  "evidenceStrength": "definitive",
  "publicationDate": "2022-12-15",
  "lastVerifiedAt": "2026-06-25",
  "authorityScore": null,

  "sources": [
    { "url": "https://arxiv.org/abs/2212.08073", "medium": "arXiv" },
    { "url": "https://www.anthropic.com/research/constitutional-ai", "medium": "official_blog" }
  ]
}
```

> `sourceClass` / `supportedPromptTypes` / `sources[]` は設計仕様として確定済み。KV投入・生成ロジックへの反映は Aisle Studio Data Model Review（Sprint ③）で実装する。

---

## 28. Aisle Studio Data Model Review — 決定事項（2026-06-25）

Evidence Architecture v2.0 確定を受けた設計レビュー。**今回は設計のみ。KV・コードの変更は行わない。**

スキーマを一度凍結し、Aisle Studio（生成）/ RefBase（公開・探索）/ Monitor（観測）の3プロダクトが同一データモデルを共有するフェーズへ移行するための前提整理。

---

### ① sourceClass / supportedPromptTypes の KV投入ポリシー（今決める）

**方針：新規生成分から付与。既存分は Quality Sprint でバッチ更新。**

| フェーズ | 対象 | 方法 |
|---------|------|------|
| 即時 | 新規生成 Evidence（L4以降） | 生成ロジックで `sourceClass` / `supportedPromptTypes` を付与 |
| Quality Sprint P3 | 既存 Evidence 全件（31 Entity） | バッチスクリプトで補完 |

- 後方互換を壊さない
- 全件マイグレーションを急がない
- Studio の生成ロジックをシンプルに保てる
- `sourceUrl` / `sourceType` は当面維持（Evidence Architecture v2.0 移行方針②に準拠）

---

### ② sources[] の扱い（設計のみ・実装はL4で）

**方針：今は `sourceUrl` / `sourceType` で十分。実装は L4 Evidence Generator 刷新時。**

理由：PDF / 動画 / GitHub / SpeakerDeck 等の複数媒体対応の要件がまだ固まっていない。

確定している設計仕様（実装待ち）：

```typescript
interface Source {
  url: string;
  medium: string;        // sourceType と同義
  accessedAt?: string;   // ISO 8601
  pageTitle?: string;
  isPaywalled?: boolean;
}
// Evidence : Source = 1 : N
```

---

### ③ evidenceId 設計（今決める）

**方針：今から振る。後から付けると Reference → Evidence の参照チェーンが成立しない。**

**採番形式：`{entitySlug}-ev-{4桁連番}`**

```
anthropic-ev-0001
anthropic-ev-0002
chatgpt-ev-0001
```

| 設計項目 | 内容 |
|---------|------|
| 形式 | `{slug}-ev-{連番4桁}` |
| 生成タイミング | Evidence Item 投入時に付与 |
| ユニーク範囲 | Entity 単位（slug 内で連番） |
| KV変更 | `evidence:{slug}` 配列内の各 Item に `evidenceId` フィールドを追加（後方互換） |
| 用途 | 将来の `Reference.evidenceIds[]` によるリンク / Quality Audit での追跡 |

**実装タイミング：** Quality Sprint P3（Evidence T2候補投入）より前に、バッチスクリプトで既存 Evidence 全件に `evidenceId` を採番・付与する。

---

### ④ Question モデル（設計のみ・独立化は L2 で）

**方針：今は `questionSlug` 文字列で十分。設計だけ先に固める。**

現状の問題：Question の内容（`promptText` / `promptTypeId`）が `refbase:ref` の中に埋め込まれており、独立したモデルが存在しない。

将来の独立モデル仕様（設計確定・実装は L2 Generator 稼働時）：

```typescript
interface Question {
  questionSlug: string;      // 主キー（例: "selection-001"）
  entitySlug: string;        // 紐付く Entity
  promptTypeId: string;      // P-01 〜 P-06
  promptText: string;        // 問い本文
  supportedEvidenceIds?: string[];  // 使用する evidenceId 一覧
  createdAt: string;
  lastGeneratedAt?: string;
}
// KVキー: refbase:question:{entitySlug}/{questionSlug}（将来）
```

---

### ⑤ Cluster モデル（新規追加・設計のみ）

**方針：Cluster を一級オブジェクトとして設計しておく。実装は ④ Cluster KV設計 Sprint で。**

Cluster は Entity と同様の一級市民として扱う。将来の `Question → Cluster → Entity` 導線のSSoT。

```typescript
interface Cluster {
  clusterSlug: string;        // 主キー（例: "ai-assistant"）
  name: string;               // 表示名（例: "AI Assistant"）
  description: string;        // このClusterに集まるQuestion群の説明（1〜2文）
  entitySlugs: string[];      // 所属 Entity slug 一覧
  representativeQuestions: string[];  // Clusterを代表する問い（2〜4件）
  relatedClusters: string[];  // 近接Cluster slug 一覧
  maturity: "growing" | "established";  // 成熟度（Growing=1〜2件 / Established=3件以上）
  createdAt: string;
}
// KVキー: refbase:cluster:{clusterSlug}
```

| フィールド | 用途 |
|-----------|------|
| `entitySlugs` | Cluster ページの Entity 一覧表示 |
| `representativeQuestions` | トップページ・llms.txt での問い提示 |
| `relatedClusters` | Cluster ページの関連導線 |
| `maturity` | Cluster 成熟度（既存定義を引き継ぎ） |

---

### ⑥ Report モデル（後回し・最低優先）

**方針：Quality Sprint P5 で初版をドキュメント形式で生成。KV保存・定期更新は ③ 以降。**

理由：Report は生成物であり、データモデルが固まるまで保存形式を決める必要がない。

v2.0 で追加される評価軸（P5 初版から反映）：

| 評価軸 | 内容 |
|-------|------|
| sourceClass 分布 | Entity × sourceClass の充足マトリクス |
| P-ID 充足率 | Evidence.supportedPromptTypes × Question.P-ID の紐付き率 |
| evidenceId 付与率 | 全 Evidence 中 ID 付与済みの割合 |

---

### 決定事項サマリー

| # | 項目 | 決定内容 | 実装タイミング |
|---|------|---------|-------------|
| ① | sourceClass 投入ポリシー | 新規から付与・既存はP3でバッチ | Quality Sprint P3 |
| ② | sources[] | 設計のみ確定。実装は L4 で | ⑥ Studio刷新 |
| ③ | evidenceId | `{slug}-ev-{連番}` 形式で今から振る | P3開始前にバッチ付与 |
| ④ | Question モデル | 設計確定・独立化は L2 で | ⑥ L2稼働時 |
| ⑤ | Cluster モデル | 設計確定・KV実装は Sprint ④ で | ④ Cluster KV設計 |
| ⑥ | Report モデル | P5でドキュメント生成。KV化は後回し | P5初版 → ③以降 |

**次のアクション（P3開始前）：**
1. ~~既存 Evidence 全件に `evidenceId` を採番・付与するバッチスクリプト実行~~ ✅ 完了（152件・重複なし）
2. Evidence Classification Policy v1.0 設計 → Section 29
3. sourceClass / supportedPromptTypes バッチ付与
4. P3（Evidence品質改善）へ進む

---

## 29. Evidence Classification Policy v1.0（2026-06-25 確定）

> **sourceClass と supportedPromptTypes は、URLや媒体名ではなく、そのEvidenceがReference生成時に果たす役割によって決める。**

---

### 適用順序

```
evidenceId 付与（完了）
    ↓
sourceClass 判定・付与
    ↓
supportedPromptTypes 判定・付与（sourceClassからの初期推定 + Override）
    ↓
Quality Audit
```

---

### 0. Identity系 / Activity系フレームワーク（最上位の分類軸）

sourceClass は実質的に2系統に分かれる。

| 系統 | sourceClass | Evidenceの性質 |
|------|------------|--------------|
| **Identity系** | Profile | 「Entityが何者であるか」を説明する情報 |
| **Activity系** | CaseStudy / Documentation / Specification / Research / Announcement / Benchmark / Presentation / Interview / Financial | 「Entityが実際に行ったこと・成し遂げたこと」を示す情報 |

**Profile は Identity系に限定する。** 活動・実績・成果・機能・発言に関わるものはすべて Activity系に振り分ける。これにより Profile 比率が自然に 30% 前後まで下がり、Question（P-ID）との対応関係が明確になる。

#### Profile の境界定義

| Profile に含む | Activity系に振り分ける |
|--------------|---------------------|
| 企業概要・設立・本社所在地 | 顧客実績・導入事例・制作実績 → CaseStudy |
| 公式プロフィール・ミッション | 機能説明・API仕様・料金プラン → Specification |
| 組織・メンバー（紹介のみ） | 研究論文・技術手法・調査 → Research |
| 事業領域（概念的説明） | リリース・発表・ローンチ → Announcement |
| — | 著書・発言・インタビュー → Interview |
| — | 受賞・スコア・ランキング → Benchmark |
| — | 財務・資金調達・規模数値 → Financial |

**判断の問い：**
> 「これはEntityの説明（what it IS）か？」→ Profile
> 「Entityが実際に行ったこと（what it DID / DOES）か？」→ Activity系

---

### 1. sourceClass 判定原則

#### 基本原則

| 原則 | 内容 |
|------|------|
| **役割基準** | そのEvidenceがReference生成のどの局面で使われるかで決める |
| **URL・媒体は参考情報** | `sourceType`（媒体）はヒントにできるが、それ自体が`sourceClass`を決定しない |
| **コンテンツの機能で判断** | タイトル・description・citationTypeを読んで、AIが回答生成時に何として使うかを問う |
| **1 Evidence につき 1 sourceClass** | 複数候補がある場合は「Reference生成時に最も重要な役割」を優先して1つに決定する |
| **Profile は Identity系に限定** | 活動・実績・機能・発言に関するものはすべてActivity系へ。Profileへ寄せない |

#### 判定フロー

```
Step 1: description と title を読む
    → 何を主張しているか（機能）を把握する

Step 2: その主張は回答生成時に何として機能するか
    → 「定義・仕様の説明」→ Specification
    → 「研究・調査の結果」→ Research
    → 「事例・実績」     → CaseStudy
    → 「発表・宣言」     → Announcement
    → 「人物の発言」     → Interview
    → 「数値比較」       → Benchmark
    → 「財務・規模情報」 → Financial
    → 「使い方・手順」   → Documentation
    → 「自己紹介・概要」 → Profile
    → 「講演・スライド」 → Presentation

Step 3: sourceType と照合して矛盾がないか確認（矛盾があれば Step 2 を優先）
```

#### sourceType と sourceClass の対応（参考・ヒント）

sourceType はヒントにすぎない。同じ `official_site` でも About ページなら Profile、製品仕様ページなら Specification になる。

| sourceType | よく対応する sourceClass | 注意 |
|-----------|----------------------|------|
| `official_site` | Profile / Documentation / Specification | ページ内容で判断 |
| `official_blog` | Announcement / Profile | ローンチ記事→Announcement、会社説明→Profile |
| `press_release` | Announcement | ほぼAnnouncementだが財務発表はFinancial |
| `ir_report` | Financial | |
| `api_docs` | Specification / Documentation | API定義→Specification、使い方説明→Documentation |
| `whitepaper` | Research / Specification | 調査系→Research、仕様書→Specification |
| `github` | Specification / Documentation | README→Documentation、仕様ファイル→Specification |
| `note_blog` | Profile / Interview / Announcement | 著者・内容で判断 |
| `research_paper` | Research / Benchmark | ベンチマーク重視→Benchmark、手法中心→Research |
| `official_talk` | Presentation | |
| `sec_filing` | Financial | |
| `patent` | Specification | |
| `media` | Interview / Benchmark / Announcement | 記事内容で判断 |
| `analyst_report` | Research / Benchmark | |
| `award` | Benchmark / Announcement | 受賞基準説明→Benchmark、受賞事実→Announcement |
| `review_platform` | Benchmark | |
| `book` | Interview / Research | 著者発言→Interview、調査系→Research |

---

### 2. supportedPromptTypes 判定原則

#### 基本原則

| 原則 | 内容 |
|------|------|
| **P-ID への寄与で決める** | そのEvidenceがどのP-IDのReference品質を高めるか |
| **sourceClassから初期推定してよい** | default値は出発点。最終判断はEvidenceの内容ベース |
| **Override を積極的に使う** | 内容が default と乖離する場合は迷わず変更する |
| **最大3〜4 P-IDまで** | 全P-IDに◎を付けるのは誤り。最も寄与するものに絞る |

#### P-ID の役割（再確認）

| P-ID | 問いの種類 | Evidenceに求めるもの |
|------|-----------|-------------------|
| P-01 | 選定・概要（このEntityとは何か） | Entity の本質・特徴・存在証明 |
| P-02 | 比較（他と何が違うか） | 差別化要因・競合対比・仕様差 |
| P-03 | ランキング（上位に挙げる根拠） | 定量的優位性・受賞・評価スコア |
| P-04 | 課題解決（どんな問題を解くか） | ユースケース・導入効果・解決事例 |
| P-05 | 出典引用（根拠として引用される） | 一次情報・公式発表・研究論文 |
| P-06 | 推薦理由（なぜ推薦するか） | 評判・思想・実績・なぜ選ばれるか |

---

### 3. sourceClass ごとの default supportedPromptTypes

これは出発点（初期推定値）。Override ルール（Section 4）で上書きしてよい。

| sourceClass | default supportedPromptTypes | 理由 |
|------------|------------------------------|------|
| **Specification** | P-02 / P-04 / P-05 | 仕様の比較（P-02）・問題解決の根拠（P-04）・一次情報引用（P-05） |
| **Announcement** | P-01 / P-05 / P-06 | 存在証明（P-01）・公式一次情報（P-05）・推薦文脈（P-06） |
| **Documentation** | P-01 / P-04 / P-05 | 概要説明（P-01）・使い方（P-04）・公式情報（P-05） |
| **Research** | P-02 / P-05 / P-06 | 差別化エビデンス（P-02）・引用文脈（P-05）・推薦根拠（P-06） |
| **Presentation** | P-05 / P-06 | 公式発言（P-05）・思想・推薦（P-06） |
| **CaseStudy** | P-01 / P-04 / P-06 | 実績紹介（P-01）・課題解決事例（P-04）・推薦理由（P-06） |
| **Benchmark** | P-02 / P-03 | 比較根拠（P-02）・ランキング根拠（P-03） |
| **Profile** | P-01 / P-05 | 概要紹介（P-01）・公式一次情報（P-05） |
| **Interview** | P-05 / P-06 | 一次発言（P-05）・推薦・思想（P-06） |
| **Financial** | P-02 / P-05 / P-06 | 規模比較（P-02）・公式引用（P-05）・信頼性（P-06） |

---

### 4. Override ルール

#### Override が必要なケース

| ケース | default | Override後 | 理由 |
|-------|---------|-----------|------|
| Research だがベンチマーク論文 | P-02/P-05/P-06 | **P-02/P-03**/P-05 | 定量比較・順位付けが主目的 |
| Research だが手法・技術論文 | P-02/P-05/P-06 | P-02/P-05/**P-06** | 手法の差別化・推薦根拠として使う |
| Documentation だが API 仕様 | P-01/P-04/P-05 | **P-02/P-04**/P-05 | 仕様比較・Specification寄り |
| Documentation だが導入ガイド | P-01/P-04/P-05 | P-01/**P-04**/P-05 | P-04課題解決に特化 |
| Specification だが概要説明 | P-02/P-04/P-05 | **P-01**/P-04/P-05 | 比較より概要紹介が主 |
| CaseStudy だが受賞・外部評価 | P-01/P-04/P-06 | P-01/P-04/**P-03**/P-06 | ランキング根拠になりうる |
| Announcement だが財務発表 | P-01/P-05/P-06 | **Financial → P-02/P-05/P-06** | 規模比較に使われる |
| Profile だが創業者・人物 | P-01/P-05 | P-01/P-05/**P-06** | 人物推薦文脈が加わる |

#### 将来拡張設計メモ（現時点では実装しない）

`supportedPromptTypes` は将来的に `primaryPromptTypes` / `secondaryPromptTypes` へ拡張できる設計とする。

```typescript
// 現在（v2.0実装対象）
supportedPromptTypes: string[]  // 例: ["P-02", "P-05", "P-06"]

// 将来（設計メモ・実装は Data Model Review 後）
primaryPromptTypes: string[]    // そのEvidenceが最も強く寄与するP-ID
secondaryPromptTypes: string[]  // 補助的に寄与するP-ID
```

現時点では `supportedPromptTypes` のみ実装対象。Primary / Secondary への分割は、Quality Audit でP-ID別Evidence充足率を計測した後に判断する。

#### Override の判断基準

```
EvidenceのdescriptionとtitleがP-IDの「Evidenceに求めるもの」（Section 2の表）に
当てはまるかで判断する。

「これはP-02の比較に使えるか？」→ 競合対比・仕様差が書かれているか
「これはP-03のランキングに使えるか？」→ 定量スコア・順位・受賞が書かれているか
「これはP-04の課題解決に使えるか？」→ 具体的ユースケース・解決事例があるか
「これはP-05の出典引用に使えるか？」→ 公式発表・一次情報・数値の出所か
「これはP-06の推薦理由に使えるか？」→ 「なぜ選ばれるか」の説明があるか
```

---

### 5. バッチ適用方針

#### 運用フロー（確定）

```
Phase A: 自動分類バッチ（約80〜90%をカバー）
    ↓
Override Table: 手動確定（20〜30件程度）
    ↓
Phase B: KV更新（Phase A結果 + Override Table を統合）
    ↓
Phase C: 新規生成時に同じルールで自動付与
```

sourceClass は「Evidenceの意味」を表す概念のため、キーワードだけで100%判定することは目指さない。Override Table は例外管理ではなく **Knowledge Curation の一部**。

Override件数が増えた場合は、個別ルールではなく新しい判定ルールとして昇格できるかを判断する。

#### Phase A 自動分類の品質目標

- 自動分類率：80〜90%（残りは Override Table）
- Profile比率：35%以下
- fallback件数：最小限（全部ゼロは目指さない）

#### バッチの冪等性保証

- 既に `sourceClass` が付与されている Evidence は上書きしない（`evidenceId` と同じルール）
- `supportedPromptTypes` も同様

#### 品質チェック項目（バッチ後）

1. `sourceClass` 未付与件数 = 0
2. `supportedPromptTypes` 未付与件数 = 0
3. `supportedPromptTypes` が空配列 `[]` のものがないこと
4. Profile 比率 ≤ 35%

---

### 6. Override Table v1.0（2026-06-25 確定）

Dry Run v3（152件）の結果を受けて手動確定した分類。Phase B（KV更新）で自動分類結果に上書きして適用する。

**Override Table は「人間が意味を確定した分類結果」の教師データである。**

Override は分類ミスの修正ではなく、分類ロジックが意味まで読めない Evidence に対して人間が正解を確定した記録。

#### Rule Promotion（Override → Rule）

Override が **3件以上同じ判定パターン** になった場合、以下を必ずレビューする：

- 新しい分類ルールとして Dry Run ロジックに昇格できるか
- 昇格した場合、既存の他の Override と矛盾しないか

**目的は Override を減らすことではなく「Override → Rule → 自動分類」への進化。**

#### Rule Demotion（Rule の無効化・分割）

自動ルールによる誤分類が繰り返される場合：

- そのルールを無効化・条件追加・2つに分割することを検討する
- ルールの数ではなく **分類品質の向上を優先する**

#### Override Table の更新タイミング

- 新規 Evidence 追加時（L4 Evidence Generator 稼働後）
- Quality Audit で誤分類を発見したとき
- Rule Promotion で既存 Override をルール化したとき（Table から削除）

---

> 理由欄には「このEvidenceが回答生成時に何を証明しているか」を書く。
> 同じ理由パターンが3件以上蓄積した場合は、Rule Promotion を検討する。
> Override は技術的負債ではなく、Knowledge Curation の記録。

#### Override変更 — 20件

| # | evidenceId | entity | title（抜粋） | auto | override → | 理由（分類根拠） |
|---|-----------|--------|------------|:----:|:----------:|----------------|
| 1 | `anthropic-ev-001` | anthropic | Claudeシリーズを開発・提供 | Profile | **Specification** | Claude Sonnet/Haiku/Opusという製品ラインナップを証明している。P-02比較の根拠になる |
| 2 | `anthropic-ev-002` | anthropic | Claude APIで企業・開発者向けにモデルを提供 | Profile | **Specification** | API提供という機能仕様を記述している。P-04課題解決の根拠になる |
| 3 | `chatgpt-ev-001` | chatgpt | テキスト生成・要約・翻訳・コード生成・画像生成に対応 | Profile | **Specification** | 対応機能の一覧を示している。P-02比較・P-04課題解決の両方に使われる |
| 4 | `chatgpt-ev-004` | chatgpt | カスタムGPTsによる独自AIエージェントの作成・配布 | Profile | **Specification** | 独自エージェント作成という差別化機能を説明している。P-02比較の根拠になる |
| 5 | `claude-ai-ev-002` | claude-ai | 最大200,000トークンのコンテキストウィンドウ | Profile | **Specification** | 数値仕様（200Kトークン）を記述している。P-02比較で競合との差分を示す |
| 6 | `canva-ev-004` | canva | チームでのリアルタイム共同編集・コメント機能 | Profile | **Specification** | コラボレーション機能の仕様を説明している。P-02比較（Figmaとの差）に使われる |
| 7 | `canva-ev-005` | canva | ブランドキット機能：ロゴ・カラー・フォントをチームで一元管理 | Profile | **Specification** | ブランド管理機能という特定機能の仕様を説明している。P-04課題解決の根拠になる |
| 8 | `figma-ev-003` | figma | Figma価格・プラン | Profile | **Specification** | 料金プランという選定時の仕様情報を提供している。P-02比較の根拠になる |
| 9 | `microsoft-ev-003` | microsoft | Azure OpenAI Service — 企業向けAI API提供 | Profile | **Specification** | 企業向けAI APIという機能・提供形態を説明している。P-04課題解決の根拠になる |
| 10 | `jensen-huang-ev-002` | jensen-huang | NVIDIA H100・Blackwell — AI学習インフラの中核GPU | Profile | **Specification** | 具体的な製品名（H100/Blackwell）とその役割を説明している。P-02比較の根拠になる |
| 11 | `aisle-ev-006` | aisle | RefBase — AI参照知識基盤（refbase.ai） | Profile | **Specification** | RefBaseというプロダクト構成を説明している。Aisleのサービス仕様の一部 |
| 12 | `aisle-ev-014` | aisle | Aisle Emergence Scope（AI出現状況の観測ツール） | Profile | **Specification** | Emergence Scopeという観測機能を説明している。Aisleのツールラインナップの仕様 |
| 13 | `aisle-ev-015` | aisle | 企業AIプロフィール / 問い別AIページ / Hub の制作 | Profile | **Specification** | 制作物の種類（3種）を列挙している。Aisleのサービスメニュー＝仕様情報 |
| 14 | `anchor-artworks-ev-004` | anchor-artworks | 3DCG・2DCGアニメーション、モーションキャプチャ対応 | Profile | **Specification** | 対応技術の一覧を示している。制作会社としての技術仕様・対応範囲の証明 |
| 15 | `anchor-artworks-ev-016` | anchor-artworks | ブランドムービー・テレビCM・SNS動画など幅広いサービス | Profile | **Specification** | 提供サービスの種類を列挙している。制作会社のサービスラインナップ＝仕様 |
| 16 | `midjourney-ev-002` | midjourney | Midjourney V6 — 最新モデルの表現力と精度 | Profile | **Benchmark** | 「最新モデル」「表現力」「精度」という比較軸を提供している。P-02/P-03の根拠になる |
| 17 | `adobe-ev-004` | adobe | Adobe Premiere Pro・After Effects — 映像制作の業界標準 | Profile | **Benchmark** | 「業界標準」という市場での地位評価を示している。P-03ランキングの根拠になる |
| 18 | `shopify-ev-003` | shopify | Shopify App Store・エコシステム | Profile | **CaseStudy** | App Storeとエコシステムという実際に構築・運営している実績を証明している |
| 19 | `cristiano-ronaldo-ev-002` | cristiano-ronaldo | Al Nassr — Cristiano Ronaldo 在籍情報（2023年〜） | Profile | **CaseStudy** | Al Nassrへの移籍という実際に行ったキャリア選択・実績を示している |
| 20 | `lionel-messi-ev-002` | lionel-messi | Inter Miami CF — 在籍・活躍情報 | Profile | **CaseStudy** | Inter Miamiでの在籍・活躍という実際の行動・実績を示している |

#### Override確定 — Profile維持 5件

| evidenceId | entity | title | 確定理由 |
|-----------|--------|-------|---------|
| `figma-ev-001` | figma | Figma公式サイト | 公式概要ページ全体を指す。特定の機能ではなくEntityそのものを表すIdentity情報 |
| `shopify-ev-001` | shopify | Shopify公式サイト | 公式概要ページ全体を指す。Entityそのものを表すIdentity情報 |
| `anchor-artworks-ev-014` | anchor-artworks | 所在地：東京都目黒区 | 所在地という変わらないIdentity情報。活動・実績ではない |
| `anchor-artworks-ev-017` | anchor-artworks | CEO 勝田 康氏：経歴 | 人物の経歴紹介はEntityのIdentity情報（Interview的な発言はない） |
| `anchor-artworks-ev-018` | anchor-artworks | プロデューサー 目 学氏：経歴 | 同上 |

#### ルール昇格候補（3件以上同パターン → 自動分類へ）

現時点で昇格可能なパターン：

| パターン | 件数 | 自動分類ルール案 |
|---------|:---:|----------------|
| 「製品名 + 機能・対応一覧」を示している | 8件（#1〜10） | タイトルに「〜に対応」「〜を開発・提供」「〜機能」含む → **Specification** |
| 「サービス・ツールの種類を列挙」している | 3件（#11〜15の一部） | 「/」で複数サービスを並列 or 「幅広いサービス」含む → **Specification** |
| 「業界標準・最新モデル・性能」を評価している | 2件（#16〜17） | 「業界標準」「最新モデル + 精度/表現力」含む → **Benchmark**（昇格要件未達・継続観察） |
| 在籍・移籍・所属を示すキャリア情報 | 2件（#19〜20） | 「在籍」「在籍情報」含む → **CaseStudy**（昇格要件未達・継続観察） |

**Override Table 統計：**
- 変更件数：20件（Specification×15、Benchmark×2、CaseStudy×3）
- Profile確定（維持）：5件
- 合計管理件数：25件
- **Override 適用後の想定 Profile 比率：** 37件 → 17件 ≈ **11%**

---

### 6. 判定サンプル（Policy 適用例）

#### サンプル A：Anthropic Constitutional AI 論文

```
title: "Constitutional AI — AnthropicのAI安全性設計手法"
description: "AIに価値基準を憲法として与え自己評価させる手法を記述した査読論文。"
sourceType: research_paper
citationType: methodology
```

**判定：**
- sourceClass = `Research`（手法論文 = Researchが主。ベンチマークではない）
- default: P-02/P-05/P-06
- Override: P-06を残す（「なぜAnthropicが選ばれるか」の根拠になる）、P-02も残す（安全性アプローチの差別化）
- **確定: `["P-02", "P-05", "P-06"]`**

#### サンプル B：G2 Best Software Award 受賞

```
title: "G2 Best Software 2024 受賞"
description: "G2の年間ベストソフトウェア賞を受賞。ユーザー評価と市場影響力が評価基準。"
sourceType: award
citationType: award_record
```

**判定：**
- sourceClass = `Benchmark`（受賞基準がユーザー評価・市場評価 = 定量比較）
- default: P-02/P-03
- Override: P-03が強い（ランキング根拠）、P-06も追加（推薦文脈で使われる）
- **確定: `["P-02", "P-03", "P-06"]`**

#### サンプル C：ChatGPT 公式機能説明ページ

```
title: "ChatGPT 機能一覧 — GPT-4o・音声モード・カスタムGPT"
description: "ChatGPTの主要機能を公式サイトで説明。GPT-4o、音声会話、カスタムGPT等の機能詳細。"
sourceType: official_site
citationType: fact
```

**判定：**
- sourceClass = `Documentation`（機能説明 = Documentationが主）
- default: P-01/P-04/P-05
- Override: 機能一覧なのでP-02（他AIとの機能比較の根拠）も追加
- **確定: `["P-01", "P-02", "P-04", "P-05"]`**

