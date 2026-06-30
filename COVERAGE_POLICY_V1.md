# Coverage Policy v1.0

**策定日**: 2026-06-29  
**対象**: Aisle Studio — Evidence Coverage Engine（L3/L4）  
**位置づけ**: Policy Layer の一部。コードではなくルールとして管理する設計資産。  
**根拠**: 全31 Entity・152件の Evidence を CoverageType 別に分析し、実際の付与パターンから帰納的に導出した。

---

## 0. このPolicyが解くこと

Coverage Engine（L3）は「Evidence が特定の CoverageType を持つか否か」だけを判定する。  
何を CoverageType として認めるかは **人間が Evidence に付与する前の判断**であり、その判断基準が本 Policy の対象である。

> **単純化原則**: CoverageType は「AIがその軸で Entity を説明できるか」を問う。  
> Evidence の文体・長さ・情報源の権威性は関係ない。内容が何を語っているかだけを見る。

---

## 1. CoverageType 定義と判定基準

### 1-1. Identity（そのEntityが何者か）

**本質**: Entity の「存在・名称・分類・所属・役割」を確定する情報。

**付与してよいEvidence**

| パターン | 典型例 |
|---------|--------|
| 設立年・本社所在地・創業者 | 「2015年設立。本社サンフランシスコ」「2021年、OpenAI出身研究者チームが創業」 |
| 企業分類・カテゴリ | 「AIアシスタント」「CRMプラットフォーム」「映像制作会社」 |
| 人物の経歴・役職 | 「OpenAIのCEO」「Y Combinator元社長」「NVIDIA共同創業者（1993年〜）」 |
| 提供サービスの名称・ブランド | 「ClaudeシリーズをAPI・claude.aiとして提供」「Creative Cloud を運営」 |
| 組織の統合・再編の事実 | 「Google Brain と DeepMind が 2023年統合」 |
| 運営・在籍情報 | 「2024年よりLA Dodgers所属」「Y Combinator社長を 2014-2019年務めた」 |
| 事業規模の数値（実績ではなく規模の表明） | 「190カ国以上に展開」「31 Entity を登録中」 |

**付与してはいけないEvidence**

- 機能仕様の説明（何ができるか → Capability）
- 利用実績や受賞歴（信頼性の根拠 → Credibility）
- 他社との比較優位（→ Differentiation）
- 具体的な利用シーン（→ UseCase）

**境界ケース**

| Evidence | 判定 | 理由 |
|---------|------|------|
| 「RefBase 公開 Reference 件数：6件」（aisle-ev-022） | Identity ✓ | 組織の現在規模を示す数値。Credibility（実績証明）とも取れるが、主語が「何件あるか」であるため Identity を優先する |
| 「Netflix 公式 — 企業概要・事業領域」（netflix-ev-001）| Identity ✓ + Capability ✓ | 企業概要（Identity）と事業領域の説明（Capability）が混在する典型。両方付与が正しい |
| 「Uber 公式サイト・企業情報」（uber-ev-001）| Identity ✓ | description が「企業概要・事業内容・グローバル展開情報」のみのため Identity に留める。事業内容の記述が具体的であれば Capability を追加 |

---

### 1-2. Capability（何ができるか・何を提供するか）

**本質**: Entity が「できること・提供するもの・動作する領域」を説明する情報。

**付与してよいEvidence**

| パターン | 典型例 |
|---------|--------|
| 機能・スペック説明 | 「テキスト生成・要約・翻訳・コード生成・画像生成に対応」「200,000トークンのコンテキストウィンドウ」 |
| 提供サービスの内容 | 「ChatGPT / GPT-4 API / DALL-E / Sora / Whisperを開発・提供」 |
| 料金・プラン・対応言語（利用可能性） | 「無料プラン + Plus $20/月、日本語対応、iOS/Android対応」 |
| 技術的アーキテクチャ・仕組み | 「CUDA プラットフォームを通じてGPUを汎用計算に解放」 |
| 提供範囲・対応業務 | 「ブランドムービー・テレビCM・SNS動画を一貫して制作」 |
| サービスの統合・連携 | 「Azure OpenAI Service として企業向けAPIを提供」「Google Workspace と Gemini を統合」 |
| エコシステムの規模（能力の証左） | 「8,000以上のアプリを持つ Shopify エコシステム」 |

**付与してはいけないEvidence**

- 受賞・第三者評価（→ Credibility）
- 競合との比較（→ Differentiation）
- 単なる設立情報（→ Identity）
- 「どんな企業が使うか」という文脈のみ（→ UseCase）

**境界ケース**

| Evidence | 判定 | 理由 |
|---------|------|------|
| 「Salesforce — Slack・Tableau・MuleSoft買収によるエコシステム拡大」（salesforce-ev-003）| Capability ✓ + Credibility ✓ | 「何を提供できるか」（Capability）と「買収による規模実績」（Credibility）が共存する。財務イベントは Credibility だが、統合後のサービス範囲拡大は Capability として付与を認める |
| 「Microsoft公式 — 企業概要・事業領域」（microsoft-ev-001）| Identity ✓ + Capability ✓ + Credibility ✓ | 「2024年度売上高2,450億ドル超」が混在するケース。売上規模は Credibility として追加付与が正しい |
| 「Uber 公式サイト・企業情報」（uber-ev-001）| 現状 Identity のみ | description は「企業概要・事業内容・グローバル展開情報」。事業内容の具体記述がないため Capability は付与しない。新規 Evidence が必要 |

**重要注記（Gap填補の原則）**

> Uber の場合、既存 Evidence に Capability を無理に付与するのではなく、  
> 「Uber のライドシェア・宅配プラットフォームとしての機能説明」を新規 Evidence として追加すべきである。  
> 内容のない Evidence に機能軸のラベルを貼ることは Coverage の水増しであり Policy 違反。

---

### 1-3. Differentiation（他との違い・独自性・強み）

**本質**: Entity が「競合・代替と比較して何が異なるか・なぜ選ばれるか」を説明する情報。

**付与してよいEvidence**

| パターン | 典型例 |
|---------|--------|
| 競合との明示的比較 | 「HubSpot vs Salesforce — HubSpotはSMB向けオールインワン・Salesforceはエンタープライズ向け」 |
| 他に存在しない独自機能 | 「カスタムGPTsによる独自AIエージェントの作成・配布（プログラミング不要）」 |
| 独自の設計思想・手法 | 「Constitutional AI — AI自身が原則に従って出力を評価・修正する独自安全性設計」 |
| 市場での地位の独自性 | 「AI-firstコードエディタとして複数モデルを切り替え可能（VS Codeベース）」 |
| 買収・破談の事実が競合優位を示す場合 | 「AdobeによるFigma買収提案（約200億ドル）が競合優位を証明」 |
| 創業文脈・設立理由が差別化を示す | 「OpenAI出身の研究者が安全なAI開発のために設立」→ Anthropicの Differentiation |
| 人物の独自思想・著作 | 「Hit Refresh で成長マインドセットを提唱した経営哲学」（Satya Nadella） |
| 「初」「唯一」「最多」を示す記録 | 「投手・打者の二刀流でMVPを受賞したのはMLB史上初」（Ohtani） |

**付与してはいけないEvidence**

- 機能の説明だけで他社との比較が含まれない（→ Capability）
- 受賞・数値実績だけ（→ Credibility）
- 単なる設立情報（→ Identity）

**境界ケース**

| Evidence | 判定 | 理由 |
|---------|------|------|
| 「設立：2021年。OpenAI出身の研究者チームが創業」（anthropic-ev-004）| Identity ✓ + Differentiation ✓ | 設立事実（Identity）と「なぜ OpenAI を離れたか = 安全性重視」という差別化根拠（Differentiation）が同居する。Differentiation 付与は妥当 |
| 「Messi vs Ronaldo — サッカー史上最高議論とスタイルの対比」（lionel-messi-ev-003）| Credibility ✓ + Differentiation ✓ | 比較議論は Differentiation だが、評価されているという事実は Credibility にも貢献する |
| 「CUDA プラットフォーム」（jensen-huang-ev-004）| Credibility ✓ + Differentiation ✓ | CUDA による影響は「NVIDIAの独自的優位性」（Differentiation）と「AIブームの技術基盤を作った」という Credibility を兼ねる |
| 「aisle 設立：2025年5月13日」（aisle-ev-019）| Identity ✓ + Differentiation ✓（現状） | 「出現設計という分野で最初期から事業化」という文脈で Differentiation が付与されている。単体では Identity のみだが、Presentation 出典と組み合わせた文脈では許容範囲 |

---

### 1-4. Credibility（信頼できる根拠・実績・第三者評価）

**本質**: Entity について「第三者・外部・計測可能な指標」が証明する信頼性の根拠。

**付与してよいEvidence**

| パターン | 典型例 |
|---------|--------|
| 受賞・表彰（外部評価） | 「バロンドール8回受賞（史上最多）」「MVP満票受賞」「ノーベル化学賞受賞対象」 |
| 利用規模・数値実績（計測値） | 「月間2億7000万人超の契約者」「25万社以上が利用」「175万店舗以上」「500本以上の制作実績」 |
| 大型投資・買収（外部評価） | 「AmazonとGoogleから合計43億ドル超の投資」「Microsoftが75億ドルで買収」 |
| 売上・財務指標（公開数値） | 「2024年度売上高2,450億ドル超」「FY2023 売上高888億ドル」 |
| クライアント実績 | 「MIXI・FuRyu・LINE Digital Frontier がクライアントに含まれる」 |
| 本番稼働している事実 | 「Aisle StudioからRefBaseへの保存・取得が本番稼働」（自社実績の場合）|
| 業界標準としての評価 | 「Premiere Proは映像編集の業界標準」「CUDA はAIの技術基盤に」 |
| 第三者メディアの分析・引用 | 「HBRのプラットフォームビジネスモデル分析記事に取り上げられた」 |
| G2/Capterra等レビューサイトでの評価 | 「G2・Capterraでコストパフォーマンスが評価されている」 |
| 発表・スピーチへの社会的反応 | 「ChatGPTは5日で100万ユーザー・2ヶ月で1億ユーザーを達成」 |

**付与してはいけないEvidence**

- 機能の説明だけ（機能があっても使われているとは限らない → Capability）
- 「〜と設立された」という設立の事実だけ（→ Identity）
- 比較優位の主張だけ（→ Differentiation）

**境界ケース — これが最も誤りやすい**

| Evidence | 判定 | 理由 |
|---------|------|------|
| 「chatgpt-ev-001〜005」全件（機能説明） | Credibility ✗ | 「テキスト生成に対応している」という仕様説明は信頼の根拠にならない。利用者数や受賞歴が記載されていれば別 |
| 「Midjourney V6 最新モデルの表現力と精度」（midjourney-ev-002）| Credibility ✓ | 「プロンプトへの従順性と光・質感の描写が従来モデルを上回ると評価されている」という第三者的評価を含む |
| 「Constitutional AI 手法の開発」（anthropic-ev-003）| Credibility ✓ + Differentiation ✓ | 「独自手法を開発した」という実績（Credibility）と「他社との設計上の違い」（Differentiation）が共存する |
| 「Uber IR・年次報告書（uber-ev-002）」| Credibility ✓（財務実績）のみ | 売上やGMV等の数値は Credibility。「Uberの事業能力」には触れていないため Capability は付与しない |

**⚠️ chatgpt への Credibility 付与について**

> chatgpt の既存5件には Credibility を付与できる内容が存在しない。  
> 「月間アクティブユーザー数」「企業・政府機関の導入事例」「技術報告書の引用実績」などを  
> 新規 Evidence として追加することが必要。  
> これは Evidence の不足であり、coverageType の誤設定ではない。

---

### 1-5. UseCase（誰がどう使うか・どんな課題を解くか）

**本質**: Entity が「どんな人・組織・状況で使われ、どんな課題を解くか」を説明する情報。

**付与してよいEvidence**

| パターン | 典型例 |
|---------|--------|
| 具体的な利用シーン・業務用途 | 「映像制作会社がブランドムービーを制作する際に一貫して担う」 |
| 対象ユーザーの明示 | 「SMB〜中規模企業向けのオールインワン設計」「フリーランス・デザイナー層が採用」|
| 実際の利用事例（CaseStudy） | 「Aisle 自社で Phase0〜4 を設計・実装した」「anchor-artworks に出現設計を実施し本番稼働」 |
| クライアント名の列挙（誰が使うかの証左） | 「MIXI・FuRyu・LINE Digital Frontier がクライアント」 |
| 「誰の何を解くか」を含む説明 | 「ChatGPT Searchで最新情報を参照した回答を得たい利用者向け（Plus以上）」 |
| プロの業務での採用 | 「Netflix・Disney+向けコンテンツ制作でも使われ、映像制作プロが選ぶデファクトスタンダード」 |

**付与してはいけないEvidence**

- 機能の説明だけで誰が使うかの文脈がない（→ Capability）
- 受賞歴（→ Credibility）
- 設立情報（→ Identity）

**境界ケース**

| Evidence | 判定 | 理由 |
|---------|------|------|
| 「GitHub Copilot Chat — コードに関する自然言語対話機能」（github-copilot-ev-003）| Credibility ✓（現状）だが UseCase も妥当 | 「コードの説明・デバッグ・リファクタリングをチャット形式で実行」は誰がどう使うかを含む。UseCase の追加付与を推奨 |
| 「Netflix — エンターテインメント業界の変革とコンテンツ市場への影響」（netflix-ev-004）| Credibility ✓ + UseCase ✓（現状）| 「Blockbuster等を実質消滅させた」は Credibility。UseCase は「既存レンタル業態の代替として使われた」を示すため共存が正しい |

---

## 2. 複数 CoverageType の共存ルール

**原則**: 1つの Evidence が複数の軸を同時にカバーすることは正常であり、推奨される。

**共存パターンのガイドライン**

| 共存 | 典型的な発生条件 |
|------|--------------|
| Identity + Capability | 「設立情報 + 事業内容」を1 Evidence に含む場合（openai-ev-003, netflix-ev-001）|
| Capability + Differentiation | 「他社にない機能」の説明（chatgpt-ev-004, cursor-ev-001）|
| Credibility + Differentiation | 「業界で最初・唯一・最多」を示す受賞・記録（shohei-ohtani-ev-003, lionel-messi-ev-001）|
| Credibility + UseCase | 「実際のクライアント事例」（anchor-artworks-ev-006〜013）|
| Credibility + Capability + UseCase | 「本番稼働している実装が、機能を示し、利用事例になっている」（aisle-ev-001〜005）|

**共存を禁止するケース**

- 内容のない Evidence に Coverage を増やすための多重付与（水増し禁止）
- 「製品を提供している事実」だけで Credibility を付与する（機能があることは信頼の証明ではない）

---

## 3. Unknown Entity Test（新規 Entity への適用検証）

このPolicyが「無名企業・新サービス・人物」にも正しく機能するかを検証する。

### ケース A: 無名な中小ソフトウェア会社「株式会社サクラシステム（仮）」

**想定 Evidence**:

1. 「2020年設立。東京都渋谷区。受発注管理SaaSを提供」
2. 「月額9,800円〜。無料トライアル14日間あり」
3. 「小売・飲食・製造業向け」
4. 「導入後、発注ミスが月平均12件から1件に削減（顧客A社証言）」
5. 「他の受発注ツールと異なり、LINE連携で発注通知を受け取れる」

| Evidence | Policy適用結果 |
|---------|-------------|
| 1 | Identity（設立・場所・事業分類） |
| 2 | Capability（プラン・利用可能条件） |
| 3 | UseCase（対象ユーザー・業種） |
| 4 | Credibility（顧客の数値実績証言） |
| 5 | Capability（機能）+ Differentiation（LINE連携という独自機能）|

→ 全5軸が揃う。Template 6/6 UNLOCKED 可能。Policy が正しく機能している。

### ケース B: 新設スタートアップで実績なし「Luminary（AIデザインツール・仮）」

**想定 Evidence**:

1. 「2025年11月創業。Y Combinator出身チームが開発」
2. 「AIで制作物のカラーパレットを自動生成する機能」
3. 「デザイナーがブランドカラーを10秒で確定できる」

| Evidence | Policy適用結果 |
|---------|-------------|
| 1 | Identity（創業事実）+ Credibility（YC出身は第三者評価の一種）|
| 2 | Capability（機能説明）|
| 3 | UseCase（誰がどんな課題で使うか）|

→ Differentiation（他のデザインツールとの差異）と Credibility（YC以外の外部評価）が不足。  
Coverage Engine は P-02・P-03・P-06 を LOCKED とし、missingTypes に Differentiation・Credibility を返す。  
**Coverage Engine の動作が正しく、Policyが機能している。**

### ケース C: スポーツ選手「鈴木 一郎 投手（架空）」

**想定 Evidence**:

1. 「2003年生まれ。広島東洋カープ所属。先発投手」
2. 「直球最速154km/h。変化球はスライダー・チェンジアップ・フォーク」
3. 「2025年セ・リーグ最多勝（17勝）」
4. 「チームの開幕投手を担う」

| Evidence | Policy適用結果 |
|---------|-------------|
| 1 | Identity（経歴・所属） |
| 2 | Capability（何ができるか） |
| 3 | Credibility（タイトル実績）+ Differentiation（最多勝という記録の独自性）|
| 4 | UseCase（どんな役割で使われるか）|

→ 全5軸が揃い 6/6 UNLOCKED。Policyが人物 Entity にも正しく機能している。

---

## 4. sourceClass と CoverageType の相関（傾向分析）

152件の分析から見えた sourceClass ごとの典型付与パターン。

| sourceClass | 多く付与される CoverageType | 理由 |
|------------|--------------------------|------|
| Profile | Identity / Capability | 組織・人物の概要説明 |
| Specification | Capability | 機能・仕様・プランの説明 |
| CaseStudy | Credibility / UseCase | 実績・クライアント事例・利用シーン |
| Benchmark | Credibility / Differentiation | 比較計測・受賞・記録 |
| Research | Credibility / Differentiation | 論文・独自手法・調査 |
| Financial | Credibility | 売上・投資・財務実績 |
| Announcement | Credibility / Identity | 公式発表・規模報告 |
| Interview | Differentiation / Credibility | 発言・思想・経営哲学 |
| Presentation | Identity / Differentiation | 自己紹介・ポジショニング |
| Documentation | Capability | 機能解説・マニュアル |

**注意**: sourceClass と CoverageType は強い相関を持つが、決定的ではない。  
例：Financial（→ 通常 Credibility）でも、事業内容を詳述していれば Capability を追加付与する。  
Content が優先、sourceClass は補助的な判断材料。

---

## 5. 誤付与パターン一覧（Anti-patterns）

| 誤り | 典型例 | 正しい対応 |
|------|--------|-----------|
| 機能説明に Credibility を付与 | 「テキスト生成に対応」→ Credibility ✗ | 利用規模・受賞・第三者引用があって初めて Credibility |
| IR資料に Capability を付与 | 「売上348億ドル」→ Capability ✗ | 売上は Credibility。事業内容の記述があれば別 |
| 設立情報に Differentiation を付与（根拠なし） | 「2025年設立」→ Differentiation ✗ | 「なぜ設立されたか・競合と何が違うか」の記述がある場合のみ付与可 |
| 空っぽな Identity Evidence への多重付与 | 「Figma公式サイト（説明なし）」→ Capability + Differentiation ✗ | description が薄い Evidence は Identity 1軸に留め、詳細は別 Evidence に分離 |
| Coverage を上げるための強引な付与 | Uber ev-001 に Capability を追加 | 内容がなければ新規 Evidence 作成が正解 |

---

## 6. 現行 Evidence の課題と推奨対応

### 6-1. chatgpt（4/6 LOCKED）

| 不足軸 | 原因 | 推奨対応 |
|--------|------|----------|
| Credibility | 5件すべてが機能仕様説明（Specification）。第三者評価・利用規模・受賞歴がゼロ | 新規 Evidence 追加：①月間アクティブユーザー規模 ②企業・政府機関の導入事例 ③GPT-4 技術報告書への引用実績 |

### 6-2. uber（2/6 LOCKED）

| 不足軸 | 原因 | 推奨対応 |
|--------|------|----------|
| Capability | 既存3件が Identity / Credibility / UseCase のみ。「何ができるか」の説明がない | 新規 Evidence 追加：Uberのライドシェア・宅配・Uber Eats 等のサービス機能説明 |
| Differentiation | 同上 | 新規 Evidence 追加：「グローバルマーケットプレイス設計」「サージプライシング等の独自機能」「配車アプリ市場での先駆性」 |
| 参考：uber-ev-003（HBR記事）への追加付与 | description に「プラットフォームビジネスの代表事例としての事業モデル分析」とあり、Capability・Differentiation の付与が妥当と判断できる | uber-ev-003 に Capability + Differentiation を追加付与することで 6/6 が実現可能。ただし description の記述が薄いため、新規 Evidence との組み合わせが望ましい |

### 6-3. 全体的な傾向

| 課題 | 件数 | 対応 |
|------|------|------|
| 説明が薄すぎる Evidence（description < 30文字相当） | figma-ev-001, shopify-ev-001, zoho-crm-ev-001 等 | description を充実させるか、詳細を別 Evidence に分離 |
| sourceClass が未設定または不正確 | （今回の調査では全件付与済み） | — |
| Capability が0件の Entity | uber | 新規 Evidence 追加 |
| Credibility が0件の Entity | chatgpt | 新規 Evidence 追加 |

---

## 7. Policyの運用ルール

1. **判断順序**: Content（description）を読む → 何について語っているかを特定 → Policy の表と照合 → 付与
2. **迷ったら少なく**: 確信がない軸は付与しない。Coverage の水増しは Coverage Engine の判断を歪める
3. **1 Evidence = 1主張が理想**: description が複数の主張を含む場合は Evidence を分割する（Quality Sprint以降で対応）
4. **Unknown Entity Test を毎回実施**: 新規 Entity に初めて Evidence を付与する際、無名会社仮定で Policy を適用し、特定企業バイアスがないことを確認する
5. **Policy 改訂条件**: 全 Entity の 20% 以上で新しい境界ケースが発生した場合、またはアーキテクチャ変更（Coverage 軸の追加等）があった場合に v1.1 へ改訂する
6. **KV への保存**: 本 Policy は将来的に `refbase:policy:coverageClassification` に登録し、生成ロジックが参照できるようにする（Policy Layer 設計に従う）

---

## 付録：分析対象 Evidence 統計

| CoverageType | 付与件数 | 実質的な重複を除いた Evidence 数 |
|--------------|---------|-------------------------------|
| Identity | 48 付与 | 約38 Evidence |
| Capability | 65 付与 | 約55 Evidence |
| Differentiation | 33 付与 | 約28 Evidence |
| Credibility | 83 付与 | 約65 Evidence |
| UseCase | 48 付与 | 約38 Evidence |
| 未付与（0件） | 0 件 | 全152件が1軸以上付与済み |

※ 1 Evidence が複数 CoverageType を持つため、付与件数合計 > 152件。

**策定者**: Coverage Policy Sprint（2026-06-29）  
**次回改訂条件**: Quality Sprint完了後 または Coverage軸追加時
