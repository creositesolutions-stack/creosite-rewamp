import { useEffect, useRef } from 'react'
import { Header, Footer } from './site.jsx'
import './about-page.css'

// Tune all scroll-linked motion here; no animation dependency is required.
const MOTION = { panelTravel: 900, heroFadeAt: 0.82, cardStagger: 100, wordPin: 720, mobileWordPin: 680, countDuration: 1200 }
const statement = 'We make useful technology feel effortless, helping ambitious small businesses do more with thoughtful design, practical AI and dependable development.'
const features = [
  ['01', 'Built around people', 'Every good digital experience starts by understanding the people it needs to serve.'],
  ['02', 'Made to move you forward', 'We turn clear ideas into thoughtful websites and tools that create real momentum.'],
  ['03', 'Technology made useful', 'From AI to everyday workflows, we make technology practical, accessible and human.'],
]
const stats = [['241', 'projects and ideas shaped'], ['98%', 'of clients recommend us'], ['36', 'builders in our network']]

function useAboutMotion(root) {
  useEffect(() => {
    const node = root.current
    if (!node) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const panel = node.querySelector('.about-glass')
    const background = node.querySelector('.about-backdrop')
    const headline = node.querySelector('.about-headline')
    const quote = node.querySelector('.about-quote')
    const words = [...node.querySelectorAll('.statement-word')]
    let frame = 0
    const update = () => {
      frame = 0
      if (reduced.matches) return
      const y = window.scrollY
      const panelTop = panel.getBoundingClientRect().top + y
      const travel = Math.max(0, Math.min(1, (y - (panelTop - innerHeight * .55)) / MOTION.panelTravel))
      if (headline) { headline.style.transform = `translate3d(0,${-y * .3}px,0)`; headline.style.opacity = `${Math.max(0, 1 - travel * 1.8)}` }
      if (quote) { quote.style.transform = `translate3d(0,${-y * .32}px,0)`; quote.style.opacity = `${Math.max(0, 1 - travel * 2.2)}` }
      if (panel) panel.style.transform = `translate3d(0,${(1 - travel) * 10}px,0)`
      const fade = Math.max(0, 1 - travel / MOTION.heroFadeAt)
      if (background) { background.style.opacity = `${fade}`; background.style.transform = `translate3d(4%,${-travel * 9}%,0) scale(${1 + travel * .08})` }
      const statementSection = node.querySelector('.about-statement')
      if (statementSection && words.length) {
        const rect = statementSection.getBoundingClientRect()
        const pin = matchMedia('(max-width: 640px)').matches ? MOTION.mobileWordPin : MOTION.wordPin
        const progress = Math.max(0, Math.min(1, (innerHeight * .72 - rect.top) / pin))
        words.forEach((word, index) => { word.style.opacity = `${.22 + .78 * Math.max(0, Math.min(1, progress * words.length - index))}` })
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); reduced.addEventListener?.('change', schedule)
    update()
    const cards = [...node.querySelectorAll('.about-feature')]
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) } }), { threshold: .15, rootMargin: '0px 0px -12% 0px' })
    cards.forEach((card, index) => { card.style.transitionDelay = `${index * MOTION.cardStagger}ms`; observer.observe(card) })
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); reduced.removeEventListener?.('change', schedule); cancelAnimationFrame(frame); observer.disconnect() }
  }, [root])
}

function Stat({ value, label }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      const target = Number(value.replace(/\D/g, ''))
      const start = performance.now()
      const tick = (now) => { const progress = Math.min(1, (now - start) / MOTION.countDuration); el.textContent = `${Math.round(target * (1 - (1 - progress) ** 3))}${value.includes('%') ? '%' : ''}`; if (progress < 1) requestAnimationFrame(tick) }
      requestAnimationFrame(tick); observer.disconnect()
    }, { threshold: .4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])
  return <div className="about-stat"><span ref={ref} className="stat-number">0</span><span className="stat-label">{label}</span></div>
}

export default function AboutPage() {
  const root = useRef(null)
  useAboutMotion(root)
  const words = statement.split(' ')
  useEffect(() => { document.title = 'About – Creosite Solutions'; window.scrollTo(0, 0) }, [])
  return <div className="about-page" ref={root}>
    <Header page="about" />
    <a className="about-back" href="/#top" aria-label="Back to home">←</a>
    <div className="about-backdrop" aria-hidden="true" />
    <main id="top">
      <section className="about-intro">
        <div className="about-intro-layout wrap">
          <div className="about-headline"><p className="eyebrow">CREOSITE / WHO WE ARE</p><h1><span>Good ideas,</span><span>made real</span><span className="outline">for everyone.</span></h1><p className="about-subtitle">A small digital studio building useful things for businesses with big plans.</p></div>
          <aside className="about-social"><div className="avatar-stack" aria-label="Our team"><span>C</span><span>R</span><span>S</span></div><div className="about-quote">“They made the whole process feel clear, collaborative and genuinely exciting.”<small>— A CREOSITE CLIENT</small></div></aside>
        </div>
        <div className="about-glass wrap"><div className="about-glass-heading"><span className="eyebrow">A LITTLE ABOUT US</span><h2>Who we<br />really are.</h2></div><div className="about-glass-copy"><p>We’re a curious team of designers and developers who believe great technology should make everyday work simpler, not more complicated.</p><a className="pill solid" href="/contact">Let’s build something →</a></div></div>
      </section>
      <section className="about-features wrap"><div className="about-feature-heading"><p className="eyebrow">THE WAY WE WORK</p><h2>Thoughtful by<br /><span className="outline">design.</span></h2></div><div className="about-feature-grid">{features.map(([number, title, body]) => <article className="about-feature" key={number}><span className="feature-index">{number} / 03</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="about-statement"><div className="about-statement-inner wrap"><p className="eyebrow">WHAT WE BELIEVE</p><p className="statement-copy" aria-label={statement}>{words.map((word, index) => <span className="statement-word" key={`${word}-${index}`}>{word}{index < words.length - 1 ? ' ' : ''}</span>)}</p><div className="about-stats">{stats.map(([value, label]) => <Stat key={label} value={value} label={label} />)}</div><a className="pill about-final-cta" href="/contact">Let’s talk <span>↗</span></a></div><div className="about-statement-footer wrap"><span>© 2026 CREOSITE SOLUTIONS</span><a href="#top">BACK TO TOP ↑</a></div></section>
    </main>
    <Footer />
  </div>
}
