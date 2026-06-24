// slop-lint ― article-writing-rules.md §7 の機械検出をコード化したゲート。
// 記事 .md を採点し、🔴が1つでも / 🟡が2つ以上で「中以上＝要リライト」= 不合格。
// usage: node scripts/grower/gates/slop-lint.mjs [file.md ...]   (省略時=全記事)
import fs from 'node:fs'
import path from 'node:path'
import { loadArticles, ROOT } from '../lib/content.mjs'

const RJP = '\\u3040-\\u30ff\\u4e00-\\u9fff々ー'

function analyze(body, frontmatter) {
  const lines = body.split('\n')
  const headNum = lines.filter((l) => /^#+\s+.*[0-9０-９].*(つの|ポイント|ステップ|選|コツ|理由|の方法)/.test(l)).length
  const boldLabel = lines.filter((l) => /^\*\*[^*]+\*\*[：:]?\s*$/.test(l)).length
  const h2 = lines.filter((l) => /^##\s/.test(l)).length
  const boldTotal = (body.match(/\*\*/g) || []).length / 2
  const spacing = (body.match(new RegExp(`[A-Za-z0-9] [${RJP}]|[${RJP}] [A-Za-z0-9]`, 'g')) || []).length
  const claim = (body.match(/向上します|高まります|アップします|直結します|決定づけ|過言では|9割|千差万別|大きく左右/g) || []).length
  const meta = (body.match(/この記事では|順に見ていき|結論から言うと|見ていきましょう|ここからが本題/g) || []).length
  const titleMod = ((frontmatter.match(/^(title|description):.*$/gm) || []).join(' ').match(/徹底解説|完全版|完全マスター|大全|総まとめ|プロが教える/g) || []).length

  // しきい値 → 重症度（0=🟢, 1=🟡, 2=🔴）
  const sev = []
  const grade = (yellow, red) => (red ? 2 : yellow ? 1 : 0)
  sev.push(['数字見出しlisticle', headNum, grade(headNum >= 1, headNum >= 2)])
  sev.push(['太字ラベル足場', boldLabel, grade(boldLabel >= 1, boldLabel >= 3)])
  sev.push(['太字総数', boldTotal, grade(boldTotal > 2 * Math.max(h2, 1), boldTotal > 3 * Math.max(h2, 1))])
  sev.push(['半角スペース崩れ', spacing, grade(spacing >= 1, spacing >= 3)])
  sev.push(['出典なし成果断定', claim, grade(claim >= 1, claim >= 2)])
  sev.push(['前置きメタ', meta, grade(meta >= 1, meta >= 2)])
  sev.push(['タイトル過剰修飾', titleMod, grade(titleMod >= 1, titleMod >= 2)])

  const reds = sev.filter((s) => s[2] === 2)
  const yellows = sev.filter((s) => s[2] === 1)
  // §7-2: 🔴1つ以上 or 🟡2つ以上 = 中以上 = 不合格
  const pass = reds.length === 0 && yellows.length <= 1
  return { pass, sev, reds, yellows }
}

function main() {
  const args = process.argv.slice(2)
  let targets
  if (args.length) {
    targets = args.map((f) => {
      const raw = fs.readFileSync(f, 'utf-8')
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      return { slug: path.basename(f).replace(/\.md$/, ''), frontmatter: m ? m[1] : '', body: m ? m[2] : raw }
    })
  } else {
    targets = loadArticles()
  }

  let failed = 0
  for (const t of targets) {
    const r = analyze(t.body, t.frontmatter)
    if (!r.pass) {
      failed++
      const detail = [...r.reds.map((s) => `🔴${s[0]}=${s[1]}`), ...r.yellows.map((s) => `🟡${s[0]}=${s[1]}`)].join(' ')
      console.log(`  ❌ ${t.slug}: ${detail}`)
    }
  }
  if (failed === 0) {
    console.log(`✅ slop-lint: ${targets.length}件すべて合格（§7 🔴0・🟡≤1）`)
  } else {
    console.log(`\n❌ slop-lint: ${failed}/${targets.length}件が中以上（要リライト）`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

main()
