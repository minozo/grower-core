// datecheck ― 記事の publishedAt が「未来」だと [...slug].astro の
// `publishedAt <= now` フィルタで除外され、ページが静かにビルドされない。
// 日付のみ frontmatter は UTC午前0時(=JST 9時)にパースされるため、
// 当日の日付でも JST 9時前のビルドでは未来扱いになる。これを公開前に検出する。
// usage: node scripts/grower/gates/datecheck.mjs
import { loadArticles } from '../lib/content.mjs'

const now = new Date()
let bad = 0
for (const a of loadArticles()) {
  const m = a.frontmatter.match(/^publishedAt:\s*"?([0-9T:\-+.Z]+)"?/m)
  if (!m) continue
  const d = new Date(m[1])
  if (d > now) {
    bad++
    console.log(`  ❌ ${a.slug}: publishedAt=${m[1]} が未来（ビルド除外）→ 過去日付にする`)
  }
}
console.log(bad === 0 ? '✅ datecheck: 未来日付の記事なし' : `\n❌ datecheck: ${bad}件が未来日付（ページが生成されない）`)
process.exit(bad === 0 ? 0 : 1)
