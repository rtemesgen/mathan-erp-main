import React, { useState, useEffect } from 'react';
import { handleApiError, OperationType } from '../lib/data';
import { api } from '../lib/api';
import { Business, Currency } from '../types';
import { Loader2, Building2, Globe, Plus, LogOut, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUI } from '../context/UIContext';
import { required } from '../lib/validation';

interface BusinessManagerProps {
  ownerId: string;
  onSelect: (businessId: string) => void | Promise<void>;
  onLogout: () => void;
}

export default function BusinessManager({ ownerId, onSelect, onLogout }: BusinessManagerProps) {
  const { notify, setGlobalLoading } = useUI();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([
    { id: 'USD', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, active: true },
    { id: 'UGX', code: 'UGX', name: 'Uganda Shilling', symbol: 'USh', exchangeRate: 3800, active: true },
    { id: 'KES', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', exchangeRate: 130, active: true },
    { id: 'SSP', code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', exchangeRate: 1, active: true }
  ]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  // Create Form State
  const [newBusinessName, setNewBusinessName] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState('USD');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setBusinesses(await api<Business[]>('/businesses'));
      
      } catch (err) {
        handleApiError(err, OperationType.LIST, 'Business/Currency');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ownerId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newBusinessName, 'Business name');
    if (nameError || !selectedCurrencyId) { notify.error(nameError || 'Base currency is required'); return; }

    setCreating(true);
    setGlobalLoading(true);
    try {
      const created = await api<Business>('/businesses', { method: 'POST', body: JSON.stringify({
        name: newBusinessName.trim(),
        baseCurrencyCode: selectedCurrencyId
      }) });

      notify.success('Enterprise profile incorporated successfully');
      await onSelect(created.id);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Business/Groups');
    } finally {
      setCreating(false);
      setGlobalLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-beige">
      <Loader2 className="w-8 h-8 animate-spin text-brand-olive" />
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-beige flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {!showCreate ? (
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h1 className="text-6xl font-serif italic text-zinc-900 tracking-tight">Active Entities</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Select business profile to resume operation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {businesses.map(b => (
                <button 
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  className="bg-white p-10 rounded-[50px] border border-zinc-100 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all group text-left relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Building2 className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                  <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 text-zinc-400 group-hover:bg-brand-olive group-hover:text-white transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-serif italic text-zinc-900 mb-2">{b.name}</h3>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-300">
                    <Globe className="w-3 h-3" />
                    {b.baseCurrencyCode || currencies.find(c => c.id === b.baseCurrencyId)?.code || 'N/A'} Economy
                  </div>
                </button>
              ))}

              <button 
                onClick={() => setShowCreate(true)}
                className="bg-white/40 border-2 border-dashed border-zinc-200 p-10 rounded-[50px] flex flex-col items-center justify-center gap-4 hover:border-brand-olive hover:bg-white transition-all group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-zinc-200 flex items-center justify-center text-zinc-300 group-hover:border-brand-olive group-hover:text-brand-olive transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-brand-olive transition-colors">New Business Profile</span>
              </button>
            </div>

            <div className="pt-8 border-t border-zinc-200 flex justify-center">
              <button onClick={onLogout} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" /> Change Actor / Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-[50px] shadow-2xl p-12 animate-in fade-in zoom-in-95 duration-500">
             <div className="text-center mb-10">
                <h2 className="text-4xl font-serif italic text-zinc-900">Establish Business</h2>
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-300 mt-2">New tenant initialization</p>
             </div>

             <form onSubmit={handleCreate} className="space-y-8">
                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Business Legal Name</label>
                   <input 
                      type="text" 
                      required 
                      value={newBusinessName}
                      onChange={(e) => setNewBusinessName(e.target.value)}
                      placeholder="e.g. Jolly Trading Co."
                      className="w-full bg-zinc-50 p-5 rounded-3xl font-serif italic text-xl border border-transparent focus:border-zinc-100 outline-none transition-all"
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Functional Currency</label>
                   <div className="grid grid-cols-3 gap-3">
                      {currencies.filter(c => c.active).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCurrencyId(c.id)}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1",
                            selectedCurrencyId === c.id 
                              ? "bg-brand-olive border-brand-olive text-white shadow-lg" 
                              : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200"
                          )}
                        >
                          <span className="text-lg font-black">{c.symbol}</span>
                          <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">{c.code}</span>
                          {selectedCurrencyId === c.id && <CheckCircle2 className="w-3 h-3 absolute top-2 right-2" />}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="pt-4 space-y-4">
                  <button 
                    type="submit"
                    disabled={creating}
                    className="w-full py-5 bg-brand-olive text-white rounded-[2rem] font-bold text-xs uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-brand-olive/20"
                  >
                    {creating ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirm Incorporation'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="w-full font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
             </form>
          </div>
        )}
      </div>
    </div>
  );
}
