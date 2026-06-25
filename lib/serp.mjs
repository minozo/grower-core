// DataForSEO live SERP(organic) の上位取得。認証は環境変数（リポジトリにハードコードしない）:
//   DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD
// killer / (将来的に measure) から共有する純データ取得層。node組込み + fetch のみ。
const LOGIN = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const PASS = process.env.DATAFORSEO_PASSWORD

export function hasCreds() {
  return Boolean(LOGIN && PASS)
}

// 上位 organic を [{rank, domain, url, title}] で返す（type=organic のみ・www除去）。
export async function serpTop(keyword, { locationCode = 2392, depth = 10 } = {}) {
  if (!hasCreds()) throw new Error('DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD 未設定')
  const auth = Buffer.from(`${LOGIN}:${PASS}`).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ language_code: 'ja', location_code: locationCode, keyword, depth }]),
  })
  const json = await res.json()
  const items = json?.tasks?.[0]?.result?.[0]?.items || []
  return items
    .filter((i) => i.type === 'organic')
    .map((i) => ({ rank: i.rank_absolute, domain: (i.domain || '').replace(/^www\./, ''), url: i.url, title: i.title }))
}
