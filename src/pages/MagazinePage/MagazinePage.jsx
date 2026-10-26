import { lazy, Suspense, useRef, useState } from 'react'
import './MagazinePage.css'
import TextScramble from '../../components/TextScramble/TextScramble'
import MagazineSlider from '../../components/MagazineSlider/MagazineSlider'

// Local preview only: in a production build the condition is false, so the
// book and turngl are never bundled.
const MagazineBook = import.meta.env.DEV
  ? lazy(() => import('../../components/MagazineBook/MagazineBook'))
  : null

const MagazinePage = () => {
  const bookRef = useRef(null)
  const sliderRef = useRef(null)
  const [spread, setSpread] = useState({ current: 0, last: 0 })

  return (
    <div className="magazine-page">
      <section className="magazine-hero">
        <h1 className="magazine-hero-text">
          <TextScramble text="ISSUE 001 COMING SPRING 2027" delay={0} />
        </h1>
      </section>
      {MagazineBook && (
        <section className="magazine-section-2">
          <Suspense fallback={null}>
            <MagazineBook
              ref={bookRef}
              onSpreadChange={(current, last) => {
                sliderRef.current?.moveTo(current)
                const shown = Math.round(current)
                setSpread((prev) =>
                  prev.current === shown && prev.last === last ? prev : { current: shown, last },
                )
              }}
            />
          </Suspense>
          {spread.last > 0 && (
            <MagazineSlider
              ref={sliderRef}
              spread={spread.current}
              lastSpread={spread.last}
              onScrub={(s) => bookRef.current?.scrub(s)}
              onChange={(s) => bookRef.current?.goTo(s)}
            />
          )}
        </section>
      )}
    </div>
  )
}

export default MagazinePage
