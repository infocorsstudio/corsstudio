import './MagazinePage.css'
import TextScramble from '../../components/TextScramble/TextScramble'

const MagazinePage = () => {
  return (
    <div className="magazine-page">
      <section className="magazine-hero">
        <h1 className="magazine-hero-text">
          <TextScramble text="ISSUE 001 COMING SOON" delay={0} />
        </h1>
      </section>
    </div>
  )
}

export default MagazinePage
