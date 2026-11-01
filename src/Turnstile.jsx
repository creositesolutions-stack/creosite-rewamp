import { useEffect, useRef, useState } from 'react'

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

let loaderPromise = null

function loadTurnstileScript() {
  if (typeof window === 'undefined' || !TURNSTILE_SITE_KEY) return Promise.resolve(false)
  if (window.turnstile) return Promise.resolve(true)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-creo-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.turnstile)), { once: true })
      existing.addEventListener('error', () => reject(new Error('turnstile_load_failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.creoTurnstile = 'true'
    script.addEventListener('load', () => resolve(Boolean(window.turnstile)), { once: true })
    script.addEventListener('error', () => reject(new Error('turnstile_load_failed')), { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    loaderPromise = null
    throw error
  })

  return loaderPromise
}

export default function Turnstile({ onToken, resetSignal = 0, action = 'turnstile' }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onTokenRef = useRef(onToken)
  const lastResetRef = useRef(resetSignal)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined
    let cancelled = false

    loadTurnstileScript()
      .then((ready) => {
        if (!ready || cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          size: 'compact',
          theme: 'dark',
          callback: (token) => onTokenRef.current?.(token || ''),
          'expired-callback': () => onTokenRef.current?.(''),
          'timeout-callback': () => onTokenRef.current?.(''),
          'error-callback': () => {
            setFailed(true)
            onTokenRef.current?.('')
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      const widgetId = widgetIdRef.current
      widgetIdRef.current = null
      if (widgetId != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {}
      }
    }
  }, [action])

  useEffect(() => {
    if (lastResetRef.current === resetSignal) return
    lastResetRef.current = resetSignal
    if (widgetIdRef.current != null && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {}
    }
    setFailed(false)
    onTokenRef.current?.('')
  }, [resetSignal])

  if (!TURNSTILE_SITE_KEY) return null

  return (
    <div className="turnstile-slot" data-turnstile>
      <div ref={containerRef} />
      {failed && <p className="turnstile-error" role="alert">Verification could not load. Please refresh and try again.</p>}
    </div>
  )
}
