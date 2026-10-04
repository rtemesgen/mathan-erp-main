import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Ledger, VoucherStatus, CostCenter, Currency, Voucher, AccountGroup } from '../../types';
import { Loader2, Plus, Trash2, Wallet, Target, ChevronDown } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { useAuth } from '../../hooks/useAuth';
import TransactionVoucherLayout from './TransactionVoucherLayout';
import QuickCreateModal from './QuickCreateModal';
import { useUI } from '../../context/UIContext';

interface FinanceVoucherFormProps {
  type: 'Payment' | 'Receipt' | 'Contra';
  onComplete: () => void;
  editVoucher?: Voucher;
}

export default function FinanceVoucherForm({ type, onComplete, editVoucher }: FinanceVoucherFormProps) {
  const { business, currency: baseCurrency } = useBusiness();
  const { actor } = useAuth();
  const { notify } = useUI();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // UI State for Search/Sidebar
  const [activeField, setActiveField] = useState<{ type: 'account' | 'detail' | 'costCenter', index?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [mainAccountId, setMainAccountId] = useState(''); // The Cash/Bank account
  const [currencyId, setCurrencyId] = useState(editVoucher?.currencyId || '');
  const [exchangeRate, setExchangeRate] = useState<string | number>(editVoucher?.exchangeRate || 1);
  const [items, setItems] = useState<{ ledgerId: string; amount: string | number; costCenterId: string; billNo?: string; dueDate?: string }[]>([]);
  const [narration, setNarration] = useState(editVoucher?.narration || '');

  useEffect(() => {
    if (!business) return;
    
    const unsubs: (() => void)[] = [];

    // Ledgers real-time
    const qLedgers = query(collection(db, 'ledgers'), where('businessId', '==', business.id), where('active', '==', true));
    const unsubLedgers = onSnapshot(qLedgers, (snap) => {
      setLedgers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ledger)));
    }, (err) => handleApiError(err, OperationType.LIST, 'ledgers'));
    unsubs.push(unsubLedgers);

    // Cost Centers real-time
    const unsubCC = onSnapshot(
      query(collection(db, 'costCenters'), where('businessId', '==', business.id), where('active', '==', true)),
      (snap) => {
        setCostCenters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCenter)));
        setLoading(false);
      },
      (err) => handleApiError(err, OperationType.LIST, 'costCenters')
    );
    unsubs.push(unsubCC);

    const fetchData = async () => {
      try {
        const [cSnap, gSnap] = await Promise.all([
          getDocs(collection(db, 'currencies')),
          getDocs(query(collection(db, 'accountGroups'), where('businessId', '==', business.id)))
        ]);
        const allCurrencies = cSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Currency[];
        setCurrencies(allCurrencies);
        setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[]);
        
        if (!editVoucher) {
          if (baseCurrency) {
            setCurrencyId(baseCurrency.id);
            setExchangeRate(1);
          }
          setItems([{ ledgerId: '', amount: '', costCenterId: '' }]);
        } else {
          const rate = editVoucher.exchangeRate || 1;
          const mainLine = editVoucher.lines.find(l => (type === 'Receipt' ? l.debit > 0 : l.credit > 0));
          const detailLines = editVoucher.lines.filter(l => (type === 'Receipt' ? l.credit > 0 : l.debit > 0));
          
          if (mainLine) setMainAccountId(mainLine.ledgerId);
          setItems(detailLines.map(dl => ({
            ledgerId: dl.ledgerId,
            amount: (type === 'Receipt' ? dl.credit : dl.debit) / rate,
            costCenterId: dl.costCenterId || '',
            billNo: dl.billDetails?.[0]?.billNo,
            dueDate: dl.billDetails?.[0]?.dueDate
          })));
        }
      } catch (err) {
        handleApiError(err, OperationType.GET, 'masters');
      }
    };

    fetchData();

    return () => unsubs.forEach(u => u());
  }, [business, baseCurrency, editVoucher, type]);

  const handleQuickCreateSuccess = (id: string, name: string) => {
    handleSelectSuggestion(id);
    setShowQuickCreate(false);
  };

  const selectedCurrency = currencies.find(c => c.id === currencyId) || baseCurrency;

  const handleCurrencyChange = (newCurrencyId: string) => {
    setCurrencyId(newCurrencyId);
    const curr = currencies.find(c => c.id === newCurrencyId);
    if (curr) {
      if (newCurrencyId === baseCurrency?.id) {
        setExchangeRate(1);
      } else {
        setExchangeRate(curr.exchangeRate || 1);
      }
    }
  };

  const addItem = () => setItems([...items, { ledgerId: '', amount: '', costCenterId: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleSelectSuggestion = (id: string) => {
    if (!activeField) return;
    if (activeField.type === 'account') {
      setMainAccountId(id);
    } else if (activeField.type === 'detail' && activeField.index !== undefined) {
      const newItems = [...items];
      newItems[activeField.index].ledgerId = id;
      setItems(newItems);
    } else if (activeField.type === 'costCenter' && activeField.index !== undefined) {
      const newItems = [...items];
      newItems[activeField.index].costCenterId = id;
      setItems(newItems);
    }
    setActiveField(null);
    setSearchQuery('');
  };

  const getSuggestions = () => {
    if (!activeField) return [];
    const q = searchQuery.toLowerCase();
    
    if (activeField.type === 'costCenter') {
      return costCenters
        .filter(c => c.name.toLowerCase().includes(q))
        .map(c => ({ id: c.id, name: c.name, sub: 'Cost Center' }));
    }

    return ledgers
      .filter(l => l.name.toLowerCase().includes(q))
      .map(l => {
        const group = groups.find(g => g.id === l.groupId);
        return { id: l.id, name: l.name, sub: group?.name || 'Ledger' };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !actor) return;
    if (!date) { notify.error('Transaction date is required'); return; }
    if (!currencyId) { notify.error('Currency is required'); return; }
    if (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0) { notify.error('Exchange rate must be greater than zero'); return; }
    
    if (!mainAccountId) {
      notify.error(`Please select a ${type === 'Receipt' ? 'Debit' : 'Credit'} Account (Cash/Bank)`);
      return;
    }
    if (items.some(i => !i.ledgerId)) {
      notify.error('Please select details accounts for all lines');
      return;
    }
    if (items.some(i => i.amount <= 0)) {
      notify.error('All amounts must be greater than zero');
      return;
    }
    if (items.reduce((sum, item) => sum + Number(item.amount), 0) <= 0) { notify.error('Voucher amount must be greater than zero'); return; }

    setSubmitting(true);
    try {
      const rateNum = Number(exchangeRate);
      const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalAmountBase = totalAmount * rateNum;
      
      const lines = [
        // Main Account Entry (Base Currency + Txn Currency)
        {
          ledgerId: mainAccountId,
          debit: type === 'Receipt' ? totalAmountBase : 0,
          credit: (type === 'Payment' || type === 'Contra') ? totalAmountBase : 0,
          txnDebit: type === 'Receipt' ? totalAmount : 0,
          txnCredit: (type === 'Payment' || type === 'Contra') ? totalAmount : 0,
        },
        // Detailed Entries (Base Currency + Txn Currency)
        ...items.map(item => ({
          ledgerId: item.ledgerId,
          debit: (type === 'Payment' || type === 'Contra') ? Number(item.amount) * rateNum : 0,
          credit: type === 'Receipt' ? Number(item.amount) * rateNum : 0,
          txnDebit: (type === 'Payment' || type === 'Contra') ? Number(item.amount) : 0,
          txnCredit: type === 'Receipt' ? Number(item.amount) : 0,
          costCenterId: item.costCenterId || undefined,
          billDetails: item.billNo ? [{ billNo: item.billNo, amount: Number(item.amount), dueDate: item.dueDate }] : undefined
        }))
      ];

      const voucherData = {
        businessId: business.id,
        type,
        date,
        number: editVoucher?.number || `${type.charAt(0)}V-${Date.now()}`,
        status: 'Posted' as VoucherStatus,
        narration,
        actorId: actor.id,
        currencyId: currencyId,
        exchangeRate: rateNum || 1,
        lines: lines.map(line => ({
          ...line,
          costCenterId: line.costCenterId || null // Ensure no undefined
        })),
        stockLines: [],
        updatedAt: serverTimestamp()
      };

      if (editVoucher) {
        await updateDoc(doc(db, 'vouchers', editVoucher.id), voucherData);
      } else {
        await addDoc(collection(db, 'vouchers'), {
          ...voucherData,
          createdAt: serverTimestamp()
        });
      }
      notify.success(`${type} voucher ${editVoucher ? 'updated' : 'posted'} successfully`);
      onComplete();
    } catch (error) {
      handleApiError(error, OperationType.WRITE, 'vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-olive" /></div>;

  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <TransactionVoucherLayout
      title={`${type} Voucher`}
      icon={Wallet}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      activeFieldLabel={activeField?.type === 'account' || activeField?.type === 'detail' ? 'ledger' : activeField?.type}
      onCreateNew={() => setShowQuickCreate(true)}
      onSelectSuggestion={handleSelectSuggestion}
      totalAmount={totalAmount}
      currencyCode={selectedCurrency?.code || ''}
      currencySymbol={selectedCurrency?.symbol || ''}
      exchangeRate={exchangeRate}
      submitting={submitting}
      footerActionLabel={`Confirm & Post ${type}`}
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveField(null)}
      onSubmit={handleSubmit}
    >
        <div className="grid grid-cols-2 md:grid-cols-3 border-b border-zinc-900/5 bg-white">
          <div className="p-1 sm:p-1 border-r border-zinc-100 bg-brand-beige/5">
            <label className="block text-[6px] font-black uppercase tracking-widest mb-0 text-zinc-300">Date</label>
            <input 
              type="date" required
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-full bg-transparent focus:outline-none font-serif italic text-[10px]" 
            />
          </div>
          <div className="p-1 sm:p-1 border-r border-zinc-100 bg-white">
            <label className="block text-[6px] font-black uppercase tracking-widest mb-0 text-zinc-300">
              Account ({type === 'Receipt' ? 'Dr' : 'Cr'})
            </label>
            <input 
              type="text"
              placeholder="Search..."
              value={ledgers.find(l => l.id === mainAccountId)?.name || (activeField?.type === 'account' ? searchQuery : '')}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setActiveField({ type: 'account' });
                setSearchQuery('');
              }}
              className="w-full bg-transparent focus:outline-none font-serif italic text-[10px] text-zinc-800 focus:text-brand-olive truncate"
            />
          </div>
          <div className="col-span-2 md:col-span-1 p-1 sm:p-1 bg-zinc-50/20 flex items-center justify-between gap-0.5 border-t md:border-t-0 border-zinc-100">
             <div className="flex-1">
                <label className="text-[6px] font-black uppercase tracking-widest text-zinc-300 mb-0 block">CCY</label>
                <div className="relative">
                  <select required
                    value={currencyId} 
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full bg-transparent focus:outline-none font-serif italic text-[9px] text-zinc-800 appearance-none pr-3"
                  >
                    {currencies.filter(c => c.active || c.id === currencyId).map(c => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 text-zinc-300 pointer-events-none" />
                </div>
             </div>
             {currencyId !== baseCurrency?.id && (
                 <div className="flex items-center gap-0.5">
                    <label className="text-[6px] font-black uppercase tracking-widest text-brand-olive mb-0">Rate:</label>
                    <input required
                      type="text" 
                      inputMode="decimal"
                      placeholder="1.0"
                      value={exchangeRate} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setExchangeRate(val);
                      }}
                      className="bg-transparent focus:outline-none font-mono text-[8px] text-brand-olive font-bold w-10" 
                    />
                 </div>
             )}
          </div>
        </div>

        <div className="p-0.5 sm:p-1 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[320px]">
            <thead>
              <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
                <th className="px-1 py-1 sm:px-1.5 sm:py-1">Particulars & Allocation</th>
                <th className="px-1 py-1 sm:px-1.5 sm:py-1 text-right w-14 sm:w-24 font-black">Amount</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/5">
              {items.map((item, index) => (
                <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                  <td className="p-0 border-r border-zinc-900/5">
                    <div className="flex flex-col">
                      <input 
                        type="text" 
                        placeholder="Select Account..."
                        value={ledgers.find(l => l.id === item.ledgerId)?.name || (activeField?.type === 'detail' && activeField?.index === index ? searchQuery : '')}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                          setActiveField({ type: 'detail', index });
                          setSearchQuery('');
                        }}
                        className="w-full bg-transparent px-1.5 py-1 sm:px-2 sm:py-1.5 font-serif italic text-[10px] sm:text-sm focus:outline-none focus:text-brand-olive text-zinc-800"
                      />
                      <div className="flex items-center gap-1 px-1.5 pb-0.5 sm:px-2 sm:pb-1 -mt-0.5 underline decoration-dotted decoration-zinc-200">
                        <Target className="w-2 h-2 text-zinc-300" />
                        <input 
                          type="text"
                          placeholder="Alloc. to Cost Center..."
                          value={costCenters.find(c => c.id === item.costCenterId)?.name || (activeField?.type === 'costCenter' && activeField?.index === index ? searchQuery : '')}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => {
                            setActiveField({ type: 'costCenter', index });
                            setSearchQuery('');
                          }}
                          className="text-[7px] uppercase font-black tracking-widest text-zinc-300 focus:text-zinc-500 focus:outline-none bg-transparent w-full"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-0 text-right">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00"
                      value={item.amount === 0 ? '' : item.amount} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const newItems = [...items];
                        newItems[index].amount = val;
                        setItems(newItems);
                      }}
                      className="w-full bg-transparent px-1.5 py-1 sm:px-2 sm:py-1.5 font-mono text-[10px] sm:text-sm text-right focus:outline-none text-zinc-900 font-bold"
                    />
                  </td>
                  <td className="text-center px-0.5">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="text-zinc-200 hover:text-red-500 p-0.5 transition-opacity opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="mt-1 sm:mt-2 flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-full text-[7px] font-black uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/10 hover:brightness-110 active:scale-95 transition-all">
            <Plus className="w-2 h-2" /> Add Row
          </button>
        </div>

        {showQuickCreate && activeField && (
          <QuickCreateModal 
            type={activeField.type === 'account' || activeField.type === 'detail' ? 'ledger' : 'costCenter'}
            onClose={() => setShowQuickCreate(false)}
            onSuccess={handleQuickCreateSuccess}
            initialName={searchQuery}
          />
        )}
    </TransactionVoucherLayout>
  );
}
