import { NextRequest, NextResponse } from 'next/server'

interface OFFProduct {
  code: string
  product_name?: string
  brands?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    'proteins_100g'?: number
    'carbohydrates_100g'?: number
    'fat_100g'?: number
  }
  serving_size?: string
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const page = parseInt(req.nextUrl.searchParams.get('page') || '0')

  if (!query) return NextResponse.json({ foods: [] })

  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      fields: 'code,product_name,brands,nutriments,serving_size',
      page_size: '15',
      page: String(page + 1),
      lc: 'es',
      cc: 'es',
    })

    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: { 'User-Agent': 'RetoApp/1.0' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`OFF API error: ${res.status}`)

    const data = await res.json() as { products?: OFFProduct[]; count?: number }
    const products = data.products || []

    const foods = products
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map(p => {
        const n = p.nutriments!
        const cals = Math.round(n['energy-kcal_100g'] || 0)
        const fat = (n['fat_100g'] || 0).toFixed(2)
        const carbs = (n['carbohydrates_100g'] || 0).toFixed(2)
        const prot = (n['proteins_100g'] || 0).toFixed(2)
        return {
          food_id: p.code,
          food_name: p.product_name!,
          brand_name: p.brands?.split(',')[0].trim() || undefined,
          food_description: `Por 100g - Calorías: ${cals}kcal | Grasa: ${fat}g | Carbos: ${carbs}g | Proteína: ${prot}g`,
        }
      })

    return NextResponse.json({ foods, total: data.count || foods.length })
  } catch (error) {
    console.error('Open Food Facts search error:', error)
    return NextResponse.json({ foods: [], error: 'Search failed' }, { status: 500 })
  }
}
