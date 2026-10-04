import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc, updateDoc } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { useAuth } from '../../hooks/useAuth';
import { useBusiness } from '../../hooks/useBusiness';
import { Product, Warehouse, VoucherStatus, Voucher } from '../../types';
import { Loader2, Plus, Trash2, ArrowRightLeft, Package, ChevronDown } from 'lucide-react';

import TransactionVoucherLayout from './TransactionVoucherLayout';
import QuickCreateModal from './QuickCreateModal';
import { useUI } from '../../context/UIContext';
import { getStockLevel } from '../../lib/inventory';

export default function StockTransferForm({ onComplete, editVoucher }: { onComplete: () => void, editVoucher?: Voucher }) {
  const { actor } = useAuth();
  const { business, currency } = useBusiness();
  const { notify } = useUI();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [fromWarehouseId, setFromWarehouseId] = useState(editVoucher?.stockLines?.find(l => l.quantity < 0)?.warehouseId || '');
  const [toWarehouseId, setToWarehouseId] = useState(editVoucher?.stockLines?.find(l => l.quantity > 0)?.warehouseId || '');
  const [items, setItems] = useState<{ productId: string, quantity: string | number }[]>(
    editVoucher?.stockLines ? 
    editVoucher.stockLines.filter(l => l.quantity > 0).map(sl => ({ productId: sl.productId, quantity: sl.quantity })) : 
    [{ productId: '', quantity: '' }]
  );
  const [narration, setNarration] = useState(editVoucher?.narration || '');

  // UI Search State
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!business) return;
    
    const unsubs: (() => void)[] = [];
    const q = (path: string) => query(collection(db, path), where('businessId', '==', business.id), where('active', '==', true));

    // Real-time masters
    unsubs.push(onSnapshot(q('products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)))));
    unsubs.push(onSnapshot(q('warehouses'), snap => setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(query(collection(db, 'vouchers'), where('businessId', '==', business.id)), snap => setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher)))));

    setLoading(false);

    return () => unsubs.forEach(u => u());
  }, [business]);

  const handleQuickCreateSuccess = (id: string, name: string) => {
    handleSelectSuggestion(id);
    setShowQuickCreate(false);
  };

  const addItem = () => setItems([...items, { productId: '', quantity: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleSelectSuggestion = (id: string) => {
    if (activeItemIndex === null) return;
    const newItems = [...items];
    newItems[activeItemIndex].productId = id;
    setItems(newItems);
    setActiveItemIndex(null);
    setSearchQuery('');
  };

  const getSuggestions = () => {
    if (activeItemIndex === null) return [];
    return products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(p => {
        const stock = fromWarehouseId ? getStockLevel(vouchers, p.id, fromWarehouseId) : 0;
        return { 
          id: p.id, 
          name: p.name, 
          sub: fromWarehouseId ? `Source Stock: ${stock}` : 'Select Source Warehouse first' 
        };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !actor) return;
    if (!date) { notify.error('Transaction date is required'); return; }

    if (!fromWarehouseId || !toWarehouseId) {
      notify.error('Please select both source and destination warehouses');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      notify.error('Source and destination warehouses must be different');
      return;
    }
    if (items.some(i => !i.productId || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0)) {
      notify.error('Please select products and valid quantities for all rows');
      return;
    }

    // Negative Stock Validation
    for (const item of items) {
       const currentStock = getStockLevel(vouchers, item.productId, fromWarehouseId);
       const originalQty = editVoucher?.stockLines.find(sl => sl.productId === item.productId && sl.warehouseId === fromWarehouseId && sl.quantity < 0)?.quantity || 0;
       const available = currentStock - originalQty; // originalQty is negative
       
       if (available - Number(item.quantity) < 0) {
          const product = products.find(p => p.id === item.productId);
          notify.error(`Insufficient stock for ${product?.name} at source. Available: ${available}`);
          return;
       }
    }

    setSubmitting(true);
    try {
      const stockLines = items.flatMap(item => [
        // Out from Source
        {
          productId: item.productId,
          warehouseId: fromWarehouseId,
          unitId: products.find(p => p.id === item.productId)?.baseUnitId || '',
          quantity: -Number(item.quantity),
          rate: 0
        },
        // In to Destination
        {
          productId: item.productId,
          warehouseId: toWarehouseId,
          unitId: products.find(p => p.id === item.productId)?.baseUnitId || '',
          quantity: Number(item.quantity),
          rate: 0
        }
      ]);

      await addDoc(collection(db, 'vouchers'), {
        businessId: business.id,
        type: 'StockTransfer',
        date,
        number: `TR-${Date.now()}`,
        status: 'Posted' as VoucherStatus,
        narration: narration || `Transfer from ${warehouses.find(w => w.id === fromWarehouseId)?.name} to ${warehouses.find(w => w.id === toWarehouseId)?.name}`,
        actorId: actor.id,
        lines: [],
        stockLines,
        currencyId: currency?.id || business.baseCurrencyId,
        exchangeRate: currency?.exchangeRate || 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      notify.success('Stock transfer process completed');
      onComplete();
    } catch (error) {
      handleApiError(error, OperationType.WRITE, 'vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-olive" /></div>;

  return (
    <TransactionVoucherLayout
      title="Stock Transfer"
      icon={ArrowRightLeft}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      activeFieldLabel={activeItemIndex !== null ? 'product' : ''}
      onCreateNew={() => setShowQuickCreate(true)}
      onSelectSuggestion={handleSelectSuggestion}
      totalAmount={items.length}
      currencyCode="Items"
      currencySymbol=""
      submitting={submitting}
      footerActionLabel="Post Stock Transfer"
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveItemIndex(null)}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 border-b border-zinc-100">
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white">
           <div className="grid grid-cols-1 gap-1">
              <div>
                <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent focus:outline-none font-serif italic text-xs" />
              </div>
           </div>
        </div>
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white flex flex-col gap-1">
            <div>
              <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block flex justify-between">
                Source
                <button type="button" onClick={() => setShowQuickCreate(true)} className="text-zinc-500 hover:text-zinc-800">
                  <Plus className="w-1.5 h-1.5" />
                </button>
              </label>
              <div className="relative">
                <select 
                  value={fromWarehouseId}
                  onChange={e => setFromWarehouseId(e.target.value)}
                  className="w-full bg-zinc-50/50 border border-zinc-100 p-1 rounded-lg font-serif italic text-[10px] sm:text-xs outline-none transition-all appearance-none pr-5"
                >
                  <option value="">Source...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-zinc-400 pointer-events-none" />
              </div>
            </div>
        </div>
        <div className="col-span-2 md:col-span-1 p-1 sm:p-1.5 bg-zinc-50/20 border-t md:border-t-0 border-zinc-100">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">
            Destination
          </label>
          <div className="relative">
            <select 
              value={toWarehouseId}
              onChange={e => setToWarehouseId(e.target.value)}
              className="w-full bg-white border border-zinc-100 p-1 rounded-lg font-serif italic text-[10px] sm:text-xs outline-none transition-all appearance-none pr-5"
            >
              <option value="">Destination...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="p-0.5 sm:p-1 overflow-x-auto">
        <table className="w-full text-left min-w-[320px]">
          <thead>
            <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black text-left">Stock Item Name</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-18 sm:w-32 font-black">Xfer Qty</th>
              <th className="w-6 sm:w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/5">
            {items.map((item, idx) => (
              <tr key={idx} className="group hover:bg-zinc-50/50 transition-colors">
                <td className="p-0 border-r border-zinc-900/5">
                  <div className="flex items-center gap-1.5 px-1.5 sm:px-2">
                    <Package className="w-2.5 h-2.5 text-zinc-200" />
                    <input 
                      placeholder="Select Product..."
                      value={products.find(p => p.id === item.productId)?.name || (activeItemIndex === idx ? searchQuery : '')}
                      onChange={e => setSearchQuery(e.target.value)}
                      onFocus={() => { setActiveItemIndex(idx); setSearchQuery(''); }}
                      className="w-full bg-transparent py-1.5 sm:py-2.5 font-serif italic text-[10px] sm:text-sm focus:outline-none text-zinc-800"
                    />
                  </div>
                </td>
                <td className="p-0 border-r border-zinc-900/5">
                  <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const newItems = [...items];
                      newItems[idx].quantity = val;
                      setItems(newItems);
                    }}
                    className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2.5 text-right font-mono text-[10px] sm:text-sm focus:outline-none text-zinc-900 font-bold"
                  />
                </td>
                <td className="px-0.5 text-center font-black">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="p-0.5 text-zinc-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addItem} className="mt-1 sm:mt-2 flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-full text-[7px] font-black uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/10 hover:brightness-110 active:scale-95 transition-all">
          <Plus className="w-1.5 h-1.5" /> Add Row
        </button>
      </div>

      {showQuickCreate && activeItemIndex !== null && (
        <QuickCreateModal 
          type="product"
          onClose={() => setShowQuickCreate(false)}
          onSuccess={handleQuickCreateSuccess}
          initialName={searchQuery}
        />
      )}
    </TransactionVoucherLayout>
  );
}
