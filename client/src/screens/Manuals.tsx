import { tutorialResources } from '../data/tutorialResources'

export function Manuals() {
  return (
    <section className="manual-paper">
      <div className="tutorial-list">
        <span className="tutorial-legend">VideoTutoriales</span>
        {tutorialResources.map(({ title, description, publicationDate, product }) => (
          <article className="tutorial-card" key={title}>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <div className="tutorial-meta">
              <time dateTime={publicationDate}>29/01/2024</time>
              <span>{product}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
