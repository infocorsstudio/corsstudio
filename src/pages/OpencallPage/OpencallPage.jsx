import { useEffect, useRef, useState } from 'react'
import './OpencallPage.css'
import { useSiteContent } from '../../data/siteContent'
import useScrollReveal from '../../hooks/useScrollReveal'
import { fillButton } from '../../buttonHover'
import LogoSpinBg from '../../components/logoSpinBg/logoSpinBg'

const work = (file) => `/assets/works/featuredWorks/${encodeURIComponent(file)}`

const lookingFor = {
  lead: 'CORS Studio works with artists, designers, writers, and photographers at any stage of their practice. We look for work across image, text, and design that has something precise to say. Any medium is welcome, as long as the work can live on the printed page.',
  formats: [
    {
      text: 'Visual art, including painting, drawing, printmaking, and sculpture',
      images: [
        work('Xianglong Li_Born Slippy.jpg'),
        work('Yichen Ji_Synthetic Genesis.jpg'),
        work('Jiayu Du_Odentalgia.jpg'),
        work('Luyi Wang_Portable Privacy.jpg'),
      ],
    },
    {
      text: 'Photography and image-based work',
      images: [
        work('Cici Niu_Behind the Curtain01.jpg'),
        work('Pepper Liu_embryo 02.jpg'),
        work('Cici Niu_BlacknWhite01.jpg'),
      ],
    },
    {
      text: 'Writing, including essays, short fiction, and poetry',
      images: [
        work('Yuehan Ma_The Loop 01.jpg'),
        work('Yuehan Ma_The LOOP 1.jpg'),
        work('Yuehan Ma_DesireLoops.jpg'),
      ],
    },
    {
      text: 'Moving image, presented as film stills or video frames',
      images: [
        work('Luyi Wang_Montage #4.jpg'),
        work('Yixhen Ji_Glorious Evolution.jpg'),
      ],
    },
    {
      text: 'Graphic, fashion, and experimental design',
      images: [
        work('Ruihan Zhang_2-and-others.jpg'),
        work('Yichen Ji_Chaos Clock.png'),
        work('Yuehan Ma_Pixel Eden.jpg'),
        work('Feiyang Yin_Girls，Girls，Girls！.jpeg'),
      ],
    },
  ],
}

const SLIDE_MS = 3000

const applicationSteps = [
  {
    title: 'Submission',
    text: 'Submit your work through the open call, together with a short statement and the section it responds to.',
  },
  {
    title: 'Review',
    text: 'The CORS Studio editorial team reviews every submission against the concept and direction of the issue.',
  },
  {
    title: 'Announcement',
    text: 'All applicants are notified of the outcome by email, and selected contributors are announced.',
  },
  {
    title: 'Production',
    text: 'Selected contributors work with CORS Studio as the issue is edited, designed, and prepared for print.',
  },
  {
    title: 'Launch',
    text: 'The issue is released with a launch event that brings contributors and readers together.',
  },
]

const OpencallPage = () => {
  const site = useSiteContent()
  const pageRef = useRef(null)
  const sectionTwoRef = useRef(null)
  const [slides, setSlides] = useState(() => lookingFor.formats.map(() => 0))
  useScrollReveal(pageRef)

  // Each card advances at the same interval, offset so the five never switch together.
  useEffect(() => {
    const ids = lookingFor.formats.map((format, i) => {
      const count = format.images.length
      if (count < 2) return 0
      const step = () => {
        setSlides((prev) => {
          const next = [...prev]
          next[i] = (next[i] + 1) % count
          return next
        })
      }
      const delay = Math.round((SLIDE_MS / lookingFor.formats.length) * i)
      return window.setTimeout(() => {
        step()
        ids[i] = window.setInterval(step, SLIDE_MS)
      }, delay)
    })
    return () => {
      ids.forEach((id) => {
        window.clearTimeout(id)
        window.clearInterval(id)
      })
    }
  }, [])

  return (
    <div className="opencall-page" ref={pageRef}>
      <LogoSpinBg />
      <section className="opencall-section opencall-hero opencall-intro">
        {site && (
          <>
            <img
              className="opencall-hero-image"
              src={site.assets.mainHero}
              alt={site.assets.mainHeroAlt}
            />
            <div className="opencall-issue">
              <h2>{site.openCall.heading}</h2>
              {site.openCall.blocks.map((block) => (
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
              <button
                type="button"
                className="opencall-apply"
                onMouseEnter={(e) => fillButton(e.currentTarget, true)}
                onMouseLeave={(e) => fillButton(e.currentTarget, false)}
                onClick={() => {
                  sectionTwoRef.current?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {site.openCall.exploreLabel}
              </button>
            </div>
          </>
        )}
      </section>
      <section className="opencall-section opencall-hero" ref={sectionTwoRef}>
        {site && (
          <>
            <img
              className="opencall-hero-image"
              src={site.assets.openCallPoster}
              alt={site.assets.openCallPosterAlt}
            />
            <div className="opencall-issue opencall-call">
              <div className="opencall-call-block">
                <h2>{site.openCall.almostHuman.heading}</h2>
                <p>
                  <strong>{site.openCall.almostHuman.title}</strong>
                </p>
                {site.openCall.almostHuman.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {site.openCall.almostHuman.details.map((item) => (
                  <p key={item.label}>
                    <strong>{item.label}:</strong> {item.text}
                  </p>
                ))}
                <a
                  className="opencall-apply"
                  href={site.openCall.almostHuman.apply.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={(e) => fillButton(e.currentTarget, true)}
                  onMouseLeave={(e) => fillButton(e.currentTarget, false)}
                >
                  {site.openCall.almostHuman.apply.label}
                </a>
              </div>
            </div>
          </>
        )}
      </section>
      <section className="opencall-section opencall-hero opencall-looking">
        <ul className="opencall-bento">
          <li className="opencall-bento-text" data-reveal>
            <div className="opencall-bento-face">
              <h2>What We Are Looking For</h2>
              <p>{lookingFor.lead}</p>
            </div>
          </li>
          {lookingFor.formats.map((format, i) => (
            <li key={format.text} data-reveal data-scramble>
              <div className="opencall-bento-images">
                {format.images.map((src, imageIndex) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className={imageIndex === slides[i] ? 'is-active' : undefined}
                  />
                ))}
              </div>
              <div className="opencall-bento-face">
                <span>{format.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="opencall-section opencall-hero opencall-process">
        <div className="opencall-process-body">
          <h2 data-reveal>Application Process</h2>
          <ol className="opencall-line" data-reveal>
            {applicationSteps.map((step, i) => (
              <li className="opencall-step" key={step.title}>
                <span className="opencall-dot" />
                <span className="opencall-index">
                  {String(i + 1).padStart(3, '0')}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}

export default OpencallPage
