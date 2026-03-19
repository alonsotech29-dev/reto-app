import { NextRequest, NextResponse } from 'next/server'
import { fatSecretRequest } from '@/lib/fatsecret'

interface FatSecretServing {
  serving_id: string
  serving_description: string
  calories: string
  protein: string
  carbohydrate: string
  fat: string
  metric_serving_amount?: string
  metric_serving_unit?: string
}

interface FatSecretFoodResponse {
  food?: {
    food_id: string
    food_name: string
    brand_name?: string
    servings?: {
      serving?: FatSecretServing | FatSecretServing[]
    }
  }
}

export async function GET(req: NextRequest) {
  const foodId = req.nextUrl.searchParams.get('food_id')

  if (!foodId) {
    return NextResponse.json({ error: 'food_id required' }, { status: 400 })
  }

  try {
    const data = await fatSecretRequest('food.get.v2', {
      food_id: foodId,
    }) as FatSecretFoodResponse

    const food = data.food
    if (!food) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

    const rawServings = food.servings?.serving
    const servingArray = rawServings
      ? Array.isArray(rawServings) ? rawServings : [rawServings]
      : []

    const servings = servingArray.map((s) => ({
      serving_id: s.serving_id,
      serving_description: s.serving_description,
      calories: Math.round(parseFloat(s.calories) || 0),
      protein_g: Math.round((parseFloat(s.protein) || 0) * 10) / 10,
      carbs_g: Math.round((parseFloat(s.carbohydrate) || 0) * 10) / 10,
      fat_g: Math.round((parseFloat(s.fat) || 0) * 10) / 10,
      metric_serving_amount: s.metric_serving_amount ? parseFloat(s.metric_serving_amount) : undefined,
      metric_serving_unit: s.metric_serving_unit || undefined,
    }))

    return NextResponse.json({
      food_id: food.food_id,
      food_name: food.food_name,
      brand_name: food.brand_name || undefined,
      servings,
    })
  } catch (error) {
    console.error('FatSecret food details error:', error)
    return NextResponse.json({ error: 'Failed to get food details' }, { status: 500 })
  }
}
