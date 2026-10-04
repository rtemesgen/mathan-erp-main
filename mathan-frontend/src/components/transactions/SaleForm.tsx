import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, where, onSnapshot } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { useAuth } from '../../hooks/useAuth';
import { useBusiness } from '../../hooks/useBusiness';
import { Product, Warehouse, Unit, Party, Ledger, StockLine, VoucherLine, VoucherStatus, Currency, Voucher, AccountGroup } from '../../types';
import { Plus, Trash2, Loader2, ShoppingCart, ChevronDown, Target } from 'lucide-react';
import TransactionVoucherLayout from './TransactionVoucherLayout';
import QuickCreateModal from './QuickCreateModal';
import { doc, updateDoc } from '../../lib/restStore';
import { useUI } from '../../context/UIContext';
import { getStockLevel } from '../../lib/inventory';
import { cn } from '../../lib/utils';

interface SaleFormProps {
  onComplete: () => void;
  editVoucher?: Voucher;
}

export default function SaleForm({ onComplete, editVoucher }: SaleFormProps) {
  const { actor } = useAuth();
  const { business, currency: baseCurrency } = useBusiness();
  const { notify } = useUI();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const [activeField, setActiveField] = useState<{ type: 'party' | 'ledger' | 'product' | 'warehouse', index?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [date, setDate] = useState(editVoucher?.date || new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState(editVoucher?.partyId || '');
  const [directLedgerId, setDirectLedgerId] = useState('');
  const [salesLedgerId, setSalesLedgerId] = useState('');
  const [currencyId, setCurrencyId] = useState(editVoucher?.currencyId || '');
  const [exchangeRate, setExchangeRate] = useState<string | number>(editVoucher?.exchangeRate || 1);
  const [narration, setNarration] = useState(editVoucher?.narration || '');
  const [items, setItems] = useState<{ productId: string, warehouseId: string, unitId: string, quantity: string | number, rate: string | number }[]>(
    editVoucher?.stockLines?.map(sl => ({
      productId: sl.productId,
      warehouseId: sl.warehouseId,
      unitId: sl.unitId,
      quantity: Math.abs(sl.quantity),
      rate: sl.rate / (editVoucher.exchangeRate || 1)
    })) || [{ productId: '', warehouseId: '', unitId: '', quantity: '', rate: '' }]
  );

  useEffect(() => {
    if (!business) return;
    
    const unsubs: (() => void)[] = [];
    const q = (path: string) => query(collection(db, path), where('businessId', '==', business.id));

    // Listeners for all masters
    unsubs.push(onSnapshot(q('parties'), snap => setParties(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Party[])));
    unsubs.push(onSnapshot(q('ledgers'), snap => setLedgers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ledger[])));
    unsubs.push(onSnapshot(q('products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[])));
    unsubs.push(onSnapshot(q('warehouses'), snap => setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Warehouse[])));
    unsubs.push(onSnapshot(q('units'), snap => setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Unit[])));
    unsubs.push(onSnapshot(q('accountGroups'), snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[])));
    unsubs.push(onSnapshot(q('vouchers'), snap => setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Voucher[])));

    const fetchData = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'currencies'));
        const allCurrencies = cSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Currency[];
        setCurrencies(allCurrencies);
        
        if (!editVoucher) {
          if (baseCurrency) {
            setCurrencyId(baseCurrency.id);
            setExchangeRate(1);
          }
          
          // Auto-select Sales Ledger
          const salesGroup = groups.find(g => g.name.toLowerCase().includes('sales'));
          if (salesGroup) {
            const firstSalesLedger = ledgers.find(l => l.groupId === salesGroup.id);
            if (firstSalesLedger) setSalesLedgerId(firstSalesLedger.id);
          }
        } else {
           const salesLine = editVoucher.lines.find(l => l.credit > 0);
           if (salesLine) setSalesLedgerId(salesLine.ledgerId);
           
           // If no partyId, find the debiting ledger
           if (!editVoucher.partyId) {
             const debitLine = editVoucher.lines.find(l => l.debit > 0);
             if (debitLine) setDirectLedgerId(debitLine.ledgerId);
           }
        }
        setLoading(false);
      } catch (err) {
        handleApiError(err, OperationType.LIST, 'Sale Master Data');
      }
    };
    fetchData();

    return () => unsubs.forEach(u => u());
  }, [business, baseCurrency, editVoucher]);

  const handleQuickCreateSuccess = (id: string, name: string) => {
    handleSelectSuggestion(id);
    setShowQuickCreate(false);
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate)), 0);
  const selectedCurrency = currencies.find(c => c.id === currencyId) || baseCurrency;

  const handleCurrencyChange = (newCurrencyId: string) => {
    setCurrencyId(newCurrencyId);
    const curr = currencies.find(c => c.id === newCurrencyId);
    if (curr) {
      if (newCurrencyId === baseCurrency?.id) {
        setExchangeRate(1);
      } else {
        setExchangeRate(curr.exchangeRate || 1);
      }
    }
  };

  const addItem = () => setItems([...items, { productId: '', warehouseId: '', unitId: '', quantity: '', rate: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));
  
  const updateItem = (index: number, key: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[key] = value;
    if (key === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].rate = product.sellingPrice;
        newItems[index].unitId = product.baseUnitId;
        if (!newItems[index].warehouseId && warehouses.length > 0) newItems[index].warehouseId = warehouses[0].id;
      }
    }
    setItems(newItems);
  };

  const handleSelectSuggestion = (id: string) => {
    if (!activeField) return;
    if (activeField.type === 'party') {
      const party = parties.find(p => p.id === id);
      if (party) {
        setPartyId(id);
        setDirectLedgerId('');
      } else {
        setPartyId('');
        setDirectLedgerId(id);
      }
    }
    else if (activeField.type === 'ledger') setSalesLedgerId(id);
    else if (activeField.type === 'product' && activeField.index !== undefined) updateItem(activeField.index, 'productId', id);
    else if (activeField.type === 'warehouse' && activeField.index !== undefined) updateItem(activeField.index, 'warehouseId', id);
    
    setActiveField(null);
    setSearchQuery('');
  };

  const getSuggestions = () => {
    if (!activeField) return [];
    const q = searchQuery.toLowerCase();
    switch (activeField.type) {
      case 'party': 
        const partySugs = parties
          .filter(p => p.name.toLowerCase().includes(q))
          .map(p => ({ id: p.id, name: p.name, sub: p.type }));
        
        const cashBankGroups = groups.filter(g => 
          g.name.toLowerCase().includes('cash') || 
          g.name.toLowerCase().includes('bank')
        ).map(g => g.id);

        const ledgerSugs = ledgers
          .filter(l => cashBankGroups.includes(l.groupId) && l.name.toLowerCase().includes(q))
          .map(l => ({ id: l.id, name: l.name, sub: 'Cash / Bank Account' }));

        return [...partySugs, ...ledgerSugs];
      case 'ledger': 
        return ledgers
          .filter(l => l.name.toLowerCase().includes(q))
          .map(l => {
            const group = groups.find(g => g.id === l.groupId);
            return { id: l.id, name: l.name, sub: group?.name || 'Ledger' };
          });
      case 'product': 
        return products
          .filter(p => p.name.toLowerCase().includes(q))
          .map(p => {
            const idx = activeField.index ?? 0;
            const whId = items[idx]?.warehouseId;
            const stock = whId ? getStockLevel(vouchers, p.id, whId) : vouchers.reduce((acc, v) => acc + v.stockLines.filter(sl => sl.productId === p.id).reduce((sAcc, sl) => sAcc + sl.quantity, 0), 0);
            
            const isLowStock = stock <= 0;
            
            return { 
              id: p.id, 
              name: p.name, 
              sub: isLowStock ? `OUT OF STOCK • Rate: ${p.sellingPrice}` : `Stock: ${stock} available • Rate: ${p.sellingPrice}`,
              color: isLowStock ? 'red' : undefined
            };
          });
      case 'warehouse': 
        return warehouses
          .filter(w => w.name.toLowerCase().includes(q))
          .map(w => {
            const idx = activeField.index ?? 0;
            const prodId = items[idx]?.productId;
            const stock = prodId ? getStockLevel(vouchers, prodId, w.id) : 0;
            return { 
              id: w.id, 
              name: w.name, 
              sub: prodId ? `Available Stock: ${stock}` : 'Warehouse' 
            };
          });
      default: return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !actor) return;
    if (!date) { notify.error('Transaction date is required'); return; }
    if (!currencyId) { notify.error('Currency is required'); return; }
    if (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0) { notify.error('Exchange rate must be greater than zero'); return; }
    
    if (!partyId && !directLedgerId) {
      notify.error('Please select a Customer or Cash Account');
      return;
    }
    if (!salesLedgerId) {
      notify.error('Please select a Revenue Ledger');
      return;
    }
    if (items.some(i => !i.productId)) {
      notify.error('Please select products for all lines');
      return;
    }
    if (items.some(i => !i.warehouseId)) {
      notify.error('Please select storage warehouses for all lines');
      return;
    }
    if (items.some(i => !i.unitId || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0)) {
      notify.error('Quantities must be greater than zero');
      return;
    }
    if (totalAmount <= 0) { notify.error('Sale amount must be greater than zero'); return; }

    // Negative Stock Validation
    for (const item of items) {
       const currentStock = getStockLevel(vouchers, item.productId, item.warehouseId);
       // If editing, adjust the current stock by adding back the original quantity
       const originalQty = editVoucher?.stockLines.find(sl => sl.productId === item.productId && sl.warehouseId === item.warehouseId)?.quantity || 0;
       const available = currentStock - originalQty; // originalQty is negative in sale
       
       if (available - item.quantity < 0) {
          const product = products.find(p => p.id === item.productId);
          notify.error(`Insufficient stock for ${product?.name}. Available: ${available}`);
          return;
       }
    }

    setSubmitting(true);
    try {
      const rateNum = Number(exchangeRate);
      const totalAmountBase = totalAmount * rateNum;
      const selectedParty = parties.find(p => p.id === partyId);
      const debtorLedgerId = selectedParty ? selectedParty.ledgerId : directLedgerId;
      
      if (!debtorLedgerId) {
        notify.error('Selected customer has no linked ledger account.');
        setSubmitting(false);
        return;
      }

      const accountingLines: VoucherLine[] = [
        { 
          ledgerId: debtorLedgerId, 
          debit: totalAmountBase, 
          credit: 0,
          txnDebit: totalAmount,
          txnCredit: 0 
        },
        { 
          ledgerId: salesLedgerId, 
          debit: 0, 
          credit: totalAmountBase,
          txnDebit: 0,
          txnCredit: totalAmount 
        }
      ];

      const stockLines: StockLine[] = items.map(item => ({
        productId: item.productId, 
        warehouseId: item.warehouseId, 
        unitId: item.unitId,
        quantity: -Number(item.quantity), 
        rate: Number(item.rate) * rateNum
      }));

      const voucherData = {
        businessId: business.id, 
        type: 'Sale', 
        date, 
        number: editVoucher?.number || `SL-${Date.now()}`, 
        status: 'Posted' as VoucherStatus,
        narration, 
        actorId: actor.id, 
        currencyId: currencyId, 
        exchangeRate: rateNum || 1,
        partyId: partyId || null, 
        lines: accountingLines, 
        stockLines, 
        updatedAt: serverTimestamp()
      };

      if (editVoucher) {
        await updateDoc(doc(db, 'vouchers', editVoucher.id), voucherData);
      } else {
        await addDoc(collection(db, 'vouchers'), {
          ...voucherData,
          createdAt: serverTimestamp()
        });
      }
      notify.success(editVoucher ? 'Sale updated successfully' : 'Sale posted successfully');
      onComplete();
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Sale Voucher');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>;

  return (
    <TransactionVoucherLayout
      title="Sale Voucher"
      icon={ShoppingCart}
      refNo="AUTO-GENERATED"
      suggestions={getSuggestions()}
      onSelectSuggestion={handleSelectSuggestion}
      activeFieldLabel={activeField?.type}
      onCreateNew={() => setShowQuickCreate(true)}
      totalAmount={totalAmount}
      currencyCode={selectedCurrency?.code || ''}
      currencySymbol={selectedCurrency?.symbol || ''}
      exchangeRate={exchangeRate}
      submitting={submitting}
      footerActionLabel="Confirm & Post Sale"
      narration={narration}
      onNarrationChange={setNarration}
      onCloseSidebar={() => setActiveField(null)}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-zinc-100">
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block">Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800" />
        </div>
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-zinc-50/20">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block flex justify-between">
            Customer / Cash
            <button type="button" onClick={() => { setActiveField({ type: 'party' }); setShowQuickCreate(true); }} className="hover:text-brand-olive transition-colors">
              <Plus className="w-1.5 h-1.5" />
            </button>
          </label>
          <input 
            type="text" 
            placeholder="Search..." 
            value={parties.find(p => p.id === partyId)?.name || ledgers.find(l => l.id === directLedgerId)?.name || (activeField?.type === 'party' ? searchQuery : '')}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { setActiveField({ type: 'party' }); setSearchQuery(''); }}
            className="w-full bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800 truncate" 
          />
        </div>
        <div className="p-1 sm:p-1.5 border-r border-zinc-100 bg-white">
          <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0.5 block flex justify-between">
            Revenue
            <button type="button" onClick={() => { setActiveField({ type: 'ledger' }); setShowQuickCreate(true); }} className="hover:text-brand-olive transition-colors">
              <Plus className="w-1.5 h-1.5" />
            </button>
          </label>
          <input 
            type="text" 
            placeholder="Search..." 
            value={ledgers.find(l => l.id === salesLedgerId)?.name || (activeField?.type === 'ledger' ? searchQuery : '')}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { setActiveField({ type: 'ledger' }); setSearchQuery(''); }}
            className="w-full bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800 truncate" 
          />
        </div>
        <div className="p-1 sm:p-1.5 bg-zinc-50/20 flex flex-col gap-0.5">
           <div className="flex-1">
              <label className="text-[7px] font-black uppercase tracking-widest text-zinc-300 mb-0 block">CCY</label>
              <div className="relative">
                <select required
                  value={currencyId} 
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full bg-transparent focus:outline-none font-serif italic text-[10px] text-zinc-800 appearance-none pr-3"
                >
                  {currencies.filter(c => c.active || c.id === currencyId).map(c => (
                    <option key={c.id} value={c.id}>{c.code}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-zinc-300 pointer-events-none" />
              </div>
           </div>
           {currencyId !== baseCurrency?.id && (
             <div className="flex items-center gap-0.5">
                <label className="text-[6px] font-black uppercase tracking-widest text-brand-olive mb-0">Rate:</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="1.0"
                  value={exchangeRate} 
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setExchangeRate(val);
                  }}
                  className="bg-transparent focus:outline-none font-mono text-[8px] text-brand-olive font-bold w-10" 
                />
             </div>
           )}
        </div>
      </div>

      <div className="p-0.5 sm:p-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[320px]">
          <thead>
            <tr className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-900/5">
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 font-black">Item & Stock Loc</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-14 sm:w-24 font-black">Qty</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-18 sm:w-32 font-black">Rate</th>
              <th className="px-1.5 py-1 sm:px-2 sm:py-1.5 text-right w-20 sm:w-36 font-black">Net</th>
              <th className="w-6 sm:w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/5">
            {items.map((item, index) => {
              const currentStock = getStockLevel(vouchers, item.productId, item.warehouseId);
              const originalQty = editVoucher?.stockLines.find(sl => sl.productId === item.productId && sl.warehouseId === item.warehouseId)?.quantity || 0;
              const available = currentStock - originalQty; // originalQty is negative in sale
              const showWarning = item.productId && item.warehouseId && (available - Number(item.quantity) < 0);

              return (
                <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                  <td className="p-0 border-r border-zinc-900/5">
                      <div className="flex flex-col">
                        <input 
                          type="text"
                          placeholder="Select Product..."
                          value={products.find(p => p.id === item.productId)?.name || (activeField?.type === 'product' && activeField?.index === index ? searchQuery : '')}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => { setActiveField({ type: 'product', index }); setSearchQuery(''); }}
                          className={cn(
                            "w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 font-serif italic text-[10px] sm:text-sm focus:outline-none",
                            showWarning ? "text-red-500" : "text-zinc-800"
                          )}
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
                        {item.productId && (
                           <div className="px-1.5 pb-0.5 sm:px-2 sm:pb-1 -mt-0.5 flex items-center gap-1">
                              <div className={cn("text-[6px] font-black uppercase tracking-widest", showWarning ? "text-red-400" : "text-zinc-300")}>
                                 Avl: {available}
                              </div>
                           </div>
                        )}
                     </div>
                  </td>
                  <td className="p-0 border-r border-zinc-900/5">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0"
                      value={item.quantity === 0 ? '' : item.quantity} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        updateItem(index, 'quantity', val);
                      }} 
                      className={cn(
                        "w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-bold text-[10px] sm:text-sm focus:outline-none",
                        showWarning ? "text-red-600" : ""
                      )} 
                    />
                  </td>
                  <td className="p-0 border-r border-zinc-900/5">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00"
                      value={item.rate === 0 ? '' : item.rate} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        updateItem(index, 'rate', val);
                      }} 
                      className="w-full bg-transparent px-1.5 py-1.5 sm:px-2 sm:py-2 text-right font-mono text-[10px] sm:text-sm focus:outline-none" 
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
              );
            })}
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
