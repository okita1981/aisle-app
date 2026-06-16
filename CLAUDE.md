# CLAUDE.md — Aisle aisle-app 実装ガイダンス

最終更新: 2026-06-12
本番URL: https://app.aisle-aio.ai
リポジトリ: `C:\Users\kousu\OneDrive\Desktop\CLAUDE Aisle\aisle-app`

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
| R-01 | **llms.txt の文字化け修正** | 高 | 日本語テキストが文字化けしている。AIクローラーが正しく読めない状態 |
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
