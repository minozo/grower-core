// killer ― head KW で「上位を抜く」キラーページ(skyscraper)のブリーフを決定論的に作る。
// ① SERP逆算: live SERP 上位ページを取得し競合の顔ぶれを把握
// ② 自社データ堀: 掲載企業データの独自集計(都道府県/カテゴリ分布)を算出 ← 競合が持てない差別化
// ③ 共食い判定: 既存記事/主要ページと近すぎないか。近い既存があれば「新規」でなく「昇格/統合」を促す
// ④ 内部リンク計画: 商用ハブ + 関連スポーク(既存記事)を提案
// 生成(本文)はLLM(killer-run)が担う。ここは素材作りと判定に徹し、数値はコードが確定させる(G1)。
//
// 認証: 環境変数 DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD
// usage: node killer.mjs "<headKW>" [--depth=10] [--dry]
import { load, save } from './lib/state.mjs'
import { loadArticles } from './lib/content.mjs'
import { loadCompanies } from './lib/content.mjs'
import { config } from './lib/config.mjs'
import { serpTop, hasCreds } from './lib/serp.mjs'
import { aggregateMoat } from './lib/moat.mjs'
import { containedFrac } from './lib/text.mjs'

const cfg = config()

function slugify(kw) {
  return 'killer-' + Buffer.from(kw).toString('hex').slice(0, 12)
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const depth = Number((args.find((a) => a.startsWith('--depth=')) || '--depth=10').split('=')[1])
  const headKW = args.filter((a) => !a.startsWith('--')).join(' ').trim()
  if (!headKW) {
    console.log('usage: killer.mjs "<headKW>" [--depth=10] [--dry]')
    process.exit(2)
  }

  // ② 自社データ堀（認証不要・常に算出。これが差別化の核）
  const companies = loadCompanies()
  const moat = aggregateMoat(companies)

  // ③ 共食い判定 + ④ スポーク候補（headKWの文字がどれだけ記事タイトルに含まれるか＝関連度）
  const articles = loadArticles()
  const ranked = articles
    .map((a) => ({ slug: a.slug, title: a.title, score: containedFrac(headKW, [a.title]) }))
    .sort((x, y) => y.score - x.score)
  const upgrade = ranked.find((r) => r.score >= 0.85) || null // ほぼ同一head＝新規でなく昇格/統合を検討
  const spokes = ranked.filter((r) => r.score >= 0.5 && r.slug !== upgrade?.slug).slice(0, 3).map((r) => `/articles/${r.slug}/`)
  const hub = cfg.killerHub || null

  // ① SERP逆算（認証があるときだけ）
  let serp = []
  let ownRank = null
  if (dry) {
    console.log('（--dry）SERP取得はスキップ。データ堀/共食い/内部リンクのみ算出。')
  } else if (!hasCreds()) {
    console.log('⚠️ DATAFORSEO 未設定 → SERP逆算をスキップ（データ堀/内部リンクは算出）。')
  } else {
    serp = await serpTop(headKW, { locationCode: cfg.locationCode, depth })
    const own = serp.find((s) => (s.domain || '').includes(cfg.siteDomain))
    ownRank = own ? own.rank : null
  }

  const targetChars = cfg.killerMinChars || 3500
  const brief = {
    id: slugify(headKW),
    type: 'killer',
    stage: 'briefed',
    headKW,
    serp: serp.map((s) => ({ rank: s.rank, domain: s.domain, title: s.title, url: s.url, own: (s.domain || '').includes(cfg.siteDomain) })),
    ownRank,
    moat,
    upgrade,          // {slug,title,score} or null
    hub,              // 商用ハブのルート（config.killerHub）
    spokes,           // 関連スポーク(既存記事ルート)
    targetChars,
    createdAt: new Date().toISOString().slice(0, 10),
  }

  // killers.json へ upsert（同一headKWは置換）
  if (!dry) {
    const store = load('killers')
    store.items = (store.items || []).filter((k) => k.id !== brief.id)
    store.items.push(brief)
    save('killers', store)
  }

  // ── 人間向けサマリ ──
  console.log(`\n━━ killer brief: 「${headKW}」 (${cfg.siteName}) ━━`)
  if (serp.length) {
    console.log(`\n▶ SERP逆算（上位${serp.length}）${ownRank ? ` / 自サイト現在 ${ownRank}位` : ' / 自サイトは圏外'}`)
    for (const s of serp.slice(0, depth)) console.log(`  ${String(s.rank).padStart(2)}. ${s.own ? '★' : ' '}${s.domain}  ${(s.title || '').slice(0, 42)}`)
  }
  console.log(`\n▶ 自社データ堀（掲載企業 ${moat.total}社の独自集計・本文に出典付きで掲載）`)
  console.log(`  都道府県: ${moat.prefectureCount}都道府県` + (moat.prefectures.length ? `（最多 ${moat.prefectures.slice(0, 5).map(([k, n]) => `${k}${n}`).join(' / ')}）` : ''))
  for (const [k, list] of Object.entries(moat.facets)) {
    console.log(`  ${k}: ` + list.slice(0, 6).map(([v, n]) => `${v}${n}`).join(' / '))
  }
  console.log(`\n▶ 共食い/昇格`)
  console.log(upgrade ? `  ⚠️ 近い既存記事あり: ${upgrade.slug}「${upgrade.title}」(重なり${Math.round(upgrade.score * 100)}%) → 新規でなく昇格/統合を検討` : '  既存と大きな重複なし → 新規キラーページでOK')
  console.log(`\n▶ 内部リンク計画`)
  console.log(`  ハブ: ${hub || '（config.killerHub 未設定 → 設定推奨）'}`)
  console.log(`  スポーク: ${spokes.join(' / ') || '（関連記事なし）'}`)
  console.log(`\n▶ 目標: 本文 ${targetChars}字+ / 独自集計テーブルを必ず掲載 / 監修者明記（E-E-A-T）`)
  if (!dry) console.log(`\n✅ ブリーフ保存: seo-research/pipeline/killers.json (id=${brief.id})  → \`npm run grow killer-run\` で執筆〜公開`)
}

main().catch((e) => { console.error(e); process.exit(1) })
