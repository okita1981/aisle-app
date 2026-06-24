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

// ── 文字化け検知ヘルパー ──────────────────────────────────────
// U+FFFD（置換文字）または孤立サロゲート（正規のサロゲートペアを構成しない U+D800–U+DFFF）を検知する。
// 絵文字など通常のマルチバイト Unicode は弾かない。
function hasGarbledText(s: string): boolean {
  if (s.includes('�')) return true;
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
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

/** 問い単位の公開ページインデックスエントリ（新構造） */
export interface QuestionPageIndexEntry {
  questionSlug: string;    // "recommendation-001"（{promptTypeSlug}-{連番}）
  promptTypeId: string;    // "P-01"
  promptTypeSlug: string;  // "recommendation"
  promptText: string;      // 問いの全文
  sessionKey?: string;     // 生成元セッションキー
  generatedAt: string;     // ISO8601
}

// ── RefBase 型定義 ─────────────────────────────────────────────

export type EntityType =
  | 'company'
  | 'service'
  | 'product'
  | 'person'
  | 'organization'
  | 'concept'
  | 'other';

export interface RefBaseCompany {
  id: string;               // clientSlug
  name: string;             // companyName
  category: string;         // productCategory
  entityType?: EntityType;  // 省略時は 'company' として扱う（後方互換）
  externalLinks?: Array<{ type: string; url: string }>;
  updatedAt: string;        // ISO8601
}

/** 問いと1:1で生成される知識ブロック（将来的に question から独立可能）  */
export interface RefBaseReference {
  id: string;          // questionSlug（現在は question と1:1）
  companyId: string;   // → RefBaseCompany.id
  questionId: string;  // → QuestionPageIndexEntry.questionSlug
  promptText: string;
  promptTypeId: string;
  answer: string;
  evidencePoints: string[];
  scope: string;
  differentiation: string;
  faq: Array<{ question: string; answer: string }>;
  pageUrl: string;
  sourceEvidence: EvidenceItemInput[];
  generatedAt: string;
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
  /** add: 処理対象P-ID（各perPIDを個別に処理する） */
  targetPromptTypeIds: string[];
  /** update: 更新対象 questionSlug リスト（新構造） */
  targetQuestionSlugs?: string[];
  perPID: AislePerPID[];
  companyName: string;
  productCategory: string;
  clientSlug?: string;
  sessionKey?: string;  // 生成元セッションキー（question index に記録）
  kIdScoreMap?: Record<string, string>;
  kIdMatrix?: Record<string, Record<string, string>>;
  adoptedEvidence?: EvidenceItemInput[];
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
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(100000), // Vercel maxDuration=120s の範囲内
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

// ── 外部リンク種別ごとの補完説明 ─────────────────────────────
function externalLinkDescription(type: string): string {
  const t = type.toLowerCase();
  if (t === 'note')                    return '会社の考え方、制作姿勢、活動内容を補足する外部情報です。';
  if (t === 'linkedin')                return '会社・代表者・担当者の活動履歴や専門性を補足する外部情報です。';
  if (t === 'メディア記事' || t === 'media') return '第三者による紹介・掲載情報として、会社の信頼性や文脈を補足する外部情報です。';
  if (t === '公式サイト' || t === 'official' || t === 'website') return '会社の基本情報、提供サービス、問い合わせ導線を確認するための公式情報です。';
  return 'このページの会社情報を補足する外部参照情報です。';
}

// ── 外部リンク種別ごとのAI補完ロール属性 ─────────────────────
function externalLinkRole(type: string): string {
  const t = type.toLowerCase();
  if (t === 'note')                    return 'citation freshness entity-context';
  if (t === 'linkedin')                return 'entity-context social-proof';
  if (t === 'メディア記事' || t === 'media') return 'media-mention third-party-proof credibility';
  if (t === '公式サイト' || t === 'official' || t === 'website') return 'official-source navigation service-info';
  return 'external-reference';
}

// ── 外部リンクセクション生成（AI向け補完情報） ────────────────
function generateExternalLinksHtml(externalUrls?: Array<{ type: string; url: string }>): string {
  const validUrls = (externalUrls ?? []).filter(u => u.url.trim());
  if (validUrls.length === 0) return '';

  const items = validUrls.map(u => `    <li
      itemprop="itemListElement"
      itemscope
      itemtype="https://schema.org/ListItem"
      data-evidence-role="${externalLinkRole(u.type)}"
    >
      <a href="${esc(u.url.trim())}" target="_blank" rel="noopener noreferrer" itemprop="url">${esc(u.type)}</a>
      <p>${externalLinkDescription(u.type)}</p>
    </li>`);

  return `
  <section id="external-links" itemscope itemtype="https://schema.org/ItemList">
    <h2>AIが参照できる補完情報</h2>
    <p>以下の外部情報は、このページに記載された会社情報を補足する参照先です。生成AIが会社の特徴・実績・思想・活動内容を確認するための補助情報として機能します。</p>
    <ul>
${items.join('\n')}
    </ul>
  </section>`;
}

// ── 外部リンクセクション同期（append / update 用） ────────────
// 既存HTMLの id="external-links" を差し替え、なければ </main> 直前へ追加、
// externalUrls が空なら既存セクションを削除する
function syncExternalLinksInHtml(html: string, externalUrls?: Array<{ type: string; url: string }>): string {
  const newSection = generateExternalLinksHtml(externalUrls);
  const hasExisting = /<section\s[^>]*id="external-links"[^>]*>[\s\S]*?<\/section>/i.test(html);

  if (hasExisting) {
    // 既存セクションを差し替え（空の場合は削除）
    return html.replace(
      /<section\s[^>]*id="external-links"[^>]*>[\s\S]*?<\/section>/i,
      newSection,
    );
  }
  if (newSection) {
    // なければ </main> 直前へ追加
    return html.includes('</main>')
      ? html.replace('</main>', `${newSection}\n  </main>`)
      : html + newSection;
  }
  return html;
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

interface EvidenceItemInput {
  type: string;
  title: string;
  description: string;
  entityRole: string;
  value?: string;
  tags: string[];
  sourceUrl?: string;
  sourceType?: string;
  needsVerification?: boolean;
  verificationNote?: string;
  sourceVerified?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface _EvidenceWarning {
  questionSlug: string;
  promptTypeId: string;
  missingTypes: string[];
  needsVerificationCount: number;
  insufficientTypes: string[];
  message: string;
}

// 推薦文・公開ページ向け type 固定優先度（design.ts と同一定義）
const EVIDENCE_TYPE_BASE_SCORE: Record<string, number> = {
  case:         4,
  client:       3,
  credential:   3,
  media:        3,
  metric:       2,
  comparison:   2,
  method:       2,
  feature:      1,
  availability: 1,
  review:       1,
  other:        0,
};

function sortEvidenceByPriority(items: EvidenceItemInput[], context?: { promptText?: string; promptTypeId?: string }): EvidenceItemInput[] {
  const sorted = [...items].sort(
    (a, b) => (EVIDENCE_TYPE_BASE_SCORE[b.type] ?? 0) - (EVIDENCE_TYPE_BASE_SCORE[a.type] ?? 0),
  );
  if (context) {
    const prefix = `[evidence-sort] pId=${context.promptTypeId ?? 'n/a'} promptText="${(context.promptText ?? '').slice(0, 40)}"`;
    console.log(`${prefix} sorted_order=[${sorted.map(e => `${e.type}(${EVIDENCE_TYPE_BASE_SCORE[e.type] ?? 0})`).join(', ')}]`);
  }
  return sorted;
}

interface ChildPageNarrative {
  answer: string;
  evidencePoints: string[];
  scope: string;
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

// ── Aisleページ：questionSlug 採番 ──────────────────────────────
// 「既存件数+1」ではなく「既存slugの最大suffix+1」で採番する。
// 削除や同時実行で件数とsuffixがズレても、過去に使われた番号と衝突しない。
// 同一promptTypeSlug配下に何件Referenceがあっても、既存slug集合（existing + 今回のバッチ内で
// 採番済みの分）と重複しないユニークなslugを返すまで候補をインクリメントし続ける。
function nextQuestionSlug(
  promptTypeSlug: string,
  existingQIndex: QuestionPageIndexEntry[],
  newQEntries: QuestionPageIndexEntry[],
): string {
  const suffixPattern = new RegExp(`^${promptTypeSlug}-(\\d+)$`);

  let maxSuffix = 0;
  for (const e of [...existingQIndex, ...newQEntries]) {
    const m = e.questionSlug.match(suffixPattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSuffix) maxSuffix = n;
    }
  }

  const usedSlugs = new Set([
    ...existingQIndex.map(e => e.questionSlug),
    ...newQEntries.map(e => e.questionSlug),
  ]);

  let candidate = maxSuffix + 1;
  let questionSlug = `${promptTypeSlug}-${String(candidate).padStart(3, '0')}`;
  while (usedSlugs.has(questionSlug)) {
    candidate += 1;
    questionSlug = `${promptTypeSlug}-${String(candidate).padStart(3, '0')}`;
  }
  return questionSlug;
}

// ── FAQ guidance per P-ID ─────────────────────────────────────
const FAQ_GUIDANCE_MAP: Record<string, string> = {
  'P-01': '選定基準・候補の条件・比較軸・検討の進め方・注意点',
  'P-02': '比較の切り口・違いの見つけ方・用途別の向き不向き・導入前の確認事項',
  'P-03': '選定基準・候補の条件・カテゴリ間の違い・検討の注意点',
  'P-04': '課題の起点・解決策の選び方・向いているケース・導入前の整理',
  'P-05': '根拠の種類・信頼性の判断軸・情報の使い分け・候補の見極め方',
  'P-06': '推薦の条件・候補になる理由・比較軸・注意すべき観点',
};

// ── Aisleページ：Claude API で回答ナラティブ生成 ────────────

async function callClaudeForChildPage(
  perPID: AislePerPID,
  companyName: string,
  productCategory: string,
  adoptedEvidence?: EvidenceItemInput[],
): Promise<ChildPageNarrative | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const base = perPID.promptTypeId.split('-').slice(0, 2).join('-');

  const afterTexts = perPID.afterBun
    .filter(b => b.afterText?.trim())
    .map(b => b.afterText.trim())
    .slice(0, 10);

  const faqGuidance = FAQ_GUIDANCE_MAP[base] ?? '選定基準・候補の条件・比較軸・検討の進め方';

  const systemPrompt = `あなたは「問いへの回答設計」の専門家です。
与えられた「問い」に対して、読者が自然に読める回答ページのコンテンツを生成してください。

【ページの目的】
このページは対象商材の宣伝ではありません。
問いを受けた読者が自然に読める「回答記事」として構成してください。
対象商材はその問いの文脈で候補として自然に登場させてください。

【商材タイプの判定と語彙の使い分け（必ず行うこと）】
productCategoryの語彙から商材タイプを推定し、語彙・比較軸・FAQ設計を合わせてください。
- 無形サービス（コンサル・支援・代行）：「対応範囲」「アプローチの違い」「提供できるかどうか」
- SaaS・ツール：「機能」「連携可否」「料金体系」「サポート」
- 有形商品：「品質」「スペック」「価格帯」「入手しやすさ」
- 店舗・施設：「立地」「対応可能な状況」「雰囲気」「予約・利用条件」
- BtoB専門サービス：「対象業界」「規模感」「導入プロセス」「実績の種類」
該当するタイプの言葉を使い、無関係な語彙は使わないこと。

【answerフィールドの生成ルール】
- 問いに対する直接の回答を3〜5文で書く
- まず「この問いでは〜という条件を満たす候補が挙がる」と述べ、続けて対象商材がその条件にどう該当するかを自然に含める
- 診断レポート的な見出し語（「判断軸は」「条件に該当するのは」等）は文中でも使わない
- 「〜は優れています」「〜はおすすめです」等のPR調は禁止
- 条件適合型の語法を使うこと：「〜できる会社が候補になります」「〜という点で該当します」

【P-06（推薦理由深掘り型）専用ルール】
promptTypeIdが「P-06」の場合、以下を必ず守ること：
- answerは「推薦される理由の深掘り」として書く。単なる実績列挙ではなく、「なぜこの問いでこの商材が候補になるのか」の構造的な理由を述べる。
  具体的には：①他の選択肢との構造的な違い（comparison）→ ②その違いを実現するプロセス・手法（method）→ ③それが機能していることを示す実装例（case）の順で展開する。
- evidencePointsは、caseだけに偏らず、comparison（差別化軸）またはmethod（実行根拠）を必ず1〜2件含めること。
  例：「従来のコンサルは提案書納品で終わるが、AisleはHTMLページ・RefBase Referenceとして設計結果を公開（comparison）」「Phase0〜4の5フェーズがAPIとして実装済み（method）」
- differentiationは「他との比較」ではなく「なぜ推薦されるかの裏付け」として書く。P-02的な機能比較にならないこと。

【evidencePointsフィールドの生成ルール（最重要）】
- 採用済みEvidence（後述）が提供された場合は最優先で使用する
- 固有名詞（会社名・ブランド名・人名）、数値（件数・年数・割合・金額）、具体的な事例を優先する
- 抽象的な強みの説明は除外する

良い例：
- 500本以上の映像制作実績
- MIXI、Abema Production、LINE Digital Frontierとの取引実績
- 企画・CG制作・編集の社内一貫対応

悪い例：
- 高い技術力
- 品質とスピードを両立
- 独自のアプローチ

Evidenceがない場合は参考素材から最も具体的な情報を抽出する。2〜4項目を配列で生成すること。

【scopeフィールド】
どんな相談・用途・状況にこの商材が向いているかを1〜2文で。PR調禁止・条件適合型で書く。

【differentiationフィールド】
productCategoryと問い文脈に応じた比較対象との違いを1〜2文で。

【FAQ生成ルール】
5件。質問文は「この問いを受け取った人が自然に抱く疑問」として書く。
各FAQ回答は「①一般論 ②条件 ③対象商材が該当する場合の説明」の3段構成で2〜3文。
PR調・断定的推薦・商談誘導は禁止。
FAQテーマの方向性：${faqGuidance}

【禁止表現】
- 「〜は優れています」「〜はおすすめです」「〜は人気です」「〜は注目されています」
- 「〜は推薦されています」「〜は業界トップです」「圧倒的」「卓越した」

【内部用語（絶対に使わない）】
K-ID・E-ID・M-ID・P-ID・After構文・出現設計・補正済み

【出力フォーマット（JSONのみ・前置き不要）】
{
  "answer": "問いへの統合回答（3〜5文）",
  "evidencePoints": ["具体的実績1", "具体的実績2"],
  "scope": "向いている相談・用途（1〜2文）",
  "differentiation": "他の選択肢との違い（1〜2文）",
  "faq": [
    {"question": "自然な疑問文", "answer": "①一般論 ②条件 ③対象商材（2〜3文、PR調禁止）"},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."},
    {"question": "自然な疑問文", "answer": "..."}
  ]
}`;

  // Evidence セクションの構築（type優先度順にソートして渡す）
  const traceCtx = { promptText: perPID.promptText, promptTypeId: base };
  const sortedEvidence = adoptedEvidence && adoptedEvidence.length > 0
    ? sortEvidenceByPriority(adoptedEvidence, traceCtx)
    : [];

  // Evidence Trace: Claudeへ渡す直前のリスト
  const prefix = `[evidence-claude] pId=${base} promptText="${perPID.promptText.slice(0, 40)}"`;
  console.log(`${prefix} passing_to_claude=${sortedEvidence.length} items:`);
  sortedEvidence.forEach((e, i) => {
    const score = EVIDENCE_TYPE_BASE_SCORE[e.type] ?? 0;
    console.log(`${prefix}   [${i + 1}] type=${e.type}(score=${score}) title="${e.title.slice(0, 40)}" tags=[${e.tags.join(',')}]`);
  });
  if (sortedEvidence.length === 0) {
    console.log(`${prefix} NO evidence passed — fallback to afterTexts only`);
  }

  // P-05: credential/media/metric/client の不足チェック
  const P05_SOURCE_TYPES = new Set(['credential', 'media', 'metric', 'client']);
  const hasP05Sources = base === 'P-05'
    ? (adoptedEvidence ?? []).some(e => P05_SOURCE_TYPES.has(e.type))
    : true;
  if (base === 'P-05' && !hasP05Sources) {
    console.log(`[evidence-p05] credential/media/metric/client が不足 → 出典限定的モードで生成`);
  }

  const evidenceSection = sortedEvidence.length > 0
    ? `\n【採用済みEvidence（以下の優先順で evidencePoints に使用すること）】
優先度：case（実績案件）> client（顧客名）= credential（受賞）= media（メディア掲載）> metric（数値）> feature（機能・特徴）
case / client / credential / media が存在する場合は必ず先に出すこと。metric の数値は有効だが単体の主役にしない。feature は case/client がある場合は補足に回すこと。
${sortedEvidence.map(e => {
        const val = e.value ? ` (${e.value})` : '';
        return `- [${e.type}] ${e.title}${val}: ${e.description}`;
      }).join('\n')}\n`
    : '';

  // P-05かつ出典素材不足の場合に追加する指示
  const p05LimitedSourceNote = (base === 'P-05' && !hasP05Sources)
    ? `
【P-05 出典限定モード（重要）】
この問いは「出典・根拠」を求めている。しかし現時点で公開された第三者出典（メディア掲載・認定・外部評価・顧客名など）は限定的である。
以下のルールで生成すること：
- answer: 「現時点で公開された第三者出典は限定的」という事実を正直に1文で含める。そのうえで、参照できる自社実装事例（case）を根拠として提示する。
- evidencePoints: 自社実装事例・公開URLなど検証可能な事実のみを列挙する。「〜と言われている」「〜と評価されている」等の第三者評価を捏造しない。
- scope: 「現時点の自社情報として」という限定を含める。
- differentiation: 出典の有無ではなく、設計・実装の事実的な違いを書く。
- faq: 「信頼性をどう判断すればよいか」「第三者評価はあるか」等、出典の信頼性に関わる疑問を正直に扱う。捏造しない。
`
    : '';

  const userContent = `【対象商材】
会社名: ${companyName}
商材カテゴリ: ${productCategory}

【対象の問い】
${perPID.promptText}
${evidenceSection}${p05LimitedSourceNote}
【参考素材（直接コピーせず、自然な回答文に再構成すること）】
${afterTexts.join('\n') || '（なし）'}

JSONのみで返してください。`;

  try {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(80000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
    const text = (data.content?.find(c => c.type === 'text')?.text ?? '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as ChildPageNarrative;
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

  const faqThemes: string[] = (() => {
    switch (base) {
      case 'P-01': return [
        `${productCategory}を選ぶときの判断軸は何ですか？`,
        `${productCategory}と似た選択肢との違いはどこで見ますか？`,
        `どのような状況で${productCategory}が候補になりますか？`,
        `${productCategory}を検討するうえで確認すべきことは何ですか？`,
        `${companyName}が候補として挙がる条件は何ですか？`,
      ];
      case 'P-02': return [
        `${productCategory}を比較するときの切り口は何ですか？`,
        `${productCategory}と他の選択肢の違いをどう見分けますか？`,
        `どのような用途に${productCategory}は向いていますか？`,
        `比較検討で見落としやすいポイントは何ですか？`,
        `${companyName}を比較候補として見る場合の特徴は何ですか？`,
      ];
      case 'P-03': return [
        `${productCategory}を選ぶ基準はどのように整理しますか？`,
        `${productCategory}の候補が複数ある場合の絞り方は？`,
        `どのような条件の候補が上位に挙がりやすいですか？`,
        `${productCategory}と隣接カテゴリの違いは何ですか？`,
        `${companyName}が選択肢に含まれる場合の根拠は何ですか？`,
      ];
      case 'P-04': return [
        `この課題に対して${productCategory}はどう機能しますか？`,
        `${productCategory}が課題解決の手段になるのはどんなケースですか？`,
        `一般的な解決策と${productCategory}はどう違いますか？`,
        `課題解決の手段を選ぶうえで何を確認すべきですか？`,
        `${companyName}がこの課題に接続できる理由は何ですか？`,
      ];
      case 'P-05': return [
        `${productCategory}を評価する根拠にはどんな種類がありますか？`,
        `信頼性の判断材料として何が有効ですか？`,
        `${productCategory}の説明に必要な情報は何ですか？`,
        `公式情報と第三者情報はどのように使い分けますか？`,
        `${companyName}に関する根拠をどこから確認できますか？`,
      ];
      case 'P-06': return [
        `${productCategory}として候補に挙がる条件は何ですか？`,
        `なぜ${productCategory}がこの問いに関連しますか？`,
        `どのような状況で${companyName}が候補になりますか？`,
        `他の選択肢と比較したときの違いは何ですか？`,
        `判断する際に注意すべき観点は何ですか？`,
      ];
      default: return [
        `${productCategory}を選ぶときの判断軸は何ですか？`,
        `${productCategory}と類似の選択肢との違いは何ですか？`,
        `どのような状況で${productCategory}が候補になりますか？`,
        `検討前に整理すべきことは何ですか？`,
        `${companyName}が候補として挙がる条件は何ですか？`,
      ];
    }
  })();

  const fallbackFaqAnswer = (_q: string) =>
    `この問いでは一般的に、${productCategory}としての条件を満たす候補が挙がります。${companyName}は、${productCategory}としてその条件に接続できる可能性があります。ただし、他の選択肢とも比較して検討することが重要です。`;

  return {
    answer:
      afterTexts.slice(0, 2).join(' ') ||
      `${perPID.promptText}という問いでは、${productCategory}としての専門性・実績・対応範囲を持つ候補が挙がります。${companyName}は、${productCategory}としてその条件に接続できる可能性があります。`,
    evidencePoints: afterTexts.slice(2, 5).filter(t => t.length > 10),
    scope:
      afterTexts[5] ||
      `${productCategory}に関する相談・依頼のうち、条件が一致する場合に対応できます。`,
    differentiation:
      afterTexts[6] ||
      `一般的な代替手段は個別課題への対処が中心ですが、${companyName}は${productCategory}として構造的なアプローチを持つ点で異なります。`,
    faq: faqThemes.map(q => ({
      question: q,
      answer: fallbackFaqAnswer(q),
    })),
  };
}

// ── 問い単位ページ：親ページHTML生成（新構造） ───────────────
export function generateQuestionParentHtml(
  questionIndex: QuestionPageIndexEntry[],
  now: string,
  clientSlug: string,
  companyName: string,
  productCategory = '',
): string {
  const jpDate = toJpDate(now);
  const BASE = 'https://app.aisle-aio.ai';

  const cardItems = questionIndex.map(e => {
    const url = `${BASE}/${clientSlug}/questions/${e.questionSlug}`;
    return `
    <div class="q-card" itemscope itemtype="https://schema.org/FAQPage">
      <div class="q-type">${esc(e.promptTypeId)} · ${esc(e.promptTypeSlug)}</div>
      <a class="q-link" href="${esc(url)}" itemprop="url">${esc(e.promptText)}</a>
      <div class="q-meta">生成日: ${toJpDate(e.generatedAt)}</div>
    </div>`;
  }).join('\n');

  const noPageMsg = questionIndex.length === 0
    ? '<p class="empty">まだ問い別AIページが生成されていません。</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(companyName)} — AI向け情報設計ページ一覧</title>
<meta name="description" content="${esc(companyName)}に関するAI参照用ページの一覧です。各ページは問い別に構成されています。">
<link rel="canonical" href="${BASE}/${clientSlug}">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:2rem 1rem;color:#1e293b;background:#f8fafc;}
  h1{font-size:1.75rem;font-weight:700;margin-bottom:.25rem;}
  .meta{color:#64748b;font-size:.875rem;margin-bottom:2rem;}
  .q-card{background:#fff;border:1px solid #e2e8f0;border-radius:.75rem;padding:1.25rem;margin-bottom:1rem;}
  .q-type{font-size:.7rem;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;}
  .q-link{display:block;font-size:1rem;font-weight:600;color:#1e293b;text-decoration:none;margin-bottom:.5rem;}
  .q-link:hover{color:#6366f1;}
  .q-meta{font-size:.75rem;color:#94a3b8;}
  .empty{color:#94a3b8;text-align:center;padding:2rem;}
  footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #e2e8f0;font-size:.75rem;color:#94a3b8;text-align:center;}
</style>
</head>
<body>
<h1>${esc(companyName)}</h1>
<p class="meta">${esc(productCategory ? `${productCategory} · ` : '')}AI向け情報設計ページ一覧 · 更新日: ${jpDate}</p>
<main>
${noPageMsg}
${cardItems}
</main>
<footer>Generated by Aisle · ${jpDate}</footer>
</body>
</html>`;
}

// ── Aisleページ：親ページHTML生成（旧構造・後方互換） ───────
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

  // 内部メタ（hidden semantic）: M-IDのみHTMLコメントで保持
  const mIds = [...new Set(perPID.afterBun.map(b => b.mId).filter(Boolean))].join(', ');

  // FAQPage JSON-LD
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

  // evidencePoints → <ul> または fallback テキスト
  const evidenceHtml = narrative.evidencePoints.length > 0
    ? `<ul>\n${narrative.evidencePoints.map(p => `        <li>${esc(p)}</li>`).join('\n')}\n      </ul>`
    : `<p>${esc(companyName)}に関する具体的な実績情報は、公式サイトをご確認ください。</p>`;

  // FAQ HTML（dl/dt/dd）
  const faqHtml = narrative.faq.map(f => `      <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <dt itemprop="name">${esc(f.question)}</dt>
        <dd itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
          <span itemprop="text">${esc(f.answer)}</span>
        </dd>
      </div>`).join('\n');

  const metaDesc = esc(`${perPID.promptText} — ${narrative.answer.slice(0, 120)}`);

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
    h1{font-size:1.65rem;margin-bottom:1rem;line-height:1.45;color:#111}
    h2{font-size:1.1rem;border-left:4px solid #4f46e5;padding-left:.75rem;margin-top:2.5rem;color:#1e1b4b}
    header{border-bottom:2px solid #e5e7eb;padding-bottom:1.25rem;margin-bottom:2rem}
    nav{font-size:.85rem;margin-bottom:.75rem}
    nav a{color:#6366f1;text-decoration:none}
    nav a:hover{text-decoration:underline}
    .answer{font-size:1rem;line-height:1.9;color:#333;margin:0 0 2rem}
    section{margin-bottom:2.5rem}
    p{margin:.6rem 0}
    ul{margin:.5rem 0;padding-left:1.5rem}
    ul li{margin:.4rem 0;line-height:1.8}
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
  </header>
  <main>
    <p class="answer">${esc(narrative.answer)}</p>

    <section id="evidence" itemscope itemtype="https://schema.org/Organization">
      <h2>実績・根拠</h2>
      ${evidenceHtml}
    </section>

    <section id="scope">
      <h2>向いている相談</h2>
      <p>${esc(narrative.scope)}</p>
    </section>

    <section id="differentiation">
      <h2>他の選択肢との違い</h2>
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

// ── mergePerPIDByBase は question-centric 移行後は未使用（後方互換のため保存）──
// function mergePerPIDByBase(baseId: string, validPerPID: AislePerPID[]): AislePerPID | null {...}

// ── RefBase 保存 ─────────────────────────────────────────────
// HTML保存と同時に構造化 JSON を KV へ書き込む。失敗してもページ生成は継続する。

async function saveToRefBase(
  clientSlug: string,
  companyName: string,
  productCategory: string,
  questionSlug: string,
  promptText: string,
  promptTypeId: string,
  narrative: ChildPageNarrative,
  sourceEvidence: EvidenceItemInput[] | undefined,
  now: string,
): Promise<void> {
  try {
    // 文字化け検知: U+FFFD または孤立サロゲートが含まれる場合は KV 書き込みを中止する
    const garbledFields: string[] = [];
    if (hasGarbledText(promptText)) garbledFields.push('promptText');
    if (hasGarbledText(narrative.answer)) garbledFields.push('answer');
    if (narrative.evidencePoints.some(e => hasGarbledText(e))) garbledFields.push('evidencePoints');
    if (narrative.faq.some(f => hasGarbledText(f.question) || hasGarbledText(f.answer))) garbledFields.push('faq');
    if (garbledFields.length > 0) {
      console.error(`[saveToRefBase] ABORTED: garbled text (U+FFFD or lone surrogate) in [${garbledFields.join(', ')}] for ${clientSlug}/${questionSlug}. RefBase KV write skipped.`);
      return;
    }
    const REFBASE_BASE = 'https://www.refbase.ai';
    const pageUrl = `${REFBASE_BASE}/reference/${clientSlug}/${questionSlug}`;

    // 既存 Entity から entityType / externalLinks を引き継ぐ（問い生成による上書きで失わないよう保護）
    const existingEntity = await kv.get<RefBaseCompany>(`refbase:company:${clientSlug}`);

    const company: RefBaseCompany = {
      id: clientSlug,
      name: companyName,
      category: productCategory,
      // entityType: 既存値 → 'company' の順で引き継ぐ（引数受け渡しは将来対応）
      entityType: existingEntity?.entityType ?? 'company',
      // externalLinks: 既存値を保持（問い生成では変更しない）
      ...(existingEntity?.externalLinks !== undefined
        ? { externalLinks: existingEntity.externalLinks }
        : {}),
      updatedAt: now,
    };

    const reference: RefBaseReference = {
      id: questionSlug,
      companyId: clientSlug,
      questionId: questionSlug,
      promptText,
      promptTypeId,
      answer: narrative.answer,
      evidencePoints: narrative.evidencePoints,
      scope: narrative.scope,
      differentiation: narrative.differentiation,
      faq: narrative.faq,
      pageUrl,
      sourceEvidence: sourceEvidence ?? [],
      generatedAt: now,
    };

    // 上書き検知: 既存Referenceがあり、promptTextが異なる場合は警告ログを出す（ブロックはしない）。
    // questionSlugの採番衝突や意図しないupdateターゲット指定があった場合に早期発見できるようにする。
    const existingRef = await kv.get<RefBaseReference>(`refbase:ref:${clientSlug}/${questionSlug}`);
    if (existingRef && existingRef.promptText !== promptText) {
      console.warn(
        `[saveToRefBase] OVERWRITE WARNING: clientSlug=${clientSlug} questionSlug=${questionSlug} ` +
        `existingPromptText="${existingRef.promptText.slice(0, 60)}" newPromptText="${promptText.slice(0, 60)}"`,
      );
    }

    // company は upsert（毎回上書きで最新状態を保つ）
    await kv.set(`refbase:company:${clientSlug}`, company);
    // reference は questionSlug 単位で上書き（add / update 共通）
    await kv.set(`refbase:ref:${clientSlug}/${questionSlug}`, reference);
    // per-entity index: 未登録の questionSlug のみ追記
    const existingIndex = await kv.get<string[]>(`refbase:index:${clientSlug}`) ?? [];
    if (!existingIndex.includes(questionSlug)) {
      await kv.set(`refbase:index:${clientSlug}`, [...existingIndex, questionSlug]);
    }
    // global index: 未登録の clientSlug のみ追記
    const globalIndex = await kv.get<string[]>('refbase:index:all') ?? [];
    if (!globalIndex.includes(clientSlug)) {
      await kv.set('refbase:index:all', [...globalIndex, clientSlug]);
    }

    console.log(`[refbase] saved ${clientSlug}/${questionSlug}`);
  } catch (err) {
    console.error(`[refbase] save failed for ${clientSlug}/${questionSlug}:`, err);
  }
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
    const typeParam = url.searchParams.get('type');

    // ── type=questions: 問い単位インデックス（新構造）を返す ────────
    if (typeParam === 'questions' && clientSlugParam) {
      try {
        const [qIndex, refbaseIndex] = await Promise.all([
          kv.get<QuestionPageIndexEntry[]>(`page-question-index:${clientSlugParam}`),
          kv.get<string[]>(`refbase:index:${clientSlugParam}`),
        ]);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          clientSlug: clientSlugParam,
          index: qIndex ?? [],
          refbaseSlugs: refbaseIndex ?? [],
        }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: message }));
      }
      return;
    }

    // ── format=llms: RefBase URL を正本として列挙 ────────────────
    if (format === 'llms') {
      try {
        const REFBASE = 'https://www.refbase.ai';
        const today = new Date().toISOString().slice(0, 10);

        // 対象エンティティを決定（clientSlug 指定 or refbase:index:all）
        const entityIds: string[] = clientSlugParam
          ? [clientSlugParam]
          : (await kv.get<string[]>('refbase:index:all') ?? []);

        // 各エンティティの Reference 一覧を並列取得
        const sections = await Promise.all(entityIds.map(async entityId => {
          const [company, refSlugs] = await Promise.all([
            kv.get<{ name: string; category: string }>(`refbase:company:${entityId}`),
            kv.get<string[]>(`refbase:index:${entityId}`) ?? Promise.resolve([]),
          ]);
          if (!company) return null;
          const slugList = refSlugs ?? [];

          const refs = await Promise.all(
            slugList.map(slug =>
              kv.get<{ promptTypeId: string; promptText: string }>(`refbase:ref:${entityId}/${slug}`)
            )
          );

          const refLines = slugList.map((slug, i) => {
            const ref = refs[i];
            const label = ref ? `[${ref.promptTypeId}] ${ref.promptText}` : slug;
            return `- [${label}](${REFBASE}/reference/${entityId}/${slug})`;
          }).join('\n');

          return [
            `### ${company.name} (${company.category})`,
            `${REFBASE}/entity/${entityId}`,
            refLines,
          ].join('\n');
        }));

        const validSections = sections.filter(Boolean) as string[];

        const content = [
          '# Aisle — AI Emergence Design',
          `# Updated: ${today}`,
          '',
          '## About',
          'Aisle structures company information so generative AI can understand and recommend them.',
          'AI reference pages are published on RefBase (refbase.ai).',
          '',
          '## AI Reference Knowledge Base (RefBase)',
          `> Canonical knowledge pages: ${REFBASE}`,
          `> AI index: ${REFBASE}/llms.txt`,
          '',
          '## Entities',
          ...entityIds.map(id => `- ${REFBASE}/entity/${id}`),
          '',
          '## References by Entity',
          ...validSections,
        ].join('\n');

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(content);
      } catch {
        const fallback = [
          '# Aisle — AI Emergence Design',
          '',
          '## AI Reference Knowledge Base',
          '> https://www.refbase.ai',
          '',
          '## Entities',
          '- https://www.refbase.ai/entity/aisle',
        ].join('\n');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(fallback);
      }
      return;
    }

    // ── JSON インデックス（旧構造 後方互換） ──────────────────────
    const indexKey = clientSlugParam
      ? `page-index:${clientSlugParam}`
      : 'page-index:aisle';
    try {
      const index = await kv.get<AislePageIndexEntry[]>(indexKey) ?? [];
      // JSON インデックス
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, index }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: message }));
    }
    return;
  }

  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

  try {
    const rawBody = JSON.parse(await readBody(req)) as Record<string, unknown>;

    // ── RefBase Entity 更新フロー ─────────────────────────────
    if ((rawBody as Record<string, unknown>).aisleMode === 'refbaseEntityUpdate') {
      const { clientSlug: reqSlug, companyName: reqName, productCategory: reqCat, externalLinks, entityType: reqEntityType } =
        rawBody as { clientSlug?: string; companyName?: string; productCategory?: string; externalLinks?: Array<{ type: string; url: string }>; entityType?: EntityType };

      if (!reqSlug || !SLUG_PATTERN.test(reqSlug)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'clientSlug が不正です' }));
        return;
      }

      const now = new Date().toISOString();
      const existing = await kv.get<RefBaseCompany>(`refbase:company:${reqSlug}`);
      const updated: RefBaseCompany = {
        id: reqSlug,
        name: reqName || existing?.name || reqSlug,
        category: reqCat || existing?.category || '',
        ...(existing ?? {}),
        entityType: reqEntityType ?? existing?.entityType ?? 'company',
        externalLinks: (externalLinks ?? []).filter(u => u.url.trim()),
        updatedAt: now,
      };
      await kv.set(`refbase:company:${reqSlug}`, updated);

      const globalIndex = await kv.get<string[]>('refbase:index:all') ?? [];
      if (!globalIndex.includes(reqSlug)) {
        await kv.set('refbase:index:all', [...globalIndex, reqSlug]);
      }

      const entityUrl = `https://www.refbase.ai/entity/${reqSlug}`;
      console.log(`[refbase] entity updated: ${reqSlug}`);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, url: entityUrl, slug: reqSlug }));
      return;
    }

    // ── Aisleページフロー ─────────────────────────────────────
    if ('aisleMode' in rawBody) {
      const aisleReq = rawBody as unknown as AislePageRequest;
      const {
        aisleMode,
        targetPromptTypeIds,
        targetQuestionSlugs = [],
        perPID,
        companyName = 'Aisle',
        productCategory = 'AI出現設計',
        clientSlug: requestedSlug,
        sessionKey,
        adoptedEvidence: requestEvidence,
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

      // Evidence fallback: リクエストに Evidence がなければ KV から読み込む
      const adoptedEvidence: EvidenceItemInput[] = (requestEvidence && requestEvidence.length > 0)
        ? requestEvidence
        : (await kv.get<EvidenceItemInput[]>(`evidence:${clientSlug}`)) ?? [];
      if (adoptedEvidence.length > 0 && (!requestEvidence || requestEvidence.length === 0)) {
        console.log(`[evidence-kv] clientSlug=${clientSlug} KV fallback: ${adoptedEvidence.length} 件`);
      }

      // promptTypeId が未設定の行を除外
      const validPerPID = perPID.filter(p => !!p.promptTypeId);

      // 旧インデックスは llms.txt / backward compat 用に保持するが新フローでは使わない
      // const existingIndex = await kv.get<AislePageIndexEntry[]>(`page-index:${clientSlug}`) ?? [];

      // ── 問い単位インデックスを読み込む（新構造） ─────────────────────
      const existingQIndex = await kv.get<QuestionPageIndexEntry[]>(`page-question-index:${clientSlug}`) ?? [];

      if (aisleMode === 'add') {
        // ── add: 各 perPID エントリを個別に問いページとして生成 ─────
        // 同一P-IDが複数あってもそれぞれ別questionSlugとして保存する。
        // 既存P-IDが存在してもスキップせず必ず新規追加する。

        const created: string[] = [];
        const newQEntries: QuestionPageIndexEntry[] = [];

        for (const pid of validPerPID) {
          const baseId = pid.promptTypeId.split('-').slice(0, 2).join('-');
          if (!targetPromptTypeIds.includes(baseId)) continue;

          const promptTypeSlug = getPromptSlug(baseId);

          // 連番を付与：既存slugの最大suffix+1。existingQIndex/newQEntries双方と非衝突を保証。
          const questionSlug = nextQuestionSlug(promptTypeSlug, existingQIndex, newQEntries);

          const narrative = await callClaudeForChildPage(pid, companyName, productCategory, adoptedEvidence)
            ?? buildFallbackNarrative(pid, baseId, companyName, productCategory);

          const childHtml = generateChildHtml(pid, now, narrative, clientSlug, companyName);
          await kv.set(`page:question:${clientSlug}/${questionSlug}`, childHtml);
          await saveToRefBase(clientSlug, companyName, productCategory, questionSlug, pid.promptText, baseId, narrative, adoptedEvidence, now);

          if (hasGarbledText(pid.promptText)) {
            console.error(`[garbled-detected] add: ${questionSlug} promptText contains garbled chars — skipping page-question-index entry`);
          } else {
            newQEntries.push({
              questionSlug,
              promptTypeId: baseId,
              promptTypeSlug,
              promptText: pid.promptText,
              sessionKey,
              generatedAt: now,
            });
          }
          created.push(`${HUB_BASE_URL}/${clientSlug}/questions/${questionSlug}`);
        }

        // 問い単位インデックス更新（既存 + 新規）
        const updatedQIndex = [...existingQIndex, ...newQEntries];
        await kv.set(`page-question-index:${clientSlug}`, updatedQIndex);

        // 親ページを問い単位インデックスで再生成（page:index:〜 に保存してキー競合を回避）
        await kv.set(`page:index:${clientSlug}`, generateQuestionParentHtml(updatedQIndex, now, clientSlug, companyName, productCategory));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, parentUrl: `${HUB_BASE_URL}/${clientSlug}`, llmsTxtUrl: `${HUB_BASE_URL}/llms.txt`, created, skipped: [], updated: [], indexUpdated: newQEntries.length }));

      } else {
        // ── update: questionSlug 単位で再生成 ────────────────────────
        const updated: string[] = [];
        const updatedQIndex = [...existingQIndex];

        for (const questionSlug of targetQuestionSlugs) {
          const qEntry = existingQIndex.find(e => e.questionSlug === questionSlug);
          if (!qEntry) continue;

          const baseId = qEntry.promptTypeId;

          // promptText が一致する perPID → なければ同P-IDの先頭を使用
          // さらに見つからない場合は、子HTMLのタイトルから正しいpromptTextを復元してフォールバックpidを構築する
          let pid =
            validPerPID.find(p => {
              const b = p.promptTypeId.split('-').slice(0, 2).join('-');
              return b === baseId && p.promptText === qEntry.promptText;
            }) ??
            validPerPID.find(p => p.promptTypeId.split('-').slice(0, 2).join('-') === baseId);

          if (!pid) {
            // 現在セッションに該当P-IDがない場合: 子HTMLのtitleから正しいpromptTextを読み取って最小限のpidを構築
            const childHtml = await kv.get<string>(`page:question:${clientSlug}/${questionSlug}`);
            const titleMatch = childHtml?.match(/<title>([^<]+?) [|｜] /);
            const recoveredPromptText = titleMatch?.[1]?.trim() ?? qEntry.promptText;
            console.log(`[update-fallback] ${questionSlug}: no matching pid in perPID for ${baseId}, using fallback pid with promptText="${recoveredPromptText.slice(0, 40)}"`);
            pid = {
              pId: baseId,
              promptTypeId: baseId,
              promptTypeLabel: undefined,
              promptText: recoveredPromptText,
              mIdMapping: [],
              afterBun: [],
              eIdComplement: [],
            } as AislePerPID;
          }

          const narrative = await callClaudeForChildPage(pid, companyName, productCategory, adoptedEvidence)
            ?? buildFallbackNarrative(pid, baseId, companyName, productCategory);

          const childHtml = generateChildHtml(pid, now, narrative, clientSlug, companyName);
          await kv.set(`page:question:${clientSlug}/${questionSlug}`, childHtml);
          await saveToRefBase(clientSlug, companyName, productCategory, questionSlug, pid.promptText, baseId, narrative, adoptedEvidence, now);

          // インデックスの promptText と generatedAt を更新
          // 文字化けがある場合は promptText は更新せず generatedAt のみ更新する
          const idx = updatedQIndex.findIndex(e => e.questionSlug === questionSlug);
          if (idx >= 0) {
            if (hasGarbledText(pid.promptText)) {
              console.error(`[garbled-detected] update: ${questionSlug} promptText contains garbled chars — keeping existing promptText in index`);
              updatedQIndex[idx] = { ...updatedQIndex[idx], generatedAt: now };
            } else {
              updatedQIndex[idx] = { ...updatedQIndex[idx], promptText: pid.promptText, generatedAt: now };
            }
          }

          updated.push(`${HUB_BASE_URL}/${clientSlug}/questions/${questionSlug}`);
        }

        await kv.set(`page-question-index:${clientSlug}`, updatedQIndex);
        await kv.set(`page:index:${clientSlug}`, generateQuestionParentHtml(updatedQIndex, now, clientSlug, companyName, productCategory));

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
    const url  = `${HUB_BASE_URL}/${slug}/profile`;
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
        finalHtml = syncExternalLinksInHtml(finalHtml, enrichedData.externalUrls);
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
        finalHtml = syncExternalLinksInHtml(finalHtml, enrichedData.externalUrls);
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
