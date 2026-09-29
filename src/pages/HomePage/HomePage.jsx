import './HomePage.css'
import HeroBackground from '../../components/HeroBackground/HeroBackground'

const introParagraphs = [
  'CORS Studio is an independent publishing and design studio founded by Yuehan Ma and Yichen Ji. We bring together writing, artwork, photography, and other print-based contributions from diverse creative voices.',
  'We create publications as spaces for exchange, where different voices, disciplines, and ways of seeing can meet. By placing writing, art, and photography in conversation, we invite contributors and readers to discover connections that might otherwise remain unseen.',
  'CORS Studio approaches publishing as a shared space for experimentation, exchange, and discovery. Rather than presenting a single fixed interpretation, each publication becomes a collective response shaped by the people who contribute to it.',
]

const HomePage = () => {
  return (
    <div className="home-page">
      <section className="home-hero">
        <HeroBackground />
        <div className="hero-intro">
          {introParagraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </section>
      <section className="home-section-2"></section>
    </div>
  )
}

export default HomePage
