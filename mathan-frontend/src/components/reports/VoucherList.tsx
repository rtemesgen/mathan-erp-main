import React, { useState } from 'react';
import { Voucher, Ledger, Product, Warehouse } from '../../types';
import { cn } from '../../lib/utils';
import { Eye, Edit3, XCircle, Trash2, Loader2, X, Filter, Calendar, User, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, deleteDoc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { motion, AnimatePresence } from 'motion/react';

interface VoucherListProps {
  vouchers: Voucher[];
  ledgers?: Ledger[];
  products?: Product[];
  warehouses?: Warehouse[];
  onEdit?: (v: Voucher) => void;
  search?: string;
  setSearch?: (val: string) => void;
  typeFilter?: string;
  setTypeFilter?: (val: string) => void;
  statusFilter?: string;
  setStatusFilter?: (val: string) => void;
  startDate?: string;
  setStartDate?: (val: string) => void;
  endDate?: string;
  setEndDate?: (val: string) => void;
  actorFilter?: string;
  setActorFilter?: (val: string) => void;
}

export default function VoucherList({ 
  vouchers, 
  onEdit, 
  ledgers = [], 
  products = [], 
  warehouses = [],
  search: externalSearch,
  setSearch: externalSetSearch,
  typeFilter: externalTypeFilter,
  setTypeFilter: externalSetTypeFilter,
  statusFilter: externalStatusFilter,
  setStatusFilter: externalSetStatusFilter,
  startDate: externalStartDate,
  setStartDate: externalSetStartDate,
  endDate: externalEndDate,
  setEndDate: externalSetEndDate,
  actorFilter: externalActorFilter,
  setActorFilter: externalSetActorFilter
}: VoucherListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [pendingAction, setPendingAction] = useState<{ voucherId: string; type: 'Cancel' } | null>(null);
  
  const [localSearch, localSetSearch] = useState('');
  const [localTypeFilter, localSetTypeFilter] = useState('All');
  const [localStatusFilter, localSetStatusFilter] = useState('All');
  const [localStartDate, localSetStartDate] = useState('');
  const [localEndDate, localSetEndDate] = useState('');
  const [localActorFilter, localSetActorFilter] = useState('All');

  const search = externalSearch !== undefined ? externalSearch : localSearch;
  const setSearch = externalSetSearch || localSetSearch;

  const typeFilter = externalTypeFilter !== undefined ? externalTypeFilter : localTypeFilter;
  const setTypeFilter = externalSetTypeFilter || localSetTypeFilter;

  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : localStatusFilter;
  const setStatusFilter = externalSetStatusFilter || localSetStatusFilter;

  const startDate = externalStartDate !== undefined ? externalStartDate : localStartDate;
  const setStartDate = externalSetStartDate || localSetStartDate;

  const endDate = externalEndDate !== undefined ? externalEndDate : localEndDate;
  const setEndDate = externalSetEndDate || localSetEndDate;

  const actorFilter = externalActorFilter !== undefined ? externalActorFilter : localActorFilter;
  const setActorFilter = externalSetActorFilter || localSetActorFilter;

  const [showFilters, setShowFilters] = useState(false);
  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedVouchers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const voucherTypes = ['All', ...new Set(vouchers.map(v => v.type))];
  const statuses = ['All', ...new Set(vouchers.map(v => v.status))];
  const actors = ['All', ...new Set(vouchers.map(v => v.actorId))];

  const filtered = vouchers.filter(v => {
    const searchMatch = v.number.toLowerCase().includes(search.toLowerCase()) || (v.narration || '').toLowerCase().includes(search.toLowerCase());
    const typeMatch = typeFilter === 'All' || v.type === typeFilter;
    const statusMatch = statusFilter === 'All' || v.status === statusFilter;
    const dateMatch = (!startDate || v.date >= startDate) && (!endDate || v.date <= endDate);
    const actorMatch = actorFilter === 'All' || v.actorId === actorFilter;
    return searchMatch && typeMatch && statusMatch && dateMatch && actorMatch;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAction = (v: Voucher, type: 'Cancel') => {
    setPendingAction({ voucherId: v.id, type });
  };

  const executeAction = async (v: Voucher, type: 'Cancel') => {
    setProcessingId(v.id);
    setPendingAction(null);
    try {
      // The backend exposes cancellation as POST /vouchers/{id}/cancel.
      // A partial PUT containing only status is not a valid voucher update.
      await deleteDoc(doc(db, 'vouchers', v.id));
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Voucher Action');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search voucher # or narration..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 text-sm"
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl border transition-all text-sm font-bold uppercase tracking-widest",
            showFilters ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-900 hover:text-zinc-900"
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="mx-6 p-6 bg-zinc-50 rounded-3xl border border-zinc-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              <Calendar className="w-3 h-3" /> Date Range
            </label>
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-white border border-zinc-100 rounded-xl px-4 py-2 text-xs focus:outline-none">
              {voucherTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-white border border-zinc-100 rounded-xl px-4 py-2 text-xs focus:outline-none">
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              <User className="w-3 h-3" /> Performed By
            </label>
            <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="w-full bg-white border border-zinc-100 rounded-xl px-4 py-2 text-xs focus:outline-none">
              {actors.map(a => <option key={a} value={a}>{a === 'All' ? 'All Users' : `User: ${a.slice(-4)}`}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-zinc-50/50 border-b border-zinc-100">
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Date</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Particulars</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Type</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Reference</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Narration</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none text-right">Amount</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none text-right whitespace-nowrap leading-none">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 font-sans">
          {sorted.map(v => {
            const amount = v.lines?.length
              ? v.lines.reduce((sum, l) => sum + (l.txnDebit !== undefined ? l.txnDebit : l.debit), 0)
              : (v.stockLines?.length
                ? v.stockLines.reduce((sum, sl) => sum + Math.abs(sl.quantity) * (sl.rate || 0), 0)
                : 0);

            return (
              <tr key={v.id} className={cn(
                "hover:bg-zinc-50/50 transition-colors group",
                processingId === v.id && "bg-brand-olive/5 animate-pulse"
              )}>
                <td className="px-3 py-2 sm:px-4 sm:py-3">
                  <span className="text-sm font-medium text-zinc-900">{new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 min-w-[220px]">
                  {(() => {
                    const sortedLines = [...(v.lines || [])].sort((a, b) => {
                      const aDebit = a.debit > 0;
                      const bDebit = b.debit > 0;
                      if (aDebit && !bDebit) return -1;
                      if (!aDebit && bDebit) return 1;
                      return 0;
                    });
                    
                    if (!sortedLines.length) {
                      if (v.stockLines && v.stockLines.length > 0) {
                        return (
                          <div className="space-y-1.5 py-1 bg-zinc-50/50 p-2.5 rounded-2xl border border-zinc-100/60 max-w-md">
                            {v.stockLines.map((sl, idx) => {
                              const prod = products.find(p => p.id === sl.productId);
                              const subtotal = Math.abs(sl.quantity) * (sl.rate || 0);
                              return (
                                <div key={idx} className="flex items-center justify-between text-[10px] sm:text-[11px] py-1 px-2 rounded-lg transition-colors hover:bg-zinc-100/30">
                                  <div className="flex items-center gap-1">
                                    <span className="font-serif italic uppercase tracking-tight text-zinc-950 font-bold">
                                      {prod?.name || 'Unknown Item'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500">
                                    <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-100">
                                      {sl.quantity > 0 ? 'In' : 'Out'}
                                    </span>
                                    <span>
                                      {Math.abs(sl.quantity)} x {sl.rate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="font-bold text-zinc-900 ml-1">
                                      {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return <span className="text-zinc-400 text-xs italic">No lines</span>;
                    }

                    return (
                      <div className="space-y-1.5 py-1 bg-zinc-50/50 p-2.5 rounded-2xl border border-zinc-100/60 max-w-md animate-in fade-in duration-200">
                        {sortedLines.map((line, idx) => {
                          const lineLedger = ledgers.find(led => led.id === line.ledgerId);
                          const isDebit = line.debit > 0;
                          const lineAmount = line.debit || line.credit || 0;
                          return (
                            <div key={idx} className={cn(
                              "flex items-center justify-between text-[11px] sm:text-xs py-1 px-2 rounded-lg transition-colors hover:bg-zinc-100/30",
                              !isDebit && "pl-5 text-zinc-500"
                            )}>
                              <div className="flex items-center gap-1">
                                {!isDebit && <span className="text-[10px] text-zinc-400 font-serif italic">To</span>}
                                <span className={cn(
                                  "font-serif italic uppercase tracking-tight",
                                  isDebit ? "text-zinc-950 font-bold" : "text-zinc-600"
                                )}>
                                  {lineLedger?.name || 'Unknown Account'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500">
                                <span className={cn(
                                  "text-[7px] font-black uppercase tracking-widest px-1 py-0.2 rounded border",
                                  isDebit ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                                )}>
                                  {isDebit ? 'Dr' : 'Cr'}
                                </span>
                                <span className="font-bold">
                                  {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                    v.type === 'Sale' && "bg-blue-50 text-blue-700",
                    v.type === 'Purchase' && "bg-purple-50 text-purple-700",
                    v.type === 'Journal' && "bg-zinc-100 text-zinc-700",
                    v.type === 'Payroll' && "bg-brand-olive/10 text-brand-olive",
                    v.type === 'Payment' && "bg-red-50 text-red-700",
                    v.type === 'Receipt' && "bg-green-50 text-green-700",
                    v.type === 'Contra' && "bg-orange-50 text-orange-700",
                  )}>
                    {v.type}
                  </span>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3">
                  <button 
                    onClick={() => onEdit ? onEdit(v) : setViewingVoucher(v)}
                    className="font-mono text-[11px] sm:text-sm font-black text-zinc-900 hover:text-brand-olive transition-colors underline decoration-dotted decoration-zinc-200 underline-offset-4"
                  >
                    {v.number}
                  </button>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 font-sans max-w-[180px] truncate">
                  {v.narration ? (
                    <span className="text-[11px] text-zinc-600 font-medium italic" title={v.narration}>
                      "{v.narration}"
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 italic">No narration</span>
                  )}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-mono font-bold text-zinc-900 bg-zinc-50 px-2 py-1 rounded border border-zinc-100">
                      {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                      v.status === 'Posted' 
                        ? "bg-emerald-50/50 text-emerald-700 border-emerald-100" 
                        : v.status === 'Cancelled' 
                          ? "bg-rose-50/50 text-rose-700 border-rose-100" 
                          : "bg-amber-50/50 text-amber-700 border-amber-100"
                    )}>
                      {v.status}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">
                  {pendingAction && pendingAction.voucherId === v.id ? (
                    <div className="flex items-center justify-end gap-1.5 bg-zinc-100 border border-zinc-200 rounded-lg p-1 animate-in zoom-in-95 duration-150">
                      <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500 pl-1.5">
                        Sure?
                      </span>
                      <button
                        onClick={() => executeAction(v, pendingAction.type)}
                        className="p-1 hover:bg-emerald-50 rounded text-emerald-600 font-black text-[9px] flex items-center justify-center border border-transparent hover:border-emerald-100 cursor-pointer"
                        title="Yes, execute"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setPendingAction(null)}
                        className="p-1 hover:bg-rose-50 rounded text-rose-600 font-black text-[9px] flex items-center justify-center border border-transparent hover:border-rose-100 cursor-pointer"
                        title="Cancel"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {/* Cancel button */}
                      {v.status === 'Posted' && (
                        <button 
                          disabled={!!processingId}
                          onClick={() => handleAction(v, 'Cancel')}
                          title="Cancel Voucher" 
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-400 hover:text-rose-600 shadow-sm border border-transparent hover:border-rose-100 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {processingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      )}


                      {/* Edit button */}
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(v)}
                          title="Edit Voucher" 
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 shadow-sm border border-transparent hover:border-zinc-200 transition-all active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

      </table>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {viewingVoucher && (
           <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-zinc-900/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, y: 100 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 100 }}
               className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl w-full max-w-4xl h-[92vh] sm:max-h-[85vh] flex flex-col p-6 sm:p-8 overflow-hidden"
             >
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-serif italic text-zinc-900">{viewingVoucher.type} Details</h2>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-300">Transaction Ref: {viewingVoucher.number}</p>
                  </div>
                  <button onClick={() => setViewingVoucher(null)} className="p-3 sm:p-4 hover:bg-zinc-50 rounded-full transition-all">
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 sm:space-y-8 sm:pr-4 scrollbar-hide">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 p-6 sm:p-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                     <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Date</label>
                        <p className="font-serif italic text-lg">{viewingVoucher.date}</p>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Status</label>
                        <p className="text-xs font-black uppercase text-brand-olive">{viewingVoucher.status}</p>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Exchange Rate</label>
                        <p className="font-mono text-sm">{viewingVoucher.exchangeRate}</p>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Created By</label>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Actor ID: {viewingVoucher.actorId.slice(-4)}</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Account Entries</h4>
                    <div className="border border-zinc-100 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-left bg-white">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-6 py-3 text-[9px] font-black uppercase text-zinc-400 tracking-widest">Ledger Account</th>
                            <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest">Base Amount</th>
                            <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest">Txn Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {viewingVoucher.lines?.map((l, i) => (
                            <tr key={i}>
                              <td className="px-6 py-4 font-serif italic text-lg text-zinc-700">
                                {ledgers.find(led => led.id === l.ledgerId)?.name || `Account ID: ${l.ledgerId?.slice(-6) || 'Unknown'}`}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={cn("font-mono text-xs block opacity-50 uppercase tracking-tighter")}>{l.debit > 0 ? 'Debit' : 'Credit'}</span>
                                <span className="font-mono text-sm font-bold text-zinc-900">{(l.debit || l.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={cn("font-mono text-xs block opacity-50 uppercase tracking-tighter")}>{l.txnDebit! > 0 ? 'Debit' : 'Credit'}</span>
                                <span className="font-mono text-sm font-bold text-zinc-600">{(l.txnDebit || l.txnCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {viewingVoucher.stockLines && viewingVoucher.stockLines.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Stock Movement</h4>
                      <div className="border border-zinc-100 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-left bg-white">
                          <thead className="bg-zinc-50">
                            <tr>
                              <th className="px-6 py-3 text-[9px] font-black uppercase text-zinc-400 tracking-widest">Item</th>
                              <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest">Qty</th>
                              <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest">Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {viewingVoucher.stockLines.map((l, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4">
                                  <div className="font-serif italic text-lg text-zinc-700">
                                    {products.find(p => p.id === l.productId)?.name || `Item ID: ${l.productId.slice(-6)}`}
                                  </div>
                                  <div className="text-[9px] font-black uppercase text-zinc-300 tracking-widest">
                                     Location: {warehouses.find(w => w.id === l.warehouseId)?.name || 'Unknown'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-sm font-bold">{l.quantity}</td>
                                <td className="px-6 py-4 text-right font-mono text-sm font-bold">{l.rate.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="p-6 sm:p-8 bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] text-white">
                     <label className="text-[8px] font-black uppercase text-white/30 tracking-widest mb-2 block">Narration</label>
                     <p className="text-sm font-medium italic opacity-80">{viewingVoucher.narration || 'No narration provided for this transaction.'}</p>
                  </div>
                </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
