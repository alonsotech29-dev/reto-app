import crypto from 'crypto'

const FATSECRET_BASE_URL = 'https://platform.fatsecret.com/rest/server.api'

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

export async function fatSecretRequest(
  method: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const consumerKey = process.env.FATSECRET_CONSUMER_KEY
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error('FatSecret API credentials not configured')
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0',
    format: 'json',
    method,
    ...params,
  }

  // Sort and encode parameters
  const sortedKeys = Object.keys(oauthParams).sort()
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join('&')

  // Create signature base string
  const signatureBase = `POST&${percentEncode(FATSECRET_BASE_URL)}&${percentEncode(paramString)}`

  // Sign with HMAC-SHA1
  const signingKey = `${percentEncode(consumerSecret)}&`
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')

  oauthParams.oauth_signature = signature

  // Build POST body
  const body = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&')

  const response = await fetch(FATSECRET_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`FatSecret API error: ${response.status} - ${text}`)
  }

  return response.json()
}
