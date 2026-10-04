import React, { ReactNode } from 'react';
import { LucideIcon, Globe, Loader2, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface Suggestion {
  id: string;
  name: string;
  sub: string;
  color?: 'red' | 'blue' | 'emerald';
}

interface TransactionVoucherLayoutProps {
  title: string;
  icon: LucideIcon;
  refNo: string;
  suggestions: Suggestion[];
  onSelectSuggestion: (id: string) => void;
  onCreateNew?: () => void;
  activeFieldLabel?: string;
  totalAmount: number;
  currencyCode: string;
  currencySymbol: string;
  exchangeRate?: number;
  submitting: boolean;
  footerActionLabel: string;
  narration: string;
  onNarrationChange: (val: string) => void;
  onCloseSidebar?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
}

export default function TransactionVoucherLayout({
  title,
  icon: Icon,
  refNo,
  suggestions,
  onSelectSuggestion,
  onCreateNew,
  activeFieldLabel,
  totalAmount,
  currencyCode,
  currencySymbol,
  exchangeRate = 1,
  submitting,
  footerActionLabel,
  narration,
  onNarrationChange,
  onCloseSidebar,
  onSubmit,
  children
}: TransactionVoucherLayoutProps) {
  return (
    <div className="flex flex-col md:flex-row h-auto min-h-screen md:min-h-0 md:h-[calc(100vh-120px)] bg-white border-b sm:border border-zinc-900/10 overflow-hidden sm:rounded-2xl shadow-2xl relative text-[10px]">
      {/* Main Content Area */}
      <form onSubmit={onSubmit} className="flex-1 flex flex-col bg-white overflow-hidden overflow-y-auto">
        {/* Header - Voucher Details */}
        <div className="px-1.5 py-1 sm:px-3 sm:py-1.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/10 shrink-0">
           <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-zinc-950 flex items-center justify-center text-white shadow-lg">
                 <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
              <div className="space-y-0 text-left leading-none">
                <h1 className="text-xs sm:text-base font-serif italic text-zinc-900">{title}</h1>
                <p className="text-[6px] font-black uppercase tracking-[0.2em] text-zinc-400">Ref: {refNo}</p>
              </div>
           </div>
        </div>

        {/* Dynamic Form Content */}
        <div className="flex-1 bg-white">
           {children}

           {/* Narration and Total Area */}
           <div className="p-0.5 sm:p-1 border-t border-zinc-100 bg-zinc-50/20 grid grid-cols-1 md:grid-cols-2 gap-1 sm:gap-2 items-end">
              <div className="space-y-0.5">
                  <label className="text-[6px] font-black uppercase tracking-widest text-zinc-400 ml-1">Narration</label>
                  <textarea 
                    value={narration}
                    onChange={(e) => onNarrationChange(e.target.value)}
                    placeholder="Add remarks..."
                    className="w-full bg-white border border-zinc-100 rounded-md p-1 focus:outline-none text-[8px] sm:text-[10px] font-medium h-5 sm:h-8 resize-none shadow-sm focus:border-zinc-900/10 transition-all placeholder:text-zinc-200"
                  />
              </div>
 
              <div className="relative p-1 sm:p-1.5 bg-zinc-950 rounded-md text-white shadow-xl shadow-zinc-900/20 group overflow-hidden">
                 <div className="relative z-10 space-y-0 text-center sm:text-left">
                    <div className="text-[6px] font-black uppercase tracking-[0.15em] text-zinc-500">Settlement Total ({currencyCode})</div>
                    <div className="text-xs sm:text-base font-serif italic tracking-tight">
                       {currencySymbol} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {exchangeRate !== 1 && (
                      <div className="inline-block px-1 py-0 bg-white/5 rounded-full text-[5px] font-black uppercase tracking-widest text-zinc-500">
                        Rate: {exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </div>
                    )}
                 </div>
              </div>
           </div>

           {/* Action Button - Now inside scrollable area */}
           <div className="p-2 sm:p-4 flex justify-center sm:justify-end">
             <button 
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-10 py-3 sm:px-12 sm:py-4 bg-zinc-950 text-white rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.4em] hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-zinc-900/20"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : (
                  <>
                    {footerActionLabel}
                    <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
                  </>
                )}
              </button>
           </div>
        </div>
      </form>

      {/* Suggestions Sidebar (Positioned on the right) */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 w-[70%] sm:w-56 border-l border-zinc-100 bg-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl md:relative md:translate-x-0 md:shadow-none md:bg-zinc-50/20",
        activeFieldLabel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none md:hidden"
      )}>
        <div className="p-2 sm:p-3 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-0">
            <h3 className="text-[8px] font-black uppercase tracking-widest leading-tight">Suggestions</h3>
          </div>
          {onCloseSidebar && (
            <button onClick={onCloseSidebar} className="md:hidden p-1 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1 scrollbar-hide">
          {activeFieldLabel && (
            <div className="mb-2 space-y-1.5">
              <div className="px-2 py-1 bg-brand-olive/5 rounded-md border border-brand-olive/10">
                <p className="text-[7px] font-black uppercase tracking-widest text-brand-olive">Context: {activeFieldLabel}</p>
              </div>
              
              {onCreateNew && (
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white border border-dashed border-zinc-200 rounded-lg hover:border-brand-olive hover:text-brand-olive transition-all group"
                >
                  <span className="text-[7px] font-black uppercase tracking-widest text-left">Create New</span>
                  <div className="w-4 h-4 bg-zinc-50 group-hover:bg-brand-olive group-hover:text-white rounded-full flex items-center justify-center transition-colors">
                    <Plus className="w-2.5 h-2.5" />
                  </div>
                </button>
              )}
            </div>
          )}

          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSuggestion(s.id)}
              className="w-full text-left p-2 hover:bg-white hover:shadow-md rounded-lg transition-all group border border-transparent hover:border-zinc-100"
            >
              <div className={cn(
                "font-serif italic text-sm transition-colors leading-tight",
                s.color === 'red' ? "text-red-500 group-hover:text-red-600" : 
                s.color === 'blue' ? "text-blue-500 group-hover:text-blue-600" :
                s.color === 'emerald' ? "text-emerald-500 group-hover:text-emerald-600" :
                "text-zinc-800 group-hover:text-brand-olive"
              )}>{s.name}</div>
              <div className="text-[7px] uppercase font-black tracking-widest mt-0.5 text-zinc-400 group-hover:text-zinc-600 leading-none">{s.sub}</div>
            </button>
          ))}
          
          {activeFieldLabel && suggestions.length === 0 && (
            <div className="p-4 text-center text-zinc-300 italic font-serif text-[10px]">
               No matches found...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
