import { Shimmer } from '@shimmer-from-structure/react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table'
import './PlanningFetchLoading.css'

export type PlanningLoadingLayout =
  | 'answer'
  | 'cards'
  | 'table'
  | 'courses-table'
  | 'publication-table'
  | 'intention-table'
  | 'page'

export interface PlanningFetchLoadingProps {
  label: string
  layout?: PlanningLoadingLayout
}

// Measurement-only templates: no fixtures, requests, controls or application effects.
// Structured to match real DOM geometry to avoid layout shifts (CLS).
export function PlanningFetchLoading({ label, layout = 'answer' }: PlanningFetchLoadingProps) {
  return (
    <div className="planning-fetch-loading" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" inert>
        <Shimmer
          loading
          backgroundColor="var(--planning-selected, rgba(255, 255, 255, 0.05))"
          shimmerColor="var(--planning-border, rgba(255, 255, 255, 0.15))"
          duration={1.8}
          fallbackBorderRadius={6}
        >
          {layout === 'courses-table' ? (
            <div className="academic-preparation planning-fetch-loading__courses-workbench">
              <div className="academic-scheduling__cycle-filter planning-fetch-loading__filter-skeleton">
                <div className="planning-fetch-loading__field">
                  <span className="planning-fetch-loading__bar" style={{ width: 140, height: 14 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 180, height: 36 }} />
                </div>
                <span className="planning-fetch-loading__bar" style={{ width: 220, height: 36 }} />
                <span className="planning-fetch-loading__bar" style={{ width: '80%', height: 14 }} />
              </div>

              <div className="academic-preparation__toolbar planning-fetch-loading__toolbar-skeleton">
                <div className="academic-preparation__toolbar-row">
                  <div className="academic-preparation__search-field">
                    <span className="planning-fetch-loading__bar" style={{ width: 160, height: 14 }} />
                    <span className="planning-fetch-loading__bar" style={{ width: '100%', height: 36 }} />
                  </div>
                  <div className="academic-preparation__cycle-filter">
                    <span className="planning-fetch-loading__bar" style={{ width: 120, height: 14 }} />
                    <span className="planning-fetch-loading__bar" style={{ width: 160, height: 36 }} />
                  </div>
                </div>
                <div className="academic-preparation__counters">
                  <span className="planning-fetch-loading__bar" style={{ width: 90, height: 24 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 90, height: 24 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 90, height: 24 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 110, height: 16 }} />
                </div>
                <div className="academic-preparation__actions-row">
                  <span className="planning-fetch-loading__bar" style={{ width: 140, height: 36 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 150, height: 36 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 140, height: 36 }} />
                </div>
              </div>

              <div className="academic-preparation__workbench">
                <div className="academic-preparation__table-pane">
                  <div className="academic-preparation__table-wrapper planning-fetch-loading__table-scroll-container">
                    <Table stickyHeader containerClassName="academic-preparation__table-scroll" className="academic-preparation__table">
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col" className="academic-preparation__th-select">Selección</TableHead>
                          <TableHead scope="col">Ciclo</TableHead>
                          <TableHead scope="col">Asignatura</TableHead>
                          <TableHead scope="col">Demanda final</TableHead>
                          <TableHead scope="col">Demanda base</TableHead>
                          <TableHead scope="col">Sec. sugeridas</TableHead>
                          <TableHead scope="col">Capacidad obj.</TableHead>
                          <TableHead scope="col">Sec. prev.</TableHead>
                          <TableHead scope="col">Inspector</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="academic-preparation__group-row">
                          <TableHead colSpan={9} scope="colgroup">
                            <span className="planning-fetch-loading__bar" style={{ width: 180, height: 18 }} />
                          </TableHead>
                        </TableRow>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((row) => (
                          <TableRow key={row} className="academic-preparation__row">
                            <TableCell className="academic-preparation__td-select">
                              <span className="planning-fetch-loading__bar" style={{ width: 18, height: 18, borderRadius: 4 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 28, height: 16 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: '85%', height: 16, marginBottom: 4 }} />
                              <span className="planning-fetch-loading__bar" style={{ width: '45%', height: 12 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 48, height: 28 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 36, height: 16 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 36, height: 16 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 48, height: 28 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 36, height: 16 }} />
                            </TableCell>
                            <TableCell>
                              <span className="planning-fetch-loading__bar" style={{ width: 72, height: 28 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          ) : layout === 'publication-table' ? (
            <div className="academic-publication__table planning-fetch-loading__publication-table">
              <Table stickyHeader>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Docente</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Día</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Componentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                    <TableRow key={row}>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 56, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: '80%', height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 24, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 64, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 32, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 120, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 80, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 60, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 110, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 130, height: 16 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : layout === 'intention-table' ? (
            <div className="academic-intention-demand__table-wrap planning-fetch-loading__intention-table">
              <Table stickyHeader>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Potencial estimado E1</TableHead>
                    <TableHead>Intención registrada</TableHead>
                    <TableHead>Demanda final de planificación</TableHead>
                    <TableHead>Secciones · estudiantes/capacidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6].map((row) => (
                    <TableRow key={row}>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: '80%', height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 40, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 40, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 40, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: '90%', height: 16 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : layout === 'page' ? (
            <div className="planning-fetch-loading__page">
              <div className="planning-fetch-loading__page-header">
                <div>
                  <span className="planning-fetch-loading__bar" style={{ width: 280, height: 28, marginBottom: 8 }} />
                  <span className="planning-fetch-loading__bar" style={{ width: 180, height: 16 }} />
                </div>
                <span className="planning-fetch-loading__bar" style={{ width: 140, height: 36 }} />
              </div>
              <div className="planning-fetch-loading__page-nav">
                <span className="planning-fetch-loading__bar" style={{ width: 110, height: 36 }} />
                <span className="planning-fetch-loading__bar" style={{ width: 90, height: 36 }} />
                <span className="planning-fetch-loading__bar" style={{ width: 140, height: 36 }} />
                <span className="planning-fetch-loading__bar" style={{ width: 110, height: 36 }} />
              </div>
              <div className="planning-fetch-loading__table" style={{ minHeight: 'min(70dvh, 40rem)' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                      <TableRow key={row}>
                        <TableCell><span className="planning-fetch-loading__bar" style={{ width: 64, height: 16 }} /></TableCell>
                        <TableCell><span className="planning-fetch-loading__bar" style={{ width: '75%', height: 16 }} /></TableCell>
                        <TableCell><span className="planning-fetch-loading__bar" style={{ width: 80, height: 16 }} /></TableCell>
                        <TableCell><span className="planning-fetch-loading__bar" style={{ width: 100, height: 16 }} /></TableCell>
                        <TableCell><span className="planning-fetch-loading__bar" style={{ width: '60%', height: 16 }} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : layout === 'table' ? (
            <div className="planning-fetch-loading__table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ciclo / Turno</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Detalle disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                    <TableRow key={row}>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 64, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: '80%', height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 70, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 60, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: 40, height: 16 }} /></TableCell>
                      <TableCell><span className="planning-fetch-loading__bar" style={{ width: '60%', height: 16 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : layout === 'cards' ? (
            <div className="planning-fetch-loading__cards">
              {[0, 1, 2].map((item) => (
                <article key={item}>
                  <h4>Resumen del resultado</h4>
                  <p>Información de la consulta</p>
                  <p>Detalle del resultado esperado</p>
                </article>
              ))}
            </div>
          ) : (
            <article className="planning-fetch-loading__answer">
              <h4>Respuesta de la consulta</h4>
              <p>Información recuperada para responder la consulta.</p>
              <p>Detalle del análisis y condiciones aplicables.</p>
              <p>Fuentes y referencias del resultado.</p>
            </article>
          )}
        </Shimmer>
      </div>
    </div>
  )
}
