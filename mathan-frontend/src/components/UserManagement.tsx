import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from '../lib/restStore';
import { db, handleApiError, OperationType } from '../lib/data';
import { useBusiness } from '../hooks/useBusiness';
import { Actor, ActorRole } from '../types';
import { Loader2, UserPlus, Shield, Key, Trash2, CheckCircle2, XCircle, Search, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../context/UIContext';

export default function UserManagement() {
  const { business } = useBusiness();
  const { notify } = useUI();
  const [users, setUsers] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<ActorRole>('sales');
  const [pin, setPin] = useState('');
  const [permissions, setPermissions] = useState<NonNullable<Actor['permissions']>>({
    masters: true,
    transactions: true,
    reports: true,
    audit: false,
    users: false,
    settings: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;

    const q = query(collection(db, 'actors'), where('businessId', '==', business.id));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Actor)));
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'Users');
      setLoading(false);
    });

    return () => unsub();
  }, [business]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !name.trim() || !username.trim()) return;
    if ((!editingId && pin.length < 4) || (editingId && pin.length > 0 && pin.length < 4)) {
      notify.error('PIN must contain 4 to 8 digits');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const update: Record<string, unknown> = {
          name,
          username,
          role,
          permissions,
          updatedAt: serverTimestamp()
        };
        // The API intentionally never returns PINs. Leave the existing PIN
        // unchanged unless an administrator explicitly enters a new one.
        if (pin.trim()) update.pin = pin;
        await updateDoc(doc(db, 'actors', editingId), update);
      } else {
        await addDoc(collection(db, 'actors'), {
          businessId: business.id,
          name,
          username,
          role,
          pin,
          permissions,
          active: true,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'User');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: Actor) => {
    try {
      await updateDoc(doc(db, 'actors', user.id), {
        active: !user.active
      });
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'User Toggle');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user access?')) return;
    try {
      await deleteDoc(doc(db, 'actors', userId));
    } catch (err) {
      handleApiError(err, OperationType.DELETE, 'User');
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setRole('sales');
    setPin('');
    setEditingId(null);
    setShowCreate(false);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roles: ActorRole[] = ['admin', 'supervisor', 'accountant', 'sales', 'storekeeper'];

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-olive" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif italic text-zinc-900 tracking-tight">Access Control</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Manage organizational personnel & permissions</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search personnel..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-white border border-zinc-100 rounded-full pl-12 pr-6 py-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-2 ring-brand-olive/5 transition-all w-64"
              />
           </div>
           <button 
             onClick={() => setShowCreate(true)}
             className="bg-brand-olive text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-olive/20 hover:brightness-110 transition-all flex items-center gap-2 active:scale-95"
           >
             <UserPlus className="w-4 h-4" />
             Enlist Personnel
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((user) => (
            <motion.div 
              layout
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "group relative bg-white rounded-[40px] p-8 border border-zinc-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden",
                !user.active && "opacity-60 bg-zinc-50"
              )}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-brand-olive group-hover:text-white transition-all">
                   <Shield className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1">
                   <button 
                     onClick={() => {
                    setEditingId(user.id);
                    setName(user.name);
                    setUsername(user.username || '');
                    setRole(user.role);
                    setPin('');
                    setPermissions(user.permissions || {
                      masters: user.role === 'admin' || user.role === 'supervisor',
                      transactions: true,
                      reports: true,
                      audit: user.role === 'admin' || user.role === 'supervisor',
                      users: user.role === 'admin',
                      settings: user.role === 'admin'
                    });
                    setShowCreate(true);
                     }}
                     className="p-2.5 rounded-xl hover:bg-zinc-50 text-zinc-300 hover:text-zinc-600 transition-colors"
                   >
                     <Edit2 className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleToggleActive(user)}
                     className={cn(
                       "p-2.5 rounded-xl transition-colors",
                       user.active ? "text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50" : "text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50"
                     )}
                   >
                     {user.active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                   </button>
                   <button 
                     onClick={() => handleDelete(user.id)}
                     className="p-2.5 rounded-xl hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <h3 className="text-xl font-serif italic text-zinc-900 truncate">{user.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-olive/60 mt-1">{user.role}</p>
                 </div>
                 
                 <div className="pt-4 border-t border-zinc-50 flex items-center justify-between text-zinc-400">
                    <div className="flex items-center gap-2">
                       <Key className="w-3.5 h-3.5 opacity-40" />
                       <span className="text-[10px] font-bold tracking-[0.3em] font-mono">****</span>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                      user.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {user.active ? 'Operational' : 'Suspended'}
                    </span>
                 </div>
              </div>

              {/* Background Decoration */}
              <div className="absolute -bottom-6 -right-6 text-zinc-50 group-hover:text-brand-olive/5 transition-colors pointer-events-none">
                 <Shield className="w-24 h-24 rotate-12" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCreate && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md" 
                onClick={resetForm} 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-12 overflow-hidden border border-zinc-100"
              >
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-brand-olive rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-brand-olive/20 animate-bounce">
                     <UserPlus className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-serif italic text-zinc-900">{editingId ? 'Modify Access' : 'New Personnel'}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mt-2">Initialize credential set</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Full Identity</label>
                      <input 
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Legal name of person"
                        className="w-full bg-zinc-50 rounded-2xl px-6 py-4 outline-none border-2 border-transparent focus:border-zinc-100 font-serif italic text-lg transition-all"
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Username</label>
                      <input required value={username} onChange={e => setUsername(e.target.value.replace(/[^A-Za-z0-9._-]/g, ''))} placeholder="Login username" className="w-full bg-zinc-50 rounded-2xl px-6 py-4 outline-none border-2 border-transparent focus:border-zinc-100" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Functional Role</label>
                        <select 
                          value={role}
                          onChange={e => {
                            const newRole = e.target.value as ActorRole;
                            setRole(newRole);
                            // Auto-set suggested permissions
                            if (newRole === 'admin') setPermissions({ masters: true, transactions: true, reports: true, audit: true, users: true, settings: true });
                            else if (newRole === 'supervisor') setPermissions({ masters: true, transactions: true, reports: true, audit: true, users: false, settings: false });
                            else if (newRole === 'sales') setPermissions({ masters: false, transactions: true, reports: false, audit: false, users: false, settings: false });
                          }}
                          className="w-full bg-zinc-50 rounded-2xl px-6 py-4 outline-none border-2 border-transparent focus:border-zinc-100 font-bold text-xs uppercase tracking-widest appearance-none cursor-pointer"
                        >
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Actor PIN {editingId && '(optional)'}</label>
                        <input 
                          type="password"
                          maxLength={8}
                          value={pin}
                          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder={editingId ? 'Leave blank to keep current' : 'Numeric Secret'}
                          className="w-full bg-zinc-50 rounded-2xl px-6 py-4 outline-none border-2 border-transparent focus:border-zinc-100 font-mono tracking-widest text-lg transition-all"
                        />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Module Access Control</label>
                      <div className="grid grid-cols-2 gap-3 p-6 bg-zinc-50 rounded-3xl">
                         {(Object.keys(permissions) as Array<keyof typeof permissions>).map((key) => (
                           <label key={key} className="flex items-center gap-3 cursor-pointer group">
                              <div 
                                onClick={() => setPermissions(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={cn(
                                  "w-10 h-6 rounded-full p-1 transition-all duration-300",
                                  permissions[key] ? "bg-brand-olive" : "bg-zinc-200"
                                )}
                              >
                                 <div className={cn(
                                   "w-4 h-4 bg-white rounded-full transition-all duration-300",
                                   permissions[key] ? "translate-x-4" : "translate-x-0"
                                 )} />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 transition-colors">{key}</span>
                           </label>
                         ))}
                      </div>
                   </div>

                   <div className="pt-6 space-y-4">
                      <button 
                        disabled={submitting}
                        className="w-full py-5 bg-brand-olive text-white rounded-[2rem] font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-olive/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {editingId ? 'Update Record' : 'Enlist Personnel'}</>}
                      </button>
                      <button 
                         type="button"
                         onClick={resetForm}
                         className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                      >
                        Cancel Initialization
                      </button>
                   </div>
                </form>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Save({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
