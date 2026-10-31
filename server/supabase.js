import { createClient } from '@supabase/supabase-js'

let cachedClient = null
let cachedKey = ''

export function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

export function isStorageConfigured() {
  const { url, serviceRoleKey } = getSupabaseConfig()
  return Boolean(url && serviceRoleKey)
}

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseConfig()
  if (!url || !serviceRoleKey) return null

  const cacheKey = `${url}:${serviceRoleKey.slice(-8)}`
  if (cachedClient && cachedKey === cacheKey) return cachedClient

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  cachedKey = cacheKey
  return cachedClient
}
