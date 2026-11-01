import { createApiHandler, errorResponse, jsonResponse } from '../server/http.js'
import { getSupabaseAdmin, isStorageConfigured } from '../server/supabase.js'

const WORK_COLUMNS = 'id, title, description, project_url, image_url, accent_color, favourite, sort_order, created_at'

function toWork(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectUrl: row.project_url,
    imageUrl: row.image_url,
    accentColor: row.accent_color,
    favourite: row.favourite,
    sortOrder: row.sort_order,
  }
}

async function handleWebRequest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse('method_not_allowed', 'Method not allowed.', 405)
  }

  if (!isStorageConfigured()) {
    return jsonResponse({ works: [], configured: false })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return jsonResponse({ works: [], configured: false })

  const favourite = new URL(request.url).searchParams.get('favourite')

  let query = supabase
    .from('selected_works')
    .select(WORK_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (favourite === 'true') query = query.eq('favourite', true)
  else if (favourite === 'false') query = query.eq('favourite', false)

  const { data, error } = await query

  if (error) {
    console.error('[works] Failed to load selected works:', error.message)
    return errorResponse('storage_error', 'The work gallery is temporarily unavailable.', 503)
  }

  return jsonResponse({ works: (data || []).map(toWork), configured: true })
}

export default createApiHandler(handleWebRequest)
