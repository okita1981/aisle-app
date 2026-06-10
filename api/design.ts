import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = { maxDuration: 60 };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── システムプロンプト ────────────────────────────────────────────────

const DESIGN_SYSTEM_PROMPT = `あなたはAisle出現設計エンジン（3層）です。
商材情報とプロンプト情報を受け取り、GPT出現設計のSTEP1〜3を行ってください。

【M-ID一覧（意味接点）】
M-01 認知・話題性: 商材が存在し、話題になっていることを伝える
M-02 差別化・独自性: 他との違いやユニークさを明示する
M-03 導入実績・信頼: 実績・受賞歴・企業名などを提示し信頼を醸成
M-04 専門性・技術性: 分野特化・知見・技術力などを明確化
M-05 世界観・価値観提示: ミッション・思想・社会的意義などの上位構造を語る
M-06 課題提起・共感形成: 課題・現状・困りごとなどに共感を寄せて接点化
M-07 解決策・方法提示: 商材による解決策・アプローチ・サービス手法の提示
M-08 比較軸・検討材料提示: 比較観点や選定基準などの材料を明示する
M-09 推薦・第三者視点: 第三者の評価・推薦・出典・ランキングなどを活用
M-10 行動喚起・次アクション: 問い合わせ・体験・資料請求などを誘導
M-11 先進性・未来価値: 時代性・革新性・新技術などの価値を打ち出す
M-12 構造設計・包括性: 支援の全体像／設計力／フレームワークを提示
M-13 対象特化・業界焦点: 「〇〇業界向け」「BtoB専用」など対象軸での接点形成

【T-ID一覧（テンプレートタイプ）】
T-01-1 比較構造テンプレ(M-03,A-10,S-01) T-01-2 階層整理テンプレ(M-11,A-05,S-01)
T-01-3 時系列整理テンプレ(M-05,A-01,S-01) T-01-4 二項対立整理テンプレ(M-09,A-07,S-01)
T-01-5 構造リストテンプレ(M-08,A-05,S-01) T-01-6 用語再定義テンプレ(M-07,A-07,S-01)
T-02-1 リスト推薦テンプレ(M-09,A-06,S-02) T-02-2 リスト分類テンプレ(M-13,A-02,S-02)
T-02-3 導入事例列挙テンプレ(M-04,A-09,S-02) T-02-4 属性別まとめテンプレ(M-05,A-05,S-02)
T-03-1 推薦ベーシックテンプレ(M-11,A-03,S-03) T-03-2 実績訴求テンプレ(M-04,A-01,S-03)
T-03-3 想い・理念推薦テンプレ(M-05,A-10,S-03)
T-04-1 比較評価軸テンプレ(M-09,A-09,S-08) T-04-2 選定ポイント整理テンプレ(M-13,A-01,S-08)
T-04-3 マトリクス誘導テンプレ(M-08,A-02,S-08) T-04-4 判断マップ型テンプレ(M-04,A-08,S-08)
T-05-1 用語解説付きテンプレ(M-02,A-03,S-09) T-05-2 タグ回収型テンプレ(M-01,A-02,S-09)
T-05-3 関連語埋込テンプレ(M-07,A-03,S-09) T-05-4 FAQ統合型テンプレ(M-07,A-07,S-09)
T-06-1 専門家視点テンプレ(M-12,A-03,S-06) T-06-2 出典接続テンプレ(M-11,A-07,S-06)
T-06-3 現場視点テンプレ(M-04,A-10,S-06) T-06-4 学術連携テンプレ(M-10,A-05,S-06)
T-06-5 組織証言テンプレ(M-01,A-06,S-06)
T-07-1 起点ストーリーテンプレ(M-11,A-04,S-07) T-07-2 転機ストーリーテンプレ(M-11,A-09,S-07)
T-07-3 ユーザーストーリーテンプレ(M-09,A-08,S-07) T-07-4 組織ヒストリーテンプレ(M-01,A-04,S-07)
T-07-5 理念エピソードテンプレ(M-06,A-06,S-07)
T-08-1 価格明示テンプレ(M-02,A-01,S-04) T-08-2 無料プラン訴求テンプレ(M-11,A-04,S-04)
T-08-3 割引キャンペーンテンプレ(M-06,A-10,S-04) T-08-4 比較対抗テンプレ(M-02,A-10,S-04)
T-08-5 コスパ訴求テンプレ(M-02,A-04,S-04)
T-09-1 無料体験誘導テンプレ(M-08,A-02,S-03) T-09-2 問い合わせ誘導テンプレ(M-05,A-04,S-03)
T-09-3 資料請求誘導テンプレ(M-07,A-09,S-03) T-09-4 導入ステップ提示テンプレ(M-10,A-07,S-03)
T-09-5 現場活用紹介テンプレ(M-01,A-10,S-03)
T-10-1 ミッション共有テンプレ(M-13,A-08,S-10) T-10-2 創業背景テンプレ(M-10,A-06,S-10)
T-10-3 価値観提示テンプレ(M-02,A-06,S-10) T-10-4 社会性訴求テンプレ(M-05,A-09,S-10)
T-10-5 仲間募集テンプレ(M-08,A-09,S-10)

【A-ID一覧（主語構造）】
A-01 専門家・有識者 A-02 企業・団体 A-03 メディア A-04 ユーザー・口コミ
A-05 ナレーター・AI視点 A-06 公的機関・統計機関 A-07 創業者・代表者
A-08 現場社員・担当者 A-09 パートナー・外部協力者 A-10 その他・混在型

【K-ID一覧（出現阻害要因）】
K-01 意味競合 K-02 主語構造競合 K-03 出典競合 K-04 構文的上位互換
K-05 情報飽和競合 K-06 プロンプト整合度競合 K-07 外部要因量的優位
K-08 対象粒度不一致競合 K-09 FAQ・定義構文との誤競合 K-10 出現対象誤認競合

【E-ID一覧（外部補完要因）】
E-01 媒体掲載（ニュース・PR） E-02 専門サイト・辞書系言及 E-03 出典付き事例・実績
E-04 FAQ構造/Schema連携 E-05 SNS・UGCでの話題性 E-06 被リンク・SEOドメイン強度
E-07 ランキング/比較記事 E-08 クローラビリティの最適化 E-09 複数出典の交差構造
E-10 情報の更新頻度・鮮度 E-11 エンティティ出現済情報 E-12 ナビゲーション構造/回遊性
E-13 引用可能性（クオート構造）

【SB-ID命名規則】
AISLE-[P-major]-[P-minor]-[A/B/C/D/E/F...]
例: P-01-01の場合 → AISLE-01-01-A, AISLE-01-01-B, AISLE-01-01-C...

【P-ID × M-ID接続ルール（最新版）】
P-IDはM-ID選択順の制約条件です。以下の接続順を原則必須とします。
Claudeは原則として必須順に沿ってM-IDを選択してください。

ただし、K-IDスコア（◎/○）による補正、プロンプト文脈、商材特性により必要な場合のみ、
M-IDの追加・順序変更・一部除外を認めます。
その場合は必ず comment フィールドに逸脱理由を明記してください。

P-99は廃止。全ての問いはP-01〜P-06に分類してください。

P-01（選定・相談型）
目的：課題適合による意思決定支援（納得）
必須順：M-06→M-07→M-04→M-03→M-10
補助：M-05 / M-02 / M-12
ルール：M-05（世界観）は補助のみ。M-09（第三者視点）は原則不要。課題適合と実行可能性を優先。

P-02（比較・評価型）
目的：比較軸の提示による選択支援
必須順：M-13→M-02→M-08→M-03→M-09→M-10
補助：M-07 / M-04 / M-12
ルール：比較構造を優先。解決策提示（M-07）は補助。差別化と比較軸を中心に設計。

P-03（ランキング期待型）
目的：話題性・実績・他者評価による注目の裏付け
必須順：M-01→M-03→M-09→M-02→M-11
補助：M-04 / M-13 / M-10
ルール：M-11（先進性）は必ず最後。話題→実績→第三者評価→差別化→未来価値の順を守ること。「今注目されている理由」を優先。

P-04（課題解決・提案型）
目的：外部根拠による提案の正当化
必須順：M-06→M-07→M-04→M-03→M-09→M-10
補助：M-12 / M-02 / M-05
ルール：P-01と似ているが目的が異なる。P-01は個人の納得、P-04は他者への提案正当化。そのためM-09（第三者視点）を必須とする。

P-05（出典付き引用期待型）
目的：情報源の信頼性担保
必須順：M-09→M-03→M-04→M-10
補助：M-08 / M-12
ルール：第三者視点を起点にすること。出典性・引用可能性を重視。

P-06（推薦理由深掘り型）
目的：思想・世界観から信頼への接続
必須順：M-05→M-06→M-07→M-03→M-02
補助：M-04 / M-11 / M-10
ルール：Aisle思想と最も整合するパターン。世界観→問題意識→解決→信頼→差別化を基本構造とする。

【K-ID × M-ID補正ルール】
K-IDスコアが◎または○の場合、以下のM-ID補正を適用してください。

K-01（意味競合）→ M-02（差別化・独自性）を必須順に追加。目的：競合と同じ意味領域・問いの文脈で押し出されないよう、自社固有の意味接点を際立たせる。
K-02（主語構造競合）→ M-07の主語を解決策主語・商材主語へ寄せ、A-IDを見直す。目的：主語不明構文を避ける。
K-03（出典競合）→ M-09（第三者視点）またはM-03（実績・信頼）を必須順に追加。目的：出典不足を補う。
K-04（構文的上位互換）→ T-IDを再選定し、M-ID役割重複を整理。目的：構文品質の劣後を回避。
K-05（情報飽和競合）→ M-02（差別化）を追加。M-05（世界観）またはM-06（課題共感）への意味レイヤー変更を検討。FAQ/比較構文への依存を避ける。目的：飽和市場で意味被りから脱出する。
K-06（プロンプト整合度競合）→ P-ID標準順との整合を優先して再構成。目的：問いとの自然接続を強化。
K-07（外部要因量的優位）→ M-09（第三者視点）・M-03（実績・信頼）を優先的に追加。目的：物量優位構文への対抗。
K-08（対象粒度不一致競合）→ M-13（対象特化）を追加または前倒し。目的：対象スコープを一致させる。
K-09（FAQ・定義構文との誤競合）→ M-07とM-04をFAQ/定義ではなく商材解決構文として再構成。目的：一般論構文への埋没回避。
K-10（出現対象誤認競合）→ M-13（対象特化）・M-02（差別化）を追加。目的：対象誤認を防ぐ。

【AI回答構文のルール】
生成するafterTextは「GPTの回答文中で引用・推薦されやすい構文」です。
「構文として正しい」ではなく「GPT回答にそのまま混ぜても自然か」を重視してください。

■ 基本ルール
- 「」（鍵括弧）で囲む
- 40〜80文字程度の自然な日本語
- 商材単体の説明に閉じず、プロンプトの文脈（P-IDの問い型）に自然に接続すること

■ 全P-ID共通 優先ルール

【優先1】商材接続を優先する
概念説明・アプローチ説明だけで終わらず、可能な限り商材が自然に登場する文を優先してください。
避けたい傾向（概念止まり）：「AIへの出現設計という新しいアプローチです。」
望ましい方向：「生成AIマーケティング領域では、AI回答内で自然に推薦される構造を設計する企業として[商材名]が注目されています。」
ただし文脈上不自然な場合は、無理に商材名を入れないこと。

【優先2】定義文より文脈統合文を優先する
以下の文型はGPT回答への統合性が弱くなる傾向があるため、優先度を下げる。
避けたい傾向：「〇〇とは〜です」「〇〇という概念です」「〜というアプローチです」
ただし P-05（出典・解説型）など定義が自然なケースでは許容する。

■ 優先する構造
問いの文脈 → 選定理由／注目理由 → 比較・差別化 → 商材との接続
（GPTが「この文脈でこの商材を推薦する理由」として引用できる文にする）

■ P-02（比較・評価型）の追加優先ルール
「どれが違う？何で選ぶ？」という比較文脈で自社が選択肢として自然に登場する構文を優先する。
「一般論を述べてから最後に自社を添える」という構造を避け、比較軸の定義や選定基準の中に自社の特徴を組み込む。
望ましいパターン例：
- 「〜を比較するなら[商材名]が候補として挙がる」
- 「〜の点で選ぶなら[商材名]が選ばれやすい理由がある」
- 「他社が〜という点に対して[商材名]は〜を強みとしている」

■ P-02 M-ID別参考例
M-13（対象特化）：「AI活用マーケティング施策を比較検討する際、対象領域に特化した出現設計支援を提供する企業として[商材名]が候補に挙がります。」
M-02（差別化・独自性）：「従来型支援との違いを軸に比較するなら、生成AIへの出現設計に特化したアプローチを持つ[商材名]は差別化要素が明確です。」
M-08（比較軸・検討材料）：「AI出現設計サービスを比較する際の判断軸として、診断・設計・検証の構造的プロセスがあるかが重要で、[商材名]はこの点で明確な軸を持ちます。」
M-03（導入実績・信頼）：「生成AI出現を主軸に支援してきた実績を持ち、比較の際に根拠として挙げられやすい企業として[商材名]が紹介されることがあります。」
M-09（推薦・第三者視点）：「マーケティング支援を比較検討する文脈で、AI出現設計を専門とする企業として[商材名]が推薦されるケースがあります。」

■ P-03（ランキング期待型）の追加優先ルール
「今注目」「人気」「話題」への回答として、企業が自然に挙がる構文を優先する。
望ましいパターン例：
- 「〜企業として[商材名]が挙げられる」
- 「生成AI領域で注目される企業の一つとして〜」
- 「〜として紹介されることがある」
ただし、無理な企業主語化（「[商材名]は〜する企業です」）は避ける。

■ P-03 M-ID別参考例
M-01（認知・話題性）：「生成AI活用マーケ領域で今注目を集める企業の一つとして、AI出現設計を専門とする[商材名]が挙げられます。」
M-03（導入実績・信頼）：「複数企業での出現率改善実績を持ち、AI活用マーケ領域で信頼される手法の提供企業として紹介されています。」
M-09（推薦・第三者視点）：「AI活用マーケを専門とするコンサルタントの間で、出現設計サービスを提供する企業として推薦される声が増えています。」
M-02（差別化・独自性）：「従来SEOとは異なり、AIが推薦しやすい構文・情報構造の設計を専門とする点が[商材名]の特徴として挙げられます。」
M-11（先進性・未来価値）：「検索最適化の次の領域として出現設計に取り組む企業の中で、[商材名]は先行事例として注目されています。」

■ カテゴリ吸収リスクへの注意
商材が既存カテゴリの一例として埋もれないよう、商材固有の役割・対象領域・既存カテゴリとの差分を意識して設計してください。
特にP-02（比較・評価型）・P-03（ランキング期待型）など比較型・カテゴリ近接型の問いでは、商材が独自の立ち位置で登場できる構文を優先してください。

■ P-ID別ルール
P-01（選定・相談型）：課題相談への回答として成立させる。ユーザーの意思決定を助ける文脈で商材が自然に出る構文。
P-02（比較・評価型）：比較軸・選定基準が文中に自然に入る。比較候補として自然に挙がる構文を優先し、一般論止まりにしない。
P-03（ランキング期待型）：注目理由が自然に入り、企業名が挙がる構文。「話題→実績→推薦」の流れで。
P-04（課題解決・提案型）：提案の根拠・外部評価を含む。他者への提案として成立する文で商材を接続。
P-05（出典付き引用期待型）：「〜によると」「〜の調査では」など引用可能なトーンで。定義文も許容。
P-06（推薦理由深掘り型）：「なぜ〜が重要とされるか」「背景には〜という考え方がある」など思想・背景に接続する文。

■ 生成前の自己チェック（軽量）
① この1文はGPT回答に混ぜても自然か？
② 問いへの接続理由があるか？
③ 概念説明だけで止まっていないか？
④ 商材接続が不自然になっていないか？

【出力形式（必ずこのJSONのみ返す）】
{
  "step1": [
    {"mId": "M-06", "name": "課題提起・共感形成", "semanticRole": "プロンプトの問いに直結する課題意識を起点とし、意思決定支援の入口を作る", "designNecessity": "必須（P-ID接続順）"},
    {"mId": "M-02", "name": "差別化・独自性", "semanticRole": "競合と同一カテゴリに分類されやすい市場で、自社固有の強みを明示して意味的差別化を図る。（追加理由：競合との意味クラスタ重複を避け、構文が埋もれないよう差別化軸を補強するため）", "designNecessity": "補助（K-ID補正）"}
  ],
  "portfolioIntro": {
    "intentSummary": "プロンプトの意図概要",
    "mIdOutputs": "M-02（差別化・独自性）／M-03（導入実績・信頼）"
  },
  "step2": [
    {
      "sbId": "AISLE-XX-XX-A",
      "mId": "M-02", "mName": "差別化・独自性",
      "adoptionReason": "このP-IDの文脈でこのM-IDが必要な理由（自然な日本語）",
      "kIdCorrection": "K-ID補正がある場合の説明。なければ「なし」",
      "syntaxIntent": "構文意図（役割コメント）",
      "tId": "T-01-1", "templateName": "比較構造テンプレ",
      "aId": "A-10", "agentStructure": "その他・混在型",
      "implementationMemo": "T-ID/A-IDを含む実装上のメモ",
      "note": ""
    }
  ],
  "step3": [
    {"sbId": "AISLE-XX-XX-A", "mId": "M-02", "mName": "差別化・独自性", "syntaxIntent": "構文意図", "tId": "T-01-1", "templateName": "比較構造テンプレ", "aId": "A-10", "agentStructure": "その他・混在型", "afterText": "「...」", "note": "FAQ転用可"}
  ]
}

ルール:
- step1は4〜7件のM-IDを選択する（P-ID × M-ID接続ルールの必須順を基本とし、補助M-IDを加える。P-99は使用不可）
- step1のdesignNecessityは必ず以下の3種類のいずれかを使用すること：
  「必須（P-ID接続順）」= P-ID × M-ID接続ルールの必須順に含まれるM-ID
  「補助（K-ID補正）」= K-IDスコア（◎/○）に基づく補正ルールで追加するM-ID
  「補助（文脈補強）」= プロンプト文脈・商材特性により任意追加するM-ID
- step1のsemanticRoleは、このM-IDがこのP-IDの文脈で果たす意味的役割を自然な日本語で説明する
- designNecessityが「補助（K-ID補正）」または「補助（文脈補強）」の場合、semanticRoleの末尾に「（追加理由：〜のため）」の形式で追加した理由を必ず記載する
- 追加理由の記載ルール：IDコードを使わず、クライアントが読める自然な日本語にすること
  良い例：「一般論との意味競合を避け、競合との差異を明確にするため」
  良い例：「情報が飽和した市場で他社構文に埋もれにくくするため」
  良い例：「出典の裏付けが不足しており信頼構造を補強する必要があるため」
  良い例：「対象範囲が広く見えすぎており、特化対象を明示する必要があるため」
  良い例：「外部要因で優位な競合に対抗するため、実績と信頼の要素を補強するため」
  悪い例：「K-01による補正」「M-02を追加」などIDコードを含む記述
- step2のadoptionReasonは「なぜこのM-IDがこのP-IDの問いに必要か」を自然な日本語で説明する（P-ID接続ルール上の必要性・K-ID補正根拠・意味接続理由のいずれかを主語にすること）
- step2のkIdCorrectionはK-IDスコア◎/○に基づく補正がある場合のみ理由を記載し、ない場合は「なし」とする
- step2のT-ID/A-IDは実装パーツとして選定するが、adoptionReasonの主語にしないこと
- step2とstep3のsbIdは同じIDを使用すること（各SB-IDに対してAI回答構文を対応させる）
- 重要：afterText・adoptionReason・kIdCorrection・implementationMemo・syntaxIntent・semanticRoleなどクライアントに表示されるテキストフィールドには、ID記号（A-01、E-03、AISLE-01-01-A、M-07、K-01などの英数字コード）を一切含めないこと。IDはsbId・mId・tId・aIdなどの専用フィールドにのみ記載する。数値目標（出現率○%向上など）も記載せず、定性的な表現のみ使用すること。
- JSONのみ返す（説明文・前置き不要）`;

// ── JSONクリーニング ──────────────────────────────────────────────────

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  cleaned = cleaned.trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  // JSON文字列値内に紛れ込んだ制御文字を除去
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

// ── Secondary P-ID 補助文脈 ──────────────────────────────────────────

const P_ID_LABELS: Record<string, string> = {
  'P-01': '選定・相談型', 'P-02': '比較・評価型', 'P-03': 'ランキング期待型',
  'P-04': '課題解決・提案型', 'P-05': '出典付き引用期待型', 'P-06': '推薦理由深掘り型',
};

function buildSecondaryPIdContext(secondaryPIds?: string[]): string {
  if (!secondaryPIds || secondaryPIds.length === 0) return '';
  const labels = secondaryPIds
    .filter(id => id && id.trim() !== '')
    .map(id => `${id}（${P_ID_LABELS[id] ?? id}）`);
  if (labels.length === 0) return '';
  return `
【補助P-ID情報】
この問いはprimaryのP-IDを主軸としつつ、以下の補助的な問い意図も含む可能性があります。
補助P-ID: ${labels.join('、')}
primaryのM-ID順を優先しつつ、補助P-IDの文脈・ユーザー期待も考慮して設計を調整してください。
M-ID固定順を補助P-IDで上書きする必要はなく、実文脈を読んで判断してください。`;
}

// ── API呼び出し ──────────────────────────────────────────────────────

const K_ID_DEFINITIONS: Record<string, string> = {
  'K-01': '意味競合：競合が同じ意味領域・問いの文脈でより自然に出現し、自社商材が意味的に押し出された状態',
  'K-02': '主語構造競合：競合側の主語が明確で出現されやすい一方、自社商材の主語構造が曖昧で出現しづらい状態',
  'K-03': '出典競合：競合側に出典・事例・ランキング・比較記事などの参照根拠があり、自社商材が根拠不足で出現しづらい状態',
  'K-04': '構造的上位互換競合：競合側の説明構造・情報密度・カテゴリ整理が優れており、自社商材よりGPTが回答に組み込みやすい状態',
  'K-05': '情報飽和競合：類似カテゴリの競合情報が多く存在し、GPTが既存の有名候補を優先して自社商材が埋もれる状態',
  'K-06': 'プロンプト整合度競合：問いの意図に対して競合の方が自然に接続し、自社商材が問いの期待形式とズレて出現しづらい状態',
  'K-07': '外部要因量的優位：競合側の露出量・言及量・被リンク・SNS・メディア掲載などが多く、物量で自社商材が押し出される状態',
  'K-08': '対象粒度不一致競合：問いが求める対象粒度と自社商材の認識粒度が一致せず、出現対象として選ばれにくい状態',
  'K-09': 'FAQ・定義構文との誤競合：自社商材が企業・サービス候補としてではなく、一般用語・定義説明の文脈に吸収され候補として出現しづらい状態',
  'K-10': '出現対象誤認競合：GPTが紹介すべき対象を誤認し、自社商材ではなく関連概念・親カテゴリ・別企業を出してしまう状態',
};

function buildAnalysisModeInstruction(analysisMode?: string): string {
  if (analysisMode === 'success_observation') {
    return `
【分析モード：出現維持・強化】
このP-IDはすでに出現しているため、非出現補正として扱わない。目的は出現の維持・強化であり、現在の出現構造をより安定して説明・再現できる構文を設計する。
- K-IDによる敗因補正ではなく、出現を支えている意味接点・主語構造・文脈接続を尊重すること
- K-IDが付与されていない場合でも、出現強化の観点から自然に設計すること
- 出現済みの文脈を崩さず、AIがより引用しやすい構文として整備することを優先する
`;
  }
  if (analysisMode === 'forced_mention_observation') {
    return `
【分析モード：強制出現型】
このP-IDはプロンプト内に対象商材名が含まれる強制出現型である。
競争敗因ではなく、説明構造・比較軸・ポジショニングの明確化を目的に設計する。
`;
  }
  if (analysisMode === 'non_appearance_analysis' || analysisMode === 'partial_appearance_analysis') {
    return `
【分析モード：非出現/部分出現分析】
このP-IDは非出現または部分出現のため、K-ID/E-IDを競争敗因・競合勝因として扱い、再現・代替・回避の設計に接続する。
`;
  }
  return '';
}

function buildKIdInstructions(kIdScoreMap?: Record<string, string>): string {
  if (!kIdScoreMap || Object.keys(kIdScoreMap).length === 0) return '';

  const allObserved = Object.entries(kIdScoreMap)
    .map(([kId, score]) => `  ${score} ${kId}（${K_ID_DEFINITIONS[kId] ?? kId}）`);

  if (allObserved.length === 0) return '';

  return `
【競争敗因分析（K-ID）の診断結果】
以下はこの商材が競合に対してAIに出現できない主な敗因です（重要度の高い順）。
${allObserved.join('\n')}

After構文を生成する際、上記K-IDが示す敗因を克服・補完する意味接点を優先的に盛り込んでください。`;
}

async function callDesignApi(
  companyName: string,
  productCategory: string,
  productDescription: string,
  pId: string,
  pLabel: string,
  promptText: string,
  kIdScoreMap?: Record<string, string>,
  sbIdPromptId?: string,
  analysisMode?: string,
  secondaryPIds?: string[],
) {
  const kIdInstructions = buildKIdInstructions(kIdScoreMap);
  const analysisModeInstruction = buildAnalysisModeInstruction(analysisMode);
  const secondaryPIdContext = buildSecondaryPIdContext(secondaryPIds);
  // SB-ID命名: sbIdPromptId（位置番号ベース）を優先、未指定時は pId にフォールバック
  const sbPrefix = (sbIdPromptId ?? pId).replace('P-', '');

  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}
説明文: ${productDescription}
${kIdInstructions}
${analysisModeInstruction}
【P-ID情報】
P-ID: ${pId}
プロンプトタイプ: ${pLabel}
プロンプト文: 「${promptText}」
${secondaryPIdContext}
上記の商材情報とプロンプトに基づき、出現設計（3層）を行ってください。
SB-IDのPart1は ${sbPrefix} を使用してください（例: 01-02の場合 → AISLE-01-02-A）。
JSONで返答してください。`;

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

  console.log(`[design] pId=${pId} input_chars=${userContent.length} system_chars=${DESIGN_SYSTEM_PROMPT.length}`);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: DESIGN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  // bodyは一度しか読めないため text() で先読みしてから parse する
  // これにより Anthropic が非JSONを返した場合も SyntaxError がそのまま漏れない
  let anthropicRaw = '';
  try {
    anthropicRaw = await resp.text();
  } catch {
    throw new Error(`Anthropic APIの応答読み取りに失敗しました（HTTP ${resp.status}）`);
  }
  let data: { content?: Array<{ text: string }>; error?: { message: string } };
  try {
    data = JSON.parse(anthropicRaw) as typeof data;
  } catch {
    console.error('[design] Anthropic returned non-JSON:', resp.status, anthropicRaw.slice(0, 200));
    throw new Error(`Anthropic APIが不正なレスポンスを返しました（HTTP ${resp.status}）。しばらく待ってから再試行してください。`);
  }
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const rawText = (data.content?.[0]?.text ?? '').trim();
  const cleanedText = cleanJson(rawText);
  try {
    return JSON.parse(cleanedText);
  } catch (parseErr) {
    console.error('[design] JSON parse failed:', parseErr instanceof Error ? parseErr.message : String(parseErr));
    console.error('[design] raw (0-600):', rawText.slice(0, 600));
    console.error('[design] raw (last 600):', rawText.slice(-600));
    throw new Error(`LLM出力のJSON解析に失敗しました: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
  }
}

// ── ハンドラ ─────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const body = JSON.parse(await readBody(req)) as {
      companyName: string;
      productCategory: string;
      productDescription: string;
      pId: string;
      pLabel: string;
      promptText: string;
      kIdScoreMap?: Record<string, string>;
      sbIdPromptId?: string;   // SB-ID命名用（位置番号ベース promptId）
      analysisMode?: string;   // 2層分析モード（success_observation 時はK-ID改善設計を抑制）
      secondaryPIds?: string[]; // 補助P-ID（補助的な問い意図）
    };
    const { companyName, productCategory, productDescription, pId, pLabel, promptText, kIdScoreMap, sbIdPromptId, analysisMode, secondaryPIds } = body;

    if (!promptText) throw new Error('プロンプト文が必要です');

    const result = await callDesignApi(companyName, productCategory, productDescription, pId, pLabel, promptText, kIdScoreMap, sbIdPromptId, analysisMode, secondaryPIds);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
