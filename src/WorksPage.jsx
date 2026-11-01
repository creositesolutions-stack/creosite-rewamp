import { lazy, Suspense, useEffect, useState } from 'react'
import { Footer, Header } from './site.jsx'
import { useWorks } from './works.js'

const CreoChat = lazy(() => import('./CreoChat.jsx'))

function WorkCard({ work, index, active, onActivate, onDeactivate, onAskCreo }) {
  const srcSet = work.cover && work.coverSmall ? `${work.coverSmall} 600w, ${work.cover} 1200w` : undefined
  return <article
    className={`work-row ${active ? 'is-active' : ''}`}
    style={{ '--brand': work.brand, '--brand-tone': work.tone }}
    onMouseEnter={onActivate}
    onMouseLeave={onDeactivate}
    onFocus={onActivate}
    onBlur={onDeactivate}
    onTouchStart={onActivate}
  >
    <div className="work-row-media">
      {work.cover
        ? <img src={work.cover} srcSet={srcSet} sizes="(max-width: 900px) 100vw, 560px" alt={`${work.name} website preview`} loading="lazy" decoding="async" />
        : <div className="work-row-placeholder" aria-hidden="true" />}
      <span className="work-row-accent" aria-hidden="true" />
    </div>
    <div className="work-row-body">
      <div className="work-row-top">
        <span className="mono work-row-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="work-row-rule" aria-hidden="true" />
      </div>
      <h3>{work.name}</h3>
      {work.description && <p>{work.description}</p>}
      <div className="work-row-actions">
        <button className="ask-creo work-row-ask" type="button" onClick={() => onAskCreo(work)} aria-label={`Ask Creo about the ${work.name} project`}><span className="ask-creo-icon" aria-hidden="true">✦</span><span className="ask-creo-label">Ask Creo</span></button>
        {work.url && <a className="work-row-link" href={work.url} target="_blank" rel="noopener noreferrer">Visit project <span aria-hidden="true">↗</span></a>}
      </div>
    </div>
  </article>
}

export default function WorksPage() {
  const { works, loading, error } = useWorks()
  const [activeWork, setActiveWork] = useState(null)
  const [chatIntent, setChatIntent] = useState(null)
  const [showChat, setShowChat] = useState(false)

  const askCreo = (work) => {
    setShowChat(true)
    setChatIntent({
      id: Date.now(),
      prompt: `Tell me more about the ${work.name} project Creosite built.`,
    })
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'All work – Creosite Solutions'
    window.scrollTo(0, 0)
    return () => {
      document.title = previousTitle
    }
  }, [])

  return <>
    <Header page="works" />
    <main id="top" className="works-page">
      <section className="works-hero">
        <div className="wrap">
          <p className="eyebrow">PORTFOLIO</p>
          <h1 className="works-title">All our <span className="outline">work</span></h1>
          <p className="lead">Every website, platform and AI project we have built for ambitious brands and communities.</p>
        </div>
      </section>
      <section className="all-work">
        <div className="wrap wide">
          {loading
            ? <p className="mono works-status">LOADING WORK…</p>
            : works.length > 0
              ? <>
                <div className="all-work-list">
                  {works.map((work, index) => <WorkCard
                    key={work.id}
                    work={work}
                    index={index}
                    active={activeWork === work.id}
                    onActivate={() => setActiveWork(work.id)}
                    onDeactivate={() => setActiveWork((current) => (current === work.id ? null : current))}
                    onAskCreo={askCreo}
                  />)}
                </div>
                <div className="work-cta">
                  <p className="eyebrow">READY TO BUILD?</p>
                  <h2>Want a website like this for your company?</h2>
                  <p>Tell us what you are planning and we will help shape it into a fast, polished website that fits your business.</p>
                  <a className="pill solid" href="/contact">Start your website →</a>
                </div>
              </>
              : <div className="work-empty">
                <h3>{error ? 'Work gallery unavailable' : 'Work coming soon'}</h3>
                <p>{error || 'We are putting the finishing touches on this gallery. In the meantime, tell us what you are building.'}</p>
                <a className="pill ghost" href="/contact">Start a project →</a>
              </div>}
        </div>
      </section>
    </main>
    <Footer />
    {showChat && <Suspense fallback={null}><CreoChat intent={chatIntent} /></Suspense>}
  </>
}
