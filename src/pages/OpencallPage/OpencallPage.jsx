import './OpencallPage.css'

const lookingFor = [
  'Everything from artworks to writing pieces, photography, prints, poems, painting, drawing, sculptures, video frames, and film.',
  'Basically anything, as long as it can be printed and presented on paper.',
]

const applicationSteps = [
  'Submit to the open call',
  'We select the works',
  'Announcement',
  'We make the magazine',
  'Launch event',
]

const OpencallPage = () => {
  return (
    <div className="opencall-page">
      <section className="opencall-section">
        <div className="opencall-copy">
          <h2>What are we looking for</h2>
          {lookingFor.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </section>
      <section className="opencall-section">
        <div className="opencall-copy">
          <h2>Application</h2>
          <ol className="opencall-steps">
            {applicationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
      <section className="opencall-section"></section>
      <section className="opencall-section"></section>
    </div>
  )
}

export default OpencallPage
