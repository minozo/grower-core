// 既存コンテンツ（掲載企業・記事）のメタデータを読み込む共通ライブラリ。
// grower の各ゲート（dedup / cannibalize / linkcheck）から参照する。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ROOT = 対象サイトのリポジトリ（grower-coreは別repo。各サイトdirで `npm run grow` を実行する想定）。
// GROWER_SITE_ROOT 明示 > cwd。grower-core自身のディレクトリではない点が肝。
export const ROOT = process.env.GROWER_SITE_ROOT || process.cwd()
const COMPANIES_DIR = path.join(ROOT, 'src/content/companies')
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles')

/** URL文字列からホスト名（www除去・小文字）を返す。失敗時は null。 */
export function hostOf(url) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** 掲載済み企業を読み込む（id/number/name/websiteUrl/host）。 */
export function loadCompanies() {
  if (!fs.existsSync(COMPANIES_DIR)) return []
  return fs
    .readdirSync(COMPANIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), 'utf-8'))
      return { file: f, host: hostOf(data.websiteUrl), ...data }
    })
}

/** 記事の frontmatter（簡易パーサ）＋本文を返す。 */
export function loadArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) return []
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf-8')
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      const fm = m ? m[1] : ''
      const body = m ? m[2] : raw
      const get = (k) => {
        const mm = fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, 'm'))
        return mm ? mm[1].trim() : ''
      }
      return { file: f, slug: f.replace(/\.md$/, ''), title: get('title'), description: get('description'), body, frontmatter: fm }
    })
}

/** 記事本文を可視テキスト化（空白除去）して文字数・出現数計測に使う。 */
export function visibleText(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // リンクは表示テキストだけ残す
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, '')
}

/** 既存の内部リンク先（実在ルート）の集合を返す。linkcheck で使う。 */
export function knownRoutes() {
  const routes = new Set(['/', '/categories/', '/area/', '/articles/', '/companies/', '/photography-agency/', '/consultation/', '/contact/', '/about/', '/privacy/', '/terms/'])
  for (const a of loadArticles()) routes.add(`/articles/${a.slug}/`)
  for (const c of loadCompanies()) routes.add(`/companies/${c.id}/`)
  // categories / areas は config から（slug一覧）
  for (const slug of readConfigSlugs('src/config/categories.ts')) routes.add(`/categories/${slug}/`)
  for (const slug of readConfigSlugs('src/config/areas.ts')) routes.add(`/area/${slug}/`)
  return routes
}

function readConfigSlugs(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return []
  const src = fs.readFileSync(p, 'utf-8')
  return [...src.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
}
