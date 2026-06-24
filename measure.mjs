// measurer ― 公開した記事のインデックス/順位を DataForSEO live SERP で追跡し、
// backlog に記録して優先度へ反映する。「量産」を「勝ち筋への集約」に変える最後のピース。
//
// 認証はリポジトリにハードコードしない。環境変数から読む（無ければ明示エラー）:
//   DATAFORSEO_USERNAME（または DATAFORSEO_LOGIN）/ DATAFORSEO_PASSWORD   (~/.bash_profile 等で設定)
//
// usage: node scripts/grower/measure.mjs            全published記事を計測
//        node scripts/grower/measure.mjs --dry      認証不要・対象一覧のみ
import { load, save } from './lib/state.mjs'
import { leadsByLandingPage } from './lib/ga4.mjs'

import { config } from './lib/config.mjs'

const LOGIN = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const PASS = process.env.DATAFORSEO_PASSWORD
const dry = process.argv.includes('--dry')
const cfg = config()

async function serpRank(keyword) {
  const auth = Buffer.from(`${LOGIN}:${PASS}`).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ language_code: 'ja', location_code: cfg.locationCode, keyword, depth: 100 }]),
  })
  const json = await res.json()
  const items = json?.tasks?.[0]?.result?.[0]?.items || []
  // 自サイトドメイン(config.siteDomain)の順位を拾う
  const hit = items.find((i) => i.type === 'organic' && (i.domain || '').includes(cfg.siteDomain))
  return hit ? { rank: hit.rank_absolute, url: hit.url } : { rank: null, url: null }
}

// 順位→優先度ヒント（次に何をするか）
function hint(weeksLive, rank) {
  if (rank == null) return weeksLive >= 4 ? '圏外4週+ → 内部リンク強化 or 角度変えて再強化' : 'インデックス待ち'
  if (rank <= 10) return 'top10 → このテーマを深掘り（関連スポーク追加）'
  if (rank <= 30) return 'top30 → あと一歩。本文の語密度/内部リンクを微調整'
  return 'top100 → 競合逆算で差別化を増やす'
}

async function main() {
  const data = load('articles')
  const targets = data.items.filter((it) => ['published', 'measured'].includes(it.stage) && it.keyword)
  if (!targets.length) { console.log('計測対象（published記事）なし'); return }

  console.log('━━ measurer: 公開記事の順位追跡 ━━')
  if (dry) { targets.forEach((t) => console.log(`  - ${t.keyword} (${t.url || t.slug})`)); return }
  if (!LOGIN || !PASS) {
    console.log('❌ DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD が未設定。~/.bash_profile を source してから実行してください。')
    process.exit(1)
  }

  const today = new Date().toISOString().slice(0, 10)
  const leads = await leadsByLandingPage(28) // GA4未設定なら null
  for (const t of targets) {
    const { rank, url } = await serpRank(t.keyword)
    const weeksLive = t.publishedAt ? Math.floor((Date.now() - Date.parse(t.publishedAt)) / 6048e5) : 0
    const cv = leads && t.url ? (leads.get(t.url) ?? 0) : null
    t.measured = { rank, rankedUrl: url, indexed: rank != null, cv, checkedAt: today }
    t.stage = 'measured'
    // 優先度: 圏外なら微増、ランクすれば微減。CVが出ているテーマは深掘り価値ありとして据え置き気味に。
    let p = rank == null ? (t.priority ?? 0.5) + 0.05 : (t.priority ?? 0.5) - 0.1
    if (cv && cv > 0) p += 0.15
    t.priority = Math.max(0.1, Math.min(1, p))
    const cvStr = cv == null ? '' : `  CV=${cv}`
    console.log(`  [${t.keyword}] rank=${rank ?? '圏外'}  週数=${weeksLive}${cvStr}  → ${hint(weeksLive, rank)}${cv > 0 ? ' / CV発生→深掘り候補' : ''}`)
  }
  save('articles', data)
  console.log('✅ backlog に計測結果を記録（stage=measured / priority更新）')
  console.log(leads ? `（GA4: generate_lead を ${leads.size} ページ分取得）` : '※ GA4未設定: CVはGA4_PROPERTY_ID + GOOGLE_APPLICATION_CREDENTIALS 設定後に自動取得')
}

main().catch((e) => { console.error(e); process.exit(1) })
