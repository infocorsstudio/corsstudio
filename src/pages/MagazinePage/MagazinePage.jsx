import { lazy, Suspense, useRef, useState } from 'react'
import './MagazinePage.css'
import TextScramble from '../../components/TextScramble/TextScramble'

// Local preview only. Production builds drop this branch, so the book, the
// slider, and turngl are never bundled and the hero keeps the coming-soon line.
const MagazineBook = import.meta.env.DEV
  ? lazy(() => import('../../components/MagazineBook/MagazineBook'))
  : null
const MagazineSlider = import.meta.env.DEV
  ? lazy(() => import('../../components/MagazineSlider/MagazineSlider'))
  : null

const MagazinePage = () => {
  const bookRef = useRef(null)
  const sliderRef = useRef(null)
  const [spread, setSpread] = useState({ current: 0, last: 0 })

  return (
    <div className="magazine-page">
      <section className="magazine-hero">
        {MagazineBook ? (
          <>
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
              {spread.last > 0 && (
                <MagazineSlider
                  ref={sliderRef}
                  spread={spread.current}
                  lastSpread={spread.last}
                  onScrub={(s) => bookRef.current?.scrub(s)}
                  onChange={(s) => bookRef.current?.goTo(s)}
                />
              )}
            </Suspense>
          </>
        ) : (
          <h1 className="magazine-hero-text">
            <TextScramble text="ISSUE 001 COMING SPRING 2027" delay={0} />
          </h1>
        )}
      </section>
    </div>
  )
}

export default MagazinePage
