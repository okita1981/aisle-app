import type { IncomingMessage, ServerResponse } from 'node:http';

// ── ヘルパー ──────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** サーバー環境変数を優先し、未設定の場合はクライアント送信キーにフォールバック */
function getApiKey(provider: string, bodyKey?: string): string {
  const envKey =
    provider === 'claude'  ? process.env.ANTHROPIC_API_KEY :
    provider === 'openai'  ? process.env.OPENAI_API_KEY    :
    /* gemini */              process.env.GEMINI_API_KEY;
  return envKey || bodyKey || '';
}

// ── システムプロンプト ────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたはAisle出力構造分析エンジンです。
GPT/AI出力ログを以下の定義に厳密に基づいて分類してください。

【C-ID定義（出力意味特徴の補助特徴量）— 最も主要な1つを選択】
C-IDは「GPTが何を理由にその出力を語ったか」を観測するための補助特徴量です。
K-ID/E-ID導出の前段として使用します。C-01〜C-06の6分類を使用してください。

C-01 信頼形成型: 実績・第三者評価・専門性・出典などを根拠として信頼を形成する意味特徴。例：「多くの企業で導入実績があります」「専門家からも評価されています」
C-02 比較評価型: 他社比較・差別化・選定理由など、相対評価を通じて推薦や理解を行う意味特徴。例：「従来のSEOとは異なり〜」「〇〇という点で優れています」
C-03 構造理解型: 概念整理・情報整理・体系化によって、GPTが理解・説明しやすい状態を作る意味特徴。例：「〇〇とは〜を指します」「主に3つの特徴があります」
C-04 世界観共鳴型: 理念・思想・ストーリー・社会課題など、価値観や共感を通じて理解を形成する意味特徴。例：「AI時代の新しい在り方として〜」「マーケティングの構造そのものを変える」
C-05 利用文脈型: 誰が・いつ・どのように使うかを通じて商材理解を形成する意味特徴。例：「自社が出てこない企業向けに〜」「マーケティング責任者が〜」
C-06 話題性・先進性型: 話題・認知・未来価値・革新性など、今注目される理由を形成する意味特徴。例：「今注目されている企業として〜」「次世代マーケティングとして〜」

※ C-07〜C-10は廃止済みです。使用しないでください。

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

【K-ID定義（appeared=false のエントリのみ付与）】
K-IDは「なぜ自社商材がGPT空間に出現できなかったか」の構造的敗因ラベルです。
各エントリの appeared フラグを参照し、appeared=false のエントリにのみ kIds を付与してください（最大3件）。
appeared=true のエントリは必ず kIds=[] にしてください。

K-01 意味競合: 競合他社・サービスが代替候補または比較対象として出現し、自社が押し出された
K-02 主語構造競合: 競合他社が主語の位置を占有し、自社が主語になれない構文になっている
K-03 出典競合: 競合が媒体掲載・ランキング・業界レポートなどの信頼できる出典として引用された
K-04 構文的上位互換: 競合がカテゴリ名・上位概念として出現し、自社がカテゴリに吸収された（例：「〜ツール」として括られた）
K-05 情報飽和競合: 同一問い文脈に同種の競合エンティティが集中し、自社が入る余地がない
K-06 プロンプト整合度競合: 問いの粒度・表現と自社の意味構造が整合せず、競合だけが整合している
K-07 外部要因量的優位: 競合がSNS・被リンク・UGC・メディア掲載など外部シグナルで物量的に優勢
K-08 対象粒度不一致: 問いが求める粒度（会社/ツール/概念）と実際に出現したエンティティの粒度が不一致
K-09 FAQ・定義構文誤競合: 「〜とは」等の定義・FAQ文脈に吸収され、個別エンティティとして出現できない
K-10 出現対象誤認競合: AIが商材を別カテゴリ・別概念として誤認識し、誤った文脈で出現している

K-ID判定指針:

【各K-IDをいつ選ぶか】
K-01（意味競合）: 出力に競合他社・競合サービスが「代替候補」または「比較対象」として名指しで登場し、自社が押し出されている場合に選ぶ。単に競合が言及されているだけでは不十分—自社の代わりに競合が推薦・提案されている構造が必要。
K-03（出典競合）: 競合が業界レポート・ランキング・調査データ・メディア掲載などの「信頼できる出典」として引用され、その出典信頼性が自社との差を生んでいる場合に選ぶ。競合の名前が出るだけでなく「出典付きで優位性が示されている」ことが条件。
K-04（構文的上位互換）: 競合がカテゴリ名・上位概念として出現し、自社がそのカテゴリに包含・吸収された形で出現不能になっている場合。例：「〜ツールといえば〇〇」という構文で自社がカテゴリの一員として埋もれる。
K-05（情報飽和競合）: 同一問い文脈に同種の競合エンティティが3件以上集中し、「枠が埋まって自社が入れない」状態。K-01（特定競合による押し出し）ではなく、候補群の飽和によって排除されている構造。
K-07（外部要因量的優位）: 競合がSNS言及・被リンク・UGC・メディア露出などの「外部シグナルの物量」で優位に立ち、それが出現差の主因になっている場合。出典の「質」よりも「量・頻度」が差を作っている。
K-08（対象粒度不一致）: 問いが求める粒度（例：特定企業名）と実際に出現したエンティティの粒度（例：ツールカテゴリ・概念）がずれている場合。自社vs競合の問題ではなく、「問いと出力の対象レベルが合っていない」構造的問題。
K-09（FAQ・定義構文誤競合）: 「〜とは」「〜の仕組み」等の定義・FAQ文脈が支配的で、個別エンティティ（特定企業・商材）として出現できない場合。概念説明が主体で固有名詞が登場しにくい構文になっている。
K-10（出現対象誤認競合）: AIが自社商材を別カテゴリ・別概念・別業種として誤認識し、問いとずれた文脈で出現している（または出現すべき文脈で出現できない）場合。

【排他条件（優先判定ルール）】
K-01 vs K-05: 特定の競合1〜2社が代替候補として名指しされている → K-01。同種候補が3件以上並列して枠を埋めている → K-05。両方の性質がある場合は支配的な方を1番目に。
K-03 vs K-07: 競合の「出典の質（業界レポート・公的統計・権威メディア）」が差を作っている → K-03。競合の「外部シグナルの量・頻度（SNS・UGC・一般メディア）」が差を作っている → K-07。
K-04 vs K-09: 競合がカテゴリ代表として上位概念を占有している → K-04。定義・FAQ文脈が主体で個別エンティティ自体が出現しにくい → K-09。K-04は「競合がカテゴリを独占」、K-09は「カテゴリ・概念の定義が支配的」。
K-08 vs K-10: 問いと出力の粒度レベルがずれている（企業を聞いたのに概念が返る等）→ K-08。AIが商材の分類・カテゴリを誤認識している → K-10。

- 複数該当する場合は重要度が高い順に最大3件付与（最も支配的な敗因を1番目に、以降は補助的要因の順）

【出力形式（必ずこのJSONのみ返す）】
{"results": [
  {"id": "1", "cId": "C-01", "aId": "A-05", "apId": "", "sourceCategory": "レビューサイト", "kIds": ["K-01", "K-05"], "kIdReasons": {"K-01": "競合サービスが比較候補として明示されているため", "K-05": "同カテゴリ候補が3件以上出現し枠を埋めているため"}},
  {"id": "2", "cId": "C-03", "aId": "A-02", "apId": "", "sourceCategory": "公式サイト", "kIds": [], "kIdReasons": {}},
  ...
]}

ルール:
- 全件必ず返すこと（件数を省略しない）
- cId: C-01〜C-06のうち最も主要な意味特徴の1つのみ（C-07〜C-10は使用不可）
- aId: A-01〜A-10のうち最も支配的な主語構造1つのみ
- apId: aIdがA-10のときのみAP-01〜AP-05、それ以外は必ず""（空文字）
- sourceCategory: 優先順位の高いカテゴリを1つのみ
- kIds: appeared=falseのとき重要度の高い順に最大3件のK-IDリスト（先頭が最も支配的な敗因）、appeared=trueのとき必ず[]。kIdsの選択を先に確定させ、その後にkIdReasonsを生成すること
- kIdReasons: kIdsで選択した各K-IDに対して選択理由を1文で記述する（appeared=trueのとき{}）
- JSONのみ返す（説明文・前置き不要）`;

// ── API呼び出し ──────────────────────────────────────────────────────

type Entry = { id: string; promptId: string; output: string; appeared?: boolean };

function buildUserPrompt(entries: Entry[]): string {
  const list = entries.map(e =>
    `<entry id="${e.id}" promptId="${e.promptId}" appeared="${e.appeared === true ? 'true' : 'false'}">\n${e.output}\n</entry>`
  ).join('\n');
  return `以下のGPT出力ログ${entries.length}件を分類してください。appeared="false"のエントリにはkIdsを付与してください。\n\n${list}\n\nJSONで全${entries.length}件を返してください。`;
}

async function callClaudeApi(apiKey: string, entries: Entry[]) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0,
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

async function callOpenAiApi(apiKey: string, entries: Entry[]) {
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
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

async function callGeminiApi(apiKey: string, entries: Entry[]) {
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

// ── ハンドラ ─────────────────────────────────────────────────────────

// ── classify-pid 用プロンプト（旧 classify-pid.ts から統合） ──────────

const CLASSIFY_PID_PROMPT = `以下の問いをP-01〜P-06に分類してください。

P-01：選定・相談型（どうすればいい？どこに頼む？）
P-02：比較・評価型（何が違う？どっちがいい？）
P-03：ランキング期待型（今注目は？人気は？）
P-04：課題解決・提案型（課題を解決したい・提案したい）
P-05：出典付き引用期待型（根拠・データ・出典が欲しい）
P-06：推薦理由深掘り型（なぜ？理由・背景を知りたい）

最も強いP-IDを1つ（primary）、補助P-IDを最大2つ（secondary）、判定理由（reason）をJSONで返してください。

JSONのみ返し、前後の説明は不要です。`;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const body = JSON.parse(await readBody(req)) as {
      provider?: 'claude' | 'openai' | 'gemini';
      apiKey?: string;
      entries?: Entry[];
      promptText?: string;   // classify-pid モード用
    };

    // ── classify-pid モード：promptText のみ渡された場合 ──────────────
    if (body.promptText && !body.entries?.length) {
      const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です');

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          temperature: 0,
          system: CLASSIFY_PID_PROMPT,
          messages: [{ role: 'user', content: body.promptText }],
        }),
      });
      const data = await resp.json() as {
        content?: Array<{ text: string }>;
        error?: { message: string };
      };
      if (!resp.ok) throw new Error(data.error?.message ?? `Claude API error ${resp.status}`);
      const text = (data.content?.[0]?.text ?? '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSONを取得できませんでした');
      const parsed = JSON.parse(match[0]) as {
        primary?: string; secondary?: string[]; reason?: string;
      };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: true,
        primary: parsed.primary ?? 'P-01',
        secondary: Array.isArray(parsed.secondary) ? parsed.secondary : [],
        reason: parsed.reason ?? '',
      }));
      return;
    }

    // ── 通常の classify モード ────────────────────────────────────────
    const { provider = 'claude', apiKey: bodyApiKey, entries } = body;
    const apiKey = getApiKey(provider, bodyApiKey);

    if (!apiKey) throw new Error(`APIキーが未設定です（provider: ${provider}）`);
    if (!entries?.length) throw new Error('エントリが空です');

    let result: { results?: unknown[] } | null = null;
    if (provider === 'openai')     result = await callOpenAiApi(apiKey, entries);
    else if (provider === 'gemini') result = await callGeminiApi(apiKey, entries);
    else                            result = await callClaudeApi(apiKey, entries);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, results: result?.results ?? result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
