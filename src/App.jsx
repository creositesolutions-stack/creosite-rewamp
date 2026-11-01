import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import highroadCover from '../drinkhighroad.webp'
import highroadCoverSmall from '../drinkhighroad-600.webp'
import dreamsCover from '../dreamsglobalholidays.webp'
import dreamsCoverSmall from '../dreamsglobalholidays-600.webp'
import aktpaCover from '../aktpa.webp'
import aktpaCoverSmall from '../aktpa-600.webp'
import { buildIdeaDiscussionPrompt } from './ai-website-ideas.js'
import AiWebsiteSection from './AiWebsiteSection.jsx'
import visionReceipt from '../bill_image.webp'
import visionReceiptSmall from '../bill_image-480.webp'
import Turnstile, { TURNSTILE_SITE_KEY } from './Turnstile.jsx'

const CreoChat = lazy(() => import('./CreoChat.jsx'))

const contact = {
  email: import.meta.env.VITE_CONTACT_EMAIL || 'hello@creosite.com',
  phone: import.meta.env.VITE_CONTACT_PHONE || '+91 00000 00000',
  whatsapp: import.meta.env.VITE_CONTACT_WHATSAPP || '910000000000',
  hours: import.meta.env.VITE_CONTACT_HOURS || 'Mon–Sat, 10am–7pm IST',
}
const phoneHref = `tel:${contact.phone.replace(/[^\d+]/g, '')}`
const whatsappHref = `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`

const services = [
  {
    name: 'Web solutions',
    description: 'From the first idea to a live product, we design, build and deploy web applications that are fast, secure and easy to use.',
    items: ['Website and web-app design', 'Front-end and back-end development', 'Hosting, deployment and domain setup', 'Forms, payments and third-party integrations'],
  },
  {
    name: 'SEO and growth',
    description: 'We make it easier for the right customers to find you, then help you understand what turns visits into enquiries and sales.',
    items: ['Technical SEO and site audits', 'Keyword and competitor research', 'Google Business Profile optimisation', 'Analytics, reporting and conversion tracking'],
  },
  {
    name: 'AI solutions',
    description: 'Practical AI tools that reduce repetitive work and give your customers faster, more helpful ways to interact with your business.',
    items: ['Custom website chatbots', 'WhatsApp chatbot automation', 'AI feature and API integration', 'Workflow automation and AI assistants'],
  },
  {
    name: 'AI content generation',
    description: 'Create on-brand content faster without losing your voice. We set up AI-assisted systems your team can use with confidence.',
    items: ['Website and landing-page copy', 'Blog and SEO content workflows', 'Social media and campaign content', 'Content calendars and brand prompts'],
  },
  {
    name: 'IT support',
    description: 'Dependable day-to-day technical support for the tools your team relies on, with clear advice when you need to make a change.',
    items: ['Email, domain and workspace setup', 'Cloud storage and collaboration tools', 'Website maintenance and security', 'Software, device and network troubleshooting'],
  },
  {
    name: 'Build assistance',
    description: 'Already have a project underway? We can join your team to unblock work, improve quality and help you get it across the finish line.',
    items: ['Feature implementation and bug fixes', 'Code reviews and performance improvements', 'Deployment and launch support', 'Technical guidance for your team'],
  },
]

const projects = [
  { name: 'Highroad', description: 'A vibrant digital experience for a beverage brand', brand: '#e85f55', tone: 'rgba(232,95,85,.24)', url: 'https://www.drinkhighroad.com/', cover: highroadCover, coverSmall: highroadCoverSmall, width: 1200, height: 448 },
  { name: 'Dreams Global Holidays', description: 'Travel planning and holiday booking, made effortless', brand: '#d99c4b', tone: 'rgba(217,156,75,.24)', url: 'https://dreamsglobalholidays.com/', cover: dreamsCover, coverSmall: dreamsCoverSmall, width: 1200, height: 430 },
  { name: 'AKTPA', description: 'A digital home for Kerala’s tourism professionals', brand: '#4a9d91', tone: 'rgba(74,157,145,.24)', url: 'https://www.aktpa.org/', cover: aktpaCover, coverSmall: aktpaCoverSmall, width: 1200, height: 466 },
]

function Mark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5dbe3" /><stop offset="1" stopColor="#7392b4" /></linearGradient></defs><path d="M30 8H14a6 6 0 0 0-6 6v12a6 6 0 0 0 6 6h16" stroke="url(#logo-gradient)" strokeWidth="6" strokeLinecap="round" /><path d="M20 20h12" stroke="url(#logo-gradient)" strokeWidth="6" strokeLinecap="round" /></svg>
}

function BrowserMock({ image, smallImage, name, width, height }) {
  const srcSet = smallImage ? `${smallImage} 600w, ${image} 1200w` : undefined
  return <div className="shot"><div className="browser"><img className="cover-blur" src={image} srcSet={srcSet} sizes="(max-width: 900px) 90vw, 420px" alt="" aria-hidden="true" loading="lazy" decoding="async" /><div className="bar"><span /><span /><span /></div><img className="project-cover" src={image} srcSet={srcSet} sizes="(max-width: 900px) 90vw, 420px" width={width} height={height} alt={`${name} website preview`} loading="lazy" decoding="async" /></div></div>
}

function Header() {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)
  return <header><div className="wrap"><nav>
    <a href="#top" className="logo" aria-label="Creosite Solutions home" onClick={closeMenu}><Mark /><span>Creosite<small>SOLUTIONS</small></span></a>
    <div className={`links ${open ? 'open' : ''}`}><a href="#work" onClick={closeMenu}>Work</a><a href="#solutions" onClick={closeMenu}>Solutions</a><a href="#about" onClick={closeMenu}>Vision</a><a href="#contact" onClick={closeMenu}>Contact</a></div>
    <a className="pill ghost" href="#contact">Start a project →</a>
    <button className="menu" type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
  </nav></div></header>
}

function ContactForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const handleTurnstile = useCallback((token) => setTurnstileToken(token), [])
  const resetTurnstile = () => {
    setTurnstileToken('')
    setTurnstileReset((value) => value + 1)
  }
  const submit = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = data.get('name').trim(), email = data.get('email').trim(), message = data.get('message').trim()
    const phone = data.get('phone').trim()
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) return setError('Add your name, a valid email and a short project description.')
    if (TURNSTILE_SITE_KEY && !turnstileToken) return setError('Please complete the verification below and try again.')
    setError('')
    setSending(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, turnstileToken }),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'We could not send your message right now.')
      }
      setSent(true)
      resetTurnstile()
    } catch {
      setError('We could not send your message right now. Please try again in a moment.')
      resetTurnstile()
    } finally {
      setSending(false)
    }
  }
  if (sent) return <div className="ok show contact-success"><span className="success-mark">✓</span><p className="mono">MESSAGE SENT</p><h3>Thanks for reaching out.</h3><button className="send-another" type="button" onClick={() => { setSent(false); setError(''); resetTurnstile() }}>Send another message</button></div>
  return <form onSubmit={submit} noValidate>
    <div className="form-intro"><span className="chat-avatar">C</span><div><b>Talk to Creo</b><p>Tell us what is on your mind.</p></div></div>
    <div className="two"><label>Name<input name="name" required autoComplete="name" placeholder="Your name" maxLength={120} /></label><label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} /></label></div>
    <label>Phone number <small>(optional)</small><input name="phone" type="tel" autoComplete="tel" placeholder="+91 00000 00000" maxLength={40} /></label>
    <label>How can we help?<textarea name="message" required placeholder="Tell us a little about your project or question..." maxLength={5000} /></label>
    <Turnstile onToken={handleTurnstile} resetSignal={turnstileReset} action="contact" />
    <p className="form-error" role="alert">{error}</p><button className="pill solid" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send message →'}</button>
  </form>
}

export default function App() {
  const [activeService, setActiveService] = useState(0)
  const [activeProject, setActiveProject] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches ? 0 : 1))
  const [chatIntent, setChatIntent] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const workGridRef = useRef(null)
  const askCreo = (project) => {
    setShowChat(true)
    setChatIntent({
      id: Date.now(),
      prompt: `Tell me more about the ${project.name} project Creosite built.`,
    })
  }
  const discussIdeaWithCreo = (idea, businessType) => {
    setShowChat(true)
    setChatIntent({
      id: Date.now(),
      prompt: buildIdeaDiscussionPrompt(idea, businessType),
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setShowChat(true), 1500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const grid = workGridRef.current
    if (!grid) return
    const media = window.matchMedia('(max-width: 900px)')
    let frame = 0
    const update = () => {
      frame = 0
      if (!media.matches) return
      const cards = [...grid.querySelectorAll('.project-card')]
      if (!cards.length) return
      const left = grid.getBoundingClientRect().left
      let next = 0
      let distance = Infinity
      cards.forEach((card, index) => {
        const gap = Math.abs(card.getBoundingClientRect().left - left)
        if (gap < distance) { distance = gap; next = index }
      })
      setActiveProject((current) => (current === next ? current : next))
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const onMediaChange = () => { if (media.matches) update(); else setActiveProject(1) }
    update()
    grid.addEventListener('scroll', onScroll, { passive: true })
    media.addEventListener('change', onMediaChange)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      grid.removeEventListener('scroll', onScroll)
      media.removeEventListener('change', onMediaChange)
    }
  }, [])

  const service = services[activeService]
  return <><Header /><main id="top">
    <section className="hero"><svg className="waves" viewBox="0 0 1440 500" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="wave-1" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3a5774" stopOpacity=".82" /><stop offset="1" stopColor="#08090b" stopOpacity="0" /></linearGradient><linearGradient id="wave-2" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#1d2938" /><stop offset="1" stopColor="#08090b" stopOpacity="0" /></linearGradient></defs><path className="a" d="M0 260C220 180 420 200 560 300S900 480 1100 330 1340 160 1440 190V500H0Z" fill="url(#wave-1)" stroke="#b5c0ce" strokeOpacity=".38" strokeWidth="2" /><path className="b" d="M0 330C200 280 380 330 520 400S860 500 1040 400 1320 250 1440 270V500H0Z" fill="url(#wave-2)" opacity=".8" /></svg><div className="wrap hero-content"><div className="chip"><span className="dot" />Creosite Solutions — Websites for what’s next</div><h1><span className="w">Let’s Build</span><span className="w">Something</span><span className="o">Unforgettable.</span></h1><p className="sub">AI-powered web development for modern businesses. Beautiful websites, built in days — not months.</p><div className="built"><i>built by</i><b>humans</b><span>+</span><b className="ai-star">✦ AI</b></div><div className="ctas"><a className="pill solid" href="#ai-ideas">Find AI ideas for your business ↓</a><a className="pill dark" href="#contact">Get started →</a></div></div><span className="mono hero-note">EST. 2024 / INDIA · REMOTE · GLOBAL</span><span className="mono hero-scroll">SCROLL ↓</span></section>
    <section id="work" className="selected-work"><div className="wrap"><h2>Selected <span className="outline">work</span></h2><p className="lead">A few of the digital experiences we&apos;ve built for ambitious brands and communities.</p></div><div className="wrap wide"><div className="work-grid has-active-project" ref={workGridRef}>{projects.map((project, index) => { const isActive = activeProject === index; return <article className={`card project-card ${index !== 1 ? 'side-card' : ''} ${isActive ? 'is-active' : ''}`} key={project.name} style={{ '--brand': project.brand, '--brand-tone': project.tone }} onMouseEnter={() => setActiveProject(index)} onMouseLeave={() => setActiveProject(1)}><BrowserMock image={project.cover} smallImage={project.coverSmall} width={project.width} height={project.height} name={project.name} /><div className="meta"><div><h3>{project.name}</h3><p>{project.description}</p></div><div className="project-meta"><button className="ask-creo" type="button" onClick={() => askCreo(project)} aria-label={`Ask Creo about the ${project.name} project`}><span className="ask-creo-icon" aria-hidden="true">✦</span><span className="ask-creo-label">Ask Creo</span></button><a className="detail-button" href={project.url} target="_blank" rel="noopener noreferrer" onFocus={() => setActiveProject(index)} onBlur={() => setActiveProject(1)}>Details <span>→</span></a></div></div></article>})}</div></div></section>
    <AiWebsiteSection onDiscussIdea={discussIdeaWithCreo} />
    <section id="solutions" className="dark-section"><div className="wrap"><h2>What we <span className="outline">build</span></h2><p className="lead">Pick a service to see what’s included.</p><div className="svc"><div className="tabs" role="tablist" aria-label="Services">{services.map((item, index) => <button className="tab" key={item.name} type="button" role="tab" aria-selected={index === activeService} onClick={() => setActiveService(index)}>{item.name}<span>{index + 1}/{services.length}</span></button>)}</div><div className="panel" role="tabpanel"><div className="fade"><h3>{service.name}</h3><p>{service.description}</p></div><ul className="fade">{service.items.map((item) => <li key={item}>{item}</li>)}</ul></div></div></div></section>
    <section id="about" className="about dark-section"><div className="wrap"><div className="vision-layout"><div className="vision-copy"><span className="eyebrow">OUR PURPOSE</span><h2>Our <span className="outline">vision</span></h2><p>We want to make useful technology part of everyday business, not something that only large companies can afford or understand.</p><p>Our aim is to use AI and digital tools in practical ways that make work faster, more efficient and more affordable for small businesses. Technology only matters when it genuinely helps ordinary people solve real problems, save time and grow with confidence.</p></div><figure className="vision-art"><img src={visionReceipt} srcSet={`${visionReceiptSmall} 480w, ${visionReceipt} 720w`} sizes="(max-width: 900px) 90vw, 420px" width={720} height={927} alt="A receipt-style illustration of Creo’s vision: useful, accessible technology that supports people." loading="lazy" decoding="async" /></figure></div></div></section>
    <section id="contact"><div className="wrap"><h2>Let’s start a <span className="outline">conversation</span></h2><p className="lead">Have a project, question or idea? Send us a note and we’ll be in touch shortly.</p><div className="contact"><div className="info"><p className="contact-kicker">GET IN TOUCH</p><a href={`mailto:${contact.email}`}>{contact.email}</a><p>For projects, questions and partnerships</p><a href={phoneHref}>{contact.phone}</a><p>{contact.hours}</p><a className="whatsapp-option" href={whatsappHref} target="_blank" rel="noopener noreferrer"><span className="whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.48 1.33 4.99L2 22l5.14-1.31A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.81 14.24c-.24.68-1.41 1.31-1.96 1.39-.5.07-1.13.1-1.83-.12-.42-.14-.97-.32-1.67-.62-2.93-1.27-4.83-4.22-4.98-4.43-.15-.2-1.19-1.59-1.19-3.03 0-1.44.76-2.15 1.02-2.44.27-.29.58-.37.78-.37h.57c.18 0 .42-.07.66.51.24.58.83 2 .9 2.14.07.14.12.32.03.51-.1.19-.14.31-.28.49-.15.17-.31.39-.44.53-.15.15-.31.31-.13.54.14.22.64 1.05 1.38 1.7.95.84 1.74 1.1 1.99 1.23.24.13.39.11.54-.07.15-.18.63-.73.8-.98.17-.25.33-.21.57-.12.24.1 1.52.72 1.78.85.26.13.43.2.49.31.06.12.06.69-.18 1.36z"/></svg></span><span><b>WhatsApp us now</b><small>Start a quick conversation</small></span><strong>→</strong></a></div><ContactForm /></div></div></section>
  </main><footer><div className="wrap"><span className="mono">© 2026 CREOSITE SOLUTIONS</span><span className="mono">EST. 2024 / INDIA · REMOTE · GLOBAL</span></div></footer>{showChat && <Suspense fallback={null}><CreoChat intent={chatIntent} /></Suspense>}</>
}
