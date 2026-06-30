# Aisle Monitor Specification Ver2.0

**策定日**: 2026-06-30
**更新日**: 2026-06-30（emergence-monitor正本化・全面書き換え）
**位置づけ**: Aisle Monitorの正式仕様。**実体は `emergence-monitor` プロジェクトであり、aisle-app内のコードではない。**
**対象リポジトリ**: `C:\Users\kousu\OneDrive\Desktop\CLAUDE Aisle\emergence-monitor`（GitHub: 別リポジトリ）
**本番URL**: `https://emergence-monitor.aisle-aio.ai`（≒ `https://emergence-monitor.vercel.app`）

---

## 0. 改訂の経緯（重要）

Ver1.0〜1.2（2026-06-30作成）では、aisle-app内に新規実装した`/monitor`・`monitor-*` APIをAisle Monitorとして記載していた。

その後、RefBase側Bot検知連携（M3）の設計レビューに着手した際、**RefBase側のBot検知ミドルウェアが既に実装済みで、別の既存・本番稼働中プロジェクト`emergence-monitor`へ送信する設計になっていた**ことが判明した。棚卸しの結果、emergence-monitorはAI Contact/Monitoringが実Provider接続済み・Supabase永続化・RefBase連携が実績付きで稼働していることを確認し、**emergence-monitorを正式なAisle Monitorとして採用**した。aisle-app側のM1/M2実装（Vercel KV・simulated中心）は重複実装として削除した（経緯の詳細は`MASTER_ROADMAP.md` Section 45）。

本書はVer2.0として、emergence-monitorの実装をベースに全面書き換えたものである。

---

## 1. Product Vision

Aisle Monitor（emergence-monitor）は、AI出現を定点観測する **Observation Layer**。

Platform循環における役割：

```
Monitor（出現観測）
   ↓ 出現データ・改善示唆
Studio（知識の製造・検証）
   ↓ Publishable Knowledge
RefBase（公開・配信）
   ↓
AI
   ↓ 出現
Monitor（観測へ戻る）
```

「RefBaseに公開した情報がAIに実際に読まれているか（AI Contact）、自然な問いへの回答に出現するか（Monitoring）を定点観測する内部ツール」（emergence-monitor CLAUDE.md より）。観測のみを行い、データ入力（Entity/Reference作成）は一切行わない。

---

## 2. 技術スタック・位置づけ

| 項目 | 内容 |
|------|------|
| フレームワーク | React 19 + Vite + TypeScript + Tailwind 4 |
| バックエンド | Vercel Functions（`api/*.ts`） |
| 永続化 | **Supabase**（PostgreSQL、RLS有効） |
| LLM | Perplexity sonar / Anthropic Claude / OpenAI GPT / Google Gemini |
| 親フレームワーク | `..\`（Aisle定義書群） |
| データ取得元 | Aisle APP（`https://app.aisle-aio.ai/api/refbase-get`）。Entity/Reference情報は手入力せずAPI経由で取得 |
| RefBase | `https://www.refbase.ai`（AIに読ませる公開ページ。観測対象） |

**やってはいけないこと（emergence-monitor CLAUDE.md記載）**：
- `aisle-app/`へのimport（データはAPI経由のみ）
- RefBaseのDBへの直接アクセス
- Aisle APPのKVストアへの書き込み

---

## 3. 画面構成（3タブ）

| 画面 | 目的 |
|------|------|
| Dashboard | 出現率・クロール活動の俯瞰。AI Contact実行回数・Monitoring実行回数・RefBase AIクロール件数の統計カード、Provider別出現率、最近の実行履歴、RefBase AI Crawl Activity一覧 |
| AI Contact | RefBase URL（entity/reference/llms.txt）をAIに渡す（Seed Mode相当）。Perplexityは実URL Contact、Claude/GPT/Geminiはページ内容をプロンプト注入するPage-Inject方式 |
| Monitoring | 自然な問いへの出現を観測（Test Mode相当）。Referenceの`promptText`をそのまま質問として4 Providerに送信し、Entity名・RefBase本文/citation言及・競合言及を判定 |

認証：`VITE_ACCESS_PASSWORD`によるシンプルパスワード認証（管理画面ログイン用）。**既知の課題**：現状はこのパスワードをBearerトークンとして`/api/ai-contact-run`・`/api/monitoring-run`の認証にも流用している。将来的に管理画面ログイン用パスワードとAPI実行用トークンを分離する予定（MVP段階では内部ツールのため許容）。

---

## 4. API一覧

| API | メソッド | 責務 |
|-----|---------|------|
| `aisle-entity-list` | GET | Aisle APPから全Entity ID一覧を取得（`EM_SHARED_SECRET`認証でAisle APP `/api/refbase-get?type=all`を呼ぶ） |
| `aisle-entity-detail` | GET | 特定EntityのReference詳細を取得 |
| `ai-contact-run` | POST | AI Contact実行。Perplexity（URL Contact）/ Claude・GPT・Gemini（Page-Inject）で対象URLをAIに渡し、応答内のRefBase言及・citation・Entity言及を判定。`em_ai_contact_runs`/`em_ai_contact_items`に保存 |
| `monitoring-run` | POST | Monitoring実行。Referenceの問いをそのまま4 Providerのいずれかに送信し、自然回答内のEntity言及・RefBase言及（本文/citation）・競合言及を判定。`em_monitoring_runs`/`em_monitoring_items`に保存 |
| `entity-config` | GET/POST | Entity別の競合（competitor）リストを管理。Monitoring実行時の競合言及検出に使用 |
| `crawl-log` | GET/POST | RefBase middlewareからのBot検知ログ受信（POST）・診断用一覧取得（GET、`EM_SHARED_SECRET`認証） |

### 認証方式

| 連携 | 方式 |
|------|------|
| ブラウザUI → 各種実行API | `VITE_ACCESS_PASSWORD`をBearerトークンとして使用 |
| emergence-monitor → Aisle APP（Entity取得） | `EM_SHARED_SECRET`（`Authorization: Bearer`） |
| **RefBase → emergence-monitor（Crawl Log ingest）** | **`EM_SHARED_SECRET`（`Authorization: Bearer`）** |

`EM_SHARED_SECRET`は3プロジェクト（RefBase / Aisle APP / emergence-monitor）すべてに同一値を設定する共有シークレット。Vercel本番環境変数に設定済み（2026-06-30時点で全プロジェクトに存在確認済み）。

---

## 5. RefBase → emergence-monitor 連携（Crawl Log）

### ミドルウェア（RefBase側、`refbase/middleware.ts`）

```
matcher: '/', '/entity/:path*', '/reference/:path*', '/llms.txt', '/sitemap.xml',
         '/api/entity/:path*', '/api/reference/:path*'
```

対象パスへのリクエストごとにUser-Agentを判定し、Bot検知時に`event.waitUntil()`で**非同期・fire-and-forget**に`POST https://emergence-monitor.aisle-aio.ai/api/crawl-log`を送信する。送信失敗（catchで握りつぶし）はRefBaseのページ表示に一切影響しない。

### Bot User-Agent判定パターン（RefBase側で検知）

```
GPTBot / ChatGPT-User / ClaudeBot / PerplexityBot / Perplexity-User /
Google-InspectionTool / GoogleOther / Googlebot / Bingbot /
meta-externalagent / Bytespider
```

### 送信Payload

```typescript
{
  provider:      string;   // 検知したBot名（上記パターンのいずれか）
  userAgent:     string;
  url:           string;   // pathname + search
  method:        string;
  referrer?:     string;
  ipAddress?:    string;   // x-forwarded-for
  entityId?:     string;   // /entity/{id} または /reference/{id}/... から抽出
  referenceSlug?: string;  // /reference/{id}/{slug} から抽出
  accessedAt:    string;   // ISO 8601
}
```

### 受信側（emergence-monitor `api/crawl-log.ts`）

`EM_SHARED_SECRET`で認証後、`em_crawl_logs`テーブルにSupabase service-role経由で保存する。失敗時もRefBase側のクロール体験に影響させないよう、500を返すのみで例外を外部に伝播しない。

### 本番稼働確認（2026-06-30）

| 確認項目 | 結果 |
|---------|:---:|
| RefBaseがBot UAアクセスで正常応答するか（ミドルウェアがブロックしないか） | ✅ |
| `/api/crawl-log`が認証ガードされた状態でデプロイ済みか | ✅（無認証アクセスでHTTP 401） |
| `EM_SHARED_SECRET`が3プロジェクトに設定済みか | ✅ |
| emergence-monitor↔Aisle APP間の`EM_SHARED_SECRET`パイプラインが実際に動作するか | ✅（`/api/aisle-entity-list`で実Entity一覧31件を取得して確認） |
| emergence-monitorのSupabase接続が生きているか | ✅（`/api/entity-config`で正常応答を確認） |
| 直近の実クロールログ件数 | 未確認（`EM_SHARED_SECRET`を要する診断エンドポイント・パスワード認証必須のDashboardともに、このセッションでは値の取得・パスワード入力を行わなかったため。2026-06-23時点では実クロール検証済み。最新状況はユーザー側でDashboardログインの上で確認推奨） |

---

## 6. DB（Supabase）

```sql
em_ai_contact_runs    -- AI Contact runs (head): entity_id, provider, executed_at, total_urls, success_count, refbase_hit_count, entity_hit_count, status
em_ai_contact_items   -- per URL: run_id, url, url_type, contact_method, status, api_success, response_received, refbase_mentioned, citation_hit, entity_mentioned, response_text, citations, error_message

em_monitoring_runs    -- Monitoring runs (head): entity_id, provider, trigger, executed_at, total_questions, entity_hit_count, refbase_body_count, refbase_citation_count, status
em_monitoring_items   -- per question: run_id, question_text, prompt_type_id, entity_mentioned, refbase_in_body, refbase_in_citations, competitors_mentioned, response_text, citations, error_message

em_entity_config      -- Entity別 competitors[] リスト

em_crawl_logs         -- RefBase middlewareからのアクセスログ: accessed_at, url, entity_id, reference_slug, user_agent, provider, method, status_code, referrer, ip_address
```

RLS有効。`anon`ロール（フロントエンドDashboard）にはSELECTポリシーのみ付与。書き込みはすべてVercel Functions経由（`service_role`キー）。

---

## 7. MVPの実装範囲

- Provider：Perplexityを先行実装（URL Contact対応）、Claude/GPT/Geminiは枠あり（Page-Inject方式）
- AI Contact：entity / reference / llms.txt の3種URLを送信
- Monitoring：Referenceの`promptText`をそのまま問いとして使用
- cronは未実装（手動実行のみ）

### Contact方式（Provider別、固定・UI切替なし）

| Provider | 既定モード | 値 |
|---|---|---|
| Perplexity | URL Contact | `perplexity_search_domain` |
| GPT / Claude / Gemini | Inject Contact | `llm_page_inject` |

理由（2026-06-23検証）：chat completions系の素のAPI（Claude/GPT/Gemini）はブラウジング機能を持たないため、URLを渡すだけではRefBaseへアクセスしない。URL Contactが成立するのはPerplexityのみ。各AIにブラウジング/検索拡張ツールを別途有効化しない限りこの前提は変わらない。

---

## 8. Known Limitations

| 項目 | 内容 |
|------|------|
| API認証 | `VITE_ACCESS_PASSWORD`を実行系API（`ai-contact-run`/`monitoring-run`）の認証にも流用。将来分離予定 |
| cron | 未実装。すべて手動トリガー |
| Geminiの誤答リスク | URLを読めていないのに尤もらしく誤答するケースあり。crawlログとの突合せが必須（responseTextだけでは「読んだか」を判断できない） |
| Multi-provider Monitoring | 1リクエスト=1providerに正規化。複数provider同時実行はフロント側で個別呼び出し |
| Timeline表示 | 未実装（AI Contact→Crawl→Monitoring→Citationの時系列表示） |

5軸評価：

| 軸 | 状態 |
|----|:----:|
| Design | ✅ 設計確定 |
| Backend | ✅ 実装済み（6 API・Supabase） |
| UI | ✅ 実装済み（Dashboard/AI Contact/Monitoring 3画面） |
| Public | — 不要（`noindex, nofollow`設定済みの内部運用ツール） |
| Monitoring | — 自身がMonitoring Layer |

---

## 9. aisle-app側との関係（重要）

aisle-app（このリポジトリ）はemergence-monitorに対して以下の役割のみを持つ：

- **データ提供元**：`/api/refbase-get`がEntity/Reference情報をemergence-monitorに提供する（`EM_SHARED_SECRET`認証）
- **導線**：Sidebarに`https://emergence-monitor.aisle-aio.ai`への外部リンクを設置（`target="_blank"`）
- **`/monitor`リダイレクト**：`vercel.json`で`/monitor`・`/monitor/:path*`を`https://emergence-monitor.aisle-aio.ai`へHTTP 307リダイレクト（過去に`/monitor`導線を案内した利用者を迷子にしないため。404には戻さない）

aisle-app内にMonitor機能のコード（`monitor-*` API・`MonitorWorkbench`等）は**存在しない**（2026-06-30に削除済み）。

---

## Current Status

✅ **完了しているもの**：
- emergence-monitor本体（Dashboard/AI Contact/Monitoring 3画面、4 Provider対応、Supabase永続化）
- RefBase → emergence-monitor のCrawl Log連携（`EM_SHARED_SECRET`認証、2026-06-23に実クロール検証済み）
- emergence-monitor ↔ Aisle APP のEntity取得連携（2026-06-30に再確認済み）
- aisle-app側の`/monitor`リダイレクト・Sidebar外部リンク

❌ **未実装**：cron（定期実行）/ Timeline表示（Contact→Crawl→Monitoring→Citationの時系列）/ API認証トークンの分離

⚠️ **Technical Debt**：`VITE_ACCESS_PASSWORD`を実行系APIの認証にも流用している（emergence-monitor CLAUDE.md記載の既知課題、MVP段階では許容）

📋 **Parking Lot（emergence-monitor CLAUDE.md Phase2記載）**：
- AI Crawl Logの拡張（URL別クロール履歴の高度化、AI Contactとの比較表示）
- Emergence Timeline（生成→クロール→AI Contact→Monitoring→Citationの一連の流れを時系列表示）
- API認証トークンの分離（`EM_API_KEY`等）

---

*本書はAisle Monitor統合判断（2026-06-30）後のVer2.0として、emergence-monitorの実装を正式仕様として記録したもの。今後の更新はemergence-monitor側の実装変更に追従して行うこと。*
