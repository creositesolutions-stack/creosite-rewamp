import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_EXAMPLES, getIdeas } from './ai-website-ideas.js'
import './ai-website-section.css'

function interpolate(text, choices) {
  return text.replace(/\{(\d+)\}/g, (_, index) => choices[Number(index)] ?? '')
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function AiWebsiteSection() {
  const [activeExample, setActiveExample] = useState(0)
  const [entries, setEntries] = useState([])
  const [choices, setChoices] = useState([])
  const [typing, setTyping] = useState(false)
  const [businessType, setBusinessType] = useState('')
  const [ideas, setIdeas] = useState(null)
  const [ideasLoading, setIdeasLoading] = useState(false)
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
    const request = ++ideasRequest.current
    setIdeasLoading(true)
    try {
      const result = await getIdeas(businessType)
      if (ideasRequest.current === request) setIdeas(result)
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

        <section className="ai-ideas-panel" aria-labelledby="ai-ideas-heading">
          <h3 id="ai-ideas-heading">Try it for your business</h3>
          <p>Tell us what you do and see three ways AI could help.</p>
          <form className="ai-ideas-form" onSubmit={showIdeas}>
            <label className="ai-visually-hidden" htmlFor="ai-business-type">Your type of business</label>
            <input
              id="ai-business-type"
              type="text"
              value={businessType}
              maxLength={80}
              placeholder="e.g. bakery, plumber, yoga studio"
              onChange={(event) => setBusinessType(event.target.value)}
            />
            <button type="submit" disabled={ideasLoading}>{ideasLoading ? 'Loading…' : 'Show me ideas'}</button>
          </form>
          {ideas && (
            <div className="ai-ideas-grid" aria-live="polite" aria-relevant="additions">
              {ideas.map((idea, index) => (
                <article className="ai-idea-card" key={`${ideasRequest.current}-${index}`} style={{ '--idea-delay': `${index * 120}ms` }}>
                  <span>IDEA 0{index + 1}</span>
                  <p>{idea}</p>
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
