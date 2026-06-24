// 企業side autorun の driver prompt（サイト非依存）。discovered候補を1社、
// 検証→Enrich(G1)→スクショ→schema→公開まで自走。1サイクル1社。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './lib/config.mjs'
const cfg = config()
const CORE = path.dirname(fileURLToPath(import.meta.url))
process.stdout.write(`あなたは ${cfg.siteName}(${cfg.siteDomain}) の grower 企業掲載パイプラインを1サイクル実行する。
作業はカレントのサイトリポジトリ。掲載企業は実在必須・捏造ゼロ(G1)。不確実なら公開せず見送る。

手順（厳守。逸脱しない）:
1. seo-research/pipeline/companies.json を読み、stage=discovered の候補を1つ選ぶ。無ければ何もせず終了。
2. \`node ${CORE}/gates/dedup-company.mjs "<社名 or host>" "<url>"\`。重複/NG(exit≠0)なら stage=rejected にして終了。
3. 候補の公式サイトを取得し、本当に「${cfg.siteName} が掲載対象とする業種のサービスを提供する会社」か確認。対象外(ポータル/無関係/その業務が主でない等)なら stage=rejected にして終了(理由1行)。
4. 対象だと確認できたら src/content/companies/<NNN>.json を作る(number=既存max+1, ファイル名=ゼロ詰め3桁)。Zodスキーマ(src/content/config.ts)に厳密準拠。
   - G1: 値は公式サイト記載のみ。料金/設立/従業員/住所などサイトに無いものは省略 or price="要見積"。創作・推測で数値や実績を書かない。isRecommend=false, isPR=false 固定。
   - category は src/config/categories.ts の matchPatterns に一致する文字列。heroImage="/images/companies/<id>.jpg"。
5. スクショ: \`node scripts/capture-hero-screenshots.mjs <id>\`(サイト側)→ public/images/companies/<id>.jpg を src/assets/images/companies/<id>.jpg へ mv。sites.mjs にも {id, slug, url} を追記。
6. \`npm run build\`(or \`npm run check\`)で schema/画像解決を確認。エラーは修正して再実行。
7. companies.json の該当候補を stage=published に更新(number/area/category/publishedAt)。
8. \`npm run grow publish "feat: grower自動掲載 <社名>(<エリア>)"\` で公開。
9. 1社で終了。

不確実・情報が薄い・対象業種か判断できない場合は、捏造せず stage=rejected で見送り、理由を1行報告して終了する。`)
