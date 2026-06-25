// 日本語テキストの近さ判定ヘルパ（共食い/関連スポーク選定で使う）。
// 日本語は空白で語が切れず複合語が繋がるため、トークン重なりだけだと取りこぼす。
// 文字レベルの包含率を併用すると長い複合語に強い（keywordScout と同方針）。

const STRIP = /[\sの をにではがとも・,。、/｜|【】]/g

/** タイトル/KWを語トークン集合に（記号/数字/装飾を除去、2文字以上）。 */
export function tokens(s) {
  return new Set(
    (s || '')
      .replace(/【[^】]*】|\d+|｜|\|/g, ' ')
      .split(/[\s・,。、/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  )
}

/** a のトークンが b にどれだけ含まれるか（|A∩B|/|A|）。 */
export function overlap(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size) return 0
  let n = 0
  for (const t of A) if (B.has(t)) n++
  return n / A.size
}

/** 文字集合（助詞/記号を畳んだ実質文字）。 */
export function chars(s) {
  return new Set((s || '').replace(STRIP, ''))
}

/** kw の文字が topics のいずれかにどれだけ含まれるかの最大値（0..1）。 */
export function containedFrac(kw, topics) {
  const c = chars(kw)
  if (!c.size) return 0
  let best = 0
  for (const top of topics) {
    const t = chars(top)
    let n = 0
    for (const ch of c) if (t.has(ch)) n++
    best = Math.max(best, n / c.size)
  }
  return best
}
