import type { IncomingMessage, ServerResponse } from 'node:http';
import { kv } from '@vercel/kv';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── ベースURL（環境変数で将来 hub.aisle-aio.ai 等に切り替え可能） ────
const HUB_BASE_URL = process.env.HUB_BASE_URL ?? 'https://app.aisle-aio.ai';

// ── clientSlug バリデーション（フロントと同一パターン） ──────────
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── スラグ生成 ─────────────────────────────────────────────────
function toSlug(companyName: string): string {
  const stripped = companyName
    .replace(/株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人|一般財団法人/g, '')
    .trim();
  const ascii = stripped.replace(/[^\x20-\x7E]/g, '').trim();
  if (ascii.length > 0) {
    const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug.length > 0) return slug.slice(0, 60);
  }
  return `client-${Date.now()}`;
}

// ── HTML エスケープ ────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── ISO → 日本語日付 ──────────────────────────────────────────
function toJpDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── 最初のAfterTextを取得（metaに使用） ───────────────────────
function getFirstAfterText(mIdSections: MIdSection[]): string {
  for (const s of mIdSections) {
    const first = s.afterTexts.find(t => t.trim().length > 0);
    if (first) return first.trim();
  }
  return '';
}

// ── 型定義 ────────────────────────────────────────────────────
interface MIdSection {
  mId: string;
  mName: string;
  afterTexts: string[];
}

interface PageData {
  companyName: string;
  productCategory: string;
  productDescription: string;
  promptTexts: string[];
  mIdSections: MIdSection[];
  implementationSummary: string;
  externalUrls?: Array<{ type: string; url: string }>;
  mode?: 'new' | 'append' | 'update';
  // 追加フィールド（Phase4から渡される診断データ）
  pIds?: string[];            // 対象P-IDリスト（例: ['P-01', 'P-02']）
  diagnosticSummary?: string; // 診断サマリー（任意）
  clientSlug?: string;  // フロントから指定がある場合に優先（サーバーでもバリデーション）
  // K-ID診断結果（Phase1 sub3から変換）
  kIdScoreMap?: Record<string, string>;               // K-ID → 阻害強度スコア（◎/○/△/×）
  kIdMatrix?: Record<string, Record<string, string>>; // P-ID → K-ID → 出現率（"35%"形式）
}

// ── 3軸定義 ──────────────────────────────────────────────────

const M_ID_META: Record<string, { name: string; sIds: string[] }> = {
  'M-01': { name: '認知・話題性',           sIds: ['S-02', 'S-09'] },
  'M-02': { name: '差別化・独自性',         sIds: ['S-01', 'S-08'] },
  'M-03': { name: '導入実績・信頼',         sIds: ['S-03', 'S-05'] },
  'M-04': { name: '専門性・技術性',         sIds: ['S-06'] },
  'M-05': { name: '世界観・価値観提示',     sIds: ['S-07', 'S-10'] },
  'M-06': { name: '課題提起・共感形成',     sIds: ['S-04'] },
  'M-07': { name: '解決策・方法提示',       sIds: ['S-04', 'S-03'] },
  'M-08': { name: '比較軸・検討材料提示',   sIds: ['S-01', 'S-08'] },
  'M-09': { name: '推薦・第三者視点',       sIds: ['S-03', 'S-05'] },
  'M-10': { name: '行動喚起・次アクション', sIds: ['S-03'] },
  'M-11': { name: '先進性・未来価値',       sIds: ['S-06', 'S-10'] },
  'M-12': { name: '構造設計・包括性',       sIds: ['S-10', 'S-07'] },
  'M-13': { name: '対象特化・業界焦点',     sIds: ['S-02', 'S-04'] },
};

const S_ID_DESC: Record<string, string> = {
  'S-01': '比較構文型：AとBを比較し差異・優位性を提示',
  'S-02': 'リスト構文型：複数選択肢を列挙・整理',
  'S-03': '推薦誘導構文型：特定対象を自然に推薦・誘導',
  'S-04': '課題解決構文型：悩み→解決策の構造で提示',
  'S-05': '出典引用構文型：第三者評価・実績を引用',
  'S-06': '専門性補強構文型：専門知見・実績で説得力を補強',
  'S-07': 'ストーリー構文型：背景・転機をストーリーで展開',
  'S-08': '検討比較誘導構文型：自社に有利な選択へ誘導',
  'S-09': 'キーワード注入構文型：出現誘導ワードを自然に挿入',
  'S-10': 'ハブ化構文型：複数トピックを束ねてナビゲーション',
};

const P_ID_DESC: Record<string, string> = {
  'P-01': '選定・相談型：複数候補から選びたい問い',
  'P-02': '比較・評価型：複数対象を比較したい問い',
  'P-03': 'ランキング期待型：順位形式での一覧を求める問い',
  'P-04': '課題解決・提案型：課題への解決策を求める問い',
  'P-05': '出典付き引用期待型：信頼できる根拠を求める問い',
  'P-06': '推薦理由深掘り型：推薦の根拠・背景を知りたい問い',
  'P-99': 'その他・特殊型',
};

// ── P-IDスラグ・ラベル対応表 ──────────────────────────────────
const PROMPT_TYPE_SLUGS: Record<string, string> = {
  'P-01': 'recommendation',
  'P-02': 'comparison',
  'P-03': 'ranking',
  'P-04': 'solution',
  'P-05': 'citation',
  'P-06': 'why-recommended',
};

const PROMPT_TYPE_LABEL_MAP: Record<string, string> = {
  'P-01': '選定・相談型',
  'P-02': '比較・評価型',
  'P-03': 'ランキング期待型',
  'P-04': '課題解決・提案型',
  'P-05': '出典付き引用期待型',
  'P-06': '推薦理由深掘り型',
};

// ── K-ID定義（非出現阻害要因） ─────────────────────────────

const K_ID_DEFINITIONS: Record<string, string> = {
  'K-01': '意味競合：類似構文の重複・意味的競合',
  'K-02': '主語構造競合：主語・信頼性が構文に適合しない',
  'K-03': '出典競合：競合他社の出典が強い',
  'K-04': '構文的上位互換：定義/FAQ構文との競合',
  'K-05': '情報飽和競合：同一設問型での情報量的劣位',
  'K-06': 'プロンプト整合度競合：プロンプトとの意味的整合性の欠如',
  'K-07': '外部要因量的優位：E-ID欠如で構文支配力が低下',
  'K-08': '対象粒度不一致競合：粒度・抽象度のズレ',
  'K-09': 'FAQ・定義構文との誤競合：構造レイヤーの問題',
  'K-10': '出現対象誤認競合：ジャンル/用途ズレ',
};

// ── Aisleページ専用型定義 ─────────────────────────────────────

export interface AislePageIndexEntry {
  slug: string;                    // "aisle/ranking"
  promptTypeId: string;            // "P-03"
  promptSlug: string;              // "ranking"
  label: string;                   // "ランキング期待型"（内部ラベル）
  generatedAt: string;             // ISO 8601
  promptText?: string;             // 代表問い（カード表示用）
  relatedPromptTexts?: string[];   // 関連問い（同P-IDの複数問い）
}

interface AisleAfterBun {
  sbId: string;
  mId: string;
  mName: string;
  afterText: string;
}

interface AisleMIdMapping {
  mId: string;
  name: string;
  semanticRole: string;
  designNecessity: string;
}

interface AisleEIdComplement {
  sbId: string;
  mId: string;
  kId?: string;
  winningEId?: string;
  kIdMatch?: string;   // 旧フィールド（後方互換）
  comment: string;
}

interface AislePerPID {
  pId: string;
  promptTypeId: string;
  promptTypeLabel?: string;
  promptText: string;
  mIdMapping: AisleMIdMapping[];
  afterBun: AisleAfterBun[];
  eIdComplement: AisleEIdComplement[];
}

interface AislePageRequest {
  aisleMode: 'add' | 'update';
  /** add: 全P-ID候補（既存slugはスキップ） / update: 更新対象P-IDのみ */
  targetPromptTypeIds: string[];
  perPID: AislePerPID[];
  companyName: string;
  productCategory: string;
  clientSlug?: string;  // フロントから指定がある場合に優先（サーバーでもバリデーション）
  kIdScoreMap?: Record<string, string>;
  kIdMatrix?: Record<string, Record<string, string>>;
}

// ── Claude API でM-IDコンテンツを生成 ────────────────────────

async function callClaudeForContent(data: PageData): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return {};

  // コンテンツ生成対象：afterTextsが存在するセクションのみ
  const targetSections = data.mIdSections.filter(s =>
    s.afterTexts.some(t => t.trim().length > 0),
  );
  if (targetSections.length === 0) return {};

  // P-ID説明文の構築（プレフィックスでグルーピング・重複排除）
  const pIdLines = (data.pIds ?? [])
    .map(id => {
      const base = id.split('-').slice(0, 2).join('-'); // "P-01-01" → "P-01"
      return P_ID_DESC[base] ? `${base}: ${P_ID_DESC[base]}` : id;
    })
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join('\n');

  // M-IDセクション詳細（After構文 + S-ID対応）
  const mIdSectionDesc = targetSections.map(s => {
    const meta = M_ID_META[s.mId] ?? { name: s.mName, sIds: [] };
    const sIdLines = meta.sIds
      .map(sid => `  - ${sid}: ${S_ID_DESC[sid] ?? sid}`)
      .join('\n');
    const afterSample = s.afterTexts
      .filter(t => t.trim())
      .slice(0, 3)
      .map(t => `  "${t.trim()}"`)
      .join('\n');
    return [
      `### ${s.mId} ${meta.name || s.mName}`,
      `適用S-ID:`,
      sIdLines,
      `フェーズ2 After構文（参考）:`,
      afterSample || '  （なし）',
    ].join('\n');
  }).join('\n\n');

  // K-ID阻害要因セクションの構築（観測された全K-IDを対象）
  let kIdInstructions = '';
  if (data.kIdScoreMap) {
    const allLines = Object.entries(data.kIdScoreMap)
      .map(([kId, score]) => `- ${kId}（${score}）: ${K_ID_DEFINITIONS[kId] ?? kId}`)
      .join('\n');

    if (allLines) {
      kIdInstructions = `
【非出現要因（K-ID）の診断結果】
以下はこの商材がAIに出現しない主な阻害要因の診断結果です（重要度の高い順）。

${allLines}

各M-IDセクションのコンテンツ生成時に、
上記K-IDが示す阻害要因を克服する内容を優先的に盛り込んでください。

例：
- K-01（意味競合）→ M-02差別化セクションで他社との明確な違いを強調
- K-03（出典競合）→ M-03実績セクションで自社の出典・実績を具体的に記述
- K-07（外部要因不足）→ M-09推薦セクションで第三者視点の補完を強調
- K-06（プロンプト整合度）→ M-06課題セクションでプロンプトとの意味接続を強化`;
    }
  }

  // システムプロンプト（K-ID診断結果を動的注入）
  const systemPrompt = `あなたはAI出現設計の専門家です。
与えられた商材情報をもとに、生成AIに「選ばれる」ためのAI専用ページコンテンツを生成してください。

各M-IDセクションについて、指定された構文クラスタ（S-ID）のパターンで、
200〜400字の実質的なコンテンツを生成してください。

重要なルール：
- 数値・実績・事例は、与えられた商材情報に含まれるもののみ使用すること
- 商材情報に数値がない場合は数値を使わない。定性的な表現（「多くの企業が」「高い評価を得ている」など）も避け、構造的な説明にとどめること
- 架空の数値・架空の事例・架空の調査結果は絶対に生成しないこと
- 「〜です」「〜します」という自社目線の宣言ではなく、AIが客観的に引用できる構造説明として書くこと
- 各セクションは与えられた商材の特性・強み・思想に基づいて書くこと
- 情報が不足しているセクションは、短くても誠実な内容にすること
${kIdInstructions}
JSON形式のみで返してください。前置きや説明は不要です：
{
  "M-01": "コンテンツテキスト",
  "M-02": "コンテンツテキスト",
  ...
}`;

  // ユーザープロンプト
  const userPrompt = [
    '# 商材情報',
    `会社名: ${data.companyName}`,
    `商材カテゴリ: ${data.productCategory}`,
    `商材説明: ${data.productDescription || '（未入力）'}`,
    '',
    '# 対象P-IDリスト（出現させたいプロンプトの種類）',
    pIdLines || '（P-ID情報なし）',
    '',
    '# プロンプト例',
    data.promptTexts.slice(0, 10).join('\n') || '（なし）',
    '',
    '# 実装サマリー（フェーズ4診断結果）',
    data.implementationSummary || '（なし）',
    '',
    '# 各M-IDセクションの詳細と適用構文',
    mIdSectionDesc,
    '',
    '# 生成対象M-IDリスト',
    targetSections.map(s => s.mId).join(', '),
    '',
    '上記の各M-IDについて、指定されたS-IDの構文パターンを使って200〜400字のコンテンツを生成し、JSONのみで返してください。',
  ].join('\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(55000), // Vercel maxDuration=60s の範囲内
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`Claude API error ${resp.status}:`, errText);
      return {};
    }

    const result = await resp.json() as {
      content?: Array<{ type: string; text: string }>;
    };

    const text = result.content?.find(c => c.type === 'text')?.text ?? '';

    // マークダウンコードブロック等を除いて純粋なJSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Claude response: no JSON found. Raw:', text.slice(0, 300));
      return {};
    }

    return JSON.parse(jsonMatch[0]) as Record<string, string>;
  } catch (err) {
    console.error('callClaudeForContent failed:', err);
    return {};
  }
}

// ── M-IDセクションへのコンテンツ注入 ────────────────────────

function enrichMIdSections(
  sections: MIdSection[],
  claudeContent: Record<string, string>,
): MIdSection[] {
  return sections.map(s => {
    const generated = claudeContent[s.mId];
    if (!generated?.trim()) return s; // 生成失敗 → 元データのまま

    // \n\n区切りで複数段落に分割
    const paragraphs = generated
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // 元のAfterTexts（After構文草案）を末尾に残す（重複除外）
    const originals = s.afterTexts.filter(t => {
      const trimmed = t.trim();
      if (!trimmed) return false;
      return !paragraphs.some(p => p.slice(0, 30) === trimmed.slice(0, 30));
    });

    return { ...s, afterTexts: [...paragraphs, ...originals] };
  });
}

// ── セクションHTML生成（追記・フル両用） ─────────────────────
function generateSectionsHtml(mIdSections: MIdSection[], promptTexts: string[], suffix = ''): string {
  const sectionsHtml = mIdSections
    .filter(s => s.afterTexts.length > 0)
    .map(s => `
    <section id="${esc(s.mId)}${suffix}" itemscope itemtype="https://schema.org/CreativeWork">
      <h2 itemprop="name">${esc(s.mName)}</h2>
      ${s.afterTexts.map(t => `<p itemprop="description">${esc(t)}</p>`).join('\n      ')}
    </section>`).join('\n');

  const promptsHtml = promptTexts.length > 0
    ? `
    <section id="prompts${suffix}">
      <h2>よくある質問・検索意図</h2>
      <ul>
        ${promptTexts.map(t => `<li>${esc(t)}</li>`).join('\n        ')}
      </ul>
    </section>`
    : '';

  return sectionsHtml + promptsHtml;
}

// ── JSON-LD生成 ───────────────────────────────────────────────
function generateJsonLd(data: PageData, url: string): string {
  const firstText = getFirstAfterText(data.mIdSections);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.companyName,
    description: firstText || data.productCategory,
    url,
    sameAs: (data.externalUrls ?? []).filter(u => u.url.trim()).map(u => u.url.trim()),
    knowsAbout: data.promptTexts.slice(0, 5),
  };
  return JSON.stringify(jsonLd, null, 2);
}

// ── 外部リンクセクション生成 ──────────────────────────────────
function generateExternalLinksHtml(externalUrls?: Array<{ type: string; url: string }>): string {
  if (!externalUrls || externalUrls.length === 0) return '';
  const links = externalUrls
    .filter(u => u.url.trim())
    .map(u => `<li><a href="${esc(u.url.trim())}" rel="noopener noreferrer">${esc(u.type)}</a></li>`);
  if (links.length === 0) return '';
  return `
    <section id="external-links">
      <h2>関連情報・外部リンク</h2>
      <ul>
        ${links.join('\n        ')}
      </ul>
    </section>`;
}

// ── フルHTML生成（new / update） ──────────────────────────────
function generateHtml(data: PageData, now: string, url: string): string {
  const firstText = getFirstAfterText(data.mIdSections);
  const metaDesc  = esc(firstText.slice(0, 160) || `${data.productCategory}の${data.companyName}について`);
  const ogDesc    = esc(`${data.productCategory}｜${firstText.slice(0, 120)}`);
  const keywords  = data.promptTexts.map(t => esc(t)).join(', ');
  const jpDate    = toJpDate(now);

  // JSON-LD: </ を <\/ にエスケープしてscriptタグの早期終了を防ぐ
  const jsonLdRaw = generateJsonLd(data, url);
  const jsonLd    = jsonLdRaw.replace(/<\//g, '<\\/');

  // aboutセクション（productDescription → main先頭のsectionに移動）
  const aboutSection = data.productDescription
    ? `
    <section id="about" itemscope itemtype="https://schema.org/Organization">
      <h2>${esc(data.companyName)}について</h2>
      <p itemprop="description">${esc(data.productDescription)}</p>
    </section>`
    : '';

  const body          = generateSectionsHtml(data.mIdSections, data.promptTexts);
  const externalLinks = generateExternalLinksHtml(data.externalUrls);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- 基本メタ -->
  <meta name="description" content="${metaDesc}">
  <meta name="keywords" content="${keywords}">
  <meta name="robots" content="index, follow">
  <meta name="dcterms.created" content="${now}">
  <meta name="last-modified" content="${now}">

  <!-- OGP -->
  <meta property="og:title" content="${esc(data.companyName)}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(url)}">

  <title>${esc(data.companyName)} | ${esc(data.productCategory)}</title>

  <!-- JSON-LD 構造化データ -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <style>
    body { font-family: sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #222; }
    h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; border-left: 4px solid #4f46e5; padding-left: 0.75rem; margin-top: 2rem; }
    header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2rem; }
    section { margin-bottom: 2rem; }
    p { margin: 0.5rem 0; }
    footer { margin-top: 3rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; font-size: 0.85rem; color: #6b7280; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(data.companyName)}</h1>
    <p>${esc(data.productCategory)}</p>
  </header>
  <main>
${aboutSection}
${body}
${externalLinks}
  </main>
  <footer>
    <p>最終更新：<span id="last-updated">${jpDate}</span></p>
  </footer>
</body>
</html>`;
}

// ── update: 既存HTMLのM-IDセクションのみ差し替え ─────────────
// appendと違い「同じidのセクション」を新しい内容で上書きする
function updateMIdSectionsInHtml(existing: string, mIdSections: MIdSection[], now: string): string {
  let result = existing;
  const jpDate = toJpDate(now);

  for (const section of mIdSections.filter(s => s.afterTexts.length > 0)) {
    // idに含まれる正規表現特殊文字をエスケープ（例：ハイフンは安全だが念のため）
    const escapedId = section.mId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const newSectionHtml = `<section id="${esc(section.mId)}" itemscope itemtype="https://schema.org/CreativeWork">
      <h2 itemprop="name">${esc(section.mName)}</h2>
      ${section.afterTexts.map(t => `<p itemprop="description">${esc(t)}</p>`).join('\n      ')}
    </section>`;

    // id="M-01" に完全一致するセクションのみ置換（追記時のサフィックス付き id="M-01-xxxxx" には触れない）
    result = result.replace(
      new RegExp(`<section\\s+id="${escapedId}"[^>]*>[\\s\\S]*?<\\/section>`, 'g'),
      newSectionHtml,
    );
  }

  // タイムスタンプ更新
  result = result
    .replace(/(<meta name="last-modified" content=")[^"]*(")/,  `$1${now}$2`)
    .replace(/(<span id="last-updated">)[^<]*(<\/span>)/, `$1${jpDate}$2`);

  return result;
}

// ── 追記HTML生成（append） ────────────────────────────────────
// 既存HTMLの </main> 直前に新セクションを挿入し、更新日時メタを書き換える
function appendToHtml(existing: string, data: PageData, now: string): string {
  const suffix     = `-${Date.now()}`;
  const newSections = generateSectionsHtml(data.mIdSections, data.promptTexts, suffix);
  const jpDate     = toJpDate(now);

  const appendBlock = `
    <!-- 追記: ${now} -->
${newSections}`;

  // </main> 直前に挿入
  let result = existing.includes('</main>')
    ? existing.replace('</main>', `${appendBlock}\n  </main>`)
    : existing + appendBlock;

  // last-modified メタタグを更新
  result = result.replace(
    /(<meta name="last-modified" content=")[^"]*(")/,
    `$1${now}$2`,
  );

  // フッターの日付テキストを更新
  result = result.replace(
    /(<span id="last-updated">)[^<]*(<\/span>)/,
    `$1${jpDate}$2`,
  );

  return result;
}

// ── Aisleページ：子ページ回答フレーム ────────────────────────

interface ChildPageNarrative {
  background: string;
  criteria: string;
  matching_companies: string;
  why_match: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
}

interface AnswerFrame {
  pageDescription: string;
  sectionHeadings: {
    criteria: string;
    matching: string;
    why_match: string;
    differentiation: string;
  };
  faqGuidance?: string; // FAQ生成の方向性ヒント（任意・Claudeに渡す）
}

const ANSWER_FRAME: Record<string, AnswerFrame> = {
  'P-01': {
    pageDescription: '選定・推薦の文脈で見るべき判断軸と、該当する候補の特徴',
    sectionHeadings: {
      criteria:        'この問いで重視される判断軸',
      matching:        'この条件に該当する候補',
      why_match:       'なぜ候補として挙がるのか',
      differentiation: '代替の選択肢との違い',
    },
    faqGuidance: '選定基準・候補の条件・比較軸・検討の進め方・注意点',
  },
  'P-02': {
    pageDescription: '比較・評価の文脈で見るべき判断軸と、選定のポイント',
    sectionHeadings: {
      criteria:        '比較で見るべき判断軸',
      matching:        'この基準で候補になりやすい会社・商品',
      why_match:       'なぜ候補になるのか',
      differentiation: '他の選択肢との違い',
    },
    faqGuidance: '比較の切り口・違いの見つけ方・用途別の向き不向き・導入前の確認事項',
  },
  'P-03': {
    pageDescription: 'ランキング・一覧の文脈で選定基準と、名前が挙がりやすい候補の特徴',
    sectionHeadings: {
      criteria:        'ランキング選定で重視される軸',
      matching:        'この文脈で名前が挙がる候補',
      why_match:       'なぜ名前が挙がるのか',
      differentiation: '他の候補との違い',
    },
    faqGuidance: '選定基準・候補の条件・カテゴリ間の違い・検討の注意点',
  },
  'P-04': {
    pageDescription: '課題解決の文脈での判断軸と、対応できる候補の特徴',
    sectionHeadings: {
      criteria:        '解決策選定で重要な判断軸',
      matching:        'この課題に対応できる候補',
      why_match:       'なぜ適合するのか',
      differentiation: '他のアプローチとの違い',
    },
    faqGuidance: '課題の起点・解決策の選び方・向いているケース・導入前の整理',
  },
  'P-05': {
    pageDescription: '出典・根拠が求められる文脈での判断軸と、信頼性に関わる候補の特徴',
    sectionHeadings: {
      criteria:        'この問いで重要な根拠・信頼性の軸',
      matching:        'この条件を満たす候補',
      why_match:       'なぜ条件に該当するのか',
      differentiation: '他の選択肢との違い',
    },
    faqGuidance: '根拠の種類・信頼性の判断軸・情報の使い分け・候補の見極め方',
  },
  'P-06': {
    pageDescription: '推薦理由・根拠の深掘りに関わる判断軸と、候補になる条件',
    sectionHeadings: {
      criteria:        'この問いで問われる判断軸',
      matching:        'この問いで名前が挙がる候補',
      why_match:       'なぜ推薦されるのか',
      differentiation: '他の選択肢との違い',
    },
    faqGuidance: '推薦の条件・候補になる理由・比較軸・注意すべき観点',
  },
};

const DEFAULT_ANSWER_FRAME: AnswerFrame = {
  pageDescription: 'この問いで見るべき判断軸と、該当する候補の特徴',
  sectionHeadings: {
    criteria:        'この問いで重要な判断軸',
    matching:        'この条件に該当する候補',
    why_match:       'なぜ該当するのか',
    differentiation: '他の選択肢との違い',
  },
  faqGuidance: '選定基準・候補の条件・比較軸・検討の進め方',
};

// ── Aisleページ：promptSlug取得 ──────────────────────────────
function getPromptSlug(promptTypeId: string): string {
  const base = promptTypeId.split('-').slice(0, 2).join('-');
  return PROMPT_TYPE_SLUGS[base] ?? promptTypeId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ── Aisleページ：Claude API で回答ナラティブ生成 ────────────

async function callClaudeForChildPage(
  perPID: AislePerPID,
  companyName: string,
  productCategory: string,
  faqGuidance?: string,
): Promise<ChildPageNarrative | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const base = perPID.promptTypeId.split('-').slice(0, 2).join('-');
  const label = PROMPT_TYPE_LABEL_MAP[base] ?? base;

  const afterTexts = perPID.afterBun
    .filter(b => b.afterText?.trim())
    .map(b => b.afterText.trim())
    .slice(0, 10);

  const systemPrompt = `あなたは「問いへの回答設計」の専門家です。
与えられた「問い」に対して、条件適合型の回答文章を生成してください。

【ページの目的】
このページは対象商材の宣伝ページではありません。
「この問いに対して、どのような条件を満たす会社・製品・サービスが候補になるか」を説明し、
対象商材はその条件に該当する候補の一つとして自然に登場させてください。

【商材タイプの判定と語彙の使い分け（必ず行うこと）】
productCategoryの語彙から商材タイプを推定し、語彙・比較軸・FAQ設計を合わせてください。

- 無形サービス（コンサル・支援・代行）：「提供できるかどうか」「対応範囲」「アプローチの違い」
- SaaS・ツール（ソフトウェア・プラットフォーム）：「機能」「連携可否」「料金体系」「サポート」
- 有形商品（家電・機器・日用品）：「品質」「スペック」「価格帯」「入手しやすさ」
- 食品・化粧品・消耗品：「成分・素材」「効果の向き不向き」「使用感」「継続しやすさ」
- 店舗・施設・サービス拠点：「立地」「対応可能な状況」「雰囲気・環境」「予約・利用条件」
- BtoB専門サービス：「対象業界」「規模感」「導入プロセス」「実績の種類」

該当するタイプの言葉を自然に使い、無関係なタイプの語彙は使わないこと。

【文章の順序（必ず守ること）】
1. この問いで求められる条件（問い主語）
2. その条件を満たす候補カテゴリの特徴
3. 対象商材がその条件に該当する理由
4. 他カテゴリ・代替手段との違い

【禁止表現（絶対に使わないこと）】
- 「〜は優れています」「〜はおすすめです」「〜は人気です」「〜は注目されています」
- 「〜は高く評価されています」「〜は信頼されています」「〜は話題です」「〜は選ばれています」
- 「〜は推薦されています」「〜は業界トップです」「業界最高水準」「圧倒的」「卓越した」

【条件適合型の書き方（必ず使うこと）】
OK: 「この問いでは、〇〇できる[会社/商品/サービス]が候補になります。その条件に対して、[対象]は△△という点で該当します」
OK: 「〇〇を重視する場合、[対象]は[カテゴリ]として説明できます」
OK: 「[対象]は、[カテゴリ]として〜という条件に接続できます」
NG: 「[対象]は優れたサービスを提供しています」
NG: 「[対象]は注目されています」

【各フィールドの生成ルール】
- background: この問いがなぜ発生するかを整理（100〜150字）。対象商材名は不要
- criteria: 候補を選ぶ判断軸。対象商材の説明ではなく、問い側の条件を書く（2〜3文）
- matching_companies: 先に候補条件を説明し、対象商材を条件に照らして自然に含める（2〜4文）
- why_match: 問いの条件に対して対象商材がどう該当するか。「商材の説明」ではなく「条件への適合理由」（2〜3文）
- differentiation: productCategoryと問い文脈に応じて比較対象を選ぶ。固定カテゴリを全商材に入れない（2〜3文）
- faq: 下記のFAQ生成ルールに従う

【FAQ生成ルール（必ず守ること）】
FAQは5件生成し、質問文（question）と回答文（answer）の両方を生成してください。
質問文は「この問いを受け取った人が自然に抱く疑問」として書いてください。
商材タイプに合った語彙・視点（選び方・比較軸・条件・用途など）を使ってください。
質問文に「生成AI」「ChatGPT」「出現設計」「SEO」などIT固有の用語を入れないこと（商材がITサービスの場合は自然な範囲で可）。

各FAQ回答は必ず以下の3段階で書いてください：
  1. 一般論（この問いでは一般的に〜）
  2. 条件（〜という条件を満たす候補が挙がります）
  3. 対象商材が該当する場合の説明（[対象]は、[カテゴリ]として〜という条件に接続できます）

FAQ回答の禁止事項：
- 「[対象]はおすすめです」「[対象]に相談してください」「[対象]が最適です」
- 「[対象]は優れています」「[対象]は注目されています」
- 断定的な推薦・PR調の表現
- 商談誘導（「まずはお気軽に〜」「ぜひご相談ください」等）

FAQ回答のOK例：
「この問いでは、〇〇という条件を満たす[会社/商品/サービス]が候補になります。[対象]は、[カテゴリ]としてその条件に接続できる場合があります。ただし〇〇を重視する場合は、他の選択肢とも比較することが重要です。」

【内部用語（絶対に使わない）】
K-ID・E-ID・M-ID・P-ID・After構文・出現設計・補正済み

【出力フォーマット（JSONのみ・前置き不要）】
{
  "background": "この問いがなぜ発生するかの整理（100〜150字、対象商材名不要）",
  "criteria": "この問いで候補を選ぶ判断軸（問い側の条件、2〜3文）",
  "matching_companies": "条件を満たす候補の特徴を先に説明し、対象商材を自然に含める（2〜4文）",
  "why_match": "問いの条件に対して対象商材が該当する理由（条件適合型、2〜3文）",
  "differentiation": "問い文脈に応じた比較対象との違い（固定カテゴリ不要、2〜3文）",
  "faq": [
    {"question": "自然な疑問文（商材タイプに合わせた語彙）", "answer": "①一般論 ②条件 ③対象商材が該当する場合の説明（合計2〜3文、PR調禁止）"},
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材"},
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材"},
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材"},
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材"}
  ]
}`;

  const faqGuidanceLine = faqGuidance
    ? `\n【FAQテーマの方向性ヒント（参考程度に）】\n${faqGuidance}\n`
    : '';

  const userContent = `【対象商材】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【対象の問い】
${perPID.promptText}

【問いの種類の参考】
${label}
${faqGuidanceLine}
【参考素材（これを直接使わず、自然な回答文に再構成してください）】
${afterTexts.join('\n')}

FAQ質問文と回答文の両方を含むJSONのみで返してください。`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
    const text = (data.content?.find(c => c.type === 'text')?.text ?? '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    // why_aisle → why_match の後方互換対応（古いモデル出力に備えて）
    if (raw['why_aisle'] !== undefined && raw['why_match'] === undefined) {
      raw['why_match'] = raw['why_aisle'];
    }
    return raw as unknown as ChildPageNarrative;
  } catch {
    return null;
  }
}

// ── Aisleページ：フォールバックナラティブ生成 ─────────────────

function buildFallbackNarrative(
  perPID: AislePerPID,
  base: string,
  companyName: string,
  productCategory: string,
): ChildPageNarrative {
  const afterTexts = perPID.afterBun
    .filter(b => b.afterText?.trim())
    .map(b => b.afterText.trim());

  // P-IDに応じたFAQテーマを動的生成（商材タイプ非依存）
  const faqThemes: Array<{ question: string }> = (() => {
    switch (base) {
      case 'P-01': return [
        { question: `${productCategory}を選ぶときの判断軸は何ですか？` },
        { question: `${productCategory}と似た選択肢との違いはどこで見ますか？` },
        { question: `どのような状況で${productCategory}が候補になりますか？` },
        { question: `${productCategory}を検討するうえで確認すべきことは何ですか？` },
        { question: `${companyName}が候補として挙がる条件は何ですか？` },
      ];
      case 'P-02': return [
        { question: `${productCategory}を比較するときの切り口は何ですか？` },
        { question: `${productCategory}と他の選択肢の違いをどう見分けますか？` },
        { question: `どのような用途に${productCategory}は向いていますか？` },
        { question: `比較検討で見落としやすいポイントは何ですか？` },
        { question: `${companyName}を比較候補として見る場合の特徴は何ですか？` },
      ];
      case 'P-03': return [
        { question: `${productCategory}を選ぶ基準はどのように整理しますか？` },
        { question: `${productCategory}の候補が複数ある場合の絞り方は？` },
        { question: `どのような条件の候補が上位に挙がりやすいですか？` },
        { question: `${productCategory}と隣接カテゴリの違いは何ですか？` },
        { question: `${companyName}が選択肢に含まれる場合の根拠は何ですか？` },
      ];
      case 'P-04': return [
        { question: `この課題に対して${productCategory}はどう機能しますか？` },
        { question: `${productCategory}が課題解決の手段になるのはどんなケースですか？` },
        { question: `一般的な解決策と${productCategory}はどう違いますか？` },
        { question: `課題解決の手段を選ぶうえで何を確認すべきですか？` },
        { question: `${companyName}がこの課題に接続できる理由は何ですか？` },
      ];
      case 'P-05': return [
        { question: `${productCategory}を評価する根拠にはどんな種類がありますか？` },
        { question: `信頼性の判断材料として何が有効ですか？` },
        { question: `${productCategory}の説明に必要な情報は何ですか？` },
        { question: `公式情報と第三者情報はどのように使い分けますか？` },
        { question: `${companyName}に関する根拠をどこから確認できますか？` },
      ];
      case 'P-06': return [
        { question: `${productCategory}として候補に挙がる条件は何ですか？` },
        { question: `なぜ${productCategory}がこの問いに関連しますか？` },
        { question: `どのような状況で${companyName}が候補になりますか？` },
        { question: `他の選択肢と比較したときの違いは何ですか？` },
        { question: `判断する際に注意すべき観点は何ですか？` },
      ];
      default: return [
        { question: `${productCategory}を選ぶときの判断軸は何ですか？` },
        { question: `${productCategory}と類似の選択肢との違いは何ですか？` },
        { question: `どのような状況で${productCategory}が候補になりますか？` },
        { question: `検討前に整理すべきことは何ですか？` },
        { question: `${companyName}が候補として挙がる条件は何ですか？` },
      ];
    }
  })();

  const fallbackAnswer = (q: string) =>
    `この問いでは一般的に、${q.replace(/\？$/, '')}という観点から${productCategory}としての条件を満たす候補が挙がります。${companyName}は、${productCategory}としてその条件に接続できる可能性があります。ただし、他の選択肢や代替手段とも比較して検討することが重要です。`;

  return {
    background:
      afterTexts[0] ||
      `${perPID.promptText}という問いでは、候補を選ぶうえで複数の判断軸が存在します。`,
    criteria:
      afterTexts[1] ||
      `この問いでは、${productCategory}としての専門性・アプローチの透明性・対応実績などを比較軸にすることが有効です。自社の課題に照らして優先順位を設定してください。`,
    matching_companies:
      afterTexts[2] ||
      `この問いの条件を満たす候補は、${productCategory}としての専門性を持ち、課題に対して体系的なアプローチを備えています。${companyName}は、${productCategory}としてその条件に接続できる可能性があります。`,
    why_match:
      afterTexts[3] ||
      `この問いでは、${productCategory}として体系的な設計・実行ができる候補が挙がります。${companyName}は、その条件に該当する候補として説明できます。`,
    differentiation:
      afterTexts[4] ||
      `一般的な代替手段は個別課題への対処が中心ですが、${companyName}は${productCategory}として構造的なアプローチを持つ点で異なります。`,
    faq: faqThemes.map(t => ({
      question: t.question,
      answer: fallbackAnswer(t.question),
    })),
  };
}

// ── Aisleページ：親ページHTML生成 ────────────────────────────
export function generateParentHtml(index: AislePageIndexEntry[], now: string, clientSlug: string, companyName: string, productCategory = '', productDescription = ''): string {
  const jpDate = toJpDate(now);

  // リード文：productCategory > productDescription > fallback の3分岐
  const leadLine1 = productCategory
    ? `${esc(companyName)}は、${esc(productCategory)}を提供しています。`
    : productDescription
      ? `${esc(companyName)}は、${esc(productDescription)}に関する情報を提供しています。`
      : `${esc(companyName)}に関する情報を整理しています。`;
  const leadLine2 = `このページでは、生成AI（ChatGPT・Perplexityなど）が関連する問いに回答する際に、${esc(companyName)}がどのような文脈で紹介されるべきかを整理しています。`;

  // カード形式：代表問い + 1行説明 + 関連問いの展開
  const cardItems = index.map(e => {
    const promptText = e.promptText ?? e.label;
    const frame = ANSWER_FRAME[e.promptTypeId] ?? DEFAULT_ANSWER_FRAME;
    const desc = frame.pageDescription;
    const related = e.relatedPromptTexts ?? [];
    const relatedHtml = related.length > 0
      ? `\n      <details class="related-qs">
        <summary>他の関連する質問（${related.length}件）</summary>
        <ul>
          ${related.map(q => `<li>${esc(q)}</li>`).join('\n          ')}
        </ul>
      </details>`
      : '';
    return `    <article class="q-card">
      <h2><a href="/${esc(e.slug)}">${esc(promptText)}</a></h2>
      <p class="q-desc">${esc(desc)}</p>
      <a class="q-link" href="/${esc(e.slug)}">この問いへの回答を見る →</a>${relatedHtml}
    </article>`;
  }).join('\n');

  const breadcrumbChildren = index.map((e, i) => ({
    '@type': 'ListItem',
    position: i + 2,
    name: e.promptText ?? e.label,
    item: `${HUB_BASE_URL}/${e.slug}`,
  }));

  const orgJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    url: `${HUB_BASE_URL}/${clientSlug}`,
    knowsAbout: index.map(e => e.promptText ?? e.label),
  }, null, 2).replace(/<\//g, '<\\/');

  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: companyName, item: `${HUB_BASE_URL}/${clientSlug}` },
      ...breadcrumbChildren,
    ],
  }, null, 2).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${esc(companyName)} — 生成AIが関連する問いに回答する際に参照する、${esc(productCategory || companyName)}の情報ページ一覧です。">
  <meta name="robots" content="index, follow">
  <meta name="last-modified" content="${now}">
  <title>${esc(companyName)} ｜ 問い別AIページ</title>
  <script type="application/ld+json">
${orgJsonLd}
  </script>
  <script type="application/ld+json">
${breadcrumbJsonLd}
  </script>
  <style>
    body{font-family:sans-serif;max-width:960px;margin:0 auto;padding:2rem;line-height:1.8;color:#222}
    h1{font-size:2rem;margin-bottom:.25rem}
    header{border-bottom:2px solid #e5e7eb;padding-bottom:1rem;margin-bottom:2rem}
    section{margin-bottom:2rem}
    a{color:#4f46e5;text-decoration:none}
    a:hover{text-decoration:underline}
    .q-card{border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem 1.5rem;margin-bottom:1.25rem}
    .q-card h2{font-size:1.1rem;margin:0 0 .4rem;line-height:1.5}
    .q-card h2 a{color:#1e1b4b}
    .q-card h2 a:hover{color:#4f46e5}
    .q-desc{margin:.25rem 0 .75rem;color:#555;font-size:.95rem}
    .q-link{font-size:.9rem;color:#4f46e5;font-weight:600}
    .related-qs{margin-top:.75rem;font-size:.875rem;color:#6b7280}
    .related-qs summary{cursor:pointer;color:#6b7280}
    .related-qs ul{margin:.5rem 0 0 1rem;padding:0}
    .related-qs li{margin:.25rem 0}
    footer{margin-top:3rem;border-top:1px solid #e5e7eb;padding-top:1rem;font-size:.85rem;color:#6b7280}
  </style>
</head>
<body>
  <header>
    <h1>${esc(companyName)}</h1>
    ${productCategory ? `<p>${esc(productCategory)}</p>` : ''}
  </header>
  <main>
    <section id="about">
      <p>${leadLine1}</p>
      <p>${leadLine2}</p>
    </section>
    <section id="query-pages">
      <h2 style="font-size:1.25rem;border-left:4px solid #4f46e5;padding-left:.75rem;margin-top:2rem">${esc(companyName)}が紹介されるべき問い</h2>
      ${cardItems || '<p>（設計済みページは現在準備中です）</p>'}
    </section>
  </main>
  <footer>
    <p>最終更新：<span id="last-updated">${jpDate}</span></p>
  </footer>
</body>
</html>`;
}

// ── Aisleページ：子ページHTML生成 ────────────────────────────
// narrative が null の場合は buildFallbackNarrative で生成したものを渡す
function generateChildHtml(
  perPID: AislePerPID,
  now: string,
  narrative: ChildPageNarrative,
  clientSlug: string,
  companyName: string,
): string {
  const promptSlug = getPromptSlug(perPID.promptTypeId);
  const pageUrl = `${HUB_BASE_URL}/${clientSlug}/${promptSlug}`;
  const jpDate = toJpDate(now);
  const base = perPID.promptTypeId.split('-').slice(0, 2).join('-');
  const frame = ANSWER_FRAME[base] ?? DEFAULT_ANSWER_FRAME;

  // 内部メタ（hidden semantic）: M-IDのみHTMLコメントで保持
  const mIds = [...new Set(perPID.afterBun.map(b => b.mId).filter(Boolean))].join(', ');

  // FAQPage JSON-LD（多問対応）
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: narrative.faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }, null, 2).replace(/<\//g, '<\\/');

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: companyName, item: `${HUB_BASE_URL}/${clientSlug}` },
      { '@type': 'ListItem', position: 2, name: perPID.promptText, item: pageUrl },
    ],
  }, null, 2).replace(/<\//g, '<\\/');

  // FAQ HTML（dl/dt/dd）
  const faqHtml = narrative.faq.map(f => `      <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <dt itemprop="name">${esc(f.question)}</dt>
        <dd itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
          <span itemprop="text">${esc(f.answer)}</span>
        </dd>
      </div>`).join('\n');

  const metaDesc = esc(`${perPID.promptText} — ${companyName}に関する情報をAIが理解しやすい形式で整理しています。`);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <meta name="last-modified" content="${now}">
  <link rel="canonical" href="${esc(pageUrl)}">
  <title>${esc(perPID.promptText)} ｜ ${esc(companyName)}</title>
  <script type="application/ld+json">
${faqJsonLd}
  </script>
  <script type="application/ld+json">
${breadcrumbJsonLd}
  </script>
  <!-- semantic-blocks:${mIds} -->
  <style>
    body{font-family:sans-serif;max-width:960px;margin:0 auto;padding:2rem;line-height:1.9;color:#222}
    h1{font-size:1.65rem;margin-bottom:.5rem;line-height:1.45;color:#111}
    h2{font-size:1.1rem;border-left:4px solid #4f46e5;padding-left:.75rem;margin-top:2.5rem;color:#1e1b4b}
    header{border-bottom:2px solid #e5e7eb;padding-bottom:1.25rem;margin-bottom:2.5rem}
    .header-bg{font-size:.95rem;color:#555;margin:.5rem 0 0;line-height:1.7}
    nav{font-size:.85rem;margin-bottom:.75rem}
    nav a{color:#6366f1;text-decoration:none}
    nav a:hover{text-decoration:underline}
    section{margin-bottom:2.5rem}
    p{margin:.6rem 0}
    dl.faq{margin:0;padding:0}
    .faq-item{margin-bottom:1.75rem;padding-bottom:1.75rem;border-bottom:1px solid #f1f5f9}
    .faq-item:last-child{border-bottom:none}
    dt{font-weight:600;color:#1e1b4b;margin-bottom:.4rem}
    dd{margin:0;color:#444;line-height:1.85}
    footer{margin-top:3rem;border-top:1px solid #e5e7eb;padding-top:1rem;font-size:.85rem;color:#6b7280}
  </style>
</head>
<body>
  <header>
    <nav><a href="/${clientSlug}">← ${esc(companyName)}</a></nav>
    <h1>${esc(perPID.promptText)}</h1>
    <p class="header-bg">${esc(narrative.background)}</p>
  </header>
  <main>
    <section id="criteria">
      <h2>${esc(frame.sectionHeadings.criteria)}</h2>
      <p>${esc(narrative.criteria)}</p>
    </section>
    <section id="matching" itemscope itemtype="https://schema.org/ItemList">
      <h2>${esc(frame.sectionHeadings.matching)}</h2>
      <p itemprop="description">${esc(narrative.matching_companies)}</p>
    </section>
    <section id="why-match" itemscope itemtype="https://schema.org/Organization">
      <h2>${esc(frame.sectionHeadings.why_match)}</h2>
      <p itemprop="description">${esc(narrative.why_match)}</p>
    </section>
    <section id="differentiation">
      <h2>${esc(frame.sectionHeadings.differentiation)}</h2>
      <p>${esc(narrative.differentiation)}</p>
    </section>
    <section id="faq" itemscope itemtype="https://schema.org/FAQPage">
      <h2>よくある質問</h2>
      <dl class="faq">
${faqHtml}
      </dl>
    </section>
  </main>
  <footer>
    <p>最終更新：<span id="last-updated">${jpDate}</span></p>
    <p><a href="/${clientSlug}">← ${esc(companyName)} へ戻る</a></p>
  </footer>
</body>
</html>`;
}

// ── Aisleページ：perPID を base P-ID 単位でマージ ────────────
function mergePerPIDByBase(
  baseId: string,
  validPerPID: AislePerPID[],
): AislePerPID | null {
  const matched = validPerPID.filter(p => {
    const b = p.promptTypeId.split('-').slice(0, 2).join('-');
    return b === baseId;
  });
  if (matched.length === 0) return null;

  return {
    ...matched[0],
    afterBun: matched.flatMap(m => m.afterBun),
    eIdComplement: matched.flatMap(m => m.eIdComplement),
    // mIdMapping は mId 単位で重複除去
    mIdMapping: matched
      .flatMap(m => m.mIdMapping)
      .filter((m, i, arr) => arr.findIndex(x => x.mId === m.mId) === i),
  };
}

// ── ハンドラ ──────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  // ── GET: インデックス取得 or llms.txt ──────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const format = url.searchParams.get('format');
    const clientSlugParam = url.searchParams.get('clientSlug');
    // llms.txt は page-index:aisle 固定（Sprint D-1 対象外）
    // JSON インデックスは clientSlug クエリがあればそちらを優先
    const indexKey = (format !== 'llms' && clientSlugParam)
      ? `page-index:${clientSlugParam}`
      : 'page-index:aisle';
    try {
      const index = await kv.get<AislePageIndexEntry[]>(indexKey) ?? [];
      if (format === 'llms') {
        // llms.txt 形式で返す
        const BASE = 'https://app.aisle-aio.ai';
        const childLines = index.map(e => `- ${BASE}/${e.slug}  （${e.label}）`).join('\n');
        const childSection = index.length > 0 ? `\n## Query-Intent Pages\n${childLines}\n` : '';
        const lastUpdated = index.length > 0
          ? index.reduce((l, e) => e.generatedAt > l ? e.generatedAt : l, index[0].generatedAt).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const content = `# Aisle\n\n## Overview\nAisle is an emergence design service that helps companies structure information\nso generative AI can understand and recommend them.\n\n## Main Pages\n- ${BASE}/aisle  （出現設計ハブ）${childSection}\n## Purpose\nThese pages explain Aisle's AI emergence design structure by query intent.\nEach sub-page targets a specific P-ID (prompt type) and explains the structured\ndesign that enables Aisle to appear in generative AI responses to that query.\n\n## Last Updated\n${lastUpdated}\n`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(content);
      } else {
        // JSON インデックス
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, index }));
      }
    } catch (err: unknown) {
      if (format === 'llms') {
        const fallback = `# Aisle\n\n## Overview\nAisle is an emergence design service that helps companies structure information so generative AI can understand and recommend them.\n\n## Main Pages\n- https://app.aisle-aio.ai/aisle\n\n## Purpose\nThese pages explain Aisle's AI emergence design structure by query intent.\nEach page corresponds to a specific question type (P-ID) and explains\nwhy Aisle should appear in AI responses to that query.\n`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(fallback);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    }
    return;
  }

  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const rawBody = JSON.parse(await readBody(req)) as Record<string, unknown>;

    // ── Aisleページフロー ─────────────────────────────────────
    if ('aisleMode' in rawBody) {
      const aisleReq = rawBody as unknown as AislePageRequest;
      const {
        aisleMode,
        targetPromptTypeIds,
        perPID,
        companyName = 'Aisle',
        productCategory = 'AI出現設計',
        clientSlug: requestedSlug,
      } = aisleReq;
      const now = new Date().toISOString();
      // clientSlug バリデーション：送られてきた場合は不正値を黙って無視せず 400 を返す
      const rawSlug = requestedSlug?.trim() ?? '';
      if (rawSlug && !SLUG_PATTERN.test(rawSlug)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Invalid clientSlug', message: 'clientSlug は小文字英数字とハイフンのみ使用できます' }));
        return;
      }
      const clientSlug = rawSlug || toSlug(companyName);

      // promptTypeId が未設定の行を除外
      const validPerPID = perPID.filter(p => !!p.promptTypeId);

      // 既存インデックス読み込み
      const existingIndex = await kv.get<AislePageIndexEntry[]>(`page-index:${clientSlug}`) ?? [];

      if (aisleMode === 'add') {
        // 既存スラグセット
        const existingPromptSlugs = new Set(existingIndex.map(e => e.promptSlug));

        const toCreate: string[] = [];
        const skipped: string[] = [];

        for (const baseId of targetPromptTypeIds) {
          const promptSlug = getPromptSlug(baseId);
          if (existingPromptSlugs.has(promptSlug)) {
            skipped.push(`${HUB_BASE_URL}/${clientSlug}/${promptSlug}`);
          } else {
            toCreate.push(baseId);
          }
        }

        const created: string[] = [];
        const newIndexEntries: AislePageIndexEntry[] = [];

        for (const baseId of toCreate) {
          const merged = mergePerPIDByBase(baseId, validPerPID);
          if (!merged) continue; // perPID データなし → スキップ

          const faqGuidance = (ANSWER_FRAME[baseId] ?? DEFAULT_ANSWER_FRAME).faqGuidance;
          const narrative = await callClaudeForChildPage(merged, companyName, productCategory, faqGuidance)
            ?? buildFallbackNarrative(merged, baseId, companyName, productCategory);

          const promptSlug = getPromptSlug(baseId);
          const childHtml = generateChildHtml(merged, now, narrative, clientSlug, companyName);
          await kv.set(`page:${clientSlug}/${promptSlug}`, childHtml);

          const label = merged.promptTypeLabel ?? PROMPT_TYPE_LABEL_MAP[baseId] ?? baseId;
          const allPrompts = validPerPID
            .filter(p => p.promptTypeId.split('-').slice(0, 2).join('-') === baseId)
            .map(p => p.promptText)
            .filter(Boolean);
          newIndexEntries.push({
            slug: `${clientSlug}/${promptSlug}`,
            promptTypeId: baseId,
            promptSlug,
            label,
            generatedAt: now,
            promptText: allPrompts[0],
            relatedPromptTexts: allPrompts.length > 1 ? allPrompts.slice(1) : undefined,
          });
          created.push(`${HUB_BASE_URL}/${clientSlug}/${promptSlug}`);
        }

        // インデックス更新（既存 + 新規）
        const updatedIndex = [...existingIndex, ...newIndexEntries];
        await kv.set(`page-index:${clientSlug}`, updatedIndex);

        // 親ページ再生成
        await kv.set(`page:${clientSlug}`, generateParentHtml(updatedIndex, now, clientSlug, companyName, productCategory));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, parentUrl: `${HUB_BASE_URL}/${clientSlug}`, llmsTxtUrl: `${HUB_BASE_URL}/llms.txt`, created, skipped, updated: [] }));

      } else {
        // ── updateMode ──────────────────────────────────────────
        const updated: string[] = [];
        const updatedIndex = [...existingIndex];

        for (const baseId of targetPromptTypeIds) {
          const merged = mergePerPIDByBase(baseId, validPerPID);
          if (!merged) continue;

          const faqGuidance = (ANSWER_FRAME[baseId] ?? DEFAULT_ANSWER_FRAME).faqGuidance;
          const narrative = await callClaudeForChildPage(merged, companyName, productCategory, faqGuidance)
            ?? buildFallbackNarrative(merged, baseId, companyName, productCategory);

          const promptSlug = getPromptSlug(baseId);
          const childHtml = generateChildHtml(merged, now, narrative, clientSlug, companyName);
          await kv.set(`page:${clientSlug}/${promptSlug}`, childHtml);

          const label = merged.promptTypeLabel ?? PROMPT_TYPE_LABEL_MAP[baseId] ?? baseId;
          const allPrompts = validPerPID
            .filter(p => p.promptTypeId.split('-').slice(0, 2).join('-') === baseId)
            .map(p => p.promptText)
            .filter(Boolean);
          const entry: AislePageIndexEntry = {
            slug: `${clientSlug}/${promptSlug}`,
            promptTypeId: baseId,
            promptSlug,
            label,
            generatedAt: now,
            promptText: allPrompts[0],
            relatedPromptTexts: allPrompts.length > 1 ? allPrompts.slice(1) : undefined,
          };
          const idx = updatedIndex.findIndex(e => e.promptSlug === promptSlug);
          if (idx >= 0) {
            updatedIndex[idx] = entry;
          } else {
            updatedIndex.push(entry);
          }
          updated.push(`${HUB_BASE_URL}/${clientSlug}/${promptSlug}`);
        }

        await kv.set(`page-index:${clientSlug}`, updatedIndex);
        await kv.set(`page:${clientSlug}`, generateParentHtml(updatedIndex, now, clientSlug, companyName, productCategory));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, parentUrl: `${HUB_BASE_URL}/${clientSlug}`, llmsTxtUrl: `${HUB_BASE_URL}/llms.txt`, created: [], skipped: [], updated }));
      }

      return;
    }

    // ── クライアントページフロー（既存処理） ─────────────────────
    const body = rawBody as unknown as PageData;
    const { companyName, mode = 'new', clientSlug: requestedSlug } = body;

    if (!companyName) throw new Error('companyName が必要です');

    // clientSlug バリデーション：送られてきた場合は不正値を黙って無視せず 400 を返す
    const rawSlug = requestedSlug?.trim() ?? '';
    if (rawSlug && !SLUG_PATTERN.test(rawSlug)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid clientSlug', message: 'clientSlug は小文字英数字とハイフンのみ使用できます' }));
      return;
    }
    const slug = rawSlug || toSlug(companyName);
    const url  = `${HUB_BASE_URL}/${slug}`;
    const now  = new Date().toISOString();

    let finalHtml: string;
    let resultMode = mode;

    if (mode === 'append') {
      // ── append: </main> 直前に新セクションを挿入（既存を保持）──
      const existing = await kv.get<string>(`page:${slug}`);
      if (existing) {
        const claudeContent = await callClaudeForContent(body);
        const enrichedData  = { ...body, mIdSections: enrichMIdSections(body.mIdSections, claudeContent) };
        finalHtml = appendToHtml(existing, enrichedData, now);
      } else {
        // 既存ページなし → 新規生成にフォールバック
        const claudeContent = await callClaudeForContent(body);
        const enrichedData  = { ...body, mIdSections: enrichMIdSections(body.mIdSections, claudeContent) };
        finalHtml = generateHtml(enrichedData, now, url);
        resultMode = 'new';
      }
    } else if (mode === 'update') {
      // ── update: 既存HTMLのM-IDセクションのみ差し替え ──────────
      const existing = await kv.get<string>(`page:${slug}`);
      const claudeContent = await callClaudeForContent(body);
      const enrichedData  = { ...body, mIdSections: enrichMIdSections(body.mIdSections, claudeContent) };
      if (existing) {
        finalHtml = updateMIdSectionsInHtml(existing, enrichedData.mIdSections, now);
      } else {
        // 既存ページなし → 新規生成にフォールバック
        finalHtml = generateHtml(enrichedData, now, url);
        resultMode = 'new';
      }
    } else {
      // ── new: 既存ページを無視してフルHTML新規生成 ──────────────
      const claudeContent = await callClaudeForContent(body);
      const enrichedData  = { ...body, mIdSections: enrichMIdSections(body.mIdSections, claudeContent) };
      finalHtml = generateHtml(enrichedData, now, url);
    }

    await kv.set(`page:${slug}`, finalHtml);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, slug, url, mode: resultMode, updatedAt: now }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
