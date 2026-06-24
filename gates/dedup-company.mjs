// dedup-company ― 掲載候補の企業が「実在・新規・撮影サービス」かを判定するゲート（G1）。
// 既存93社・sites.mjs・ng-list.mjs と name/host で照合し、重複/除外済みを弾く。
// usage: node scripts/grower/gates/dedup-company.mjs "<会社名>" "<公式URL>"
//   exit 0 = 新規(掲載可候補) / exit 1 = 重複・NG・無効
import { loadCompanies, hostOf, ROOT } from '../lib/content.mjs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadOptional(rel, key) {
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, rel)).href)
    return mod[key] || []
  } catch {
    return []
  }
}

function normName(s) {
  return (s || '').toLowerCase().replace(/[\s　・,.（）()【】「」'"’”]/g, '')
}

async function main() {
  const [name, url] = process.argv.slice(2)
  if (!name || !url) {
    console.log('usage: dedup-company.mjs "<会社名>" "<公式URL>"')
    process.exit(2)
  }
  const host = hostOf(url)
  if (!host) {
    console.log(`❌ URLが不正: ${url}`)
    process.exit(1)
  }

  const companies = loadCompanies()
  const sites = await loadOptional('scripts/sites.mjs', 'sites')
  const ng = await loadOptional('scripts/ng-list.mjs', 'ngList')

  const reasons = []
  // 1) 既存企業とhost重複
  if (companies.some((c) => c.host && c.host === host)) reasons.push(`既存企業とドメイン重複: ${host}`)
  // 2) sites.mjs（取得対象リスト）と重複
  if (sites.some((s) => hostOf(s.url) === host)) reasons.push(`sites.mjs に既出: ${host}`)
  // 3) 既存企業と社名重複
  if (companies.some((c) => normName(c.name) === normName(name))) reasons.push(`社名が既存と一致: ${name}`)
  // 4) NGリスト（過去に除外した slug）との完全一致のみ
  const label = host.split('.')[0]
  if (ng.some((n) => n.slug === label)) {
    reasons.push(`ng-list で除外済みの slug と一致: ${label}`)
  }

  if (reasons.length) {
    console.log(`❌ 掲載不可（${name} / ${host}）:\n   - ${reasons.join('\n   - ')}`)
    process.exit(1)
  }
  console.log(`✅ 新規候補: ${name} (${host}) ― 重複・NGなし。次はURL死活確認→Enrich→QAへ`)
  process.exit(0)
}

main()
