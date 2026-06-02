# CLAUDE.md — Aisle aisle-app 実装ガイダンス

最終更新: 2026-06-03
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
| LLM | Anthropic Claude（`claude-sonnet-4-20250514`） |
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
│   └── page-delete.ts       # ページ削除・インデックス更新・親ページ再生成
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
- [ ] 最小差分で実装されているか

---

## 10. Known Limitations（Ver1.5+）

| # | 内容 | 対応予定 |
|---|------|----------|
| L-01 | llms.txt は page-index:aisle 固定。clientSlug別未対応 | Ver2 |
| L-02 | Preview / 下書き機能なし。生成即公開 | Ver2 |
| L-03 | clientSlug重複管理なし | Ver2 |
| L-04 | /{clientSlug}/profile 未実装 | 次フェーズ |
| L-05 | モニタリング機能なし（Emergence Scope連携予定） | Ver2 |

---

## 11. 次に着手する優先事項（UX改善フェーズ）

1. ✅ **公開中ページ管理テーブル**（実装済み・テスト中）
2. ⬜ **保存完了表示**（生成・更新・削除後のフィードバックUI）
3. ⬜ **Add / Update の文言整理**
4. ⬜ **Session管理画面**
5. ⬜ **RefBase Preview導線**
