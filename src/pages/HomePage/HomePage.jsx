import { useEffect, useRef, useState } from 'react'
import { animate, onScroll } from 'animejs'
import './HomePage.css'
import HeroHalftone from '../../components/HeroHalftone/HeroHalftone'
import LogoParticleBg from '../../components/logoParticleBg/logoParticleBg'
import ClothScene from '../../components/ClothScene/ClothScene'
import { useSiteContent } from '../../data/siteContent'

const introParagraphs = [
  'CORS Studio is an independent creative studio founded by Yuehan Ma and Yichen Ji.',
  'Working across design, publishing, and collaborative projects, we bring together different disciplines, perspectives, and creative practices.',
  'From self-initiated publications to commissioned design work, we approach each project as a space for exchange, experimentation, and new connections.',
]

const HomePage = () => {
  const site = useSiteContent()
  const currentEventRef = useRef(null)
  const [showCloth, setShowCloth] = useState(false)

  // Create the cloth WebGL context only once the current event's top reaches
  // the bottom of the viewport, so shader compile stays off the opening frame.
  useEffect(() => {
    const section = currentEventRef.current
    if (!section) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setShowCloth(true)
      observer.disconnect()
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Logo and text scroll out on their own bounds, not as one block.
    // enter: element's bottom reaches viewport center
    // leave: element's bottom reaches viewport top
    const scrollOut = (selector) => {
      const scroller = onScroll({
        target: selector,
        enter: 'center end',
        leave: 'start end',
        sync: 0.4,
      })
      const anim = animate(selector, {
        x: '-110%',
        opacity: 0,
        ease: 'linear',
        autoplay: scroller,
      })
      return { scroller, anim }
    }

    const logo = scrollOut('.hero-intro-logo')
    const text = scrollOut('.hero-intro-text')

    const id = requestAnimationFrame(() => {
      logo.scroller.refresh()
      text.scroller.refresh()
    })
    return () => {
      cancelAnimationFrame(id)
      logo.anim.revert()
      text.anim.revert()
      logo.scroller.revert()
      text.scroller.revert()
    }
  }, [])

  return (
    <div className="home-page">
      <section className="home-hero">
        <HeroHalftone />
        <LogoParticleBg />
        <div className="hero-intro-wrap">
          <div className="hero-intro">
            <img
              src="/assets/icons/corslogo.svg"
              alt="CORS"
              className="hero-intro-logo"
            />
            <div className="hero-intro-text">
              {introParagraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="home-section-2"></section>
      <section className="current-event" ref={currentEventRef}>
        <div className="cloth-canvas-wrap">
          {showCloth && <ClothScene />}
        </div>
        {site && (
          <div className="issue-intro">
            <h2>{site.issueIntro.heading}</h2>
            {site.issueIntro.blocks.map((block) => (
              <p key={block.title || block.text}>
                {block.title && (
                  <>
                    <strong>{block.title}</strong>
                    <br />
                  </>
                )}
                {block.text}
              </p>
            ))}
            <a
              className="issue-apply"
              href={site.issueIntro.apply.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {site.issueIntro.apply.label}
            </a>
          </div>
        )}
      </section>
    </div>
  )
}

export default HomePage
