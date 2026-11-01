import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { GUARDRAIL_MESSAGES, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, validateChatText } from '../shared/guardrails.js'

const SESSION_STORAGE_KEY = 'creo-chat-session'

function getSessionId() {
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = window.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function CreoChat({ intent }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(true)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [step, setStep] = useState('message')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState('')
  const requestTimes = useRef([])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/ephemeral-chat',
    headers: () => ({ 'x-session-id': getSessionId() }),
    prepareSendMessagesRequest: ({ messages }) => ({ body: { messages } }),
  }), [])
  const { messages: aiMessages, setMessages, sendMessage, status, error: aiError, clearError, regenerate, stop } = useChat({ transport })
  const aiBusy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    const timer = window.setTimeout(() => setShowGreeting(false), 9000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event) => { if (event.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const handledIntent = useRef(0)
  useEffect(() => {
    if (!intent || handledIntent.current === intent.id) return
    handledIntent.current = intent.id
    setIsOpen(true)
    setShowGreeting(false)
    setAiEnabled(true)
    setInputError('')
    if (aiError) clearError()
    if (validateChatText(intent.prompt)) return

    if (aiBusy) {
      setInput(intent.prompt)
      return
    }

    sendMessage({ text: intent.prompt })
  }, [intent])

  const openChat = () => { setIsOpen(true); setShowGreeting(false) }

  const startNewConversation = () => {
    stop()
    try { window.sessionStorage.removeItem(SESSION_STORAGE_KEY) } catch {}
    setMessages([])
    clearError()
    setInput('')
    setInputError('')
    requestTimes.current = []
    setError('')
    if (!aiEnabled) {
      setStep('message')
      setMessage('')
      setName('')
      setEmail('')
    }
  }

  const clearChat = () => startNewConversation()

  const continueChat = (event) => {
    event.preventDefault()
    if (step === 'message') {
      if (!message.trim()) return setError('Please share a short message so we can help.')
      if (message.trim().split(/\s+/).length <= 2) return setError('Could you write one or two sentences so we can better understand what you need?')
      setError(''); setStep('contact'); return
    }
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Please add your name and a valid email address.')
    setError(''); setStep('complete')
  }

  const sendAiMessage = async (event) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || aiBusy) return

    const problem = validateChatText(text)
    if (problem) { setInputError(problem); return }

    const now = Date.now()
    const recent = requestTimes.current.filter((time) => now - time < RATE_LIMIT_WINDOW_MS)
    if (recent.length >= RATE_LIMIT_MAX) {
      const wait = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000))
      setInputError(`${GUARDRAIL_MESSAGES.tooMany} Try again in ${wait} second${wait === 1 ? '' : 's'}.`)
      return
    }

    requestTimes.current = [...recent, now]
    setInputError('')
    setInput('')
    if (aiError) clearError()

    try {
      sendMessage({ text })
    } catch {
      setInput(text)
      setInputError('Chat is temporarily unavailable. Please try again in a moment.')
    }
  }

  const retryAiMessage = async () => {
    if (!aiError) return
    clearError()

    try {
      regenerate()
    } catch {
      setInputError('Chat is temporarily unavailable. Please try again in a moment.')
    }
  }

  return <aside className={`creo-chat ${isOpen ? 'is-open' : ''}`} aria-label="Chat with Creo">
    {showGreeting && !isOpen && <button className="chat-greeting" type="button" onClick={openChat}>Hello, I’m <b>Creo</b>.<br />Do you have a query?<span>Tap to chat</span></button>}
    {isOpen && <div className="chat-window" role="dialog" aria-label="Chat with Creo"><div className="chat-header"><div className="chat-title"><span className="chat-avatar">C</span><div><b>Creo</b><small><i className="online-dot" />Online</small></div><label className="chat-ai-toggle"><span>AI</span><button type="button" role="switch" aria-checked={aiEnabled} className={`toggle ${aiEnabled ? 'on' : ''}`} onClick={() => setAiEnabled((v) => !v)}><span className="toggle-knob" /></button></label></div><div className="chat-actions"><button type="button" className="chat-clear" onClick={clearChat}>Clear</button><button type="button" className="chat-close" aria-label="Close chat" onClick={() => setIsOpen(false)}>×</button></div></div><div className="chat-content">
      {aiEnabled ? <>
        <div className="chat-bubble bot">Hello! I’m Creo, the Creosite assistant. How can we help?</div>
        {aiMessages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.parts.map((part, index) => part.type === 'text' ? <span key={index}>{part.text}</span> : null)}
          </div>
        ))}
        {aiError && <div className="chat-bubble bot chat-error-bubble" role="alert">{/^(Please|You)/.test(aiError.message || '') ? aiError.message : 'Sorry, I couldn’t reply just now.'} {aiError.statusCode !== 429 && <button type="button" className="chat-retry" onClick={retryAiMessage}>Try again</button>}</div>}
        {aiBusy && <div className="chat-bubble bot chat-typing" role="status" aria-label="Creo is typing"><span>.</span><span>.</span><span>.</span></div>}
        {inputError && <p className="chat-error chat-input-error" role="alert">{inputError}</p>}
        <form onSubmit={sendAiMessage} className="chat-form">
          <input className="chat-input" value={input} maxLength={4000} onChange={(e) => { setInput(e.target.value); if (inputError) setInputError('') }} placeholder={aiBusy ? 'Creo is typing…' : 'Say something...'} autoFocus disabled={aiBusy} />
          <button className="chat-send" type="submit" disabled={aiBusy || !input.trim()}>Send →</button>
        </form>
      </> : <>
        <div className="chat-bubble bot">Hello! I’m Creo, the Creosite assistant. How can we help?</div>
        {step === 'message' && <form onSubmit={continueChat}><label className="chat-label">Tell us a little about what you need<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type your message…" autoFocus /></label><p className="chat-error">{error}</p><button className="chat-send" type="submit">Continue →</button></form>}
        {step === 'contact' && <form onSubmit={continueChat}><div className="chat-bubble user">{message}</div><div className="chat-bubble bot">Thanks. Where can we reach you?</div><label className="chat-label">Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" autoComplete="name" autoFocus /></label><label className="chat-label">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@company.com" autoComplete="email" /></label><p className="chat-error">{error}</p><button className="chat-send" type="submit">Send request →</button></form>}
        {step === 'complete' && <><div className="chat-bubble user">{message}</div><div className="chat-bubble bot">Thanks, {name}! We’ve received your message and will contact you at <b>{email}</b> soon.</div></>}
      </>}
    </div></div>}
    <button className="chat-launcher" type="button" aria-label={isOpen ? 'Close chat with Creo' : 'Open chat with Creo'} aria-expanded={isOpen} onClick={() => (isOpen ? setIsOpen(false) : openChat())}>
      <svg className="launcher-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8.6" cy="11.4" r="1.05" fill="currentColor" /><circle cx="12" cy="11.4" r="1.05" fill="currentColor" /><circle cx="15.4" cy="11.4" r="1.05" fill="currentColor" /></svg>
      {!isOpen && <span className="chat-notification" />}
    </button>
  </aside>
}

export default CreoChat
