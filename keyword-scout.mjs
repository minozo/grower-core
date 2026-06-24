// keywordScout ― backlogに新しい記事KWを自動補充する。
// DataForSEO Labs の keyword_suggestions でシード語の関連KWを取得し、
// ①商品撮影intentに合う ②SNS一般/求人等の不一致を除外 ③既存記事と共食いしない
// ④既にbacklogに無い ものだけを、ボリューム順に上位N件 stage=keyword で追加する。
//
// 認証: 環境変数 DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD
// usage: node scripts/grower/keyword-scout.mjs [--n=5] [seed ...]
import { load, save } from './lib/state.mjs'
import { loadArticles } from './lib/content.mjs'
import { config } from './lib/config.mjs'

const LOGIN = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const PASS = process.env.DATAFORSEO_PASSWORD
const cfg = config()

// シード・intent判定はサイト固有（grower.config.json）。無ければconfigの既定。
const DEFAULT_SEEDS = cfg.keywordSeeds
// 語順・助詞・空白の違いを畳む正規シグネチャ（同一intentの重複を1つに）
const canon = (kw) => [...(kw || '').replace(/[\sの をにではがとも・,。、/｜|]/g, '')].sort().join('')
const FIT = new RegExp(cfg.keywordFit)
const NG = new RegExp(cfg.keywordNg, 'i')

function tokens(s) {
  return new Set((s || '').replace(/【[^】]*】|\d+/g, ' ').split(/[\s・,。、/｜|]+/).map((t) => t.trim()).filter((t) => t.length >= 2))
}
function overlap(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size) return 0
  let n = 0; for (const t of A) if (B.has(t)) n++
  return n / A.size
}

async function suggestions(seed) {
  const auth = Buffer.from(`${LOGIN}:${PASS}`).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword: seed, language_code: 'ja', location_code: 2392, limit: 80 }]),
  })
  const j = await res.json()
  const items = j?.tasks?.[0]?.result?.[0]?.items || []
  return items.map((i) => ({ keyword: i.keyword, vol: i.keyword_info?.search_volume ?? 0 }))
}

function slugify(kw) {
  return 'kw-' + Buffer.from(kw).toString('hex').slice(0, 12)
}

async function main() {
  const args = process.argv.slice(2)
  const n = Number((args.find((a) => a.startsWith('--n=')) || '--n=5').split('=')[1])
  const minVol = Number((args.find((a) => a.startsWith('--minvol=')) || '--minvol=10').split('=')[1])
  const seeds = args.filter((a) => !a.startsWith('--'))
  const useSeeds = seeds.length ? seeds : DEFAULT_SEEDS
  if (!LOGIN || !PASS) { console.log('❌ DATAFORSEO_USERNAME/PASSWORD 未設定'); process.exit(1) }

  const articles = loadArticles()
  const data = load('articles')
  // 既存トピック文字列（記事タイトル＋既存backlog KW、空白除去）
  const existingTopics = [
    ...articles.map((a) => (a.title || '').replace(/\s/g, '')),
    ...data.items.map((i) => (i.keyword || '').replace(/\s/g, '')),
  ].filter(Boolean)
  // 文字レベルの含有率（日本語の長い複合語に強い）。候補の文字がどれだけ既存トピックに
  // 含まれるか = |chars(kw)∩chars(topic)|/|chars(kw)|。最大値が高ければ共食い。
  const chars = (s) => new Set((s || '').replace(/[\sの をにではがとも・,。、/｜|【】]/g, ''))
  const containedFrac = (kw, topics) => {
    const c = chars(kw)
    if (!c.size) return 1
    let best = 0
    for (const top of topics) {
      const t = chars(top)
      let n = 0
      for (const ch of c) if (t.has(ch)) n++
      best = Math.max(best, n / c.size)
    }
    return best
  }

  // 候補を全シードから集約 → vol降順 → 貪欲に「既存とも採用済みとも被らない」ものだけ採用
  const all = new Map()
  for (const seed of useSeeds) {
    for (const c of await suggestions(seed)) {
      if (!c.keyword || !FIT.test(c.keyword) || NG.test(c.keyword)) continue
      if ((c.vol || 0) < minVol) continue // 低vol/0のノイズを落とす
      const sig = canon(c.keyword)
      const prev = all.get(sig)
      if (!prev || c.vol > prev.vol) all.set(sig, c)
    }
  }
  const sorted = [...all.values()].sort((a, b) => b.vol - a.vol)
  const pool = new Map()
  const acceptedTopics = []
  for (const c of sorted) {
    if (containedFrac(c.keyword, existingTopics) >= 0.75) continue        // 既存記事/KWと被る
    if (acceptedTopics.length && containedFrac(c.keyword, acceptedTopics) >= 0.72) continue // 採用済みと被る
    pool.set(canon(c.keyword), c)
    acceptedTopics.push(c.keyword.replace(/\s/g, ''))
  }

  const ranked = [...pool.values()].sort((a, b) => b.vol - a.vol).slice(0, n)
  if (!ranked.length) { console.log('新規KW候補なし（既出/不一致/共食いで除外）'); return }

  const today = new Date().toISOString().slice(0, 10)
  for (const c of ranked) {
    data.items.push({
      id: slugify(c.keyword), stage: 'keyword', keyword: c.keyword,
      volume: c.vol || null, intent: 'how-to',
      priority: Math.min(0.9, 0.4 + (c.vol || 0) / 5000),
      note: `keywordScout自動補充（seed群から発掘・intent/共食い/既出フィルタ通過）`, addedAt: today,
    })
  }
  save('articles', data)
  console.log(`✅ keywordScout: ${ranked.length}件をbacklogへ追加`)
  for (const c of ranked) console.log(`  + ${c.keyword}  (vol=${c.vol})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
