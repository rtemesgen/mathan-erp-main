import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from '../lib/restStore';
import { db, handleApiError, OperationType } from '../lib/data';
import { Voucher, Ledger, Product, Party, AccountGroup, Currency } from '../types';
import { useBusiness } from '../hooks/useBusiness';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import DemoAndTestingSuite from './DemoAndTestingSuite';

export default function Overview({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { business, currency } = useBusiness();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;

    const qV = query(collection(db, 'vouchers'), where('businessId', '==', business.id));
    const qP = query(collection(db, 'products'), where('businessId', '==', business.id));
    const qC = query(collection(db, 'parties'), where('businessId', '==', business.id));
    const qL = query(collection(db, 'ledgers'), where('businessId', '==', business.id));
    const qG = query(collection(db, 'accountGroups'), where('businessId', '==', business.id));
    const qCur = query(collection(db, 'currencies'), where('businessId', '==', business.id));

    const unsubV = onSnapshot(qV, (snap) => setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Voucher)));
    const unsubP = onSnapshot(qP, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product)));
    const unsubL = onSnapshot(qL, (snap) => setLedgers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ledger)));
    const unsubG = onSnapshot(qG, (snap) => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AccountGroup)));
    const unsubCur = onSnapshot(qCur, (snap) => setCurrencies(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Currency)));
    const unsubC = onSnapshot(qC, (snap) => {
      setParties(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Party));
      setLoading(false);
    });

    return () => { unsubV(); unsubP(); unsubC(); unsubL(); unsubG(); unsubCur(); };
  }, [business]);

  useEffect(() => {
    if (business && !currencyId) {
      setCurrencyId(business.baseCurrencyId);
    }
  }, [business, currencies]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-olive" /></div>;

  const activeCurrency = currencies.find(c => c.id === currencyId) || currency;
  const symbol = activeCurrency?.symbol || '$'; 

  // Filter vouchers by selected currency
  const filteredVouchers = vouchers.filter(v => {
    if (!activeCurrency) return true;
    const vCurrId = v.currencyId || business?.baseCurrencyId;
    return vCurrId === activeCurrency.id;
  });

  const postedVouchers = filteredVouchers.filter(v => v.status === 'Posted');
  
  // Calculate Revenue (Sum of all credits in Sales vouchers / Revenue accounts)
  const revenue = postedVouchers
    .filter(v => v.type === 'Sale')
    .reduce((sum, v) => sum + (v.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0), 0);

  const outflow = postedVouchers
    .filter(v => v.type === 'Purchase' || v.type === 'Payment' || v.type === 'Payroll')
    .reduce((sum, v) => sum + (v.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0), 0);

  // Cash Position, Receivables, Payables
  const getBalance = (ledgerId: string) => {
    let bal = 0;
    const ledger = ledgers.find(l => l.id === ledgerId);
    if (!ledger) return 0;
    const group = groups.find(g => g.id === ledger.groupId);
    if (!group) return 0;

    // Opening Balance
    bal = (ledger.openingBalance || 0) * (ledger.openingBalanceType === 'Dr' ? 1 : -1);

    // Transactions
    postedVouchers.forEach(v => {
      v.lines?.filter(l => l.ledgerId === ledgerId).forEach(l => {
        bal += ((l.debit || 0) - (l.credit || 0));
      });
    });

    return bal; // Always DR positive for assets
  };

  const cashGroup = groups.find(g => g.name.toLowerCase().includes('bank') || g.name.toLowerCase().includes('cash'));
  const debtorsGroup = groups.find(g => g.name.toLowerCase().includes('debtors'));
  const creditorsGroup = groups.find(g => g.name.toLowerCase().includes('creditors'));

  const cashPos = ledgers.filter(l => l.groupId === cashGroup?.id).reduce((sum, l) => sum + getBalance(l.id), 0);
  const totalAR = ledgers.filter(l => l.groupId === debtorsGroup?.id).reduce((sum, l) => sum + getBalance(l.id), 0);
  const totalAP = ledgers.filter(l => l.groupId === creditorsGroup?.id).reduce((sum, l) => sum + Math.abs(getBalance(l.id)), 0);

  // Chart Data preparation (Last 6 months)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = Array.from({length: 6}).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const mLabel = months[d.getMonth()];
    const mStart = d.getMonth() + 1;
    
    const mSales = postedVouchers
      .filter(v => v.type === 'Sale' && new Date(v.date).getMonth() === d.getMonth())
      .reduce((sum, v) => sum + (v.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0), 0);

    const mPurchases = postedVouchers
      .filter(v => (v.type === 'Purchase' || v.type === 'Payroll') && new Date(v.date).getMonth() === d.getMonth())
      .reduce((sum, v) => sum + (v.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0), 0);

    return { name: mLabel, sales: mSales, purchases: mPurchases };
  });

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-0">
        <div className="space-y-0">
          <h2 className="text-2xl sm:text-3xl font-serif italic text-zinc-900 tracking-tight text-center sm:text-left leading-tight">System Intelligence</h2>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <div className="h-[2px] w-6 bg-zinc-950" />
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400 font-sans">Live Metric Stream</p>
          </div>
        </div>

        {currencies.length > 0 && (
          <div className="px-3 py-1.5 bg-white rounded-xl border border-zinc-200/80 shadow-sm flex items-center gap-2 self-center sm:self-auto">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Selected Currency</span>
            <select 
              value={currencyId} 
              onChange={(e) => setCurrencyId(e.target.value)}
              className="bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800 font-bold cursor-pointer"
            >
              {currencies.map(c => (
                <option key={c.id} value={c.id} className="bg-white text-zinc-900">{c.code} ({c.symbol})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Diagnostic & Testing Suite */}
      <div className="px-4 sm:px-0">
        <DemoAndTestingSuite 
          vouchers={vouchers}
          ledgers={ledgers}
          groups={groups}
          products={products}
          parties={parties}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0">
        <StatCard title="Cash Position" value={`${symbol}${cashPos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} change={cashPos > 0 ? "Healthy" : "Low"} icon={TrendingUp} trend={cashPos > 0 ? "up" : "down"} />
        <StatCard title="Receivables" value={`${symbol}${totalAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={ArrowUpRight} trend="up" />
        <StatCard title="Payables" value={`${symbol}${totalAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={ArrowDownRight} trend="down" />
        <StatCard title="Revenue" value={`${symbol}${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} change="Sales value" icon={TrendingUp} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 px-4 sm:px-0">
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-none sm:rounded-[24px] shadow-2xl border-y sm:border border-zinc-50 shadow-zinc-900/5 relative overflow-hidden group">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 relative z-10 gap-2">
            <div className="space-y-0">
              <h3 className="font-serif italic text-base text-zinc-800">Commercial Output</h3>
              <p className="text-[7px] font-black uppercase tracking-widest text-zinc-300">Sales vs Outgoings</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-brand-olive rounded-full" />
                <span className="text-[6.5px] font-black uppercase tracking-widest text-zinc-400">Invoiced</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                <span className="text-[6.5px] font-black uppercase tracking-widest text-zinc-400">Expense</span>
              </div>
            </div>
          </div>
          <div className="h-[180px] sm:h-[220px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b633d" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#5b633d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#d1d1d1', fontSize: 7, fontWeight: 800}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#d1d1d1', fontSize: 7, fontWeight: 800}} />
                <Tooltip 
                  cursor={{ stroke: '#5b633d', strokeWidth: 1, strokeDasharray: '2 2' }}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px -5px rgb(91 99 61 / 0.1)', padding: '8px', fontSize: '8px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#5b633d" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="purchases" stroke="#f1f1f1" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-none sm:rounded-[24px] shadow-2xl border-y sm:border border-zinc-50 shadow-zinc-900/5 flex flex-col">
          <div className="mb-3">
            <h3 className="font-serif italic text-base text-zinc-800">Operational Alerts</h3>
            <p className="text-[7px] font-black uppercase tracking-widest text-zinc-300">Live Transaction Feed</p>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2 scrollbar-thin">
            {postedVouchers.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-5 h-5 text-zinc-100 mx-auto mb-1" />
                <p className="text-[8px] uppercase font-black text-zinc-200">Waiting for transactions...</p>
              </div>
            ) : postedVouchers.slice(0, 5).map(v => {
              const amount = (v.lines?.reduce((s, l) => s + (l.debit || l.credit || 0), 0) || 0) / 2;
              return (
                <AlertItem 
                  key={v.id}
                  type={v.type === 'Sale' ? 'info' : 'warning'}
                  title={`${v.type} Registered`}
                  desc={`${v.number} - ${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              );
            })}
          </div>
          <button 
            onClick={() => onNavigate?.('reports')}
            className="mt-4 w-full py-2.5 text-[8px] font-black text-white bg-brand-olive rounded-full hover:brightness-110 transition-all uppercase tracking-[0.2em] shadow-lg shadow-brand-olive/10 active:scale-95"
          >
            Full Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, trend }: any) {
  const isUp = trend === "up";
  const barColor = isUp ? "bg-emerald-500" : trend === "down" ? "bg-rose-500" : "bg-zinc-950";
  return (
    <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-300", barColor)} />
      <div>
        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">{title}</span>
        <span className="text-sm sm:text-lg font-mono font-black text-zinc-900 leading-none">{value}</span>
      </div>
      {change && (
        <span className={cn(
          "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.2 rounded border inline-block w-fit mt-1",
          isUp ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-zinc-100 text-zinc-500 border-zinc-200"
        )}>
          {change}
        </span>
      )}
    </div>
  );
}

function AlertItem({ type, title, desc }: any) {
  const icons: any = {
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500" />,
    info: <AlertCircle className="w-4 h-4 text-brand-olive" />,
  };
  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer border border-transparent hover:border-zinc-100">
      <div className="shrink-0 pt-0.5">{icons[type] || icons.info}</div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-zinc-900 truncate">{title}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{desc}</p>
      </div>
    </div>
  );
}
