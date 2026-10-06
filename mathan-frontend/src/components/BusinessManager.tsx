import React, { useState, useEffect, useCallback, useRef } from 'react';
import { handleApiError, OperationType } from '../lib/data';
import { api } from '../lib/api';
import { Business } from '../types';
import { OpenBusinessResult } from '../lib/businessContext';
import { getBusinessCreateFailureRecovery, getBusinessCreateSuccessRecovery, isSupportedOnboardingCurrency, ONBOARDING_CURRENCIES } from '../lib/businessOnboarding';
import { Loader2, Building2, Globe, Plus, LogOut, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUI } from '../context/UIContext';
import { required } from '../lib/validation';
import { createOperationLock } from '../lib/operationLock';

interface BusinessManagerProps {
  ownerId: string;
  onSelect: (businessId: string) => Promise<OpenBusinessResult>;
  onLogout: () => void;
}

export default function BusinessManager({ ownerId, onSelect, onLogout }: BusinessManagerProps) {
  const { notify, setGlobalLoading } = useUI();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const currencies = ONBOARDING_CURRENCIES;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  // Create Form State
  const [newBusinessName, setNewBusinessName] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState('USD');
  const [creating, setCreating] = useState(false);
  const createLock = useRef(createOperationLock());
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [failedOpen, setFailedOpen] = useState<{ id: string; message: string } | null>(null);
  const [createErrors, setCreateErrors] = useState<{ name?: string; summary?: string }>({});

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setBusinesses(await api<Business[]>('/businesses'));
    } catch (err) {
      setBusinesses([]);
      setLoadError('We could not load your business profiles. Please try again.');
      handleApiError(err, OperationType.LIST, 'Business profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBusinesses(); }, [ownerId, loadBusinesses]);

  const applyCreateRecovery = (recovery: { showCreate: boolean; name: string; currencyId: string; errors: { name?: string; summary?: string } }) => {
    setNewBusinessName(recovery.name);
    setSelectedCurrencyId(recovery.currencyId);
    setCreateErrors(recovery.errors);
    setShowCreate(recovery.showCreate);
  };

  const handleSelect = async (businessId: string): Promise<OpenBusinessResult> => {
    if (selectingId) {
      return { ok: false, code: 'OPEN_IN_PROGRESS', message: 'A business is already being opened' };
    }
    setSelectingId(businessId);
    setFailedOpen(null);
    try {
      const result = await onSelect(businessId);
      if (result.ok === false) setFailedOpen({ id: businessId, message: result.message });
      return result;
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Business selection');
      const message = err instanceof Error ? err.message : 'Unable to open this business. Please try again.';
      setFailedOpen({ id: businessId, message });
      return { ok: false, code: 'BUSINESS_CONTEXT_UNAVAILABLE', message };
    } finally {
      setSelectingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newBusinessName, 'Business name');
    const nextErrors: { name?: string; summary?: string } = {};
    if (nameError) nextErrors.name = nameError;
    if (!isSupportedOnboardingCurrency(selectedCurrencyId)) nextErrors.summary = 'Choose a supported base currency.';
    if (nameError || nextErrors.summary) {
      setCreateErrors(nextErrors);
      return;
    }

    if (creating || selectingId || !createLock.current.tryAcquire()) return;
    setCreating(true);
    setGlobalLoading(true);
    try {
      const created = await api<Business>('/businesses', { method: 'POST', body: JSON.stringify({
        name: newBusinessName.trim(),
        baseCurrencyCode: selectedCurrencyId
      }) });

      notify.success('Enterprise profile incorporated successfully');
      setBusinesses(current => [...current, created]);
      const openResult = await handleSelect(created.id);
      const recovery = getBusinessCreateSuccessRecovery(created.id, openResult);
      applyCreateRecovery(recovery);
      if (recovery.retryBusinessId && recovery.retryMessage) {
        setFailedOpen({ id: recovery.retryBusinessId, message: recovery.retryMessage });
      }
    } catch (err) {
      applyCreateRecovery(getBusinessCreateFailureRecovery({ name: newBusinessName, currencyId: selectedCurrencyId }, err));
      handleApiError(err, OperationType.WRITE, 'Business/Groups');
    } finally {
      setCreating(false);
      setGlobalLoading(false);
      createLock.current.release();
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
              {loadError && <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-red-100 bg-red-50 p-6 text-center">
                <p className="text-sm font-semibold text-red-700">{loadError}</p>
                <button type="button" onClick={() => void loadBusinesses()} className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-700 hover:text-red-900">Retry</button>
              </div>}
              {!loadError && businesses.length === 0 && <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-zinc-100 bg-white/60 p-8 text-center">
                <p className="font-serif italic text-xl text-zinc-800">No business profiles yet</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Create your first business to begin.</p>
              </div>}
              {businesses.map(b => (
                <div key={b.id} className="bg-white p-10 rounded-[50px] border border-zinc-100 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Building2 className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSelect(b.id)}
                    disabled={selectingId === b.id}
                    className="w-full text-left group disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 text-zinc-400 group-hover:bg-brand-olive group-hover:text-white transition-colors">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-serif italic text-zinc-900 mb-2">{selectingId === b.id ? 'Opening…' : b.name}</h3>
                    <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-300">
                      <Globe className="w-3 h-3" />
                      {b.baseCurrencyCode || currencies.find(c => c.id === b.baseCurrencyId)?.code || 'N/A'} Economy
                    </div>
                  </button>
                  {failedOpen?.id === b.id && <div className="mt-5 rounded-2xl bg-red-50 p-4" role="alert">
                    <p className="text-sm text-red-700">{failedOpen.message}</p>
                    <button type="button" onClick={() => void handleSelect(b.id)} disabled={!!selectingId} className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-700 hover:text-red-900 disabled:opacity-50">Retry opening</button>
                  </div>}
                </div>
              ))}

                <button
                  onClick={() => setShowCreate(true)}
                disabled={creating || !!selectingId}
                className="bg-white/40 border-2 border-dashed border-zinc-200 p-10 rounded-[50px] flex flex-col items-center justify-center gap-4 hover:border-brand-olive hover:bg-white transition-all group disabled:cursor-not-allowed disabled:opacity-60"
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
                      value={newBusinessName}
                      onChange={(e) => {
                        setNewBusinessName(e.target.value);
                        setCreateErrors(current => ({ ...current, name: undefined }));
                      }}
                      aria-invalid={!!createErrors.name}
                      aria-describedby={createErrors.name ? 'business-name-error' : undefined}
                      placeholder="e.g. Jolly Trading Co."
                      className={cn("w-full bg-zinc-50 p-5 rounded-3xl font-serif italic text-xl border focus:border-zinc-100 outline-none transition-all", createErrors.name ? 'border-red-300' : 'border-transparent')}
                   />
                   {createErrors.name && <p id="business-name-error" className="mt-2 text-sm text-red-700" role="alert">{createErrors.name}</p>}
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Functional Currency</label>
                   <div className="grid grid-cols-4 gap-3">
                      {currencies.filter(c => c.active).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCurrencyId(c.id);
                            setCreateErrors(current => ({ ...current, summary: undefined }));
                          }}
                          className={cn(
                            "relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1",
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
                  {createErrors.summary && <p className="mt-3 text-sm text-red-700" role="alert">{createErrors.summary}</p>}
                </div>

                <div className="pt-4 space-y-4">
                  <button
                    type="submit"
                    disabled={creating || !!selectingId}
                    className="w-full py-5 bg-brand-olive text-white rounded-[2rem] font-bold text-xs uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-brand-olive/20"
                  >
                    {creating ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirm Incorporation'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowCreate(false)}
                    disabled={creating}
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
