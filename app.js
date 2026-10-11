import { createAtlas } from './map.js?v=71aa1def64d6';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words = value => String(value).replaceAll('_',' ').replaceAll('-',' ');
let data, atlas, layer='architecture', selected=null, filter='', detailGraph=null, playTimer=null, tourTimer=null;
let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const subsystemSpecs=[
  ['engine','HyperCore','Exchange state machine','execution','Core',0.5,3],
  ['consensus','HyperBFT','Certificates, committed ancestry, historical stake','consensus','Trust',1.4,1.5],
  ['network','Native transport','Observer sessions, state transfer and concise frames','architecture','Transport',.6,1.2],
  ['evm','HyperEVM','revm execution, database diffs and lane sealing','evm','Execution',1.3,1.9],
  ['books','Order books','Price-time traversal, fills and order chronology','matching','Trading',.4,1.4],
  ['state','Commitments','Response output, W2, EVM accumulators and ABCI tree','state','State',1,1.4],
  ['risk','Margin & risk','Account classes, portfolio valuation and liquidation','margin','Finance',.3,1.3],
  ['oracle','Oracle','Reports, admission, mark clamps and unsigned prices','oracle','Finance',.7,1.2],
  ['funding','Funding','Premium samples, native caps and cash settlement','funding','Finance',.3,.9],
  ['clearing','Clearinghouse','Positions, class cash and one writer per fact','margin','Finance',.7,1.1],
  ['accounts','Account state','Abstraction, balances, agents and subaccounts','architecture','State',.4,1],
  ['lending','BOLE','Canonical lending qualification and explicit frontiers','lending','Finance',.8,1.2],
  ['outcomes','Outcomes','Complementary books, complete sets and settlement','outcomes','Products',.5,1.2],
  ['staking','Staking','Delegation, epoch snapshots and validator control','staking','Trust',.2,1.1],
  ['governance','Governance','Voted controls and immutable startup rules','governance','Control',.4,.9],
  ['corewriter','CoreWriter','Typed EVM intents and matured delayed execution','evm','Execution',.5,1],
  ['bridge','External bridge','Withdrawal signatures and finalized votes','bridge','Transport',.1,1],
  ['storage','Storage','Replica ingest, paired state and durability boundaries','development','Infrastructure',.4,1],
  ['replay','Replay lab','Frozen candidates, full EVM and evolved checkpoints','replay','Research',1.2,1.2],
  ['evidence','Native evidence','Bounded instructions, source and scoped acceptance','methodology','Research',.6,1.2],
  ['exex','ExEx','HLX-specific extensions; independent delivery contract','development','HLX tooling',.3,.9],
  ['devnet','Devnet','Local integration, mock services and controlled inputs','development','HLX tooling',.2,1],
];
const architectureEdges=[['network','consensus'],['consensus','engine'],['engine','books'],['books','clearing'],['clearing','accounts'],['risk','clearing'],['oracle','risk'],['oracle','funding'],['funding','clearing'],['engine','evm'],['evm','corewriter'],['corewriter','engine'],['engine','state'],['evm','state'],['state','consensus'],['staking','consensus'],['governance','engine'],['bridge','accounts'],['network','storage'],['storage','replay'],['engine','replay'],['replay','evidence'],['outcomes','books'],['lending','risk'],['engine','exex'],['devnet','engine']];
const flow=[
  ['Receive','Original inputs arrive with ClientBlocks over the admitted observer transport.','architecture'],
  ['Authenticate','Check signed ancestry and complete commit proof before engine mutation.','consensus'],
  ['Prepare','Decode all outer and nested action grammar before begin-block or nonce mutation.','execution'],
  ['Begin block','Run recovered maintenance owners with their caller-specific guards and chronology.','execution'],
  ['Delayed effects','Matured CoreWriter and queued actions run before incoming batches.','bridge'],
  ['Actions & fills','Resolve admission, dispatch actions and publish matching and finance effects.','matching'],
  ['HyperEVM','Execute EVM lanes, carry state diffs and complete cleanup.','evm'],
  ['Commit & compare','Compare response output and evolved state through independent commitments.','replay'],
];
const layerDescriptions={
  architecture:['THE WHOLE MACHINE','HyperCore <i>×</i> HyperEVM','Spatial relationships across execution, finance, trust and research.'],
  flow:['FOLLOW AN INPUT','Execution, <i>in motion.</i>','A conceptual path across authenticated execution owners.'],
  state:['THE STATE LANDSCAPE','Every byte <i>has a place.</i>','42 L1 slots. Three EVM accumulators. Independent checkpoint truth.'],
  crates:['THE RUST WORKSPACE','Seventeen crates.<i> One machine.</i>','Declared dependencies, real module boundaries and source identity.'],
  actions:['THE DISPATCH SURFACE','Ninety-two <i>entry points.</i>','Exact native outer names. Separate evidence for every behavior.'],
};

function baseGraph(which){
  if(which==='architecture'){
    const nodes=subsystemSpecs.map(([id,label,subtitle,chapter,group,y,size],i)=>{const inner=i>0&&i<=7;const j=inner?i-1:i-8;const angle=j/(inner?7:14)*Math.PI*2-.6;const radius=i===0?0:inner?6:11;return {id,label,subtitle,chapter,group,size,position:[Math.cos(angle)*radius,y,Math.sin(angle)*radius]};});
    return {nodes,edges:architectureEdges.map(([from,to])=>({from,to}))};
  }
  if(which==='flow')return {nodes:flow.map(([label,subtitle,chapter],i)=>({id:'flow-'+i,label,subtitle,chapter,group:'Execution',size:i===0||i===7?1.5:1.1,position:[(i%4-1.5)*5,Math.sin(i*.8)*.5,i<4?-4:4]})),edges:flow.slice(1).map((_,i)=>({from:'flow-'+i,to:'flow-'+(i+1)}))};
  if(which==='crates'){
    const groups=[...new Set(data.crates.map(c=>c.group))];
    const nodes=data.crates.map((c,i)=>{const angle=i/data.crates.length*Math.PI*2;return {id:c.id,label:c.name,subtitle:c.role,chapter:'architecture',group:c.group,size:c.id==='hl-engine'?2:c.id==='hl-node'?1.6:1,position:[Math.cos(angle)*10,groups.indexOf(c.group)*.45,Math.sin(angle)*8]};});
    return {nodes,edges:data.crates.flatMap(c=>c.dependencies.map(d=>({from:c.id,to:d})))};
  }
  if(which==='state'){
    const nodes=data.slots.map(s=>({id:s.id,label:String(s.index).padStart(2,'0')+' · '+s.name,shortLabel:'W2 · '+String(s.index).padStart(2,'0'),subtitle:s.name,chapter:'state',group:'L1 W2',shape:'tile',size:.65,position:[(s.index%7-3)*2.1,0,(Math.floor(s.index/7)-2.5)*1.65]}));
    nodes.push({id:'l1-root',label:'L1 · W2',subtitle:'Keccak over ordered hex digests from 42 exact slot byte producers',chapter:'state',group:'State',size:1.8,position:[0,2.5,-9]},{id:'evm-root',label:'EVM · W1',subtitle:'Accounts, contracts and storage: full LtHash records and their counts',chapter:'state',group:'EVM',size:1.7,position:[10,2,0]},{id:'app-hash',label:'app_hash',subtitle:'First 16 bytes of the L1 wrapper + first 16 bytes of the EVM wrapper',chapter:'state',group:'Trust',size:2,position:[6,4,-10]},{id:'abci-tree',label:'ABCI · 60 fields',subtitle:'Independent BLAKE3 checkpoint tree; separate from W2 serialization',chapter:'state',group:'Checkpoint',size:1.5,position:[-11,1,0]},{id:'resp-hash',label:'resps.Hash',subtitle:'Keccak of the exact encoded response window; separate from evolved state',chapter:'state',group:'Response',size:1.5,position:[0,2,10]});
    return {nodes,edges:[...data.slots.map(s=>({from:s.id,to:'l1-root'})),{from:'l1-root',to:'app-hash'},{from:'evm-root',to:'app-hash'}]};
  }
  let actions=data.actions.filter(a=>!filter||a.family===filter);
  return {nodes:actions.map((a,i)=>({id:a.id,label:a.name,shortLabel:String(a.index).padStart(2,'0'),subtitle:a.family+' · '+a.variant+' · runtime unreviewed',chapter:'actions',group:a.family,shape:'tile',size:.6,position:[(i%12-5.5)*1.9,Math.floor(i/12)%2*.35,(Math.floor(i/12)-3.5)*1.8]})),edges:[]};
}
function graphFor(which){return which===layer&&detailGraph?detailGraph:baseGraph(which);}
const ownerByNode={engine:'hl-engine',consensus:'hl-consensus',network:'hl-network',evm:'hl-evm',books:'hl-engine',state:'hl-engine',risk:'hl-engine',oracle:'hl-engine',funding:'hl-engine',clearing:'hl-engine',accounts:'hl-engine',lending:'hl-engine',outcomes:'hl-engine',staking:'hl-engine',governance:'hl-engine',corewriter:'hl-evm',bridge:'hl-engine',storage:'hl-storage',replay:'hl-node',evidence:'hl-re',exex:'hl-exex',devnet:'hl-devnet'};
const subsystemModules={
  engine:['exchange','committed_block','actions','action_apply','matching','book','clearinghouse','margin','oracle','funding','state_hash','l1_slots','abci_tree','evm_bridge','evm_to_l1','evm_seal','bootstrap_fast','validator_vote_action','unified_liquidation','outcome_action','bole_action','core_writer'],
  books:['book','matching','book_priority','order_status','book_orders_native','book_pub_wire','order_class_prepass','oid_arity','priority_order'],
  state:['state_hash','l1_slots','abci_tree','lthash','checkpoint','app_hash_guard','validator_vote_tracker'],
  risk:['margin','collateral','clearinghouse','unified_liquidation','liquidation','portfolio_spot_route','bole_valuation','liquidations'],
  evm:['executor','precompiles','core_writer','state','db','rpc','native_db','official_checkpoint'],
  network:['observer_session','abci_block_stream','state_stream','wire','concise','gossip_rpc','abci_bootstrap','consensus_rpc','discovery','abci_wire','connection'],
  consensus:['bft','validation','block_applier','block_codec','native_leader','leader_state','round_driver','runtime','proposer','wal','staking_inputs','signer'],
  funding:['funding','funding_distribution','oracle','account_volume','native_kernels'],
  oracle:['oracle','oracle_distance','mark_price','hip3_set_oracle','hip3_star_oracle','main_perp_pxs2'],
  lending:['bole_action','bole_amount','bole_admission','bole_candidate','bole_valuation','bole_shares','bole_withdrawal','unified_liquidation','bole_reserve_oracle'],
  outcomes:['outcome_action','outcome_conversion','outcome_cross','outcome_deploy','outcome_deployer_activation','outcomes','spot_fills'],
  corewriter:['core_writer','precompiles','executor'],
  replay:['replay','committed_applier','client_block_auth','evm_checkpoint','gap_census','disk_catchup','per_block_isolation','block_log','local_abci_state'],
};
function dive(node){
  const crate=data.crates.find(c=>c.id===(ownerByNode[node.id]||node.id));if(!crate)return;
  stopTour();stopPlay();const preferred=subsystemModules[node.id];const modules=(preferred?preferred.filter(m=>crate.modules.includes(m)):crate.modules.slice(0,28));
  if(!modules.length)return;
  const center={id:crate.id,label:node.label,subtitle:crate.role,chapter:node.chapter,group:crate.group,size:2.5,position:[0,.8,0]};
  const nodes=modules.map((module,i)=>{const inner=i<14;const ringCount=inner?Math.min(14,modules.length):modules.length-14;const angle=(inner?i:i-14)/ringCount*Math.PI*2;const radius=inner?6.7:10;return {id:`module:${crate.id}:${module}`,label:module,subtitle:`Declared source module in ${crate.id}`,chapter:node.chapter,group:'Source module',size:.85,shape:'tile',sourcePath:crate.moduleSources?.[module],position:[Math.cos(angle)*radius,(i%3)*.4,Math.sin(angle)*radius]};});
  detailGraph={nodes:[center,...nodes],edges:nodes.map(n=>({from:center.id,to:n.id,label:'declares'}))};
  atlas.setGraph(detailGraph);atlas.reset();$('#inspector').hidden=true;selected=null;$('#back-map').hidden=false;$('#journey').hidden=true;$('#scope-filters').hidden=true;
  $('#scene-kicker').textContent='INSIDE THE SUBSYSTEM';$('#scene-title').innerHTML=escape(node.label)+' <i>/</i> internals';$('#scene-description').textContent='Actual source modules. Spokes show ownership, not recovered runtime calls.';$('#map-count').textContent=`${modules.length} MODULES IN THIS VIEW · ${crate.name.toUpperCase()} · SOURCE ${data.sourceBinding.head.slice(0,8)}`;
}
function chapterFor(node){return data.chapters.find(c=>c.id===node.chapter);}
function connections(id){const graph=graphFor(layer);const ids=new Set(graph.edges.filter(e=>e.from===id||e.to===id).flatMap(e=>[e.from,e.to]));ids.delete(id);return graph.nodes.filter(n=>ids.has(n.id));}
function fact(label,value){return `<div class="fact"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;}
function badge(text,amber=false){return `<span class="badge ${amber?'amber':''}">${escape(text)}</span>`;}
function inspect(id,{focus=true}={}){
  const node=graphFor(layer).nodes.find(n=>n.id===id);if(!node)return;
  selected=id;atlas.setSelection(id);if(focus)atlas.focus?.(id);
  const crate=data.crates.find(c=>c.id===id),action=data.actions.find(a=>a.id===id),slot=data.slots.find(s=>s.id===id),chapter=chapterFor(node);
  let facts='',paragraph=node.subtitle,badges=badge('Source-backed'),expanded='';
  if(crate){facts=fact('Rust files',crate.rustFiles)+fact('Root modules',crate.modules.length)+fact('Internal dependencies',crate.dependencies.length);paragraph=crate.role;expanded=`<details><summary>Module surface · ${crate.modules.length}</summary><p class="source">${crate.modules.map(escape).join(' · ')}</p></details>`;}
  else if(action){facts=fact('Physical table index',action.index)+fact('Source variant',action.variant)+fact('Native dispatcher',action.dispatcher)+fact('Native serializer',action.serializer)+fact('Visible guard candidates',action.guardCount)+fact('Test / runtime review',action.tests+' / '+action.runtime);paragraph='This exact outer name has a Rust serde binding. Its table entry and source presence are independent of complete handler semantics or native replay acceptance.';badges=badge(action.nativeStatus==='current_packet_address_reference'?'Packet address reference':'Native name binding')+badge('Runtime unreviewed',true);}
  else if(slot){facts=fact('Ordered W2 position',slot.index)+fact('Source producer',slot.sourceName)+fact('Verification scope','Registry binding');paragraph='This producer contributes an exact MessagePack byte stream and its Keccak digest. Its live typed/raw production path depends on the exchange state. Bootstrap identity does not certify forward mutation.';badges=badge('L1 registry')+badge('State-dependent producer',true);}
  else if(node.sourcePath){paragraph='An actual declared module in the reviewed source tree. This map shows source ownership; it does not infer that every function is integrated, native-recovered or replay-verified.';facts=fact('Module owner',id.split(':')[1])+fact('Source module',id.split(':')[2]);badges=badge('Source inventory')+badge('Semantics independently scoped',true);}
  else if(id==='exex'){paragraph='Your HLX extension feature: runtime observers for logs, research and indexing. This layer is outside the recovered native protocol and has its own event-delivery contract.';facts=fact('Native protocol feature','No — HLX-specific')+fact('Reviewed baseline','Best-effort broadcast')+fact('Selectable delivery work','Separate, unverified candidate');badges=badge('HLX tooling');}
  else if(layer==='flow'){facts=fact('Conceptual stage',Number(id.split('-')[1])+1+' / 8')+fact('Native phase ledger',data.counts.blockPhases+' bounded records');}
  else if(chapter){const section=chapter.sections[0];expanded=`<details><summary>Inspect the mechanism</summary><p>${escape(section.paragraphs[0])}</p></details>`;}
  const related=connections(id);
  const source=node.sourcePath|| (crate?crate.root:action?action.declaration.path+':'+action.declaration.line:slot?slot.source:chapter?.sources?.[0]?.path||'Mainnet 113 bounded evidence');
  const canDive=!detailGraph&&Boolean(data.crates.find(c=>c.id===(ownerByNode[id]||id))?.modules.length);
  $('#inspector').innerHTML=`<button class="inspector-close" aria-label="Close component details">×</button><div class="kicker">${escape(node.group)} / ${layer.toUpperCase()}</div><h2>${escape(crate?crate.name:node.label)}</h2>${badges}<p class="line">${escape(paragraph)}</p>${facts}${canDive?'<button class="dive-button">Dive into the subsystem ↗</button>':''}${expanded}${related.length?`<h3>CONNECTED COMPONENTS</h3>${related.slice(0,12).map(n=>`<button class="connection" data-connected="${n.id}">${escape(n.label)}<span>↗</span></button>`).join('')}`:''}<h3>SOURCE BINDING</h3><div class="source">${escape(source)}<br>Reviewed HEAD ${data.sourceBinding.head.slice(0,8)} · ${data.asOf}</div><button class="proof-button">Inspect evidence & limits ↗</button>`;
  $('#inspector').hidden=false;$('.inspector-close').onclick=()=>{$('#inspector').hidden=true;selected=null;atlas.setSelection(null);};
  document.querySelectorAll('[data-connected]').forEach(b=>b.onclick=()=>inspect(b.dataset.connected));$('.proof-button').onclick=()=>showProof(node);if(canDive)$('.dive-button').onclick=()=>dive(node);
  if(layer==='flow'){const i=Number(id.split('-')[1]);$('#flow-step').value=i;$('#flow-output').value=String(i+1).padStart(2,'0')+' / 08';atlas.setStep(Math.min(i,6));}
}
function setLayer(next){
  stopTour();stopPlay();layer=next;selected=null;filter='';detailGraph=null;$('#back-map').hidden=true;$('#inspector').hidden=true;$('#hover-label').hidden=true;
  document.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===next));
  const [kicker,title,description]=layerDescriptions[next];$('#scene-kicker').textContent=kicker;$('#scene-title').innerHTML=title;$('#scene-description').textContent=description;
  $('#journey').hidden=next!=='flow';$('#scope-filters').hidden=next!=='actions';
  if(next==='actions'){$('#scope-filters').innerHTML='<span>ACTION GROUPS · NOT WIRE TAGS</span>'+['',...new Set(data.actions.map(a=>a.family))].map(f=>`<button data-family="${escape(f)}" class="${!f?'active':''}">${escape(f||'All 92 actions')}</button>`).join('');document.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{filter=b.dataset.family;document.querySelectorAll('[data-family]').forEach(v=>v.classList.toggle('active',v===b));$('#inspector').hidden=true;atlas.setGraph(graphFor(layer));updateCount();});}
  atlas.setGraph(graphFor(next));atlas.setMotion(motion);atlas.reset();updateCount();
  if(next==='flow'){atlas.setStep(0);$('#flow-step').value=0;$('#flow-output').value='01 / 08';}
}
function updateCount(){const graph=graphFor(layer);$('#map-count').textContent=layer==='architecture'?'22 SUBSYSTEMS · NATIVE PROTOCOL + HLX TOOLING':layer==='crates'?`17 CRATES · ${data.sourceBinding.trackedRustFiles} TRACKED RUST FILES`:layer==='state'?'42 W2 SLOTS · 3 EVM ACCUMULATORS · 60 ABCI FIELDS':layer==='actions'?`${graph.nodes.length} OF 92 PHYSICAL OUTER ENTRIES · SEMANTICS SCOPED`:'8 CONCEPTUAL STAGES · 18 BOUNDED NATIVE PHASE RECORDS';}
function stopPlay(){if(playTimer)clearInterval(playTimer);playTimer=null;$('#flow-play').textContent='▶';}
function stopTour(){if(tourTimer)clearInterval(tourTimer);tourTimer=null;$('#tour-toggle').classList.remove('active');}
function showProof(node=null){
  const chapter=node?chapterFor(node):null;const sources=chapter?.sources||[{path:'docs/re/native_coverage/README.md'},{path:'evidence/latest_mainnet_integration/README.md'},{path:'docs/re/system_audit/README.md'}];
  const evidence=sources.map(s=>data.evidence.find(e=>e.path===s.path)).filter(Boolean);
  $('#evidence-content').innerHTML=`<div class="kicker">EVIDENCE / ${node?escape(node.label):'THIS MAP'}</div><h2>${node?'What this node can prove.':'A map of the model, not a completion claim.'}</h2><p>This is a spatial explanation of the HLX repository, bound to the reviewed source snapshot ${data.sourceBinding.head.slice(0,8)} and native Mainnet 113 evidence dated ${data.asOf}. Relationships are source/architecture groupings; animated packets are illustrative, not live telemetry.</p><p>Native instruction recovery, source presence, tests and forward native replay prove different things. A recorded 10,000-block integration matched 909/909 supplied response hashes, all ten 60-field checkpoints and all three full EVM accumulators. The continuous 500,000-block run stopped after persistent divergence and remains uncertified. Live synchronization and full typed migration also remain incomplete.</p>${chapter?`<h3>${escape(chapter.title)}</h3><p>${escape(chapter.summary)}</p>`:''}<h3>Inspect the original evidence</h3>${evidence.map(e=>`<button class="document-button" data-evidence="${e.id}">${escape(e.title)}<small>${escape(e.path)}</small></button>`).join('')}<h3>About HLX</h3><p>Independent reverse-engineering research. Not affiliated with Hyperliquid or Hyper Foundation. ExEx and local devnet tooling are HLX features with independent engineering contracts. The native binary remains the model for consensus execution.</p>`;
  document.querySelectorAll('[data-evidence]').forEach(b=>b.onclick=()=>readEvidence(b.dataset.evidence));$('#evidence-dialog').showModal();
}
function readEvidence(id){const e=data.evidence.find(e=>e.id===id);$('#evidence-content').innerHTML=`<button class="document-button" id="evidence-back">← Evidence boundaries</button><h2>${escape(e.title)}</h2><div class="evidence-sha">${escape(e.path)}<br>Original SHA-256 ${e.sha256}<br>${escape(e.availability)}${e.excerpt?'<br>'+escape(e.excerpt):''}</div><pre>${escape(e.text)}</pre>`;$('#evidence-back').onclick=()=>{const node=graphFor(layer).nodes.find(n=>n.id===selected);$('#evidence-dialog').close();showProof(node);};}
function search(){const query=$('#map-search').value.toLowerCase().trim();if(!query){$('#search-results').hidden=true;return;}const entries=['architecture','crates','state','actions'].flatMap(l=>{const heldFilter=filter;filter='';const graph=graphFor(l);filter=heldFilter;return graph.nodes.map(n=>({...n,layer:l}));});const results=entries.filter(n=>`${n.label} ${n.subtitle}`.toLowerCase().includes(query)).sort((a,b)=>Number(b.label.toLowerCase().includes(query))-Number(a.label.toLowerCase().includes(query))).slice(0,16);$('#search-results').innerHTML=results.length?results.map(n=>`<button data-result-layer="${n.layer}" data-result-id="${n.id}">${escape(n.label)}<small>${escape(n.layer)} · ${escape(n.group)}</small></button>`).join(''):'<button disabled>No matching component</button>';$('#search-results').hidden=false;document.querySelectorAll('[data-result-id]').forEach(b=>b.onclick=()=>{setLayer(b.dataset.resultLayer);inspect(b.dataset.resultId);$('#map-search').value='';$('#search-results').hidden=true;});}

try{
  const response=await fetch('./data.json',{cache:'no-store'});if(!response.ok)throw new Error('Atlas data unavailable');data=await response.json();
  $('#snapshot-date').textContent='EVIDENCE '+data.asOf;
  atlas=createAtlas($('#universe'),{onSelect:id=>inspect(id),onHover:id=>{const node=graphFor(layer).nodes.find(n=>n.id===id);$('#hover-label').hidden=!node||layer==='flow';if(node)$('#hover-label').textContent=node.subtitle;}});
  atlas.setGraph(graphFor('architecture'));atlas.setMotion(motion);updateCount();
  document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>setLayer(b.dataset.layer));
  $('#back-map').onclick=()=>setLayer(layer);
  $('#map-reset').onclick=()=>{stopTour();atlas.reset();$('#inspector').hidden=true;selected=null;atlas.setSelection(null);};$('#map-zoom-in').onclick=()=>atlas.zoom(-.14);$('#map-zoom-out').onclick=()=>atlas.zoom(.14);
  $('#motion-toggle').onclick=()=>{motion=!motion;if(!motion){stopPlay();stopTour();}atlas.setMotion(motion);$('#motion-toggle').textContent=motion?'Ⅱ':'▷';$('#motion-toggle').setAttribute('aria-label',motion?'Pause animation':'Resume animation');};
  $('#tour-toggle').onclick=()=>{if(tourTimer){stopTour();return;}const graph=graphFor(layer);let step=0;inspect(graph.nodes[step].id);$('#tour-toggle').classList.add('active');tourTimer=setInterval(()=>{step=(step+1)%graph.nodes.length;inspect(graph.nodes[step].id);},4400);};
  $('#flow-step').oninput=e=>{stopPlay();inspect('flow-'+e.target.value,{focus:false});};$('#flow-play').onclick=()=>{if(playTimer){stopPlay();return;}$('#flow-play').textContent='Ⅱ';playTimer=setInterval(()=>{const next=(Number($('#flow-step').value)+1)%8;inspect('flow-'+next,{focus:false});},2200);};$('#flow-close').onclick=stopPlay;
  $('#proof-toggle').onclick=()=>showProof();$('#about-toggle').onclick=()=>showProof();$('.dialog-close').onclick=()=>$('#evidence-dialog').close();$('#map-search').oninput=search;
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();$('#map-search').focus();}if(e.key==='Escape'){$('#search-results').hidden=true;stopTour();stopPlay();}});
  document.addEventListener('pointerdown',e=>{if(!$('.search-shell').contains(e.target))$('#search-results').hidden=true;});
  $('#loading').classList.add('fade');setTimeout(()=>{$('#loading').hidden=true;},800);
  document.title='HLX · The Machine Atlas';
}catch(error){$('#loading').innerHTML=`<span>${escape(error.message)}</span><a href="./reference.html">Read the static reference</a>`;console.error(error);}
