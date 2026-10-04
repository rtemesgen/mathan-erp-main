import React from 'react';
import { Voucher, Ledger, AccountGroup } from '../../types';
import { BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ProfitLoss({ 
  vouchers, 
  ledgers, 
  groups,
  currency,
  serverRows
}: { 
  vouchers: Voucher[], 
  ledgers: Ledger[], 
  groups: AccountGroup[],
  currency?: { code: string; symbol: string; exchangeRate: number },
  serverRows?: Array<{ ledgerId: string; ledgerName: string; accountCode?: string; nature: string; balance: number }>
}) {
  const symbol = currency?.symbol || '$';
  
  const pnlLedgers = serverRows ? serverRows.map(row => ({ id: row.ledgerId, name: row.ledgerName, accountCode: row.accountCode, nature: row.nature, balance: row.balance })) : ledgers.map(ledger => {
    let balance = 0;
    const group = groups.find(g => g.id === ledger.groupId);
    if (!group || (group.nature !== 'Income' && group.nature !== 'Expense')) return null;

    vouchers.filter(v => v.status === 'Posted').forEach(v => {
      v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
        const lineDebit = l.txnDebit || l.debit || 0;
        const lineCredit = l.txnCredit || l.credit || 0;
        // Income is usually credit, Expense is usually debit
        if (group.nature === 'Income') balance += (lineCredit - lineDebit);
        if (group.nature === 'Expense') balance += (lineDebit - lineCredit);
      });
    });

    return { 
      ...ledger, 
      balance: balance, 
      nature: group.nature 
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null && Math.abs(l.balance) > 0.01);

  const totalIncome = pnlLedgers.filter(l => l.nature === 'Income').reduce((sum, l) => sum + l.balance, 0);
  const totalExpense = pnlLedgers.filter(l => l.nature === 'Expense').reduce((sum, l) => sum + l.balance, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="p-2 sm:p-6 space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-olive rounded-full flex items-center justify-center shadow-xl shadow-brand-olive/20 animate-pulse">
          <BarChart2 className="text-white w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif italic text-zinc-900 tracking-tight">Performance Summary</h3>
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 mt-1 italic">Profit & Loss ({currency?.code || 'Base'})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        <section className="space-y-4 sm:space-y-6 group bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[3rem] border border-zinc-50 shadow-brand-olive/5 shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-zinc-100" />
              <h4 className="text-[8px] font-black text-brand-olive uppercase tracking-[0.3em]">Revenue Nodes</h4>
              <div className="h-[1px] flex-1 bg-zinc-100" />
           </div>
           
           <div className="space-y-1 sm:space-y-2">
              {pnlLedgers.filter(l => l.nature === 'Income').map(l => (
                <div key={l.id} className="flex justify-between items-center group/item p-2 sm:p-3 hover:bg-brand-beige/30 rounded-xl sm:rounded-2xl transition-all">
                  <span className="font-serif italic text-base sm:text-lg text-zinc-700 group-hover/item:text-brand-olive">{l.name}</span>
                  <span className="font-mono text-zinc-900 font-bold text-sm sm:text-base">{symbol}{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-4 sm:pt-6 border-t border-zinc-50 px-2 sm:px-4">
                <span className="font-black text-[8px] uppercase tracking-widest text-zinc-400">Total Income Matrix</span>
                <span className="text-xl sm:text-2xl font-serif italic text-brand-olive font-bold">{symbol}{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
           </div>
        </section>

        <section className="space-y-4 sm:space-y-6 group bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[3rem] border border-zinc-50 shadow-brand-olive/5 shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-zinc-100" />
              <h4 className="text-[8px] font-black text-red-400 uppercase tracking-[0.3em]">Operational Outflow</h4>
              <div className="h-[1px] flex-1 bg-zinc-100" />
           </div>
           
           <div className="space-y-1 sm:space-y-2">
              {pnlLedgers.filter(l => l.nature === 'Expense').map(l => (
                <div key={l.id} className="flex justify-between items-center group/item p-2 sm:p-3 hover:bg-red-50/50 rounded-xl sm:rounded-2xl transition-all">
                  <span className="font-serif italic text-base sm:text-lg text-zinc-700 group-hover/item:text-red-500">{l.name}</span>
                  <span className="font-mono text-zinc-900 font-bold text-sm sm:text-base">{symbol}{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-4 sm:pt-6 border-t border-zinc-50 px-2 sm:px-4">
                <span className="font-black text-[8px] uppercase tracking-widest text-zinc-400">Total Expense Yield</span>
                <span className="text-xl sm:text-2xl font-serif italic text-red-500 font-bold">{symbol}{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
           </div>
        </section>
      </div>

      <div className={cn(
        "p-6 sm:p-10 rounded-[3rem] sm:rounded-[4rem] flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-brand-olive/20 relative overflow-hidden transition-all duration-700",
        netProfit >= 0 ? "bg-brand-olive text-white" : "bg-red-600 text-white"
      )}>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="grid grid-cols-12 h-full gap-4 p-8">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="h-4 bg-white rounded-full" />
              ))}
           </div>
        </div>

        <div className="relative z-10 text-center md:text-left">
           <p className="text-[9px] font-black uppercase tracking-[0.5em] opacity-60">Net Operational {netProfit >= 0 ? 'Surplus' : 'Deficit'}</p>
           <h3 className="text-4xl sm:text-6xl font-serif italic mt-2 sm:mt-4 font-bold tracking-tighter">
             {symbol}{Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
           </h3>
        </div>
        
        <div className="relative z-10 mt-6 sm:mt-8 md:mt-0 px-8 py-3 bg-white/10 backdrop-blur-3xl rounded-[2rem] border border-white/20">
           <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-relaxed">
             Profitability index is verified against live voucher streams.
           </p>
        </div>
      </div>
    </div>
  );
}
