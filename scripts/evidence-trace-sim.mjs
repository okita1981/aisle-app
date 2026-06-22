/**
 * Evidence Trace シミュレーター（Ver3 — Aisle実Evidenceで P-ID 効き分け確認）
 * 実行: node scripts/evidence-trace-sim.mjs
 */

// ─── ロジック（design.ts / page-generate.ts と同一定義） ─────────────────────

const TYPE_BASE_SCORE = {
  case: 4, client: 3, credential: 3, media: 3,
  metric: 2, comparison: 2, method: 2,
  feature: 1, availability: 1, review: 1, other: 0,
};

const P_ID_EVIDENCE_WEIGHT = {
  'P-01': { case: 3, client: 3, metric: 2, method: 1 },
  'P-02': { comparison: 3, feature: 2, metric: 2, method: 1 },
  'P-03': { case: 3, client: 3, media: 3, credential: 2 },
  'P-04': { case: 3, method: 3, client: 2, metric: 2 },
  'P-05': { credential: 3, media: 3, metric: 2, client: 2 },
  'P-06': { media: 2, credential: 2, case: 2, client: 2 },
};

const HINT_KEYWORD_TO_TYPE = [
  [/実績|事例|案件|プロジェクト|制作/, 'case'],
  [/クライアント|顧客|取引先|企業名|社名/, 'client'],
  [/数値|本数|件数|率|点数|売上|利用者|導入数/, 'metric'],
  [/受賞|認定|資格|アワード|表彰|特許/, 'credential'],
  [/口コミ|レビュー|評価|評判|声/, 'review'],
  [/メディア|掲載|記事|紹介|取材/, 'media'],
  [/機能|特徴|強み|できること|成分|仕様/, 'feature'],
  [/手法|方法|アプローチ|フロー|プロセス/, 'method'],
  [/対応|地域|業界|時間|価格|料金/, 'availability'],
  [/比較|違い|差別化|優位/, 'comparison'],
];

function buildHintTypeMap(hints) {
  const map = {};
  for (const hint of hints) {
    for (const [re, type] of HINT_KEYWORD_TO_TYPE) {
      if (re.test(hint)) { map[type] = (map[type] ?? 0) + 2; break; }
    }
  }
  return map;
}

function selectRelevantEvidence(items, axes, max = 8, context = {}) {
  const keySet = new Set([
    ...axes.keyTerms.map(t => t.toLowerCase()),
    ...axes.primaryAxes.map(a => a.toLowerCase()),
  ]);
  const hintTypeMap  = buildHintTypeMap(axes.evidenceHints ?? []);
  const basePId      = context.pId?.split('-').slice(0, 2).join('-') ?? '';
  const pIdWeightMap = P_ID_EVIDENCE_WEIGHT[basePId] ?? {};

  return items.map(item => {
    const tagHits      = item.tags.filter(t => keySet.has(t.toLowerCase())).length;
    const titleHit     = axes.keyTerms.some(t => item.title.toLowerCase().includes(t.toLowerCase())) ? 1 : 0;
    const roleHit      = axes.keyTerms.some(t => item.entityRole.toLowerCase().includes(t.toLowerCase())) ? 1 : 0;
    const typePriority = hintTypeMap[item.type] ?? 0;
    const typeBase     = TYPE_BASE_SCORE[item.type] ?? 0;
    const pIdWeight    = pIdWeightMap[item.type] ?? 0;
    const totalScore   = tagHits + titleHit + roleHit + typePriority + typeBase + pIdWeight;
    return { item, score: totalScore, tagHits, titleHit, roleHit, typePriority, typeBase, pIdWeight };
  }).sort((a, b) => b.score - a.score);
}

// ─── 出力ヘルパー ────────────────────────────────────────────────────────────

function printTrace(label, pId, promptText, evidence, axes) {
  const all = selectRelevantEvidence(evidence, axes, 8, { pId, promptText });
  const sel = all.slice(0, 8);

  console.log('\n' + '═'.repeat(76));
  console.log(`📌 ${label}`);
  console.log(`   P-ID      : ${pId}`);
  console.log(`   問い      : ${promptText}`);
  console.log(`   keyTerms  : [${axes.keyTerms.join(', ')}]`);
  console.log(`   hints     : [${(axes.evidenceHints ?? []).join(', ')}]`);
  console.log(`   P-IDウェイト: ${JSON.stringify(P_ID_EVIDENCE_WEIGHT[pId] ?? {})}`);
  console.log('─'.repeat(76));
  console.log('  # | 採用 | type         | title                              | base | pIdW | tags | total');
  console.log('─'.repeat(76));

  all.forEach((s, i) => {
    const mark  = i < 8 ? '✅ SEL' : '❌ REJ';
    const type  = s.item.type.padEnd(13);
    const title = s.item.title.slice(0, 34).padEnd(34);
    console.log(
      `  ${String(i+1).padStart(2)} | ${mark} | ${type} | ${title} | ${String(s.typeBase).padStart(4)} | ${String(s.pIdWeight).padStart(4)} | ${String(s.tagHits).padStart(4)} | ${s.score}`
    );
  });

  // type別集計
  const typeSummary = {};
  sel.forEach(s => { typeSummary[s.item.type] = (typeSummary[s.item.type] ?? 0) + 1; });
  const summaryStr = Object.entries(typeSummary).map(([t, n]) => `${t}×${n}`).join(', ');
  console.log(`\n  → SELECTED type構成: [${summaryStr}]`);
  sel.forEach((s, i) => console.log(`     [${i+1}] [${s.item.type.padEnd(10)}] ${s.item.title}`));
}

// ─── Aisle 実 Evidence（seed済み15件）──────────────────────────────────────

const AISLE_EVIDENCE = [
  // case (3件)
  {
    type: 'case', title: 'Aisle自社 Phase0〜4 パイロット実装',
    description: 'Aisle自身がPhase0〜4を通して自社の出現設計を設計・実装した自社実装例。',
    entityRole: '自社実装例', value: null,
    tags: ['自社実装例', 'Phase0-4', '問い別ページ', 'パイロット'],
  },
  {
    type: 'case', title: 'RefBase 公開Reference例（recommendation-001）',
    description: 'refbase.ai/reference/aisle/recommendation-001として公開済みのAI参照向け構造化知識ページ。',
    entityRole: '公開Reference例', value: null,
    tags: ['公開Reference例', 'JSON-LD', 'FAQPage', 'RefBase'],
  },
  {
    type: 'case', title: 'Aisle → RefBase 保存・取得ループ（本番稼働）',
    description: 'saveToRefBase()を経由してRefBase KVに自動保存・公開されるループが本番環境で稼働。',
    entityRole: '本番稼働実装例', value: null,
    tags: ['本番稼働', '自動保存', 'KVループ', 'RefBase', 'saveToRefBase'],
  },
  // method (4件)
  {
    type: 'method', title: '出現設計5フェーズ（Phase0〜4）プロセス',
    description: 'Phase0〜4の体系的プロセス。各フェーズがAPIとして実装済み。',
    entityRole: '設計・実装プロセス', value: null,
    tags: ['P-ID分類', 'K-ID診断', 'M-ID設計', '5フェーズ', '出現設計'],
  },
  {
    type: 'method', title: 'Evidence収集・スコアリングによる選択手法',
    description: '10タイプのEvidenceをTYPE_BASE_SCOREとP-IDウェイトにより問い別に最適選択する独自手法。',
    entityRole: 'Evidence選択手法', value: null,
    tags: ['Evidence収集', 'P-IDウェイト', '自動選択', 'スコアリング'],
  },
  {
    type: 'method', title: '評価軸抽出（evaluationAxes）による問い分析',
    description: '問いとプロダクトカテゴリから評価軸・関連語彙・期待回答形式を自動抽出。',
    entityRole: '問い分析手法', value: null,
    tags: ['評価軸抽出', '問い分析', 'keyTerms', 'primaryAxes'],
  },
  {
    type: 'method', title: '問い別ページ自動生成パイプライン',
    description: 'P-IDに応じた回答構造をClaudeが生成し、JSON-LD付きHTMLとしてVercel KVへ自動保存・公開。',
    entityRole: 'ページ生成パイプライン', value: null,
    tags: ['自動生成', 'Claude API', 'JSON-LD', 'パイプライン', '問い別ページ'],
  },
  // feature (6件)
  {
    type: 'feature', title: 'RefBase — AI参照知識基盤（refbase.ai）',
    description: '企業の問い別回答・Evidence・FAQをAIが取得しやすい構造化ページとして公開。',
    entityRole: 'AI参照知識基盤', value: null,
    tags: ['RefBase', 'AI参照', '知識基盤', 'Entity', 'Reference', 'llms.txt'],
  },
  {
    type: 'feature', title: 'RefBase Reference ページ構造（5セクション + JSON-LD）',
    description: 'answer/evidencePoints/scope/differentiation/faqの5セクション構成。FAQPage JSON-LD付き。',
    entityRole: 'AI引用最適化構造', value: null,
    tags: ['5セクション', 'FAQPage JSON-LD', 'AI引用', 'Reference構造'],
  },
  {
    type: 'feature', title: 'AI向けEntityページ（refbase.ai/entity/{id}）',
    description: '企業単位のEntityハブページ。全Referenceへのリンク・JSON API対応。',
    entityRole: 'EntityハブページMT', value: null,
    tags: ['Entityページ', '全Reference一覧', 'JSON API', 'ハブ'],
  },
  {
    type: 'feature', title: 'llms.txt — AI向けコンテンツインデックス（2箇所公開）',
    description: 'app.aisle-aio.ai/llms.txtとrefbase.ai/llms.txtの両方で公開済み。',
    entityRole: 'AIクローラー対応', value: null,
    tags: ['llms.txt', 'AIクローラー', '2箇所公開', 'インデックス'],
  },
  {
    type: 'feature', title: 'P-ID × K-ID × M-ID 設計フレームワーク',
    description: '問いの型（P-ID: 6種）× 阻害要因（K-ID: 10種）× 意味接点（M-ID: 13種）の3軸構造。',
    entityRole: '独自設計フレームワーク', value: null,
    tags: ['P-ID 6種', 'K-ID 10種', 'M-ID 13種', '3軸構造', 'フレームワーク'],
  },
  {
    type: 'feature', title: 'ChatGPT / Claude / Gemini / Perplexity 横断出現設計',
    description: '4エンジン横断対応。各エンジンのRAG・引用・回答生成の違いを踏まえた出現設計。',
    entityRole: '4エンジン対応', value: null,
    tags: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', '4エンジン', '横断対応'],
  },
  // comparison (2件)
  {
    type: 'comparison', title: 'SEO vs AI出現設計 — 設計対象の構造的違い',
    description: 'SEOが人間の検索行動に最適化するのに対し、AI出現設計はAIの生成プロセスに最適化。',
    entityRole: 'SEO比較・差別化軸', value: null,
    tags: ['SEO比較', 'AI生成プロセス', '設計対象の違い', '差別化'],
  },
  {
    type: 'comparison', title: 'コンサル提案書型 vs 設計・実装一体型インフラ',
    description: '従来コンサルは提案書納品で終わるのに対し、Aisleは設計結果を公開ページとして実装。',
    entityRole: 'インフラ型の差別化', value: null,
    tags: ['インフラ型', '設計実装一体', '公開物あり', 'コンサル比較'],
  },
];

// ─── P-ID別 評価軸（design.tsのevaluationAxes相当） ─────────────────────────

const AXES = {
  'P-01': {
    primaryAxes: ['相談先', 'AI出現設計', '生成AI', '推薦'],
    keyTerms: ['AI', '相談', '出現', '相談先', 'どこ'],
    evidenceHints: ['実績', '手法', '相談先としての信頼性'],
  },
  'P-02': {
    primaryAxes: ['比較', '違い', 'SEO', 'AI出現', '差別化'],
    keyTerms: ['比較', 'SEO', '違い', '差別化', 'AI出現'],
    evidenceHints: ['比較', '違い', '差別化', '機能の違い'],
  },
  'P-04': {
    primaryAxes: ['課題解決', '出現しない', '方法', '手順', 'アプローチ'],
    keyTerms: ['出現しない', '解決', '方法', 'どうすれば', '改善'],
    evidenceHints: ['手法', '方法', '実績', 'プロセス'],
  },
  'P-05': {
    primaryAxes: ['出典', '根拠', '引用', '情報源', '信頼性'],
    keyTerms: ['出典', '根拠', '引用', '情報', 'メディア'],
    evidenceHints: ['受賞', 'メディア掲載', '数値', '認定'],
  },
  'P-06': {
    primaryAxes: ['推薦理由', 'なぜ', '根拠', '背景', '選ばれる理由'],
    keyTerms: ['推薦', 'なぜ', '理由', '根拠', '選ばれる'],
    evidenceHints: ['メディア', '実績', '差別化', '根拠'],
  },
};

const PROMPTS = {
  'P-01': 'AIの回答に自社を出したい場合はどこに相談すればいいですか？',
  'P-02': 'AI出現設計とSEOは何が違うのですか？',
  'P-04': '自社がAIの回答に出現しない場合、どのように解決すればよいですか？',
  'P-05': 'AI出現設計に関する情報の出典を教えてください',
  'P-06': 'AisleがAI出現設計として推薦される理由を詳しく教えてください',
};

// ─── 実行 ────────────────────────────────────────────────────────────────────

console.log('\n■■■ Aisle Evidence × P-ID 効き分け確認（Ver3 / 実15件）■■■');
console.log('列: base=TYPE_BASE_SCORE, pIdW=P-IDウェイト, tags=タグヒット数, total=合計スコア\n');

for (const pId of ['P-01', 'P-02', 'P-04', 'P-05', 'P-06']) {
  printTrace(
    `Aisle — ${pId}「${PROMPTS[pId]}」`,
    pId, PROMPTS[pId],
    AISLE_EVIDENCE, AXES[pId],
  );
}

// ─── type別 不足分析 ─────────────────────────────────────────────────────────

console.log('\n\n' + '═'.repeat(76));
console.log('📊 P-ID別 Evidence不足分析');
console.log('─'.repeat(76));

const IDEAL_TYPES = {
  'P-01': ['case', 'client', 'metric', 'method'],
  'P-02': ['comparison', 'feature', 'metric', 'method'],
  'P-04': ['case', 'method', 'client', 'metric'],
  'P-05': ['credential', 'media', 'metric', 'client'],
  'P-06': ['media', 'credential', 'case', 'client'],
};

const typeCount = {};
for (const e of AISLE_EVIDENCE) typeCount[e.type] = (typeCount[e.type] ?? 0) + 1;

for (const pId of ['P-01', 'P-02', 'P-04', 'P-05', 'P-06']) {
  const ideal = IDEAL_TYPES[pId];
  console.log(`\n  ${pId}（ウェイト上位型: [${ideal.join(', ')}]）`);
  for (const t of ideal) {
    const n = typeCount[t] ?? 0;
    const flag = n === 0 ? '❌ 0件（不足）' : n === 1 ? '⚠️  1件（薄い）' : `✅ ${n}件`;
    console.log(`    ${t.padEnd(12)} → ${flag}`);
  }
}
console.log('');
