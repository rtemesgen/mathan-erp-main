import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, where, doc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Period } from '../../types';
import { Plus, Search, Loader2, Lock, Unlock } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { required, validateDateRange } from '../../lib/validation';
import { toast } from 'sonner';

export default function PeriodsTab() {
  const { business } = useBusiness();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'periods'), where('businessId', '==', business.id));
    return onSnapshot(q, (snapshot) => {
      setPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Period[]);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'periods');
    });
  }, [business]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Period name');
    const startError = required(newStart, 'Start date');
    const endError = required(newEnd, 'End date');
    const rangeError = validateDateRange(newStart, newEnd);
    if (nameError || startError || endError || rangeError || !business) { toast.error(nameError || startError || endError || rangeError || 'Business is required'); return; }
    try {
      await addDoc(collection(db, 'periods'), { 
        businessId: business.id,
        name: newName.trim(),
        startDate: newStart, 
        endDate: newEnd, 
        isClosed: false 
      });
      setNewName(''); setNewStart(''); setNewEnd(''); setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'periods');
    }
  };

  const togglePeriod = async (period: Period) => {
    try {
      await updateDoc(doc(db, 'periods', period.id), { isClosed: !period.isClosed });
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'periods');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Financial Periods</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100"><Plus className="w-4 h-4" /> Add Period</button>
      </div>
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Period Name</label>
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" placeholder="e.g. FY 2026-Q2" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Start Date</label>
            <input type="date" required value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">End Date</label>
            <input type="date" required value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" />
          </div>
          <div className="md:col-span-3 flex justify-end gap-4">
             <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-sm font-bold text-zinc-500">Cancel</button>
             <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold">Save Period</button>
          </div>
        </form>
      )}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {periods.map(p => (
            <div key={p.id} className="p-6 bg-white rounded-2xl border border-zinc-100 hover:border-zinc-300 transition-all shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg text-zinc-900">{p.name}</h4>
                  <p className="text-xs text-zinc-500 mt-1">{p.startDate} to {p.endDate}</p>
                </div>
                {p.isClosed ? <Lock className="w-5 h-5 text-red-400" /> : <Unlock className="w-5 h-5 text-green-400" />}
              </div>
              <div className="flex gap-2 mt-6">
                <button className="flex-1 py-2 text-xs font-bold border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50">Edit</button>
                <button onClick={() => togglePeriod(p)} className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-colors",
                  p.isClosed ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-red-50 text-red-600 hover:bg-red-100"
                )}>
                  {p.isClosed ? 'Open Period' : 'Close Period'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) { return classes.filter(Boolean).join(' '); }
