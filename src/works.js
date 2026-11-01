import { useEffect, useState } from 'react'

const DEFAULT_ACCENT = '#6e8dad'

export function normalizeAccentColor(value, fallback = DEFAULT_ACCENT) {
  const match = String(value || '').trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!match) return fallback
  const hex = match[1].length === 3
    ? match[1].split('').map((character) => character + character).join('')
    : match[1]
  return `#${hex.toLowerCase()}`
}

export function hexToRgba(value, alpha = 0.24) {
  const hex = normalizeAccentColor(value).slice(1)
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  return `rgba(${red},${green},${blue},${alpha})`
}

export function normalizeWork(row) {
  const accent = normalizeAccentColor(row.accentColor ?? row.accent_color ?? row.brand)
  const title = String(row.title ?? row.name ?? '').trim()
  if (!title) return null

  return {
    id: row.id ?? title,
    name: title,
    description: String(row.description ?? '').trim(),
    url: row.projectUrl ?? row.project_url ?? row.url ?? null,
    cover: row.imageUrl ?? row.image_url ?? row.cover ?? null,
    coverSmall: row.coverSmall ?? row.smallImage ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    brand: accent,
    tone: hexToRgba(accent),
    favourite: row.favourite ?? row.favorite ?? true,
  }
}

export function useWorks({ favourite } = {}) {
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (favourite === true) params.set('favourite', 'true')
    else if (favourite === false) params.set('favourite', 'false')
    const query = params.toString()

    setLoading(true)
    setError('')
    fetch(`/api/works${query ? `?${query}` : ''}`)
      .then((response) => {
        if (!response.ok) throw new Error('Works request failed')
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data?.configured === false) {
          setError('The work gallery is not connected yet.')
          setWorks([])
          return
        }
        if (!Array.isArray(data?.works)) {
          setError('We could not read the work gallery.')
          setWorks([])
          return
        }
        setWorks(data.works.map(normalizeWork).filter(Boolean))
      })
      .catch(() => {
        if (cancelled) return
        setError('The work gallery is unavailable right now.')
        setWorks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [favourite])

  return { works, loading, error }
}
