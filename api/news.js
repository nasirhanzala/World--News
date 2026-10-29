const COUNTRIES = ['pk', 'us', 'in', 'gb', 'ae']
const CATEGORIES = [
  'general', 'business', 'technology', 'sports',
  'health', 'science', 'entertainment',
]

export default async function handler(req, res) {
  const key = process.env.GNEWS_KEY
  if (!key) {
    return res.status(500).json({ error: 'GNEWS_KEY is not set on the server' })
  }

  const country = String(req.query.country || 'pk')
  const category = String(req.query.category || 'general')

  if (!COUNTRIES.includes(country) || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid country or category' })
  }

  const url = new URL('https://gnews.io/api/v4/top-headlines')
  url.search = new URLSearchParams({
    category,
    country,
    lang: 'en',
    max: '10', // free plan returns at most 10 articles
    apikey: key,
  }).toString()

  try {
    const upstream = await fetch(url)
    const data = await upstream.json().catch(() => ({}))

    // Cache only successful responses (saves the 100 requests/day quota)
    if (upstream.ok) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300')
    }
    return res.status(upstream.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach GNews' })
  }
}