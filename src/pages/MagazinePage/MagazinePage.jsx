import { lazy, Suspense } from 'react'
import './MagazinePage.css'
import TextScramble from '../../components/TextScramble/TextScramble'

// Local preview only: in a production build the condition is false, so the
// book and turngl are never bundled.
const MagazineBook = import.meta.env.DEV
  ? lazy(() => import('../../components/MagazineBook/MagazineBook'))
  : null

const MagazinePage = () => {
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
            <MagazineBook />
          </Suspense>
        </section>
      )}
    </div>
  )
}

export default MagazinePage
