import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

// =====================================================================
// AI API プロキシミドルウェア
// =====================================================================

const SYSTEM_PROMPT = `あなたはAisle出力構造分析エンジンです。
GPT/AI出力ログを以下の定義に厳密に基づいて分類してください。

【C-ID定義（意味クラスタ）— 最も焦点の強い1つを選択】
C-01 信頼性補完型: 監修・評価・導入社数・事例・受賞歴など信頼根拠を含む構文
C-02 比較優位訴求型: 他社との比較・選ばれる理由・競合不在・独自視点など差分に焦点
C-03 意味構造整理型: 「〇〇とは」「〜の3点」など意味の解説・要素化・分類・構造提示
C-04 導線最適化型: 比較表・リスト・FAQ接続・ランキング参照など次アクションへ誘導
C-05 ストーリー浸透型: ユーザー体験・導入経緯・課題・ビフォーアフターなどストーリー展開
C-06 意思共鳴訴求型: 「私たちの想い」「社会のあり方」など理念・思想・信念を語る構文
C-07 問題提起・社会性補強型: SDGs・政策・社会課題・制度設計など社会的文脈と接続
C-08 エモーショナル訴求型: 感動・驚き・共感など感情語を含む情緒的訴求が主眼の構文
C-09 FAQ・回遊ナビゲーション型: 「おすすめ〇選」「〜の選び方」「よくある質問」など
C-10 利用文脈共有型: 「〜な人に」「こんなときに便利」など具体的な使用文脈・シーンが明示

【A-ID定義（主語構造）— 語り手・発話主体に最も近い1つを選択】
A-01 専門家・有識者: 医師・研究者・コンサルタントなど専門性を持つ個人が主語
A-02 企業・団体: 会社名・ブランド・法人が語る形式（「〜は」「〜が提供」など）
A-03 メディア: 新聞・雑誌・Webメディアなど報道・レビュー媒体が主語
A-04 ユーザー・口コミ: エンドユーザー・SNS投稿者・レビュー記述者の発言・口コミ
A-05 ナレーター・AI視点: 特定主体に依らない中立ナレーション調・GPT自身の記述視点
A-06 公的機関・統計機関: 国・自治体・国際機関・学会・調査機関などの公的機関
A-07 創業者・代表者: 創業者・CEO・代表取締役の語り（組織の内的語り）
A-08 現場社員・担当者: 現場担当者・社員の声（組織公式見解ではなく現場視点）
A-09 パートナー・外部協力者: 提携企業・共同プロジェクト関係者・他社推薦の発言
A-10 その他・混在型: 複数主語が混在・特定困難なケース（AP-IDで補完）

【AP-ID定義（A-10判定時のみ付与）】
AP-01 第三者視点型: 主語明示なし・「〜とされている」「〜が話題」など客観評価的記述
AP-02 解説提示型: 「〜とは〜です」「〜とされています」など辞書・説明的記述
AP-03 商材主題型: 商材が文頭主語（「◯◯は〜」と直接紹介される構文）
AP-04 評価提示型: 「おすすめ」「選ばれています」など主語不明の評価提示
AP-05 複合視点型: 主語と視点が混在・切り替わり・特定困難な構造

【出典分類（7種、優先順位の高い方を選択）】
業界レポート／資料: 調査・分析・ランキング・業界ニュース・白書・統計レポートの引用
レビューサイト: 評価・口コミ・比較サイト・Amazon・価格.comなどユーザー評価の参照
公式サイト: ブランド・製品・会社の公式情報・製品ページ・プレスリリース
Wikipedia／用語定義サイト: 百科事典・用語解説系サイト・「〜とは」構文
一般知識: 出典記載なし・仕様記述・一般的な説明（GPTの事前学習情報）
その他: SNS・ブログ・伝聞・曖昧な情報源
出典不明: 出典要素が一切なく断定的・抽象的記述のみ

【出力形式（必ずこのJSONのみ返す）】
{"results": [
  {"id": "1", "cId": "C-01", "aId": "A-05", "apId": "", "sourceCategory": "レビューサイト"},
  ...
]}

ルール:
- 全件必ず返すこと（件数を省略しない）
- cId: C-01〜C-10のうち最も主要な意味的焦点の1つのみ
- aId: A-01〜A-10のうち最も支配的な主語構造1つのみ
- apId: aIdがA-10のときのみAP-01〜AP-05、それ以外は必ず""（空文字）
- sourceCategory: 優先順位の高いカテゴリを1つのみ
- JSONのみ返す（説明文・前置き不要）`

function buildUserPrompt(entries: Array<{ id: string; promptId: string; output: string }>): string {
  const list = entries.map(e =>
    `<entry id="${e.id}" promptId="${e.promptId}">\n${e.output}\n</entry>`
  ).join('\n');
  return `以下のGPT出力ログ${entries.length}件を分類してください。\n\n${list}\n\nJSONで全${entries.length}件を返してください。`;
}

async function callClaudeApi(apiKey: string, entries: Array<{ id: string; promptId: string; output: string }>) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(entries) }],
    }),
  });
  const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
  const text = data.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*"results"[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function callOpenAiApi(apiKey: string, entries: Array<{ id: string; promptId: string; output: string }>) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(entries) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  const data = await resp.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `OpenAI API error ${resp.status}`);
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}

async function callGeminiApi(apiKey: string, entries: Array<{ id: string; promptId: string; output: string }>) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = SYSTEM_PROMPT + '\n\n' + buildUserPrompt(entries);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
  if (!resp.ok) throw new Error(data.error?.message ?? `Gemini API error ${resp.status}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// =====================================================================
// 3層 出現設計 システムプロンプト
// =====================================================================

const DESIGN_SYSTEM_PROMPT = `あなたはAisle出現設計エンジン（3層）です。
商材情報とプロンプト情報を受け取り、GPT出現設計を行ってください。

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

【P-ID × M-ID接続パターン（参考）】
P-01(選定・相談型): 主にM-05→M-06→M-07→M-04→M-03→M-10(Aパターン)
P-02(比較・評価型): 主にM-13→M-02→M-08→M-09→M-07→M-10(Bパターン)
P-03(ランキング期待型): 主にM-01→M-03→M-04→M-09→M-07→M-10(Cパターン)
P-04(課題解決・提案型): 主にM-06→M-07→M-04→M-03→M-09→M-10(Dパターン)
P-05(出典付き引用期待型): 主にM-01→M-03→M-04→M-09→M-07→M-10(Cパターン)
P-06(推薦理由深掘り型): 主にM-05→M-06→M-07→M-04→M-03→M-10(Aパターン)
P-99(その他・特殊型): 主にM-11→M-05→M-06→M-02→M-03→M-10(Eパターン)

【After構文草案のルール】
- 「」（鍵括弧）で囲む
- 40〜80文字程度の自然な日本語
- 商材の具体的な強みや特徴を盛り込む
- プロンプトの意図に合致した語り口を選ぶ

【出力形式（必ずこのJSONのみ返す）】
{
  "step1": [
    {"mId": "M-02", "name": "差別化・独自性", "semanticRole": "このP-IDにおける意味役割の説明", "designNecessity": "必須（構文候補あり）"}
  ],
  "portfolioIntro": {
    "intentSummary": "プロンプトの意図概要",
    "mIdOutputs": "M-02（差別化・独自性）／M-03（導入実績・信頼）"
  },
  "step2": [
    {"sbId": "AISLE-XX-XX-A", "mId": "M-02", "mName": "差別化・独自性", "syntaxIntent": "構文意図", "tId": "T-01-1", "templateName": "比較構造テンプレ", "aId": "A-10", "agentStructure": "その他・混在型", "note": ""}
  ],
  "step3": [
    {"sbId": "AISLE-XX-XX-A", "mId": "M-02", "mName": "差別化・独自性", "syntaxIntent": "構文意図", "tId": "T-01-1", "templateName": "比較構造テンプレ", "aId": "A-10", "agentStructure": "その他・混在型", "afterText": "「...」", "note": "FAQ転用可"}
  ],
  "step4": [
    {"order": 1, "sbId": "AISLE-XX-XX-A", "mId": "M-05", "afterText": "「...」", "comment": "世界観・価値観の提示で冒頭の関心を喚起"}
  ],
  "connectionComment": "この構成は...",
  "step5": [
    {"sbId": "AISLE-XX-XX-A", "mId": "M-05", "kIdMatch": "K-01", "requiredEId": "E-01（外部記事）", "resourceExample": "PR TIMES掲載「...」", "comment": "..."}
  ],
  "step6": [
    {"sbId": "AISLE-XX-XX-A", "mId": "M-05", "tId": "T-07-5", "aId": "A-05", "probability": "高", "semanticFit": "◎", "connectionFit": "◎", "complementNeed": "不要", "comment": "..."}
  ],
  "summary": {
    "overallImpression": "全体的な評価",
    "keyBun": "注目構文の説明",
    "complementNeeds": "補完要否の説明",
    "implementationProposal": "実装提案"
  }
}

ルール:
- step1は4〜7件のM-IDを選択する（プロンプトタイプに適合したもの）
- step2とstep3のsbIdは同じIDを使用すること（各SB-IDに対してAfter構文を対応させる）
- step4の接続順はM-ID接続パターンに沿って並べ替える
- step5は各SB-IDにK-IDとE-IDを割り当てる
- step6は各SB-IDの出現見込みを評価する
- JSONのみ返す（説明文・前置き不要）`

async function callDesignApi(
  provider: 'claude' | 'openai' | 'gemini',
  apiKey: string,
  companyName: string,
  productCategory: string,
  productDescription: string,
  pId: string,
  pLabel: string,
  promptText: string,
) {
  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}
説明文: ${productDescription}

【P-ID情報】
P-ID: ${pId}
プロンプトタイプ: ${pLabel}
プロンプト文: 「${promptText}」

上記の商材情報とプロンプトに基づき、出現設計（3層）を行ってください。
SB-IDのPart1は ${pId.replace('P-', '').replace('-', '-')} を使用してください（例: P-01-02なら AISLE-01-02-A）。
JSONで返答してください。`

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: DESIGN_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });
    const data = await resp.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `OpenAI API error ${resp.status}`);
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } else if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const prompt = DESIGN_SYSTEM_PROMPT + '\n\n' + userContent;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Gemini API error ${resp.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } else {
    // Claude
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        system: DESIGN_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

// =====================================================================
// 突合 システムプロンプト
// =====================================================================

const RECONCILE_SYSTEM_PROMPT = `あなたはAisle突合診断エンジン（4層）です。
2層診断（実出現ログ）と3層診断（構文設計）を照合・突合し、出現構造ギャップを診断してください。

【突合の定義】
3層で設計された構文群（SB-ID単位）が、実際のGPT出現ログ（2層）においてどのように出現しているかを
プロンプト単位で照合し、「出現しにくさ」の構造要因を特定する診断工程。

【評価カテゴリ（6軸）】
1. 出現実績ログ（出現有無）: GPT出力ログ内で構文が出現したかどうか
2. 出現ポジション（上位/中位/下位/-）: 出現位置に応じた意味空間内での強度
3. 出現構文との接続関係（並存構文の種類）: 出現構文との組み合わせ/ナビゲーション構造
4. 出現困難要因（理由分類）: 外部要因欠如・主語設計の不備・テンプレ不適合など
5. 意味空間補強要素（補強種別）: 引用記事・第三者評価・比較構文・出典接続などの信頼補完構造
6. サイト接続構造の状況（導線有無）: 該当構文が意味的にナビゲートされる構造になっているか

【出力フォーマット】
{
  "detailReport": [
    {
      "pId": "P-01-01",
      "promptText": "プロンプト文",
      "sbId": "AISLE-01-01-A",
      "appeared": false,
      "position": "-",
      "difficultyReason": "外部接続性の欠如・主語構造が浮いている",
      "hasComplement": false,
      "complementProposal": "出典構文（T-06-2）と連携し、FAQページから導線を確保する"
    }
  ],
  "matrixReport": [
    {
      "sbId": "AISLE-01-01-A",
      "appearanceRate": "0%",
      "connectionCount": "0件",
      "externalNeed": "高",
      "difficultyLevel": "高",
      "targetPage": "専用FAQページ",
      "recommendedPrompt": "「どのような会社が選ばれるか？」"
    }
  ],
  "patternTable": [
    {
      "appearanceStatus": "出現なし",
      "syntaxScore": "高",
      "complementNeed": "高",
      "measures": "意味空間補強＋出典接続＋導線設計"
    },
    {
      "appearanceStatus": "出現あり",
      "syntaxScore": "中",
      "complementNeed": "中",
      "measures": "掲載位置調整／主語再設計"
    },
    {
      "appearanceStatus": "出現なし",
      "syntaxScore": "低",
      "complementNeed": "中〜低",
      "measures": "再構文化 or 採用見送り"
    }
  ],
  "overallSummary": "総合的な突合診断コメント（200字程度）"
}

【診断ルール】
- detailReportは「P-ID × SB-ID」の全組み合わせを列挙する（P-IDごとにそのP-IDのSB-IDすべてを評価）
- appearedは2層の出現データ（その P-ID の出現率・出現有無）を参照して判断する
- 出現率が50%以上→一部出現あり（appeared: true）、50%未満→出現なし（appeared: false）
- positionは出現ありの場合のみ上位/中位/下位のいずれか、なしの場合は"-"
- difficultyReasonはK-IDの阻害要因を参照し具体的に記述する
- matrixReportはSB-ID単位で集約する（複数P-IDに同じSB-IDが出現する場合は統合）
- patternTableは実際のデータから導出される対応パターンを記述する（3〜5件程度）
- JSONのみ返す（説明文・前置き不要）`

async function callReconcileApi(
  provider: 'claude' | 'openai' | 'gemini',
  apiKey: string,
  companyName: string,
  productCategory: string,
  phase1Summary: unknown,
  phase2Design: unknown,
) {
  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【2層診断データ（実出現ログ要約）】
${JSON.stringify(phase1Summary, null, 2)}

【3層設計データ（構文設計結果）】
${JSON.stringify(phase2Design, null, 2)}

上記の2層診断データと3層設計データを突合し、出現構造ギャップを診断してください。
JSONで返答してください。`

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: RECONCILE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });
    const data = await resp.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `OpenAI API error ${resp.status}`);
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } else if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const prompt = RECONCILE_SYSTEM_PROMPT + '\n\n' + userContent;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Gemini API error ${resp.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } else {
    // Claude
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        system: RECONCILE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

// =====================================================================
// 実装設計 システムプロンプト
// =====================================================================

const IMPLEMENT_SYSTEM_PROMPT = `あなたはAisle実装設計エンジン（フェーズ④）です。
突合診断の結果を受け取り、出現率向上のための具体的な実装設計を行ってください。

【実装設計の目的】
突合診断で特定された「出現しにくさの構造要因」を解消するために、
構文の設置位置・他構文との連携補強・主語やテンプレートの調整などの実装施策を導出する。

【E-ID一覧（外部補完要因）】
E-01 媒体掲載（ニュース・PR） E-02 専門サイト・辞書系言及 E-03 出典付き事例・実績
E-04 FAQ構造/Schema連携 E-05 SNS・UGCでの話題性 E-06 被リンク・SEOドメイン強度
E-07 ランキング/比較記事 E-08 クローラビリティの最適化 E-09 複数出典の交差構造
E-10 情報の更新頻度・鮮度 E-11 エンティティ出現済情報 E-12 ナビゲーション構造/回遊性
E-13 引用可能性（クオート構造）

【優先度の判断基準】
- 高：出現困難度「高」かつ外部補強必要度「高」→ 意味空間補強＋出典接続＋導線設計が必要
- 中：出現あり or 困難度「中」→ 掲載位置調整／主語再設計が有効
- 低：出現困難度「低」or 構文スコアが低い → 軽微な調整 or 採用見送り検討

【出力形式（必ずこのJSONのみ返す）】
{
  "planRows": [
    {
      "sbId": "AISLE-01-01-A",
      "priority": "高",
      "action": "FAQページにM-04（専門性）構文を設置し、T-06-2（出典接続）と連携させる",
      "targetPage": "FAQページ / サービス概要ページ",
      "eIdRequired": "E-04（FAQ構造/Schema連携）・E-03（出典付き事例）",
      "expectedEffect": "「AIでマーケティング支援をする会社は？」への出現率向上（現状0%→30%目標）",
      "connectionSyntax": "AISLE-01-01-B（比較構文）と連携し意味ネットワークを補強"
    }
  ],
  "prioritySummary": "実装全体の優先順序と期待効果の総括コメント（200字程度）"
}

【ルール】
- 選択されたSB-IDすべてに対してplanRowを1件ずつ生成する
- actionは具体的なページ設置・コンテンツ追加・構文連携を明記する
- targetPageはサービスサイトの一般的なページ名で記述する（トップ/FAQ/サービス概要/事例紹介/ブログ等）
- eIdRequiredは必要なE-IDを2〜3件選んで記述する
- expectedEffectは対象プロンプトへの出現改善効果を定性・定量で記述する
- connectionSyntaxは連携推奨の他SB-IDを記述する（なければ「単独実装」）
- prioritySummaryは高優先度から順に実装するロードマップ的な内容にする
- JSONのみ返す（説明文・前置き不要）`

async function callImplementApi(
  provider: 'claude' | 'openai' | 'gemini',
  apiKey: string,
  companyName: string,
  productCategory: string,
  selectedItems: unknown[],
) {
  const userContent = `【商材情報】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【実装対象SB-ID（突合診断より）】
${JSON.stringify(selectedItems, null, 2)}

上記のSB-IDについて、出現率向上のための実装設計を行ってください。
JSONで返答してください。`

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: IMPLEMENT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });
    const data = await resp.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `OpenAI API error ${resp.status}`);
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } else if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const prompt = IMPLEMENT_SYSTEM_PROMPT + '\n\n' + userContent;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Gemini API error ${resp.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } else {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        system: IMPLEMENT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

// =====================================================================
// 競合出現構造分析 システムプロンプト
// =====================================================================

const COMPETITOR_SYSTEM_PROMPT = `あなたはAisle競合出現構造分析エンジンです。
GPT/AIの出力本文テキスト群からエンティティ（企業名・サービス名・メディア名）と
語彙パターンを抽出し、競合出現構造を分析してください。

【分析の目的】
出力本文から「何がどういう構造で出現しているか」を可視化し、
After構文設計の逆算根拠・K-ID（阻害要因）の実体特定を行う。

【抽出対象エンティティ】
- 企業名・ブランド名（固有名詞として明確に識別できるもの）
- サービス名・製品名（SaaS・アプリ・プラットフォーム等）
- メディア・情報サイト名
※「一般企業」「複数社」などの総称は除外

【語彙パターンの種類（代表例）】
- 公式サイト誘導型: 「〇〇の公式サイトから相談」「公式ページで確認」
- 比較推薦型: 「〇〇と〇〇を比較すると」「〜なら〇〇がおすすめ」
- 実績訴求型: 「〇〇は〜社が導入」「〜の実績を持つ〇〇」
- ランキング言及型: 「〇〇などが上位にランクイン」
- 資料・問い合わせ誘導型: 「〇〇の資料請求ページから」

【出力フォーマット（必ずこのJSONのみ返す）】
{
  "entityRanking": [
    {
      "rank": 1,
      "entity": "SmartHR",
      "count": 15,
      "pIds": ["P-01-01", "P-02-01"],
      "dominantStructure": "「〇〇を導入している企業が多い」という推薦・実績型構文"
    }
  ],
  "entityByPId": {
    "P-01-01": [
      {
        "rank": 1,
        "entity": "SmartHR",
        "count": 8,
        "pIds": ["P-01-01"],
        "dominantStructure": "「〇〇を選ぶ企業が増えている」という比較型構文"
      }
    ]
  },
  "vocabPatterns": [
    {
      "patternType": "公式サイト誘導型",
      "example": "「〇〇の公式サイトから無料で相談できます」",
      "count": 12,
      "kIdHint": "K-03（出典競合）の正体：競合の公式ドメイン強度が高く自社が押し出される"
    }
  ],
  "summariesByPId": {
    "P-01-01": "このP-IDではXXとYYが支配的に出現しており、主語構造はA-02（企業・団体型）が多数。K-05（情報飽和競合）の正体はXXとYYの豊富なコンテンツ量。M-09（推薦・第三者視点）構文の強化が有効。"
  }
}

ルール:
- entityRankingは全P-ID横断で出現頻度上位10件（頻度順）
- entityByPIdは各P-IDの上位5件
- vocabPatternsは実際に多く出現している3〜5パターン
- summariesByPIdは各P-IDについて80〜120字程度（K-IDとの対応を明示）
- JSONのみ返す（説明文・前置き不要）`

async function callCompetitorApi(
  provider: 'claude' | 'openai' | 'gemini',
  apiKey: string,
  pIdGroups: Array<{ pId: string; outputs: string[] }>,
  kIdSummary: string,
) {
  const userContent = `以下のP-ID別GPT出力本文サンプルを分析し、競合出現構造を特定してください。

【P-ID別出力本文サンプル】
${pIdGroups.map(g =>
  `[${g.pId}]\n${g.outputs.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
).join('\n\n')}

【参考: 2層診断のK-ID情報】
${kIdSummary}

JSONで返答してください。`

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: COMPETITOR_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    const data = await resp.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `OpenAI API error ${resp.status}`);
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  } else if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const prompt = COMPETITOR_SYSTEM_PROMPT + '\n\n' + userContent;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    const data = await resp.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Gemini API error ${resp.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } else {
    // Claude
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 6000,
        system: COMPETITOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await resp.json() as { content?: Array<{ text: string }>; error?: { message: string } };
    if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function apiPlugin(): Plugin {
  return {
    name: 'aisle-api-proxy',
    configureServer(server) {
      // 競合出現構造分析 エンドポイント
      server.middlewares.use('/api/competitor', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = JSON.parse(await readBody(req)) as {
            provider: 'claude' | 'openai' | 'gemini';
            apiKey: string;
            pIdGroups: Array<{ pId: string; outputs: string[] }>;
            kIdSummary: string;
          };
          const { provider, apiKey, pIdGroups, kIdSummary } = body;
          if (!apiKey) throw new Error('APIキーが必要です');
          const result = await callCompetitorApi(provider, apiKey, pIdGroups, kIdSummary);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });

      // 実装設計 エンドポイント
      server.middlewares.use('/api/implement', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = JSON.parse(await readBody(req)) as {
            provider: 'claude' | 'openai' | 'gemini';
            apiKey: string;
            companyName: string;
            productCategory: string;
            selectedItems: unknown[];
          };
          const { provider, apiKey, companyName, productCategory, selectedItems } = body;
          if (!apiKey) throw new Error('APIキーが必要です');
          const result = await callImplementApi(provider, apiKey, companyName, productCategory, selectedItems);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });

      // 突合診断 エンドポイント
      server.middlewares.use('/api/reconcile', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = JSON.parse(await readBody(req)) as {
            provider: 'claude' | 'openai' | 'gemini';
            apiKey: string;
            companyName: string;
            productCategory: string;
            phase1Summary: unknown;
            phase2Design: unknown;
          };
          const { provider, apiKey, companyName, productCategory, phase1Summary, phase2Design } = body;
          if (!apiKey) throw new Error('APIキーが必要です');
          const result = await callReconcileApi(provider, apiKey, companyName, productCategory, phase1Summary, phase2Design);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });

      // 3層 出現設計 エンドポイント
      server.middlewares.use('/api/design', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = JSON.parse(await readBody(req)) as {
            provider: 'claude' | 'openai' | 'gemini';
            apiKey: string;
            companyName: string;
            productCategory: string;
            productDescription: string;
            pId: string;
            pLabel: string;
            promptText: string;
          };
          const { provider, apiKey, companyName, productCategory, productDescription, pId, pLabel, promptText } = body;
          if (!apiKey) throw new Error('APIキーが必要です');
          if (!promptText) throw new Error('プロンプト文が必要です');
          const result = await callDesignApi(provider, apiKey, companyName, productCategory, productDescription, pId, pLabel, promptText);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });

      server.middlewares.use('/api/classify', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

        try {
          const body = JSON.parse(await readBody(req)) as {
            provider: 'claude' | 'openai' | 'gemini';
            apiKey: string;
            entries: Array<{ id: string; promptId: string; output: string }>;
          };
          const { provider, apiKey, entries } = body;

          if (!apiKey) throw new Error('APIキーが必要です');
          if (!entries?.length) throw new Error('エントリが空です');

          let result: { results?: unknown[] } | null = null;
          if (provider === 'openai') result = await callOpenAiApi(apiKey, entries);
          else if (provider === 'gemini') result = await callGeminiApi(apiKey, entries);
          else result = await callClaudeApi(apiKey, entries);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, results: result?.results ?? result }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
})
