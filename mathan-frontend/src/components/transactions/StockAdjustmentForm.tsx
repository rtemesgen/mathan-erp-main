import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { useAuth } from '../../hooks/useAuth';
import { useBusiness } from '../../hooks/useBusiness';
import { Product, Warehouse, Unit, StockLine, Voucher } from '../../types';
import { Plus, Trash2, Loader2, Target, PackageSearch } from 'lucide-react';
import { getStockLevel } from '../../lib/inventory';

import TransactionVoucherLayout from './TransactionVoucherLayout';
import QuickCreateModal from './QuickCreateModal';
import { useUI } from '../../context/UIContext';

export default function StockAdjustmentForm({ onComplete, editVoucher }: { onComplete: () => void, editVoucher?: Voucher }) {
  const { actor } = useAuth();
  const { business, currency } = useBusiness();
  const { notify } = useUI();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState(editVoucher?.narration || '');
  const [items, setItems] = useState<{ productId: string; warehouseId: string; unitId: string; quantity: string | number; rate: string | number }[]>(
    editVoucher?.stockLines?.map(sl => ({ 
      productId: sl.productId, 
      warehouseId: sl.warehouseId, 
      unitId: sl.unitId || '',
      quantity: sl.quantity,
      rate: sl.rate
    })) ||
    [{ productId: '', warehouseId: '', unitId: '', quantity: '', rate: '' }]
  );

  // UI State for Search/Sidebar
  const [activeField, setActiveField] = useState<{ type: 'product' | 'warehouse', index: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!business) return;
    
    const unsubs: (() => void)[] = [];
    const q = (path: string) => query(collection(db, path), where('businessId', '==', business.id));

    // Listeners for all masters
    unsubs.push(onSnapshot(q('products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[])));
    unsubs.push(onSnapshot(q('warehouses'), snap => setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Warehouse[])));
    unsubs.push(onSnapshot(q('units'), snap => setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Unit[])));
    unsubs.push(onSnapshot(query(collection(db, 'vouchers'), where('businessId', '==', business.id)), snap => setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher)))));

    const fetchData = async () => {
      try {
        // Any other non-realtime async data if needed
      } catch (err) {
        handleApiError(err, OperationType.GET, 'masters');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => unsubs.forEach(u => u());
  }, [business]);

  const handleQuickCreateSuccess = (id: string) => {
    handleSelectSuggestion(id);
    setShowQuickCreate(false);
  };

  const addItem = () => setItems([...items, { productId: '', warehouseId: '', unitId: '', quantity: '', rate: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleSelectSuggestion = (id: string) => {
    if (!activeField) return;
    if (activeField.type === 'product') {
      updateItem(activeField.index, 'productId', id);
    } else if (activeField.type === 'warehouse') {
      updateItem(activeField.index, 'warehouseId', id);
    }
    setActiveField(null);
    setSearchQuery('');
  };

  const updateItem = (index: number, key: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[key] = value;
    if (key === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unitId = product.baseUnitId;
        newItems[index].rate = product.sellingPrice || 0;
        if (!newItems[index].warehouseId && warehouses.length > 0) {
          newItems[index].warehouseId = warehouses[0].id;
        }
      }
    }
    setItems(newItems);
  };

  const getSuggestions = () => {
    if (!activeField) return [];
    const q = searchQuery.toLowerCase();

    if (activeField.type === 'product') {
      const idx = activeField.index;
      const whId = items[idx]?.warehouseId;
      return products
        .filter(p => p.name.toLowerCase().includes(q))
        .map(p => {
          const stock = whId ? getStockLevel(vouchers, p.id, whId) : 0;
          return { 
            id: p.id, 
            name: p.name, 
            sub: whId ? `Current Stock: ${stock} • Base Rate: ${p.sellingPrice}` : `Base Rate: ${p.sellingPrice}` 
          };
        });
    } else {
      const idx = activeField.index;
      const prodId = items[idx]?.productId;
      return warehouses
        .filter(w => w.name.toLowerCase().includes(q))
        .map(w => {
           const stock = prodId ? getStockLevel(vouchers, prodId, w.id) : 0;
           return { id: w.id, name: w.name, sub: prodId ? `Stock at Location: ${stock}` : 'Warehouse Location' };
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !actor) return;
    if (!date) { notify.error('Transaction date is required'); return; }

    if (items.some(i => !i.productId)) {
      notify.error('Please select products for all lines');
      return;
    }
    if (items.some(i => !i.warehouseId || !i.unitId)) {
      notify.error('Please select warehouses for all lines');
      return;
    }
    if (items.some(i => !Number.isFinite(Number(i.quantity)) || Number(i.quantity) === 0)) {
      notify.error('Quantity cannot be zero');
      return;
    }

    // Negative Stock Validation (only for decreases)
    for (const item of items) {
       const qtyNum = Number(item.quantity);
       if (qtyNum < 0) {
          const currentStock = getStockLevel(vouchers, item.productId, item.warehouseId);
          // If editing, adjust
          const originalLine = editVoucher?.stockLines.find(sl => sl.productId === item.productId && sl.warehouseId === item.warehouseId);
          const originalQty = originalLine ? originalLine.quantity : 0;
          const available = currentStock - originalQty; // originalQty is reflected in currentStock
          
          if (available + qtyNum < 0) {
             const product = products.find(p => p.id === item.productId);
             notify.error(`Insufficient stock for ${product?.name}. Available: ${available}`);
             return;
          }
       }
    }

    setSubmitting(true);
    try {
      const stockLines: StockLine[] = items.map(item => ({
        productId: item.productId, warehouseId: item.warehouseId, unitId: item.unitId,
        quantity: Number(item.quantity), rate: Number(item.rate)
      }));

      await addDoc(collection(db, 'vouchers'), {
        businessId: business.id,
        type: 'StockAdjustment', date, number: `AD-${Date.now()}`, status: 'Posted', narration,
        actorId: actor.id, lines: [], stockLines,
        currencyId: currency?.id || business.baseCurrencyId,
        exchangeRate: currency?.exchangeRate || 1,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });

      notify.success('Stock adjustment recorded successfully');
      onComplete();
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>;

  const totalValue = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate)), 0);

  return (
    <TransactionVoucherLayout
      title="Stock Adjustment"
      icon={PackageSearch}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      activeFieldLabel={activeField?.type}
      onCreateNew={() => setShowQuickCreate(true)}
      onSelectSuggestion={handleSelectSuggestion}
      totalAmount={totalValue}
      currencyCode={currency?.code || ''}
      currencySymbol={currency?.symbol || ''}
      exchangeRate={currency?.exchangeRate}
      submitting={submitting}
      footerActionLabel="Record Adjustment"
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveField(null)}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 border-b border-zinc-100">
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800" />
        </div>
        <div className="p-1 sm:p-1.5 bg-zinc-50/20 flex items-center">
          <p className="text-[6.5px] font-black uppercase tracking-widest text-brand-olive/60 italic leading-tight">
            +/- qty to reconcile stock.
          </p>
        </div>
      </div>

      <div className="p-0.5 sm:p-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[320px]">
          <thead>
            <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black">Item & Location</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-14 sm:w-24 font-black">Qty</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-18 sm:w-32 font-black">Rate</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-20 sm:w-36 font-black">Net</th>
              <th className="w-6 sm:w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/5">
            {items.map((item, index) => (
              <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                <td className="p-0 border-r border-zinc-900/5">
                    <div className="flex flex-col">
                      <input 
                        placeholder="Select Product..."
                        value={products.find(p => p.id === item.productId)?.name || (activeField?.type === 'product' && activeField?.index === index ? searchQuery : '')}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => { setActiveField({ type: 'product', index }); setSearchQuery(''); }}
                        className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 font-serif italic text-[10px] sm:text-sm focus:outline-none text-zinc-800"
                      />
                      <div className="flex items-center gap-1 px-1.5 pb-0.5 sm:px-2 sm:pb-1 -mt-0.5 underline decoration-dotted decoration-zinc-200">
                        <Target className="w-2 h-2 text-zinc-300" />
                        <input 
                          type="text"
                          placeholder="Select Warehouse"
                          value={warehouses.find(w => w.id === item.warehouseId)?.name || (activeField?.type === 'warehouse' && activeField?.index === index ? searchQuery : '')}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => { setActiveField({ type: 'warehouse', index }); setSearchQuery(''); }}
                          className="text-[7px] uppercase font-black tracking-widest text-zinc-300 focus:text-zinc-500 focus:outline-none bg-transparent w-full"
                        />
                      </div>
                   </div>
                </td>
                <td className="p-0 border-r border-zinc-900/5">
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0"
                    value={item.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.-]/g, '');
                      updateItem(index, 'quantity', val);
                    }} 
                    className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-bold text-[10px] sm:text-sm focus:outline-none" 
                  />
                </td>
                <td className="p-0 border-r border-zinc-900/5">
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.rate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      updateItem(index, 'rate', val);
                    }} 
                    className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm focus:outline-none font-bold" 
                  />
                </td>
                <td className="px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-black font-mono text-[10px] sm:text-sm text-zinc-900">
                  {(Number(item.quantity) * Number(item.rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-0.5 text-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="p-0.5 text-zinc-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addItem} className="mt-1 sm:mt-2 flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white rounded-full text-[7px] font-black uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/10 hover:brightness-110 active:scale-95 transition-all">
          <Plus className="w-2 h-2" /> Add Row
        </button>
      </div>

      {showQuickCreate && activeField && (
        <QuickCreateModal 
          type={activeField.type}
          onClose={() => setShowQuickCreate(false)}
          onSuccess={handleQuickCreateSuccess}
          initialName={searchQuery}
        />
      )}
    </TransactionVoucherLayout>
  );
}
