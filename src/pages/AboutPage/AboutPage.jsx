import './AboutPage.css'
import HeroHalftone from '../../components/HeroHalftone/HeroHalftone'

const aboutParagraphs = [
  'CORS Studio is an independent creative studio founded by Yuehan Ma and Yichen Ji.',
  'Our practice moves across design, publishing, art, and digital culture, taking different forms depending on the context of each project. We work on both self-initiated and commissioned projects, including visual identities, editorial design, digital experiences, publications, campaigns, and other forms of creative collaboration.',
  'The name CORS comes from “Cross-Origin Resource Sharing,” a term borrowed from web technology that describes how resources can move between different origins. For us, it reflects a broader way of working: bringing together ideas, disciplines, people, and references that begin in different places and allowing new relationships to form between them.',
  'Rather than working within a single medium or fixed methodology, we see each project as a system of relationships. Strategy, image, typography, technology, writing, and spatial thinking can all become part of the same process. Our role is to understand how these elements can work together to create something clear, relevant, and distinctive.',
  'Alongside our design practice, publishing is an important part of CORS Studio. Through independently produced publications, open calls, and collaborative editorial projects, we create spaces where writing, artwork, photography, and other forms of creative work can exist in conversation.',
  'We are especially interested in what happens when different perspectives are placed beside one another. A photograph can change the way a text is understood; a digital system can influence a visual identity; an editorial structure can become a way of organizing ideas rather than simply presenting them.',
  'Whether we are developing a publication, building an identity, or working with a client on a commissioned project, we approach design as a process of connection—between disciplines, contexts, audiences, and ideas.',
  'Across origins, beyond boundaries.',
]

const AboutPage = () => {
  return (
    <div className="about-page">
      <HeroHalftone text={false} />
      <section className="about-section-1">
        <div className="about-intro">
          {aboutParagraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </section>
    </div>
  )
}

export default AboutPage
