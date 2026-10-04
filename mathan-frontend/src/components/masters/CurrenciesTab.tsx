import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Currency } from '../../types';
import { Globe, Plus, Loader2, Save, X, CheckSquare, Square, Anchor, Edit3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useBusiness } from '../../hooks/useBusiness';
import { required, positiveNumber } from '../../lib/validation';
import { toast } from 'sonner';

export default function CurrenciesTab() {
  const { actor } = useAuth();
  const { business } = useBusiness();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'currencies'), 
      (snap) => {
        setCurrencies(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Currency[]);
        setLoading(false);
      },
      (err) => handleApiError(err, OperationType.LIST, 'currencies')
    );
  }, []);

  const handleSave = async (id: string | null, data: Partial<Currency>) => {
    try {
      if (id) {
        await updateDoc(doc(db, 'currencies', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'currencies'), {
          ...data,
          active: data.active ?? true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setShowAdd(false);
      }
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Currencies');
    }
  };

  const handleSetBaseCurrency = async (currencyId: string) => {
    if (!business) return;
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        baseCurrencyId: currencyId
      });
    } catch (err) {
      handleApiError(err, OperationType.UPDATE, 'business');
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-olive" /></div>;

  return (
    <div className="p-8 space-y-12">
      <div className="bg-zinc-950 text-white p-12 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3">
             <Anchor className="w-5 h-5 text-brand-olive" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Anchor Base Currency</span>
          </div>
          <h2 className="text-4xl font-serif italic leading-tight">Your primary reporting currency for this business.</h2>
          <p className="text-sm text-white/50">Changing the base currency affects how all historical transactions are aggregated in reports. Proceed with caution.</p>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto">
           <select 
             value={business?.baseCurrencyId}
             onChange={(e) => handleSetBaseCurrency(e.target.value)}
             className="bg-white/10 text-white px-8 py-5 rounded-3xl border-none font-serif italic text-xl focus:ring-2 focus:ring-brand-olive outline-none min-w-[280px] cursor-pointer hover:bg-white/20 transition-all"
           >
             {currencies.map(c => (
               <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                 {c.code} - {c.name} {!c.active ? '(Inactive)' : ''}
               </option>
             ))}
           </select>
           <p className="text-center text-[10px] font-black uppercase tracking-widest text-brand-olive">
             Current Base: {currencies.find(c => c.id === business?.baseCurrencyId)?.code || 'Unknown'}
           </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-3xl font-serif italic text-zinc-900">Exchange Hub</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total currencies: {currencies.length}</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-3 px-10 py-5 bg-brand-olive text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-xl shadow-brand-olive/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Add New Currency
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {showAdd && (
           <CurrencyCard 
             onSave={(data: any) => handleSave(null, data)} 
             onCancel={() => setShowAdd(false)}
             isNew
           />
        )}
        {currencies.map(c => (
          <CurrencyCard 
            key={c.id} 
            currency={c} 
            isBase={c.id === business?.baseCurrencyId}
            isEditing={editingId === c.id}
            onEdit={() => setEditingId(c.id)}
            onSave={(data: any) => handleSave(c.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ))}
      </div>
    </div>
  );
}

function CurrencyCard({ currency, onSave, onCancel, isEditing, isNew, onEdit, isBase }: any) {
  const [code, setCode] = useState(currency?.code || '');
  const [name, setName] = useState(currency?.name || '');
  const [symbol, setSymbol] = useState(currency?.symbol || '');
  const [rate, setRate] = useState(currency?.exchangeRate || 1);
  const [active, setActive] = useState(currency?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = required(code, 'Currency code') || required(name, 'Currency name') || required(symbol, 'Currency symbol') || positiveNumber(rate, 'Exchange rate');
    if (error) { toast.error(error); return; }
    onSave({ code, name, symbol, exchangeRate: Number(rate), active });
  };

  if (isEditing || isNew) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[40px] border-2 border-brand-olive shadow-2xl space-y-8">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-olive">{isNew ? 'New Asset' : 'Refining Asset'}</h4>
                <p className="text-lg font-serif italic text-zinc-900">Currency Identity</p>
            </div>
            <button type="button" onClick={onCancel} className="p-3 hover:bg-zinc-50 rounded-full text-zinc-300 hover:text-zinc-900 transition-colors">
               <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-2 block">Code</label>
                <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full bg-zinc-50 px-6 py-4 rounded-2xl border-none text-sm font-black uppercase focus:ring-2 focus:ring-brand-olive outline-none" placeholder="USD" />
            </div>
            <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-2 block">Symbol</label>
                <input required value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-zinc-50 px-6 py-4 rounded-2xl border-none text-sm font-black focus:ring-2 focus:ring-brand-olive outline-none" placeholder="$" />
            </div>
        </div>

        <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-2 block">Denomination Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-50 px-6 py-4 rounded-2xl border-none text-sm font-medium focus:ring-2 focus:ring-brand-olive outline-none" placeholder="US Dollar" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-2 block">Exchange Rate</label>
                <input required type="number" step="0.0001" value={rate} onChange={e => setRate(e.target.value)} className="w-full bg-zinc-50 px-6 py-4 rounded-2xl border-none text-sm font-mono font-bold focus:ring-2 focus:ring-brand-olive outline-none" />
            </div>
            
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-1 block">Status</label>
                <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setActive(true)}
                      className={cn(
                        "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                        active ? "bg-green-50 border-green-200 text-green-600" : "bg-zinc-50 border-transparent text-zinc-400"
                      )}
                    >
                      Active
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActive(false)}
                      className={cn(
                        "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                        !active ? "bg-red-50 border-red-200 text-red-600" : "bg-zinc-50 border-transparent text-zinc-400"
                      )}
                    >
                      Inactive
                    </button>
                </div>
            </div>
        </div>

        <button type="submit" className="w-full py-6 bg-zinc-950 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:brightness-125 transition-all shadow-xl shadow-zinc-900/20 active:scale-[0.98]">
            <Save className="w-5 h-5" /> Commit Currency
        </button>
      </form>
    );
  }

  return (
    <div className={cn(
      "bg-white p-12 rounded-[40px] border-2 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[320px]",
      isBase ? "border-brand-olive shadow-2xl" : "border-zinc-100 shadow-xl hover:shadow-2xl hover:border-zinc-200",
      !currency.active && "opacity-60 grayscale"
    )}>
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Globe className="w-40 h-40 -mr-12 -mt-12" />
        </div>

        <div className="flex items-center justify-between relative z-10">
            <div className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center text-4xl font-black shadow-inner",
              isBase ? "bg-brand-olive text-white shadow-brand-olive/20" : "bg-zinc-50 text-brand-olive shadow-zinc-200"
            )}>
                {currency.symbol}
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={onEdit} 
                  className="p-4 bg-zinc-100 text-zinc-400 hover:text-brand-olive hover:bg-brand-olive/5 rounded-full transition-all active:scale-90"
                  title="Edit Currency"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
            </div>
        </div>

        <div className="space-y-4 relative z-10 mt-10">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-3xl font-serif italic text-zinc-900">{currency.name}</h3>
                {isBase && (
                  <span className="px-3 py-1 bg-brand-olive text-white text-[8px] font-black uppercase tracking-widest rounded-full">Base</span>
                )}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300">{currency.code}</p>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Exchange Rate</p>
                  <p className="font-mono text-xl font-bold text-zinc-900">{currency.exchangeRate.toFixed(4)}</p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest",
                  currency.active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                )}>
                  {currency.active ? 'Operational' : 'Deactivated'}
                </div>
            </div>
        </div>
    </div>
  );
}
