"""Regression questions over reviewed public extracts; no provider or private data."""
import pytest
from pydantic import ValidationError
from normative import NormativeRequest, NormativeRetriever


def query(question, **changes):
    req = dict(question=question, facultyId='FISI', academicPeriod='2027-I', asOf='2026-11-10', teacherType='ordinario')
    req.update(changes)
    return NormativeRetriever(env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(NormativeRequest(**req))


def test_practical_paraphrase_retrieves_and_explains_load_limit():
    result = query('Quiero ponerle catorce horas semanales de clases a un profesor nombrado a tiempo completo. ¿Puedo hacerlo directamente?')
    assert result.citations[0].id == 'art-7'
    assert '12' in result.answer and '20' in result.answer
    assert 'declaración jurada' in result.answer
    assert result.status == 'not-determined'
    assert len(result.answer) < 2200


def test_hour_explains_options_and_missing_faculty_decision():
    result = query('¿Cuántos minutos dura la hora lectiva en FISI? ¿Puedo asumir que son 60?')
    assert result.citations[0].id == 'art-8'
    assert all(value in result.answer for value in ['45', '50', '60', 'Consejo de Facultad'])
    assert 'Falta' in result.nextStep and 'FISI' in result.nextStep
    assert result.status == 'not-determined'
    assert len(result.answer) < 1600


@pytest.mark.parametrize('question', [
    '¿Qué artículo establece cómo calcular mi aumento de sueldo y cuándo se pagará?',
    '¿Cuál es la escala salarial y la fecha de pago de un profesor?',
])
def test_salary_query_does_not_relabel_activity_rules_as_salary_evidence(question):
    result = query(question)
    assert result.citations == []
    assert 'salarial' in result.answer.lower()
    assert result.status == 'not-determined'


def test_out_of_scope_stays_empty_even_with_semantic_similarity():
    from rag_sources import load_corpus
    chunks = load_corpus({'SUM_RAG_SOURCE': 'local'})['chunks']
    req = NormativeRequest(question='¿Cómo se calcula mi aumento de sueldo?', facultyId='FISI', academicPeriod='2027-I', asOf='2026-11-10', teacherType='ordinario')
    result = NormativeRetriever(chunks, lambda texts: [[1., 0.] for _ in texts], env={}).query(req)
    assert result.citations == []


@pytest.mark.parametrize(('previous', 'expected', 'unexpected'), [
    ('¿Cuántos minutos dura la hora lectiva en FISI?', 'art-8', 'art-7'),
    ('¿Cuál es el máximo de horas lectivas de un docente a tiempo completo?', 'art-7', 'art-8'),
])
def test_followup_uses_bounded_question_context(previous, expected, unexpected):
    result = query('¿Y quién autoriza eso en ese caso?', previousQuestion=previous)
    ids = [c.id for c in result.citations]
    assert expected in ids
    assert ids[0] == expected
    assert unexpected not in ids
    assert 'previousQuestion' not in result.context.model_dump()
    assert result.question == '¿Y quién autoriza eso en ese caso?'


def test_new_explicit_topic_ignores_previous_question():
    result = query('¿Cuántos minutos dura la hora lectiva?', previousQuestion='¿Cuál es el máximo de horas lectivas?')
    assert result.citations[0].id == 'art-8'


@pytest.mark.parametrize('regime', ['contratado', 'unknown'])
def test_regime_uncertainty_is_specific(regime):
    result = query('¿Cuál es la carga lectiva máxima que puedo asignar a un profesor?', teacherType=regime)
    assert all(c.id != 'art-7' for c in result.citations)
    assert ('contratado' in result.answer) if regime == 'contratado' else ('régimen' in result.answer)
    assert result.status == 'not-determined'


@pytest.mark.parametrize('previous', ['', ' ', 'x' * 1001, 2, None])
def test_previous_question_validation(previous):
    with pytest.raises(ValidationError):
        query('¿Y quién lo autoriza?', previousQuestion=previous)


@pytest.mark.parametrize('question', [
    '¿Le puedo dar dieciséis horas de clases a una profesora nombrada a tiempo completo?',
    'Necesito asignar 15 horas semanales a un docente TC. ¿Qué trámite exige?',
])
def test_workload_paraphrase_neighbours(question):
    result = query(question)
    assert result.citations[0].id == 'art-7'
    assert 'declaración jurada' in result.answer


def test_supplementary_requirement_is_explained_not_just_listed():
    result = query('¿Basta RENACYT o necesito una constancia adicional para reducir carga?')
    assert 'constancia vigente' in result.answer and 'VRIP' in result.answer
    assert 'requerimientos' in result.answer
    assert '[comp-primera]' in result.answer


def test_approval_distinguishes_presentation_from_approval():
    result = query('¿Quién aprueba las actividades lectivas y cómo se formalizan?')
    assert 'Consejo de Facultad' in result.answer and 'resolución' in result.answer
    assert '[art-6]' in result.answer or '[art-26]' in result.answer


def test_paid_postgraduate_teaching_keeps_the_no_additional_pay_condition():
    result = query('¿Las clases de posgrado por las que recibo un pago adicional cuentan en mi carga lectiva ordinaria?')
    assert 'no se considerarán' in result.answer
    assert 'cuando no se reciba monto adicional' in result.answer
    assert '50%' in result.answer


def test_followup_without_antecedent_does_not_invent_one():
    result = query('¿Y quién autoriza eso en ese caso?')
    assert result.status == 'not-determined'
    assert result.citations == []
    assert 'antecedente' in result.answer


def test_unknown_prior_is_not_silently_used_for_new_salary_topic():
    result = query('¿Cómo se calcula mi sueldo?', previousQuestion='¿Cuántos minutos dura la hora lectiva?')
    assert result.citations == []
    assert 'salarial' in result.answer


def test_salary_word_does_not_hide_an_explicit_paid_teaching_question():
    result = query('¿Las clases de posgrado con pago adicional cuentan en mi carga lectiva aunque ya reciba sueldo?')
    assert result.citations[0].id == 'art-6'
    assert 'no se considerarán' in result.answer


def test_salary_computation_is_still_unsupported_with_incidental_workload():
    result = query('Tengo carga lectiva completa. ¿Cómo calculo mi aumento de sueldo?')
    assert result.citations == []
    assert 'salarial' in result.answer


def test_unknown_regime_salary_still_reports_missing_topic():
    result = query('¿Cómo se calcula mi aumento de sueldo?', teacherType='unknown')
    assert result.citations == []
    assert 'salarial' in result.answer
    assert 'Recursos Humanos' in result.nextStep


def test_unknown_regime_approval_does_not_mislabel_question_as_workload_limit():
    result = query('¿Quién aprueba las actividades lectivas?', teacherType='unknown')
    assert 'régimen' in result.answer
    assert 'límites' not in result.answer
    assert 'régimen' in result.nextStep


def test_new_approval_subject_with_demonstrative_does_not_inherit_hour_topic():
    result = query('¿Quién aprueba esa programación académica?', previousQuestion='¿Cuántos minutos dura la hora lectiva?')
    assert result.citations[0].id in {'art-6', 'art-26'}
    assert 'Consejo de Facultad' in result.answer
    assert 'art-8' not in {c.id for c in result.citations}


@pytest.mark.parametrize('semantic', [False, True])
def test_remuneration_payroll_paraphrase_has_no_activity_citations(semantic):
    from rag_sources import load_corpus
    chunks = load_corpus({'SUM_RAG_SOURCE': 'local'})['chunks']
    req = NormativeRequest(question='¿Cuánto es mi remuneración y cuándo la pagan?', facultyId='FISI', academicPeriod='2027-I', asOf='2026-11-10', teacherType='ordinario')
    result = NormativeRetriever(chunks, (lambda texts: [[1., 0.] for _ in texts]) if semantic else None, env={}).query(req)
    assert result.citations == []
    assert 'salarial' in result.answer


def test_general_weekly_load_answer_does_not_add_unasked_postgraduate_exception():
    result = query('Quiero ponerle catorce horas semanales de clases a un profesor nombrado a tiempo completo. ¿Puedo hacerlo directamente?')
    assert '[art-7]' in result.answer
    assert 'posgrado' not in result.answer
