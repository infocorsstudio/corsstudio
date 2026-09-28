import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { animate } from 'animejs'
import './Header.css'

const navItems = [
  { path: '/opencall', label: 'OPEN CALL' },
  { path: '/magazine', label: 'MAGAZINE' },
  { path: '/about', label: 'ABOUT' },
]

const Header = () => {
  const location = useLocation()

  // Header entrance animation on route change
  useEffect(() => {
    animate('#header', {
      opacity: [0, 1],
      translateY: [-50, 0],
      duration: 1000,
      delay: 300,
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
    <header id="header">
      <nav id="navbar">
        {/* Left: studio name, links back to home */}
        <Link
          to="/"
          id="navLogo"
          onMouseEnter={handleLogoEnter}
          onMouseLeave={handleLogoLeave}
        >
          <span className="logo-text">CORS Studio</span>
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
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}

export default Header
