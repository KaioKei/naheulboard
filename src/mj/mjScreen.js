/**
 * The GM screen: heroes, NPCs, enemies, triggers, journal and backup.
 *
 * A 1:1 port of the standalone ecran-mj-naheulbeuk_v12.html tool (see
 * ECRAN-MJ-CONTEXTE.md). Only three things differ from the original:
 *   - the IIFE became mountMjScreen(), called once by src/main.ts;
 *   - the six data constants became JSON imports (src/mj/data/);
 *   - the view list gained the Musique tab (the soundboard, rendered by src/ui/).
 *
 * This file stays vanilla JavaScript, original indentation and style included
 * (hence the French comments below): it is dense DOM code that works, and
 * rewriting it in strict TypeScript is a separate project. Its public contract
 * is in mjScreen.d.ts; everything else in src/ is TypeScript.
 */
import SEED from './data/seed.json';
import RP_PATCH from './data/rp-patch.json';
import JUL_PATCH from './data/jul-patch.json';
import BESTIAIRE from './data/bestiaire.json';
import EQUIP from './data/equip.json';
import LIVRET from './data/livret.json';

/**
 * Tab ids, in display order. Each one has a <section id="v-{id}"> in
 * index.html; 'musique' is filled by the soundboard, not by this module.
 */
export const MJ_VIEWS = ['persos', 'trig', 'journal', 'musique', 'backup'];

/** Starts the screen: loads the local save and renders every view. */
export function mountMjScreen() {
const MODKEYS=['cou','int','cha','ad','fo','at','prd','pr'];
const LABEL={cou:'COU',int:'INT',cha:'CHA',ad:'AD',fo:'FO',at:'AT',prd:'PRD',pr:'PR'};
const KEYWORDS=['combat','taverne','marchand','elfe','trésor','repas','mensonge','animal','discrétion','malédiction','escalade','lire','vol','magie'];
const PRESETS=[
  {nom:'Empoisonné',mods:{ad:-2}},
  {nom:'Ivre',mods:{ad:-2,int:-2,cou:2}},
  {nom:'Effrayé',mods:{cou:-3,at:-2}},
  {nom:'Béni',mods:{at:1,prd:1}},
  {nom:'Blessé à la jambe',mods:{ad:-2,prd:-1}},
  {nom:'Couvert de bave',mods:{cha:-4}},
];
const KINDS={heros:'Héros',pnj:'PNJ',ennemi:'Ennemi'};
const ATTITUDES={ami:'Amical',neutre:'Neutre',louche:'Méfiant',hostile:'Hostile'};
const S={migrations:[],heros:{},etat:{notes:'',journal:[],spotlight:{}},lastExport:null,savedAt:null,view:'persos',openId:null,tab:'fiche',q:''};

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const clone=o=>JSON.parse(JSON.stringify(o));
const rid=()=>Math.random().toString(36).slice(2,10);
const sgn=v=>(v>0?'+':v<0?'−':'')+Math.abs(v);
const kindOf=h=>h.kind==='pnj'||h.kind==='ennemi'?h.kind:'heros';

const MODRE=/(COU|INT|CHA|AD|FO|AT|PRD|PR)\s*:?\s*([+\-−–]?)\s*(\d+)|([+\-−–])\s*(\d+)\s*(?:en\s+|à\s+|a\s+)?(COU|INT|CHA|AD|FO|AT|PRD|PR)\b/gi;
const prepMods=t=>String(t||'').replace(/AT\s*\/\s*PRD\s*([+\-−–])\s*(\d+)/gi,'AT$1$2 PRD$1$2');
function parseMods(txt){
  const out={};prepMods(txt).replace(MODRE,(m,k1,s1,v1,s2,v2,k2)=>{
    const k=(k1||k2).toLowerCase(),sign=(s1||s2||'+')==='+'?1:-1;
    out[k]=(out[k]||0)+sign*n(v1||v2);return m;
  });
  Object.keys(out).forEach(k=>{if(!out[k])delete out[k]});
  return out;
}
const inHand=a=>a.equipe!==false, worn=p=>p.porte!==false;
function itemSources(h){
  const out=[];
  (h.armes||[]).forEach(a=>{if(inHand(a)){const m=parseMods(a.bonus);if(Object.keys(m).length)out.push({nom:a.nom||'Arme',mods:m})}});
  (h.protections||[]).forEach(p=>{if(worn(p)){const m=parseMods(p.bonus);if(Object.keys(m).length)out.push({nom:p.nom||'Protection',mods:m})}});
  return out;
}
function sources(h){return [...(h.effets||[]).map(e=>({nom:e.nom,mods:e.mods||{}})),...itemSources(h)]}
const fmtKg=v=>(Math.round(n(v)*100)/100).toLocaleString('fr-FR');
const qteOf=r=>r.qte===''||r.qte==null?1:n(r.qte);
function sacPoids(h){return (h.sac||[]).reduce((s,r)=>s+n(r.poids)*qteOf(r),0)}
function poidsMsg(h){const p=sacPoids(h),m=n(h.chargeMax);if(!m)return `${fmtKg(p)} kg dans le sac (pas de limite définie)`;return p>m?`Surchargé : ${fmtKg(p)} / ${fmtKg(m)} kg (${fmtKg(p-m)} kg de trop)`:`${fmtKg(p)} / ${fmtKg(m)} kg (reste ${fmtKg(m-p)} kg)`}
function sacGauge(h){
  const p=sacPoids(h),m=n(h.chargeMax);if(!m&&!p)return '';
  const pct=m?Math.min(100,p/m*100):0,over=m&&p>m;
  return `<div class="gauge sac ${over?'over':''}" title="${esc(poidsMsg(h))}">
    <span class="k">Sac</span>
    <div class="track" role="meter" aria-label="Poids du sac" aria-valuemin="0" aria-valuemax="${m}" aria-valuenow="${Math.round(p*100)/100}"><i style="width:${m?pct:0}%"></i></div>
    <span class="v"><b>${fmtKg(p)}</b>${m?`/${fmtKg(m)}`:''} kg</span>
    ${over?`<span class="msg">Surchargé de ${fmtKg(p-m)} kg</span>`:''}
  </div>`;
}
function armorPR(h){return (h.protections||[]).filter(worn).reduce((s,p)=>s+n(p.prNat)+n(p.prMag),0)}
function base(h,k){return k==='pr'?n(h.prNat)+n(h.prMag)+armorPR(h):n(h[k])}
function mod(h,k){return sources(h).reduce((s,x)=>s+n(x.mods&&x.mods[k]),0)}
function modPills(m){return Object.entries(m).map(([k,v])=>`<span class="mod ${v>0?'up':'down'}">${LABEL[k]} ${sgn(v)}</span>`).join(' ')}
function val(h,k){return base(h,k)+mod(h,k)}
function list(kind){return Object.values(S.heros).filter(h=>!kind||kindOf(h)===kind).sort((a,b)=>n(a.ordre)-n(b.ordre)||String(a.nom).localeCompare(b.nom))}
function heroes(){return list('heros')}
const isOut=h=>n(h.evMax)>0&&n(h.ev)<=0;

/* ---------- Sauvegarde locale ---------- */
const KEY='naheulbeuk-mj-v1', KEY_UNDO='naheulbeuk-mj-v1-avant-import';
let saveTimer;
function snapshot(){return {app:'ecran-mj-naheulbeuk',version:12,migrations:S.migrations||[],savedAt:new Date().toISOString(),heros:S.heros,etat:S.etat,lastExport:S.lastExport||null}}
function setStatus(s){const el=$('#save-status');el.classList.toggle('err',s==='err');el.textContent=s==='err'?'Échec de l\'enregistrement : exporte une sauvegarde':s==='pending'?'Enregistrement…':'Enregistré sur cet appareil'}
function persist(){
  try{localStorage.setItem(KEY,JSON.stringify(snapshot()));S.savedAt=new Date().toISOString();setStatus('ok')}
  catch(e){setStatus('err')}
  renderBackup();
}
function save(){clearTimeout(saveTimer);setStatus('pending');saveTimer=setTimeout(persist,300)}
function load(data){
  S.heros={};Object.entries(data.heros||{}).forEach(([id,h])=>S.heros[id]={...h,id});
  S.etat={notes:'',journal:[],spotlight:{},...(data.etat||{})};
  S.lastExport=data.lastExport||null;S.savedAt=data.savedAt||null;
  S.migrations=Array.isArray(data.migrations)?data.migrations.slice():[];
  const a=migrate(),b=migrateEquip(),c=migratePoids(),e=migrateJul();return a||b||c||e;
}
function migrate(){
  if(S.migrations.includes('rp-v3'))return false;
  const P=RP_PATCH,t=S.heros['tiny-parker'],j=S.heros['julodion'];
  if(t){
    ['pitch','desir','force','faiblesse','aime','deteste','tic','secret'].forEach(k=>{if(!t[k])t[k]=P.tiny[k]});
    if(!t.background||String(t.background).startsWith('Petit gnôme des forêts du Nord'))t.background=P.tiny.background;
    t.reperes=clone(P.tiny.reperes);t.accroches=clone(P.tiny.accroches);
    t.competences=t.competences||[];
    if(!t.competences.some(c=>c.nom==='Panier !'))t.competences.unshift(clone(P.tiny.panier));
  }
  if(j){
    (j.accroches||[]).forEach(a=>{if(!a.source&&P.julSources[a.declencheur])a.source=P.julSources[a.declencheur]});
    Object.entries(P.jul).forEach(([k,v])=>{if(!j[k])j[k]=v});
  }
  S.migrations.push('rp-v3');
  return true;
}
function migrateEquip(){
  if(S.migrations.includes('equip-v4'))return false;
  Object.values(S.heros).forEach(h=>{
    const a=armorPR(h);
    if(a>0&&n(h.prNat)+n(h.prMag)===a){h.prNat=0;h.prMag=0}
  });
  S.migrations.push('equip-v4');
  return true;
}
function migrateJul(){
  if(S.migrations.includes('jul-v11'))return false;
  S.migrations.push('jul-v11');
  const P=JUL_PATCH,j=S.heros['julodion'];if(!j)return false;
  if(j.nom===P.oldNom)j.nom=P.nom;
  Object.entries(P.profile).forEach(([k,v])=>{if(!j[k]||j[k]===P.oldProfile[k])j[k]=v});
  if(!j.background||String(j.background).startsWith(P.oldBackgroundStart))j.background=P.background;
  const mine=(j.reperes||[]).filter(r=>r.texte&&!P.oldReperes.includes(r.texte)&&!P.reperes.includes(r.texte));
  j.reperes=[...P.reperes.map(t=>({texte:t})),...mine];
  const newNames=P.accroches.map(a=>a.declencheur);
  const kept=(j.accroches||[]).filter(a=>!P.replaces.includes(a.declencheur)&&!newNames.includes(a.declencheur));
  j.accroches=[...clone(P.accroches),...kept];
  j.competences=j.competences||[];
  P.skills.forEach(sk=>{
    const c=j.competences.find(c=>norm(c.nom)===norm(sk.nom));
    if(c){c.acquise=true;if(!c.carac)c.carac=sk.carac;if(!c.desc||c.desc.length<sk.desc.length)c.desc=sk.desc;if(!/Personnage/.test(c.source||''))c.source=(c.source?c.source+' · ':'')+'choisie par le joueur'}
    else j.competences.push({acquise:true,nom:sk.nom,source:'Choisie par le joueur',carac:sk.carac,desc:sk.desc});
  });
  return true;
}
function migratePoids(){
  if(S.migrations.includes('poids-v9'))return false;
  Object.values(S.heros).forEach(h=>{
    if(kindOf(h)!=='heros'||h.chargeMax!=null)return;
    const o=norm(h.origine);
    h.chargeMax=/gn[o]me/.test(o)?2:/semi-elfe/.test(o)?10:0;
  });
  S.migrations.push('poids-v9');
  return true;
}
function fmtDate(iso){const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
function daysSince(iso){const d=new Date(iso);return isNaN(d)?Infinity:(Date.now()-d)/864e5}
function renderBackup(){
  $('#bk-local').textContent=S.savedAt?'Dernier enregistrement : '+fmtDate(S.savedAt)+'.':'Rien n\'a encore été modifié sur cet appareil.';
  $('#bk-export').textContent=S.lastExport?'Dernière sauvegarde dans un fichier : '+fmtDate(S.lastExport)+'.':'Aucune sauvegarde dans un fichier pour l\'instant.';
  renderFile();
  let undo=false;try{undo=!!localStorage.getItem(KEY_UNDO)}catch(e){}
  $('#undo-import').hidden=!undo;
  const bn=$('#banner'),need=!S.lastExport||daysSince(S.lastExport)>=7;
  bn.hidden=!need;
  if(need)bn.innerHTML=`<span>${S.lastExport?'Ta dernière sauvegarde dans un fichier date de plus d\'une semaine.':'Tu n\'as encore jamais écrit de fichier de sauvegarde.'} Un fichier de sauvegarde protège ta campagne si le navigateur efface ses données.</span><button type="button" class="btn small primary" data-act="save-file">Sauvegarder maintenant</button>`;
}

/* ---------- Fichier de sauvegarde courant ---------- */
/* Le fichier courant est celui qu'on a chargé ou enregistré en dernier : « Sauvegarder »
   écrit par-dessus sans rien demander. Chrome et Edge le font vraiment (File System Access
   API ; le handle dort dans IndexedDB d'une session à l'autre). Firefox et Safari n'ont pas
   cette API : on retombe sur un téléchargement portant le même nom, et on le dit. */
const KEY_FILE='naheulbeuk-mj-v1-fichier';
const FS_OK=typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';
const FILETYPES=[{description:'Sauvegarde JSON',accept:{'application/json':['.json']}}];
let FILE={handle:null,name:null};
try{FILE.name=localStorage.getItem(KEY_FILE)||null}catch(e){}

const IDB_NAME='naheulbeuk-mj',IDB_STORE='fichier';
function idb(){return new Promise((res,rej)=>{
  if(!window.indexedDB)return rej(new Error('pas d\'IndexedDB'));
  const r=indexedDB.open(IDB_NAME,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(IDB_STORE))r.result.createObjectStore(IDB_STORE)};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
})}
function idbSet(v){return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction(IDB_STORE,'readwrite');t.objectStore(IDB_STORE).put(v,'handle');
  t.oncomplete=()=>res();t.onerror=()=>rej(t.error);
})).catch(()=>{})}
function idbGet(){return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction(IDB_STORE,'readonly'),q=t.objectStore(IDB_STORE).get('handle');
  q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);
})).catch(()=>null)}

/** Retient le fichier dans lequel « Sauvegarder » doit écrire. */
function setFile(handle,name){
  FILE={handle:handle||null,name:name||null};
  try{name?localStorage.setItem(KEY_FILE,name):localStorage.removeItem(KEY_FILE)}catch(e){}
  if(FS_OK)idbSet(handle||null);
  renderFile();
}
function renderFile(){
  const b=$('#bk-file');
  if(b)b.textContent=FILE.name
    ?'Fichier courant : '+FILE.name+(FS_OK&&!FILE.handle?' (nom seul : recharge-le pour écrire dedans)':'')+'.'
    :'Aucun fichier courant : « Sauvegarder » te demandera d\'abord où écrire.';
  const pv=$('#pv-file');if(pv)pv.textContent=FILE.name||'aucun pour l\'instant';
}
function defaultName(){const d=new Date(),p=x=>String(x).padStart(2,'0');return `ecran-mj-naheulbeuk-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.json`}
/* Le format du fichier ne change pas : snapshot(), plus exportedAt. */
function fileText(at){return JSON.stringify({...snapshot(),lastExport:at,exportedAt:at},null,2)}
function markSaved(at){S.lastExport=at;persist()}
function download(name,text){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
async function canWrite(h){
  try{
    if(!h.queryPermission)return true;
    if(await h.queryPermission({mode:'readwrite'})==='granted')return true;
    return await h.requestPermission({mode:'readwrite'})==='granted';
  }catch(e){return false}
}
async function writeTo(h,text){const w=await h.createWritable();await w.write(text);await w.close()}
/** « Sauvegarder » : écrase le fichier courant. Sans fichier courant, demande lequel. */
async function saveFile(){
  const at=new Date().toISOString();
  if(!FS_OK){
    if(!FILE.name)return saveAs();
    download(FILE.name,fileText(at));markSaved(at);
    toast('Sauvegarde téléchargée sous '+FILE.name+'. Ce navigateur ne sait pas écrire par-dessus un fichier : remplace-le dans ton dossier de téléchargements.');
    return;
  }
  if(!FILE.handle)return saveAs();
  if(!await canWrite(FILE.handle)){toast('Autorisation refusée sur '+FILE.name+' : passe par « Enregistrer sous… ».');return}
  try{await writeTo(FILE.handle,fileText(at))}
  catch(e){toast('Impossible d\'écrire dans '+FILE.name+' : le fichier a peut-être été déplacé ou supprimé. Passe par « Enregistrer sous… ».');return}
  markSaved(at);toast('Sauvegardé dans '+FILE.name+'.');
}
/** « Enregistrer sous… » : écrit dans un autre fichier, qui devient le fichier courant. */
async function saveAs(){
  const at=new Date().toISOString();
  if(!FS_OK){
    const asked=(prompt('Nom du fichier de sauvegarde :',FILE.name||defaultName())||'').trim();
    if(!asked)return;
    const name=/\.json$/i.test(asked)?asked:asked+'.json';
    download(name,fileText(at));setFile(null,name);markSaved(at);
    toast('Sauvegarde téléchargée sous '+name+'. Les prochaines sauvegardes reprendront ce nom.');
    return;
  }
  let h;try{h=await window.showSaveFilePicker({suggestedName:FILE.name||defaultName(),types:FILETYPES})}catch(e){return}
  try{await writeTo(h,fileText(at))}catch(e){toast('Impossible d\'écrire dans ce fichier.');return}
  setFile(h,h.name);markSaved(at);
  toast('Sauvegardé dans '+h.name+'. Les prochaines sauvegardes iront dans ce fichier.');
}
/** « Charger une sauvegarde » : le fichier chargé devient le fichier courant. */
async function openFile(){
  let h;try{[h]=await window.showOpenFilePicker({multiple:false,types:FILETYPES})}catch(e){return}
  let txt;try{txt=await (await h.getFile()).text()}catch(e){toast('Ce fichier est illisible.');return}
  if(!importText(txt))return;
  setFile(h,h.name);
  toast(`Sauvegarde chargée depuis ${h.name} : ${Object.keys(S.heros).length} personnages. « Sauvegarder » écrira par-dessus.`);
}
/** Charge un texte de sauvegarde. Rend false si ce n'en est pas une ; le toast de succès
    revient à l'appelant, qui seul sait de quel fichier ça vient. */
function importText(txt){
  let data;try{data=JSON.parse(txt)}catch(e){toast('Ce fichier n\'est pas une sauvegarde lisible.');return false}
  if(!data||typeof data!=='object'||!data.heros||typeof data.heros!=='object'){toast('Ce fichier ne contient pas de personnages : ce n\'est pas une sauvegarde de l\'écran du MJ.');return false}
  try{localStorage.setItem(KEY_UNDO,JSON.stringify(snapshot()))}catch(e){}
  load(data);S.lastExport=data.exportedAt||data.lastExport||S.lastExport;
  if($('#dlg-hero').open)$('#dlg-hero').close();
  persist();renderAll();return true;
}

let tt;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,4200)}

/* ---------- Briques de cartes ---------- */
function statTile(h,k){
  const m=mod(h,k),v=val(h,k);
  const cls=m>0?'up':m<0?'down':'';
  const parts=sources(h).filter(x=>n(x.mods&&x.mods[k])).map(x=>`${x.nom} ${sgn(n(x.mods[k]))}`);
  const title=`${LABEL[k]} ${v}`+(k==='pr'&&armorPR(h)?` (dont armure ${armorPR(h)})`:'')+(parts.length?` · base ${base(h,k)} · ${parts.join(' · ')}`:'');
  return `<div class="stat ${cls}" title="${esc(title)}"><span class="k">${LABEL[k]}</span><span class="v">${v}</span>${m?`<span class="d">${sgn(m)}</span>`:''}</div>`;
}
function gauge(h,kind,withHit){
  const cur=n(h[kind]),max=n(h[kind+'Max']);
  const pct=max?Math.max(0,Math.min(100,cur/max*100)):0;
  const id=esc(h.id),K=kind.toUpperCase();
  return `<div class="gauge ${kind}">
    <span class="k">${K}</span>
    <div class="track" role="meter" aria-label="${kind==='ev'?'Énergie vitale':'Énergie astrale'}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${cur}"><i style="width:${pct}%"></i></div>
    <span class="v"><b>${cur}</b>/${max}</span>
    <div class="steps">
      <button type="button" class="hurt" data-act="${kind}" data-id="${id}" data-d="-5" aria-label="Retirer 5 ${K}">−5</button>
      <button type="button" class="hurt" data-act="${kind}" data-id="${id}" data-d="-1" aria-label="Retirer 1 ${K}">−1</button>
      <button type="button" class="heal" data-act="${kind}" data-id="${id}" data-d="1" aria-label="Ajouter 1 ${K}">+1</button>
      <button type="button" class="heal" data-act="${kind}" data-id="${id}" data-d="5" aria-label="Ajouter 5 ${K}">+5</button>
    </div>
    ${withHit?`<div class="hit"><input type="number" min="0" id="dmg-${id}" placeholder="dégâts" aria-label="Dégâts à infliger à ${esc(h.nom)}"><button type="button" class="btn small" data-act="hit" data-id="${id}">Infliger</button></div>`:''}
  </div>`;
}
function effetChip(h,e){
  const mods=Object.entries(e.mods||{}).filter(([,v])=>n(v)).map(([k,v])=>`${LABEL[k]} ${sgn(n(v))}`).join(', ');
  return `<span class="chip" title="${esc(e.note||'')}"><span><b>${esc(e.nom)}</b>${mods?` · ${esc(mods)}`:''}${e.note?` · <i>${esc(e.note)}</i>`:''}</span><button type="button" data-act="eff-del" data-id="${esc(h.id)}" data-eid="${esc(e.id)}" aria-label="Retirer ${esc(e.nom)}">×</button></span>`;
}
function chips(h){return `<div class="chips">${(h.effets||[]).map(e=>effetChip(h,e)).join('')}<button type="button" class="btn small ghost" data-act="eff-add" data-id="${esc(h.id)}">+ Bonus / malus</button></div>`}
function healthPill(h,deadLabel){
  if(isOut(h))return `<span class="pill dead">${deadLabel}</span>`;
  if(n(h.evMax)&&n(h.ev)<=n(h.evMax)/3)return '<span class="pill warn">Mal en point</span>';
  return '';
}

/* ---------- Cartes ---------- */
function heroCard(h){
  const id=esc(h.id);
  const dmax=Math.max(n(h.destinMax),n(h.destin));
  const pips=Array.from({length:dmax},(_,i)=>`<button type="button" class="pip ${i<n(h.destin)?'on':''}" data-act="destin" data-id="${id}" data-i="${i}" aria-label="Point de destin ${i+1}${i<n(h.destin)?', disponible':', dépensé'}"></button>`).join('');
  const rep=(h.reperes||[]).filter(r=>r.texte&&String(r.texte).trim());
  return `<article class="card ${isOut(h)?'down':''}">
    <div class="top">
      <div style="min-width:0">
        <h3 class="name">${esc(h.nom||'Héros sans nom')}</h3>
        <div class="sub">${esc([h.origine,h.metier].filter(Boolean).join(' · ')||'Origine et métier à définir')} · niv. ${n(h.niveau)||1}${h.joueur?` · <i>${esc(h.joueur)}</i>`:''}</div>
      </div>
      ${healthPill(h,'À terre')}
    </div>
    ${gauge(h,'ev')}
    ${n(h.eaMax)>0?gauge(h,'ea'):''}
    ${sacGauge(h)}
    <div class="stats">${['cou','int','cha','ad','fo'].map(k=>statTile(h,k)).join('')}</div>
    <div class="stats c4">${['at','prd','pr'].map(k=>statTile(h,k)).join('')}<div class="stat" title="Résistance magique"><span class="k">RM</span><span class="v">${n(h.rm)}</span></div></div>
    <div class="line2">
      <div class="destin"><span class="k">Destin</span>${pips||'<span class="hint">aucun</span>'}</div>
      <div class="xp"><span class="k">XP</span><b>${n(h.xp)}</b>
        <input type="number" min="0" id="xp-${id}" placeholder="XP" aria-label="Nombre de points d'expérience pour ${esc(h.nom)}">
        <button type="button" class="btn small pm plus" data-act="xp" data-sign="1" data-id="${id}" title="Ajouter ces XP" aria-label="Ajouter ces XP à ${esc(h.nom)}">+</button>
        <button type="button" class="btn small pm minus" data-act="xp" data-sign="-1" data-id="${id}" title="Retirer ces XP" aria-label="Retirer ces XP à ${esc(h.nom)}">−</button>
      </div>
    </div>
    ${chips(h)}
    ${CARDVIEW.equip?equipBlock(h):''}
    ${CARDVIEW.comp?skillsBlock(h):''}
    ${CARDVIEW.rp?(rep.length?`<div class="blk rp"><div class="blk-h">Rôleplay <span class="c">${rep.length}</span></div><ul class="reperes">${rep.map(r=>`<li>${esc(r.texte)}</li>`).join('')}</ul></div>`:`<div class="blk rp"><div class="blk-h">Rôleplay</div><span class="hint">Aucun repère. Ajoute-en dans la fiche, onglet Rôleplay.</span></div>`):''}
    <div class="actions-row"><button type="button" class="btn" data-act="hero-open" data-id="${id}">Ouvrir la fiche</button></div>
  </article>`;
}
function equipBlock(h){
  const id=esc(h.id),armes=(h.armes||[]).map((a,i)=>({a,i})).filter(x=>x.a.nom||x.a.pi||x.a.bonus);
  const prots=(h.protections||[]).filter(p=>p.nom);
  if(!armes.length&&!prots.length)return `<div class="equip blk"><div class="blk-h">Équipement</div><span class="hint">Pas d'arme ni de protection notée. Ajoute-les dans la fiche, onglet Équipement.</span></div>`;
  const rest=t=>{const r=prepMods(t).replace(MODRE,'').replace(/^[\s,;·\/]+|[\s,;·\/]+$/g,'').replace(/\s*[,;]\s*[,;]\s*/g,', ');return r?`<span class="xtra">${esc(r)}</span>`:''};
  const w=armes.map(({a,i})=>`<div class="eq-row ${inHand(a)?'':'off'}">
      <button type="button" class="hand ${inHand(a)?'on':''}" data-act="equip" data-id="${id}" data-i="${i}" aria-pressed="${inHand(a)}" title="${inHand(a)?'En main : ses bonus comptent. Clic pour la ranger.':'Rangée : clic pour la prendre en main.'}">${inHand(a)?'en main':'rangée'}</button>
      <b>${esc(a.nom||'Arme')}</b>${a.pi?`<span class="pi">${esc(a.pi)}</span>`:''}${modPills(parseMods(a.bonus))}${rest(a.bonus)}${a.rup?`<span class="xtra">rupture ${esc(a.rup)}</span>`:''}${a.note?`<span class="xtra">${esc(a.note)}</span>`:''}
    </div>`).join('');
  const wornP=prots.filter(worn),off=prots.length-wornP.length;
  const pr=wornP.length?`<div class="eq-row"><span class="eh">Protections</span>${wornP.map(p=>{const v=n(p.prNat)+n(p.prMag);const m=parseMods(p.bonus);return `<span>${esc(p.nom)}${v?` <span class="pi">PR ${v}</span>`:''}${Object.keys(m).length?' '+modPills(m):''}${rest(p.bonus)?' '+rest(p.bonus):''}${p.note?` <span class="xtra">(${esc(p.note)})</span>`:''}</span>`}).join('<span class="xtra">·</span>')}${off?`<span class="xtra">(+${off} au sac)</span>`:''}</div>`:(off?`<div class="eq-row"><span class="eh">Protections</span><span class="xtra">${off} au sac, aucune portée</span></div>`:'');
  return `<div class="equip blk"><div class="blk-h">Équipement</div>${w}${pr}</div>`;
}
let CARDVIEW={equip:true,comp:true,rp:true};
try{const v=JSON.parse(localStorage.getItem('mj-card-view')||'null');if(v)CARDVIEW={...CARDVIEW,...v}}catch(e){}
const openSkill={};
function skillsBlock(h){
  const id=esc(h.id),cs=(h.competences||[]).map((c,i)=>({c,i})).filter(x=>x.c.acquise&&x.c.nom);
  if(!cs.length)return `<div class="blk"><div class="blk-h">Compétences</div><span class="hint">Aucune compétence acquise. Coche-les dans la fiche, onglet Compétences.</span></div>`;
  const open=openSkill[h.id],oc=open!=null?(h.competences||[])[open]:null;
  return `<div class="blk"><div class="blk-h">Compétences <span class="c">${cs.length}</span></div>
    <div class="skills">${cs.map(({c,i})=>`<button type="button" class="skill" data-act="skill" data-id="${id}" data-i="${i}" aria-expanded="${open===i}" title="${esc(c.desc||'')}">${esc(c.nom)}${c.carac?`<span class="ca">${esc(c.carac)}</span>`:''}</button>`).join('')}</div>
    ${oc&&oc.acquise?`<p class="skill-desc"><b>${esc(oc.nom)}</b>${oc.carac?` (${esc(oc.carac)})`:''} : ${esc(oc.desc||'pas de description')}</p>`:''}
  </div>`;
}
function npcCard(h){
  const id=esc(h.id),att=h.attitude&&ATTITUDES[h.attitude]?h.attitude:'neutre';
  const fights=n(h.evMax)>0;
  const lines=[['Voix, tic',h.voix],['Veut',h.motivation],['Secret',h.secret]].filter(([,v])=>v);
  return `<article class="card npc ${isOut(h)?'dead':''}">
    <div class="top">
      <div style="min-width:0">
        <h3 class="name">${esc(h.nom||'PNJ sans nom')}</h3>
        <div class="sub">${esc([h.origine,h.metier,h.role,h.lieu].filter(Boolean).join(' · ')||'Rôle à définir')}</div>
      </div>
      ${isOut(h)?'<span class="pill dead">À terre</span>':`<span class="pill ${att}">${ATTITUDES[att]}</span>`}
    </div>
    ${fights?gauge(h,'ev',true):''}
    ${h.origine&&CARS.some(k=>n(h[k]))?`<div class="stats">${CARS.map(k=>statTile(h,k)).join('')}</div>`:''}
    ${fights?`<div class="stats c4">${['at','prd','pr',h.origine&&CARS.some(k=>n(h[k]))?null:'cou'].filter(Boolean).map(k=>statTile(h,k)).join('')}</div>`:''}
    ${lines.length?`<div class="info">${lines.map(([k,v])=>`<p><b>${k} :</b> ${esc(v)}</p>`).join('')}</div>`:''}
    ${chips(h)}
    ${CARDVIEW.comp&&(h.competences||[]).some(c=>c.acquise)?skillsBlock(h):''}
    ${CARDVIEW.rp&&(h.reperes||[]).some(r=>r.texte)?`<div class="blk rp"><div class="blk-h">Rôleplay <span class="c">${(h.reperes||[]).filter(r=>r.texte).length}</span></div><ul class="reperes">${(h.reperes||[]).filter(r=>r.texte).map(r=>`<li>${esc(r.texte)}</li>`).join('')}</ul></div>`:''}
    <div class="actions-row">
      <button type="button" class="btn small" data-act="hero-open" data-id="${id}">Modifier</button>
      <button type="button" class="btn small quiet" data-act="del" data-id="${id}">Supprimer</button>
    </div>
  </article>`;
}
function foeCard(h){
  const id=esc(h.id),dead=isOut(h);
  return `<article class="card foe ${dead?'dead':''}">
    <div class="top">
      <div style="min-width:0">
        <h3 class="name">${esc(h.nom||'Ennemi')}</h3>
        <div class="sub">${esc(h.type||'Type à définir')}${n(h.xpGain)?` · rapporte ${n(h.xpGain)} XP`:''}</div>
      </div>
      ${healthPill(h,'Mort')}
    </div>
    ${gauge(h,'ev',true)}
    <div class="stats c5">${['at','prd','pr','cou'].map(k=>statTile(h,k)).join('')}<div class="stat" title="Dégâts"><span class="k">Dégâts</span><span class="v txt">${esc(h.degats||'—')}</span></div></div>
    ${h.capacites?`<div class="info"><p><b>Spécial :</b> ${esc(h.capacites)}</p></div>`:''}
    ${chips(h)}
    <div class="actions-row">
      <button type="button" class="btn small" data-act="hero-open" data-id="${id}">Modifier</button>
      <button type="button" class="btn small" data-act="dup" data-id="${id}">Dupliquer</button>
      <button type="button" class="btn small quiet" data-act="del" data-id="${id}">Supprimer</button>
    </div>
  </article>`;
}
const BQ={q:'',n:1,lvl:'',sel:0,res:[]};
const BEST=BESTIAIRE.map((e,i)=>({...e,i,k:norm(e.nom),kc:norm(e.cat)}));
function bqSearch(){
  const q=norm(BQ.q.trim());
  let xs=BEST.filter(e=>!BQ.lvl||e.niveau===BQ.lvl||(BQ.lvl==='Avancé'&&e.adv));
  if(q){
    xs=xs.map(e=>{let sc=-1;if(e.k.startsWith(q))sc=0;else if(e.k.split(/[\s'’-]+/).some(w=>w.startsWith(q)))sc=1;else if(e.k.includes(q))sc=2;else if(e.kc.includes(q))sc=3;return {e,sc}})
      .filter(x=>x.sc>=0).sort((a,b)=>a.sc-b.sc||a.e.nom.length-b.e.nom.length||a.e.nom.localeCompare(b.e.nom)).map(x=>x.e);
  } else if(!BQ.lvl) xs=[];
  BQ.res=xs.slice(0,80);if(BQ.sel>=BQ.res.length)BQ.sel=0;
}
function renderBq(){
  const ul=document.getElementById('bq-res');if(!ul)return;
  bqSearch();
  const inp=document.getElementById('bq');if(inp)inp.setAttribute('aria-expanded',String(BQ.res.length>0));
  if(!BQ.q.trim()&&!BQ.lvl){ul.innerHTML=`<li class="hint" style="padding:2px 4px">${BEST.length} créatures (tables de rencontres et bestiaire avancé). Tape un nom, ou choisis un niveau pour parcourir.</li>`;return}
  if(!BQ.res.length){ul.innerHTML='<li class="hint" style="padding:2px 4px">Aucune créature trouvée. Essaie un autre mot, ou crée un « Ennemi vierge ».</li>';return}
  ul.innerHTML=BQ.res.map((e,j)=>`<li class="bq-item" role="option" id="bq-o-${j}" aria-selected="${j===BQ.sel}" data-act="bq-add" data-b="${e.i}">
    <span class="nm">${hl(e.nom,norm(BQ.q.trim()))}</span>
    <span class="meta">${esc([e.niveau==='Avancé'?'Avancé':e.niveau,e.cat,e.groupe?`souvent ${e.groupe}`:''].filter(Boolean).join(' · '))} · ${esc(e.src.join(', '))}</span>
    <span class="st"><span>AT ${e.at}</span><span>PRD ${e.prd}</span><span>EV ${e.ev}</span><span>PR ${e.pr}</span><span>Dég. ${esc(e.deg)}</span><span>COU ${e.cou}</span><span>XP ${e.xp}</span></span>
    ${advNotes(e)?`<span class="nt">${esc(advNotes(e))}</span>`:''}
    ${e.adv?`<span class="adv"><b>Règles avancées</b> (p. ${e.advPage}) : ${esc(e.adv)}</span>`:''}
    <span class="add btn small">Ajouter${BQ.n>1?` ×${BQ.n}`:''}</span>
  </li>`).join('')+(xsMore()?`<li class="hint" style="padding:4px">Plus de résultats : précise ta recherche.</li>`:'');
  const cur=document.getElementById('bq-o-'+BQ.sel);if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest'});
}
function advNotes(e){return e.adv?String(e.notes||'').replace(/(Combat spécial\s*:\s*)?(voir|pour plus d.infos\s*:\s*voir)\s+bestiaire avancé,?\s*(P\.\s*\d+)?/gi,'').replace(/^[\s·,;]+|[\s·,;]+$/g,'').replace(/\s*·\s*·\s*/g,' · '):e.notes||''}
function xsMore(){return BQ.res.length>=80}
function addFromBest(i){
  const e=BESTIAIRE[i];if(!e)return;
  const count=Math.max(1,Math.min(20,Math.round(n(BQ.n))||1));
  const esc2=e.nom.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),reN=new RegExp('^'+esc2+'(?: (\\d+))?$');
  let max=0;Object.values(S.heros).forEach(h=>{const m=String(h.nom||'').match(reN);if(m)max=Math.max(max,m[1]?n(m[1]):1)});
  const created=[];
  for(let k=0;k<count;k++){
    const nom=(count===1&&max===0)?e.nom:`${e.nom} ${max+k+1}`;
    const id='ennemi-'+rid();
    S.heros[id]={id,kind:'ennemi',ordre:nextOrdre(),nom,type:[e.cat,e.niveau].filter(Boolean).join(' · '),
      evMax:e.ev,ev:e.ev,at:e.at,prd:e.prd,cou:e.cou,prNat:e.pr,prMag:0,rm:e.rm,degats:e.deg,xpGain:e.xp,
      capacites:[advNotes(e),e.adv].filter(Boolean).join(' · '),butin:'',effets:[],notes:`Bestiaire : ${e.src.join(', ')}${e.adv&&e.niveau!=='Avancé'?` · règles avancées p. ${e.advPage}`:''}${e.rmTxt?` · résistance magie ${e.rmTxt}`:''}`};
    created.push(nom);
  }
  BQ.q='';BQ.sel=0;save();renderPersos();
  toast(count>1?`${count} × ${e.nom} rejoignent le combat.`:`${created[0]} rejoint le combat.`);
  const inp=document.getElementById('bq');if(inp)inp.focus();
}
function renderPersos(){
  const keep={},act=document.activeElement,actId=act&&act.id;
  document.querySelectorAll('#v-persos input[id^="xp-"],#v-persos input[id^="dmg-"]').forEach(i=>{if(i.value!=='')keep[i.id]=i.value});
  let sel=null;try{if(actId&&act.closest&&act.closest('#v-persos')&&act.type==='text')sel=[act.selectionStart,act.selectionEnd]}catch(e){}
  renderPersosInner();
  Object.entries(keep).forEach(([id,v])=>{const i=document.getElementById(id);if(i)i.value=v});
  if(actId&&act.closest&&!document.body.contains(act)){const f=document.getElementById(actId);if(f&&f.closest('#v-persos')){f.focus({preventScroll:true});if(sel)try{f.setSelectionRange(sel[0],sel[1])}catch(e){}}}
}
function renderPersosInner(){
  const hs=heroes(),pnjs=list('pnj'),foes=list('ennemi');
  const alive=foes.filter(f=>!isOut(f)).length,dead=foes.length-alive;
  const xpWon=foes.filter(isOut).reduce((s,f)=>s+n(f.xpGain),0);
  $('#v-persos').innerHTML=`
  <div class="savebar">
    <div>Fichier de sauvegarde : <b id="pv-file">${esc(FILE.name||'aucun pour l\'instant')}</b></div>
    <button type="button" class="btn small primary" data-act="save-file">Sauvegarder</button>
  </div>
  <section class="group" aria-labelledby="g-h">
    <div class="group-head"><h2 id="g-h">Héros <span class="count">${hs.length}</span></h2>
      <div class="group-actions">
        <div class="toggles" role="group" aria-label="Blocs affichés sur les cartes">Afficher :
          <button type="button" data-act="cardview" data-k="equip" aria-pressed="${CARDVIEW.equip}">Équipement</button>
          <button type="button" data-act="cardview" data-k="comp" aria-pressed="${CARDVIEW.comp}">Compétences</button>
          <button type="button" data-act="cardview" data-k="rp" aria-pressed="${CARDVIEW.rp}">Rôleplay</button>
        </div>
        <button type="button" class="btn small" data-act="add" data-kind="heros">+ Ajouter un héros</button></div></div>
    <div class="grid heroes">${hs.map(heroCard).join('')||'<div class="empty"><strong>Aucun héros</strong>Ajoute le premier, ou importe une sauvegarde depuis l\'onglet Sauvegarde.</div>'}</div>
  </section>
  <section class="group" aria-labelledby="g-e">
    <div class="group-head"><div><h2 id="g-e">Ennemis <span class="count">${foes.length?`${alive} debout${dead?` · ${dead} mort${dead>1?'s':''}`:''}`:'0'}</span></h2>
      ${xpWon?`<div class="meta">XP des ennemis vaincus : <b class="num">${xpWon}</b> à répartir</div>`:''}</div>
      <div class="group-actions">
        <button type="button" class="btn small" data-act="add" data-kind="ennemi">+ Ennemi vierge</button>
        ${dead?`<button type="button" class="btn small" data-act="clear-dead">Retirer les morts</button>`:''}
        ${foes.length?`<button type="button" class="btn small quiet" data-act="clear-foes">Vider le combat</button>`:''}
      </div></div>
    <div class="bq">
      <div class="bq-row">
        <div class="grow"><label for="bq" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Chercher une créature dans le bestiaire</label>
          <input id="bq" type="text" autocomplete="off" placeholder="Bestiaire : tape un nom (gobelin, brigand, troll…) puis Entrée" value="${esc(BQ.q)}" role="combobox" aria-controls="bq-res" aria-expanded="${!!(BQ.q||BQ.lvl)}"></div>
        <label for="bq-n">Nombre <input id="bq-n" type="number" min="1" max="20" value="${BQ.n}"></label>
        <label for="bq-lvl">Niveau <select id="bq-lvl">${['','Bas niveau','Intermédiaire','Intermédiaire et haut','Haut niveau','Niveaux variés','Avancé'].map(l=>`<option value="${l}" ${BQ.lvl===l?'selected':''}>${l==='Avancé'?'Avancé (règles spéciales)':l||'Tous'}</option>`).join('')}</select></label>
      </div>
      <ul class="bq-res" id="bq-res" role="listbox" aria-label="Créatures du bestiaire"></ul>
    </div>
    <div class="grid dense">${foes.map(foeCard).join('')||'<div class="empty"><strong>Aucun ennemi en vue</strong>Cherche une créature dans le bestiaire ci-dessus : ses caractéristiques se remplissent toutes seules. « + Ennemi vierge » pour un monstre de ton invention.</div>'}</div>
  </section>
  <section class="group" aria-labelledby="g-p">
    <div class="group-head"><h2 id="g-p">PNJ <span class="count">${pnjs.length}</span></h2>
      <div class="group-actions"><button type="button" class="btn small" data-act="add" data-kind="pnj">+ Ajouter un PNJ</button></div></div>
    <div class="grid dense">${pnjs.map(npcCard).join('')||'<div class="empty"><strong>Aucun PNJ</strong>L\'aubergiste, le commanditaire de la quête, le garde corrompu… Note leur voix et leur secret pour les rejouer à l\'identique.</div>'}</div>
  </section>`;
  renderBq();
}

/* ---------- Déclencheurs ---------- */
function hl(text,q){
  const t=esc(text);if(!q)return t;
  const i=norm(text).indexOf(q);if(i<0)return t;
  const raw=String(text);
  return esc(raw.slice(0,i))+'<mark>'+esc(raw.slice(i,i+q.length))+'</mark>'+esc(raw.slice(i+q.length));
}
function renderKw(){$('#kw').innerHTML=KEYWORDS.map(k=>`<button type="button" data-act="kw" data-k="${esc(k)}" aria-pressed="${norm(S.q)===norm(k)}">${esc(k)}</button>`).join('')}
function renderTriggers(){
  const q=norm(S.q.trim()),hs=heroes();
  if(!hs.length){$('#tcols').innerHTML='<div class="empty"><strong>Pas encore de héros</strong>Les déclencheurs apparaissent dès qu\'un héros a des accroches dans sa fiche (onglet Rôleplay).</div>';return}
  $('#tcols').innerHTML=hs.map(h=>{
    const prof=PROFILE.filter(([k])=>h[k]&&String(h[k]).trim()).filter(([k])=>!q||norm(h[k]).includes(q));
    const acc=(h.accroches||[]).filter(a=>a.declencheur||a.reaction).filter(a=>!q||norm([a.declencheur,a.source,a.mots,a.reaction].join(' ')).includes(q));
    const comps=q?(h.competences||[]).filter(c=>c.acquise&&norm([c.nom,c.desc].join(' ')).includes(q)):[];
    const spot=!!(S.etat.spotlight||{})[h.id];
    const nothing=q&&!prof.length&&!acc.length&&!comps.length;
    return `<section class="tcol">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <h3>${esc(h.nom||'Sans nom')}</h3>
        <label class="spot" for="spot-${esc(h.id)}"><input type="checkbox" id="spot-${esc(h.id)}" data-spot="${esc(h.id)}" ${spot?'checked':''}> a brillé</label>
      </div>
      ${!q&&h.pitch?`<p class="pitch">${esc(h.pitch)}</p>`:''}
      ${prof.length?`<dl class="profile">${prof.map(([k,l])=>`<dt class="${k==='secret'?'secret':''}">${l}</dt><dd class="${k==='secret'?'secret':''}">${hl(h[k],q)}</dd>`).join('')}</dl>`:''}
      ${acc.length?`<div class="tsub">Déclencheurs${q?'':` · ${acc.length}`}</div>`+acc.map(a=>`<details class="trig" ${q?'open':''}><summary><b>${hl(a.declencheur,q)}</b>${a.source?`<span class="src">${hl(a.source,q)}</span>`:''}</summary><p>${hl(a.reaction,q)}</p>${q&&a.mots?`<div class="tags">${hl(a.mots,q)}</div>`:''}</details>`).join(''):''}
      ${comps.length?`<div class="compline"><span class="subgrp">Compétences utiles</span><br>${comps.map(c=>`<b>${hl(c.nom,q)}</b>${c.carac?` (${esc(c.carac)})`:''}${c.desc?` : ${hl(c.desc,q)}`:''}`).join('<br>')}</div>`:''}
      ${nothing?'<p class="hint">Rien de prévu pour ce héros ici. Une occasion de lui offrir un moment ?</p>':''}
      ${!q&&!acc.length?'<p class="hint">Aucune accroche notée. Ajoute-en dans sa fiche, onglet Rôleplay.</p>':''}
    </section>`;
  }).join('');
}

/* ---------- Journal ---------- */
function renderJournal(){
  const ta=$('#notes-seance');
  if(document.activeElement!==ta)ta.value=S.etat.notes||'';
  const items=(S.etat.journal||[]).slice().reverse();
  $('#journal-list').innerHTML=items.length?items.map(e=>{
    const d=new Date(e.date);
    const lbl=isNaN(d)?'':d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    return `<article class="entry"><header><time datetime="${esc(e.date)}">${esc(lbl)}</time><button type="button" class="btn small" data-act="journal-del" data-jid="${esc(e.id)}">Supprimer</button></header><p>${esc(e.texte)}</p></article>`;
  }).join(''):'<p class="hint">Le journal est vide. Archive tes notes en fin de séance : elles t\'aideront à faire le résumé « précédemment… » la fois suivante.</p>';
}

/* ---------- Fiche détaillée ---------- */
const PROFILE=[['desir','Veut'],['force','Force'],['faiblesse','Faiblesse'],['aime','Aime'],['deteste','Déteste'],['tic','Tic'],['secret','Secret']];
const TABS=[['fiche','Caractéristiques'],['comp','Compétences'],['equip','Équipement'],['rp','Rôleplay'],['notes','Notes']];
function field(h,k,label,opt={}){
  const id='f-'+k;
  if(opt.area)return `<label ${opt.half?'':'class="wide"'} for="${id}">${label}<textarea id="${id}" data-field="${k}" rows="${opt.rows||4}">${esc(h[k])}</textarea></label>`;
  if(opt.options)return `<label for="${id}" ${opt.wide?'class="wide"':''}>${label}<select id="${id}" data-field="${k}">${Object.entries(opt.options).map(([v,l])=>`<option value="${v}" ${String(h[k]??opt.def)===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
  return `<label for="${id}" ${opt.wide?'class="wide"':''}>${label}<input id="${id}" type="${opt.num?'number':'text'}" data-field="${k}" ${opt.num?'data-num="1"':''} value="${esc(h[k]??'')}" ${opt.ph?`placeholder="${esc(opt.ph)}"`:''}></label>`;
}
function listHTML(h,key,cols,addLabel,filter){
  const tmpl=cols.map(c=>c.w).join(' ')+' 34px';
  const rows=(h[key]||[]).map((r,i)=>({r,i})).filter(x=>!filter||filter(x.r));
  return `<div class="lst">
    <div class="lst-head" style="grid-template-columns:${tmpl}">${cols.map(c=>`<span>${c.label}</span>`).join('')}<span></span></div>
    ${rows.map(({r,i})=>`<div class="lst-row" style="grid-template-columns:${tmpl}">${cols.map(c=>{
      const id=`l-${key}-${i}-${c.k}`;
      if(c.type==='check')return `<input type="checkbox" id="${id}" data-list="${key}" data-i="${i}" data-k="${c.k}" ${(c.def?r[c.k]!==false:r[c.k])?'checked':''} aria-label="${esc(c.label)}">`;
      if(c.area)return `<textarea id="${id}" data-list="${key}" data-i="${i}" data-k="${c.k}" rows="2" placeholder="${esc(c.label)}" aria-label="${esc(c.label)}">${esc(r[c.k])}</textarea>`;
      return `<input id="${id}" type="${c.num?'number':'text'}" ${c.dl?`list="${c.dl}"`:''} ${c.num?'data-num="1" step="any"':''} data-list="${key}" data-i="${i}" data-k="${c.k}" value="${esc(r[c.k]??'')}" placeholder="${esc(c.label)}" aria-label="${esc(c.label)}">`;
    }).join('')}<button type="button" class="x" data-act="row-del" data-list="${key}" data-i="${i}" aria-label="Supprimer la ligne">×</button></div>`).join('')}
    ${addLabel?`<div><button type="button" class="btn small ghost" data-act="row-add" data-list="${key}">+ ${addLabel}</button></div>`:''}
  </div>`;
}
function caracTable(h,keys){
  return `<div class="ctable"><span></span><span class="h">Base</span><span class="h">Bonus/malus</span><span class="h">Modifiée</span>
    ${keys.map(k=>`<span class="k">${LABEL[k]}</span>${k==='pr'?`<span class="num" data-calc-base="pr">${base(h,'pr')}</span>`:`<input id="f-${k}" type="number" data-field="${k}" data-num="1" value="${n(h[k])}" aria-label="${LABEL[k]} de base">`}<span class="num" data-calc-mod="${k}">${mod(h,k)?sgn(mod(h,k)):'—'}</span><span class="calc" data-calc="${k}">${val(h,k)}</span>`).join('')}
  </div>`;
}
function delBlock(h,label){return `<div class="danger"><button type="button" class="btn" data-act="del" data-id="${esc(h.id)}">${label}</button><span class="hint">Un second clic confirme. La suppression est définitive.</span></div>`}
function heroBody(h){
  if(S.tab==='fiche')return `
    <div><h3>Identité</h3><div class="fields">
      ${field(h,'nom','Nom',{wide:true})}${field(h,'joueur','Joueur')}${field(h,'origine','Origine')}${field(h,'metier','Métier')}${field(h,'sexe','Sexe')}
      ${!h.metier?`<div class="wide" style="grid-column:1/-1"><button type="button" class="btn small primary" data-act="metier-open" data-id="${esc(h.id)}">Choisir un métier dans le livret</button> <span class="hint">Ajoute ses compétences, son EV et ses restrictions.</span></div>`:''}
      ${field(h,'niveau','Niveau',{num:1})}${field(h,'xp','Expérience',{num:1})}
      ${field(h,'signes','Signes particuliers',{area:1,rows:2})}
    </div></div>
    <div><h3>Caractéristiques</h3>${caracTable(h,['cou','int','cha','ad','fo','at','prd','pr'])}
      <p class="hint" style="margin-top:8px">La colonne « Bonus/malus » se remplit toute seule : bonus/malus de la carte, arme en main et protections portées. Tu ne touches qu'à la base. La PR de base inclut l'armure portée.</p></div>
    <div><h3>Énergie, protection, destin</h3><div class="fields">
      ${field(h,'evMax','EV max',{num:1})}${field(h,'ev','EV actuelle',{num:1})}${field(h,'eaMax','EA max (0 = pas de magie)',{num:1})}${field(h,'ea','EA actuelle',{num:1})}
      ${field(h,'prNat','PR naturelle hors armure',{num:1})}${field(h,'prMag','PR magique hors armure',{num:1})}${field(h,'rm','Résistance magique',{num:1})}
      ${field(h,'destinMax','Destin (départ)',{num:1})}${field(h,'destin','Destin restant',{num:1})}
    </div></div>`;
  if(S.tab==='comp'){
    const cols=[{k:'acquise',label:'Acquise',w:'40px',type:'check'},{k:'nom',label:'Compétence',w:'minmax(0,1.2fr)'},{k:'source',label:'Source',w:'minmax(0,.7fr)'},{k:'carac',label:'Carac.',w:'minmax(0,.6fr)'},{k:'desc',label:'Effet',w:'minmax(0,2fr)',area:1}];
    return `<div><h3>Compétences acquises</h3>${listHTML(h,'competences',cols,'Ajouter une compétence',c=>c.acquise)}</div>
      <div><h3>Disponibles à débloquer</h3><p class="hint" style="margin-bottom:8px">Coche une compétence quand le héros l'obtient : elle passe dans les acquises et devient cherchable dans les déclencheurs.</p>${listHTML(h,'competences',cols,'',c=>!c.acquise)}</div>`;
  }
  if(S.tab==='equip')return `
    <div class="bq cq">
      <div class="bq-row">
        <div class="grow"><label for="cq" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Chercher dans le catalogue d'équipement</label>
          <input id="cq" type="text" autocomplete="off" placeholder="Catalogue : tape une arme ou une protection (dague, bouclier, cotte…) puis Entrée" value="${esc(CQ.q)}" role="combobox" aria-controls="cq-res" aria-expanded="false"></div>
        <label for="cq-t">Type <select id="cq-t"><option value="" ${CQ.t===''?'selected':''}>Tout</option><option value="arme" ${CQ.t==='arme'?'selected':''}>Armes</option><option value="prot" ${CQ.t==='prot'?'selected':''}>Protections</option></select></label>
        <label for="cq-pay"><input type="checkbox" id="cq-pay" ${CQ.pay?'checked':''}> Payer avec son or <span class="num">(${n(h.or)} PO)</span></label>
      </div>
      <ul class="bq-res" id="cq-res" role="listbox" aria-label="Catalogue d'armes et de protections"></ul>
    </div>
    <div><h3>Richesses</h3><div class="fields">${field(h,'or','Or (PO)',{num:1})}${field(h,'argent','Argent (PA)',{num:1})}${field(h,'thritil','Lingots de thritil',{num:1})}${field(h,'berylium','Lingots de berylium',{num:1})}</div></div>
    <p class="hint">Écris les bonus et malus sous la forme <b>AT +1, AD −2</b> : ils s'appliquent aux caractéristiques tant que l'arme est en main ou la protection portée. Le reste du texte (« +2 contre les morts-vivants ») est simplement affiché. La PR des protections portées s'ajoute toute seule.</p>
    <div><h3>Armes</h3>${listHTML(h,'armes',[{k:'equipe',label:'En main',w:'44px',type:'check',def:true},{k:'nom',label:'Arme',w:'minmax(0,1.3fr)'},{k:'pi',label:'PI (dégâts)',w:'minmax(0,.6fr)'},{k:'bonus',label:'Bonus / malus (ex. AT +1, PRD −2)',w:'minmax(0,1.3fr)'},{k:'rup',label:'Rupture',w:'minmax(0,.5fr)'},{k:'note',label:'Note (jet, conditions…)',w:'minmax(0,1.2fr)'}],'Ajouter une arme à la main')}</div>
    <div><h3>Protections</h3>${listHTML(h,'protections',[{k:'porte',label:'Portée',w:'44px',type:'check',def:true},{k:'nom',label:'Pièce',w:'minmax(0,1.3fr)'},{k:'bonus',label:'Bonus / malus (ex. AD −1)',w:'minmax(0,1.1fr)'},{k:'prNat',label:'PR nat.',w:'minmax(0,.5fr)',num:1},{k:'prMag',label:'PR mag.',w:'minmax(0,.5fr)',num:1},{k:'note',label:'Note (localisation…)',w:'minmax(0,1.1fr)'}],'Ajouter une protection à la main')}
      <p class="hint" style="margin-top:6px">PR totale actuelle : <b class="num" data-calc="pr">${val(h,'pr')}</b>, dont <span data-calc-armor>${armorPR(h)}</span> venant des protections portées.</p></div>
    <div><h3>Sac et trucs</h3>
      <div class="poids-sum"><span data-calc-poids class="${n(h.chargeMax)&&sacPoids(h)>n(h.chargeMax)?'over':''}">${esc(poidsMsg(h))}</span>
        <label for="f-chargeMax">Charge max (kg) <input id="f-chargeMax" type="number" min="0" step="any" data-field="chargeMax" data-num="1" value="${n(h.chargeMax)}"></label></div>
      ${listHTML(h,'sac',[{k:'objet',label:'Objet',w:'minmax(0,1.4fr)'},{k:'qte',label:'Qté',w:'minmax(0,.4fr)',num:1},{k:'poids',label:'Poids unitaire (kg)',w:'minmax(0,.6fr)',num:1},{k:'note',label:'Note (charges, doses, effet)',w:'minmax(0,1.5fr)'}],'Ajouter un objet')}
      <p class="hint" style="margin-top:6px">Le poids compte ce qui est transporté dans le sac. Armes et protections portées ne sont pas comptées. Charge max à 0 : pas de limite.</p></div>`;
  if(S.tab==='rp'){
    const srcOpts=[...new Set([
      ...(h.competences||[]).filter(c=>c.acquise&&c.nom).map(c=>c.nom+(c.carac?` (${c.carac})`:'')),
      'COU','INT','CHA','AD','FO','Désir','Force','Faiblesse','Aime','Déteste','Tic','Secret','Background'])];
    return `
    <div><h3>Profil</h3><p class="hint" style="margin-bottom:8px">Des phrases courtes. Elles s'affichent en tête de colonne dans l'onglet Déclencheurs, et la recherche les lit aussi (taper « garde » trouve « Déteste : … garde … »).</p>
      <div class="fields prof">${field(h,'pitch','En une phrase',{wide:1})}${PROFILE.map(([k,l])=>field(h,k,k==='secret'?'Secret (pour le MJ seulement)':k==='desir'?'Ce qu\'il veut':k==='tic'?'Tic, habitude, signe distinctif':l,{area:1,rows:2,half:1})).join('')}</div></div>
    <div><h3>À garder en tête</h3><p class="hint" style="margin-bottom:8px">Tous les repères s'affichent sur la carte du héros, dans le bloc Rôleplay : traits, réflexes et contraintes à ne jamais oublier. Garde-les courts.</p>
      ${listHTML(h,'reperes',[{k:'texte',label:'Repère',w:'minmax(0,1fr)'}],'Ajouter un repère')}</div>
    <div><h3>Accroches et déclencheurs</h3><p class="hint" style="margin-bottom:8px">« Vient de » : la compétence, la caractéristique ou le trait de profil à l'origine de la réaction. Commence à taper pour voir les suggestions. Les mots-clés aident la recherche.</p>
      <datalist id="src-list">${srcOpts.map(o=>`<option value="${esc(o)}"></option>`).join('')}</datalist>
      ${listHTML(h,'accroches',[{k:'declencheur',label:'Si la scène contient…',w:'minmax(0,1fr)'},{k:'source',label:'Vient de',w:'minmax(0,.9fr)',dl:'src-list'},{k:'reaction',label:'Réaction, idée de scène',w:'minmax(0,1.7fr)',area:1},{k:'mots',label:'Mots-clés',w:'minmax(0,.8fr)'}],'Ajouter une accroche')}</div>
    <div><h3>Background complet</h3><div class="fields">${field(h,'background','Histoire du personnage',{area:1,rows:5})}</div></div>`;
  }
  return `<div class="fields">${field(h,'notes','Notes du MJ sur ce héros (secrets, intrigues, ce qui a fait rire le joueur)',{area:1,rows:8})}</div>${delBlock(h,'Supprimer ce héros')}`;
}
function foeBody(h){return `
  <div><h3>Identité</h3><div class="fields">
    ${field(h,'nom','Nom',{wide:true})}${field(h,'type','Type',{ph:'Gobelin, orque, bandit…'})}${field(h,'kind','Catégorie',{options:{ennemi:'Ennemi',pnj:'PNJ'}})}${field(h,'xpGain','XP rapportée',{num:1})}
  </div></div>
  <div><h3>Combat</h3><div class="fields">
    ${field(h,'evMax','EV max',{num:1})}${field(h,'ev','EV actuelle',{num:1})}${field(h,'degats','Dégâts',{ph:'1D+3'})}${field(h,'prNat','PR naturelle',{num:1})}${field(h,'prMag','PR magique',{num:1})}${field(h,'rm','Résistance magique',{num:1})}
  </div></div>
  <div><h3>Caractéristiques</h3>${caracTable(h,['at','prd','cou','pr'])}</div>
  <div class="fields">
    ${field(h,'capacites','Capacités spéciales (affichées sur la carte)',{area:1,rows:3})}
    ${field(h,'butin','Butin',{area:1,rows:2})}
  </div>
  ${delBlock(h,'Supprimer cet ennemi')}`}
function npcBody(h){return `
  <div><h3>Identité</h3><div class="fields">
    ${field(h,'nom','Nom',{wide:true})}${field(h,'role','Rôle',{ph:'Aubergiste, commanditaire…'})}${field(h,'lieu','Lieu')}
    ${field(h,'attitude','Attitude',{options:ATTITUDES,def:'neutre'})}${field(h,'kind','Catégorie',{options:{pnj:'PNJ',ennemi:'Ennemi'}})}
  </div></div>
  <div><h3>Origine, métier et caractéristiques</h3><div class="fields">${field(h,'origine','Origine')}${field(h,'metier','Métier')}
    ${!h.metier?`<div style="grid-column:1/-1"><button type="button" class="btn small" data-act="metier-open" data-id="${esc(h.id)}">Choisir un métier dans le livret</button></div>`:''}</div>
    <div style="margin-top:10px">${caracTable(h,['cou','int','cha','ad','fo'])}</div></div>
  <div><h3>Pour le jouer</h3><div class="fields">
    ${field(h,'voix','Voix, tic, phrase fétiche',{wide:true})}${field(h,'motivation','Ce qu\'il veut',{wide:true})}${field(h,'secret','Son secret',{wide:true})}
  </div></div>
  <div><h3>S'il se bat</h3><p class="hint" style="margin-bottom:8px">Laisse l'EV max à 0 pour un PNJ qui ne combat pas : la carte reste compacte.</p><div class="fields">
    ${field(h,'evMax','EV max',{num:1})}${field(h,'ev','EV actuelle',{num:1})}${field(h,'prNat','PR naturelle',{num:1})}${field(h,'prMag','PR magique',{num:1})}
  </div><div style="margin-top:10px">${caracTable(h,['at','prd'])}</div></div>
  <div><h3>Compétences</h3>${listHTML(h,'competences',COMPCOLS,'Ajouter une compétence')}</div>
  <div><h3>À garder en tête</h3>${listHTML(h,'reperes',[{k:'texte',label:'Repère',w:'minmax(0,1fr)'}],'Ajouter un repère')}</div>
  <div class="fields">${field(h,'notes','Notes',{area:1,rows:4})}</div>
  ${delBlock(h,'Supprimer ce PNJ')}`}
const CQ={q:'',t:'',pay:false,sel:0,res:[]};
const CAT=EQUIP.map((e,i)=>({...e,i,k:norm(e.nom),kc:norm(e.cat)}));
const LOCW=l=>{const x=norm(l);if(!x||x.includes(' ou '))return [];if(x.startsWith('toutes'))return ['tete','torse','bras','mains','jambes','pieds'];return ['tete','torse','bras','mains','jambes','pieds'].filter(w=>x.includes(w)||(w==='bras'&&x.includes('manches')))};
const isNainH=h=>/\bnain\b/i.test(h.origine||'');
const isSmallH=h=>/nain|gn[oô]me|semi-homme|semi-elfe|gobelin|hobbit/i.test(h.origine||'');
function fmtMods(m){return Object.entries(m).filter(([,v])=>v).map(([k,v])=>`${LABEL[k]||k.toUpperCase()} ${v>0?'+':'−'}${Math.abs(v)}`).join(', ')}
function effMods(e,h){const m={...e.mods};Object.entries((isNainH(h)?e.nain:e.sansNain)||{}).forEach(([k,v])=>m[k]=(m[k]||0)+v);return m}
function renderCq(){
  const ul=document.getElementById('cq-res');if(!ul)return;
  const h=S.heros[S.openId];if(!h)return;
  const q=norm(CQ.q.trim());
  let xs=CAT.filter(e=>!CQ.t||e.t===CQ.t);
  if(q){xs=xs.map(e=>{let sc=-1;if(e.k.startsWith(q))sc=0;else if(e.k.split(/[\s'’,-]+/).some(w=>w.startsWith(q)))sc=1;else if(e.k.includes(q))sc=2;else if(e.kc.includes(q))sc=3;return {e,sc}}).filter(x=>x.sc>=0).sort((a,b)=>a.sc-b.sc||a.e.i-b.e.i).map(x=>x.e)}
  else xs=[];
  CQ.res=xs.slice(0,60);if(CQ.sel>=CQ.res.length)CQ.sel=0;
  document.getElementById('cq').setAttribute('aria-expanded',String(CQ.res.length>0));
  if(!q){ul.innerHTML=`<li class="hint" style="padding:2px 4px">${CAT.filter(e=>e.t==='arme').length} armes et ${CAT.filter(e=>e.t==='prot').length} protections. Les bonus/malus sont adaptés à ${esc(h.nom||'ce héros')}${isNainH(h)?' (règles des nains)':''}.</li>`;return}
  if(!CQ.res.length){ul.innerHTML='<li class="hint" style="padding:2px 4px">Rien trouvé. Essaie un autre mot, ou ajoute l\'objet à la main plus bas.</li>';return}
  ul.innerHTML=CQ.res.map((e,j)=>{
    const m=effMods(e,h),pr=e.t==='prot'?n(e.prNat)+n(e.prMag):0;
    const warn=e.catnote&&/inutilisable/i.test(e.catnote)&&isSmallH(h)?'⚠ '+e.catnote:'';
    return `<li class="bq-item" role="option" id="cq-o-${j}" aria-selected="${j===CQ.sel}" data-act="cq-add" data-c="${e.i}">
      <span class="nm">${hl(e.nom,q)}</span>
      <span class="meta">${e.t==='arme'?'Arme':'Protection'} · ${esc(e.cat)} · ${/^\d/.test(e.prix)?esc(e.prix)+' PO':esc(e.prix)}${e.rup?` · rupture ${esc(e.rup)}`:''}</span>
      <span class="st">${e.t==='arme'?(e.pi?`<span>PI ${esc(e.pi)}</span>`:''):`<span>PR ${pr}${n(e.prMag)?` (dont ${e.prMag} mag.)`:''}</span>`}${fmtMods(m)?`<span>${esc(fmtMods(m))}</span>`:'<span>aucun modificateur</span>'}</span>
      ${e.note?`<span class="nt">${esc(e.note)}</span>`:''}
      ${warn?`<span class="adv">${esc(warn)}</span>`:''}
      <span class="add btn small">Ajouter</span>
    </li>`}).join('');
  const cur=document.getElementById('cq-o-'+CQ.sel);if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest'});
}
function addEquip(i){
  const e=EQUIP[i],h=S.heros[S.openId];if(!e||!h)return;
  const msgs=[];
  if(CQ.pay&&/^\d/.test(e.prix)){
    const price=parseFloat(String(e.prix).replace(',','.'));
    if(n(h.or)<price){toast(`${h.nom} n'a que ${n(h.or)} PO : ${e.nom} coûte ${e.prix} PO. Décoche « Payer » pour l'ajouter quand même.`);return}
    h.or=Math.round((n(h.or)-price)*100)/100;msgs.push(`−${e.prix} PO`);
  }
  const m=effMods(e,h),note=[e.note,isNainH(h)&&e.nain?'règles naines appliquées':''].filter(Boolean).join(' · ');
  if(e.t==='arme'){
    const hand=!(h.armes||[]).some(inHand);
    (h.armes=h.armes||[]).push({equipe:hand,nom:e.nom,pi:e.pi||'',bonus:fmtMods(m),rup:e.rup||'',note});
    msgs.push(hand?'en main':'rangée (une autre arme est en main)');
    if(e.catnote&&/inutilisable/i.test(e.catnote)&&isSmallH(h))msgs.push('attention : arme normalement inutilisable par les petites créatures');
  }else{
    const w=LOCW(e.loc),clash=(h.protections||[]).filter(p=>worn(p)&&p.loc&&LOCW(p.loc).some(x=>w.includes(x)));
    (h.protections=h.protections||[]).push({porte:true,nom:e.nom,bonus:fmtMods(m),prNat:n(e.prNat),prMag:n(e.prMag),note,loc:e.loc||''});
    if(clash.length)msgs.push(`déjà protégé à cet endroit par ${clash.map(p=>p.nom).join(', ')} : les armures ne s'empilent pas, range l'une des deux`);
  }
  CQ.q='';CQ.sel=0;save();renderDialog();renderPersos();
  toast(`${e.nom} ajouté à ${h.nom}${msgs.length?' : '+msgs.join(' · '):''}.`);
  const inp=document.getElementById('cq');if(inp)inp.focus();
}
function renderDialog(){
  const h=S.heros[S.openId];if(!h)return;
  const k=kindOf(h);
  $('#dh-name').textContent=h.nom||'Sans nom';
  $('#dh-sub').textContent=k==='heros'?[h.origine,h.metier,'niveau '+(n(h.niveau)||1)].filter(Boolean).join(' · '):k==='ennemi'?['Ennemi',h.type].filter(Boolean).join(' · '):['PNJ',h.role].filter(Boolean).join(' · ');
  $('#dh-tabs').innerHTML=k==='heros'?TABS.map(([t,l])=>`<button type="button" role="tab" data-act="tab" data-t="${t}" aria-selected="${S.tab===t}">${l}</button>`).join(''):'';
  $('#dh-body').innerHTML=k==='heros'?heroBody(h):k==='ennemi'?foeBody(h):npcBody(h);
  if(k==='heros'&&S.tab==='equip')renderCq();
}
function updateComputed(){
  const h=S.heros[S.openId];if(!h)return;
  document.querySelectorAll('[data-calc]').forEach(el=>el.textContent=val(h,el.dataset.calc));
  document.querySelectorAll('[data-calc-mod]').forEach(el=>{const m=mod(h,el.dataset.calcMod);el.textContent=m?sgn(m):'—'});
  document.querySelectorAll('[data-calc-base]').forEach(el=>el.textContent=base(h,'pr'));
  document.querySelectorAll('[data-calc-armor]').forEach(el=>el.textContent=armorPR(h));
  document.querySelectorAll('[data-calc-poids]').forEach(el=>{el.textContent=poidsMsg(h);el.classList.toggle('over',!!n(h.chargeMax)&&sacPoids(h)>n(h.chargeMax))});
  $('#dh-name').textContent=h.nom||'Sans nom';
}
function openSheet(id){S.openId=id;renderDialog();const d=$('#dlg-hero');if(!d.open)d.showModal()}

/* ---------- Bonus / malus ---------- */
function openEffet(targetId){
  const groups=[['heros','Héros'],['ennemi','Ennemis'],['pnj','PNJ']].map(([k,l])=>{
    const xs=list(k).filter(h=>!isOut(h)||h.id===targetId);if(!xs.length)return '';
    return `<span class="grp">${l}</span>`+xs.map(h=>`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="eff-c-${esc(h.id)}" value="${esc(h.id)}" ${h.id===targetId?'checked':''}> ${esc(h.nom||'Sans nom')}</label>`).join('');
  }).join('');
  $('#eff-cibles').innerHTML=groups;
  $('#eff-presets').innerHTML=PRESETS.map((p,i)=>`<button type="button" class="btn small" data-act="preset" data-i="${i}">${esc(p.nom)}</button>`).join('');
  $('#eff-mods').innerHTML=MODKEYS.map(k=>`<label for="eff-m-${k}">${LABEL[k]}<input id="eff-m-${k}" type="number" value="0"></label>`).join('');
  $('#eff-nom').value='';$('#eff-note').value='';
  $('#dlg-effet').showModal();
}

/* ---------- Assistant de création (livret des origines et métiers) ---------- */
const CARS=['cou','int','cha','ad','fo'];
const ORIGS=LIVRET.origines,METS=LIVRET.metiers,VARS=LIVRET.variantes;
const GLOS={};Object.entries(LIVRET.glossaire).forEach(([k,v])=>GLOS[k]=v);
const ALLCOMP=(()=>{const s=new Map();ORIGS.forEach(o=>[...o.nais,...o.choix].forEach(x=>s.set(norm(x),x)));VARS.forEach(v=>v.bonus.forEach(x=>s.set(norm(x),x)));METS.forEach(m=>[...m.her,...m.choix].forEach(x=>s.set(norm(x),x)));return [...s.values()].sort((a,b)=>a.localeCompare(b,'fr'))})();
const COMPCOLS=[{k:'acquise',label:'Acquise',w:'40px',type:'check'},{k:'nom',label:'Compétence',w:'minmax(0,1.2fr)'},{k:'source',label:'Source',w:'minmax(0,.7fr)'},{k:'carac',label:'Carac.',w:'minmax(0,.6fr)'},{k:'desc',label:'Effet',w:'minmax(0,2fr)',area:1}];
const oById=id=>ORIGS.find(o=>o.id===id)||null, mById=id=>METS.find(m=>m.id===id)||null, vById=id=>VARS.find(v=>v.id===id)||null;
function findOrigin(h){if(h.origineId)return oById(h.origineId);const x=norm(h.origine);if(!x)return null;
  const c=ORIGS.slice().sort((a,b)=>norm(b.nom).length-norm(a.nom).length);
  return c.find(o=>x.includes(norm(o.nom)))||c.find(o=>x.startsWith(norm(o.nom).split(' ').slice(0,2).join(' ')))||null}
const CR={open:false,mode:'create',kind:'heros',target:null,nom:'',joueur:'',role:'',origin:'',variant:'',metier:'',adjMoins:'',adjPlus:'',stats:{cou:10,int:10,cha:10,ad:10,fo:10},choix:new Set()};

function evFor(o,v,m,base){
  let ev=base!=null?base:(o?(o.id==='homme-bete'?(v?v.ev:0):o.ev):0);
  if(!m)return ev;const hum=o&&o.id==='humain';
  switch(m.ev){case 'plus5':return ev+5;case 'moins2':return ev-2;case 'mage':return hum?20:Math.round(ev*0.7);case 'paladin':return hum?32:ev+2;default:return ev}
}
function prMaxFor(o,m){let pr=o&&o.pr||0;if(m){if(m.id==='guerrier'){if(pr)pr+=1}else if(m.pr){pr=pr?Math.min(pr,m.pr):m.pr}}return pr}
function chargeFor(o,m){let c=o&&o.charge||0;if(m&&m.charge)c=c?Math.min(c,m.charge):m.charge;return c}
function criteria(o,m){
  const out=[];
  const push=(src,obj,type)=>Object.entries(obj||{}).forEach(([k,v])=>out.push({src,k,type,v}));
  if(o){push(o.nom,o.min,'min');push(o.nom,o.max,'max')}
  if(m)push(m.nom,m.min,'min');
  return out;
}
const critOk=(c,s)=>c.type==='min'?n(s[c.k])>=c.v:n(s[c.k])<=c.v;
function metierStatus(o,m,stats,choix){
  if(!m)return {ok:true};
  if(o&&o.interdits.includes(m.id))return {ok:false,ban:true,why:`interdit pour ${o.nom}`};
  if(o&&o.id==='sylvain'&&['mage','pretre','paladin'].includes(m.id)&&choix&&[...choix].some(c=>norm(c)==='tete vide'))return {ok:false,ban:true,why:'interdit avec Tête vide'};
  const ko=criteria(null,m).filter(c=>!critOk(c,stats));
  return ko.length?{ok:false,why:ko.map(c=>`${LABEL[c.k]} ${c.v} min.`).join(', ')}:{ok:true};
}
function choiceList(o,m,v){
  if(o&&o.id==='humain'&&!m)return ALLCOMP.filter(x=>norm(x)!=='appel du sauvage');
  const have=new Set([...(o?o.nais:[]),...(v?v.bonus:[]),...(m?m.her:[])].map(norm));
  const seen=new Set(),out=[];
  [...(o?o.choix:[]),...(m?m.choix:[]),...(o&&o.id==='humain'&&m?ALLCOMP.filter(x=>norm(x)!=='appel du sauvage'):[])].forEach(x=>{const k=norm(x);if(!have.has(k)&&!seen.has(k)){seen.add(k);out.push(x)}});
  return m&&m.id==='traine-patins'?out.filter(x=>norm(x)!=='erudition'):out;
}
const choiceTarget=(o,m)=>o&&o.id==='humain'?3:2;
function buildChar(){
  const o=oById(CR.origin),m=mById(CR.metier),v=o&&o.id==='homme-bete'?vById(CR.variant):null;
  const st={};CARS.forEach(k=>st[k]=n(CR.stats[k])+n(v&&v.mods[k]));
  let at=m&&m.at!=null?m.at:(o?o.at:8),prd=m&&m.prd!=null?m.prd:(o?o.prd:10);
  if(m&&m.adj){
    if(m.adj.moins&&CR.adjMoins==='at')at--;if(m.adj.moins&&CR.adjMoins==='prd')prd--;
    if(CR.adjPlus==='at'&&m.adj.plus.includes('at'))at++;else if(CR.adjPlus==='prd'&&m.adj.plus.includes('prd'))prd++;
    else if(CR.adjPlus&&m.adj.plus.includes(CR.adjPlus)&&CARS.includes(CR.adjPlus))st[CR.adjPlus]++;
  }
  const ev=evFor(o,v,m),ea=m&&m.ea||0,charge=chargeFor(o,m),pr=prMaxFor(o,m);
  const comps=[];
  const add=(nom,acq,src)=>{const k=norm(nom);const c=comps.find(x=>norm(x.nom)===k);if(c){if(acq)c.acquise=true;if(!c.source.split(' · ').includes(src))c.source+=' · '+src;return}
    const g=GLOS[k]||GLOS[norm(nom.replace(/\s*\+\s*$/,''))]||{};comps.push({acquise:acq,nom,source:src,carac:g.carac||'',desc:g.desc||''})};
  if(o)o.nais.forEach(x=>add(x,true,'Origine'));
  if(v)v.bonus.forEach(x=>add(x,true,v.nom));
  if(m)m.her.forEach(x=>add(x,true,'Métier'));
  const pool=choiceList(o,m,v);
  pool.forEach(x=>{const fromO=o&&o.choix.some(y=>norm(y)===norm(x)),fromM=m&&m.choix.some(y=>norm(y)===norm(x));
    const chosen=[...CR.choix].some(y=>norm(y)===norm(x));
    if(chosen)add(x,true,fromO?'Origine (au choix)':fromM?'Métier (au choix)':'Au choix');
    else if(fromO||fromM)add(x,false,fromO?'Origine (au choix)':'Métier (au choix)');});
  const rep=[];const r=t=>{if(t&&!rep.includes(t))rep.push(t)};
  if(charge)r(`Charge max ${charge} kg`);if(pr)r(`PR max ${pr} (sauf magique)`);
  if(o)o.restr.forEach(r);if(v)v.notes.forEach(r);if(m)m.restr.forEach(r);if(o)o.notes.forEach(r);if(m)m.notes.forEach(r);
  if(o&&o.evPlus)r(o.evPlus.replace('+1D4 EV par niveau','EV : +1D4 par niveau'));
  const warn=[];
  criteria(o,null).filter(c=>!critOk(c,CR.stats)).forEach(c=>warn.push(`${o.nom} demande ${LABEL[c.k]} ${c.type==='min'?'≥':'≤'} ${c.v} (tiré : ${n(CR.stats[c.k])})`));
  const ms=metierStatus(o,m,CR.stats,CR.choix);if(m&&!ms.ok)warn.push(`${m.nom} : ${ms.why}`);
  if(m&&m.id==='traine-patins'&&o&&o.nais.some(x=>norm(x)==='erudition'))warn.push(`Traîne-patins ne sait pas lire : Érudition (${o.nom}) est en conflit, à trancher`);
  if(o&&o.id==='homme-bete'&&!v)warn.push('Choisis la version d\'homme-bête (ou tire-la au D6)');
  if(m&&m.adj&&((m.adj.moins&&!CR.adjMoins)||!CR.adjPlus))warn.push(`${m.adj.label} : fais ton choix`);
  const target=choiceTarget(o,m),nb=CR.choix.size;
  if(o&&nb!==target)warn.push(`Compétences au choix : ${nb} sur ${target}`);
  return {o,v,m,st,at,prd,ev,ea,charge,pr,comps,rep,warn,target,nb,
    origine:o?(o.id==='homme-bete'&&v?`${o.nom} (${v.nom})`:o.nom):'',metier:m?m.nom:''};
}
function rollStats(){
  const o=oById(CR.origin),m=mById(CR.metier),cr=criteria(o,m);let s;
  for(let t=0;t<4000;t++){s={};CARS.forEach(k=>s[k]=8+Math.floor(Math.random()*6));if(cr.every(c=>critOk(c,s)))return {s,ok:true}}
  return {s,ok:false};
}

/* ----- rendu ----- */
function crOriginCard(o,v){
  if(!o)return '';
  const cr=criteria(o,null);
  return `<div class="cr-card">
    <div class="cr-line"><b>${esc(o.nom)}</b> <span class="hint">${esc(o.sous)}</span></div>
    <div class="cr-line num">EV ${o.id==='homme-bete'?(v?v.ev:'selon version'):o.ev}${o.evPlus?` (${esc(o.evPlus)})`:''} · AT ${o.at} · PRD ${o.prd}${o.charge?` · charge ${o.charge} kg`:''}${o.pr?` · PR max ${o.pr}`:''}</div>
    ${cr.length?`<div class="cr-line">${cr.map(c=>`<span class="crit ${critOk(c,CR.stats)?'ok':'ko'}">${LABEL[c.k]} ${c.type==='min'?'min.':'max.'} ${c.v}</span>`).join(' ')}</div>`:'<div class="cr-line hint">Aucun critère : tout le monde peut la choisir.</div>'}
    ${o.restr.length?`<ul class="cr-ul">${o.restr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    ${o.nais.length?`<div class="cr-line"><span class="eh">De naissance</span> ${o.nais.map(x=>`<span class="skill static">${esc(x)}</span>`).join(' ')}</div>`:''}
    ${v?`<div class="cr-line"><span class="eh">${esc(v.nom)}</span> ${Object.entries(v.mods).map(([k,x])=>`<span class="mod ${x>0?'up':'down'}">${LABEL[k]} ${sgn(x)}</span>`).join(' ')} ${v.bonus.map(x=>`<span class="skill static">${esc(x)}</span>`).join(' ')} ${v.notes.map(esc).join(' · ')}</div>`:''}
  </div>`;
}
function crMetierCard(m,o){
  if(!m)return '';
  const ms=metierStatus(o,m,CR.stats,CR.choix);
  const evTxt={plus5:'EV de l\'origine +5',moins2:'EV de l\'origine −2',mage:'EV 20 (humain) ou EV de l\'origine −30 %',paladin:'EV 32 (humain) ou EV de l\'origine +2'}[m.ev]||'EV selon l\'origine';
  return `<div class="cr-card ${ms.ban?'ban':''}">
    <div class="cr-line"><b>${esc(m.nom)}</b> ${ms.ok?'<span class="crit ok">compatible</span>':`<span class="crit ko">${esc(ms.why)}</span>`}</div>
    <div class="cr-line num">${evTxt}${m.at!=null?` · AT ${m.at} / PRD ${m.prd}`:''}${m.ea?` · EA ${m.ea}`:''}${m.id==='guerrier'?' · PR max de l\'origine +1':m.pr?` · PR max ${m.pr}`:''}${m.charge?` · charge max ${m.charge} kg`:''}</div>
    ${Object.keys(m.min).length?`<div class="cr-line">${criteria(null,m).map(c=>`<span class="crit ${critOk(c,CR.stats)?'ok':'ko'}">${LABEL[c.k]} min. ${c.v}</span>`).join(' ')}</div>`:''}
    ${m.restr.length?`<ul class="cr-ul">${m.restr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    <div class="cr-line"><span class="eh">Héritées</span> ${m.her.map(x=>`<span class="skill static">${esc(x)}</span>`).join(' ')}</div>
    ${m.adj?`<div class="cr-line cr-adj"><span class="eh">${esc(m.adj.label)}</span>
      ${m.adj.moins?`<span>−1 en ${m.adj.moins.map(k=>`<label><input type="radio" name="cr-adjm" value="${k}" ${CR.adjMoins===k?'checked':''}> ${LABEL[k]}</label>`).join(' ')}</span>`:''}
      <span>+1 en ${m.adj.plus.map(k=>`<label><input type="radio" name="cr-adjp" value="${k}" ${CR.adjPlus===k?'checked':''}> ${LABEL[k]}</label>`).join(' ')}</span></div>`:''}
    ${m.notes.length?`<div class="cr-line hint">${m.notes.map(esc).join(' · ')}</div>`:''}
  </div>`;
}
function crRender(){
  const meta=CR.mode==='metier';
  const h=meta?S.heros[CR.target]:null;
  const o=oById(CR.origin),m=mById(CR.metier),v=o&&o.id==='homme-bete'?vById(CR.variant):null;
  $('#cr-t').textContent=meta?`Choisir un métier`:CR.kind==='pnj'?'Nouveau PNJ':'Nouveau héros';
  $('#cr-sub').textContent=meta?`${h.nom}${h.origine?' · '+h.origine:''}`:'Origine, caractéristiques et métier d\'après le livret officiel';
  const crit=criteria(o,m);
  const metOpts=crMetOpts(o);const _unused=METS.map(x=>{const s=metierStatus(o,x,CR.stats,CR.choix);return `<option value="${x.id}" ${CR.metier===x.id?'selected':''}>${s.ok?'':s.ban?'⛔ ':'⚠ '}${esc(x.nom)}${s.ok?'':' ('+esc(s.why)+')'}</option>`}).join('');
  const pool=choiceList(o,m,v),target=choiceTarget(o,m);
  $('#cr-body').innerHTML=`
  ${meta?'':`<section class="cr-sec"><h3>1. Identité</h3><div class="fields">
      <label for="cr-nom" class="wide">Nom<input id="cr-nom" type="text" value="${esc(CR.nom)}" placeholder="${CR.kind==='pnj'?'Nom du PNJ':'Nom du héros'}"></label>
      ${CR.kind==='pnj'?`<label for="cr-role">Rôle<input id="cr-role" type="text" value="${esc(CR.role)}" placeholder="Aubergiste, garde…"></label>`:`<label for="cr-joueur">Joueur<input id="cr-joueur" type="text" value="${esc(CR.joueur)}"></label>`}
    </div></section>
  <section class="cr-sec"><h3>2. Origine</h3>
    <div class="bq-row"><label for="cr-origin" class="grow lbl-col">Origine
      <select id="cr-origin"><option value="">${CR.kind==='pnj'?'Sans origine (PNJ simple)':'— Choisir une origine —'}</option>${ORIGS.map(x=>`<option value="${x.id}" ${CR.origin===x.id?'selected':''}>${esc(x.nom)}</option>`).join('')}</select></label>
      ${o&&o.id==='homme-bete'?`<label for="cr-variant" class="lbl-col">Version<select id="cr-variant"><option value="">— Version —</option>${VARS.map((x,i)=>`<option value="${x.id}" ${CR.variant===x.id?'selected':''}>${i+1}. ${esc(x.nom)}</option>`).join('')}</select></label><button type="button" class="btn small" data-act="cr-d6">Tirer au D6</button>`:''}
    </div>
    <div id="cr-ocard">${crOriginCard(o,v)}</div>
  </section>
  <section class="cr-sec"><h3>3. Caractéristiques tirées</h3>
    <p class="hint">Saisis les valeurs tirées aux dés (1D6 + 7 pour chacune), ou laisse l'écran tirer pour un PNJ. ${v?'Les modificateurs de la version d\'homme-bête s\'ajoutent ensuite.':''}</p>
    <div class="cr-stats">${CARS.map(k=>{const cs=crit.filter(c=>c.k===k);const bad=cs.some(c=>!critOk(c,CR.stats));
      return `<label for="cr-${k}" class="cr-stat ${bad?'bad':''}"><span>${LABEL[k]}</span><input id="cr-${k}" type="number" min="1" max="20" value="${n(CR.stats[k])}">
        <small>${cs.map(c=>`${c.type==='min'?'min.':'max.'} ${c.v}`).join(' · ')||'&nbsp;'}</small></label>`}).join('')}</div>
    <div><button type="button" class="btn small" data-act="cr-roll">Tirer au hasard${o||m?' (en respectant les critères)':''}</button></div>
  </section>`}
  <section class="cr-sec"><h3>${meta?'Métier':'4. Métier'}</h3>
    <label for="cr-metier" class="lbl-col">Métier<select id="cr-metier"><option value="">${meta?'— Choisir un métier —':'Sans métier (à choisir plus tard)'}</option>${metOpts}</select></label>
    <div id="cr-mcard">${crMetierCard(m,o)}</div>
  </section>
  ${pool.length?`<section class="cr-sec"><h3>${meta?'Compétences au choix du métier':'5. Compétences au choix'} <span class="cr-count ${CR.choix.size===target||meta?'':'ko'}">${CR.choix.size}${meta?'':' / '+target}</span></h3>
    <p class="hint">${o&&o.id==='humain'?(m?'Humain avec métier : 2 compétences du métier + 1 au choix parmi toutes.':'Humain sans métier : 3 compétences au choix parmi toutes (sauf Appel du sauvage).'):meta?'Coche celles que le personnage obtient maintenant ; les autres restent à débloquer.':'Le livret en accorde 2, à prendre dans l\'origine, le métier, ou les deux. Les autres restent à débloquer.'}</p>
    <div class="cr-choices">${pool.map(x=>{const id='cr-c-'+norm(x).replace(/ /g,'-');const g=GLOS[norm(x)];return `<label for="${id}" title="${esc(g?g.desc:'')}"><input type="checkbox" id="${id}" data-choix="${esc(x)}" ${[...CR.choix].some(y=>norm(y)===norm(x))?'checked':''}> ${esc(x)}</label>`}).join('')}</div>
  </section>`:''}`;
  crSummary();
}
function crMetOpts(o){return METS.map(x=>{const s=metierStatus(o,x,CR.stats,CR.choix);return `<option value="${x.id}" ${CR.metier===x.id?'selected':''}>${s.ok?'':s.ban?'⛔ ':'⚠ '}${esc(x.nom)}${s.ok?'':' ('+esc(s.why)+')'}</option>`}).join('')}
function crRefreshDeps(){
  const o=oById(CR.origin),m=mById(CR.metier),v=o&&o.id==='homme-bete'?vById(CR.variant):null;
  const oc=$('#cr-ocard');if(oc)oc.innerHTML=crOriginCard(o,v);
  const mc=$('#cr-mcard');if(mc)mc.innerHTML=crMetierCard(m,o);
  const sel=$('#cr-metier');if(sel&&CR.mode!=='metier'){sel.innerHTML=`<option value="">Sans métier (à choisir plus tard)</option>${crMetOpts(o)}`;sel.value=CR.metier}
  const crit=criteria(o,m);
  CARS.forEach(k=>{const el=document.getElementById('cr-'+k);if(!el)return;const cs=crit.filter(c=>c.k===k);el.closest('.cr-stat').classList.toggle('bad',cs.some(c=>!critOk(c,CR.stats)))});
  crSummary();
}
function crSummary(){
  const meta=CR.mode==='metier';const b=meta?null:buildChar();
  if(meta){
    const h=S.heros[CR.target],m=mById(CR.metier);
    $('#cr-foot').innerHTML=`<div class="cr-res">${m?esc(metierPreview(h,m)):'<span class="hint">Choisis un métier pour voir ce qui change.</span>'}</div>
      <div class="actions-row"><button type="button" class="btn" data-act="cr-close">Annuler</button><button type="button" class="btn primary" data-act="cr-apply" ${m?'':'disabled'}>Appliquer le métier</button></div>`;
    return;
  }
  const st=CARS.map(k=>`${LABEL[k]} ${b.st[k]}`).join(' · ');
  $('#cr-foot').innerHTML=`<div class="cr-res">
      <div class="num"><b>EV ${b.ev||'?'}</b> · AT ${b.at} · PRD ${b.prd}${b.ea?` · EA ${b.ea}`:''}${b.charge?` · ${b.charge} kg`:''}${b.pr?` · PR max ${b.pr}`:''}</div>
      <div class="num hint">${st}</div>
      ${b.warn.length?`<div class="cr-warn">${b.warn.map(esc).join(' · ')}</div>`:''}
    </div>
    <div class="actions-row">
      <button type="button" class="btn quiet" data-act="cr-blank">Fiche vierge</button>
      <button type="button" class="btn" data-act="cr-close">Annuler</button>
      <button type="button" class="btn primary" data-act="cr-create">${CR.kind==='pnj'?'Créer le PNJ':'Créer le héros'}</button>
    </div>`;
}
function metierPreview(h,m){
  const o=findOrigin(h),v=o&&o.id==='homme-bete'?vById(h.varianteId):null;
  const base=n(h.evMax),evNew=o?evFor(o,v,m,base):evFor({id:''},null,m,base);
  const parts=[`EV ${base} → ${evNew}`];
  if(m.at!=null)parts.push(`AT/PRD ${val(h,'at')}/${val(h,'prd')} → ${m.at}/${m.prd}`);
  if(m.ea&&!n(h.eaMax))parts.push(`EA ${m.ea}`);
  parts.push(`${m.her.length} compétences héritées`);
  if(!o&&h.origine)parts.push(`origine « ${h.origine} » inconnue du livret : critères non vérifiés`);
  return parts.join(' · ');
}
function openCreate(kind){
  Object.assign(CR,{open:true,mode:'create',kind,target:null,nom:'',joueur:'',role:'',origin:'',variant:'',metier:'',adjMoins:'',adjPlus:'',stats:{cou:10,int:10,cha:10,ad:10,fo:10}});CR.choix=new Set();
  crRender();$('#dlg-create').showModal();setTimeout(()=>{const f=$('#cr-nom');if(f)f.focus()},30);
}
function openMetier(id){
  const h=S.heros[id];if(!h)return;const o=findOrigin(h);
  Object.assign(CR,{open:true,mode:'metier',kind:kindOf(h),target:id,origin:o?o.id:'',variant:h.varianteId||'',metier:'',adjMoins:'',adjPlus:'',stats:Object.fromEntries(CARS.map(k=>[k,n(h[k])]))});CR.choix=new Set();
  crRender();$('#dlg-create').showModal();setTimeout(()=>{const f=$('#cr-metier');if(f)f.focus()},30);
}
function crCreate(){
  const b=buildChar();
  if(!b.o&&CR.kind==='heros'){toast('Choisis une origine, ou utilise « Fiche vierge ».');$('#cr-origin').focus();return}
  const nid=CR.kind+'-'+rid(),h={...blank(CR.kind),id:nid};
  h.nom=CR.nom.trim()||(CR.kind==='pnj'?'Nouveau PNJ':'Nouveau héros');
  if(CR.kind==='pnj')h.role=CR.role.trim();else h.joueur=CR.joueur.trim();
  if(b.o){
    Object.assign(h,{origine:b.origine,origineId:b.o.id,varianteId:b.v?b.v.id:'',metier:b.metier,metierId:b.m?b.m.id:'',
      evMax:b.ev,ev:b.ev,at:b.at,prd:b.prd,eaMax:b.ea,ea:b.ea,chargeMax:b.charge,competences:b.comps,reperes:b.rep.map(t=>({texte:t}))});
    CARS.forEach(k=>h[k]=b.st[k]);
  }
  S.heros[nid]=h;save();$('#dlg-create').close();renderAll();
  toast(`${h.nom} est créé${b.warn.length?' (à vérifier : '+b.warn.length+' point'+(b.warn.length>1?'s':'')+')':''}.`);
  S.tab='fiche';openSheet(nid);
}
function crApplyMetier(){
  const h=S.heros[CR.target],m=mById(CR.metier);if(!h||!m)return;
  const o=findOrigin(h),v=o&&o.id==='homme-bete'?vById(h.varianteId):null;
  const base=n(h.evMax),evNew=o?evFor(o,v,m,base):evFor({id:''},null,m,base),d=evNew-base;
  h.evMax=base+d;h.ev=n(h.ev)+d;
  if(m.at!=null){h.at=m.at;h.prd=m.prd}
  if(m.adj){if(CR.adjMoins)h[CR.adjMoins]=n(h[CR.adjMoins])-1;if(CR.adjPlus)h[CR.adjPlus]=n(h[CR.adjPlus])+1}
  if(m.ea&&!n(h.eaMax)){h.eaMax=m.ea;h.ea=m.ea}
  if(m.charge)h.chargeMax=n(h.chargeMax)?Math.min(n(h.chargeMax),m.charge):m.charge;
  h.competences=h.competences||[];
  const add=(nom,acq,src)=>{const c=h.competences.find(x=>norm(x.nom)===norm(nom));const g=GLOS[norm(nom)]||{};
    if(c){if(acq)c.acquise=true;if(!String(c.source||'').includes('Métier'))c.source=(c.source?c.source+' · ':'')+src;return}
    h.competences.push({acquise:acq,nom,source:src,carac:g.carac||'',desc:g.desc||''})};
  m.her.forEach(x=>add(x,true,'Métier'));
  m.choix.forEach(x=>add(x,[...CR.choix].some(y=>norm(y)===norm(x)),'Métier (au choix)'));
  h.reperes=h.reperes||[];
  const pr=prMaxFor(o,m);
  if(pr){const i=h.reperes.findIndex(r=>/^PR max/i.test(r.texte||''));const t=`PR max ${pr} (sauf magique)`;if(i>=0)h.reperes[i].texte=t;else h.reperes.unshift({texte:t})}
  [...m.restr,...m.notes].forEach(t=>{if(!h.reperes.some(r=>r.texte===t))h.reperes.push({texte:t})});
  h.metier=m.nom;h.metierId=m.id;
  save();$('#dlg-create').close();renderAll();if($('#dlg-hero').open&&S.openId===h.id)renderDialog();
  toast(`${h.nom} devient ${m.nom}${d?` (EV ${d>0?'+':''}${d})`:''}.`);
}
function crPick(){CR.choix=new Set([...document.querySelectorAll('#cr-body [data-choix]:checked')].map(i=>i.dataset.choix))}

/* ---------- Création ---------- */
function nextOrdre(){return Object.values(S.heros).reduce((m,x)=>Math.max(m,n(x.ordre)),0)+1}
function blank(kind){
  const common={kind,ordre:nextOrdre(),effets:[],notes:''};
  if(kind==='ennemi')return {...common,nom:'Nouvel ennemi',type:'',evMax:10,ev:10,at:8,prd:6,cou:10,prNat:0,prMag:0,rm:0,degats:'1D+2',xpGain:0,capacites:'',butin:''};
  if(kind==='pnj')return {...common,nom:'Nouveau PNJ',role:'',lieu:'',attitude:'neutre',voix:'',motivation:'',secret:'',evMax:0,ev:0,at:0,prd:0,cou:0,prNat:0,prMag:0};
  return {...common,nom:'Nouveau héros',joueur:'',origine:'',metier:'',sexe:'',signes:'',niveau:1,xp:0,cou:10,int:10,cha:10,ad:10,fo:10,at:8,prd:10,rm:10,evMax:20,ev:20,eaMax:0,ea:0,prNat:0,prMag:0,destin:0,destinMax:0,chargeMax:0,or:0,argent:0,thritil:0,berylium:0,armes:[],protections:[],sac:[],competences:[],reperes:[],accroches:[],background:''};
}
function nextName(nom){
  const m=String(nom||'').match(/^(.*?)(\s*)(\d+)$/);
  const stem=m?m[1]:String(nom||'Ennemi');
  let i=m?n(m[3])+1:2;
  const names=new Set(Object.values(S.heros).map(h=>h.nom));
  while(names.has(`${stem} ${i}`))i++;
  return `${stem} ${i}`;
}

/* ---------- Vues ---------- */
function setView(v){
  S.view=v;
  MJ_VIEWS.forEach(k=>$('#v-'+k).hidden=k!==v);
  document.querySelectorAll('.views button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.v===v)));
  try{localStorage.setItem('mj-view',v)}catch(e){}
}
function renderAll(){
  renderPersos();renderTriggers();renderJournal();
  const dlg=$('#dlg-hero');
  if(dlg.open){if(!S.heros[S.openId])dlg.close();else renderDialog()}
}

/* ---------- Clics ---------- */
const armed=new WeakMap();
function confirmClick(btn,label){
  if(btn.dataset.armed==='1'){btn.dataset.armed='0';return true}
  btn.dataset.armed='1';const old=btn.textContent;btn.textContent=label;
  clearTimeout(armed.get(btn));
  armed.set(btn,setTimeout(()=>{if(btn.isConnected){btn.dataset.armed='0';btn.textContent=old}},3000));
  return false;
}
const cut=t=>{t=String(t||'').trim();return t.length>70?t.slice(0,68)+'…':t};
const ROWDEL={
  competences:{title:'Supprimer la compétence ?',done:'Compétence supprimée',name:r=>cut(r.nom),msg:(r,l,h)=>`« ${l||'Compétence sans nom'} » sera supprimée de la fiche de ${h.nom}.`,tip:'Si le héros perd seulement l\'usage de la compétence, décoche plutôt « Acquise » : elle restera dans la liste à débloquer.'},
  armes:{title:'Supprimer l\'arme ?',done:'Arme supprimée',name:r=>cut(r.nom),msg:(r,l,h)=>`« ${l||'Arme sans nom'} » sera retirée de l'équipement de ${h.nom}.`,tip:'Pour la garder sans que ses bonus comptent, décoche plutôt « En main ».'},
  protections:{title:'Supprimer la protection ?',done:'Protection supprimée',name:r=>cut(r.nom),msg:(r,l,h)=>`« ${l||'Protection sans nom'} » sera retirée de l'équipement de ${h.nom}.`,tip:'Pour la garder sans que sa PR et ses bonus comptent, décoche plutôt « Portée ».'},
  sac:{title:'Supprimer l\'objet ?',done:'Objet retiré du sac',name:r=>cut(r.objet),msg:(r,l,h)=>`« ${l||'Objet sans nom'} »${qteOf(r)>1?` (×${qteOf(r)})`:''} sera retiré du sac de ${h.nom}.`,tip:''},
  reperes:{title:'Supprimer le repère ?',done:'Repère supprimé',name:r=>cut(r.texte),msg:(r,l,h)=>`Le repère « ${l} » ne s'affichera plus sur la carte de ${h.nom}.`,tip:''},
  accroches:{title:'Supprimer le déclencheur ?',done:'Déclencheur supprimé',name:r=>cut(r.declencheur||r.reaction),msg:(r,l,h)=>`Le déclencheur « ${l} » sera supprimé de la fiche de ${h.nom} et de l'onglet Déclencheurs.`,tip:''},
  _:{title:'Supprimer cette ligne ?',done:'Ligne supprimée',name:r=>'',msg:()=>'Cette ligne sera supprimée.',tip:''}
};
let pendingConfirm=null;
function askConfirm(title,msg,tip,fn){
  const d=$('#dlg-confirm');
  $('#cf-t').textContent=title;$('#cf-msg').textContent=msg;
  const t=$('#cf-tip');t.textContent=tip||'';t.hidden=!tip;
  pendingConfirm=fn;d.returnValue='';
  if(!d.open)d.showModal();
  $('#cf-cancel').focus();
}
$('#dlg-confirm').addEventListener('close',()=>{const fn=pendingConfirm;pendingConfirm=null;if($('#dlg-confirm').returnValue==='ok'&&fn)fn()});
function applyXp(id,sign){
  const h=S.heros[id],inp=document.getElementById('xp-'+id);if(!h||!inp)return;
  let v=Math.round(n(inp.value));if(!v){inp.focus();return}
  if(sign)v=Math.abs(v)*sign;
  const before=n(h.xp),after=Math.max(0,before+v);
  h.xp=after;save();renderPersos();
  toast(`${h.nom} : ${v>0?'+':'−'}${Math.abs(after-before)} XP (total ${after})${before+v<0?'. L\'XP ne descend pas sous 0':''}.`);
  const again=document.getElementById('xp-'+id);if(again)again.focus({preventScroll:true});
}
function applyHit(id){
  const h=S.heros[id],inp=document.getElementById('dmg-'+id);if(!h||!inp)return;
  const v=Math.round(n(inp.value));if(!v){inp.focus();return}
  const wasUp=!isOut(h);
  h.ev=n(h.ev)-v;save();renderPersos();
  if(wasUp&&isOut(h))toast(kindOf(h)==='ennemi'?`${h.nom} est mort.${n(h.xpGain)?` +${n(h.xpGain)} XP à répartir.`:''}`:`${h.nom} est à terre.`);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,id=b.dataset.id,h=id?S.heros[id]:null;
  switch(act){
    case 'view':setView(b.dataset.v);break;
    case 'ev':case 'ea':{
      if(!h)break;const max=n(h[act+'Max']),wasUp=!isOut(h);
      h[act]=Math.min(max||999,n(h[act])+n(b.dataset.d));
      save();renderPersos();
      if(act==='ev'&&wasUp&&isOut(h)&&kindOf(h)==='ennemi')toast(`${h.nom} est mort.${n(h.xpGain)?` +${n(h.xpGain)} XP à répartir.`:''}`);
      break;}
    case 'hit':applyHit(id);break;
    case 'cr-close':$('#dlg-create').close();break;
    case 'cr-create':crCreate();break;
    case 'cr-apply':crApplyMetier();break;
    case 'cr-blank':{const kind=CR.kind,nid=kind+'-'+rid();$('#dlg-create').close();
      S.heros[nid]={...blank(kind),id:nid,nom:CR.nom.trim()||blank(kind).nom};save();renderAll();S.tab='fiche';openSheet(nid);
      setTimeout(()=>{const f=$('#f-nom');if(f){f.focus();f.select()}},50);break;}
    case 'cr-roll':{const r=rollStats();CR.stats=r.s;CARS.forEach(k=>{const el=document.getElementById('cr-'+k);if(el)el.value=r.s[k]});crRefreshDeps();toast(r.ok?'Caractéristiques tirées (1D6 + 7), critères respectés.':'Aucun tirage ne respecte tous les critères : vérifie l\'origine et le métier.');break;}
    case 'cr-d6':{const i=Math.floor(Math.random()*6);CR.variant=VARS[i].id;crRerender();toast(`D6 : ${i+1}, ${VARS[i].nom}.`);break;}
    case 'metier-open':openMetier(id);break;
    case 'bq-add':addFromBest(n(b.dataset.b));break;
    case 'cq-add':addEquip(n(b.dataset.c));break;
    case 'skill':{const i=n(b.dataset.i);openSkill[id]=openSkill[id]===i?null:i;renderPersos();break;}
    case 'cardview':{const k=b.dataset.k;CARDVIEW[k]=!CARDVIEW[k];try{localStorage.setItem('mj-card-view',JSON.stringify(CARDVIEW))}catch(e){}renderPersos();break;}
    case 'equip':{
      if(!h)break;const a=(h.armes||[])[n(b.dataset.i)];if(!a)break;
      a.equipe=!inHand(a);save();renderPersos();
      toast(`${a.nom||'Arme'} ${a.equipe?'en main':'rangée'}${Object.keys(parseMods(a.bonus)).length?' : caractéristiques recalculées':''}.`);break;}
    case 'xp':applyXp(id,n(b.dataset.sign)||1);break;
    case 'destin':{
      if(!h)break;const i=n(b.dataset.i),spend=i<n(h.destin);
      h.destin=spend?i:i+1;
      if(n(h.destinMax)<n(h.destin))h.destinMax=h.destin;
      save();renderPersos();
      toast(spend?`${h.nom} dépense un point de destin. Il en reste ${n(h.destin)}.`:`${h.nom} récupère un point de destin.`);
      break;}
    case 'hero-open':S.tab='fiche';openSheet(id);break;
    case 'hero-close':clearTimeout(lazyT);$('#dlg-hero').close();S.openId=null;renderPersos();renderTriggers();break;
    case 'tab':S.tab=b.dataset.t;renderDialog();break;
    case 'add':{
      const kind=b.dataset.kind;
      if(kind==='heros'||kind==='pnj'){openCreate(kind);break}
      const nid=kind+'-'+rid();
      S.heros[nid]={...blank(kind),id:nid};save();renderAll();S.tab='fiche';openSheet(nid);
      setTimeout(()=>{const f=$('#f-nom');if(f){f.focus();f.select()}},50);
      break;}
    case 'dup':{
      if(!h)break;const nid='ennemi-'+rid();
      S.heros[nid]={...clone(h),id:nid,nom:nextName(h.nom),ev:n(h.evMax),effets:[],ordre:nextOrdre()};
      save();renderPersos();toast(`${S.heros[nid].nom} rejoint le combat.`);break;}
    case 'del':{
      if(!h||!confirmClick(b,'Confirmer'))break;
      const name=h.nom;delete S.heros[id];save();
      if($('#dlg-hero').open&&S.openId===id)$('#dlg-hero').close();
      renderAll();toast(`${name||'Le personnage'} a été supprimé.`);break;}
    case 'clear-dead':{
      if(!confirmClick(b,'Confirmer'))break;
      const dead=list('ennemi').filter(isOut);dead.forEach(x=>delete S.heros[x.id]);
      save();renderPersos();toast(`${dead.length} ennemi${dead.length>1?'s':''} retiré${dead.length>1?'s':''}.`);break;}
    case 'clear-foes':{
      if(!confirmClick(b,'Confirmer : tout retirer'))break;
      const fs=list('ennemi');fs.forEach(x=>delete S.heros[x.id]);
      save();renderPersos();toast('Combat vidé : plus aucun ennemi.');break;}
    case 'row-add':{
      const hh=S.heros[S.openId];if(!hh)break;const k=b.dataset.list;
      const tpl={competences:{acquise:true,nom:'',source:'',carac:'',desc:''},armes:{equipe:!(hh.armes||[]).some(inHand),nom:'',pi:'',bonus:'',rup:'',note:''},protections:{porte:true,nom:'',bonus:'',prNat:0,prMag:0,note:''},sac:{objet:'',qte:1,poids:0,note:''},reperes:{texte:''},accroches:{declencheur:'',source:'',reaction:'',mots:''}}[k]||{};
      (hh[k]=hh[k]||[]).push({...tpl});save();renderDialog();
      const i=hh[k].length-1,first=document.querySelector(`[data-list="${k}"][data-i="${i}"]:not([type=checkbox])`);if(first)first.focus();
      break;}
    case 'row-del':{
      const hh=S.heros[S.openId];if(!hh)break;
      const k=b.dataset.list,row=(hh[k]||[])[n(b.dataset.i)];if(!row)break;
      const R=ROWDEL[k]||ROWDEL._,label=R.name(row);
      const doDel=()=>{const cur=S.heros[hh.id];if(!cur||!cur[k])return;const i=cur[k].indexOf(row);if(i<0)return;
        cur[k].splice(i,1);save();if($('#dlg-hero').open)renderDialog();renderPersos();renderTriggers();
        if(label)toast(`${R.done} : « ${label} ».`)};
      const filled=Object.values(row).some(v=>typeof v==='string'&&v.trim()!=='');
      if(!filled){doDel();break}
      askConfirm(R.title,R.msg(row,label,hh),R.tip,doDel);
      break;}
    case 'eff-add':openEffet(id);break;
    case 'eff-cancel':$('#dlg-effet').close();break;
    case 'preset':{const p=PRESETS[n(b.dataset.i)];$('#eff-nom').value=p.nom;MODKEYS.forEach(k=>$('#eff-m-'+k).value=n(p.mods[k]));break;}
    case 'eff-del':{
      if(!h)break;const eff=(h.effets||[]).find(x=>x.id===b.dataset.eid);
      h.effets=(h.effets||[]).filter(x=>x.id!==b.dataset.eid);
      save();renderPersos();if(S.openId===id&&$('#dlg-hero').open)updateComputed();
      if(eff)toast(`${eff.nom} retiré de ${h.nom}.`);break;}
    case 'kw':{const k=b.dataset.k;S.q=norm(S.q)===norm(k)?'':k;$('#q').value=S.q;renderKw();renderTriggers();break;}
    case 'spot-reset':S.etat.spotlight={};save();renderTriggers();toast('Nouvelle séance : moments de gloire remis à zéro.');break;
    case 'journal-archive':{
      const txt=($('#notes-seance').value||'').trim();if(!txt){toast('Écris quelques notes avant d\'archiver.');break}
      S.etat.journal=(S.etat.journal||[]).concat([{id:rid(),date:new Date().toISOString(),texte:txt}]);
      S.etat.notes='';$('#notes-seance').value='';save();renderJournal();toast('Séance archivée dans le journal.');break;}
    case 'journal-del':{
      if(!confirmClick(b,'Confirmer'))break;
      S.etat.journal=(S.etat.journal||[]).filter(x=>x.id!==b.dataset.jid);save();renderJournal();break;}
    case 'save-file':saveFile();break;
    case 'save-as':saveAs();break;
    case 'open-file':openFile();break;
    case 'undo-import':{
      let prev=null;try{prev=localStorage.getItem(KEY_UNDO)}catch(e){}
      if(!prev)break;
      try{load(JSON.parse(prev));localStorage.removeItem(KEY_UNDO)}catch(e){toast('Impossible de revenir en arrière.');break}
      persist();renderAll();toast('L\'écran est revenu à son état précédent.');break;}
    case 'reset':{
      if(!confirmClick(b,'Confirmer la réinitialisation'))break;
      try{localStorage.setItem(KEY_UNDO,JSON.stringify(snapshot()))}catch(e){}
      load(SEED);persist();renderAll();toast('Écran réinitialisé. « Annuler le dernier import » permet de revenir en arrière.');break;}
  }
});

/* ---------- Saisie ---------- */
let lazyT;
function lazy(){clearTimeout(lazyT);lazyT=setTimeout(()=>{renderPersos();renderTriggers()},250)}
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(t.id==='cq'){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(CQ.res.length){CQ.sel=(CQ.sel+(e.key==='ArrowDown'?1:-1)+CQ.res.length)%CQ.res.length;renderCq()}return}
    if(e.key==='Enter'){e.preventDefault();if(CQ.res[CQ.sel])addEquip(CQ.res[CQ.sel].i);return}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();CQ.q='';t.value='';CQ.sel=0;renderCq();return}
    return;
  }
  if(t.id==='bq'){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(BQ.res.length){BQ.sel=(BQ.sel+(e.key==='ArrowDown'?1:-1)+BQ.res.length)%BQ.res.length;renderBq()}return}
    if(e.key==='Enter'){e.preventDefault();if(BQ.res[BQ.sel])addFromBest(BQ.res[BQ.sel].i);return}
    if(e.key==='Escape'){BQ.q='';t.value='';BQ.sel=0;renderBq();return}
    return;
  }
  if(e.key!=='Enter')return;
  if(t.id&&t.id.startsWith('xp-')){e.preventDefault();applyXp(t.id.slice(3))}
  else if(t.id&&t.id.startsWith('dmg-')){e.preventDefault();applyHit(t.id.slice(4))}
});
function crRerender(){const a=document.activeElement,id=a&&a.id;crRender();if(id){const f=document.getElementById(id);if(f&&f.closest('#dlg-create'))f.focus({preventScroll:true})}}
function crInput(t){
  if(t.id==='cr-nom'){CR.nom=t.value;return}
  if(t.id==='cr-joueur'){CR.joueur=t.value;return}
  if(t.id==='cr-role'){CR.role=t.value;return}
  const k=t.id&&t.id.slice(3);
  if(t.id&&t.id.startsWith('cr-')&&CARS.includes(k)){CR.stats[k]=t.value===''?0:n(t.value);crRefreshDeps();return}
}
function crChange(t){
  if(t.id==='cr-origin'){CR.origin=t.value;CR.variant='';CR.choix=new Set();crRerender();return}
  if(t.id==='cr-variant'){CR.variant=t.value;crRerender();return}
  if(t.id==='cr-metier'){CR.metier=t.value;CR.adjMoins='';CR.adjPlus='';const o=oById(CR.origin),m=mById(CR.metier),v=vById(CR.variant);const pool=choiceList(o,m,v).map(norm);CR.choix=new Set([...CR.choix].filter(x=>pool.includes(norm(x))));crRerender();return}
  if(t.name==='cr-adjm'){CR.adjMoins=t.value;crSummary();return}
  if(t.name==='cr-adjp'){CR.adjPlus=t.value;crSummary();return}
  if(t.id==='cr-nom'||t.id==='cr-joueur'||t.id==='cr-role')return;
  if(t.dataset.choix!=null){crPick();crRerender();return}
}
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.closest&&t.closest('#dlg-create')){crInput(t);return}
  if(t.id==='q'){S.q=t.value;renderKw();renderTriggers();return}
  if(t.id==='bq'){BQ.q=t.value;BQ.sel=0;renderBq();return}
  if(t.id==='cq'){CQ.q=t.value;CQ.sel=0;renderCq();return}
  if(t.id==='cq-t'){CQ.t=t.value;CQ.sel=0;renderCq();return}
  if(t.id==='bq-n'){BQ.n=Math.max(1,Math.min(20,Math.round(n(t.value))||1));renderBq();return}
  if(t.id==='bq-lvl'){BQ.lvl=t.value;BQ.sel=0;renderBq();return}
  if(t.id==='notes-seance'){S.etat.notes=t.value;save();return}
  const h=S.heros[S.openId];
  if(!h||!$('#dlg-hero').contains(t))return;
  if(t.dataset.field){
    h[t.dataset.field]=t.dataset.num?(t.value===''?0:Number(t.value)):t.value;
    save();
    if(t.dataset.field==='kind'){renderDialog();renderPersos();return}
    updateComputed();lazy();return;
  }
  if(t.dataset.list&&t.type!=='checkbox'){
    const row=h[t.dataset.list][n(t.dataset.i)];if(!row)return;
    row[t.dataset.k]=t.dataset.num?(t.value===''?0:Number(t.value)):t.value;
    save();updateComputed();lazy();
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.closest&&t.closest('#dlg-create')){crChange(t);return}
  if(t.id==='cq-pay'){CQ.pay=t.checked;return}
  if(t.id==='import-file'){
    const f=t.files&&t.files[0];
    if(f){const r=new FileReader();r.onload=()=>{
      if(!importText(String(r.result)))return;
      setFile(null,f.name);
      toast(`Sauvegarde chargée depuis ${f.name} : ${Object.keys(S.heros).length} personnages. « Sauvegarder » reprendra ce nom de fichier.`);
    };r.readAsText(f)}
    t.value='';return;
  }
  if(t.dataset.spot){S.etat.spotlight={...(S.etat.spotlight||{}),[t.dataset.spot]:t.checked};save();return}
  const h=S.heros[S.openId];
  if(h&&t.type==='checkbox'&&t.dataset.list){
    const row=h[t.dataset.list][n(t.dataset.i)];if(!row)return;
    row[t.dataset.k]=t.checked;save();renderDialog();renderTriggers();renderPersos();
    if(t.dataset.list==='competences'&&t.checked)toast(`${row.nom||'Compétence'} acquise.`);
  }
});
$('#form-effet').addEventListener('submit',e=>{
  e.preventDefault();
  const nom=$('#eff-nom').value.trim();if(!nom){$('#eff-nom').focus();return}
  const cibles=[...document.querySelectorAll('#eff-cibles input:checked')].map(i=>i.value);
  if(!cibles.length){toast('Choisis au moins un personnage.');return}
  const mods={};MODKEYS.forEach(k=>{const v=n($('#eff-m-'+k).value);if(v)mods[k]=v});
  const note=$('#eff-note').value.trim();
  cibles.forEach(id=>{const h=S.heros[id];if(!h)return;(h.effets=h.effets||[]).push({id:rid(),nom,mods,note})});
  save();$('#dlg-effet').close();renderPersos();if($('#dlg-hero').open)updateComputed();
  toast(`${nom} appliqué à ${cibles.map(id=>S.heros[id]&&S.heros[id].nom).join(', ')}.`);
});
$('#dlg-hero').addEventListener('close',()=>{S.openId=null;renderPersos();renderTriggers()});

/* ---------- Démarrage ---------- */
let stored=null;
try{const raw=localStorage.getItem(KEY);if(raw)stored=JSON.parse(raw)}catch(e){stored=null}
const migrated=load(stored&&stored.heros?stored:SEED);
if(stored&&migrated){try{localStorage.setItem(KEY,JSON.stringify(snapshot()))}catch(e){}setTimeout(()=>toast('Fiche de Julodion mise à jour : profil, background, repères, déclencheurs et compétences.'),400)}
if(!stored){try{localStorage.setItem(KEY,JSON.stringify(snapshot()))}catch(e){setStatus('err')}}
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{load(JSON.parse(e.newValue));renderAll();renderBackup()}catch(err){}});
$('#open-file').hidden=!FS_OK;$('#import-wrap').hidden=FS_OK;
if(FS_OK)idbGet().then(h=>{if(h){FILE.handle=h;FILE.name=h.name;renderFile()}});
try{const v=localStorage.getItem('mj-view');if(v&&MJ_VIEWS.includes(v))setView(v)}catch(e){}
renderKw();renderAll();renderBackup();
}
