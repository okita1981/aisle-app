# Aisle Monitor Specification Ver1.2

**策定日**: 2026-06-30
**更新日**: 2026-06-30（M2完了反映）
**位置づけ**: Phase 3 M2（Monitor UI実装）完了時点の正確な記録。Aisle Platform Specification Ver3.0と用語・定義を整合させる。
**対象リポジトリ**: `C:\Users\kousu\OneDrive\Desktop\CLAUDE Aisle\aisle-app`（`api/monitor-*.ts` / `api/_monitor-types.ts` / `api/_monitor-providers.ts` / `src/components/MonitorWorkbench.tsx` / `src/lib/monitorApi.ts`）
**本番URL**: `https://app.aisle-aio.ai/monitor`（UI）/ `https://app.aisle-aio.ai/api/monitor-*`（API）

---

## 1. Product Vision

Aisle Monitor は、AI出現を定点観測する **Observation Layer**。

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

着手条件（Platform Roadmap Policy v1.0）：「Studio Quality Audit（L6）+ Publishing（L7）完了後」。この条件は2026-06-30のPhase 2完了をもって満たされ、同日M1実装に着手・完了した。

---

## 2. 実装範囲（M1 — 2026-06-30完了 / M2 — 2026-06-30完了）

| 機能 | 実装状態 | API / UI |
|------|:--------:|-----|
| RefBase Entity/Reference 読み取り連携 | ✅ 実装済み | `GET /api/monitor-entities` |
| Manual AI Contact（手動接触） | ✅ 実装済み（perplexityのみ・simulated） | `POST/GET /api/monitor-contact` |
| Appearance Monitoring（手動トリガー） | ✅ 実装済み（PERPLEXITY_API_KEY有無でreal/simulated切替） | `POST/GET /api/monitor-appearance` |
| Crawl Log（RefBase Bot検知の受信） | ✅ 実装済み（受信側のみ。RefBase側送信実装は別リポジトリ） | `POST /api/monitor-crawl-ingest` / `GET /api/monitor-crawl-log` |
| Dashboard（Entity別・Provider別・period別集計） | ✅ 実装済み | `GET /api/monitor-dashboard` |
| **管理UI（`/monitor`）** | **✅ M2で実装済み** | Dashboard/Manual Contact/Appearance Monitoring/Crawl Log の4タブ |

### 未実装（M2時点でもスコープ外・ブロッカーではない）

| 機能 | 状態 |
|------|:----:|
| Seed Mode A（生成時即時チェック） | ❌ 未実装（Parking Lot） |
| Seed Mode B（定期巡回・Scheduled Contact） | ❌ 未実装（Parking Lot） |
| Test Mode（特定Questionの定期送信・出現率計測） | ❌ 未実装（Parking Lot） |
| Observation → Knowledge フィードバックループ | ❌ 未実装（Parking Lot） |
| ChatGPT/Gemini Provider対応 | ❌ 未実装（現状perplexityのみ。UI上はdisabled表示） |
| RefBase側Bot検知ミドルウェア（送信側） | ❌ 未実装（別リポジトリの作業） |
| グラフ・チャート可視化 | ❌ 未実装（M2はテーブル表示のみ） |
| リアルタイム更新 | ❌ 未実装（手動再取得のみ） |

M1完了の詳細記録は `MASTER_ROADMAP.md` Section 41〜43、M2完了の詳細記録は Section 44 を参照。

---

## 3. Dashboard / Entity設定 / 管理UI

`GET /api/monitor-dashboard` がEntity別・Provider別・period（7d/30d/all）別の集計を返す。Contact / Crawl / Appearance は常に独立指標として集計し、`causedBy`/`conversion`/`attribution`等の因果断定フィールドは一切持たない（Section 6参照）。

**管理UI（`/monitor`、M2で実装済み）**：`src/components/MonitorWorkbench.tsx`。Studioの`/admin`・`/authoring`と同じく`PasswordGate`の保護対象（`PRIVATE_EXACT`/`PRIVATE_PREFIXES`に登録済み）。4タブ構成：

| タブ | 内容 |
|------|------|
| Dashboard | Entity別集計テーブル（period切替付き） |
| Manual Contact | Entity/Reference/Provider選択 → Contact実行 → 履歴一覧（simulatedバッジ表示） |
| Appearance Monitoring | Entity/Provider選択 → 質問文入力 → 実行 → 履歴一覧（appeared/citationFound/simulatedバッジ表示） |
| Crawl Log | entityId/providerフィルタ付き一覧。`relatedContactRuns`は中立的な「参考」表現で表示 |

API呼び出しは`src/lib/monitorApi.ts`（`monitorGet`/`monitorPost`）経由で`x-aisle-admin: 1`ヘッダーを付与する（`src/lib/authoringApi.ts`と同方針）。

---

## 4. API

### 4.1 API一覧

| API | メソッド | 責務 |
|-----|---------|------|
| `monitor-entities` | GET | RefBase Entity/Reference一覧の読み取り連携（書き込みなし） |
| `monitor-contact` | POST/GET | Manual AI Contact実行・履歴取得 |
| `monitor-appearance` | POST/GET | Appearance Monitoring実行・履歴取得 |
| `monitor-crawl-ingest` | POST | RefBase→Monitorの受信専用（Fire-and-forget） |
| `monitor-crawl-log` | GET | Crawl Log一覧・`relatedContactRuns`時間相関 |
| `monitor-dashboard` | GET | Contact/Crawl/Appearanceの独立集計 |

### 4.2 認証方式（確定・標準ルール）

| 連携 | 方式 |
|------|------|
| ブラウザUI → Monitor管理API（GET系・実行系） | `x-aisle-admin: 1`（`isAuthorized()`。Studio既存パターンと同一） |
| **RefBase → Monitor のサーバー間通信（Crawl Log ingest）** | **`Authorization: Bearer {MONITOR_INGEST_SECRET}`** |

`MONITOR_INGEST_SECRET`はMonitor Crawl Log連携専用の共有シークレットであり、`EM_SHARED_SECRET`（既存・別用途）とは分離管理する。理由：UIの簡易認証（`x-aisle-admin`）はサーバー間連携に不向きであり、また将来Monitor以外の連携が増えた際に既存シークレットを使い回すと責務が曖昧になるため。RefBase側からのingestはFire-and-forgetを前提とし、ingest失敗（401/500含む）はRefBase側の表示に一切影響しない設計とする。Vercel本番環境変数に設定済み。

---

## 5. DB（Vercel KV）

Monitor専用のKVキープレフィックス`monitor:*`を使用。Studio/RefBaseと同一Vercel KVを共有する（専用KV分離は将来課題・未決定）。

```
monitor:contact:run:{runId}              → ContactRun
monitor:contact:item:{runId}:{itemId}    → ContactItem
monitor:contact:run:{runId}:items        → string[]
monitor:contact:runs:index               → string[]

monitor:appearance:run:{runId}           → MonitoringRun
monitor:appearance:item:{runId}:{itemId} → MonitoringItem
monitor:appearance:run:{runId}:items     → string[]
monitor:appearance:runs:index            → string[]

monitor:crawl:log:{logId}                → CrawlLogEntry
monitor:crawl:logs:index                 → string[]
```

RefBase既存KV（`refbase:company:*` / `refbase:index:*` / `refbase:ref:*`）は読み取り専用で参照する。Monitor側からRefBase KVへの書き込みは一切行わない。

---

## 6. 因果断定の禁止（最重要ガードレール）

ContactRun/ContactItem・MonitoringRun/MonitoringItem・CrawlLogEntryのいずれも、他のRunへの`causedBy`的な参照を持たない。`CrawlLogEntry.relatedContactRuns`のみ「同一entityId・時間窓120分以内」のco-occurrenceとして`{runId, timeDeltaMinutes}`を提示し、因果は一切主張しない。`monitor-dashboard`の集計も3指標（Contact/Crawl/Appearance）を完全に独立した関数で算出し、`conversion`・`attribution`・合成スコアの類は一切実装しない。

---

## 7. Known Limitations

| 項目 | 内容 |
|------|------|
| 対応Provider | perplexityのみ（ChatGPT/Geminiは型定義・UI選択肢上の存在のみで未接続。UIはdisabled表示） |
| Contact実行 | M1-2は到達性チェック（HTTP GET）のみ。実Provider API接触は未実装で全件simulated |
| Appearance判定 | 文字列包含判定のみ（Entity名・URL）。意味評価・好意度評価は行わない |
| UI可視化 | テーブル表示のみ。グラフ・チャートは未実装 |
| UI更新 | 手動再取得のみ。リアルタイム更新（WebSocket等）は未実装 |
| Scheduled実行 | なし。すべて手動トリガー（UIのボタン操作含む） |
| Provider推定（Crawl Log） | User-Agentの部分一致のみ。確証ではない |

5軸評価（MASTER_ROADMAP記載の評価軸を踏襲）：

| 軸 | 状態 |
|----|:----:|
| Design | ✅ 設計確定 |
| Backend | ✅ M1完了（6 API） |
| UI | ✅ M2完了（`/monitor`・4タブ） |
| Public | — 不要（内部運用ツール） |
| Monitoring | — 自身がMonitoring Layer |

---

## 8. ドキュメント品質

本書は「実装済みのみ記載する」方針を維持し、M2完了時点（2026-06-30）での実装範囲を正確に記録した。設計のみでコードが存在しない機能（Seed Mode A/B・Test Mode・グラフ可視化等）はSection 2で明示的に「未実装」と区別している。

---

## Current Status

✅ **完了しているもの**：
- Monitor API群（M1 Must 5項目：Manual AI Contact / Crawl Log / Appearance Monitoring / Dashboard / RefBase読み取り連携）。本番デプロイ・実データ検証済み
- Monitor管理UI（M2：`/monitor`・4タブ）。本番デプロイ済み。Dashboard実データ表示・Contact/Appearance実行（API直接実行による証明）・Crawl Log表示・simulatedバッジ表示・因果断定しない文言を確認済み
- `/monitor`・`/authoring`のPasswordGate保護化（M2であわせて実施）

❌ **未実装**：Scheduled Contact（定期実行）/ Seed Mode A・B / Test Mode / Observation→Knowledgeフィードバックループ / ChatGPT・Gemini Provider接続 / RefBase側Bot検知ミドルウェア（送信側）/ グラフ・チャート可視化 / リアルタイム更新

⚠️ **Technical Debt**：該当なし（既知の制約はSection 7に記載の通りで、すべて意図的な設計判断）

⚠️ **検証上の留意事項**：M2完了確認はAPI直接実行・本番JSバンドル検査・HTTPステータス確認によって行った。Chrome拡張機能が確認セッション中に利用できなかったため、実ブラウザでのクリック操作（タブ切り替え・フォーム送信・ボタン押下）の目視確認は未実施。ユーザーによる`/monitor`の実機確認を推奨する。

📋 **Parking Lot**：
- Seed Mode A/B・Test Modeの実装着手判断
- Scheduled Contact本実装・Schedule Config型の正式導入
- Monitor用KV専用分離の決定（Studio/RefBaseとの共有 or 専用分離）
- RefBase側Bot検知ミドルウェアの実装（別リポジトリ）
- Aisle Scope（Monitor完了後に設計着手。現状`aisle-ev-014`にEvidence定義のみ）
- グラフ・チャート可視化（Dashboard）
- リアルタイム更新

---

*本書はM2完了時点（2026-06-30）でのMonitor実装範囲を正確に記録したもの。M3着手後、実装が進むたびに本書を実装ベースへ更新すること。*
