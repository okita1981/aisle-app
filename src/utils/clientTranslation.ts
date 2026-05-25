// ============================================================
// src/utils/clientTranslation.ts
// 内部ID → クライアント向け表現の変換辞書
//
// 設計思想:
//   - Report.tsx（クライアントレポート）専用
//   - UIタブ側（Phase1〜4）は変更しない
//   - K-IDは label + description の2層構造
//     （将来の動的テンプレート差し込みに拡張可能）
//
// Ver2拡張ポイント:
//   translateKIdDescription の context に
//   { competitor, count, promptText } 等を追加し、
//   動的テンプレート文に差し替える
// ============================================================

// ── P-ID ─────────────────────────────────────────────────────

const P_ID_CLIENT_LABELS: Record<string, string> = {
  'P-01': '相談・選定の問い',
  'P-02': '比較・評価の問い',
  'P-03': '人気・注目の問い',
  'P-04': '課題解決の問い',
  'P-05': '根拠・データの問い',
  'P-06': '推薦理由の問い',
};

/**
 * P-IDコード（P-01 / P-01-03 等）からクライアント向け問いタイプ名を返す
 * 型部分（P-01）を取り出して変換する
 */
export function translatePId(pId: string): string {
  if (!pId) return pId;
  const typeId = pId.match(/^(P-\d+)/)?.[1] ?? pId;
  return P_ID_CLIENT_LABELS[typeId] ?? pId;
}

// ── M-ID ─────────────────────────────────────────────────────

const M_ID_CLIENT_LABELS: Record<string, string> = {
  'M-01': '話題性・知名度の訴求',
  'M-02': '他社との違いの明示',
  'M-03': '実績・信頼性の裏付け',
  'M-04': '専門性・技術力の説明',
  'M-05': '事業の思想・世界観の提示',
  'M-06': '顧客課題への共感・問題提起',
  'M-07': '解決策・アプローチの説明',
  'M-08': '比較軸・検討基準の提示',
  'M-09': '第三者・専門家からの推薦',
  'M-10': '次のアクションへの誘導',
  'M-11': '先進性・将来性の訴求',
  'M-12': 'サービス全体像の体系的な説明',
  'M-13': '対象業種・用途への特化表現',
};

/**
 * M-IDコード（M-01 / M-01-A 等）からクライアント向け設計意図名を返す
 */
export function translateMId(mId: string): string {
  if (!mId) return mId;
  const baseId = mId.match(/^(M-\d+)/)?.[1] ?? mId;
  return M_ID_CLIENT_LABELS[baseId] ?? mId;
}

// ── K-ID ─────────────────────────────────────────────────────
// label       : バッジ・グラフ用の短ラベル（クライアント向け）
// description : 静的フォールバック説明文
//
// Ver2拡張ポイント:
//   translateKIdDescription に { competitor, count, promptText } を追加し、
//   "〇〇という問いでは競合が△件並んで出現しており…" のような
//   動的テンプレートに差し替える

const K_ID_CLIENT_LABELS: Record<string, { label: string; description: string }> = {
  'K-01': {
    label: '他社候補との競争が強い',
    description:
      '同カテゴリの競合他社が代替・比較候補として名指しで登場しており、あなたの商材が候補に入りにくい状態です。',
  },
  'K-02': {
    label: '競合が回答の主語を占めている',
    description:
      'AIの回答で競合が主語の位置を占有しており、あなたの商材が主語として登場できない構造になっています。',
  },
  'K-03': {
    label: '信頼情報・第三者評価が不足',
    description:
      '競合が業界レポートやメディアに掲載されており、その情報量の差があなたの出現に影響しています。',
  },
  'K-04': {
    label: '競合がカテゴリの代名詞になっている',
    description:
      '競合がカテゴリを代表する存在として認識されており、あなたの商材がカテゴリの一例として埋もれています。',
  },
  'K-05': {
    label: '同カテゴリ企業に埋もれやすい',
    description:
      '同カテゴリの企業・サービスが多数並んで出現しており、候補の枠が飽和している状態です。',
  },
  'K-06': {
    label: '問いとの接続が弱い',
    description:
      '問いの文脈とあなたの商材説明の間に意味的なズレがあり、AIが結びつけにくい状態です。',
  },
  'K-07': {
    label: '競合の外部露出量が圧倒的に多い',
    description:
      '競合のSNS言及・外部掲載の物量が多く、情報量の差が出現率に影響しています。',
  },
  'K-08': {
    label: '問われ方と商材の見え方がズレている',
    description:
      '問いが求めている粒度（企業名・ツール名・概念）と実際の出現レベルがずれています。',
  },
  'K-09': {
    label: '概念説明として処理されている',
    description:
      '「〜とは？」など概念説明の文脈が支配的で、特定の企業・商材として登場する余地が少ない状態です。',
  },
  'K-10': {
    label: '別カテゴリとして認識されるリスク',
    description:
      'AIがあなたの商材を別カテゴリや別用途として認識しており、期待する文脈で出現していない可能性があります。',
  },
};

/**
 * K-IDの短ラベルを返す（バッジ・グラフ用）
 */
export function translateKIdLabel(kId: string): string {
  if (!kId) return kId;
  return K_ID_CLIENT_LABELS[kId]?.label ?? kId;
}

/**
 * K-IDの文脈説明を返す
 * 優先順位: kIdReasons → kIdCorrection → adoptionReason → 静的 description
 *
 * @param kId     - K-IDコード（例: 'K-05'）
 * @param context - AI生成済みの文脈情報（A案優先順位）
 *
 * Ver2拡張ポイント:
 *   context に { competitor, count, promptText } を追加し、
 *   動的テンプレートに差し替える
 */
export function translateKIdDescription(
  kId: string,
  context?: {
    kIdReasons?: Record<string, string>;
    kIdCorrection?: string;
    adoptionReason?: string;
  }
): string {
  if (context?.kIdReasons?.[kId]) return context.kIdReasons[kId];
  const correction = context?.kIdCorrection?.trim();
  if (correction && correction !== 'なし' && correction !== '') return correction;
  const reason = context?.adoptionReason?.trim();
  if (reason && reason !== '') return reason;
  return K_ID_CLIENT_LABELS[kId]?.description ?? '';
}

// ── E-ID ─────────────────────────────────────────────────────

const E_ID_CLIENT_LABELS: Record<string, string> = {
  'E-01': 'メディア・ニュースへの掲載',
  'E-02': '専門家・専門メディアでの言及',
  'E-03': '実績・事例のコンテンツ掲載',
  'E-04': 'FAQ・Q&A形式のコンテンツ構造',
  'E-05': 'SNS・口コミでの話題',
  'E-06': '外部サイトからの参照・被リンク',
  'E-07': '比較記事・ランキングへの掲載',
  'E-08': 'AI読み取り対応のページ構造',
  'E-09': '複数メディアでの同時言及',
  'E-10': '情報の更新頻度・鮮度',
  'E-11': 'AIが認識済みの企業・サービス情報',
  'E-12': 'サイト構造・ページ間の導線設計',
  'E-13': '引用されやすい文章・コンテンツ構造',
};

/**
 * E-IDコードからクライアント向けラベルを返す
 */
export function translateEId(eId: string): string {
  if (!eId) return eId;
  return E_ID_CLIENT_LABELS[eId.trim()] ?? eId.trim();
}

/**
 * カンマ区切りのE-ID文字列（例: "E-03, E-07"）をラベル配列に変換する
 * "—" または空文字は空配列を返す
 */
export function translateEIds(eIdStr: string): string[] {
  if (!eIdStr || eIdStr === '—') return [];
  return eIdStr
    .split(',')
    .map(s => translateEId(s.trim()))
    .filter(Boolean);
}
