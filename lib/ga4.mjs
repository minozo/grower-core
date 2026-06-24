// GA4 Data API ― generate_lead(相談CV) をランディングページ別に取得する。
// 依存ゼロ（node:crypto でサービスアカウントJWT→OAuthトークン→runReport REST）。
//
// 環境変数（未設定なら null を返す = no-op。リポジトリにキーは置かない）:
//   GA4_PROPERTY_ID            数値のプロパティID（G-XXXX の測定IDではない）
//   GOOGLE_APPLICATION_CREDENTIALS  サービスアカウントJSONキーのパス
//     （そのSAに当該GA4プロパティの「閲覧者」権限が必要）
//
// 返り値: Map<landingPagePath, generate_lead件数>  または null（未設定/失敗）
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const sig = b64url(createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claim}.${sig}`,
  })
  return (await res.json()).access_token
}

/** 直近 days 日の generate_lead をランディングページ別に集計。Map または null。 */
export async function leadsByLandingPage(days = 28) {
  const propertyId = process.env.GA4_PROPERTY_ID
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!propertyId || !keyPath) return null
  try {
    const sa = JSON.parse(readFileSync(keyPath, 'utf-8'))
    const token = await accessToken(sa)
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'generate_lead' } } },
      }),
    })
    const json = await res.json()
    const map = new Map()
    for (const row of json.rows || []) {
      const page = (row.dimensionValues?.[0]?.value || '').split('?')[0]
      map.set(page, Number(row.metricValues?.[0]?.value || 0))
    }
    return map
  } catch (e) {
    console.error('GA4 取得失敗:', e.message)
    return null
  }
}
