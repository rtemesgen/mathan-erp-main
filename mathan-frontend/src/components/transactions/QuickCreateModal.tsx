import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { useBusiness } from '../../hooks/useBusiness';
import { useUI } from '../../context/UIContext';
import { X, Save, Loader2, UserPlus, Package, Warehouse, Book, Target, Sparkles, ChevronDown, Plus, Wrench } from 'lucide-react';
import { AccountGroup, Ledger, CostCenter, Unit } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface QuickCreateModalProps {
  type: 'party' | 'ledger' | 'product' | 'warehouse' | 'costCenter' | 'unit';
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
  initialName?: string;
}

export default function QuickCreateModal({ type, onClose, onSuccess, initialName = '' }: QuickCreateModalProps) {
  const { business } = useBusiness();
  const { notify, setGlobalLoading } = useUI();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  
  // Ledger/Party Specific
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [partyType, setPartyType] = useState<'Customer' | 'Supplier' | 'Both'>('Both');

  // Product Specific
  const [units, setUnits] = useState<Unit[]>([]);
  const [baseUnitId, setBaseUnitId] = useState('');
  const [sellingPrice, setSellingPrice] = useState<string | number>('');
  const [showUnitCreate, setShowUnitCreate] = useState(false);

  useEffect(() => {
    if (business && (type === 'ledger' || type === 'party')) {
      const fetchGroups = async () => {
        const q = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));
        const snap = await getDocs(q);
        const allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[];
        
        if (allGroups.length > 0) {
          let filtered = allGroups;
          if (type === 'party') {
            filtered = allGroups.filter(g => 
              g.nature === 'Asset' || 
              g.nature === 'Liability' || 
              g.name.toLowerCase().includes('debtor') || 
              g.name.toLowerCase().includes('creditor')
            );
          } else {
            // General ledgers should typically not be in debtor/creditor groups
            filtered = allGroups.filter(g => 
              !g.name.toLowerCase().includes('debtor') && 
              !g.name.toLowerCase().includes('creditor')
            );
          }
          
          setGroups(filtered.length > 0 ? filtered : allGroups);
          
          // Auto-select best match
          let match;
          if (type === 'party') {
            match = filtered.find(g => g.name.toLowerCase().includes('debtor') || g.name.toLowerCase().includes('creditor'));
          } else {
            match = filtered.find(g => g.name.toLowerCase().includes('expense') || g.name.toLowerCase().includes('income'));
          }
          setSelectedGroupId(match?.id || filtered[0]?.id || allGroups[0]?.id || '');
        } else {
          setGroups([]);
        }
      };
      fetchGroups();
    }

    if (business && type === 'product') {
      const fetchUnits = async () => {
        const q = query(collection(db, 'units'), where('businessId', '==', business.id));
        const snap = await getDocs(q);
        const allUnits = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Unit[];
        setUnits(allUnits);
        if (allUnits.length > 0) setBaseUnitId(allUnits[0].id);
      };
      fetchUnits();
    }
  }, [business, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !name.trim()) return;

    setLoading(true);
    try {
      let createdId = '';
      
      if (type === 'ledger') {
        const docRef = await addDoc(collection(db, 'ledgers'), {
          businessId: business.id,
          name,
          groupId: selectedGroupId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      } else if (type === 'party') {
        const ledgerRef = await addDoc(collection(db, 'ledgers'), {
          businessId: business.id,
          name: `${name} (Control)`,
          groupId: selectedGroupId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const docRef = await addDoc(collection(db, 'parties'), {
          businessId: business.id,
          name,
          type: partyType,
          ledgerId: ledgerRef.id,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      } else if (type === 'product') {
        const docRef = await addDoc(collection(db, 'products'), {
          businessId: business.id,
          name,
          baseUnitId,
          sellingPrice,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      } else if (type === 'warehouse') {
        const docRef = await addDoc(collection(db, 'warehouses'), {
          businessId: business.id,
          name,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      } else if (type === 'costCenter') {
        const docRef = await addDoc(collection(db, 'costCenters'), {
          businessId: business.id,
          name,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      } else if (type === 'unit') {
        const docRef = await addDoc(collection(db, 'units'), {
          businessId: business.id,
          name,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        createdId = docRef.id;
      }

      notify.success(`${type} created successfully`);
      onSuccess(createdId, name);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, `Quick Create ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const IconMap = {
    party: UserPlus,
    product: Package,
    warehouse: Warehouse,
    ledger: Book,
    costCenter: Target,
    unit: Sparkles
  };
  const Icon = IconMap[type] || Save;

  const handleUnitCreated = (id: string, unitName: string) => {
    setUnits(prev => [...prev, { id, name: unitName, active: true, businessId: business?.id || '' }]);
    setBaseUnitId(id);
    setShowUnitCreate(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 100 }}
        className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-zinc-100 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-none"
      >
        <div className="p-4 sm:p-6 pb-2 flex items-center justify-between border-b border-zinc-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-lg">
               <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-0 text-left">
              <h2 className="text-base sm:text-lg font-serif italic text-zinc-900 capitalize">Quick {type}</h2>
              <p className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400">Master Data Entry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-3">Entity Identity</label>
            <input 
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
              className="w-full bg-zinc-50 rounded-xl sm:rounded-2xl px-5 py-3.5 focus:outline-none border-2 border-transparent focus:border-zinc-900/5 font-serif italic text-base sm:text-lg text-zinc-900 transition-all placeholder:text-zinc-200"
              placeholder={`Enter name...`}
            />
          </div>

          {(type === 'ledger' || type === 'party') && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-3">Structural Group</label>
              <div className="relative">
              {groups.length === 0 ? (
                <div className="w-full bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl p-4 text-center space-y-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto shadow-sm">
                    <Wrench className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-900">Groups Needed</p>
                    <p className="text-[8px] text-zinc-400">Ledgers require a structural group.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!business) return;
                      setLoading(true);
                      setGlobalLoading(true);
                      try {
                        const standardGroups = [
                          { businessId: business.id, name: 'Fixed Assets', nature: 'Asset' },
                          { businessId: business.id, name: 'Current Assets', nature: 'Asset' },
                          { businessId: business.id, name: 'Sundry Debtors', nature: 'Asset' },
                          { businessId: business.id, name: 'Sundry Creditors', nature: 'Liability' },
                          { businessId: business.id, name: 'Bank & Cash', nature: 'Asset' },
                          { businessId: business.id, name: 'Direct Income', nature: 'Income' },
                          { businessId: business.id, name: 'Direct Expense', nature: 'Expense' },
                          { businessId: business.id, name: 'Capital Account', nature: 'Equity' }
                        ];
                        for (const g of standardGroups) {
                          await addDoc(collection(db, 'accountGroups'), g);
                        }
                        notify.success('Groups initialized');
                        const q = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));
                        const snap = await getDocs(q);
                        const allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[];
                        setGroups(allGroups);
                        if (allGroups.length > 0) setSelectedGroupId(allGroups[0].id);
                      } catch (err) {
                        handleApiError(err, OperationType.WRITE, 'Init Groups');
                      } finally {
                        setLoading(false);
                        setGlobalLoading(false);
                      }
                    }}
                    className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg"
                  >
                    Auto-Initialize Standard Groups
                  </button>
                </div>
              ) : (
                  <>
                    <select 
                      required
                      value={selectedGroupId}
                      onChange={e => setSelectedGroupId(e.target.value)}
                      className="w-full bg-zinc-50 rounded-xl sm:rounded-2xl px-5 py-3.5 focus:outline-none border-2 border-transparent focus:border-zinc-900/5 transition-all font-medium text-sm sm:text-base text-zinc-700 cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Select Master Group</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} — {g.nature}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </>
                )}
              </div>
            </div>
          )}

          {type === 'party' && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-3">Relationship Role</label>
              <div className="flex gap-2 p-1 bg-zinc-50 rounded-xl sm:rounded-2xl">
                {(['Customer', 'Supplier', 'Both'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPartyType(t)}
                    className={cn(
                      "flex-1 py-2 rounded-lg sm:rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      partyType === t ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'product' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-3 flex justify-between">
                  Base Unit
                  <button 
                    type="button" 
                    onClick={() => setShowUnitCreate(true)}
                    className="text-brand-olive hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> New
                  </button>
                </label>
                <div className="relative">
                  <select 
                    required
                    value={baseUnitId}
                    onChange={e => setBaseUnitId(e.target.value)}
                    className="w-full bg-zinc-50 rounded-xl sm:rounded-2xl px-5 py-3.5 focus:outline-none border-2 border-transparent focus:border-zinc-900/5 transition-all font-medium text-sm sm:text-base text-zinc-700 cursor-pointer appearance-none"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-3">Selling Rate</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    value={sellingPrice === 0 ? '' : sellingPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setSellingPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-zinc-50 rounded-xl sm:rounded-2xl px-5 py-3.5 focus:outline-none border-2 border-transparent focus:border-zinc-900/5 font-mono font-bold text-base sm:text-lg transition-all"
                  />
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col items-center gap-3">
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 bg-zinc-950 text-white rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-xl"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Save className="w-4 h-4" />
                  Save entity
                </>
              )}
            </button>
            <p className="text-[8px] font-medium text-zinc-300 italic">Available instantly across all modules.</p>
          </div>
        </div>

        <AnimatePresence>
          {showUnitCreate && (
            <div className="absolute inset-0 z-10">
              <QuickCreateModal 
                type="unit"
                onClose={() => setShowUnitCreate(false)}
                onSuccess={(id, name) => {
                  handleUnitCreated(id, name);
                }}
              />
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
