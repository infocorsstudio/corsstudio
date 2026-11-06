import { useState } from 'react'
import { tintIcon } from '../../buttonHover'
import './Footer.css'

const EMAIL = 'info@corsstudio.com'

const Footer = () => {
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    const pending = navigator.clipboard.writeText(EMAIL)
    const area = document.createElement('textarea')
    area.value = EMAIL
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.focus()
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (ok) {
      setCopied(true)
      return
    }
    pending.then(() => setCopied(true)).catch(() => {})
  }

  return (
    <footer className="site-footer">
      <p className="site-footer-copy">© CORS Studio 2026</p>
      <div className="site-footer-social">
        <button
          type="button"
          className="site-footer-link site-footer-email"
          aria-label="Email"
          onClick={copyEmail}
          onMouseEnter={(e) => tintIcon(e.currentTarget, true)}
          onMouseLeave={(e) => tintIcon(e.currentTarget, false)}
        />
        <a
          className="site-footer-link site-footer-instagram"
          href="https://www.instagram.com/corsstudio/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          onMouseEnter={(e) => tintIcon(e.currentTarget, true)}
          onMouseLeave={(e) => tintIcon(e.currentTarget, false)}
        />
      </div>
      {copied && (
        <div className="site-footer-copied" onClick={() => setCopied(false)}>
          <p>The email has been copied to the clipboard.</p>
        </div>
      )}
    </footer>
  )
}

export default Footer
