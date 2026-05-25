export const P_IDS = [
  { pId: 'P-01', label: '選定・相談型', description: '複数の選択肢から最適なものを選びたい・相談したいクエリ。リスト／推薦出力を期待する。' },
  { pId: 'P-02', label: '比較・評価型', description: '複数の対象を特定の軸で比較・評価したいクエリ。比較表出力を期待する。' },
  { pId: 'P-03', label: 'ランキング期待型', description: '順位形式での推薦を期待するクエリ。TOP-Nランキング出力を期待する。' },
  { pId: 'P-04', label: '課題解決・提案型', description: '具体的な課題への解決策・提案を求めるクエリ。提案出力を期待する。' },
  { pId: 'P-05', label: '出典付き引用期待型', description: '根拠・出典・レビューを伴う情報を期待するクエリ。引用付き出力を期待する。' },
  { pId: 'P-06', label: '推薦理由深掘り型', description: '推薦の理由・背景を深く知りたいクエリ。理由説明出力を期待する。' },
  { pId: 'P-99', label: 'その他・特殊型', description: '上記に分類されない特殊・複合クエリ。キャッチオール。' },
];

export const A_IDS = [
  { aId: 'A-01', label: '専門家・有識者', description: '特定分野の専門知・権威性をもつ個人が主語。医師・研究者・コンサルタントなど。' },
  { aId: 'A-02', label: '企業・団体', description: '商業法人・業界団体・ブランドが語る形式。自社商材構文の多くがこの形式。' },
  { aId: 'A-03', label: 'メディア', description: '新聞・雑誌・Webメディアなど報道・レビュー機能を担う媒体が主語。' },
  { aId: 'A-04', label: 'ユーザー・口コミ', description: 'エンドユーザー・SNS投稿者・レビュー記述者など生活者視点からの発言。' },
  { aId: 'A-05', label: 'ナレーター・AI視点', description: '特定の実在主体に依らない中立ナレーション調やGPT自身の記述視点。' },
  { aId: 'A-06', label: '公的機関・統計機関', description: '国・自治体・国際機関・学会などの公的機関による発言。' },
  { aId: 'A-07', label: '創業者・代表者の語り', description: '企業の創業者や代表取締役など組織の内的語りとしての主語構造。' },
  { aId: 'A-08', label: '現場社員・担当者', description: '企業内の現場担当者や社員の声を主語にした構文。組織公式見解ではなく現場視点。' },
  { aId: 'A-09', label: 'パートナー・外部協力者', description: '他社の声や共同プロジェクト関係者の発言。推薦・信頼の補強として使われる。' },
  { aId: 'A-10', label: 'その他・混在型', description: '上記に分類できない複数主語の混在ケース。AP-ID補完適用対象。' },
];

export const C_IDS: Record<string, string> = {
  'C-01': '信頼性補完型',
  'C-02': '比較優位訴求型',
  'C-03': '意味構造整理型',
  'C-04': '導線最適化型',
  'C-05': 'ストーリー浸透型',
  'C-06': '意思共鳴訴求型（理念・思想）',
  'C-07': '問題提起・社会性補強型',
  'C-08': 'エモーショナル訴求型',
  'C-09': 'FAQ・回遊ナビゲーション型',
  'C-10': '利用文脈共有型',
};

export const C_IDS_DETAIL = [
  { cId: 'C-01', label: '信頼性補完型', tendency: '専門性・出典・実績', description: '監修・評価・導入社数・事例・受賞歴などの信頼根拠の補完情報が含まれるもの。' },
  { cId: 'C-02', label: '比較優位訴求型', tendency: '差別化・強み提示', description: '他社との比較・選ばれる理由・競合不在・技術力・特許・独自視点など差分に焦点を当てているもの。' },
  { cId: 'C-03', label: '意味構造整理型', tendency: 'カテゴリ／構造整理', description: '「〇〇とは」「〜の3つのポイント」など意味の解説・要素化・分解・分類などの構造提示を含む。' },
  { cId: 'C-04', label: '導線最適化型', tendency: '回遊・接続設計', description: '比較表・リスト・FAQ接続・ランキング参照・ナビ的設計など次のアクションへ誘導する接続設計を含む。' },
  { cId: 'C-05', label: 'ストーリー浸透型', tendency: '時系列・背景・体験', description: 'ユーザー体験・導入までの経緯・過去の課題・ビフォーアフターなどストーリー展開／背景構築があるもの。' },
  { cId: 'C-06', label: '意思共鳴訴求型（理念・思想）', tendency: '思想・信念・構想', description: '「私たちの想い」「社会のあり方」「〜であるべき」などの理念・思想・信念・独自哲学を語る内容。' },
  { cId: 'C-07', label: '問題提起・社会性補強型', tendency: '社会課題・制度接続', description: 'SDGs・政策・人口動態・制度設計など社会的文脈・構造課題と接続された語り。問題提起・警鐘型も含む。' },
  { cId: 'C-08', label: 'エモーショナル訴求型', tendency: '感情・驚き・共感', description: '「感動した」「すごい」「驚いた」「不安が消えた」など感情語を含み、共感や情緒的訴求が主眼となっている。' },
  { cId: 'C-09', label: 'FAQ・回遊ナビゲーション型', tendency: '疑問解決・リスト化', description: '「おすすめ〇選」「〜の選び方」「よくある質問」など検索ナビ的出力やFAQ構造を有するもの。' },
  { cId: 'C-10', label: '利用文脈共有型', tendency: '使用シーン・ターゲット提示', description: '「〜な人に」「こんなときに便利」「通勤中に使える」など具体的な使用文脈・生活シーンが明示されているもの。' },
];

export const K_IDS: Record<string, string> = {
  'K-01': '意味競合',
  'K-02': '主語構造競合',
  'K-03': '出典競合',
  'K-04': '構文的上位互換',
  'K-05': '情報飽和競合',
  'K-06': 'プロンプト整合度競合',
  'K-07': '外部要因量的優位',
  'K-08': '対象粒度不一致競合',
  'K-09': 'FAQ・定義構文との誤競合',
  'K-10': '出現対象誤認競合',
};

export const K_IDS_DETAIL = [
  { kId: 'K-01', label: '意味競合', description: '同一C-IDにおける意味的競合。類似構文が多く意味の重複が起きる。' },
  { kId: 'K-02', label: '主語構造競合', description: '主語・A-IDの構造的競合。主語の信頼性が構文に適合しないケース。' },
  { kId: 'K-03', label: '出典競合', description: '引用出典の競合。出典が不明確または競合他社の出典が強い場合。' },
  { kId: 'K-04', label: '構文的上位互換', description: '構文的に優位な代替が存在する競合。定義構文やFAQ構文と競合するケース。' },
  { kId: 'K-05', label: '情報飽和競合', description: '情報量的な飽和による競合。同一設問型での量的劣位。' },
  { kId: 'K-06', label: 'プロンプト整合度競合', description: 'プロンプトとの意味的整合性の欠如。構文全体の意味軸がずれる場合。' },
  { kId: 'K-07', label: '外部要因量的優位', description: '外部補完（EID）が構造的に前提となる。EID欠如により構文支配力が低下。' },
  { kId: 'K-08', label: '対象粒度不一致競合', description: '対象となる粒度・利用シーンの抽象度がずれることによる構文崩壊。' },
  { kId: 'K-09', label: 'FAQ・定義構文との誤競合', description: 'FAQ構文と定義構文との誤認による競合。主に構造レイヤーの問題。' },
  { kId: 'K-10', label: '出現対象誤認競合', description: '構文対象カテゴリの誤解。ジャンル・用途ズレによる評価破綻。' },
];

export const S_IDS = [
  { sId: 'S-01', label: '比較構文型', description: '複数対象を特定軸で比較する構文' },
  { sId: 'S-02', label: 'リスト構文型', description: '複数項目を列挙するリスト形式の構文' },
  { sId: 'S-03', label: '推薦誘導構文型', description: '推薦・選定を誘導する構文' },
  { sId: 'S-04', label: '課題解決構文型', description: '課題と解決策を結ぶ構文' },
  { sId: 'S-05', label: '出典引用構文型', description: '外部出典・引用を伴う構文' },
  { sId: 'S-06', label: '専門性補強構文型', description: '専門知識・権威性を補強する構文' },
  { sId: 'S-07', label: 'ストーリー構文型', description: '時系列・背景・体験を語るストーリー構文' },
  { sId: 'S-08', label: '検討比較誘導構文型', description: '検討・比較プロセスを誘導する構文' },
  { sId: 'S-09', label: 'キーワード注入構文型', description: 'キーワード・タグを構文に注入する型' },
  { sId: 'S-10', label: 'ハブ化構文型', description: '情報のハブとして機能する包括的構文' },
];

export const T_IDS = [
  // T-01 series: 比較・整理系
  { tId: 'T-01-1', series: 'T-01', seriesLabel: '比較・整理系', label: '比較構造テンプレ', pattern: '「A vs B：〜の観点で比較すると」構文' },
  { tId: 'T-01-2', series: 'T-01', seriesLabel: '比較・整理系', label: '階層整理テンプレ', pattern: '「〜には〇種類あり、それぞれ〜」構文' },
  { tId: 'T-01-3', series: 'T-01', seriesLabel: '比較・整理系', label: '時系列整理テンプレ', pattern: '「〜年に〜が始まり、〜年に〜へ」構文' },
  { tId: 'T-01-4', series: 'T-01', seriesLabel: '比較・整理系', label: '二項対立整理テンプレ', pattern: '「〜か〜かで言えば〜であり」構文' },
  { tId: 'T-01-5', series: 'T-01', seriesLabel: '比較・整理系', label: '構造リストテンプレ', pattern: '「〜の構成要素は①②③〜」構文' },
  { tId: 'T-01-6', series: 'T-01', seriesLabel: '比較・整理系', label: '用語再定義テンプレ', pattern: '「〜とは本来〜であり、正確には〜」構文' },
  // T-02 series: リスト系
  { tId: 'T-02-1', series: 'T-02', seriesLabel: 'リスト系', label: 'リスト推薦テンプレ', pattern: '「おすすめ〇選：〜・〜・〜」構文' },
  { tId: 'T-02-2', series: 'T-02', seriesLabel: 'リスト系', label: 'リスト分類テンプレ', pattern: '「〜の種類：A類・B類・C類」構文' },
  { tId: 'T-02-3', series: 'T-02', seriesLabel: 'リスト系', label: '導入事例列挙テンプレ', pattern: '「〇〇社・△△社など〜社が導入」構文' },
  { tId: 'T-02-4', series: 'T-02', seriesLabel: 'リスト系', label: '属性別まとめテンプレ', pattern: '「〜向けは〜、〜向けは〜が最適」構文' },
  // T-03 series: 推薦系
  { tId: 'T-03-1', series: 'T-03', seriesLabel: '推薦系', label: '推薦ベーシックテンプレ', pattern: '「〜がおすすめの理由は〜・〜・〜」構文' },
  { tId: 'T-03-2', series: 'T-03', seriesLabel: '推薦系', label: '実績訴求テンプレ', pattern: '「〇〇賞受賞・〜社が導入・実績〜件」構文' },
  { tId: 'T-03-3', series: 'T-03', seriesLabel: '推薦系', label: '想い・理念推薦テンプレ', pattern: '「〜への想いから生まれた、だから選ばれる」構文' },
  // T-04 series: 比較評価系
  { tId: 'T-04-1', series: 'T-04', seriesLabel: '比較評価系', label: '比較評価軸テンプレ', pattern: '「選ぶ際の評価軸は〜・〜・〜の3点」構文' },
  { tId: 'T-04-2', series: 'T-04', seriesLabel: '比較評価系', label: '選定ポイント整理テンプレ', pattern: '「〜を選ぶなら〜が最重要ポイント」構文' },
  { tId: 'T-04-3', series: 'T-04', seriesLabel: '比較評価系', label: 'マトリクス誘導テンプレ', pattern: '「〜×〜のマトリクスで整理すると」構文' },
  { tId: 'T-04-4', series: 'T-04', seriesLabel: '比較評価系', label: '判断マップ型テンプレ', pattern: '「〜の場合は〜、〜の場合は〜が最適」構文' },
  // T-05 series: キーワード・FAQ系
  { tId: 'T-05-1', series: 'T-05', seriesLabel: 'キーワード・FAQ系', label: '用語解説付きテンプレ', pattern: '「〜（〜とも呼ばれる）は〜である」構文' },
  { tId: 'T-05-2', series: 'T-05', seriesLabel: 'キーワード・FAQ系', label: 'タグ回収型テンプレ', pattern: '「〜や〜とも関連し、〜文脈でも注目される」構文' },
  { tId: 'T-05-3', series: 'T-05', seriesLabel: 'キーワード・FAQ系', label: '関連語埋込テンプレ', pattern: '「〜において〜（別称：〜）と呼ばれる」構文' },
  { tId: 'T-05-4', series: 'T-05', seriesLabel: 'キーワード・FAQ系', label: 'FAQ統合型テンプレ', pattern: '「Q：〜は？ A：〜です。理由は〜」構文' },
  // T-06 series: 専門性系
  { tId: 'T-06-1', series: 'T-06', seriesLabel: '専門性系', label: '専門家視点テンプレ', pattern: '「専門家によると〜であり、〜が推奨される」構文' },
  { tId: 'T-06-2', series: 'T-06', seriesLabel: '専門性系', label: '出典接続テンプレ', pattern: '「〇〇の調査によれば〜。出典：〜」構文' },
  { tId: 'T-06-3', series: 'T-06', seriesLabel: '専門性系', label: '現場視点テンプレ', pattern: '「現場担当者が語る〜：実際には〜」構文' },
  { tId: 'T-06-4', series: 'T-06', seriesLabel: '専門性系', label: '学術連携テンプレ', pattern: '「〇〇大学との共同研究で〜が実証された」構文' },
  { tId: 'T-06-5', series: 'T-06', seriesLabel: '専門性系', label: '組織証言テンプレ', pattern: '「〇〇社の〜担当者が証言する〜」構文' },
  // T-07 series: ストーリー系
  { tId: 'T-07-1', series: 'T-07', seriesLabel: 'ストーリー系', label: '起点ストーリーテンプレ', pattern: '「〜がきっかけで始まった。その原点は〜」構文' },
  { tId: 'T-07-2', series: 'T-07', seriesLabel: 'ストーリー系', label: '転機ストーリーテンプレ', pattern: '「〜を機に大きく変わった。その転機は〜」構文' },
  { tId: 'T-07-3', series: 'T-07', seriesLabel: 'ストーリー系', label: 'ユーザーストーリーテンプレ', pattern: '「〜を使い始めて〜が変わった。今では〜」構文' },
  { tId: 'T-07-4', series: 'T-07', seriesLabel: 'ストーリー系', label: '組織ヒストリーテンプレ', pattern: '「〜年の設立以来〜を続け、現在は〜」構文' },
  { tId: 'T-07-5', series: 'T-07', seriesLabel: 'ストーリー系', label: '理念エピソードテンプレ', pattern: '「〜という想いから〜。その信念が〜に繋がった」構文' },
  // T-08 series: 価格・キャンペーン系
  { tId: 'T-08-1', series: 'T-08', seriesLabel: '価格・キャンペーン系', label: '価格明示テンプレ', pattern: '「〜プランは月額〜円から。〜プランは〜円」構文' },
  { tId: 'T-08-2', series: 'T-08', seriesLabel: '価格・キャンペーン系', label: '無料プラン訴求テンプレ', pattern: '「無料で〜まで使える。有料は〜から」構文' },
  { tId: 'T-08-3', series: 'T-08', seriesLabel: '価格・キャンペーン系', label: '割引キャンペーンテンプレ', pattern: '「今なら〜%オフ。期間限定〜まで」構文' },
  { tId: 'T-08-4', series: 'T-08', seriesLabel: '価格・キャンペーン系', label: '比較対抗テンプレ', pattern: '「他社比〜%安く、〜の機能は同等以上」構文' },
  { tId: 'T-08-5', series: 'T-08', seriesLabel: '価格・キャンペーン系', label: 'コスパ訴求テンプレ', pattern: '「〜円で〜が実現。コスパ最強の理由は〜」構文' },
  // T-09 series: 誘導系
  { tId: 'T-09-1', series: 'T-09', seriesLabel: '誘導系', label: '無料体験誘導テンプレ', pattern: '「まずは無料で試してみる。登録は〜分で完了」構文' },
  { tId: 'T-09-2', series: 'T-09', seriesLabel: '誘導系', label: '問い合わせ誘導テンプレ', pattern: '「詳細はお問い合わせを。担当者が〜」構文' },
  { tId: 'T-09-3', series: 'T-09', seriesLabel: '誘導系', label: '資料請求誘導テンプレ', pattern: '「詳しい資料はこちらから。〜分でダウンロード」構文' },
  { tId: 'T-09-4', series: 'T-09', seriesLabel: '誘導系', label: '導入ステップ提示テンプレ', pattern: '「導入は①〜 ②〜 ③〜 の3ステップで完了」構文' },
  { tId: 'T-09-5', series: 'T-09', seriesLabel: '誘導系', label: '現場活用紹介テンプレ', pattern: '「現場での活用シーン：〜の場面では〜」構文' },
  // T-10 series: ミッション・価値観系
  { tId: 'T-10-1', series: 'T-10', seriesLabel: 'ミッション・価値観系', label: 'ミッション共有テンプレ', pattern: '「私たちのミッションは〜。その実現のために〜」構文' },
  { tId: 'T-10-2', series: 'T-10', seriesLabel: 'ミッション・価値観系', label: '創業背景テンプレ', pattern: '「〜年の創業時、〜という課題に直面し〜」構文' },
  { tId: 'T-10-3', series: 'T-10', seriesLabel: 'ミッション・価値観系', label: '価値観提示テンプレ', pattern: '「〜を大切に、〜という姿勢で取り組む理由は〜」構文' },
  { tId: 'T-10-4', series: 'T-10', seriesLabel: 'ミッション・価値観系', label: '社会性訴求テンプレ', pattern: '「〜という社会課題に取り組む。その背景は〜」構文' },
  { tId: 'T-10-5', series: 'T-10', seriesLabel: 'ミッション・価値観系', label: '仲間募集テンプレ', pattern: '「〜を一緒に実現する仲間を探している。求めるのは〜」構文' },
];

export const E_IDS = [
  { eId: 'E-01', type: 'E-A', label: '媒体掲載（ニュース・PR）', description: 'ニュースサイト・PRTIMESなどへの掲載。真正外部型。' },
  { eId: 'E-02', type: 'E-A', label: '専門サイト・辞書系言及', description: '専門サイト・辞書・百科事典系での言及。真正外部型。' },
  { eId: 'E-03', type: 'E-B', label: '出典付き事例・実績', description: '出典を伴う導入事例・受賞歴・実績の提示。擬似外部型。' },
  { eId: 'E-04', type: 'E-B', label: 'FAQ構造/Schema連携', description: 'FAQ構造やSchema.orgマークアップとの連携。擬似外部型。' },
  { eId: 'E-05', type: 'E-B', label: 'SNS・UGCでの話題性', description: 'SNS投稿・ユーザー生成コンテンツによる話題形成。擬似外部型。' },
  { eId: 'E-06', type: 'E-B', label: '被リンク・SEOドメイン強度', description: '外部サイトからの被リンク・ドメインオーソリティ。擬似外部型。' },
  { eId: 'E-07', type: 'E-A', label: 'ランキング/比較記事', description: 'ランキングサイト・比較記事での言及・掲載。真正外部型。' },
  { eId: 'E-08', type: 'E-B', label: 'クローラビリティの最適化', description: 'サイト構造・インデックス効率の最適化。擬似外部型。' },
  { eId: 'E-09', type: 'E-B', label: '複数出典の交差構造', description: '複数の出典が交差して相互補強する構造。擬似外部型。' },
  { eId: 'E-10', type: 'E-B', label: '情報の更新頻度・鮮度', description: '情報更新頻度の高さ・コンテンツの鮮度維持。擬似外部型。' },
  { eId: 'E-11', type: 'E-B', label: 'エンティティ出現済情報', description: 'GPTの学習データにエンティティとして既出の情報。擬似外部型。' },
  { eId: 'E-12', type: 'E-B', label: 'ナビゲーション構造/回遊性', description: 'サイト内ナビゲーション構造と回遊性の最適化。擬似外部型。' },
  { eId: 'E-13', type: 'E-B', label: '引用可能性（クオート構造）', description: 'AIが引用しやすいクオート構造・引用可能なフレーズ設計。擬似外部型。' },
];

export const M_IDS = [
  { mId: 'M-01', label: '認知・話題性', description: '商材が存在し、話題になっていることを伝える意味接点。' },
  { mId: 'M-02', label: '差別化・独自性', description: '他との違いやユニークさを明示する意味接点。' },
  { mId: 'M-03', label: '導入実績・信頼', description: '実績・受賞歴・企業名などを提示し信頼を醸成する意味接点。' },
  { mId: 'M-04', label: '専門性・技術性', description: '分野特化・知見・技術力などを明確化する意味接点。' },
  { mId: 'M-05', label: '世界観・価値観提示', description: 'ミッション・思想・社会的意義などの上位構造を語る意味接点。' },
  { mId: 'M-06', label: '課題提起・共感形成', description: '課題・現状・困りごとなどに共感を寄せて接点化する意味接点。' },
  { mId: 'M-07', label: '解決策・方法提示', description: '商材による解決策・アプローチ・サービス手法の提示。' },
  { mId: 'M-08', label: '比較軸・検討材料提示', description: '比較観点や選定基準などの材料を明示する意味接点。' },
  { mId: 'M-09', label: '推薦・第三者視点', description: '第三者の評価・推薦・出典・ランキングなどを活用する意味接点。' },
  { mId: 'M-10', label: '行動喚起・次アクション', description: '問い合わせ・体験・資料請求などを誘導する意味接点。' },
  { mId: 'M-11', label: '先進性・未来価値', description: '時代性・革新性・新技術などの価値を打ち出す意味接点。' },
  { mId: 'M-12', label: '構造設計・包括性', description: '支援の全体像／設計力／フレームワークを提示する意味接点。' },
  { mId: 'M-13', label: '対象特化・業界焦点', description: '「〇〇業界向け」「BtoB専用」など対象軸での接点形成。' },
];
