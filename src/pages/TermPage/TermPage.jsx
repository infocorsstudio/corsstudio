import { useRef } from 'react'
import './TermPage.css'
import { useSiteContent } from '../../data/siteContent'
import useScrollReveal from '../../hooks/useScrollReveal'

const TermPage = () => {
  const site = useSiteContent()
  const pageRef = useRef(null)
  useScrollReveal(pageRef, [site])

  return (
    <div className="term-page" ref={pageRef}>
      {site && (
        <>
          <section className="term-section">
            <div className="term-copy">
              <h2 data-reveal>{site.term.faq.heading}</h2>
              {site.term.faq.items.map((item) => (
                <div className="term-item" key={item.question} data-reveal>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="term-section">
            <div className="term-copy">
              <h2 data-reveal>{site.term.heading}</h2>
              <p className="term-intro" data-reveal>
                {site.term.intro}
              </p>
              {site.term.sections.map((section, i) => (
                <div className="term-item" key={section.title} data-reveal>
                  <span className="term-index">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default TermPage
