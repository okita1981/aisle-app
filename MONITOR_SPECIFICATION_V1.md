# Aisle Monitor Specification Ver1.0

**策定日**: 2026-06-30
**位置づけ**: 現時点版。**実装済み機能はゼロ**であり、本書はその事実を正確に記録するためのもの。Aisle Platform Specification Ver3.0と用語・定義を整合させる。
**対象リポジトリ**: 存在しない（コードベース未作成。`C:\Users\kousu`配下を検索したが、Monitor/Scope実装コードは見つからなかった。`Downloads/`配下に「Aisle Emergence Scope Report」という名称のPDF出力物が複数あるが、これらはレポート成果物であり実装コードではない）

---

## 1. Product Vision

Aisle Monitor は、AI出現を定点観測する **Observation Layer** として設計されている（CLAUDE.md / MASTER_ROADMAP記載の設計のみ。実装は未着手）。

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

着手条件（Platform Roadmap Policy v1.0）：「Studio Quality Audit（L6）+ Publishing（L7）完了後」。この条件は2026-06-30のPhase 2完了をもって満たされた。

---

## 2. AI Contact / Monitoring / Crawl Log / Discovery（設計のみ・実装ゼロ）

CLAUDE.md（MASTER_ROADMAP 1-C）に記載された設計：

| 機能 | 設計内容 | 実装状態 |
|------|---------|:--------:|
| Seed Mode A | 生成時即時チェック。Reference公開直後にPerplexity/ChatGPT等へ問い合わせ、出現を確認する | ❌ 未実装 |
| Seed Mode B | 定期巡回。cronジョブで定点観測する | ❌ 未実装 |
| Test Mode | 特定Questionを定期送信し、Perplexity等での出現率を計測する | ❌ 未実装 |
| Observation → Knowledge フィードバックループ | 出現結果をCoverage/Evidenceに反映する | ❌ 未実装 |

AI Contact（AIへの問い合わせ機構）・Crawl Log（巡回記録）・Discovery（新規言及の発見）に該当する実装は存在しない。

---

## 3. Dashboard / Entity設定

実装なし。Studioの`/admin`・`/authoring`に相当する管理画面はMonitor側に存在しない。

---

## 4. API

M1実装が進行中（2026-06-30〜）。詳細はMASTER_ROADMAPのM1各ステップ完了記録を参照。本セクションはM1完了時に全面更新する。

### 認証方式（確定・標準ルール）

| 連携 | 方式 |
|------|------|
| ブラウザUI → Monitor管理API（GET系・実行系） | `x-aisle-admin: 1`（`isAuthorized()`。Studio既存パターンと同一） |
| **RefBase → Monitor のサーバー間通信（Crawl Log ingest）** | **`Authorization: Bearer {MONITOR_INGEST_SECRET}`** |

`MONITOR_INGEST_SECRET`はMonitor Crawl Log連携専用の共有シークレットであり、`EM_SHARED_SECRET`（既存・別用途）とは分離管理する。理由：UIの簡易認証（`x-aisle-admin`）はサーバー間連携に不向きであり、また将来Monitor以外の連携が増えた際に既存シークレットを使い回すと責務が曖昧になるため。RefBase側からのingestはFire-and-forgetを前提とし、ingest失敗（401/500含む）はRefBase側の表示に一切影響しない設計とする。

---

## 5. DB

実装なし。Monitor専用のKVキー・データベーススキーマは存在しない。将来実装時はStudio/RefBaseと同一Vercel KVを共有するか専用KVを持つかは未決定（RefBase側のPL-004「専用KV分離」と合わせて判断する必要がある）。

---

## 6. Known Limitations

| 項目 | 内容 |
|------|------|
| 実装 | コードベース自体が存在しない（0%） |
| 設計 | Seed Mode A/B・Test Modeの概念設計のみ確定（CLAUDE.md記載） |
| UI | 0% |
| API | 0% |
| DB | 0% |

5軸評価（MASTER_ROADMAP 1-C記載）：

| 軸 | 状態 |
|----|:----:|
| Design | ✅ 設計確定（Seed Mode A/B / Test Mode） |
| Backend | ❌ 0% |
| UI | ❌ 0% |
| Public | — 不要 |
| Monitoring | — 自身がMonitoring Layer |

---

## 7. ドキュメント品質

本書は「実装済みのみ記載する」方針に従い、設計段階の構想（Seed Mode等）を2章で明示的に「設計のみ・実装ゼロ」と区別して記載した。将来の実装着手時には、本書を実装ベースの記述へ更新し、設計と実装の混同を避けること。

---

## Current Status

✅ **完了しているもの**：なし（着手条件のみ満たされた状態）

❌ **未実装**：Monitor全機能（AI Contact / Monitoring / Crawl Log / Discovery / Dashboard / Entity設定 / API / DB すべて）

⚠️ **Technical Debt**：該当なし（実装が存在しないため負債も発生していない）

📋 **Parking Lot**：
- Seed Mode A/B・Test Modeの実装着手判断（Phase 3キックオフ時）
- Monitor用KV方針の決定（Studio/RefBaseとの共有 or 専用分離）
- Aisle Scope（Monitor完了後に設計着手。現状`aisle-ev-014`にEvidence定義のみ）

---

*本書はPhase 2完了時点（2026-06-30）でMonitorが未着手であることを正確に記録したもの。Phase 3着手後、実装が進むたびに本書を実装ベースへ更新すること。*
