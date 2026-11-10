"""Extractive, cited documentary explanation; never an applicability decision."""
import re
from normative_relevance import normalized


def _sentences(excerpt):
    # Strip only a leading document label; all explanatory words come from the
    # reviewed excerpt. Keep decimal section numbers and abbreviations intact.
    text = re.sub(r'^(?:Artículo\s+\d+|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)\.\s*', '', excerpt)
    return re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ])', text)


def documentary_answer(citations, primary_ids, facet, teacher_type, conflict=False):
    if facet == 'salary' and not citations:
        return ('No se encontró evidencia salarial en el corpus revisado. '
                'Los extractos sobre asignación de actividades no permiten calcular sueldos ni determinar fechas de pago.')
    if teacher_type == 'unknown':
        return ('Falta precisar el régimen docente para buscar disposiciones específicas que puedan corresponder a esta consulta. '
                'No se puede aplicar una regla de docentes ordinarios a todos los regímenes.')
    if not citations:
        if teacher_type == 'contratado':
            return ('No hay evidencia suficiente para determinar el límite del docente contratado. '
                    'No corresponde trasladar el máximo previsto para docentes ordinarios.')
        return 'No se encontró evidencia suficiente para responder esta pregunta con los filtros consultados.'
    primary = [c for c in citations if c.id in primary_ids] or citations[:1]
    sections = []
    for citation in primary[:2]:
        sentences = _sentences(citation.excerpt)
        if facet == 'hour':
            chosen = sentences[:2]
        elif facet == 'approval':
            chosen = [s for s in sentences if re.search(r'aprob|resoluci', normalized(s))][:2]
        elif facet == 'research':
            chosen = [s for s in sentences if re.search(r'renacyt|constancia|vrip', normalized(s))]
        elif facet == 'paid-teaching':
            chosen = [s for s in sentences if re.search(r'posgrado|retribucion', normalized(s))]
        elif facet == 'load':
            chosen = [s for s in sentences if re.search(r'maxim|solicitar|declaracion|voluntari', normalized(s))]
        else:
            chosen = sentences[:2]
        if not chosen:
            chosen = sentences[:2]
        # Preserve complete sentences and avoid detached conditions. A long
        # sentence remains available in canonical Sources instead of clipping it.
        body = ' '.join(chosen)
        if len(body) > 1450:
            body = ' '.join(chosen[:1])
        sections.append(f'{body} [{citation.id}]')
    if conflict:
        sections.insert(0, 'Las fuentes están en conflicto; estos extractos no determinan cuál prevalece.')
    sections.append('Respuesta extractiva del documento: no confirma vigencia ni concede autorización individual.')
    return '\n\n'.join(sections)


def query_next_step(facet, teacher_type, has_citations, conflict=False):
    if conflict:
        return 'Contrasta las disposiciones en conflicto, sus fechas y jerarquía con la autoridad correspondiente.'
    if facet == 'salary' and not has_citations:
        return 'Consulta la norma salarial y el calendario de pagos de Recursos Humanos; ese contenido no está en el corpus revisado.'
    if teacher_type == 'unknown':
        return 'Precisa el régimen docente (ordinario o contratado) y su dedicación; después verifica la norma específica del periodo.'
    if not has_citations:
        if teacher_type == 'contratado':
            return 'Revisa el contrato y las disposiciones específicas de docentes contratados para la facultad y el periodo.'
        return 'Precisa la pregunta o incorpora una fuente oficial revisada que trate ese tema y sea aplicable al periodo.'
    if facet == 'hour':
        return 'Falta el acuerdo del Consejo de Facultad de FISI que fija la duración; compruébalo antes de usar una equivalencia.'
    if facet == 'load':
        return 'Verifica la vigencia y la dedicación docente; para exceder el máximo, revisa la solicitud y autorización exigidas por las disposiciones citadas.'
    if facet == 'research':
        return 'Verifica el registro RENACYT y la constancia vigente del VRIP, los requerimientos lectivos y la vigencia de la disposición.'
    if facet == 'studies':
        return 'Comprueba los estudios y la situación de licencia del docente, y la vigencia de la disposición para el periodo.'
    if facet == 'approval':
        return 'Revisa la resolución de aprobación del Consejo de Facultad y su correspondencia con las actividades y el periodo consultados.'
    if facet == 'paid-teaching':
        return 'Verifica si existe retribución adicional y la vigencia de la disposición antes de computar esas horas.'
    return 'Comprueba la vigencia y el alcance de las fuentes para el régimen, la facultad y el periodo consultados.'
