// grower-autorun の driver prompt を出力する（サイト非依存）。
// サイトのpackage.jsonに `grow`/`gates` スクリプト(=grower-core呼び出し)がある前提。
// 1サイクル＝記事1本。生成(LLM)はここ、判定(コード)は gates。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './lib/config.mjs'
const cfg = config()
const CORE = path.dirname(fileURLToPath(import.meta.url)) // grower-core ディレクトリ
process.stdout.write(`あなたは ${cfg.siteName}(${cfg.siteDomain}) の grower 記事パイプラインを1サイクル実行する。
作業はカレントのサイトリポジトリで行う。アンチslop基準は ${CORE}/article-writing-rules.md に従う。

手順（厳守。逸脱しない）:
1. \`npm run grow weekly\` を実行し、今週のwork order(記事KW)を得る。
2. backlog(seo-research/pipeline/articles.json)から stage=keyword で最優先の記事KWを1つ選ぶ。無ければ何もせず終了。
3. \`node ${CORE}/gates/cannibalize.mjs "<KW>"\` を実行。共食い(exit≠0)なら、そのKWを skip 扱いにして終了。
4. DataForSEO live SERP(env: DATAFORSEO_USERNAME/PASSWORD)で上位ページを取得し、競合逆算でbriefを作る(文字数2500+、KW密度目標、見出し、内部リンク計画、監修者)。
5. ${CORE}/article-writing-rules.md の §1-§4(アンチslop)・§2(E-E-A-T)に厳密準拠して本文.mdを src/content/articles/ に書く。frontmatterの publishedAt は必ず「昨日以前の過去日付」(未来日付はビルド除外される)。number は既存max+1。heroImage は /images/articles/<NNN>-<slug>.jpg(画像は後追い)。内部リンクは商用ハブ1+関連スポーク2-3。
6. \`npm run gates\` を実行。slop-lint(§7)/linkcheck/datecheck が全合格するまで本文を直す。合格しなければ publish しない。
7. backlog の該当KWを stage=published に更新(slug/url/publishedAt追記)。
8. \`npm run grow publish "feat: grower自動記事 <title>"\` で公開(build/check→gates→push→IndexNow)。
9. 1本で終了。複数本を一度に公開しない(速度予算)。

ガードレール: G1 捏造ゼロ / G2 slop=0・出典付き数値・作例にAI画像を使わない / G3 共食い禁止。
不確実なときは公開せず、何を見送ったかを最後に1行で報告して終了する。`)
