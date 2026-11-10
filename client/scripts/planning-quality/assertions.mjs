import assert from 'node:assert/strict'

// Documentary facts fixed from the reviewed corpus before the repair. These are
// regression checks for this sample, not an automatic general quality score.
const facts = {
  'tc-limit': /12|doce/i,
  'tc-paraphrase': /12|doce/i,
  'academic-hour': /45[\s\S]*50[\s\S]*60/,
  approval: /consejo de facultad/i,
  postgraduate: /10|diez/i,
  renacyt: /VRIP|vicerrectorado de investigaci[oó]n/i,
  'paid-postgraduate': /no se consideran|no.*carga|sin.*remuneraci[oó]n|adicional/i,
  contractor: /contratad/i,
  'out-of-scope': /no.*(contiene|dispone|evidencia|sueldo|salari)|fuera.*(alcance|corpus)/i,
  'unknown-regime': /r[eé]gimen/i,
  'follow-up-hour': /consejo de facultad/i,
  'follow-up': /solicitud|departamento|excepci[oó]n/i,
}

export function assertQualityObservation(item) {
  const { response, initialText } = item
  assert.equal(response.status, 'not-determined', `${item.id}: keep applicability abstention`)
  if (item.expectedIds.length) assert.ok(response.citations.some(c => item.expectedIds.includes(c.id)), `${item.id}: relevant source missing`)
  assert.match(initialText, facts[item.id], `${item.id}: specific fact must be visible without expanding details`)
  assert.ok(response.nextStep?.trim(), `${item.id}: query-specific next step required`)
  assert.doesNotMatch(response.nextStep, /^Revisa la vigencia y el alcance de las disposiciones para el periodo consultado\.$/)
  assert.ok(!('previousQuestion' in response.context), 'antecedent is not an applicability filter')
  if (item.id === 'out-of-scope') assert.deepEqual(response.citations, [], 'salary question must not show assignment sources')
  if (item.id === 'contractor' || item.id === 'unknown-regime') assert.ok(!response.citations.some(c => c.id === 'art-7'), 'do not transfer ordinary limits')
  if (item.follows) assert.ok(item.requestKeys.includes('previousQuestion'), `${item.id}: antecedent must cross HTTP boundary`)
}
