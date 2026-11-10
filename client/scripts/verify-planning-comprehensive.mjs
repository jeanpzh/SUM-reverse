// Additional real React -> NestJS -> Python scenarios. Fresh owned synthetic stack only.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {route} from './planning-audit/helpers.mjs'
import {lifecycleScenarios} from './planning-audit/lifecycle.mjs'
import {extraScenarios} from './planning-audit/extra-scenarios.mjs'
import {interactionScenarios} from './planning-audit/interactions.mjs'
if(process.env.SUM_REDESIGN_SYNTHETIC!=='1')throw new Error('Owned synthetic stack required')
const url=new URL(process.env.SUM_REDESIGN_BASE)
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Owned loopback origin required')
const evidence=resolve(process.env.SUM_REDESIGN_EVIDENCE)
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch()
const results=[]
try{
 const selected=process.env.SUM_ASSISTANT_CASES?.split(',').filter(Boolean)
 for(const [name,scenario] of [...interactionScenarios,...lifecycleScenarios,...extraScenarios]){
  if(selected?.length&&!selected.includes(name))continue
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(45000)
  const errors=[],external=[],details=[],http=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('request',r=>{if(!r.url().startsWith(`${url.origin}/`)&&!r.url().startsWith('data:'))external.push(new URL(r.url()).origin)})
  page.on('response',r=>{if(r.request().method()==='POST')http.push({path:new URL(r.url()).pathname,status:r.status()})})
  const started=Date.now()
  try{
   await page.goto(`${url.origin}${route}`,{waitUntil:'networkidle'})
   await page.locator('#planning-page-title').waitFor({timeout:45000})
   await page.getByRole('button',{name:/Seleccionar los .* cursos del catálogo/}).waitFor({timeout:45000})
   await scenario({page,base:url.origin,record:x=>details.push(x),capture:name=>page.screenshot({path:resolve(evidence,`${name}.png`)})})
   assert.deepEqual(errors,[]);assert.deepEqual(external,[])
   results.push({name,passed:true,durationMs:Date.now()-started,details,http})
   console.log(`PASS ${name}`)
  }catch(error){
   results.push({name,passed:false,durationMs:Date.now()-started,error:error.message,stack:error.stack,errors,external,details,http,url:page.url()})
   await page.screenshot({path:resolve(evidence,`${name}.png`)}).catch(()=>{})
   console.log(`FAIL ${name}: ${error.message.slice(0,450)}`)
  }finally{await context.close();await writeFile(resolve(evidence,'acceptance.json'),JSON.stringify({source:'Fresh owned isolated synthetic React/Nest/Python stack, no cloud calls; explicit network delay/failure injections only',results},null,2))}
 }
}finally{await browser.close()}
if(!results.length)throw new Error('No E2E scenarios selected')
console.log(`${results.filter(r=>r.passed).length}/${results.length} passed`)
if(results.some(r=>!r.passed))process.exitCode=1
