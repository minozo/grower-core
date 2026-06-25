// cannibalize ― 新規記事/ページが既存とKW・タイトルで共食いしないかを判定するゲート（G3）。
// 代行LP×トップの共食い事故を恒久的に防ぐ。トークン重なり率で近すぎる既存ページを警告。
// usage: node scripts/grower/gates/cannibalize.mjs "<狙うKW or タイトル案>"
//   exit 0 = 新規でOK / exit 1 = 既存と重複懸念（要差別化 or 既存強化に切替）
import { loadArticles, ROOT } from '../lib/content.mjs'
import { config } from '../lib/config.mjs'
import fs from 'node:fs'
import path from 'node:path'

// 既存の主要ページタイトル（記事以外）も共食い対象に含める。サイト非依存：
// トップ(/) + 商用ハブ(config.killerHub) のページタイトルを拾う（ppu固有のハードコードを廃止）。
function pageTitles() {
  const cfg = config()
  const routes = [...new Set(['/', cfg.killerHub].filter(Boolean))]
  const out = []
  for (const route of routes) {
    const rel = route === '/' ? 'src/pages/index.astro' : `src/pages/${route.replace(/^\/|\/$/g, '')}/index.astro`
    const p = path.join(ROOT, rel)
    if (fs.existsSync(p)) {
      const m = fs.readFileSync(p, 'utf-8').match(/title[=:]\s*["'`]([^"'`]+)/)
      if (m) out.push({ slug: route, title: m[1] })
    }
  }
  return out
}

function tokens(s) {
  return new Set(
    (s || '')
      .replace(/【[^】]*】|\d+|｜|\|/g, ' ')
      .split(/[\s・,。、/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  )
}
function overlap(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size) return 0
  let n = 0
  for (const t of A) if (B.has(t)) n++
  return n / A.size
}

function main() {
  const argv = process.argv.slice(2)
  // --exclude=<slug> は自分自身（作成済みドラフト）を除外する
  const exclude = (argv.find((a) => a.startsWith('--exclude=')) || '').replace('--exclude=', '')
  const query = argv.filter((a) => !a.startsWith('--')).join(' ')
  if (!query) {
    console.log('usage: cannibalize.mjs [--exclude=<slug>] "<狙うKW or タイトル案>"')
    process.exit(2)
  }
  const existing = [...loadArticles().map((a) => ({ slug: a.slug, title: a.title })), ...pageTitles()]
    .filter((e) => e.slug !== exclude)
  const hits = existing
    .map((e) => ({ ...e, score: overlap(query, e.title) }))
    .filter((e) => e.score >= 0.6)
    .sort((a, b) => b.score - a.score)

  if (hits.length) {
    console.log(`⚠️ 共食い懸念（「${query}」）:`)
    for (const h of hits) console.log(`   - 重なり${Math.round(h.score * 100)}% : ${h.slug} 「${h.title}」`)
    console.log('   → 既存ページの強化、または角度を変えて差別化を検討')
    process.exit(1)
  }
  console.log(`✅ 「${query}」: 既存と大きな重複なし。新規作成OK`)
  process.exit(0)
}

main()
