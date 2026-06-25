// killer-run の driver prompt を出力する（サイト非依存）。
// 最新の stage=briefed なキラーブリーフ(killers.json)を読み、それを素材にLLMが本文を書く。
// 生成(LLM)はここ、判定(コード)は gates。数値はブリーフの moat を改変せず使う（G1）。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './lib/config.mjs'
import { load } from './lib/state.mjs'

const cfg = config()
const CORE = path.dirname(fileURLToPath(import.meta.url))

const briefs = (load('killers').items || [])
  .filter((k) => k.stage === 'briefed')
  .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
const k = briefs[0]

if (!k) {
  process.stdout.write('briefed なキラーブリーフが seo-research/pipeline/killers.json に無い。何もせず「先に `npm run grow killer "<headKW>"` を実行」とだけ報告して終了して。')
  process.exit(0)
}

const moatLines = [
  `総数: 掲載企業 ${k.moat.total}社 / ${k.moat.prefectureCount}都道府県`,
  `都道府県分布(上位): ${k.moat.prefectures.slice(0, 10).map(([v, n]) => `${v}=${n}`).join(', ')}`,
  ...Object.entries(k.moat.facets).map(([key, list]) => `${key}(上位): ${list.map(([v, n]) => `${v}=${n}`).join(', ')}`),
].join('\n')

const competitors = (k.serp || []).slice(0, 10).map((s) => `${s.rank}. ${s.domain} ${s.title || ''}`).join('\n') || '(SERP未取得)'

process.stdout.write(`あなたは ${cfg.siteName}(${cfg.siteDomain}) の grower で「キラーページ」を1本だけ作る。
作業はカレントのサイトリポジトリ。アンチslop基準は ${CORE}/article-writing-rules.md（§1-§4・§7）に厳密準拠。

狙う head KW: 「${k.headKW}」（ブリーフ: seo-research/pipeline/killers.json の id=${k.id}）

■ 競合(SERP上位・これを「逆算」して上回る網羅性と独自性を出す):
${competitors}

■ 自社データ堀（=独自集計。出典は「自サイト掲載データ」。数値は改変禁止・捏造禁止=G1。本文に必ず表で載せる）:
${moatLines}

手順（厳守。逸脱しない）:
1. \`node ${CORE}/gates/cannibalize.mjs "${k.headKW}"\` を実行。${k.upgrade ? `近い既存記事(${k.upgrade.slug})があるので、新規乱立ではなく「その記事の昇格/統合・内部リンク集約」を第一に検討する。` : ''}
2. DataForSEO live SERP(env: DATAFORSEO_USERNAME/PASSWORD)で上位ページを開いて深度分析し、競合に無い切り口・網羅項目を洗い出す。
3. ${CORE}/article-writing-rules.md に準拠して本文.mdを src/content/articles/ に書く。要件:
   - 本文 ${k.targetChars}字以上。結論先出し→選び方の基準→比較→【独自集計データ(表)】→料金目安→事例→FAQ の骨子。
   - 上記「自社データ堀」を必ず1つ以上の表で掲載し、数値はブリーフのものを正確に転記（足し引き・丸めの捏造をしない）。
   - frontmatter: publishedAt は昨日以前の過去日付 / number は既存max+1 / heroImage は /images/articles/<NNN>-<slug>.jpg（画像は後追い）。
   - 内部リンク: ハブ ${k.hub || '(なし。最も関連する商用導線へ1本)'} ＋ スポーク ${(k.spokes || []).join(' , ') || '(関連記事へ2-3本)'}。
   - 監修者を明記（E-E-A-T / §2）。作例にAI画像を使わない（G2）。
4. \`npm run gates\` が slop-lint(§7)/linkcheck/datecheck 全合格するまで本文を直す。不合格なら公開しない。
5. ブリーフの該当killer(id=${k.id})を stage=published に更新（slug/url/publishedAt 追記）。seo-research/pipeline/killers.json を編集。
6. \`npm run grow publish "feat: killer ${k.headKW} <title>"\` で公開（build/check→gates→push→IndexNow）。
7. 1本で終了。

ガードレール: G1 捏造ゼロ(集計値はブリーフ通り・企業は実在掲載のみ) / G2 アンチslop+E-E-A-T / G3 共食い禁止。
不確実なときは公開せず、何を見送ったかを最後に1行で報告して終了する。`)
