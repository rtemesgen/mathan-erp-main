import React,{createContext,useContext,useEffect,useState} from 'react';
import { api, ApiError, login as apiLogin, logout as apiLogout, session } from '../lib/api';
import { Actor,Membership } from '../types';

interface AuthContextType {actor:Actor|null;login:(username:string,pin:string)=>Promise<boolean>;logout:()=>Promise<void>;isLoading:boolean;setActor:(actor:Actor)=>void;memberships:Membership[];}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
function actorFrom(user:any):Actor{return{id:user.id,name:user.name,username:user.username,businessId:localStorage.getItem('currentBusinessId')||'',role:'admin',active:true,pin:'',memberships:user.memberships||[],permissions:user.memberships?.find((m:any)=>m.businessId===localStorage.getItem('currentBusinessId'))?.permissions};}
export function AuthProvider({children}:{children:React.ReactNode}){const[actor,setActor]=useState<Actor|null>(null);const[isLoading,setLoading]=useState(true);useEffect(()=>{if(!session.getToken()){setLoading(false);return;}api<any>('/auth/me').then(u=>setActor(actorFrom(u))).catch(()=>session.setToken(null)).finally(()=>setLoading(false));},[]);const login=async(username:string,pin:string)=>{try{const u=await apiLogin(username,pin);setActor(actorFrom(u));return true;}catch(error){if(error instanceof ApiError&&error.body.status===401)return false;throw error;}};const logout=async()=>{await apiLogout();localStorage.removeItem('currentBusinessId');setActor(null);};return <AuthContext.Provider value={{actor,login,logout,isLoading,setActor,memberships:actor?.memberships||[]}}>{children}</AuthContext.Provider>}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be used within an AuthProvider');return c;}
