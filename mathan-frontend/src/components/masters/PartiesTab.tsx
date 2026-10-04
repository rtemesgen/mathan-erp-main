import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, where, getDocs, limit, writeBatch, doc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Party, Ledger, AccountNature, AccountGroup } from '../../types';
import { Plus, Search, Loader2, UserCircle, Briefcase, Users, CheckCircle2, XCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { cn } from '../../lib/utils';
import { required } from '../../lib/validation';
import { toast } from 'sonner';

export default function PartiesTab() {
  const { business } = useBusiness();
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [activeType, setActiveType] = useState<'Customer' | 'Supplier'>('Customer');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!business) return;
    const qParties = query(collection(db, 'parties'), where('businessId', '==', business.id));
    const qLedgers = query(collection(db, 'ledgers'), where('businessId', '==', business.id));
    const qGroups = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));

    const unsubLedgers = onSnapshot(qLedgers, (snapshot) => {
      setLedgers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ledger[]);
    }, (err) => handleApiError(err, OperationType.LIST, 'ledgers'));

    const unsubParties = onSnapshot(qParties, (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Party[]);
      setLoading(false);
    }, (err) => handleApiError(err, OperationType.LIST, 'parties'));

    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AccountGroup[]);
    }, (err) => handleApiError(err, OperationType.LIST, 'groups'));

    return () => { unsubLedgers(); unsubParties(); unsubGroups(); };
  }, [business]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(p => p.id));
    }
  };

  const handleBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (!business || selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Are you sure you want to delete ${selectedIds.length} ${activeType.toLowerCase()}s?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, 'parties', id);
        if (action === 'delete') {
          batch.delete(ref);
        } else {
          batch.update(ref, { active: action === 'activate' });
        }
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Batch Parties');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, `${activeType} name`);
    if (nameError || !business || isSubmitting) { if (nameError) toast.error(nameError); return; }
    setIsSubmitting(true);

    try {
      // 1. Ensure correct group exists
      const groupName = activeType === 'Customer' ? 'Sundry Debtors' : 'Sundry Creditors';
      const groupNature: AccountNature = activeType === 'Customer' ? 'Asset' : 'Liability';
      
      let groupId = groups.find(g => g.name === groupName)?.id;
      
      if (!groupId) {
        const groupRef = await addDoc(collection(db, 'accountGroups'), {
          businessId: business.id,
          name: groupName,
          nature: groupNature
        });
        groupId = groupRef.id;
      }

      // 2. Create Ledger for this Party
      const ledgerRef = await addDoc(collection(db, 'ledgers'), {
        businessId: business.id,
        name: newName.trim(),
        groupId: groupId,
        active: true
      });

      // 3. Create Party linked to Ledger
      await addDoc(collection(db, 'parties'), {
        businessId: business.id,
        name: newName.trim(),
        type: activeType,
        ledgerId: ledgerRef.id,
        active: true
      });

      setNewName('');
      setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'parties');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = parties.filter(p => 
    p.type === activeType && 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8">
      {/* Type Toggle */}
      <div className="flex gap-2 mb-8 bg-zinc-100 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveType('Customer')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeType === 'Customer' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <UserCircle className="w-4 h-4" />
          Customers
        </button>
        <button 
          onClick={() => setActiveType('Supplier')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeType === 'Supplier' ? "bg-white text-purple-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <Briefcase className="w-4 h-4" />
          Suppliers
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder={`Search ${activeType.toLowerCase()}s...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-olive/10 focus:border-brand-olive text-sm font-serif italic"
          />
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl",
            activeType === 'Customer' ? "bg-blue-600 text-white shadow-blue-100/50 hover:bg-blue-700" : "bg-purple-600 text-white shadow-purple-100/50 hover:bg-purple-700"
          )}
        >
          <Plus className="w-4 h-4" />
          Add {activeType}
        </button>
        {filtered.length > 0 && (
          <button 
            onClick={toggleSelectAll}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-all"
          >
            {selectedIds.length === filtered.length ? <CheckSquare className="w-4 h-4 text-zinc-900" /> : <Square className="w-4 h-4" />}
            {selectedIds.length === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] px-8 py-5 rounded-[2.5rem] flex items-center gap-8 z-50 animate-in slide-in-from-bottom-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Selection</span>
            <span className="text-sm font-bold text-zinc-900">{selectedIds.length} {activeType}(s)</span>
          </div>
          <div className="h-8 w-px bg-zinc-100" />
          <div className="flex gap-2">
            <button 
              onClick={() => handleBatchAction('activate')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Activate
            </button>
            <button 
              onClick={() => handleBatchAction('deactivate')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-zinc-50 text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              <XCircle className="w-4 h-4" />
              Deactivate
            </button>
            <button 
              onClick={() => handleBatchAction('delete')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
          <button 
            onClick={() => setSelectedIds([])}
            className="p-2 text-zinc-300 hover:text-zinc-900 transition-colors"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 flex flex-wrap items-end gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="flex-1 min-w-[240px] space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Legal Name of {activeType}</label>
            <input 
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 font-serif text-xl"
              placeholder={activeType === 'Customer' ? "e.g. John Doe / Global Exports" : "e.g. Reliance Supplies Ltd"}
            />
          </div>
          <div className="flex gap-4">
            <button 
              disabled={isSubmitting}
              type="submit" 
              className="px-10 py-4 bg-zinc-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-xl shadow-zinc-900/10 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save {activeType}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-all">
              Cancel
            </button>
          </div>
          <p className="w-full text-[10px] text-zinc-400 ml-4">This will automatically create a ledger account in the {activeType === 'Customer' ? 'Sundry Debtors' : 'Sundry Creditors'} group.</p>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-40"><Loader2 className="animate-spin w-10 h-10 text-zinc-200" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(party => {
            const isSelected = selectedIds.includes(party.id);
            return (
              <div 
                key={party.id} 
                className={cn(
                  "p-6 bg-white border rounded-[2rem] hover:shadow-xl hover:shadow-zinc-900/5 transition-all group relative overflow-hidden cursor-pointer",
                  isSelected ? "border-zinc-900 ring-4 ring-zinc-900/5" : "border-zinc-100"
                )}
                onClick={() => toggleSelect(party.id)}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 text-zinc-900">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    activeType === 'Customer' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                  )}>
                    {activeType === 'Customer' ? <UserCircle className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-serif italic text-zinc-900 truncate">{party.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                      {ledgers.find(l => l.id === party.ledgerId)?.name || 'Processing...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                  <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        party.active ? "bg-emerald-500" : "bg-zinc-200"
                      )} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {party.active ? 'Active' : 'Deactivated'}
                      </span>
                  </div>
                  {!isSelected && (
                    <button className="text-zinc-300 hover:text-zinc-900 transition-colors opacity-0 group-hover:opacity-100">
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-zinc-200 border-2 border-dashed border-zinc-50 rounded-[3rem]">
               <Users className="w-16 h-16 opacity-10 mb-4" />
               <p className="text-sm font-serif italic text-zinc-300">No {activeType.toLowerCase()}s registered yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
