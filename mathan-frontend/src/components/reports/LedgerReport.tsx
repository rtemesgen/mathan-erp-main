import React, { useState } from 'react';
import { Voucher, Ledger, Currency } from '../../types';
import { cn } from '../../lib/utils';
import { Search, ChevronRight, FileText, Calendar, User, Filter } from 'lucide-react';

interface LedgerReportProps {
  vouchers: Voucher[];
  ledgers: Ledger[];
  currency: Currency;
  isBase?: boolean;
  startDate?: string;
  setStartDate?: (val: string) => void;
  endDate?: string;
  setEndDate?: (val: string) => void;
}

export default function LedgerReport({ 
  vouchers, 
  ledgers, 
  currency, 
  isBase = true,
  startDate: externalStartDate,
  setStartDate: externalSetStartDate,
  endDate: externalEndDate,
  setEndDate: externalSetEndDate
}: LedgerReportProps) {
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  
  const [localStartDate, localSetStartDate] = useState<string>('');
  const [localEndDate, localSetEndDate] = useState<string>('');
  
  const startDate = externalStartDate !== undefined ? externalStartDate : localStartDate;
  const setStartDate = externalSetStartDate || localSetStartDate;

  const endDate = externalEndDate !== undefined ? externalEndDate : localEndDate;
  const setEndDate = externalSetEndDate || localSetEndDate;

  const [actorFilter, setActorFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);

  const filteredLedgers = ledgers.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLedger = ledgers.find(l => l.id === selectedLedgerId);

  // Calculate transactions for selected ledger
  const allLedgerTransactions = selectedLedgerId ? vouchers.flatMap(v => 
    v.lines
      .filter(line => line.ledgerId === selectedLedgerId)
      .map(line => ({
        date: v.date,
        type: v.type,
        number: v.number,
        id: v.id,
        narration: v.narration,
        debit: line.txnDebit || line.debit || 0,
        credit: line.txnCredit || line.credit || 0,
        status: v.status
      }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

  const voucherTypes = ['All', ...new Set(vouchers.map(v => v.type))];
  const actors = ['All', ...new Set(vouchers.map(v => v.actorId))];

  const transactions = allLedgerTransactions.filter(t => {
    const typeMatch = typeFilter === 'All' || t.type === typeFilter;
    const dateMatch = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
    const actorMatch = actorFilter === 'All' || vouchers.find(v => v.id === t.id)?.actorId === actorFilter;
    return typeMatch && dateMatch && actorMatch;
  });

  const initialBalance = isBase ? (selectedLedger?.openingBalance || 0) : 0;
  const initialType = selectedLedger?.openingBalanceType || 'Dr';
  let runningBalance = initialType === 'Dr' ? initialBalance : -initialBalance;

  const balanceHistory = transactions.map(t => {
    if (t.status !== 'Cancelled') {
      runningBalance += (t.debit - t.credit);
    }
    return { ...t, balance: runningBalance };
  }).reverse();

  if (!selectedLedgerId) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-4 bg-zinc-50 px-6 py-4 rounded-[2rem] border border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search ledger account..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent focus:outline-none font-serif italic text-xl text-zinc-800 w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLedgers.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLedgerId(l.id)}
              className="flex items-center justify-between p-6 bg-white border border-zinc-100 rounded-3xl hover:border-brand-olive hover:shadow-xl hover:shadow-zinc-900/5 transition-all group"
            >
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-brand-olive transition-colors mb-1">Ledger Account</p>
                <h3 className="text-xl font-serif italic text-zinc-900">{l.name}</h3>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-200 group-hover:text-brand-olive transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedLedgerId(null)}
            className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif italic text-zinc-900">{selectedLedger?.name}</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Ledger Statement & History</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-xl border transition-all flex items-center gap-2",
              showFilters ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"
            )}
          >
            <Filter className={cn("w-3.5 h-3.5", showFilters ? "animate-pulse" : "")} />
            <span className="text-[9px] font-black uppercase tracking-widest px-1">Filters</span>
          </button>

          <div className="text-right">
             <p className="text-[8px] font-black uppercase tracking-widest text-zinc-300">Closing Balance</p>
             <p className={cn(
               "text-xl sm:text-2xl font-serif italic whitespace-nowrap",
               runningBalance >= 0 ? "text-emerald-600" : "text-red-500"
             )}>
               {currency.symbol} {Math.abs(runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {runningBalance >= 0 ? 'Dr' : 'Cr'}
             </p>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-zinc-50 border-b border-zinc-100 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 animate-in slide-in-from-top-4">
          <div className="space-y-1.5">
             <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <Calendar className="w-2.5 h-2.5" /> Start Date
             </label>
             <input 
               type="date"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
             />
          </div>
          <div className="space-y-1.5">
             <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <Calendar className="w-2.5 h-2.5" /> End Date
             </label>
             <input 
               type="date"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
             />
          </div>
          <div className="space-y-1.5">
             <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <Filter className="w-2.5 h-2.5" /> Voucher Type
             </label>
             <select
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value)}
               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all appearance-none"
             >
               {voucherTypes.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <div className="space-y-1.5">
             <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <User className="w-2.5 h-2.5" /> User/Actor
             </label>
             <select
               value={actorFilter}
               onChange={(e) => setActorFilter(e.target.value)}
               className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all appearance-none"
             >
               {actors.map(a => <option key={a} value={a}>{a === 'All' ? 'All Users' : `User ID: ${a.slice(-4)}`}</option>)}
             </select>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-zinc-50/50 sticky top-0 z-10">
              <th className="px-4 py-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 leading-tight">Date</th>
              <th className="px-4 py-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 leading-tight">Type / Ref</th>
              <th className="px-4 py-2 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 leading-tight">Debit ({currency.symbol})</th>
              <th className="px-4 py-2 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 leading-tight">Credit ({currency.symbol})</th>
              <th className="px-4 py-2 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-100 leading-tight">Balance ({currency.symbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {/* Opening Balance Row */}
            <tr className="bg-zinc-50/30">
              <td className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-300">Start</td>
              <td className="px-4 py-2 font-serif italic text-sm text-zinc-500">Opening Balance</td>
              <td className="px-4 py-2 text-right text-zinc-300 font-mono text-xs">
                {initialType === 'Dr' && initialBalance > 0 ? initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
              </td>
              <td className="px-4 py-2 text-right text-zinc-300 font-mono text-xs">
                {initialType === 'Cr' && initialBalance > 0 ? initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs text-zinc-400">
                {initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {initialType}
              </td>
            </tr>

            {balanceHistory.map((t, i) => (
              <tr key={i} className={cn("hover:bg-zinc-50/50 transition-colors", t.status === 'Cancelled' && "opacity-40 grayscale")}>
                <td className="px-4 py-2 text-xs font-medium text-zinc-600 whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center">
                       <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-900 leading-none">{t.type}</p>
                       <p className="text-[9px] font-medium text-zinc-400 leading-none mt-0.5">{t.number}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-zinc-900">
                  {t.debit > 0 ? t.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-zinc-900">
                  {t.credit > 0 ? t.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className={cn(
                  "px-4 py-2 text-right font-mono text-xs font-bold",
                  t.balance >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {Math.abs(t.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.balance >= 0 ? 'Dr' : 'Cr'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {balanceHistory.length === 0 && (
          <div className="py-40 flex flex-col items-center justify-center text-zinc-200">
             <FileText className="w-16 h-16 opacity-10 mb-4" />
             <p className="text-sm font-serif italic text-zinc-300">No transactions found for this ledger period.</p>
          </div>
        )}
      </div>
    </div>
  );
}
