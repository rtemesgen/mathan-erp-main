const API_URL = import.meta.env?.VITE_API_URL || '/api/v1';
const DIRECT_API_PORT = import.meta.env?.VITE_DIRECT_API_PORT;

function directApiUrl() {
  if (!DIRECT_API_PORT || typeof window === 'undefined') return null;
  const url = `http://${window.location.hostname}:${DIRECT_API_PORT}/api/v1`;
  return url === API_URL ? null : url;
}

export interface ApiErrorBody { status: number; code: string; message: string; fieldErrors?: Record<string,string>; path?: string }
export class ApiError extends Error { constructor(public body: ApiErrorBody){super(body.message);} }

export function getApiFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.body.fieldErrors) return error.body.fieldErrors;
  return {};
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const fields = Object.values(getApiFieldErrors(error)).filter(Boolean);
  if (fields.length) return fields.join('; ');
  if (error instanceof ApiError && error.body.message?.trim()) return error.body.message;
  return fallback;
}

const tokenStorage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
let accessToken = tokenStorage?.getItem('mathan_access_token') || null;
type RefreshSession = { accessToken: string; user?: unknown };
let refreshing: Promise<RefreshSession | null> | null = null;
export const session = {
  setToken(token: string | null){accessToken=token; if(token)tokenStorage?.setItem('mathan_access_token',token);else tokenStorage?.removeItem('mathan_access_token');},
  getToken(){return accessToken;}
};

async function refresh(baseUrl = API_URL){
  if(!refreshing) refreshing=fetch(`${baseUrl}/auth/refresh`,{method:'POST',credentials:'include'})
    .then(async r=>{if(!r.ok){session.setToken(null);return null;}const data=await r.json() as RefreshSession;session.setToken(data.accessToken);return data;})
    .catch(()=>{session.setToken(null);return null;})
    .finally(()=>{refreshing=null});
  return refreshing;
}

export async function restoreSession<T=unknown>():Promise<T|null>{
  const data=await refresh();
  return data?.user as T ?? null;
}

async function request<T>(baseUrl:string,path:string,options:RequestInit={},retry=true,includeStoredBusinessId=true):Promise<T>{
  const headers=new Headers(options.headers); if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(accessToken)headers.set('Authorization',`Bearer ${accessToken}`);
  const businessId=includeStoredBusinessId ? localStorage.getItem('currentBusinessId') : null; if(businessId&&!headers.has('X-Business-Id'))headers.set('X-Business-Id',businessId);
  const response=await fetch(`${baseUrl}${path}`,{...options,headers,credentials:'include'});
  if(response.status===401&&retry&&path!='/auth/login'&&await refresh(baseUrl))return request<T>(baseUrl,path,options,false,includeStoredBusinessId);
  if(!response.ok){let body:ApiErrorBody;try{body=await response.json();}catch{body={status:response.status,code:'HTTP_ERROR',message:`Request failed (${response.status})`};}throw new ApiError(body);}
  if(response.status===204||response.headers.get('content-length')==='0')return undefined as T;
  const text=await response.text();return (text?JSON.parse(text):undefined) as T;
}

async function callApi<T>(path:string,options:RequestInit,retry:boolean,includeStoredBusinessId:boolean):Promise<T>{
  try { return await request<T>(API_URL,path,options,retry,includeStoredBusinessId); }
  catch (error) {
    const fallback = directApiUrl();
    if (error instanceof TypeError && fallback) return request<T>(fallback,path,options,retry,includeStoredBusinessId);
    throw error;
  }
}

export function api<T=unknown>(path:string,options:RequestInit={},retry=true):Promise<T>{
  return callApi<T>(path,options,retry,true);
}

export function apiWithoutStoredBusinessHeader<T=unknown>(path:string,options:RequestInit={},retry=true):Promise<T>{
  return callApi<T>(path,options,retry,false);
}

export async function login(username:string,pin:string){const data=await api<any>('/auth/login',{method:'POST',body:JSON.stringify({username,pin})});session.setToken(data.accessToken);return data.user;}
export async function logout(){try{await api('/auth/logout',{method:'POST'});}finally{session.setToken(null);}}
