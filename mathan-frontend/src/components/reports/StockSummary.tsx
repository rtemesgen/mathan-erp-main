import React, { useState } from 'react';
import { Voucher, Product, Warehouse, Currency } from '../../types';
import { ChevronRight, Package, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react';
import { getProductHistory } from '../../lib/inventory';
import { cn } from '../../lib/utils';

export default function StockSummary({ 
  vouchers, 
  products, 
  warehouses,
  currency,
  serverRows
}: { 
  vouchers: Voucher[], 
  products: Product[], 
  warehouses: Warehouse[],
  currency?: Currency,
  serverRows?: Array<{ productId: string; productName: string; warehouseId: string; warehouseName: string; quantity: number; inventoryValue?: number; averageCost?: number; valuationBasis?: string }>
}) {
  const [historyFilter, setHistoryFilter] = useState<{ productId: string, warehouseId?: string } | null>(null);
  const symbol = currency?.symbol || '$';
  
  const stockMap = new Map<string, number>();

  if (serverRows) serverRows.forEach(row => stockMap.set(`${row.productId}_${row.warehouseId}`, row.quantity));
  else vouchers.filter(v => v.status === 'Posted').forEach(v => {
    v.stockLines.forEach(line => {
      const key = `${line.productId}_${line.warehouseId}`;
      stockMap.set(key, (stockMap.get(key) || 0) + line.quantity);
    });
  });

  const summary = Array.from(stockMap.entries()).map(([key, qty]) => {
    const [pid, wid] = key.split('_');
    const product = products.find(p => p.id === pid);
    const warehouse = warehouses.find(w => w.id === wid);
    return {
      productId: pid,
      warehouseId: wid,
      productName: product?.name || 'Unknown',
      warehouseName: warehouse?.name || 'Unknown',
      qty,
      price: (product?.sellingPrice || 0),
      totalValue: serverRows?.find(row => row.productId === pid && row.warehouseId === wid)?.inventoryValue ?? qty * (product?.sellingPrice || 0)
    };
  }).filter(s => s.qty !== 0);

  if (historyFilter) {
    const product = products.find(p => p.id === historyFilter.productId);
    const rawHistory = getProductHistory(vouchers, historyFilter.productId);
    const history = historyFilter.warehouseId 
      ? rawHistory.filter(h => h.warehouseId === historyFilter.warehouseId)
      : rawHistory;

    return (
      <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-right-4">
        <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/10 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => setHistoryFilter(null)}
              className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-900 hover:text-white transition-all shadow-sm group"
            >
              <ChevronRight className="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-xl sm:text-2xl font-serif italic text-zinc-900">{product?.name}</h2>
                {historyFilter.warehouseId && (
                   <span className="px-2 py-0.5 bg-zinc-900 text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                    {warehouses.find(w => w.id === historyFilter.warehouseId)?.name} Only
                  </span>
                )}
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Stock Movement Ledger</p>
            </div>
          </div>
          
          <div className="flex gap-4 sm:gap-8">
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-300">Total Quantity</p>
              <p className="text-xl sm:text-2xl font-mono font-black text-zinc-900">
                {history.reduce((sum, h) => sum + h.quantity, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-zinc-50/50 border-b border-zinc-100 shadow-sm">
                <th className="px-4 py-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest leading-none">Date</th>
                <th className="px-4 py-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest leading-none">Reference</th>
                <th className="px-4 py-2 text-[9px] font-black uppercase text-zinc-400 tracking-widest leading-none">Warehouse</th>
                <th className="px-4 py-2 text-right text-[9px] font-black uppercase text-zinc-400 tracking-widest leading-none">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {history.map((h, i) => (
                <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-2">
                    <span className="text-xs font-medium text-zinc-900">{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </td>
                  <td className="px-4 py-2">
                     <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-0.5">{h.type}</span>
                     <p className="text-xs font-bold text-zinc-900 font-mono italic">{h.number}</p>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                       <div className="w-1 h-1 rounded-full bg-zinc-300" />
                       <span className="text-xs text-zinc-500 font-serif italic">
                         {warehouses.find(w => w.id === h.warehouseId)?.name || 'Unknown'}
                       </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {h.quantity > 0 ? (
                      <div className="flex items-center justify-end gap-2 text-emerald-600">
                        <span className="text-xs font-black">+{h.quantity}</span>
                        <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 text-red-500">
                        <span className="text-xs font-black">{h.quantity}</span>
                        <div className="w-6 h-6 rounded bg-red-50 flex items-center justify-center">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currency && (
         <div className="px-6 py-2 bg-brand-olive/5 border-b border-brand-olive/10 text-[10px] font-black uppercase text-brand-olive tracking-widest">
            Reporting in {currency.code} • {serverRows?.some(row => row.valuationBasis === 'LEGACY_RATE_FALLBACK') ? 'Moving-average cost with legacy fallback' : serverRows ? 'Moving-average cost valuation' : 'Provisional selling-price valuation'}
         </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Product</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Warehouse</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Quantity</th>
              <th className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Valuation ({symbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {summary.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-20 text-center">
                <div className="flex flex-col items-center gap-3 text-zinc-300">
                  <Package className="w-12 h-12 opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No inventory positions found</span>
                </div>
              </td></tr>
            ) : summary.map((s, i) => (
              <tr 
                key={i} 
                onClick={() => setHistoryFilter({ productId: s.productId, warehouseId: s.warehouseId })}
                className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all shadow-sm group-hover:shadow-xl group-hover:shadow-zinc-900/10">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-900 group-hover:translate-x-0.5 transition-transform">{s.productName}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryFilter({ productId: s.productId });
                        }}
                        className="text-[8px] font-black uppercase tracking-widest text-zinc-300 hover:text-zinc-900 transition-colors text-left"
                      >
                        Global History
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                     <div className="w-1 h-1 rounded-full bg-zinc-300" />
                     <span className="text-xs text-zinc-500 font-serif italic">{s.warehouseName}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    "font-mono text-sm font-black px-3 py-1 rounded-lg block ml-auto w-fit",
                    s.qty > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}>{s.qty.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-300 mb-0.5">Value</p>
                  <p className="font-mono text-xs font-bold text-zinc-900">
                    {symbol}{s.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
