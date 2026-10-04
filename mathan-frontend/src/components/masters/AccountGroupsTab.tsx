import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, writeBatch, doc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { AccountGroup, AccountNature } from '../../types';
import { Plus, Search, Loader2, Sparkles, Layers } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { cn } from '../../lib/utils';
import { useUI } from '../../context/UIContext';
import { required } from '../../lib/validation';

export default function AccountGroupsTab() {
  const { business } = useBusiness();
  const { notify } = useUI();
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newNature, setNewNature] = useState<AccountNature>('Asset');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AccountGroup[];
      setGroups(data.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'accountGroups');
    });
  }, [business]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Account group name');
    if (nameError || !business || isSubmitting) { if (nameError) notify.error(nameError); return; }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'accountGroups'), {
        businessId: business.id,
        name: newName.trim(),
        nature: newNature
      });
      setNewName('');
      setShowAdd(false);
      notify.success(`Group "${newName}" created successfully`);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'groups');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setupDefaultGroups = async () => {
    if (!business) return;
    setIsSubmitting(true);
    const defaults: { name: string, nature: AccountNature }[] = [
      { name: 'Sundry Debtors', nature: 'Asset' },
      { name: 'Sundry Creditors', nature: 'Liability' },
      { name: 'Sales Accounts', nature: 'Income' },
      { name: 'Purchase Accounts', nature: 'Expense' },
      { name: 'Cash-in-Hand', nature: 'Asset' },
      { name: 'Bank Accounts', nature: 'Asset' },
      { name: 'Direct Expenses', nature: 'Expense' },
      { name: 'Indirect Expenses', nature: 'Expense' },
      { name: 'Direct Incomes', nature: 'Income' },
      { name: 'Indirect Incomes', nature: 'Income' },
    ];

    try {
      const existingNames = new Set(groups.map(g => g.name.toLowerCase()));
      const toCreate = defaults.filter(d => !existingNames.has(d.name.toLowerCase()));

      if (toCreate.length === 0) {
        notify.info('All standard groups already exist');
        return;
      }

      for (const group of toCreate) {
        await addDoc(collection(db, 'accountGroups'), {
          ...group,
          businessId: business.id
        });
      }
      notify.success(`Created ${toCreate.length} standard groups`);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'setup-groups');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-serif italic text-zinc-900">Account Groups</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Classify your ledgers for precise reporting</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <button 
            onClick={setupDefaultGroups}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Setup Standards
          </button>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Filter groups..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 font-serif italic text-lg"
        />
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 flex flex-wrap items-end gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="flex-2 min-w-[240px] space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Group Name</label>
            <input 
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 font-serif text-xl"
              placeholder="e.g. Fixed Assets"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Financial Nature</label>
            <select 
              value={newNature}
              onChange={(e) => setNewNature(e.target.value as AccountNature)}
              className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 font-serif italic text-lg appearance-none"
            >
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div className="flex gap-4">
            <button 
              disabled={isSubmitting}
              type="submit" 
              className="px-10 py-4 bg-zinc-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Group'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-40"><Loader2 className="animate-spin w-10 h-10 text-zinc-200" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(group => (
            <div key={group.id} className="p-8 bg-white border border-zinc-100 rounded-[2.5rem] hover:shadow-2xl hover:shadow-zinc-900/5 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Layers className="w-16 h-16" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-2">Category</p>
              <h3 className="text-2xl font-serif italic text-zinc-900 mb-4">{group.name}</h3>
              
              <div className="flex items-center justify-between pt-6 border-t border-zinc-50">
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  group.nature === 'Asset' && "bg-blue-50 text-blue-700 border-blue-100",
                  group.nature === 'Liability' && "bg-orange-50 text-orange-700 border-orange-100",
                  group.nature === 'Equity' && "bg-purple-50 text-purple-700 border-purple-100",
                  group.nature === 'Income' && "bg-emerald-50 text-emerald-700 border-emerald-100",
                  group.nature === 'Expense' && "bg-red-50 text-red-700 border-red-100",
                )}>
                  {group.nature}
                </span>
                <span className="text-[10px] font-medium text-zinc-300">Default Group</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-zinc-200 border-2 border-dashed border-zinc-100 rounded-[3rem]">
               <Layers className="w-16 h-16 opacity-10 mb-4" />
               <p className="text-sm font-serif italic text-zinc-300">No account groups found matching your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
