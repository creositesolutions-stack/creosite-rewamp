import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_EXAMPLES, getIdeas } from './ai-website-ideas.js'
import './ai-website-section.css'

function interpolate(text, choices) {
  return text.replace(/\{(\d+)\}/g, (_, index) => choices[Number(index)] ?? '')
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function OfferingIllustration({ type }) {
  if (type === 'tech') return (
    <svg className="ai-offering-illustration" viewBox="0 0 120 84" fill="none" aria-hidden="true">
      <rect x="29" y="8" width="62" height="49" rx="5" fill="#152536" stroke="#D5E5F2" strokeWidth="3" />
      <rect x="35" y="14" width="50" height="37" rx="2" fill="#6286A3" />
      <path d="M39 19h20v14H39z" fill="#B9D2E5" opacity=".82" />
      <path d="M63 20h17M63 26h13M39 39h41M39 44h28" stroke="#EAF3FA" strokeLinecap="round" strokeWidth="2" opacity=".8" />
      <path d="M20 62h80l10 11c1 2 0 4-3 4H13c-3 0-4-2-3-4l10-11Z" fill="#B8CFE0" stroke="#E5F0F8" strokeWidth="2" />
      <path d="M49 66h22l-3 4H52l-3-4Z" fill="#647F98" />
    </svg>
  )

  if (type === 'dental') return (
    <svg className="ai-offering-illustration" viewBox="0 0 88 88" fill="none" aria-hidden="true">
      <path d="M43.9 13c-7.9-5.3-18.8-2.2-23.6 4.8-6.5 9.4.7 23.4 4 32.1 3 7.7 4.1 23.1 10.1 23.1 5.9 0 5.3-20.4 10-20.4s4.1 20.4 10 20.4c6 0 7.1-15.4 10.1-23.1 3.3-8.7 10.5-22.7 4-32.1-4.8-7-15.7-10.1-23.6-4.8Z" fill="#F5FAFD" stroke="#D7E9F5" strokeWidth="3" />
      <path d="M35 23c-4 2-5.8 6-5.4 10" stroke="#9BB9CE" strokeLinecap="round" strokeWidth="3" />
      <path d="M44 34v12" stroke="#7598B2" strokeLinecap="round" strokeWidth="3" />
      <circle cx="44" cy="54" r="3" fill="#7598B2" />
      <path d="M61 17v10m-5-5h10" stroke="#E7F4FC" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  )

  return (
    <svg className="ai-offering-illustration" viewBox="0 0 120 84" fill="none" aria-hidden="true">
      <circle cx="88" cy="20" r="11" fill="#F3D796" />
      <path d="M8 57 37 26l24 28 15-18 35 28H8V57Z" fill="#85B7A5" />
      <path d="m26 38 11-12 11 13-8-3-4 4-4-4-6 2Z" fill="#E7F2EC" />
      <path d="M11 65c15-6 28 5 43 0s28-5 55 1v9H11v-10Z" fill="#6CA6B0" />
      <path d="M19 69c12-4 21 4 34 0s23-4 35 0" stroke="#C5E4DD" strokeLinecap="round" strokeWidth="2" />
      <path d="M18 59V34m0 4c-7-1-11-5-12-10 8 0 12 3 12 10Zm0-7c1-7 5-11 11-12 0 7-4 11-11 12Z" stroke="#E4C58C" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  )
}

export default function AiWebsiteSection({ onDiscussIdea }) {
  const [activeExample, setActiveExample] = useState(0)
  const [entries, setEntries] = useState([])
  const [choices, setChoices] = useState([])
  const [typing, setTyping] = useState(false)
  const [businessType, setBusinessType] = useState('')
  const [ideas, setIdeas] = useState(null)
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState('')
  const [ideasRemaining, setIdeasRemaining] = useState(3)
  const runToken = useRef(0)
  const pendingWaits = useRef(new Set())
  const choiceResolver = useRef(null)
  const selectedValues = useRef([])
  const entryId = useRef(0)
  const ideasRequest = useRef(0)

  const wait = useCallback((milliseconds, token) => new Promise((resolve) => {
    if (runToken.current !== token) return resolve(false)
    const delay = prefersReducedMotion() ? Math.min(80, milliseconds) : milliseconds
    const pending = { timer: null, resolve }
    pending.timer = window.setTimeout(() => {
      pendingWaits.current.delete(pending)
      resolve(runToken.current === token)
    }, delay)
    pendingWaits.current.add(pending)
  }), [])

  const cancelPlayback = useCallback(() => {
    runToken.current += 1
    for (const pending of pendingWaits.current) {
      window.clearTimeout(pending.timer)
      pending.resolve(false)
    }
    pendingWaits.current.clear()
    choiceResolver.current?.(null)
    choiceResolver.current = null
    setTyping(false)
    setChoices([])
  }, [])

  const addEntry = useCallback((entry) => {
    setEntries((current) => [...current, { ...entry, id: ++entryId.current }])
  }, [])

  const playSteps = useCallback(async (initialSteps, token) => {
    const queue = [...initialSteps]
    while (queue.length && runToken.current === token) {
      const step = queue.shift()
      if (step.type === 'visitor') {
        if (!await wait(500, token)) return
        addEntry({ type: 'visitor', text: interpolate(step.text, selectedValues.current), lang: step.lang })
      } else if (step.type === 'assistant') {
        setTyping(true)
        if (!await wait(900, token)) return
        setTyping(false)
        addEntry({ type: 'assistant', text: interpolate(step.text, selectedValues.current), lang: step.lang })
      } else if (step.type === 'card') {
        if (!await wait(400, token)) return
        addEntry({
          type: 'card',
          title: step.title,
          lines: step.lines.map((line) => interpolate(line, selectedValues.current)),
        })
      } else if (step.type === 'offerings') {
        if (!await wait(250, token)) return
        addEntry({ type: 'offerings', items: step.items })
      } else if (step.type === 'chips') {
        setChoices(step.choices)
        const choice = await new Promise((resolve) => { choiceResolver.current = resolve })
        choiceResolver.current = null
        if (!choice || runToken.current !== token) return
        selectedValues.current.push(choice.label)
        if (choice.echo || choice.visitorText) {
          addEntry({ type: 'visitor', text: choice.visitorText || choice.label, lang: choice.lang })
        }
        queue.unshift(...choice.steps)
      }
    }
  }, [addEntry, wait])

  const startDemo = useCallback((index) => {
    cancelPlayback()
    const token = runToken.current
    selectedValues.current = []
    setActiveExample(index)
    setEntries([])
    setChoices([])
    setTyping(false)
    void playSteps(DEMO_EXAMPLES[index].steps, token)
  }, [cancelPlayback, playSteps])

  const explainOffering = useCallback(async (offer) => {
    if (typing) return
    const token = runToken.current
    addEntry({ type: 'visitor', text: `Can you explain the ${offer.title}?` })
    setTyping(true)
    if (!await wait(850, token)) return
    setTyping(false)
    addEntry({ type: 'assistant', text: offer.description })
  }, [addEntry, typing, wait])

  const choose = useCallback((choice) => {
    const resolve = choiceResolver.current
    if (!resolve) return
    choiceResolver.current = null
    setChoices([])
    resolve(choice)
  }, [])

  useEffect(() => {
    startDemo(0)
    return cancelPlayback
  }, [cancelPlayback, startDemo])

  const showIdeas = async (event) => {
    event.preventDefault()
    const wordCount = businessType.trim().split(/\s+/).filter(Boolean).length
    if (!businessType.trim()) {
      setIdeasError('Enter a short business type to get started.')
      return
    }
    if (wordCount > 6) {
      setIdeasError('Please use Creo for more chatting and enter only a short business type here (6 words maximum).')
      return
    }
    const request = ++ideasRequest.current
    setIdeasError('')
    setIdeasLoading(true)
    try {
      const result = await getIdeas(businessType)
      if (ideasRequest.current === request) {
        setIdeas(result.ideas)
        setIdeasRemaining(result.remaining)
      }
    } catch (error) {
      if (ideasRequest.current === request) {
        if (error.status === 429) setIdeasRemaining(0)
        setIdeasError(error.message || 'AI ideas are unavailable right now.')
      }
    } finally {
      if (ideasRequest.current === request) setIdeasLoading(false)
    }
  }

  return (
    <section className="ai-website-section" aria-labelledby="ai-website-heading">
      <div className="ai-website-container">
        <div className="ai-website-intro">
          <h2 id="ai-website-heading">What AI can do on your <span className="outline">website</span></h2>
          <p>Pick a task and watch it happen. Everything below is something a small business can have working on its own site.</p>
        </div>

        <div className="ai-demo-layout">
          <div className="ai-example-list" aria-label="AI examples">
            {DEMO_EXAMPLES.map((example, index) => {
              const selected = activeExample === index
              return (
                <button
                  className={`ai-example-button${selected ? ' is-current' : ''}`}
                  type="button"
                  key={example.title}
                  aria-current={selected ? 'true' : undefined}
                  aria-expanded={selected}
                  onClick={() => startDemo(index)}
                >
                  <span className="ai-example-title">{example.title}</span>
                  <span className="ai-example-detail"><span>Frees up:</span> {example.freesUp}</span>
                </button>
              )
            })}
          </div>

          <div className="ai-chat-card">
            <div className="ai-chat-header">
              <span>YOUR WEBSITE · ASSISTANT</span>
              <button type="button" onClick={() => startDemo(activeExample)} aria-label="Replay this example">↻ REPLAY</button>
            </div>
            <div className="ai-chat-messages" aria-live="polite" aria-relevant="additions text">
              {entries.map((entry) => entry.type === 'card' ? (
                <div className="ai-result-card ai-demo-result" key={entry.id}>
                  <strong>{entry.title}</strong>
                  {entry.lines.map((line, index) => <p key={`${entry.id}-${index}`}>{line}</p>)}
                </div>
              ) : entry.type === 'offerings' ? (
                <div className="ai-offering-grid" key={entry.id}>
                  {entry.items.map((offer) => (
                    <article className="ai-offering-card" key={offer.title}>
                      <div className={`ai-offering-visual ${offer.theme}`} aria-hidden="true"><OfferingIllustration type={offer.theme} /></div>
                      <div className="ai-offering-copy">
                        <span className="ai-offering-category">{offer.category}</span>
                        <strong>{offer.title}</strong>
                        <button type="button" className="ai-offering-ask" disabled={typing} onClick={() => explainOffering(offer)}><span>✦</span> Ask AI</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={`ai-message ${entry.type}`} key={entry.id} lang={entry.lang}>
                  {entry.text}
                </div>
              ))}
              {typing && <div className="ai-typing" role="status" aria-label="Assistant is typing"><i /><i /><i /></div>}
              {choices.length > 0 && (
                <div className="ai-choice-list" aria-label="Choose a response">
                  {choices.map((choice) => (
                    <button type="button" className="ai-choice" key={choice.label} onClick={() => choose(choice)}>{choice.label}</button>
                  ))}
                </div>
              )}
            </div>
            <p className="ai-chat-footnote">Sample conversation. In real use the assistant answers only from information you give it.</p>
          </div>
        </div>

        <section id="ai-ideas" className="ai-ideas-panel" aria-labelledby="ai-ideas-heading">
          <div className="ai-ideas-heading-row">
            <h3 id="ai-ideas-heading">Try it for your business</h3>
            <span className="ai-powered-label"><i /> AI-POWERED IDEAS</span>
          </div>
          <p>Tell us what you do and see three practical ways AI could help.</p>
          <form className="ai-ideas-form" onSubmit={showIdeas}>
            <label className="ai-visually-hidden" htmlFor="ai-business-type">Your type of business</label>
            <input
              id="ai-business-type"
              type="text"
              value={businessType}
              maxLength={80}
              placeholder="e.g. bakery, plumber, yoga studio"
              aria-describedby="ai-ideas-hint"
              onChange={(event) => {
                setBusinessType(event.target.value)
                if (event.target.value.trim().split(/\s+/).filter(Boolean).length > 6) {
                  setIdeasError('Please use Creo for more chatting and enter only a short business type here (6 words maximum).')
                } else setIdeasError('')
              }}
            />
            <button className="ask-creo ai-ideas-submit" type="submit" disabled={ideasLoading || ideasRemaining === 0}>
              <span className="ask-creo-icon" aria-hidden="true">✦</span>
              <span>{ideasLoading ? 'Creo is thinking…' : 'Ask Creo for ideas'}</span>
            </button>
          </form>
          <div className="ai-ideas-status" aria-live="polite">
            <span id="ai-ideas-hint">Short business type only · {ideasRemaining} AI {ideasRemaining === 1 ? 'request' : 'requests'} remaining this session</span>
            {ideasLoading && <span className="ai-generating"><i /> Creo AI is generating your ideas…</span>}
            {ideasError && <span className="ai-ideas-error" role="alert">{ideasError}</span>}
          </div>
          {ideas && (
            <div className="ai-ideas-grid" aria-live="polite" aria-relevant="additions">
              {ideas.map((idea, index) => (
                <article className="ai-idea-card" key={`${ideasRequest.current}-${index}`} style={{ '--idea-delay': `${index * 120}ms` }}>
                  <span>IDEA 0{index + 1} · {idea.category}</span>
                  <strong>{idea.title}</strong>
                  <p>{idea.description}</p>
                  <button className="ask-creo ai-idea-discuss" type="button" onClick={() => onDiscussIdea?.(idea, businessType)}>
                    <span className="ask-creo-icon" aria-hidden="true">✦</span>
                    <span>Discuss with Creo</span>
                  </button>
                </article>
              ))}
            </div>
          )}
          <p className="ai-ideas-footnote">These are sample ideas. For a plan fitted to your business, start with a free 30 minute call.</p>
        </section>
      </div>
    </section>
  )
}
