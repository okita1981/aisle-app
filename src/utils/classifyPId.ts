import { P_IDS } from '../store/masterData';

// ── キーワードマッピング ──────────────────────────────────────────────

const KEYWORD_MAP: Record<string, string[]> = {
  'P-01': ['おすすめ', 'どこ', '相談', 'どうすれば', '選び方'],
  'P-02': ['比較', '違い', 'どっち', '優れている', 'メリット', 'デメリット'],
  'P-03': ['注目', 'ランキング', '話題', '人気', 'トレンド'],
  'P-04': ['課題', '改善', '解決', '戦略', 'どうすべき', '提案'],
  'P-05': ['出典', '論文', '根拠', '引用', 'データ', 'エビデンス'],
  'P-06': ['なぜ', '理由', '思想', '背景', '哲学'],
};

// ── ルールベース判定 ──────────────────────────────────────────────────
// 明確に1つのP-IDが最多マッチした場合のみそのP-IDを返す
// 複数が同数で最多、または0件の場合は null を返しClaude判定へ回す

function detectPIdByKeyword(promptText: string): string | null {
  const counts: Record<string, number> = {};
  for (const [pId, keywords] of Object.entries(KEYWORD_MAP)) {
    counts[pId] = keywords.filter(kw => promptText.includes(kw)).length;
  }

  const maxCount = Math.max(...Object.values(counts));
  if (maxCount === 0) return null;

  const topPIds = Object.entries(counts)
    .filter(([, count]) => count === maxCount)
    .map(([pId]) => pId);

  // 複数P-IDが同数タイ → 曖昧 → nullでClaude判定へ
  if (topPIds.length > 1) return null;

  return topPIds[0];
}

// ── Claude判定API呼び出し ─────────────────────────────────────────────

async function detectPIdByClaude(
  promptText: string,
): Promise<{ primary: string; secondary: string[]; reason: string }> {
  const resp = await fetch('/api/classify-pid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptText }),
  });
  const data = await resp.json() as {
    ok: boolean;
    primary?: string;
    secondary?: string[];
    reason?: string;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error ?? 'classify-pid API error');
  return {
    primary: data.primary ?? 'P-01',
    secondary: Array.isArray(data.secondary) ? data.secondary : [],
    reason: data.reason ?? '',
  };
}

// ── メイン判定関数 ────────────────────────────────────────────────────
// キーワード判定 → 明確ならそのまま返す / 曖昧ならClaude判定へ

export async function classifyPId(
  promptText: string,
): Promise<{ primary: string; secondary: string[]; reason: string }> {
  const keyword = detectPIdByKeyword(promptText);
  if (keyword !== null) {
    const pIdObj = P_IDS.find(p => p.pId === keyword);
    return {
      primary: keyword,
      secondary: [],
      reason: `キーワード判定：${pIdObj?.label ?? keyword}`,
    };
  }
  return detectPIdByClaude(promptText);
}
