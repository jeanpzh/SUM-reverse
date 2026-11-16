// Independently constructed synthetic fixture; no exports, snapshots or real data.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PlanningWeekView } from './src/screens/PlanningWeekView'
import { PlanningInspector } from './src/screens/PlanningInspector'
import { PlanningPortalContext } from './src/components/ui/planningPortal'
import { aggregateAcademicBlocks } from './src/data/academicScheduling'
import './src/index.css'
import './src/styles/planning-v2.css'
const availability = [{day:1,startMinute:480,endMinute:1200},{day:2,startMinute:480,endMinute:1200},{day:3,startMinute:480,endMinute:1200},{day:4,startMinute:480,endMinute:1200},{day:5,startMinute:480,endMinute:1200},{day:6,startMinute:480,endMinute:780}]
const resources = {teachers:[{id:'T1',name:'Docente sintético',courseIds:['CS101'],maxWeeklyMinutes:1200,availability}],rooms:[{id:'R1',name:'Aula sintética',capacity:45,availability},{id:'R2',name:'Laboratorio sintético',capacity:45,availability}]}
const fixture = {proposalId:'proposal-synthetic',createdAt:'2026-11-16T12:00:00Z',expiresAt:'2026-11-16T13:00:00Z',status:'complete',sections:[{sectionId:'A',courseId:'CS101',courseName:'Curso sintético',capacity:20,deliveryMode:'continuous'}],assignments:[{sessionId:'CS101-L1',sectionId:'A',courseId:'CS101',courseName:'Curso sintético',teacherId:'T1',teacherName:'Docente sintético',roomId:'R1',roomName:'Aula sintética',day:2,startMinute:840,endMinute:960,sessionType:'Teoría'}],pending:[],diagnostics:[],coverageComplete:true,counts:{sections:1,requiredSessions:1,scheduledSessions:1},stats:{exploredCandidates:1,candidateVisits:1,backtracks:0,limitReason:null}}
function Harness(){
 const [wide,setWide]=useState(innerWidth>=1024)
 React.useEffect(()=>{const media=matchMedia('(min-width: 1024px)');const update=()=>setWide(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
 const [container,setContainer]=useState(null)
 const [proposal,setProposal]=useState(fixture)
 const [selected,setSelected]=useState(null)
 const [editing,setEditing]=useState(null)
 const [mode,setMode]=useState('tabla')
 const [error,setError]=useState(null)
 const [busy,setBusy]=useState(false)
 const [reject,setReject]=useState(true)
 const start=b=>{setSelected(b.sectionId);setError(null);setEditing({expectedVersion:0,sectionId:b.sectionId,sessionIds:b.sessionIds,teacherId:b.teacherId,day:b.day,startMinute:b.startMinute,roomIds:['R1']})}
 return <div className="planning-root" ref={setContainer} style={{minHeight:'100vh',background:'var(--plan-paper)',padding:16}}><PlanningPortalContext.Provider value={container}><header style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}><h1>Horario · datos sintéticos</h1><button onClick={()=>setMode('tabla')}>Tabla</button><button onClick={()=>setMode('semana')}>Semana</button><label><input type="checkbox" checked={reject} onChange={e=>setReject(e.target.checked)}/>Simular rechazo</label></header><div className="planning-view-pane" style={{display:mode==='tabla'?'block':'none'}}><button onClick={()=>setSelected('A')}>CS101 · Curso sintético · Seleccionar sección A</button></div><div className="planning-view-pane" style={{display:mode==='semana'?'block':'none'}}><PlanningWeekView proposal={proposal} catalog={{windows:availability,startStepMinutes:30}} proposalResources={resources} selectedSectionId={selected} editingBlock={editing} searchQuery="" onSelectSection={setSelected} onStartEditBlock={start}/></div>{selected && <PlanningInspector docked={wide} sectionId={selected} proposal={proposal} proposalResources={resources} catalog={{startStepMinutes:30}} editingBlock={editing} adjusting={busy} adjustmentError={error} onViewWeek={()=>setMode('semana')} onClose={()=>{setSelected(null);setEditing(null)}} onStartEdit={start} onCancelEdit={()=>{setEditing(null);setError(null)}} onChangeEditingBlock={setEditing} onSubmitEdit={async()=>{setBusy(true);await new Promise(r=>setTimeout(r,700));setBusy(false);if(reject){setError('Ambiente ocupado en la ubicación propuesta.')}else{setProposal({...proposal,assignments:proposal.assignments.map(a=>({...a,day:editing.day,startMinute:editing.startMinute,endMinute:editing.startMinute+120}))});setEditing(null)}}}/>}</PlanningPortalContext.Provider></div>
}
createRoot(document.getElementById('root')).render(<Harness/> )
