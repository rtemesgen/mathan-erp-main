import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Ledger, AccountGroup } from '../../types';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { required } from '../../lib/validation';
import { toast } from 'sonner';

export default function LedgersTab() {
  const { business } = useBusiness();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [openingBal, setOpeningBal] = useState<string>('');
  const [openingType, setOpeningType] = useState<'Dr' | 'Cr'>('Dr');

  useEffect(() => {
    if (!business) return;
    const qLedgers = query(collection(db, 'ledgers'), where('businessId', '==', business.id));
    const qGroups = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));
    
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AccountGroup[];
      setGroups(data);
      if (data.length > 0 && !newGroupId) setNewGroupId(data[0].id);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'accountGroups');
    });

    const unsubLedgers = onSnapshot(qLedgers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ledger[];
      setLedgers(data);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'ledgers');
    });

    return () => { unsubGroups(); unsubLedgers(); };
  }, [business]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Ledger name');
    const groupError = required(newGroupId, 'Account group');
    if (nameError || groupError || !business) { toast.error(nameError || groupError || 'Business is required'); return; }
    try {
      await addDoc(collection(db, 'ledgers'), {
        businessId: business.id,
        name: newName.trim(),
        groupId: newGroupId,
        openingBalance: parseFloat(openingBal) || 0,
        openingBalanceType: openingType,
        active: true,
        isSystem: false
      });
      setNewName('');
      setOpeningBal('');
      setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'ledgers');
    }
  };

  const filtered = ledgers.filter(l => `${l.accountCode || ''} ${l.name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search ledgers..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm"
          />
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" />
          Add Ledger
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-wrap items-end gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex-[2] min-w-[200px] space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Ledger Name</label>
            <input 
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm"
              placeholder="e.g. Sales Account"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Group</label>
            <select 
              required
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px] space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Opening Bal</label>
            <div className="flex gap-1">
              <input 
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={openingBal}
                onChange={(e) => setOpeningBal(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm"
              />
              <select 
                value={openingType}
                onChange={(e) => setOpeningType(e.target.value as 'Dr' | 'Cr')}
                className="px-2 py-2 bg-white border border-zinc-200 border-l-0 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-[10px] font-bold"
              >
                <option value="Dr">Dr</option>
                <option value="Cr">Cr</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all">
            Save Ledger
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-all">
            Cancel
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Code</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Ledger Name</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Group</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-widest">Opening Bal</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map(ledger => {
                const group = groups.find(g => g.id === ledger.groupId);
                return (
                  <tr key={ledger.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-4 py-4 font-mono text-sm font-bold text-brand-olive">{ledger.accountCode || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{ledger.name}</span>
                        {ledger.isSystem && (
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 text-[10px] rounded uppercase font-bold tracking-tight">System</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-500">{group?.name || 'Unknown'}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-zinc-400">
                      {ledger.openingBalance ? `${ledger.openingBalance.toLocaleString()} ${ledger.openingBalanceType}` : '-'}
                    </td>
                    <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      {!ledger.isSystem && <button className="text-zinc-400 hover:text-zinc-900 text-xs font-bold">Edit</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
