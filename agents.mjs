// grower のエージェント定義（役割・入出力・通すゲート）をコードで一元管理。
// オーケストレーターが「次に動かすべきエージェントと作業指示」を出すための仕様。
// LLM実行系（Claude Code subagent / Agent SDK）はこの spec を読んで生成タスクを担う。
// ＝「生成(LLM)」と「判定(コード=gates)」を分離する設計の中核。

export const AGENTS = {
  // ── パイプラインA：掲載企業の増加（高リスク／捏造ゼロ G1）──
  companyScout: {
    pipeline: 'companies',
    mission: '未掲載の実在する撮影代行・撮影会社を発掘する',
    inputs: ['DataForSEO SERP(商品撮影代行/業種別/エリア別)', '競合ディレクトリ(torun/meetsmore/ec-kanji)', 'Google Maps/ビジネスリスト'],
    outputs: ['候補 {name, url} の配列 → companies backlog(stage=discovered)'],
    gate: null,
    note: '実在・撮影サービスのみ。発掘段階では広く、判定はdedupに任せる',
  },
  companyValidator: {
    pipeline: 'companies',
    mission: '候補の重複・死活・関連性を判定し掲載可否を絞る',
    inputs: ['候補 {name, url}'],
    outputs: ['validated / rejected(理由付き)'],
    gate: 'scripts/grower/gates/dedup-company.mjs',
    note: 'dedup通過 + URL 200 + 撮影サービスである確認。NGは ng-list.mjs に追記',
  },
  companyEnricher: {
    pipeline: 'companies',
    mission: '公式サイトから Zodスキーマの各フィールドを抽出してJSON化',
    inputs: ['validated 企業の公式サイト'],
    outputs: ['src/content/companies/<NNN>.json（id/number自動採番）', 'sites.mjsへ追記'],
    gate: 'astro check（schema検証）',
    note: 'G1: サイト記載のみ。未記載は空欄/「要見積」。isRecommend=false固定・捏造禁止',
  },
  companyShooter: {
    pipeline: 'companies',
    mission: '公式サイトのスクショをheroImage化',
    inputs: ['企業URL'],
    outputs: ['src/assets/images/companies/<slug>.webp'],
    gate: '画像200・規定サイズ',
    note: '既存 scripts/capture-hero-screenshots.mjs を流用',
  },

  // ── パイプラインB：記事の増加（中リスク／アンチslop G2・共食い禁止 G3）──
  keywordScout: {
    pipeline: 'articles',
    mission: '勝てる空白KWを発掘（torun未カバー長尾・低KD how-to・関連語）',
    inputs: ['DataForSEO keywords/SERP', '既存30記事'],
    outputs: ['KW候補(vol/KD/intent/優先度) → articles backlog(stage=keyword)'],
    gate: 'scripts/grower/gates/cannibalize.mjs',
    note: 'G3: 既存とKW/intent重複は弾く。seo-cluster/seo-dataforseo を利用',
  },
  briefStrategist: {
    pipeline: 'articles',
    mission: '上位ページを逆算して設計（文字数・KW密度目標・見出し・内部リンク・監修者）',
    inputs: ['対象KW', 'SERP上位ページ'],
    outputs: ['brief（数値目標つき） → stage=briefed'],
    gate: null,
    note: 'seo-content-brief / seo-sxo を利用。代行LPで実証した定量逆算手法',
  },
  articleWriter: {
    pipeline: 'articles',
    mission: 'briefに沿って本文生成（article-writing-rules.md §1-§4 / E-E-A-T §2 準拠）',
    inputs: ['brief'],
    outputs: ['src/content/articles/<slug>.md（frontmatter込み）→ stage=drafted'],
    gate: null,
    note: '3監修者から主題で選択。出典付き数値・作例にAI画像を使わない',
  },
  slopCritic: {
    pipeline: 'articles',
    mission: '§7/§8で採点し、writerへ改稿指示を返す反復ゲート',
    inputs: ['draft .md'],
    outputs: ['pass / 改稿指示'],
    gate: 'scripts/grower/gates/slop-lint.mjs + scripts/grower/gates/linkcheck.mjs',
    note: 'G2: slop=0・KW目標・3層リンク。合否はコードが決定（LLM判定にしない）',
  },
  articleIllustrator: {
    pipeline: 'articles',
    mission: 'heroImage生成（Codex imagegen）→webp最適化',
    inputs: ['記事主題'],
    outputs: ['src/assets/images/articles/<NNN>-*.webp'],
    gate: '画像規定',
    note: 'グローバル規則: Codex経由・画像内テキスト禁止・作例にしない',
  },

  // ── 共通：計測フィードバック ──
  measurer: {
    pipeline: 'both',
    mission: '公開後のインデックス→順位→CVを追跡し優先度に反映',
    inputs: ['DataForSEO live SERP', 'GA4 generate_lead'],
    outputs: ['stage=measured + backlog優先度更新 + findings追記'],
    gate: null,
    note: '伸びたテーマは深掘り・薄い物は刈る。ただの量産との分かれ目',
  },
}

export function listAgents() {
  return Object.entries(AGENTS).map(([id, a]) => ({ id, ...a }))
}
