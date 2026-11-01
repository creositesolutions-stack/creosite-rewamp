import { useState } from 'react'

export function Mark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5dbe3" /><stop offset="1" stopColor="#7392b4" /></linearGradient></defs><path d="M30 8H14a6 6 0 0 0-6 6v12a6 6 0 0 0 6 6h16" stroke="url(#logo-gradient)" strokeWidth="6" strokeLinecap="round" /><path d="M20 20h12" stroke="url(#logo-gradient)" strokeWidth="6" strokeLinecap="round" /></svg>
}

export function BrowserMock({ image, smallImage, name, width, height }) {
  const srcSet = image && smallImage ? `${smallImage} 600w, ${image} 1200w` : undefined
  return <div className="shot"><div className="browser">
    {image && <img className="cover-blur" src={image} srcSet={srcSet} sizes="(max-width: 900px) 90vw, 420px" alt="" aria-hidden="true" loading="lazy" decoding="async" />}
    <div className="bar"><span /><span /><span /></div>
    {image
      ? <img className="project-cover" src={image} srcSet={srcSet} sizes="(max-width: 900px) 90vw, 420px" width={width || undefined} height={height || undefined} alt={`${name} website preview`} loading="lazy" decoding="async" />
      : <div className="mock"><div className="mock-heading" /><div className="mock-line line-wide" /><div className="mock-line line-short" /><div className="mock-row"><div /><div /><div /></div></div>}
  </div></div>
}

export function Header({ page = 'home' }) {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)
  const homePrefix = page === 'home' ? '' : '/'

  return <header><div className="wrap"><nav>
    <a href={`${homePrefix}#top`} className="logo" aria-label="Creosite Solutions home" onClick={closeMenu}><Mark /><span>Creosite<small>SOLUTIONS</small></span></a>
    <div className={`links ${open ? 'open' : ''}`}>
      <a href={`${homePrefix}#top`} onClick={closeMenu} aria-current={page === 'home' ? 'page' : undefined}>Home</a>
      <a href="/work" onClick={closeMenu} aria-current={page === 'works' ? 'page' : undefined}>Work</a>
      <a href={`${homePrefix}#solutions`} onClick={closeMenu}>Solutions</a>
      <a href={`${homePrefix}#about`} onClick={closeMenu}>Vision</a>
      <a href="/contact" onClick={closeMenu} aria-current={page === 'contact' ? 'page' : undefined}>Contact</a>
    </div>
    <a className="pill ghost" href="/contact">Start a project →</a>
    <button className="menu" type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
  </nav></div></header>
}

export function Footer() {
  return <footer><div className="wrap"><span className="mono">© 2026 CREOSITE SOLUTIONS</span><span className="mono">EST. 2024 / INDIA · REMOTE · GLOBAL</span></div></footer>
}
