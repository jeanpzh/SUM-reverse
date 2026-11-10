import { ExternalLink } from 'lucide-react'
import type { AcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import { AdviceDisclosure } from './AdviceDisclosure'
import { uniqueNormativeCitations } from './normativePresentation'

export function NormativeEvidence({ citations }: { citations: AcademicNormativeResponse['citations'] }) {
  const sources = uniqueNormativeCitations(citations)
  if (!sources.length) return null
  return <AdviceDisclosure label={`Fuentes localizadas (${sources.length})`}>
    <ol className="normative-advice__citations-list m-0 p-0 list-none">
      {sources.map((citation) => <li key={citation.id} className="normative-advice__citation-card">
        <a href={citation.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
          className="normative-advice__citation-link inline-flex items-center gap-1.5">
          <span>{citation.article} · página PDF {citation.page}</span>
          <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden="true" />
          <span className="sr-only"> (abre en otra pestaña)</span>
        </a>
        <span className="normative-advice__meta">{citation.title}</span>
        <p className="normative-advice__citation-excerpt m-0">«{citation.excerpt}»</p>
        <div className="normative-advice__meta">
          Ámbito {citation.scope} · Revisado el {citation.reviewedAt}<br />
          {citation.effectiveFrom
            ? `Vigencia registrada: ${citation.effectiveFrom} a ${citation.effectiveTo ?? 'sin fin registrado'}`
            : 'Entrada en vigencia sin confirmar'}
          {!citation.effectiveFrom && citation.effectiveTo && ` · Fin registrado: ${citation.effectiveTo}`}
        </div>
      </li>)}
    </ol>
  </AdviceDisclosure>
}
