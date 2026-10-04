import React from 'react';
import { Voucher, Ledger, AccountGroup } from '../../types';
import { Scale } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BalanceSheet({ 
  vouchers, 
  ledgers, 
  groups,
  currency,
  isBase = true,
  serverRows
}: { 
  vouchers: Voucher[], 
  ledgers: Ledger[], 
  groups: AccountGroup[],
  currency?: { code: string; symbol: string; exchangeRate: number },
  isBase?: boolean,
  serverRows?: Array<{ ledgerId: string; ledgerName: string; accountCode?: string; nature: string; balance: number }>
}) {
  const symbol = currency?.symbol || '$';
  
  const ledgerBalances = serverRows ? serverRows.map(row => ({ id: row.ledgerId, name: row.ledgerName, accountCode: row.accountCode, balance: row.balance, nature: row.nature })) : ledgers.map(ledger => {
    let balance = 0;
    const group = groups.find(g => g.id === ledger.groupId);
    if (!group) return null;

    const initialBalance = isBase ? (ledger.openingBalance || 0) : 0;
    const initialType = ledger.openingBalanceType || 'Dr';
    
    // Initial balance in terms of the group's nature
    if (group.nature === 'Asset' || group.nature === 'Expense') {
      balance = initialType === 'Dr' ? initialBalance : -initialBalance;
    } else {
      balance = initialType === 'Cr' ? initialBalance : -initialBalance;
    }

    vouchers.filter(v => v.status === 'Posted').forEach(v => {
      v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
        const lineDebit = l.txnDebit || l.debit || 0;
        const lineCredit = l.txnCredit || l.credit || 0;
        // Tally logic: Assets/Expenses are normally Debit, Liabilities/Income/Equity are normally Credit
        if (group.nature === 'Asset' || group.nature === 'Expense') balance += (lineDebit - lineCredit);
        else balance += (lineCredit - lineDebit);
      });
    });

    return { 
      ...ledger, 
      balance: balance, 
      nature: group.nature 
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  // Filter for Balance Sheet items (Asset, Liability, Equity)
  const bsItems = ledgerBalances.filter(l => l.nature === 'Asset' || l.nature === 'Liability' || l.nature === 'Equity');

  // Profit/Loss calculation for Equity inclusion
  const incomeItems = ledgerBalances.filter(l => l.nature === 'Income');
  const expenseItems = ledgerBalances.filter(l => l.nature === 'Expense');
  const totalIncome = incomeItems.reduce((sum, l) => sum + l.balance, 0);
  const totalExpense = expenseItems.reduce((sum, l) => sum + l.balance, 0);
  const netProfitLoss = totalIncome - totalExpense;

  const totalAssets = bsItems.filter(l => l.nature === 'Asset').reduce((sum, i) => sum + i.balance, 0);
  const totalLiabilities = bsItems.filter(l => l.nature === 'Liability').reduce((sum, i) => sum + i.balance, 0);
  const totalEquity = bsItems.filter(l => l.nature === 'Equity').reduce((sum, i) => sum + i.balance, 0) + netProfitLoss;

  return (
    <div className="p-2 sm:p-6 space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-olive rounded-full flex items-center justify-center shadow-xl shadow-brand-olive/20">
          <Scale className="text-white w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif italic text-zinc-900 tracking-tight">Balance Sheet</h3>
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 mt-1 italic">Position Statement: ({currency?.code || 'Base'})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-2 sm:border-4 border-zinc-900 rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl">
        {/* LIABILITIES & EQUITY */}
        <div className="border-r-0 lg:border-r-2 border-zinc-900">
           <div className="bg-zinc-900 p-3 sm:p-4">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Liabilities & Equity</h4>
           </div>
           
           <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
             <section className="space-y-3 sm:space-y-4">
                <h5 className="text-[8px] font-black uppercase tracking-widest text-zinc-300 pb-1 border-b border-zinc-50">Equities</h5>
                <div className="space-y-2">
                  {bsItems.filter(l => l.nature === 'Equity' && Math.abs(l.balance) > 0.01).map(l => (
                    <div key={l.id} className="flex justify-between items-center group">
                      <span className="font-serif italic text-base sm:text-lg text-zinc-700 group-hover:text-brand-olive transition-colors">{l.name}</span>
                      <span className="font-mono text-zinc-900 font-bold text-sm sm:text-base">{symbol}{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-brand-olive font-serif italic text-base sm:text-lg">
                    <span>Retained Earnings (P&L)</span>
                    <span className="font-mono font-bold">{symbol}{netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
             </section>

             <section className="space-y-3 sm:space-y-4">
                <h5 className="text-[8px] font-black uppercase tracking-widest text-zinc-300 pb-1 border-b border-zinc-50">Current Liabilities</h5>
                <div className="space-y-2">
                  {bsItems.filter(l => l.nature === 'Liability' && Math.abs(l.balance) > 0.01).map(l => (
                    <div key={l.id} className="flex justify-between items-center group">
                      <span className="font-serif italic text-base sm:text-lg text-zinc-700 group-hover:text-brand-olive transition-colors">{l.name}</span>
                      <span className="font-mono text-zinc-900 font-bold text-sm sm:text-base">{symbol}{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {bsItems.filter(l => l.nature === 'Liability').length === 0 && <p className="italic text-zinc-300 text-xs">No liabilities recorded</p>}
                </div>
             </section>
           </div>

           <div className="mt-auto p-4 sm:p-6 bg-brand-beige/50 border-t-2 sm:border-t-4 border-zinc-900">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Capital Context</span>
                <span className="text-2xl sm:text-3xl font-serif italic text-zinc-900 font-bold">{symbol}{(totalLiabilities + totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
           </div>
        </div>

        {/* ASSETS */}
        <div className="bg-brand-beige/10">
           <div className="bg-brand-olive p-3 sm:p-4">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Assets & Resources</h4>
           </div>

           <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
             <section className="space-y-3 sm:space-y-4">
                <h5 className="text-[8px] font-black uppercase tracking-widest text-zinc-300 pb-1 border-b border-zinc-50">Operational Assets</h5>
                <div className="space-y-2">
                  {bsItems.filter(l => l.nature === 'Asset' && Math.abs(l.balance) > 0.01).map(l => (
                    <div key={l.id} className="flex justify-between items-center group">
                      <span className="font-serif italic text-base sm:text-lg text-zinc-700 group-hover:text-brand-olive transition-colors">{l.name}</span>
                      <span className="font-mono text-zinc-900 font-bold text-sm sm:text-base">{symbol}{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
             </section>
           </div>

           <div className="mt-auto p-4 sm:p-6 bg-brand-olive text-white border-t-2 sm:border-t-4 border-zinc-900">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Cumulative Assets</span>
                <span className="text-2xl sm:text-3xl font-serif italic font-bold">{symbol}{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
           </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 bg-zinc-50 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-zinc-200 text-center">
         <p className="text-[8px] font-black uppercase tracking-[0.5em] text-zinc-300">Accountant Verification Node</p>
         <p className="font-serif italic text-zinc-500 mt-2 max-w-md mx-auto text-xs leading-relaxed">
            Every business movement is mathematically enforced. Assets must equate to Liabilities plus Owner's Equity at all temporal intersection points.
         </p>
      </div>
    </div>
  );
}
