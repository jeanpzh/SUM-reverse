import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateE2Intention, validateE2IntentionContext, validateE2RegisterIntentionRequest, validateE2Demand, validateE2DemandRequest } from './prematricula-intention.mjs'

const draftId='00000000-0000-4000-8000-000000000001'
const pubId='00000000-0000-4000-8000-000000000002'
const revision='a'.repeat(64)
const selection=[{courseId:'20118091',sectionId:'original-section-1'}]
const record=(version=1)=>({version,draftVersion:version,publicationId:pubId,publicationVersion:2,academicRevision:revision,selection,registeredAt:'2026-11-04T12:00:00.000Z'})
const intention=()=>({revision:'E2-INTENT-1',draftId,actorId:'SYN-SIS-A',sourceId:'regular-SISTEMAS-v1',schoolId:'SISTEMAS',planId:'SYN-SIS-PLAN',academicPeriod:'2027-I',version:1,history:[record()]})
const validation=()=>({actorId:'SYN-SIS-A',publicationId:pubId,publicationVersion:2,academicRevision:revision,selection,credits:2,courseCount:1,status:'valid',issues:[]})
const context=()=>({revision:'E2-INTENT-1',actorId:'SYN-SIS-A',academicRevision:revision,draftId,draftVersion:1,intention:intention(),validation:validation()})
const demand=()=>({revision:'E2-DEMAND-1',schoolId:'SISTEMAS',academicPeriod:'2027-I',publicationId:pubId,publicationVersion:2,registeredStudents:2,countedStudents:2,excludedStudents:0,courses:[{courseId:'20118091',name:'Curso sintético',students:2,sections:[{sectionId:'original-section-1',capacity:45,students:1},{sectionId:'original-section-2',capacity:45,students:1}]}]})

test('intention command takes only stored-draft authority and exact CAS fields',()=>{
  const request={identity:{actorId:'SYN-SIS-A',runId:draftId,sessionId:pubId},draftId,expectedDraftVersion:1,expectedIntentionVersion:null,expectedAcademicRevision:revision}
  validateE2RegisterIntentionRequest(request)
  for(const extra of [{selection},{status:'valid'},{history:[]},{credits:2}]) assert.throws(()=>validateE2RegisterIntentionRequest({...request,...extra}))
  assert.throws(()=>validateE2RegisterIntentionRequest({...request,expectedIntentionVersion:0}))
})
test('intention history is bounded, complete, immutable-versioned and preserves original IDs',()=>{
  const value=intention(); validateE2Intention(value)
  value.version=2; value.history.push(record(2)); validateE2Intention(value)
  assert.equal(value.history[0].selection[0].sectionId,'original-section-1')
  for(const change of [v=>v.history.pop(),v=>v.history[1].draftVersion=1,v=>v.history[1].version=1,v=>v.history[1].selection=[],v=>v.version=101,v=>v.schoolId='OTRA']) {
    const invalid=structuredClone(value); change(invalid); assert.throws(()=>validateE2Intention(invalid))
  }
})
test('intention context cannot mix students, selections or silently confirm stale academic data',()=>{
  validateE2IntentionContext(context())
  const changed=context(); changed.academicRevision='b'.repeat(64); changed.validation.academicRevision=changed.academicRevision
  assert.throws(()=>validateE2IntentionContext(changed))
  changed.validation.status='insufficient'; changed.validation.issues=[{kind:'insufficient',code:'ACADEMIC_CONTEXT_CHANGED',message:'Revisar datos',courseIds:[],sectionIds:[]}]
  validateE2IntentionContext(changed)
  for(const change of [v=>v.intention.actorId='SYN-SIS-B',v=>v.validation.selection=[],v=>v.draftVersion=0]) {
    const invalid=context(); change(invalid); assert.throws(()=>validateE2IntentionContext(invalid))
  }
})
test('aggregate has only unique course/section counts and excludes identities and histories',()=>{
  const value=demand(); validateE2Demand(value); validateE2DemandRequest({publicationId:pubId,publicationVersion:2})
  for(const extra of [{actorIds:['SYN-SIS-A']},{names:['Alumno']},{history:[]}]) assert.throws(()=>validateE2Demand({...value,...extra}))
  for(const change of [v=>v.courses[0].sections[0].students=2,v=>v.courses.push(v.courses[0]),v=>v.courses[0].sections[1].sectionId='original-section-1',v=>v.registeredStudents=3]) {
    const invalid=structuredClone(value); change(invalid); assert.throws(()=>validateE2Demand(invalid))
  }
})
test('aggregate separates latest registered participants from counts needing revalidation',()=>{
  const value=demand(); value.excludedStudents=1; value.countedStudents=1; value.courses[0].students=1; value.courses[0].sections[1].students=0
  validateE2Demand(value)
  assert.throws(()=>validateE2Demand({...value,excludedStudents:0}))
})
