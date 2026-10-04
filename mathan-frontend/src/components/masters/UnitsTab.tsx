import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, where, writeBatch, doc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Unit } from '../../types';
import { Plus, Search, Loader2, Trash2, CheckCircle2, XCircle, CheckSquare, Square } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { cn } from '../../lib/utils';
import { required } from '../../lib/validation';
import { toast } from 'sonner';

export default function UnitsTab() {
  const { business } = useBusiness();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'units'), where('businessId', '==', business.id));
    return onSnapshot(q, (snapshot) => {
      setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Unit[]);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'units');
    });
  }, [business]);

  const toggleSelectAll = () => {
    if (selectedIds.length === units.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(units.map(u => u.id));
    }
  };

  const handleBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (!business || selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Delete ${selectedIds.length} units?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, 'units', id);
        if (action === 'delete') batch.delete(ref);
        else batch.update(ref, { active: action === 'activate' });
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Batch Units');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Unit name');
    if (nameError || !business) { if (nameError) toast.error(nameError); return; }
    try {
      await addDoc(collection(db, 'units'), { 
        businessId: business.id,
        name: newName.trim(),
        active: true 
      });
      setNewName(''); setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'units');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Search units..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none text-sm" />
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100"><Plus className="w-4 h-4" /> Add Unit</button>
      </div>
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Unit Name</label>
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" placeholder="e.g. Kg, Pcs, Box" />
          </div>
          <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold">Save</button>
        </form>
      )}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div> : (
        <div className="relative">
          {selectedIds.length > 0 && (
            <div className="mb-4 p-4 bg-zinc-900 text-white rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-black uppercase tracking-widest px-4">{selectedIds.length} Selected</span>
              <div className="flex gap-2">
                <button onClick={() => handleBatchAction('activate')} className="px-4 py-2 hover:bg-zinc-800 rounded-xl text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Activate</button>
                <button onClick={() => handleBatchAction('deactivate')} className="px-4 py-2 hover:bg-zinc-800 rounded-xl text-zinc-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><XCircle className="w-4 h-4" /> Deactivate</button>
                <button onClick={() => handleBatchAction('delete')} className="px-4 py-2 hover:bg-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </div>
          )}
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleSelectAll} className="text-zinc-300 hover:text-zinc-500">
                    {selectedIds.length === units.length && units.length > 0 ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Name</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {units.filter(u => u.name.toLowerCase().includes(search.toLowerCase())).map(u => (
                <tr key={u.id} className={cn("hover:bg-zinc-50/50 transition-colors group", selectedIds.includes(u.id) && "bg-blue-50/30")}>
                  <td className="px-4 py-4">
                    <button onClick={() => setSelectedIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className="text-zinc-300 hover:text-zinc-500">
                      {selectedIds.includes(u.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-1 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-zinc-200'}`} />
                      <span className={cn("font-semibold", !u.active && "text-zinc-400 italic")}>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100"><button className="text-zinc-400 hover:text-zinc-900 text-xs font-bold">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
