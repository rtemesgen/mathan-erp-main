import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { useAuth } from '../../hooks/useAuth';
import { useBusiness } from '../../hooks/useBusiness';
import { Ledger, VoucherLine, Currency, Voucher, AccountGroup } from '../../types';
import { Plus, Trash2, Loader2, BookMarked, ChevronDown } from 'lucide-react';
import TransactionVoucherLayout from './TransactionVoucherLayout';
import QuickCreateModal from './QuickCreateModal';
import { useUI } from '../../context/UIContext';
import { cn } from '../../lib/utils';

interface JournalFormProps {
  onComplete: () => void;
  editVoucher?: Voucher;
}

export default function JournalForm({ onComplete, editVoucher }: JournalFormProps) {
  const { actor } = useAuth();
  const { business, currency: baseCurrency } = useBusiness();
  const { notify } = useUI();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // UI State for Search/Sidebar
  const [activeField, setActiveField] = useState<{ type: 'ledger', index: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState(editVoucher?.currencyId || '');
  const [exchangeRate, setExchangeRate] = useState<string | number>(editVoucher?.exchangeRate || 1);
  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState(editVoucher?.narration || '');
  const [lines, setLines] = useState<{ 
    ledgerId: string, 
    debit: number, 
    credit: number, 
    txnDebit: string | number, 
    txnCredit: string | number,
    type: 'Dr' | 'Cr'
  }[]>(() => {
    if (editVoucher?.lines) {
      return editVoucher.lines.map(l => {
        const debitVal = Number(l.txnDebit) || Number(l.debit) || 0;
        const creditVal = Number(l.txnCredit) || Number(l.credit) || 0;
        const isDr = debitVal > 0 || creditVal === 0;
        return {
          ...l,
          type: isDr ? 'Dr' as const : 'Cr' as const
        };
      });
    }
    return [
      { ledgerId: '', debit: 0, credit: 0, txnDebit: '', txnCredit: '', type: 'Dr' as const },
      { ledgerId: '', debit: 0, credit: 0, txnDebit: '', txnCredit: '', type: 'Cr' as const }
    ];
  });

  useEffect(() => {
    if (!business) return;
    
    // Ledgers real-time
    const unsubLedgers = onSnapshot(
      query(collection(db, 'ledgers'), where('businessId', '==', business.id)),
      (snap) => {
        setLedgers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ledger[]);
      },
      (err) => handleApiError(err, OperationType.LIST, 'ledgers')
    );

    const fetchData = async () => {
      try {
        const [cSnap, gSnap] = await Promise.all([
          getDocs(collection(db, 'currencies')),
          getDocs(query(collection(db, 'accountGroups'), where('businessId', '==', business.id)))
        ]);
        const allCurrencies = cSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Currency[];
        setCurrencies(allCurrencies);
        setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[]);
        
        if (!editVoucher && baseCurrency) {
          setCurrencyId(baseCurrency.id);
          setExchangeRate(1);
        }
        setLoading(false);
      } catch (err) {
        handleApiError(err, OperationType.GET, 'masters');
      }
    };
    fetchData();

    return () => unsubLedgers();
  }, [business, baseCurrency, editVoucher]);

  const handleQuickCreateSuccess = (id: string) => {
    handleSelectSuggestion(id);
    setShowQuickCreate(false);
  };

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

  const totalDebitTxn = lines.reduce((sum, line) => sum + (Number(line.txnDebit) || 0), 0);
  const totalCreditTxn = lines.reduce((sum, line) => sum + (Number(line.txnCredit) || 0), 0);
  const diffTxn = Math.abs(totalDebitTxn - totalCreditTxn);
  const isBalanced = diffTxn < 0.001 && totalDebitTxn > 0;

  const addLine = () => {
    const diff = totalDebitTxn - totalCreditTxn;
    const defaultType = diff > 0 ? 'Cr' : 'Dr';
    const absDiff = Math.abs(diff);
    const populateAmount = absDiff > 0.001 ? absDiff.toFixed(2) : '';

    setLines([
      ...lines,
      {
        ledgerId: '',
        debit: 0,
        credit: 0,
        txnDebit: defaultType === 'Dr' ? populateAmount : '',
        txnCredit: defaultType === 'Cr' ? populateAmount : '',
        type: defaultType
      }
    ]);
  };
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));
  
  const handleSelectSuggestion = (id: string) => {
    if (!activeField) return;
    updateLine(activeField.index, 'ledgerId', id);
    setActiveField(null);
    setSearchQuery('');
  };

  const updateLine = (index: number, key: string, value: any) => {
    const newLines = [...lines];
    (newLines[index] as any)[key] = value;
    setLines(newLines);
  };

  const handleTypeChange = (index: number, newType: 'Dr' | 'Cr') => {
    const newLines = [...lines];
    const line = newLines[index];
    const existingValue = line.type === 'Dr' ? line.txnDebit : line.txnCredit;
    
    line.type = newType;
    if (newType === 'Dr') {
      line.txnDebit = existingValue;
      line.txnCredit = '';
    } else {
      line.txnCredit = existingValue;
      line.txnDebit = '';
    }
    setLines(newLines);
  };

  const getSuggestions = () => {
    if (!activeField) return [];
    const q = searchQuery.toLowerCase();
    return ledgers
      .filter(l => l.name.toLowerCase().includes(q))
      .map(l => {
        const group = groups.find(g => g.id === l.groupId);
        return { id: l.id, name: l.name, sub: group?.name || 'Ledger Account' };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !actor) return;
    if (!date) { notify.error('Transaction date is required'); return; }
    if (!currencyId) { notify.error('Currency is required'); return; }
    if (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0) { notify.error('Exchange rate must be greater than zero'); return; }

    if (!isBalanced) {
      notify.error(`Journal is not balanced. Difference: ${diffTxn.toLocaleString()}`);
      return;
    }

    if (lines.some(l => !l.ledgerId)) {
      notify.error('Please select ledgers for all rows');
      return;
    }

    if (totalDebitTxn <= 0) {
      notify.error('Transaction amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const rateNum = Number(exchangeRate);
      const voucherLines: VoucherLine[] = lines.map(line => ({
        ...line,
        debit: (Number(line.txnDebit) || 0) * rateNum,
        credit: (Number(line.txnCredit) || 0) * rateNum,
        txnDebit: Number(line.txnDebit) || 0,
        txnCredit: Number(line.txnCredit) || 0
      }));

      const voucherData = {
        businessId: business.id,
        type: 'Journal',
        date,
        number: editVoucher?.number || `JV-${Date.now()}`,
        status: 'Posted',
        narration,
        actorId: actor.id,
        currencyId: currencyId,
        exchangeRate: rateNum || 1,
        lines: voucherLines,
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
      notify.success(`Journal voucher ${editVoucher ? 'updated' : 'posted'} successfully`);
      onComplete();
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>;

  const selectedCurrency = currencies.find(c => c.id === currencyId) || baseCurrency;

  return (
    <TransactionVoucherLayout
      title="Journal Voucher"
      icon={BookMarked}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      activeFieldLabel={activeField?.type}
      onCreateNew={() => setShowQuickCreate(true)}
      onSelectSuggestion={handleSelectSuggestion}
      totalAmount={totalDebitTxn}
      currencyCode={selectedCurrency?.code || ''}
      currencySymbol={selectedCurrency?.symbol || ''}
      exchangeRate={exchangeRate}
      submitting={submitting}
      footerActionLabel="Post Adjustment"
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveField(null)}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 border-b border-zinc-100">
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 font-serif bg-white">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent focus:outline-none italic text-xs" />
        </div>
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white flex flex-col gap-0.5">
            <div className="flex-1">
                <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0 block">CCY</label>
                <div className="relative">
                  <select required
                    value={currencyId} 
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full bg-transparent focus:outline-none font-serif italic text-[10px] text-zinc-800 appearance-none pr-3"
                  >
                    {currencies.filter(c => c.active || c.id === currencyId).map(c => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-zinc-300 pointer-events-none" />
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
        <div className="col-span-2 md:col-span-1 p-1 sm:p-1.5 flex items-center justify-between bg-zinc-50/20 border-t md:border-t-0 border-zinc-100">
          <div>
            <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Status</label>
            <div className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full", isBalanced ? "bg-brand-olive/10 text-brand-olive" : "bg-red-50 text-red-500")}>
              {isBalanced ? "Balanced" : `Diff: ${diffTxn.toLocaleString()}`}
            </div>
          </div>
        </div>
      </div>

      <div className="p-0.5 sm:p-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[320px]">
          <thead>
            <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black w-20 sm:w-24">Type</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black">Particulars</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-16 sm:w-24 font-black">Debit</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-16 sm:w-24 font-black">Credit</th>
              <th className="w-6 sm:w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/5">
            {lines.map((line, index) => (
              <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                <td className="p-1 border-r border-zinc-900/5 w-20 sm:w-24 align-middle">
                  <div className="flex rounded-md bg-zinc-100 p-0.5 items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleTypeChange(index, 'Dr')}
                      className={cn(
                        "flex-1 text-[8px] font-black uppercase tracking-wider py-0.5 rounded transition-all",
                        line.type === 'Dr' 
                          ? "bg-zinc-950 text-white shadow-sm" 
                          : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      Dr
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange(index, 'Cr')}
                      className={cn(
                        "flex-1 text-[8px] font-black uppercase tracking-wider py-0.5 rounded transition-all",
                        line.type === 'Cr' 
                          ? "bg-zinc-950 text-white shadow-sm" 
                          : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      Cr
                    </button>
                  </div>
                </td>
                <td className="p-0 border-r border-zinc-900/5">
                  <input 
                    type="text"
                    placeholder="Select Ledger..."
                    value={ledgers.find(l => l.id === line.ledgerId)?.name || (activeField?.type === 'ledger' && activeField?.index === index ? searchQuery : '')}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { setActiveField({ type: 'ledger', index }); setSearchQuery(''); }}
                    className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 font-serif italic text-[10px] sm:text-sm focus:outline-none text-zinc-800"
                  />
                </td>
                <td className={cn("p-0 border-r border-zinc-900/5 transition-colors", line.type === 'Cr' && "bg-zinc-50/40")}>
                  {line.type === 'Dr' ? (
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00"
                      value={line.txnDebit === 0 ? '' : line.txnDebit} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        updateLine(index, 'txnDebit', val);
                      }} 
                      className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm focus:outline-none" 
                    />
                  ) : (
                    <div className="w-full px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm text-zinc-300 select-none">
                      -
                    </div>
                  )}
                </td>
                <td className={cn("p-0 border-r border-zinc-900/5 transition-colors", line.type === 'Dr' && "bg-zinc-50/40")}>
                  {line.type === 'Cr' ? (
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00"
                      value={line.txnCredit === 0 ? '' : line.txnCredit} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        updateLine(index, 'txnCredit', val);
                      }} 
                      className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm focus:outline-none" 
                    />
                  ) : (
                    <div className="w-full px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm text-zinc-300 select-none">
                      -
                    </div>
                  )}
                </td>
                <td className="px-0.5 text-center">
                  {lines.length > 2 && (
                    <button type="button" onClick={() => removeLine(index)} className="p-0.5 text-zinc-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-950 text-white font-mono">
             <tr>
               <td colSpan={2} className="px-1.5 py-0.5 sm:px-2 sm:py-1 text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-white/40">Totals</td>
               <td className="px-1.5 py-0.5 sm:px-2 sm:py-1 text-right text-[10px] sm:text-xs">{totalDebitTxn.toLocaleString()}</td>
               <td className="px-1.5 py-0.5 sm:px-2 sm:py-1 text-right text-[10px] sm:text-xs">{totalCreditTxn.toLocaleString()}</td>
               <td className="w-6 sm:w-8"></td>
             </tr>
          </tfoot>
        </table>
        <button type="button" onClick={addLine} className="mt-1 sm:mt-2 flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-full text-[7px] font-black uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/10 hover:brightness-110 active:scale-95 transition-all">
          <Plus className="w-2 h-2" /> Add Row
        </button>
      </div>

      {showQuickCreate && activeField && (
        <QuickCreateModal 
          type={activeField.type}
          onClose={() => setShowQuickCreate(false)}
          onSuccess={handleQuickCreateSuccess}
          initialName={searchQuery}
        />
      )}
    </TransactionVoucherLayout>
  );
}
