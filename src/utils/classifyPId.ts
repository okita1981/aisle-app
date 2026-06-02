import { P_IDS } from '../store/masterData';

// ── 一次キーワードマッピング（高精度・Claude判定前の絞り込み用） ────────

const KEYWORD_MAP: Record<string, string[]> = {
  'P-01': ['おすすめ', 'どこ', '相談', 'どうすれば', '選び方'],
  'P-02': ['比較', '違い', 'どっち', '優れている', 'メリット', 'デメリット'],
  'P-03': ['注目', 'ランキング', '話題', '人気', 'トレンド'],
  'P-04': ['課題', '改善', '解決', '戦略', 'どうすべき', '提案'],
  'P-05': ['出典', '論文', '根拠', '引用', 'データ', 'エビデンス'],
  'P-06': ['なぜ', '理由', '思想', '背景', '哲学'],
};

// ── 補助判定ルール（Claude API失敗時のフォールバック用・拡張版） ────────
// 優先度順：P-02 > P-06 > P-03 > P-05 > P-04 > P-01（P-01は最後のデフォルト）

const HEURISTIC_RULES: Array<{ pId: string; pattern: RegExp; reason: string }> = [
  { pId: 'P-02', pattern: /比較|違い|どっち|どちら|メリット|デメリット|差は|差が/, reason: '比較・評価語を検出' },
  { pId: 'P-06', pattern: /なぜ|理由|なぜなら|背景|思想|哲学|仕組み/, reason: '理由・背景語を検出' },
  { pId: 'P-03', pattern: /ランキング|人気|注目|ベスト|トップ|多い|主流/, reason: 'ランキング・人気語を検出' },
  { pId: 'P-05', pattern: /根拠|データ|統計|出典|論文|エビデンス|数値/, reason: '出典・データ語を検出' },
  { pId: 'P-04', pattern: /改善|解決|どうすべき|方法は|戦略|課題を/, reason: '課題解決語を検出' },
  { pId: 'P-01', pattern: /教えて|紹介|候補|おすすめ|会社を|会社は|誰が|どの.*会社|選び|どこ/, reason: '推薦・選定語を検出' },
];

/**
 * Claude API失敗時の補助判定。
 * 一次キーワードより広いパターンで判定し、理由を明示する。
 */
function heuristicClassify(promptText: string): { primary: string; secondary: string[]; reason: string } {
  for (const rule of HEURISTIC_RULES) {
    if (rule.pattern.test(promptText)) {
      const pIdObj = P_IDS.find(p => p.pId === rule.pId);
      return {
        primary: rule.pId,
        secondary: [],
        reason: `API一時失敗のため補助判定（${rule.reason}）`,
      };
      void pIdObj; // suppress unused warning
    }
  }
  // いずれのルールにも該当しない場合のみ P-01 デフォルト
  return {
    primary: 'P-01',
    secondary: [],
    reason: 'API一時失敗のため補助判定（パターン不一致 → 選定・相談型とみなす）',
  };
}

// ── 一次ルールベース判定 ──────────────────────────────────────────────
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
  const resp = await fetch('/api/classify', {
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
  if (!data.ok) throw new Error(data.error ?? 'classify API error');
  return {
    primary: data.primary ?? 'P-01',
    secondary: Array.isArray(data.secondary) ? data.secondary : [],
    reason: data.reason ?? '',
  };
}

// ── メイン判定関数 ────────────────────────────────────────────────────
// ① 一次キーワード判定 → 明確なら返す
// ② Claude API判定 → 成功なら返す
// ③ Claude API失敗 → heuristicClassify でフォールバック（P-01固定しない）

export async function classifyPId(
  promptText: string,
): Promise<{ primary: string; secondary: string[]; reason: string }> {
  // ① 一次キーワード判定
  const keyword = detectPIdByKeyword(promptText);
  if (keyword !== null) {
    const pIdObj = P_IDS.find(p => p.pId === keyword);
    return {
      primary: keyword,
      secondary: [],
      reason: `キーワード判定：${pIdObj?.label ?? keyword}`,
    };
  }

  // ② Claude API判定
  try {
    return await detectPIdByClaude(promptText);
  } catch {
    // ③ API失敗 → 補助判定（P-01固定しない）
    return heuristicClassify(promptText);
  }
}
