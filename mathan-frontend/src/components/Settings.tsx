import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where, addDoc } from '../lib/restStore';
import { db, handleApiError, OperationType } from '../lib/data';
import { useBusiness } from '../hooks/useBusiness';
import { useUI } from '../context/UIContext';
import { Business, Currency, Period } from '../types';
import { Loader2, Building2, Globe, Calendar, Save, Trash2, CheckCircle2, ChevronRight, Settings as SettingsIcon, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Settings() {
  const { business, currency } = useBusiness();
  const { notify, setGlobalLoading } = useUI();
  const [name, setName] = useState(business?.name || '');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  type SettingsTab = 'profile' | 'currency' | 'periods' | 'maintenance';
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  useEffect(() => {
    if (!business) return;
    setName(business.name);

    const fetchData = async () => {
      const cSnap = await getDocs(collection(db, 'currencies'));
      const pSnap = await getDocs(query(collection(db, 'periods'), where('businessId', '==', business.id)));
      
      setCurrencies(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Currency)));
      setPeriods(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Period)));
      setLoading(false);
    };

    fetchData().catch(err => {
      handleApiError(err, OperationType.LIST, 'Settings Data');
      setLoading(false);
    });
  }, [business]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !name.trim()) return;

    setSaving(true);
    setGlobalLoading(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        name,
        updatedAt: serverTimestamp()
      });
      notify.success('Business identity updated');
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Business Update');
    } finally {
      setSaving(false);
      setGlobalLoading(false);
    }
  };

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-olive" />
    </div>
  );

  return (
    <div className="w-full space-y-12 animate-in fade-in duration-500">
      <div className="space-y-1 px-4 lg:px-0">
        <h1 className="text-3xl sm:text-4xl font-serif italic text-zinc-900 tracking-tight">Configuration</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">System parameters & organizational settings</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
        {/* Navigation Tabs */}
        <div className="w-full lg:w-72 space-y-2 shrink-0 px-4 lg:px-0 flex lg:flex-col overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-hide gap-3 lg:gap-2">
           <TabButton 
             active={activeTab === 'profile'} 
             onClick={() => setActiveTab('profile')} 
             icon={Building2} 
             label="Business Profile" 
             desc="Identity & Legal Name" 
           />
           <TabButton 
             active={activeTab === 'currency'} 
             onClick={() => setActiveTab('currency')} 
             icon={Globe} 
             label="Multi-Currency" 
             desc="Exchange Rates & Base" 
           />
           <TabButton 
             active={activeTab === 'periods'} 
             onClick={() => setActiveTab('periods')} 
             icon={Calendar} 
             label="Fiscal Periods" 
             desc="Year Ends & Lock Status" 
           />
           <TabButton 
             active={activeTab === 'maintenance'} 
             onClick={() => setActiveTab('maintenance')} 
             icon={Wrench} 
             label="Maintenance" 
             desc="System Repair & Setup" 
           />
        </div>

        {/* Content Area */}
        <div className="flex-1 px-4 lg:px-0">
           {activeTab === 'maintenance' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <div className="bg-white rounded-[40px] p-10 border border-zinc-100 shadow-sm space-y-8">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300">
                         <Wrench className="w-6 h-6" />
                      </div>
                      <div>
                         <h3 className="text-xl font-serif italic text-zinc-900">System Maintenance</h3>
                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Initialize missing master parameters</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center justify-between">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Standard Account Groups</p>
                            <p className="text-[9px] font-medium text-zinc-400">Creates Assets, Liabilities, Income, Expense defaults if missing.</p>
                         </div>
                         <button 
                           onClick={async () => {
                             if (!business) return;
                             setSaving(true);
                             try {
                               const groups = [
                                 { businessId: business.id, name: 'Fixed Assets', nature: 'Asset' },
                                 { businessId: business.id, name: 'Current Assets', nature: 'Asset' },
                                 { businessId: business.id, name: 'Sundry Debtors', nature: 'Asset' },
                                 { businessId: business.id, name: 'Sundry Creditors', nature: 'Liability' },
                                 { businessId: business.id, name: 'Bank & Cash', nature: 'Asset' },
                                 { businessId: business.id, name: 'Direct Income', nature: 'Income' },
                                 { businessId: business.id, name: 'Direct Expense', nature: 'Expense' },
                                 { businessId: business.id, name: 'Capital Account', nature: 'Equity' }
                               ];
                               const existingSnap = await getDocs(query(collection(db, 'accountGroups'), where('businessId', '==', business.id)));
                               const existingNames = existingSnap.docs.map(d => d.data().name.toLowerCase());
                               
                               for (const g of groups) {
                                  if (!existingNames.includes(g.name.toLowerCase())) {
                                     await addDoc(collection(db, 'accountGroups'), g);
                                  }
                               }
                               notify.success('Account groups initialized successfully.');
                             } catch (err) {
                               handleApiError(err, OperationType.WRITE, 'Maintenance');
                             } finally {
                               setSaving(false);
                               setGlobalLoading(false);
                             }
                           }}
                           className="bg-white border border-zinc-200 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-zinc-900 transition-all flex items-center gap-2"
                         >
                            Initialize Groups
                         </button>
                      </div>
                   </div>
                </div>
             </motion.div>
           )}

           {activeTab === 'profile' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                <div className="bg-white rounded-[40px] p-10 border border-zinc-100 shadow-sm space-y-8">
                   <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300">
                      <Building2 className="w-6 h-6" />
                   </div>
                   <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Legal Business Name</label>
                        <input 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full bg-zinc-50 rounded-2xl px-6 py-4 outline-none border-2 border-transparent focus:border-zinc-100 font-serif italic text-xl transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Functional Currency</label>
                            <div className="bg-zinc-50 rounded-2xl px-6 py-4 text-zinc-400 font-black text-xs uppercase tracking-widest border border-dashed border-zinc-200">
                               {currency?.code} — {currency?.name}
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Entity ID</label>
                            <div className="bg-zinc-50 rounded-2xl px-6 py-4 text-zinc-300 font-mono text-[10px] tracking-tight">
                               {business?.id}
                            </div>
                         </div>
                      </div>
                      <button 
                        disabled={saving}
                        className="bg-zinc-950 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-xl disabled:opacity-50"
                      >
                         {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                         Apply Changes
                      </button>
                   </form>
                </div>
                
                <div className="bg-red-50/30 rounded-[40px] p-10 border border-red-100/20 space-y-4">
                   <div className="flex items-center gap-3 text-red-500">
                      <Trash2 className="w-5 h-5" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Danger Zone</h4>
                   </div>
                   <p className="text-[11px] font-medium text-zinc-400 leading-relaxed max-w-sm">
                      Deleting the business profile is an irreversible action. All audit logs, transactions, and master data will be purged.
                   </p>
                   <p className="text-red-400 text-[9px] font-black uppercase tracking-widest">
                      Business deletion is intentionally unavailable until an audited deletion workflow is implemented.
                   </p>
                </div>
             </motion.div>
           )}

           {activeTab === 'currency' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                {currencies.map(c => (
                  <div key={c.id} className="bg-white rounded-[30px] p-6 border border-zinc-100 flex items-center justify-between group hover:shadow-lg transition-all">
                    <div className="flex items-center gap-6">
                       <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-brand-olive group-hover:text-white transition-all font-black">
                          {c.symbol}
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{c.code}</p>
                          <p className="text-lg font-serif italic text-zinc-900">{c.name}</p>
                       </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Exchange Rate</p>
                          {c.id === currency?.id ? (
                            <p className="text-xl font-mono font-bold text-zinc-900">1.0000</p>
                          ) : (
                            <div className="flex items-center gap-2">
                               <input 
                                 type="number"
                                 step="0.0001"
                                 defaultValue={c.exchangeRate}
                                 onBlur={async (e) => {
                                   const val = Number(e.target.value);
                                   if (val === c.exchangeRate) return;
                                   try {
                                      await updateDoc(doc(db, 'currencies', c.id), {
                                         exchangeRate: val,
                                         updatedAt: serverTimestamp()
                                      });
                                      notify.success(`Rate updated for ${c.code}`);
                                   } catch (err) {
                                      notify.error('Update failed');
                                   }
                                 }}
                                 className="w-24 text-right bg-zinc-50 rounded-lg px-2 py-1 font-mono font-bold text-lg text-zinc-900 outline-none focus:ring-1 ring-brand-olive transition-all"
                               />
                               <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
                <p className="text-[9px] font-medium text-zinc-400 italic text-center px-12 pt-4">
                   Updating exchange rates here will affect all future transactions. Previous entries remain unchanged.
                </p>
             </motion.div>
           )}

           {activeTab === 'periods' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                {periods.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-zinc-300 gap-4 border-2 border-dashed border-zinc-100 rounded-[50px]">
                     <Calendar className="w-12 h-12 opacity-10" />
                     <p className="text-[10px] font-black uppercase tracking-widest">No accounting cycles defined</p>
                     <button 
                       onClick={async () => {
                         if (!business) return;
                         setSaving(true);
                         try {
                           const now = new Date();
                           const nextYear = new Date();
                           nextYear.setFullYear(now.getFullYear() + 1);
                           
                           await addDoc(collection(db, 'periods'), {
                             businessId: business.id,
                             name: `FY ${now.getFullYear()}-${now.getFullYear() + 1}`,
                             startDate: now.toISOString().split('T')[0],
                             endDate: nextYear.toISOString().split('T')[0],
                             isClosed: false,
                             updatedAt: serverTimestamp()
                           });
                           
                           const pSnap = await getDocs(query(collection(db, 'periods'), where('businessId', '==', business.id)));
                           setPeriods(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Period)));
                           notify.success('Fiscal year initialized');
                         } catch (err) {
                           notify.error('Failed to create fiscal period');
                         } finally {
                           setSaving(false);
                         }
                       }}
                       disabled={saving}
                       className="bg-white border border-zinc-200 px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest hover:border-brand-olive hover:text-brand-olive transition-all disabled:opacity-50"
                     >
                        Initiate First Fiscal Year
                     </button>
                  </div>
                ) : (
                  periods.map(p => (
                    <div key={p.id} className="bg-white rounded-[30px] p-8 border border-zinc-100 flex items-center justify-between group hover:shadow-lg transition-all">
                       <div className="space-y-2">
                          <h4 className="text-2xl font-serif italic text-zinc-900">{p.name}</h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                             {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}
                          </p>
                       </div>
                       {p.isClosed ? (
                         <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 text-zinc-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-100">
                            Locked Cycle
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                            Active Cycle
                         </div>
                       )}
                    </div>
                  ))
                )}
             </motion.div>
           )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon: Icon, label, desc, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-[2rem] text-left transition-all group flex items-center gap-4 relative",
        active ? "bg-white shadow-xl border border-zinc-100" : "hover:bg-white/40"
      )}
    >
       <div className={cn(
         "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
         active ? "bg-brand-olive text-white shadow-lg shadow-brand-olive/20" : "bg-zinc-50 text-zinc-300 group-hover:bg-zinc-100"
       )}>
          <Icon className="w-5 h-5" />
       </div>
       <div className="flex-1 min-w-0">
          <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate", active ? "text-zinc-900" : "text-zinc-400")}>{label}</p>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-300 group-hover:text-zinc-400 transition-colors mt-0.5">{desc}</p>
       </div>
       {active && <ChevronRight className="w-4 h-4 text-zinc-200" />}
    </button>
  );
}
