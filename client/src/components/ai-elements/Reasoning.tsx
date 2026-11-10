import type { AcademicAdvisorResponse } from '../../data/academicScheduling'

// Operational records returned by executed tools; never model thoughts.
export function Reasoning({ steps }: { steps: AcademicAdvisorResponse['reasoningSteps'] }) {
  if (!steps?.length) return null
  return <details className="min-w-0 border-0 border-y border-solid border-border py-3 text-sm">
    <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-ring">Herramientas ejecutadas ({steps.length})</summary>
    <ol className="m-0 mt-3 grid gap-3 pl-5">
      {steps.map((step, index) => <li key={`${step.toolName}-${index}`} className="min-w-0 [overflow-wrap:anywhere]">
        <strong>{step.toolName}</strong>
        <p className="m-0 mt-1">Entrada: {step.inputSummary}</p>
        <p className="m-0 mt-1">Resultado: {step.outputSummary}</p>
      </li>)}
    </ol>
  </details>
}
