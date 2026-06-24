// run-gates ― 公開前のコンテンツゲートをまとめて実行（slop-lint + linkcheck）。
// 決定論の安全網。1つでも落ちれば exit 1。orchestrator publish から呼ばれる。
// usage: node scripts/grower/run-gates.mjs
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

const gates = [
  ['slop-lint (§7)', path.join(here, 'gates/slop-lint.mjs')],
  ['linkcheck', path.join(here, 'gates/linkcheck.mjs')],
  ['datecheck', path.join(here, 'gates/datecheck.mjs')],
]

let failed = 0
for (const [label, script] of gates) {
  console.log(`\n── ${label} ──`)
  const r = spawnSync('node', [script], { stdio: 'inherit' })
  if (r.status !== 0) failed++
}

console.log(failed === 0 ? '\n✅ 全ゲート合格（公開可）' : `\n❌ ${failed}ゲート不合格（公開不可）`)
process.exit(failed === 0 ? 0 : 1)
