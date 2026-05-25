export function filterIds(text: string): string {
  if (!text) return text;

  // E-IDを括弧内の日本語名のみに変換
  // 例：E-03（出典付き事例・実績） → 出典付き事例・実績
  let result = text.replace(/E-\d+（([^）]+)）/g, '$1');

  // M-IDを日本語名に変換
  const mIdMap: Record<string, string> = {
    'M-01': '認知・話題性', 'M-02': '差別化・独自性',
    'M-03': '導入実績・信頼', 'M-04': '専門性・技術性',
    'M-05': '世界観・価値観提示', 'M-06': '課題提起・共感形成',
    'M-07': '解決策・方法提示', 'M-08': '比較軸・検討材料提示',
    'M-09': '推薦・第三者視点', 'M-10': '行動喚起・次アクション',
    'M-11': '先進性・未来価値', 'M-12': '構造設計・包括性',
    'M-13': '対象特化・業界焦点',
  };
  result = result.replace(/M-\d+/g, (match) => mIdMap[match] ?? match);

  // A-IDを日本語名に変換
  const aIdMap: Record<string, string> = {
    'A-01': '評価視点構文', 'A-02': '企業主語構文',
    'A-03': 'メディア主語構文', 'A-05': 'ナレーター構文',
    'A-10': '混在視点構文',
  };
  result = result.replace(/A-\d+/g, (match) => aIdMap[match] ?? match);

  // K-IDコードのみ削除（説明テキストは残す）
  result = result.replace(/K-\d+（[^）]+）/g, (match) => {
    return match.replace(/K-\d+/, '').replace(/（|）/g, '');
  });
  result = result.replace(/K-\d+/g, '');

  // T-IDコードを削除
  result = result.replace(/T-\d+-\d+/g, '');

  // AISLE-IDを削除
  result = result.replace(/AISLE-\d+-\d+-[A-Z]/g, '');

  // E-ID単体（括弧なし）を削除
  result = result.replace(/E-\d+/g, '');

  // 余分な記号・スペースを整理
  result = result.replace(/・・/g, '・').replace(/、、/g, '、').trim();

  return result;
}
