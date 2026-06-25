// サイト固有設定のローダー。対象サイトの <ROOT>/grower.config.json を読み、
// 無いキーは既定値（商品撮影=ppujp向け）で補う。grower-coreをニッチ非依存にする要。
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './content.mjs'

const DEFAULTS = {
  siteName: 'サイト',
  siteDomain: 'example.com',           // measure の順位判定に使う自サイトドメイン
  locationCode: 2392,                  // DataForSEO: 日本
  publishBranches: ['dev', 'production', 'main'],
  velocity: { companiesPerWeek: 20, articlesPerWeek: 5 },
  // keywordScout
  keywordSeeds: ['商品撮影 コツ'],
  keywordFit: '撮影|物撮り|写真|撮り方',
  keywordNg: 'インスタ|映え|求人|スクール|イラスト',
  // killer（head KW で上位を抜くキラーページ）
  killerHub: null,        // 内部リンクで押し上げる商用ハブのルート（例: '/photography-agency/'）。各サイトで設定
  killerMinChars: 3500,   // キラーページの目標本文字数（通常記事2500より厚く）
  // companyScout
  companyQueries: ['商品撮影 名古屋'],
  // 媒体/ポータル/マーケット等（撮影/制作会社“本体”でないもの）の除外（汎用）
  companyNgHost:
    'meetsmore|lancers|crowdworks|coconala|biz\\.ne\\.jp|chiebukuro|note\\.com|youtube|google|amazon|rakuten|yahoo|indeed|curama|imitsu|kashispace|hotpepper|prtimes|wantedly|townwork|baitoru|ameblo|hatena|pinterest|instagram|twitter|x\\.com|facebook|navi|matome|ranking|hikaku|spacemarket|space-market|instabase|rental|レンタル|tabelog|jalan|line\\.me|stanby',
}

let _cfg = null
export function config() {
  if (_cfg) return _cfg
  const p = path.join(ROOT, 'grower.config.json')
  let site = {}
  try {
    if (fs.existsSync(p)) site = JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (e) {
    console.error('grower.config.json 読込失敗:', e.message)
  }
  _cfg = { ...DEFAULTS, ...site, velocity: { ...DEFAULTS.velocity, ...(site.velocity || {}) } }
  return _cfg
}
