import { useEffect } from 'react'
import { animate, onScroll } from 'animejs'
import './HomePage.css'
import HeroBackground from '../../components/HeroBackground/HeroBackground'
import ClothScene from '../../components/ClothScene/ClothScene'

const introParagraphs = [
  'CORS Studio is an independent publishing and design studio founded by Yuehan Ma and Yichen Ji. We bring together writing, artwork, photography, and other print-based contributions from diverse creative voices.',
  'We create publications as spaces for exchange, where different voices, disciplines, and ways of seeing can meet. By placing writing, art, and photography in conversation, we invite contributors and readers to discover connections that might otherwise remain unseen.',
  'CORS Studio approaches publishing as a shared space for experimentation, exchange, and discovery. Rather than presenting a single fixed interpretation, each publication becomes a collective response shaped by the people who contribute to it.',
]

const HomePage = () => {
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
        <HeroBackground />
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
      <section className="home-section-3">
        <div className="cloth-canvas-wrap">
          <ClothScene />
        </div>
        <div className="issue-intro">
          <h2>CORS Issue 001 / Spring 2027</h2>
          <p>
            CORS Studio is pleased to present its inaugural issue. Issue 001
            brings together three interconnected sections that examine unstable
            boundaries, altered identities, and the traces left by what can no
            longer be seen.
          </p>
          <p>
            <strong>I. Almost Human</strong>
            <br />
            Where does the human end, and something else begin?
          </p>
          <p>
            <strong>II. The Other Side</strong>
            <br />
            What exists beyond the boundaries we know?
          </p>
          <p>
            <strong>III. Something Is Missing</strong>
            <br />
            How do we recognize something through its absence?
          </p>
          <p>
            Spanning fashion, graphic design, art, photography, writing, and
            contemporary culture, Issue 001 considers what it means to approach a
            boundary, to cross it, and to attend to what has been left behind.
          </p>
          <p>Open calls for each section will be announced in due course.</p>
          <a
            className="issue-apply"
            href="about:blank"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply Now
          </a>
        </div>
      </section>
    </div>
  )
}

export default HomePage
