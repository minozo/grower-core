// 掲載企業データから「独自集計（データ堀）」を決定論的に作る。ニッチ非依存。
// 競合が持たない自社固有の集計値＝キラーページの差別化の核。LLMは数値を作らず、
// ここで算出した値を出典(自サイト掲載データ)付きで本文に載せる（G1 捏造ゼロの担保）。
// 入力フィールドはサイトで異なるため、存在するフィールドだけを防御的に集計する。

const PREF =
  /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/

// カテゴリ的な文字列/文字列配列フィールドの候補（存在するものだけ使う）
const FACET_KEYS = ['category', 'categories', 'tags', 'services', 'features', 'targetAudience']

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

/** companies(loadCompanies()) から都道府県分布 + カテゴリ系ファセット分布を返す。 */
export function aggregateMoat(companies, { facetTop = 12 } = {}) {
  const prefCount = new Map()
  const facetCounts = {} // key -> Map(value -> count)

  for (const c of companies) {
    // 都道府県は area / prefecture / 各種 address 文字列から抽出
    const addr = [c.area, c.prefecture, c.address, c.companyInfo?.address].filter(Boolean).join(' ')
    const pm = addr.match(PREF)
    if (pm) prefCount.set(pm[1], (prefCount.get(pm[1]) || 0) + 1)

    for (const k of FACET_KEYS) {
      const v = c[k]
      if (v == null) continue
      const vals = Array.isArray(v) ? v : [v]
      for (const raw of vals) {
        const s = String(raw).trim()
        if (!s || PREF.test(s)) continue // 住所っぽい値はファセットから除外
        facetCounts[k] ??= new Map()
        facetCounts[k].set(s, (facetCounts[k].get(s) || 0) + 1)
      }
    }
  }

  const facets = {}
  for (const [k, m] of Object.entries(facetCounts)) {
    if (m.size < 2) continue // 全社同値など集計価値の無いものは捨てる
    facets[k] = topN(m, facetTop)
  }

  return {
    total: companies.length,
    prefectureCount: prefCount.size,
    prefectures: topN(prefCount, 47),
    facets,
  }
}
