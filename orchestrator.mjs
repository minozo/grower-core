// grower オーケストレーター CLI。
// 掲載企業・記事を「増やし続ける」パイプラインの司令塔（決定論部分）。
// 生成(LLM)はエージェント(agents.mjs の spec)が担い、判定(gates)と公開はここが回す。
//
// usage:
//   node scripts/grower/orchestrator.mjs status     現状(サイト規模・backlog・速度予算)
//   node scripts/grower/orchestrator.mjs agents      エージェント一覧と次の作業指示
//   node scripts/grower/orchestrator.mjs gates       公開前ゲートを実行
//   node scripts/grower/orchestrator.mjs measure     公開記事のインデックス/順位を計測しbacklogへ
//   node scripts/grower/orchestrator.mjs publish "msg"  build→gates→commit→push(prod)→IndexNow
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCompanies, loadArticles, ROOT } from './lib/content.mjs'
import { counts, load } from './lib/state.mjs'
import { listAgents } from './agents.mjs'
import { config } from './lib/config.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cfg = config()

// 速度ガバナンス（G3）: 自然な成長カーブを保つ週次上限（サイト固有）
export const VELOCITY = cfg.velocity

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts })
}

function status() {
  const companies = loadCompanies().length
  const articles = loadArticles().length
  console.log(`━━ ${cfg.siteName}(${cfg.siteDomain}) grower status ━━`)
  console.log(`掲載企業: ${companies}社   記事: ${articles}本`)
  console.log(`速度予算/週: 企業 ${VELOCITY.companiesPerWeek} / 記事 ${VELOCITY.articlesPerWeek}（G3 上限）`)
  for (const kind of ['companies', 'articles']) {
    const c = counts(kind)
    if (c.total) console.log(`backlog(${kind}): total=${c.total} ` + Object.entries(c.by).map(([k, v]) => `${k}:${v}`).join(' '))
    else console.log(`backlog(${kind}): 空（${kind === 'companies' ? 'companyScout' : 'keywordScout'} で発掘から）`)
  }
}

// 週次サイクルの決定論部分（cron/スケジューラから呼ぶ）。
// 1) 計測で順位を更新 → 2) backlog から速度予算内の次アクションを提示。
// 生成（記事執筆・企業Enrich）はこの work order を受けてLLMエージェントが担う。
function weekly() {
  console.log('━━ grower weekly cycle ━━')
  console.log('▶ measure（公開物の順位更新。認証は環境変数）…')
  sh('node', [path.join(here, 'measure.mjs')])
  // backlog の keyword 段が薄ければ keywordScout で自動補充（連続運転のため）
  const kwCount = load('articles').items.filter((i) => i.stage === 'keyword').length
  if (kwCount < VELOCITY.articlesPerWeek) {
    console.log(`▶ scout（keyword段 ${kwCount} < ${VELOCITY.articlesPerWeek} → 自動補充）…`)
    sh('node', [path.join(here, 'keyword-scout.mjs'), '--n=5', '--minvol=20'])
  }
  status()
  // 次に着手すべき backlog（速度予算 = 残り枠）
  const a = load('articles')
  const c = load('companies')
  const nextArticles = a.items.filter((i) => i.stage === 'keyword').sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0)).slice(0, VELOCITY.articlesPerWeek)
  const needCompanies = c.items.filter((i) => ['discovered', 'validated', 'enriched'].includes(i.stage)).slice(0, VELOCITY.companiesPerWeek)
  console.log('\n▶ 今週のwork order（LLMエージェントが実行 → gates → grow publish）:')
  console.log(`  記事(${nextArticles.length}/${VELOCITY.articlesPerWeek}枠): ` + (nextArticles.map((i) => i.keyword).join(' / ') || '— backlog補充(keywordScout)が必要'))
  console.log(`  企業(${needCompanies.length}/${VELOCITY.companiesPerWeek}枠): ` + (needCompanies.map((i) => i.name || i.url).join(' / ') || '— backlog補充(companyScout)が必要'))
}

// ローカルの認証済み claude を使って生成サイクルを1本回す（取り急ぎ無人化）。
// CI(ANTHROPIC_API_KEY/CLAUDE_CODE_OAUTH_TOKEN)を待たず、手元の claude -p で実行できる。
// driver=autorun-prompt.mjs。env(DataForSEO/claude認証)は bash -lc で読む。
function autorun(extra, promptFile = 'autorun-prompt.mjs') {
  const prompt = path.join(here, promptFile)
  if (extra.includes('--dry')) {
    console.log('（--dry）以下のdriverで `claude -p` を実行します:\n')
    sh('node', [prompt])
    return
  }
  console.log('▶ claude -p で grower 生成サイクルを1本実行（公開まで自走。gates不合格なら公開しない）…')
  const head = () => spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()
  const before = head()
  // $(...) の出力は再評価されないため、prompt内のバッククォートは安全
  // 毎回フレッシュなセッションを強制（前回会話の再開＝リプレイを防ぐ）:
  //   --session-id $(uuidgen) で一意の新規セッション、--no-session-persistence で保存もしない
  const r = sh('bash', ['-lc', `claude -p "$(node ${prompt})" --allowedTools "Bash,Read,Write,Edit" --max-turns 60 --session-id "$(uuidgen)" --no-session-persistence`])
  // 実体検証: LLMの自己申告を信用せず、新規コミットが出たかをgitで確認する
  const after = head()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()
  if (before === after && !dirty) {
    console.log('\n⚠️ autorun: 新規コミットも変更も無し。エージェントが実作業をしていない（リプレイ/no-opの可能性）。')
    console.log('   自己申告の成否は信用しないこと。backlogにkeyword段の項目があるか、claude -pがセッションを再開していないかを確認。')
    process.exit(2)
  }
  console.log(`\n✅ autorun: 新規コミット確認 ${before?.slice(0, 7)} → ${after?.slice(0, 7)}`)
  process.exit(r.status ?? 0)
}

function agents() {
  console.log('━━ agents（生成はLLM、判定はgatesが担う）━━')
  for (const a of listAgents()) {
    console.log(`\n[${a.id}] (${a.pipeline})  ${a.mission}`)
    console.log(`  in : ${a.inputs.join(' / ')}`)
    console.log(`  out: ${a.outputs.join(' / ')}`)
    if (a.gate) console.log(`  gate: ${a.gate}`)
    if (a.note) console.log(`  note: ${a.note}`)
  }
}

function gates() {
  return sh('node', [path.join(here, 'run-gates.mjs')]).status
}

function publish(args) {
  const list = Array.isArray(args) ? args : [args]
  // --light（or env GROWER_PUBLISH_LIGHT=1）= 重い npm run build を回さず astro check で検証。
  // 本番ビルドはCloudflare Pagesが行うため、1GB VPS等ではこちらが安全。
  const light = list.includes('--light') || process.env.GROWER_PUBLISH_LIGHT === '1'
  const msg = list.filter((a) => !a.startsWith('--')).join(' ')
  if (!msg) {
    console.log('publish には commit メッセージが必要です')
    process.exit(2)
  }
  if (light) {
    console.log('▶ schema検証（astro check / --light: buildはCloudflareに委譲）…')
    if (sh('npm', ['run', 'check']).status !== 0) { console.log('❌ astro check 失敗'); process.exit(1) }
  } else {
    console.log('▶ build …')
    if (sh('npm', ['run', 'build']).status !== 0) { console.log('❌ build 失敗'); process.exit(1) }
  }
  console.log('▶ gates …')
  if (gates() !== 0) { console.log('❌ gates 不合格 → 公開中止'); process.exit(1) }
  console.log('▶ commit & push（dev→production→main）…')
  sh('git', ['add', '-A'])
  if (sh('git', ['commit', '-m', msg]).status !== 0) { console.log('（コミット対象なし or 失敗）'); process.exit(1) }
  const [base, ...rest2] = cfg.publishBranches
  for (const br of cfg.publishBranches) {
    if (br !== base) { sh('git', ['switch', br]); sh('git', ['merge', '--ff-only', base]) }
    sh('git', ['push', 'origin', br])
  }
  sh('git', ['switch', base])
  console.log('▶ IndexNow（live sitemap）…')
  sh('node', [path.join(ROOT, 'scripts/indexnow-submit.mjs')])
  console.log('✅ publish 完了')
}

const [cmd, ...rest] = process.argv.slice(2)
switch (cmd) {
  case 'status': status(); break
  case 'agents': agents(); break
  case 'gates': process.exit(gates()); break
  case 'measure': process.exit(sh('node', [path.join(here, 'measure.mjs'), ...rest]).status); break
  case 'scout': process.exit(sh('node', [path.join(here, 'keyword-scout.mjs'), ...rest]).status); break
  case 'company-scout': process.exit(sh('node', [path.join(here, 'company-scout.mjs'), ...rest]).status); break
  case 'weekly': weekly(); break
  case 'autorun': autorun(rest); break
  case 'company-autorun': autorun(rest, 'company-autorun-prompt.mjs'); break
  case 'killer': process.exit(sh('node', [path.join(here, 'killer.mjs'), ...rest]).status); break
  case 'killer-run': autorun(rest, 'killer-prompt.mjs'); break
  case 'publish': publish(rest); break
  default:
    console.log('usage: orchestrator.mjs <status|agents|gates|measure|scout|company-scout|weekly|autorun|company-autorun|killer "headKW"|killer-run|publish "msg">')
}
