import { api } from './api';

type Filter={field:string;op:string;value:any}; type Ref={kind:'collection'|'doc';name:string;id?:string;filters?:Filter[];sort?:{field:string;direction:string};max?:number};
const listeners=new Map<string,Set<()=>void>>();
const endpoints:Record<string,string>={accountGroups:'account-groups',costCenters:'cost-centers',currencies:'currencies',periods:'periods',ledgers:'ledgers',parties:'parties',units:'units',warehouses:'warehouses',products:'products',employees:'employees'};
export const db={};
export const collection=(_db:unknown,name:string):Ref=>({kind:'collection',name});
export const doc=(_db:unknown,name:string,id:string):Ref=>({kind:'doc',name,id});
export const where=(field:string,op:string,value:any):Filter=>({field,op,value});
export const orderBy=(field:string,direction='asc')=>({__sort:true,field,direction});
export const limit=(max:number)=>({__limit:true,max});
export function query(ref:Ref,...parts:any[]):Ref{return {...ref,filters:parts.filter(x=>!x.__sort&&!x.__limit),sort:parts.find(x=>x.__sort),max:parts.find(x=>x.__limit)?.max};}
export const serverTimestamp=()=>new Date().toISOString();
class SnapDoc {constructor(public id:string,private value:any){}data(){return this.value;}exists(){return !!this.value;}}
class Snap {docs:SnapDoc[];constructor(values:any[]){this.docs=values.map(v=>new SnapDoc(v.id,v));}get empty(){return !this.docs.length;}get size(){return this.docs.length;}forEach(fn:(d:SnapDoc)=>void){this.docs.forEach(fn);}}
function path(name:string,id?:string){if(name==='businesses')return `/businesses${id?`/${id}`:''}`;if(name==='actors')return `/users${id?`/${id}`:''}`;if(name==='vouchers')return `/vouchers${id?`/${id}`:''}`;if(name==='auditLogs')return `/audit-logs`;const master=endpoints[name];if(!master)throw new Error(`Unsupported REST resource: ${name}`);return `/masters/${master}${id?`/${id}`:''}`;}
function applyQuery(values:any[],ref:Ref){let out=values;for(const f of ref.filters||[]){if(f.field==='businessId')continue;if(f.field==='__name__'&&f.op==='in')out=out.filter(x=>f.value.includes(x.id));else if(f.op==='==')out=out.filter(x=>x[f.field]===f.value);}if(ref.sort)out=[...out].sort((a,b)=>String(a[ref.sort!.field]).localeCompare(String(b[ref.sort!.field]))*(ref.sort!.direction==='desc'?-1:1));return ref.max?out.slice(0,ref.max):out;}
export async function getDocs(ref:Ref){const values=await api<any[]>(path(ref.name));return new Snap(applyQuery(values,ref));}
export async function getDoc(ref:Ref){if(ref.name==='businesses'){const all=await api<any[]>('/businesses');return new SnapDoc(ref.id!,all.find(x=>x.id===ref.id));}const all=await api<any[]>(path(ref.name));return new SnapDoc(ref.id!,all.find(x=>x.id===ref.id));}
export const getDocFromServer=getDoc;
export function onSnapshot(ref:Ref,next:(s:any)=>void,error?:(e:any)=>void){let stopped=false;const load=()=>{(ref.kind==='doc'?getDoc(ref):getDocs(ref)).then(x=>{if(!stopped)next(x)}).catch(e=>{if(!stopped)error?.(e)});};const key=ref.name;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(load);load();return()=>{stopped=true;listeners.get(key)?.delete(load);};}
function changed(name:string){listeners.get(name)?.forEach(fn=>fn());}
export async function addDoc(ref:Ref,data:any){const value=await api<any>(path(ref.name),{method:'POST',body:JSON.stringify(strip(data))});changed(ref.name);return{id:value.id};}
export async function updateDoc(ref:Ref,data:any){if(ref.name==='vouchers')await api(path(ref.name,ref.id),{method:'PUT',body:JSON.stringify(strip(data))});else if(ref.name==='actors')await api(path(ref.name,ref.id),{method:'PATCH',body:JSON.stringify(strip(data))});else if(ref.name==='businesses')await api(`/businesses/${ref.id}/settings`,{method:'PATCH',body:JSON.stringify(strip(data))});else await api(path(ref.name,ref.id),{method:'PUT',body:JSON.stringify(strip(data))});changed(ref.name);}
export async function deleteDoc(ref:Ref){if(ref.name==='vouchers')await api(`/vouchers/${ref.id}/cancel`,{method:'POST'});else await api(path(ref.name,ref.id),{method:'DELETE'});changed(ref.name);}
export function writeBatch(_db:unknown){const operations:{resource:string;action:'create'|'update'|'delete';id?:string;data?:any;name:string}[]=[];return{set(ref:Ref,data:any){operations.push({resource:endpoints[ref.name]||ref.name,action:ref.id?'update':'create',id:ref.id,data:strip(data),name:ref.name});},update(ref:Ref,data:any){operations.push({resource:endpoints[ref.name]||ref.name,action:'update',id:ref.id,data:strip(data),name:ref.name});},delete(ref:Ref){operations.push({resource:endpoints[ref.name]||ref.name,action:'delete',id:ref.id,name:ref.name});},commit(){if(!operations.length)return Promise.resolve([] as any[]);return api('/batch',{method:'POST',body:JSON.stringify({operations})}).then(result=>{[...new Set(operations.map(operation=>operation.name))].forEach(changed);return result;});}};}
export const runTransaction=async(_db:unknown,fn:(tx:any)=>Promise<any>)=>fn({});
function strip(data:any){if(!data||typeof data!=='object')return data;const copy={...data};delete copy.businessId;delete copy.actorId;delete copy.createdAt;delete copy.updatedAt;delete copy.number;return copy;}
