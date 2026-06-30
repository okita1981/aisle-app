/**
 * QuestionInstance GET API
 *
 * GET /api/qi-get?clientSlug={slug}
 *   → Entity の全 QuestionInstance を KV から返す（read-only）
 *
 * KV key: refbase:qi:{entityId}:{promptTypeId}
 * 安全条件: KV 読み取りのみ。書き込みなし。AI 呼び出しなし。
 *
 * ── 配線状況（PL-008・2026-06-30確認） ──────────────────────────────────────
 * このAPIは現在どこからも呼び出されていない（フロントエンド・scripts・
 * RefBaseリポジトリのいずれからも参照ゼロ）。未配線のレガシー候補として
 * 削除せず残している。
 *
 * 想定していた用途：S0で構想された「QuestionInstance Viewer」（生成済み
 * QuestionInstanceの一覧確認画面）。S4ではAuthoring WorkbenchのGenerateタブに
 * 簡易表示する形で代替したため、専用Viewerもこのエンドポイントも未実装のまま。
 * 将来QuestionInstance Viewerを独立画面として作る場合に、このAPIをそのまま
 * 使うか作り直すかを再評価すること。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

// QuestionInstance の KV 保存型（page-generate.ts の QuestionInstanceKV と同一）
interface QuestionInstanceKV {
  instanceId: string;
  templateId: string;
  entityId: string;
  promptTypeId: string;
  resolvedText: string;
  unresolvedSlots: string[];
  createdAt: string;
  updatedAt?: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALL_PROMPT_TYPE_IDS = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'] as const;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const clientSlug = url.searchParams.get('clientSlug');

  if (!clientSlug || !SLUG_PATTERN.test(clientSlug)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'clientSlug が不正です（小文字英数字とハイフンのみ）' }));
    return;
  }

  try {
    // 全 P-ID 分を並列取得
    const kvResults = await Promise.all(
      ALL_PROMPT_TYPE_IDS.map(pid =>
        kv.get<QuestionInstanceKV>(`refbase:qi:${clientSlug}:${pid}`)
      )
    );

    const instances: QuestionInstanceKV[] = kvResults.filter(
      (r): r is QuestionInstanceKV => r !== null
    );

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      clientSlug,
      count: instances.length,
      instances,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
