import type { IncomingMessage, ServerResponse } from 'node:http';

export const maxDuration = 60;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MAX_CHARS = 4000; // Claudeに渡す生テキストの上限

// ── Claude で要点を抽出・構造化 ────────────────────────────────

const STRUCTURE_SYSTEM = `与えられたWebページのテキストから、
AIに引用されやすい形に情報を構造化してください。

以下の観点で200〜400字にまとめてください：
・このサービス・会社の強みと差別化ポイント
・ターゲット顧客と解決する課題
・具体的な提供価値・実績（あれば）
・創業思想・ミッション（あれば）

箇条書きではなく、AIが自然に引用できる文章形式で出力してください。
余計な説明は不要です。構造化されたテキストのみ返してください。`;

async function structureWithClaude(rawText: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: STRUCTURE_SYSTEM,
      messages: [{ role: 'user', content: rawText.slice(0, MAX_CHARS) }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Claude API エラー（${resp.status}）: ${errText.slice(0, 200)}`);
  }

  const json = await resp.json() as { content?: { type: string; text: string }[] };
  const block = json.content?.[0];
  if (!block || block.type !== 'text') throw new Error('Claude からテキストを取得できませんでした');
  return block.text.trim();
}

// ── HTMLからテキストを抽出 ─────────────────────────────────────

function stripHtml(html: string): string {
  return html
    // スクリプト・スタイル・不要ブロックを丸ごと除去
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    // ブロック要素を改行に変換
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // 残りのタグを除去
    .replace(/<[^>]+>/g, '')
    // HTMLエンティティをデコード
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&hellip;/g, '...')
    // 空白・改行を整理
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── ハンドラ ──────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as { url?: string };
    const { url } = body;

    if (!url?.trim()) throw new Error('URLが必要です');

    // URLバリデーション
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error('有効なURLを入力してください');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('http / https のURLのみ対応しています');
    }

    // ページ取得
    const resp = await fetch(url.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AisleBot/1.0; +https://aisle-aio.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`ページの取得に失敗しました（HTTP ${resp.status}）`);

    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('html') && !contentType.includes('text')) {
      throw new Error('HTMLページ以外のコンテンツには対応していません');
    }

    const html = await resp.text();
    const rawText = stripHtml(html);

    if (rawText.length < 50) throw new Error('テキストを取得できませんでした。JavaScriptで動的に生成されるページは対応していません');

    // Claude で要点を抽出・構造化
    const structuredText = await structureWithClaude(rawText);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      text: structuredText,
      totalLength: structuredText.length,
      rawLength: rawText.length,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
