// linkcheck ― 記事内の内部リンク（/articles/ /categories/ /area/ /companies/ など）が
// 実在ルートを指すか検証するゲート。以前のサムネ/404事故の類型を公開前に止める。
// usage: node scripts/grower/gates/linkcheck.mjs [file.md ...]   (省略時=全記事)
import fs from 'node:fs'
import path from 'node:path'
import { loadArticles, knownRoutes } from '../lib/content.mjs'

function internalLinks(body) {
  // markdown [text](/path/) と HTML href="/path/" の両方
  const set = new Set()
  for (const m of body.matchAll(/\]\((\/[a-z0-9/_-]*)\)/gi)) set.add(m[1])
  for (const m of body.matchAll(/href="(\/[a-z0-9/_-]*)"/gi)) set.add(m[1])
  return [...set].filter((u) => u.startsWith('/') && !u.startsWith('//'))
}

function norm(u) {
  // 末尾スラッシュ統一（trailingSlash: always）
  if (u !== '/' && !u.endsWith('/')) return u + '/'
  return u
}

function main() {
  const args = process.argv.slice(2)
  const routes = knownRoutes()
  const targets = args.length
    ? args.map((f) => ({ slug: path.basename(f).replace(/\.md$/, ''), body: fs.readFileSync(f, 'utf-8') }))
    : loadArticles()

  let broken = 0
  for (const t of targets) {
    for (const link of internalLinks(t.body)) {
      const n = norm(link.split('#')[0])
      // /companies/<id>/ や /articles/<slug>/ は routes に列挙済み。/categories/ /area/ 配下も同様
      if (!routes.has(n)) {
        broken++
        console.log(`  ❌ ${t.slug} → 不明な内部リンク: ${link}`)
      }
    }
  }
  if (broken === 0) {
    console.log(`✅ linkcheck: ${targets.length}件、壊れた内部リンク 0`)
  } else {
    console.log(`\n❌ linkcheck: ${broken}件の壊れた内部リンク`)
  }
  process.exit(broken === 0 ? 0 : 1)
}

main()
