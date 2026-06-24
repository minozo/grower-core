# grower-core

比較メディア（ppu.jp=商品撮影 / mva.jp=動画制作 …）で**共有する**成長エンジン。
記事/掲載企業を「発掘→SERP逆算→執筆/Enrich→品質ゲート→公開→計測」で増やす。
**ここが共有の source of truth。各サイトはこれをパス参照で使う（別repo・別デプロイ・別ドメイン）。**

## 設計の核
- **生成(LLM)と判定(コード)の分離**：autorun/driverが生成、`gates/`が合否を決める（自己申告を信用しない）。
- **サイト非依存**：`lib/content.mjs` の `ROOT = process.cwd()`（＝対象サイトdir）。ニッチ固有値は各サイトの `grower.config.json` を `lib/config.mjs` が読む。
- grower-core自身は **node組込み＋fetchのみ**（npm依存なし＝install不要）。

## 使い方（各サイトdirから）
```
cd ~/github/ppujp
npm run grow status|agents|gates|measure|scout|company-scout|weekly|autorun|company-autorun|publish ["msg"] [--light]
```
サイトの package.json に薄いラッパー（`grow`/`gates` → `node ${GROWER_CORE_DIR:-../grower-core}/...`）を置く。

## ゲート（gates/）
slop-lint(§7 `article-writing-rules.md`) / linkcheck / datecheck / dedup-company(G1) / cannibalize(G3) / autorun実体検証(HEAD diff)。

## ガードレール
G1 捏造ゼロ(企業は実在URL・サイト記載のみ) / G2 アンチslop+E-E-A-T / G3 共食い禁止 / 速度上限(週)。

## サイト側に置くもの（grower-coreには持たない）
`grower.config.json`(siteName/siteDomain/seeds/queries/branches…) / content(src/content) / `seo-research/pipeline/*.json`(backlog) / `scripts/indexnow-submit.mjs` / `scripts/capture-hero-screenshots.mjs` / categories・schema(src)。

## 改善の進め方
ここ(`grower-core`)で `claude` を起動し、共有ロジックを改善。実サイト検証は `claude --add-dir ../ppujp ../mvajp`。
サイト固有(コンテンツ/SEO戦略)は各サイトdirで対話。git宛先(grower-core / 各サイト)を毎回明示する。

## 関連メモリ
[[ppu-grower-system]]（旧称: ppujp内の実装記録。実体はここへ移行）/ [[article-writing-rules]]。
