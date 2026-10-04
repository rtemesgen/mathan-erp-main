import React, { useState } from 'react';
import { 
  ShoppingCart, 
  ShoppingBag, 
  FileText, 
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Scale,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { VoucherType } from '../types';

// Import Specific Forms
import SaleForm from './transactions/SaleForm';
import PurchaseForm from './transactions/PurchaseForm';
import JournalForm from './transactions/JournalForm';
import StockAdjustmentForm from './transactions/StockAdjustmentForm';
import FinanceVoucherForm from './transactions/FinanceVoucherForm';
import StockTransferForm from './transactions/StockTransferForm';
import PayrollForm from './transactions/PayrollForm';

const transactionTypes = [
  { id: 'Sale', label: 'Cash/Credit Sale', icon: ShoppingCart, color: 'blue' },
  { id: 'Purchase', label: 'Cash/Credit Purchase', icon: ShoppingBag, color: 'purple' },
  { id: 'Payment', label: 'Payment Voucher', icon: ArrowUpCircle, color: 'red' },
  { id: 'Receipt', label: 'Receipt Voucher', icon: ArrowDownCircle, color: 'green' },
  { id: 'Contra', label: 'Contra Voucher', icon: ArrowLeftRight, color: 'amber' },
  { id: 'Journal', label: 'Journal Entry', icon: FileText, color: 'zinc' },
  { id: 'StockAdjustment', label: 'Stock Adjustment', icon: Scale, color: 'orange' },
  { id: 'StockTransfer', label: 'Stock Transfer', icon: ArrowLeftRight, color: 'teal' },
  { id: 'Payroll', label: 'Salaries & Payroll', icon: FileText, color: 'indigo' },
];

export default function TransactionPoster() {
  const [activeType, setActiveType] = useState<VoucherType | null>(null);

  if (activeType) {
    return (
      <div className="space-y-4">
        <button 
          onClick={() => setActiveType(null)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-bold text-xs uppercase tracking-widest transition-colors px-4"
        >
          <Plus className="w-4 h-4 rotate-45" />
          Back to Selection
        </button>

        <AnimatePresence mode="wait">
           {activeType === 'Sale' && <SaleForm onComplete={() => setActiveType(null)} />}
           {activeType === 'Purchase' && <PurchaseForm onComplete={() => setActiveType(null)} />}
           {activeType === 'Journal' && <JournalForm onComplete={() => setActiveType(null)} />}
           {activeType === 'StockAdjustment' && <StockAdjustmentForm onComplete={() => setActiveType(null)} />}
           {activeType === 'StockTransfer' && <StockTransferForm onComplete={() => setActiveType(null)} />}
           {activeType === 'Payroll' && <PayrollForm onComplete={() => setActiveType(null)} />}
           {(activeType === 'Payment' || activeType === 'Receipt' || activeType === 'Contra') && (
             <FinanceVoucherForm type={activeType} onComplete={() => setActiveType(null)} />
           )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 px-2 sm:px-0 pb-10">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-4xl font-serif italic text-zinc-900 tracking-tight text-center md:text-left">Transaction Hub</h2>
        <div className="flex items-center gap-3 justify-center md:justify-start">
          <div className="h-[1px] sm:h-[2px] w-6 sm:w-8 bg-brand-olive" />
          <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-zinc-400">Record business movements</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {transactionTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id as VoucherType)}
              className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-zinc-100 shadow-md sm:shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icon className="w-10 h-10 sm:w-16 sm:h-16 -mr-2 -mt-2 sm:-mr-4 sm:-mt-4" />
              </div>

              <div className={cn(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 transition-all duration-500 group-hover:scale-110 shadow-sm sm:shadow-md",
                type.color === 'blue' && "bg-blue-50 text-blue-600 shadow-blue-100",
                type.color === 'purple' && "bg-purple-50 text-purple-600 shadow-purple-100",
                type.color === 'red' && "bg-red-50 text-red-600 shadow-red-100",
                type.color === 'green' && "bg-green-50 text-green-600 shadow-green-100",
                type.color === 'amber' && "bg-amber-50 text-amber-600 shadow-amber-100",
                type.color === 'teal' && "bg-teal-50 text-teal-600 shadow-teal-100",
                type.color === 'zinc' && "bg-zinc-100 text-zinc-900 shadow-zinc-100",
                type.color === 'orange' && "bg-orange-50 text-orange-600 shadow-orange-100",
                type.color === 'indigo' && "bg-indigo-50 text-indigo-600 shadow-indigo-100",
              )}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="font-serif italic text-sm sm:text-lg text-zinc-900">{type.label}</h3>
              <p className="text-[6px] sm:text-[8px] font-black uppercase text-zinc-300 mt-1 sm:mt-2 tracking-widest">{type.id} entry</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
