import type { ComplianceResult } from '@domain/photo-spec/service/ComplianceChecker'

export function ComplianceList({ results }: { results: readonly ComplianceResult[] }) {
  return (
    <ul className="checks">
      {results.map((result) => (
        <li key={result.id} className={`check ${result.severity}`}>
          <span className="dot" aria-hidden="true" />
          <span>
            <strong>{result.label}. </strong>
            {result.message}
          </span>
        </li>
      ))}
    </ul>
  )
}
