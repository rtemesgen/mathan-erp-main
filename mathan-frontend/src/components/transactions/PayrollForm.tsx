import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Ledger, Employee, VoucherStatus, Voucher, AccountGroup } from '../../types';
import { Loader2, Plus, Trash2, Wallet, UserCircle, Briefcase } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { useAuth } from '../../hooks/useAuth';
import { useUI } from '../../context/UIContext';

import TransactionVoucherLayout from './TransactionVoucherLayout';

export default function PayrollForm({ onComplete, editVoucher }: { onComplete: () => void, editVoucher?: Voucher }) {
  const { business, currency } = useBusiness();
  const { actor } = useAuth();
  const { notify } = useUI();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [activeField, setActiveField] = useState<{ type: 'account' | 'employee', index?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [cashLedgerId, setCashLedgerId] = useState(editVoucher?.lines.find(l => l.credit > 0)?.ledgerId || '');
  const [items, setItems] = useState<{ employeeId: string, amount: string | number }[]>(
    editVoucher?.lines.filter(l => l.debit > 0).map(l => ({ employeeId: l.ledgerId, amount: (l.txnDebit || l.debit) })) ||
    [{ employeeId: '', amount: '' }]
  );
  const [narration, setNarration] = useState(editVoucher?.narration || '');

  useEffect(() => {
    if (!business) return;
    
    const unsubs: (() => void)[] = [];

    const fetchLedgers = async () => {
      try {
        const [qL, qG] = [
          query(collection(db, 'ledgers'), where('businessId', '==', business.id), where('active', '==', true)),
          query(collection(db, 'accountGroups'), where('businessId', '==', business.id))
        ];
        const [snapL, snapG] = await Promise.all([getDocs(qL), getDocs(qG)]);
        const lList = snapL.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ledger));
        setLedgers(lList);
        setGroups(snapG.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountGroup)));
        
        // Auto-select Cash if found
        const cash = lList.find(l => l.name.toLowerCase().includes('cash'));
        if (cash) setCashLedgerId(cash.id);
      } catch (err) {
        handleApiError(err, OperationType.GET, 'ledgers');
      }
    };

    const unsubEmp = onSnapshot(
      query(collection(db, 'employees'), where('businessId', '==', business.id), where('active', '==', true)),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        setLoading(false);
      },
      (err) => handleApiError(err, OperationType.LIST, 'employees')
    );

    fetchLedgers();
    unsubs.push(unsubEmp);

    return () => unsubs.forEach(u => u());
  }, [business]);

  const addItem = () => setItems([...items, { employeeId: '', amount: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleSelectSuggestion = (id: string) => {
    if (activeField?.type === 'account') {
      setCashLedgerId(id);
    } else if (activeField?.type === 'employee' && activeField.index !== undefined) {
      const newItems = [...items];
      newItems[activeField.index].employeeId = id;
      const emp = employees.find(e => e.id === id);
      if (emp) newItems[activeField.index].amount = emp.basicSalary;
      setItems(newItems);
    }
    setActiveField(null);
    setSearchQuery('');
  };

  const getSuggestions = () => {
    if (!activeField) return [];
    const q = searchQuery.toLowerCase();
    
    if (activeField.type === 'employee') {
      return employees
        .filter(e => e.name.toLowerCase().includes(q))
        .map(e => ({ id: e.id, name: e.name, sub: e.designation }));
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
    if (!date) { notify.error('Payroll date is required'); return; }
    
    if (!cashLedgerId) {
      notify.error('Please select a payment account (Cash/Bank)');
      return;
    }
    if (items.some(i => !i.employeeId)) {
      notify.error('Please select employees for all rows');
      return;
    }
    if (items.some(i => Number(i.amount) <= 0)) {
       notify.error('Salary amounts must be greater than zero');
       return;
    }

    setSubmitting(true);
    try {
      const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
      
      const lines = [
        // Total Credit from Cash/Bank
        { ledgerId: cashLedgerId, debit: 0, credit: total },
        // Individual salary entries
        { 
          ledgerId: ledgers.find(l => l.name.toLowerCase().includes('salary'))?.id || cashLedgerId, 
          debit: total, 
          credit: 0 
        }
      ];

      await addDoc(collection(db, 'vouchers'), {
        businessId: business.id,
        type: 'Payroll',
        date,
        number: `PAY-${Date.now()}`,
        status: 'Posted' as VoucherStatus,
        narration: narration || `Salary payment for ${items.length} employees`,
        actorId: actor.id,
        currencyId: currency?.id || business.baseCurrencyId,
        exchangeRate: currency?.exchangeRate || 1,
        lines: lines.map(line => ({
           ...line,
           costCenterId: (line as any).costCenterId || null // Ensure no undefined
        })),
        stockLines: [],
        employeeDetails: items.map(item => ({
          employeeId: item.employeeId,
          amount: Number(item.amount)
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      notify.success('Payroll processed successfully');
      onComplete();
    } catch (error) {
      handleApiError(error, OperationType.WRITE, 'vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-olive" /></div>;

  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <TransactionVoucherLayout
      title="Salary Voucher"
      icon={Briefcase}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      activeFieldLabel={activeField?.type}
      onSelectSuggestion={handleSelectSuggestion}
      totalAmount={totalAmount}
      currencyCode={currency?.code || ''}
      currencySymbol={currency?.symbol || ''}
      exchangeRate={currency?.exchangeRate}
      submitting={submitting}
      footerActionLabel="Process Payroll"
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveField(null)}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 border-b border-zinc-100">
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent focus:outline-none font-serif italic text-xs" />
        </div>
        <div className="p-1 sm:p-1.5 bg-zinc-50/20">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block font-black">Payment From</label>
          <input 
            type="text" 
            placeholder="Search Cash or Bank..." 
            value={ledgers.find(l => l.id === cashLedgerId)?.name || (activeField?.type === 'account' ? searchQuery : '')}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { setActiveField({ type: 'account' }); setSearchQuery(''); }}
            className="w-full bg-transparent focus:outline-none font-serif italic text-xs truncate" 
          />
        </div>
      </div>

      <div className="p-0.5 sm:p-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[320px]">
          <thead>
            <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black text-left">Employee Name</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-18 sm:w-40 font-black">Net Salary</th>
              <th className="w-6 sm:w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/5">
            {items.map((item, index) => (
              <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                <td className="p-0 border-r border-zinc-900/5">
                  <div className="flex items-center gap-1.5 px-1.5 sm:px-2">
                    <UserCircle className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                    <input 
                      type="text"
                      placeholder="Select Employee..."
                      value={employees.find(e => e.id === item.employeeId)?.name || (activeField?.type === 'employee' && activeField?.index === index ? searchQuery : '')}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => { setActiveField({ type: 'employee', index }); setSearchQuery(''); }}
                      className="w-full bg-transparent py-1.5 sm:py-2.5 font-serif italic text-[10px] sm:text-sm focus:outline-none text-zinc-800"
                    />
                  </div>
                </td>
                <td className="p-0 border-r border-zinc-900/5">
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
                    className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2.5 text-right font-mono text-[10px] sm:text-sm focus:outline-none text-zinc-900 font-bold" 
                  />
                </td>
                <td className="px-0.5 text-center font-black">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="p-0.5 text-zinc-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
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
    </TransactionVoucherLayout>
  );
}
