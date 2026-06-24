// companyScout ― 掲載候補の実在企業を発掘して companies backlog に積む（決定論）。
// DataForSEO SERP(地域×サービス)から organic ドメインを集め、メディア/ポータル/マーケット
// を除外し、既存93社・sites・ng-list と dedup、URL生存(200)を確認して stage=discovered で追加。
// ※「撮影サービスか」「実フィールド」の判定・抽出は後段の company-autorun(LLM)が G1 で担う。
//
// 認証: DATAFORSEO_USERNAME(or _LOGIN) / DATAFORSEO_PASSWORD
// usage: node scripts/grower/company-scout.mjs [--n=8] [追加クエリ ...]
import { load, save } from './lib/state.mjs'
import { loadCompanies, hostOf, ROOT } from './lib/content.mjs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { config } from './lib/config.mjs'

const LOGIN = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const PASS = process.env.DATAFORSEO_PASSWORD
const cfg = config()

// 発掘クエリ・除外ホストはサイト固有（grower.config.json）。無ければconfig既定。
const DEFAULT_QUERIES = cfg.companyQueries
const NG_HOST = new RegExp(cfg.companyNgHost, 'i')

async function serpDomains(query) {
  const auth = Buffer.from(`${LOGIN}:${PASS}`).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ language_code: 'ja', location_code: 2392, keyword: query, depth: 20 }]),
  })
  const j = await res.json()
  const items = j?.tasks?.[0]?.result?.[0]?.items || []
  return items.filter((i) => i.type === 'organic').map((i) => ({ domain: i.domain, url: i.url, title: i.title }))
}

async function loadOptional(rel, key) {
  try { return (await import(pathToFileURL(path.join(ROOT, rel)).href))[key] || [] } catch { return [] }
}
async function alive(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    return r.ok || r.status === 405 // HEAD不可でも存在はする
  } catch { return false }
}

async function main() {
  const args = process.argv.slice(2)
  const n = Number((args.find((a) => a.startsWith('--n=')) || '--n=8').split('=')[1])
  const queries = args.filter((a) => !a.startsWith('--'))
  const useQ = queries.length ? queries : DEFAULT_QUERIES
  if (!LOGIN || !PASS) { console.log('❌ DATAFORSEO_USERNAME/PASSWORD 未設定'); process.exit(1) }

  const companies = loadCompanies()
  const sites = await loadOptional('scripts/sites.mjs', 'sites')
  const ng = await loadOptional('scripts/ng-list.mjs', 'ngList')
  const data = load('companies')
  const known = new Set([
    ...companies.map((c) => c.host),
    ...sites.map((s) => hostOf(s.url)),
    ...data.items.map((i) => hostOf(i.url)),
  ].filter(Boolean))
  const ngLabels = new Set(ng.map((x) => x.slug))

  // 収集（host重複collapse、メディア/既知除外）
  const cand = new Map()
  for (const q of useQ) {
    for (const r of await serpDomains(q)) {
      const host = hostOf('https://' + (r.domain || ''))
      if (!host || NG_HOST.test(host)) continue
      if (known.has(host) || cand.has(host)) continue
      const label = host.split('.')[0]
      if (ngLabels.has(label)) continue
      cand.set(host, { host, url: `https://${r.domain}/`, title: r.title, via: q })
    }
  }

  // URL生存確認 → backlogへ
  const today = new Date().toISOString().slice(0, 10)
  const added = []
  for (const c of [...cand.values()]) {
    if (added.length >= n) break
    if (!(await alive(c.url))) continue
    data.items.push({
      id: c.host.split('.')[0], stage: 'discovered', host: c.host, url: c.url,
      titleHint: (c.title || '').slice(0, 40), discoveredVia: c.via,
      note: 'companyScout発掘（メディア/ポータル除外・dedup・URL200済み）。撮影サービス確認とEnrichはcompany-autorunがG1で実施', addedAt: today,
    })
    added.push(c)
  }
  save('companies', data)
  console.log(added.length ? `✅ companyScout: ${added.length}件を discovered で追加` : '新規候補なし')
  for (const c of added) console.log(`  + ${c.host}  (${c.via})  ${c.title?.slice(0, 30) || ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
