import { NextRequest, NextResponse } from 'next/server'
import { fatSecretRequest } from '@/lib/fatsecret'

interface FatSecretFood {
  food_id: string
  food_name: string
  brand_name?: string
  food_description: string
  food_type: string
}

interface FatSecretSearchResponse {
  foods?: {
    food?: FatSecretFood | FatSecretFood[]
    total_results?: string
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const page = req.nextUrl.searchParams.get('page') || '0'
  const maxResults = req.nextUrl.searchParams.get('max_results') || '10'

  if (!query) return NextResponse.json({ foods: [] })

  try {
    const data = await fatSecretRequest('foods.search.v2', {
      search_expression: query,
      page_number: page,
      max_results: maxResults,
      language: 'es',
      region: 'ES',
    }) as FatSecretSearchResponse

    const rawFoods = data.foods?.food
    if (!rawFoods) return NextResponse.json({ foods: [] })

    const foodArray = Array.isArray(rawFoods) ? rawFoods : [rawFoods]

    const foods = foodArray.map((f) => ({
      food_id: f.food_id,
      food_name: f.food_name,
      brand_name: f.brand_name || undefined,
      food_description: f.food_description,
    }))

    return NextResponse.json({
      foods,
      total: parseInt(data.foods?.total_results || '0'),
    })
  } catch (error) {
    console.error('FatSecret search error:', error)
    return NextResponse.json({ foods: [], error: 'Search failed' }, { status: 500 })
  }
}
