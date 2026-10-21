import { useRef } from 'react'
import './OpencallPage.css'
import { useSiteContent } from '../../data/siteContent'
import useScrollReveal from '../../hooks/useScrollReveal'

const lookingFor = {
  lead: 'Issue 001 invites artists, designers, writers, and photographers at any stage of their practice to submit work that responds to one of its three sections: Almost Human, The Other Side, or Something Is Missing.',
  formats: [
    'Visual art, including painting, drawing, printmaking, and sculpture',
    'Photography and image-based work',
    'Writing, including essays, short fiction, and poetry',
    'Moving image, presented as film stills or video frames',
    'Graphic, fashion, and experimental design',
  ],
  note: 'Any medium is welcome, provided the work can be translated onto the printed page.',
}

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
  useScrollReveal(pageRef)

  return (
    <div className="opencall-page" ref={pageRef}>
      <section className="opencall-section opencall-hero">
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
            <div className="opencall-issue" />
          </>
        )}
      </section>
      <section className="opencall-section">
        <div className="opencall-copy">
          <h2 data-reveal>What We Are Looking For</h2>
          <p className="opencall-lead" data-reveal>
            {lookingFor.lead}
          </p>
          <ul className="opencall-list">
            {lookingFor.formats.map((text) => (
              <li key={text} data-reveal>
                {text}
              </li>
            ))}
          </ul>
          <p data-reveal>{lookingFor.note}</p>
        </div>
      </section>
      <section className="opencall-section opencall-last">
        <div className="opencall-copy">
          <h2 data-reveal>Application Process</h2>
          <ol className="opencall-list">
            {applicationSteps.map((step, i) => (
              <li className="opencall-step" key={step.title} data-reveal>
                <span className="opencall-index">
                  {String(i + 1).padStart(2, '0')}
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
