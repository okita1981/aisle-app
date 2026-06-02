import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── スラグ生成（page-generate.ts の toSlug と同一ロジック） ────────────
function toSlug(companyName: string): string {
  const stripped = companyName
    .replace(/株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人|一般財団法人/g, '')
    .trim();
  const ascii = stripped.replace(/[^\x20-\x7E]/g, '').trim();
  if (ascii.length > 0) {
    const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug.length > 0) return slug.slice(0, 60);
  }
  return `client-${Date.now()}`;
}

// ── タイムスタンプを compact 形式に変換（例: 20260602-091500） ──────────
function toCompactTs(iso: string): string {
  return iso.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

// ── セッションインデックスエントリ型 ──────────────────────────────────
export interface SessionIndexEntry {
  sessionKey: string;
  savedAt: string;
  companyName: string;
  promptCount: number;
  hasPhase2: boolean;
  hasPhase3: boolean;
  hasPhase4: boolean;
}

// ── 外部URLエントリ型（ExternalUrlItem と同一構造） ──────────────────
export interface ExternalUrlEntry {
  type: string;  // 例: "note" | "LinkedIn" | "公式サイト" | "メディア記事"
  url: string;
}

// ── リクエストボディ型 ───────────────────────────────────────────────
interface SaveRequest {
  /** フロントから明示指定がある場合に優先。なければ phase0Data.companyName から自動生成 */
  clientSlug?: string;
  phase0Data?: { companyName?: string; category?: string; keywords?: string; prompts?: unknown[] } | null;
  logEntries?: unknown[];
  phase1Result?: unknown;
  competitorAnalysis?: unknown;
  phase2Result?: unknown;
  phase3Result?: unknown;
  phase4Result?: unknown;
  /** AI向け根拠補完リンク（Note / LinkedIn / 公式サイト等）。RefBase Evidence / Related References に使用 */
  externalUrls?: ExternalUrlEntry[];
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as SaveRequest;

    // clientSlug の決定（明示指定 > companyName から自動生成）
    const companyName = body.phase0Data?.companyName ?? '';
    const clientSlug = body.clientSlug?.trim() || toSlug(companyName) || 'unknown';

    const now = new Date().toISOString();
    const ts = toCompactTs(now);
    const sessionKey = `session:${clientSlug}:${ts}`;

    // ── セッション本体を KV に保存 ──────────────────────────────────
    // ※ Vercel KV (Upstash Redis) は 1 値あたり最大 100MB まで許容。
    //    logEntries × aiOutput が大きい場合でも通常は 1-3MB 程度に収まる。
    const sessionData = {
      sessionKey,
      savedAt: now,
      clientSlug,
      schema: 'aisle-session-v1',
      phase0Data:         body.phase0Data         ?? null,
      logEntries:         body.logEntries         ?? [],
      phase1Result:       body.phase1Result       ?? null,
      competitorAnalysis: body.competitorAnalysis ?? null,
      phase2Result:       body.phase2Result       ?? null,
      phase3Result:       body.phase3Result       ?? null,
      phase4Result:       body.phase4Result       ?? null,
      externalUrls:       (body.externalUrls ?? []).filter(u => u.url.trim() !== ''),
    };

    await kv.set(sessionKey, sessionData);

    // ── セッションインデックスを更新（clientSlug ごとに最新50件保持） ──
    const indexKey = `session-index:${clientSlug}`;
    const existingIndex = await kv.get<SessionIndexEntry[]>(indexKey) ?? [];

    const promptIds = Array.isArray(body.logEntries)
      ? [...new Set(
          (body.logEntries as Array<{ promptId?: string }>)
            .map(e => e.promptId)
            .filter(Boolean),
        )]
      : [];

    const indexEntry: SessionIndexEntry = {
      sessionKey,
      savedAt: now,
      companyName: companyName || clientSlug,
      promptCount: promptIds.length,
      hasPhase2: !!body.phase2Result,
      hasPhase3: !!body.phase3Result,
      hasPhase4: !!body.phase4Result,
    };

    const updatedIndex = [indexEntry, ...existingIndex].slice(0, 50);
    await kv.set(indexKey, updatedIndex);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, sessionKey, savedAt: now, clientSlug }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
