import React from 'react';
import { Voucher, Ledger, AccountGroup } from '../../types';
import { cn } from '../../lib/utils';

export default function TrialBalance({ 
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
  serverRows?: Array<{ ledgerId: string; accountCode?: string; ledgerName: string; groupName?: string; nature: string; debit: number; credit: number; closingBalance: number }>
}) {
  const symbol = currency?.symbol || '$';

  const balances = serverRows ? serverRows.map(row => ({
    id: row.ledgerId,
    name: row.ledgerName,
    accountCode: row.accountCode,
    groupId: ledgers.find(l => l.id === row.ledgerId)?.groupId || '',
    debitBase: row.debit,
    creditBase: row.credit,
    serverClosingBalance: row.closingBalance,
    serverGroupName: row.groupName,
  })).filter(b => b.debitBase !== 0 || b.creditBase !== 0 || b.serverClosingBalance !== 0) : ledgers.map(ledger => {
    let debitBase = 0;
    let creditBase = 0;
    
    // Include opening balances only for the base currency to keep books completely separate
    if (isBase) {
      const group = groups.find(g => g.id === ledger.groupId);
      if (group) {
        if (group.nature === 'Asset' || group.nature === 'Expense') {
          debitBase += (ledger.openingBalance || 0);
        } else {
          creditBase += (ledger.openingBalance || 0);
        }
      }
    }
    
    vouchers.filter(v => v.status === 'Posted').forEach(v => {
      v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
        debitBase += (l.txnDebit || l.debit || 0);
        creditBase += (l.txnCredit || l.credit || 0);
      });
    });

    return {
      ...ledger,
      debitBase,
      creditBase
    };
  }).filter(b => b.debitBase !== 0 || b.creditBase !== 0);

  const totalDebit = balances.reduce((sum, b) => sum + b.debitBase, 0);
  const totalCredit = balances.reduce((sum, b) => sum + b.creditBase, 0);

  return (
    <div className="space-y-6">
      <div className="px-6 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
           Trial Balance ({currency?.code || 'Base'})
         </span>
         {isBase && (
           <span className="text-[9px] bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-bold">
             Includes Opening Balances
           </span>
         )}
      </div>

      <div className="overflow-x-auto px-4">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Code</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ledger Account</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nature</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Debit</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {balances.map(b => {
              const netBalance = 'serverClosingBalance' in b ? b.serverClosingBalance : b.debitBase - b.creditBase;
              const displayDebit = netBalance > 0 ? netBalance : 0;
              const displayCredit = netBalance < 0 ? Math.abs(netBalance) : 0;
              if (displayDebit === 0 && displayCredit === 0) return null;
              
              return (
                <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-brand-olive">{b.accountCode || '—'}</td>
                  <td className="px-3 py-2 text-xs font-bold text-zinc-900">{b.name}</td>
                  <td className="px-3 py-2 text-[9px] text-zinc-500 uppercase tracking-tight">{'serverGroupName' in b ? b.serverGroupName : groups.find(g => g.id === b.groupId)?.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {displayDebit > 0 ? `${symbol}${displayDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {displayCredit > 0 ? `${symbol}${displayCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-zinc-900 text-white font-bold">
              <td colSpan={3} className="px-3 py-3 text-[10px] uppercase tracking-widest text-white/50">Total Ledger Position</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{symbol}{totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{symbol}{totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
