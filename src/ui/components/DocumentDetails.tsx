import { headHeightRatio, type PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import { calculateSheetLayout } from '@domain/print-layout/service/SheetLayoutCalculator'
import { A4 } from '@domain/print-layout/model/PaperSize'
import { contentFor, documentPages } from '@content/documents'
import { GENERAL_FAQ } from '@content/site'

/**
 * The reference content below the tool.
 *
 * Two jobs at once, and it is worth being explicit that they align rather than
 * conflict: a person who has just made a photo genuinely wants to know what the
 * rules are and why photos get rejected, and those are the same questions people
 * type into a search engine. Every number here is read from the domain, so the
 * page cannot claim one thing while the tool does another.
 */
export function DocumentDetails({ spec }: { spec: PhotoSpec }) {
  const ratio = headHeightRatio(spec)
  const perSheet = calculateSheetLayout(A4, spec.width, spec.height).capacity
  const content = contentFor(spec.id)

  return (
    <section className="card details">
      <h2>{spec.name} photo requirements</h2>

      {content && <p className="details-lede">{content.intro}</p>}

      <table className="spec-table">
        <tbody>
          <tr>
            <th scope="row">Photo size</th>
            <td>
              {spec.width} × {spec.height} mm
            </td>
          </tr>
          <tr>
            <th scope="row">Head height, chin to crown</th>
            <td>
              {spec.headHeight.min}–{spec.headHeight.max} mm
            </td>
          </tr>
          <tr>
            <th scope="row">Head as share of frame</th>
            <td>
              {Math.round(ratio.min * 100)}–{Math.round(ratio.max * 100)}%
            </td>
          </tr>
          {spec.eyeLineFromBottom && (
            <tr>
              <th scope="row">Eyes from bottom edge</th>
              <td>
                {spec.eyeLineFromBottom.min}–{spec.eyeLineFromBottom.max} mm
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">Background</th>
            <td>{spec.background.description}</td>
          </tr>
          <tr>
            <th scope="row">Minimum print resolution</th>
            <td>{spec.minDpi} dpi</td>
          </tr>
          <tr>
            <th scope="row">Photos per A4 sheet</th>
            <td>{perSheet}</td>
          </tr>
        </tbody>
      </table>

      <h3>Things the tool cannot check for you</h3>
      <ul className="checklist">
        {spec.manualChecks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>

      {content && content.commonRejections.length > 0 && (
        <>
          <h3>Why these photos get rejected</h3>
          <ul className="checklist">
            {content.commonRejections.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}

      <h3>Questions</h3>
      <div className="faq">
        {[...(content?.faq ?? []), ...GENERAL_FAQ].map((entry) => (
          <details key={entry.question}>
            <summary>{entry.question}</summary>
            <p>{entry.answer}</p>
          </details>
        ))}
      </div>

      <h3>Other documents</h3>
      <ul className="doc-links">
        {/* The spec's own name, not the page's search-engine title, which reads
            as marketing copy when it appears inside the app. */}
        {documentPages()
          .filter((page) => page.spec.id !== spec.id)
          .map((page) => (
            <li key={page.content.slug}>
              <a href={`./${page.content.slug}/`}>
                {page.spec.name} ({page.spec.width} × {page.spec.height} mm)
              </a>
            </li>
          ))}
      </ul>
    </section>
  )
}
