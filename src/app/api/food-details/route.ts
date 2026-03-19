import { NextRequest, NextResponse } from 'next/server'

interface OFFNutriments {
  'energy-kcal_100g'?: number
  'proteins_100g'?: number
  'carbohydrates_100g'?: number
  'fat_100g'?: number
  'energy-kcal_serving'?: number
  'proteins_serving'?: number
  'carbohydrates_serving'?: number
  'fat_serving'?: number
}

export async function GET(req: NextRequest) {
  const foodId = req.nextUrl.searchParams.get('food_id')

  if (!foodId) {
    return NextResponse.json({ error: 'food_id required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${foodId}.json?fields=code,product_name,brands,nutriments,serving_size`,
      { headers: { 'User-Agent': 'RetoApp/1.0' }, next: { revalidate: 86400 } }
    )

    if (!res.ok) throw new Error(`OFF API error: ${res.status}`)

    const data = await res.json()
    const product = data.product as { code: string; product_name?: string; brands?: string; nutriments?: OFFNutriments; serving_size?: string } | undefined

    if (!product?.nutriments) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const n = product.nutriments
    const servings = []

    // 100g serving (always available)
    if (n['energy-kcal_100g'] != null) {
      servings.push({
        serving_id: '100g',
        serving_description: 'por 100g',
        calories: Math.round(n['energy-kcal_100g'] || 0),
        protein_g: Math.round((n['proteins_100g'] || 0) * 10) / 10,
        carbs_g: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
        fat_g: Math.round((n['fat_100g'] || 0) * 10) / 10,
      })
    }

    // Per-serving option if available
    if (product.serving_size && n['energy-kcal_serving'] != null) {
      servings.push({
        serving_id: 'serving',
        serving_description: `1 porción (${product.serving_size})`,
        calories: Math.round(n['energy-kcal_serving'] || 0),
        protein_g: Math.round((n['proteins_serving'] || 0) * 10) / 10,
        carbs_g: Math.round((n['carbohydrates_serving'] || 0) * 10) / 10,
        fat_g: Math.round((n['fat_serving'] || 0) * 10) / 10,
      })
    }

    return NextResponse.json({
      food_id: product.code,
      food_name: product.product_name || '',
      brand_name: product.brands?.split(',')[0].trim() || undefined,
      servings,
    })
  } catch (error) {
    console.error('Open Food Facts details error:', error)
    return NextResponse.json({ error: 'Failed to get food details' }, { status: 500 })
  }
}
