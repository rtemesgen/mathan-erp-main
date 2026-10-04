import React from 'react';
import { Voucher, Ledger } from '../../types';

export default function OutstandingReport({ 
  vouchers, 
  ledgers,
  currency,
  serverRows
}: { 
  vouchers: Voucher[], 
  ledgers: Ledger[],
  currency?: { code: string; symbol: string; exchangeRate: number },
  serverRows?: Array<{ ledgerId: string; billNo: string; dueDate?: string; balance: number }>
}) {
  const symbol = currency?.symbol || '$';

  // Aggregate bill details from all posted vouchers
  const bills: { billNo: string; ledgerId: string; amount: number; dueDate?: string }[] = serverRows
    ? serverRows.map(row => ({ billNo: row.billNo, ledgerId: row.ledgerId, amount: row.balance, dueDate: row.dueDate }))
    : [];

  if (!serverRows) vouchers.filter(v => v.status === 'Posted').forEach(v => {
    v.lines?.forEach(l => {
      if (l.billDetails && l.billDetails.length > 0) {
        l.billDetails.forEach(bd => {
          const existing = bills.find(b => b.billNo === bd.billNo && b.ledgerId === l.ledgerId);
          const lineDebit = l.txnDebit || l.debit || 0;
          const val = lineDebit > 0 ? bd.amount : -bd.amount; 
          
          if (existing) {
            existing.amount += val;
          } else {
            bills.push({
              billNo: bd.billNo,
              ledgerId: l.ledgerId,
              amount: val,
              dueDate: bd.dueDate
            });
          }
        });
      }
    });
  });

  const outstanding = bills.filter(b => Math.abs(b.amount) > 0.01);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h3 className="text-xl font-serif italic text-zinc-900">Outstanding Receivables / Payables</h3>
        <p className="text-xs text-zinc-500 uppercase font-black tracking-widest mt-1">Bill-wise analysis of pending references</p>
      </div>

      {outstanding.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-zinc-100 rounded-3xl">
           <p className="text-zinc-300 font-serif italic">No outstanding bills found.</p>
           <p className="text-[10px] text-zinc-400 mt-2">Post vouchers with bill-wise details to see records here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-zinc-900/5">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Bill #</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Party / Ledger</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {outstanding.map((b, i) => (
                <tr key={i} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-5 font-mono text-xs font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">{b.billNo}</td>
                  <td className="px-6 py-5 font-bold text-zinc-900">{ledgers.find(l => l.id === b.ledgerId)?.name || 'Unknown'}</td>
                  <td className="px-6 py-5 text-sm text-zinc-500">{b.dueDate || 'N/A'}</td>
                  <td className={`px-6 py-5 text-right font-mono font-bold ${b.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {symbol}{Math.abs(b.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {b.amount > 0 ? 'Dr' : 'Cr'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
