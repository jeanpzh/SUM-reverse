// Isolated synthetic test launcher. Does not load repository .env or private snapshots.
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir,homedir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const {liveEngineEnvironment}=await import(pathToFileURL(join(root,'scripts/start-planning-engine-live.mjs')))
for(const port of [3966,3967,5966])await new Promise((ok,no)=>{const server=createServer();server.once('error',no);server.listen(port,'127.0.0.1',()=>server.close(ok))})
const directory=await mkdtemp(join(tmpdir(),'sum-t3browser-synthetic-'))
const config=join(directory,'operator.env')
const keyFile=process.env.SUM_E2E_BEDROCK_KEY_FILE||join(homedir(),'.config/sum-planning/bedrock.key')
if(/[\r\n]/.test(keyFile))throw Error('Invalid key file path')
await writeFile(config,`AWS_REGION=us-east-2\nSUM_LLM_MODEL=us.amazon.nova-lite-v1:0\nAWS_BEARER_TOKEN_BEDROCK_FILE=${keyFile}\n`,{mode:0o600})
const engineEnv=await liveEngineEnvironment(config,{PATH:process.env.PATH,HOME:process.env.HOME,PORT:'3967'})
const children=[]
const minimal={PATH:process.env.PATH,LANG:'C.UTF-8'}
function start(cmd,args,folder,env){const child=spawn(cmd,args,{cwd:join(root,folder),env:{...minimal,...env},stdio:['ignore','pipe','pipe']});child.on('error',()=>{console.error('Synthetic process launch failed; details withheld');process.exitCode=1});child.stdout.resume();child.stderr.resume();children.push(child);return child}
async function ready(url,child){const end=Date.now()+45000;while(Date.now()<end){if(child.exitCode!==null)throw Error('Synthetic process exited; logs withheld');try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('Synthetic startup timeout')}
let stopping=false
async function stop(code=0){if(stopping)return;stopping=true;for(const c of children.reverse())if(c.exitCode===null)c.kill('SIGTERM');await Promise.all(children.filter(c=>c.exitCode===null&&c.signalCode===null).map(c=>new Promise(r=>c.once('exit',r))));console.log('Own synthetic T3 Browser stack stopped');process.exit(code)}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop())
try{
 const engine=start(join(root,'planning-engine/.venv/bin/python'),['main.py'],'planning-engine',engineEnv)
 await ready('http://127.0.0.1:3967/health',engine)
 const backend=start(process.execPath,['dist/main.js'],'backend',{PORT:'3966',SUM_ACADEMIC_SCHEDULING:'1',SIMULATOR_DEPLOYMENT:'local',SUM_LOCAL_SCENARIOS:'1',SUM_ACADEMIC_DRAFT_DIR:directory,SUM_PLANNING_ENGINE_URL:'http://127.0.0.1:3967'})
 await ready('http://127.0.0.1:3966/local/programacion-academica/v1/catalogo',backend)
 const frontend=start(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5966','--strictPort'],'client',{VITE_SUM_DATA_MODE:'local',VITE_SUM_API_BASE_URL:'/api',VITE_SUM_API_PROXY_TARGET:'http://127.0.0.1:3966',VITE_SUM_PLANNING_API_PROXY_TARGET:'http://127.0.0.1:3966',VITE_SUM_ACADEMIC_SCHEDULING:'1',VITE_SUM_SIMULATOR:'0',VITE_SUM_LOCAL_PROFILE:'synthetic-actors'})
 await ready('http://127.0.0.1:5966/local/programacion-academica',frontend)
 console.log(JSON.stringify({ready:true,launcherPid:process.pid,root,web:5966,api:3966,engine:3967,source:'createDemoCatalog explicitly synthetic',provider:'bedrock_converse',draftStore:directory}))
}catch{console.error('Synthetic stack startup failed (details withheld)');await stop(1)}
