"""Bounded query normalization and evidence facets, independent of article IDs.

These aliases help retrieval; they never establish applicability or supply facts.
"""
import re
import unicodedata


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if not unicodedata.combining(c))


def ambiguous_followup(question):
    text = normalized(question)
    followup = re.search(r'\b(eso|esa|ese|lo anterior|en ese caso|en tal caso)\b', text)
    explicit_subject = re.search(r'\b(minutos?|duracion|renacyt|maestria|doctorado|sueldo|salario|remuneracion|posgrado|carga|horas?|programacion|horario|asignacion|planificacion)\b', text)
    return bool(followup and not explicit_subject)


def contextual_question(question, previous=None):
    """Resolve only explicit anaphora, leaving new subjects independent."""
    if previous and ambiguous_followup(question):
        return previous, True
    return question, False


def retrieval_question(question):
    text = normalized(question)
    additions = []
    if re.search(r'\bprofesor(?:a|es|as)?\b', text):
        additions.append('docente')
    if re.search(r'\bnombrad[oa]s?\b', text):
        additions.append('ordinario')
    if re.search(r'\bclases?\b', text):
        additions.append('actividad lectiva')
    if re.search(r'\btiempo completo\b', text):
        additions.append('TC')
    # A practical assignment question is about the permitted workload, rather
    # than dedication minima. This is not a decision that the number is allowed.
    if re.search(r'\b(horas?|clases?)\b', text) and re.search(r'\b(ponerle|asignar|darle|asumir|permitid|puedo|maxim|limite)', text):
        additions.append('máximo carga lectiva horas semanales')
    return ' '.join([question, *additions])


def facets(question):
    text = normalized(question)
    salary = re.search(r'\b(sueldo|salario|salarial|salariales|haberes|remuneracion|remuneraciones)\b', text)
    academic = re.search(r'\b(carga|lectiva|clases|posgrado|postgrado)\b', text)
    payroll = re.search(r'\b(calcul\w*|aumento|escala|fecha|pagara|cuando)\b', text)
    if salary and (payroll or not academic):
        return 'salary'
    if re.search(r'\b(minutos?|duracion|dura)\b', text) and re.search(r'\b(hora|lectiva|academica)\b', text):
        return 'hour'
    if re.search(r'\b(renacyt|investigador|vrip)\b', text):
        return 'research'
    if re.search(r'\b(maestria|doctorado)\b', text):
        return 'studies'
    if re.search(r'\b(posgrado|postgrado)\b', text) and re.search(r'\b(pago|pagan|recibo|remuneracion|adicional|cuentan)\b', text):
        return 'paid-teaching'
    if re.search(r'\b(aprueba|aprueban|aprobacion|formaliza|formalizan)\b', text):
        return 'approval'
    if re.search(r'\b(maxim|limite|ponerle|darle|dar|puedo|asignar|superar|exceder)', text) and re.search(r'\b(horas?|carga|clases?)\b', text):
        return 'load'
    return None


def evidence_matches(facet, excerpt):
    text = normalized(excerpt)
    patterns = {
        'salary': r'\b(sueldo|salario|salarial|salariales|escala remunerativa)\b',
        'hour': r'\bminutos\b.*\b(hora|lectiva|academica)\b|\b(hora|lectiva|academica)\b.*\bminutos\b',
        'research': r'\brenacyt\b',
        'studies': r'\b(maestria|doctorado)\b',
        'paid-teaching': r'\bposgrado\b.*\b(pago|retribucion|remuneracion)\b',
        'approval': r'\b(aprobacion|aprobadas|aprobar)\b.*\b(resolucion|consejo)\b|\bconsejo\b.*\b(aprobacion|aprobadas|aprobar)\b',
        'load': r'\bmaxim[oa]\b.*\b(horas|carga|lectiva)\b|\b(horas|carga|lectiva)\b.*\bmaxim[oa]\b',
    }
    return bool(facet and re.search(patterns[facet], text))


def focus_documents(documents, facet, question=''):
    """Require a requested subject when it has an explicit corpus vocabulary.

    A nearest vector is not sufficient evidence for a known, absent subject.
    Unknown subjects keep the existing semantic path rather than an allowlist.
    """
    if facet is None:
        return documents[:4]
    focused = [d for d in documents if evidence_matches(facet, d.page_content)]
    if facet == 'load':
        # Prefer general workload bounds over special roles/studies without
        # pretending those special conditions apply to the person asking.
        special = r'\b(maestria|doctorado|decanos)\b'
        if not re.search(r'\b(posgrado|postgrado)\b', normalized(question)):
            special = r'\b(maestria|doctorado|decanos|posgrado|postgrado)\b'
        general = [d for d in focused if not re.search(special, normalized(d.page_content))]
        if general:
            focused = general
    return focused[:2]
