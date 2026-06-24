// grower のバックログ状態ストア。seo-research/pipeline/*.json を読み書きする。
// パイプラインを冪等・再開可能にするための単純な永続化。
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './content.mjs'

const DIR = path.join(ROOT, 'seo-research/pipeline')

// 企業/記事の状態遷移（オーケストレーターが進める）
export const COMPANY_STAGES = ['discovered', 'validated', 'enriched', 'qa_passed', 'published', 'measured']
export const ARTICLE_STAGES = ['keyword', 'briefed', 'drafted', 'qa_passed', 'published', 'measured']

function file(kind) {
  return path.join(DIR, `${kind}.json`)
}

export function load(kind) {
  const f = file(kind)
  if (!fs.existsSync(f)) return { items: [] }
  return JSON.parse(fs.readFileSync(f, 'utf-8'))
}

export function save(kind, data) {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(file(kind), JSON.stringify(data, null, 2) + '\n')
}

export function counts(kind) {
  const stages = kind === 'companies' ? COMPANY_STAGES : ARTICLE_STAGES
  const { items } = load(kind)
  const by = Object.fromEntries(stages.map((s) => [s, 0]))
  for (const it of items) if (by[it.stage] !== undefined) by[it.stage]++
  return { total: items.length, by }
}
