import type { AcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import { AdviceDisclosure } from './AdviceDisclosure'
import { NormativeMarkdown } from './NormativeMarkdown'

const modeLabels = { hybrid: 'Híbrida (léxica + semántica)', 'lexical-only': 'Solo léxica', unavailable: 'No disponible' }
const generationReasons = {
  not_configured: 'Proveedor no configurado.', timeout: 'El proveedor superó el tiempo de espera.',
  upstream_error: 'El proveedor no está disponible.', invalid_llm_output: 'La respuesta del modelo no pasó la validación.',
  insufficient_evidence: 'Generación omitida por evidencia insuficiente.', disabled: 'Generación con modelo desactivada en este entorno.',
}

export function NormativeDetails({ advice }: { advice: AcademicNormativeResponse }) {
  const gaps = [...new Set(advice.gaps)]
  return <>
    {gaps.length > 0 && <AdviceDisclosure label={`Alcance y verificaciones pendientes (${gaps.length})`}>
      <ul className="normative-advice__list">{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
    </AdviceDisclosure>}
    {advice.status !== 'supported' && <AdviceDisclosure label="Ver respuesta completa">
      <div className="normative-advice__body"><NormativeMarkdown>{advice.answer}</NormativeMarkdown></div>
    </AdviceDisclosure>}
    <AdviceDisclosure label="Detalles técnicos de la consulta">
      <dl className="normative-advice__metadata-list">
        <div><dt>Recuperación</dt><dd>{modeLabels[advice.retrievalMode]}</dd></div>
        {advice.generation && <div><dt>Generación</dt><dd>{advice.generation.mode === 'llm-assisted'
          ? advice.generation.providerLabel ?? 'IA asistida' : 'extractiva'}</dd></div>}
        <div><dt>Estado de la respuesta</dt><dd>{advice.status}</dd></div>
        <div><dt>Filtro de régimen docente</dt><dd>{advice.context.teacherType === 'unknown' ? 'Sin especificar (consulta general)' : advice.context.teacherType}</dd></div>
        <div><dt>Fecha consultada</dt><dd>{advice.context.asOf}</dd></div>
        <div><dt>Ámbito consultado</dt><dd>FISI · {advice.context.academicPeriod}</dd></div>
      </dl>
      {advice.generation?.fallbackReason && <p className="m-0">{generationReasons[advice.generation.fallbackReason]}</p>}
    </AdviceDisclosure>
  </>
}
