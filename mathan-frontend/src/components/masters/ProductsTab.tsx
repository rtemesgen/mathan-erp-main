import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, where, writeBatch, doc, serverTimestamp } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Product, Unit } from '../../types';
import { Plus, Search, Loader2, Trash2, CheckCircle2, XCircle, MoreVertical, CheckSquare, Square } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { required, positiveNumber } from '../../lib/validation';
import { toast } from 'sonner';

export default function ProductsTab() {
  const { business } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [newName, setNewName] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newPrice, setNewPrice] = useState<string | number>('');
  const [initialStock, setInitialStock] = useState<string | number>('');
  const [initialRate, setInitialRate] = useState<string | number>('');
  const [initialWarehouseId, setInitialWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    if (!business) return;
    const qProducts = query(collection(db, 'products'), where('businessId', '==', business.id));
    const qUnits = query(collection(db, 'units'), where('businessId', '==', business.id));
    const qWarehouses = query(collection(db, 'warehouses'), where('businessId', '==', business.id));
    
    const unsubUnits = onSnapshot(qUnits, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Unit[];
      setUnits(data);
      if (data.length > 0 && !newUnitId) setNewUnitId(data[0].id);
    }, (err) => handleApiError(err, OperationType.LIST, 'units'));

    const unsubWH = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWarehouses(data);
      if (data.length > 0 && !initialWarehouseId) setInitialWarehouseId(data[0].id);
    });

    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      setLoading(false);
    }, (err) => handleApiError(err, OperationType.LIST, 'products'));

    return () => { unsubUnits(); unsubProducts(); unsubWH(); };
  }, [business]);

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (!business || selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Are you sure you want to delete ${selectedIds.length} products?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, 'products', id);
        if (action === 'delete') {
          batch.delete(ref);
        } else {
          batch.update(ref, { active: action === 'activate' });
        }
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'Batch Products');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(newName, 'Product name');
    const unitError = required(newUnitId, 'Base unit');
    const priceError = positiveNumber(newPrice, 'Selling price');
    if (nameError || unitError || priceError || !business) { toast.error(nameError || unitError || priceError || 'Business is required'); return; }
    try {
      const prodRef = await addDoc(collection(db, 'products'), { 
        businessId: business.id,
        name: newName.trim(),
        baseUnitId: newUnitId, 
        sellingPrice: Number(newPrice), 
        active: true 
      });

      // Create initial stock adjustment if needed
      if (initialStock > 0 && initialWarehouseId) {
        await addDoc(collection(db, 'vouchers'), {
          businessId: business.id,
          type: 'StockAdjustment',
          date: new Date().toISOString().split('T')[0],
          number: `OB-${Date.now()}`,
          status: 'Posted',
          narration: `Opening balance for ${newName}`,
          actorId: 'system',
          currencyId: business.baseCurrencyId,
          exchangeRate: 1,
          lines: [],
          stockLines: [{
            productId: prodRef.id,
            warehouseId: initialWarehouseId,
            unitId: newUnitId,
            quantity: Number(initialStock),
            rate: Number(initialRate)
          }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setNewName(''); 
      setNewPrice('');
      setInitialStock('');
      setInitialRate('');
      setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'products');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none text-sm" />
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100"><Plus className="w-4 h-4" /> Add Product</button>
      </div>
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 space-y-8 animate-in fade-in slide-in-from-top-4 shadow-xl shadow-zinc-900/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Product Name</label>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-serif italic focus:outline-none focus:ring-2 focus:ring-blue-500/10" placeholder="e.g. Basmati Rice" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Base Unit</label>
              <select value={newUnitId} onChange={(e) => setNewUnitId(e.target.value)} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-serif italic focus:outline-none">
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Selling Price</label>
              <input type="text" inputMode="decimal" placeholder="0.00" required value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-mono focus:outline-none" />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Initial Stock Qty</label>
              <input type="text" inputMode="decimal" placeholder="0" value={initialStock} onChange={(e) => setInitialStock(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-mono focus:outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Cost/Opening Rate</label>
              <input type="text" inputMode="decimal" placeholder="0.00" value={initialRate} onChange={(e) => setInitialRate(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-mono focus:outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-4">Initial Warehouse</label>
              <select value={initialWarehouseId} onChange={(e) => setInitialWarehouseId(e.target.value)} className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl text-lg font-serif italic focus:outline-none">
                <option value="">Select Warehouse...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button type="submit" className="flex-1 py-5 bg-zinc-900 text-white rounded-3xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-zinc-900/10">Register Product Identity</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-8 py-5 border border-zinc-200 text-zinc-400 rounded-3xl text-xs font-black uppercase tracking-widest hover:bg-zinc-50 transition-all">Cancel</button>
          </div>
        </form>
      )}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div> : (
        <div className="relative">
          {selectedIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-8">
              <span className="text-xs font-black uppercase tracking-widest border-r border-zinc-700 pr-6">{selectedIds.length} Selected</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleBatchAction('activate')}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-emerald-400"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Activate</span>
                </button>
                <button 
                  onClick={() => handleBatchAction('deactivate')}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400"
                >
                  <XCircle className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Deactivate</span>
                </button>
                <div className="w-px h-8 bg-zinc-800 mx-2" />
                <button 
                  onClick={() => handleBatchAction('delete')}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 rounded-xl transition-colors text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
                </button>
              </div>
              <button onClick={() => setSelectedIds([])} className="ml-4 text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          )}

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleSelectAll} className="text-zinc-300 hover:text-zinc-500 transition-colors">
                    {selectedIds.length === products.length && products.length > 0 ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Name</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Unit</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Price</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
                <tr key={p.id} className={`hover:bg-zinc-50/50 transition-colors group ${selectedIds.includes(p.id) ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleSelect(p.id)} className="text-zinc-300 hover:text-zinc-500 transition-colors">
                      {selectedIds.includes(p.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500/30'}`} />
                      <span className={`font-semibold ${p.active ? 'text-zinc-900' : 'text-zinc-400 italic'}`}>{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-500">{units.find(u => u.id === p.baseUnitId)?.name}</td>
                  <td className="px-4 py-4 font-mono text-sm text-zinc-600">${p.sellingPrice.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100">
                    <button className="p-2 hover:bg-white rounded-lg transition-all text-zinc-400 hover:text-zinc-900 shadow-sm border border-transparent hover:border-zinc-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
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
