import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { animate } from 'animejs'
import TextScramble from '../TextScramble/TextScramble'
import './Header.css'

const navItems = [
  { path: '/opencall', label: 'OPEN CALL' },
  { path: '/magazine', label: 'MAGAZINE' },
  { path: '/about', label: 'ABOUT' },
]

const Header = () => {
  const location = useLocation()
  const isHome = location.pathname === '/'

  // Home only: center logo stays hidden on the hero, then fades in as section 2
  // travels from 30% of the viewport to the top. Same per-frame inertia as the
  // particle scatter (anime.js sync 0.4).
  useEffect(() => {
    const center = document.getElementById('navCenter')
    if (!center || !isHome) return

    const target = { value: 0 }
    const current = { value: 0 }
    let frameId = 0
    let running = false
    const step = 0.01 + 0.19 * 0.4

    const updateTarget = () => {
      const section2 = document.querySelector('.home-section-2')
      if (!section2) return
      const top = section2.getBoundingClientRect().top
      const start = window.innerHeight * 0.3
      target.value = Math.min(Math.max((start - top) / start, 0), 1)
    }

    const tick = () => {
      current.value += (target.value - current.value) * step
      if (Math.abs(target.value - current.value) < 0.0005) {
        current.value = target.value
        running = false
      }
      center.style.opacity = String(current.value)
      if (running) frameId = requestAnimationFrame(tick)
    }

    const kick = () => {
      updateTarget()
      if (!running) {
        running = true
        tick()
      }
    }

    kick()
    window.addEventListener('scroll', kick, { passive: true })
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', kick)
      center.style.opacity = ''
    }
  }, [isHome])

  // Header entrance animation on route change
  useEffect(() => {
    animate('#header', {
      opacity: [0, 1],
      translateY: [-50, 0],
      duration: 900,
      delay: 1000,
      ease: 'out(4)',
    })
  }, [location.pathname])

  // Right side shows links to other pages, excluding the current one
  const rightLinks = navItems.filter((item) => item.path !== location.pathname)

  // Hover color animation (animejs), 0.4s ease
  const getThemeColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-theme').trim()

  const getTextColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()

  const handleEnter = (e) => {
    animate(e.currentTarget, {
      color: getThemeColor(),
      borderColor: getThemeColor(),
      duration: 400,
      ease: 'out(4)',
    })
  }

  const handleLeave = (e) => {
    animate(e.currentTarget, {
      color: getTextColor(),
      borderColor: getTextColor(),
      duration: 400,
      ease: 'out(4)',
    })
  }

  const handleLogoEnter = () => {
    animate('#navLogo .logo-text', {
      color: getThemeColor(),
      duration: 400,
      ease: 'out(4)',
    })
  }

  const handleLogoLeave = () => {
    animate('#navLogo .logo-text', {
      color: getTextColor(),
      duration: 400,
      ease: 'out(4)',
    })
  }

  return (
    <header id="header" className={isHome ? 'header-home' : undefined}>
      <nav id="navbar">
        {/* Left: studio name, links back to home */}
        <Link
          to="/"
          id="navLogo"
          onMouseEnter={handleLogoEnter}
          onMouseLeave={handleLogoLeave}
        >
          <span className="logo-text">
            <TextScramble text="CORS Studio" trigger={location.pathname} />
          </span>
        </Link>

        {/* Center: logo icon */}
        <Link to="/" id="navCenter">
          <img src="/assets/icons/logo.svg" alt="CORS Studio" className="logo-icon" />
        </Link>

        {/* Right: links to the other pages */}
        <div id="navLinks">
          {rightLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="navText"
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              <TextScramble text={item.label} trigger={location.pathname} />
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}

export default Header
