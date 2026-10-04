import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, where } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { CostCenter } from '../../types';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { required } from '../../lib/validation';
import { toast } from 'sonner';

export default function CostCentersTab() {
  const { business } = useBusiness();
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'costCenters'), where('businessId', '==', business.id));
    return onSnapshot(q, (snapshot) => {
      setCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[]);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'costCenters');
    });
  }, [business]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Cost center name');
    if (nameError || !business) { if (nameError) toast.error(nameError); return; }
    try {
      await addDoc(collection(db, 'costCenters'), { 
        businessId: business.id,
        name: newName.trim(),
        active: true 
      });
      setNewName(''); setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'costCenters');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search cost centers..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none text-sm" 
          />
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)} 
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" /> Add Cost Center
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Center Name</label>
            <input 
              required 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" 
              placeholder="e.g. Sales Department, Kampala Branch" 
            />
          </div>
          <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold">Save</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Name</th>
              <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {centers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => (
              <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-4 py-4 font-semibold text-zinc-900">{c.name}</td>
                <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100">
                  <button className="text-zinc-400 hover:text-zinc-900 text-xs font-bold">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
