import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, where } from '../lib/restStore';
import { db, handleApiError, OperationType } from '../lib/data';
import { Voucher, Ledger, Product, Warehouse, AccountGroup, Currency } from '../types';
import { 
  FileText, 
  BarChart2, 
  Table as TableIcon, 
  Search,
  Download,
  Filter,
  Loader2,
  Scale,
  X,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { exportVouchersToExcel, exportInventoryToExcel, exportReportToExcel } from '../lib/exportUtils';
import { api } from '../lib/api';

// Report Components
import TrialBalance from './reports/TrialBalance';
import StockSummary from './reports/StockSummary';
import VoucherList from './reports/VoucherList';
import ProfitLoss from './reports/ProfitLoss';
import BalanceSheet from './reports/BalanceSheet';
import OutstandingReport from './reports/OutstandingReport';
import LedgerReport from './reports/LedgerReport';
import { useBusiness } from '../hooks/useBusiness';

// Forms for Edit
import SaleForm from './transactions/SaleForm';
import PurchaseForm from './transactions/PurchaseForm';
import FinanceVoucherForm from './transactions/FinanceVoucherForm';
import JournalForm from './transactions/JournalForm';
import StockAdjustmentForm from './transactions/StockAdjustmentForm';
import StockTransferForm from './transactions/StockTransferForm';
import PayrollForm from './transactions/PayrollForm';

type ReportType = 'trial' | 'stock' | 'vouchers' | 'pandl' | 'balance' | 'outstanding' | 'ledger';

export default function ReportCenter() {
  const { business, currency: baseCurrency } = useBusiness();
  const [activeReport, setActiveReport] = useState<ReportType>('vouchers');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [reportCurrencyId, setReportCurrencyId] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [serverTrialRows, setServerTrialRows] = useState<any[] | undefined>();
  const [serverPnlRows, setServerPnlRows] = useState<any[] | undefined>();
  const [serverBalanceRows, setServerBalanceRows] = useState<any[] | undefined>();
  const [serverOutstandingRows, setServerOutstandingRows] = useState<any[] | undefined>();
  const [serverStockRows, setServerStockRows] = useState<any[] | undefined>();

  // Global and Shared Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actorFilter, setActorFilter] = useState('All');

  useEffect(() => {
    if (!business) return;
    if (baseCurrency) setReportCurrencyId(baseCurrency.id);

    const vQuery = query(collection(db, 'vouchers'), where('businessId', '==', business.id));
    const unsubscribeVouchers = onSnapshot(vQuery, (snap) => {
      setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Voucher[]);
    }, (err) => handleApiError(err, OperationType.LIST, 'vouchers'));

    const fetchData = async () => {
      const q = (path: string) => query(collection(db, path), where('businessId', '==', business.id));
      try {
        const [lSnap, gSnap, pSnap, wSnap, cSnap] = await Promise.all([
          getDocs(q('ledgers')),
          getDocs(q('accountGroups')),
          getDocs(q('products')),
          getDocs(q('warehouses')),
          getDocs(collection(db, 'currencies'))
        ]);

        setLedgers(lSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Ledger[]);
        setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AccountGroup[]);
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
        setWarehouses(wSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Warehouse[]);
        setCurrencies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Currency[]);
      } catch (err) {
        handleApiError(err, OperationType.LIST, 'Report Static Data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => {
      unsubscribeVouchers();
    };
  }, [business, baseCurrency]);

  useEffect(() => {
    if (!business || !['trial', 'pandl', 'balance', 'outstanding', 'stock'].includes(activeReport)) return;
    const params = new URLSearchParams();
    if (startDate) params.set('from', startDate);
    if (endDate) params.set('to', endDate);
    if (reportCurrencyId && reportCurrencyId !== baseCurrency?.id) params.set('currencyId', reportCurrencyId);
    const suffix = params.size ? `?${params}` : '';
    const request = activeReport === 'stock'
      ? api<any[]>(`/reports/stock-summary${suffix}`)
      : activeReport === 'outstanding'
      ? api<any[]>('/reports/outstanding')
      : activeReport === 'balance'
      ? Promise.all([api<any[]>(`/reports/balance-sheet${suffix}`), api<any[]>(`/reports/profit-loss${suffix}`)]).then(([bs, pnl]) => [...bs, ...pnl])
      : api<any[]>(`/reports/${activeReport === 'trial' ? 'trial-balance' : 'profit-loss'}${suffix}`);
    request.then(rows => activeReport === 'trial' ? setServerTrialRows(rows) : activeReport === 'pandl' ? setServerPnlRows(rows) : activeReport === 'balance' ? setServerBalanceRows(rows) : activeReport === 'outstanding' ? setServerOutstandingRows(rows) : setServerStockRows(rows))
      .catch(() => activeReport === 'trial' ? setServerTrialRows(undefined) : activeReport === 'pandl' ? setServerPnlRows(undefined) : activeReport === 'balance' ? setServerBalanceRows(undefined) : activeReport === 'outstanding' ? setServerOutstandingRows(undefined) : setServerStockRows(undefined));
  }, [business, activeReport, startDate, endDate, reportCurrencyId, baseCurrency]);

  const selectedReportCurrency = currencies.find(c => c.id === reportCurrencyId) || baseCurrency;
  const isBase = selectedReportCurrency?.id === baseCurrency?.id;

  // Base-currency statements consolidate every voucher using the stored base amounts.
  // Foreign-currency views remain isolated and use transaction-currency amounts.
  const filteredVouchers = vouchers.filter(v => {
    if (!selectedReportCurrency) return true;
    const vCurrId = v.currencyId || baseCurrency?.id;
    return isBase || vCurrId === selectedReportCurrency.id;
  }).map(v => isBase ? {
    ...v,
    lines: v.lines?.map(l => ({ ...l, txnDebit: undefined, txnCredit: undefined }))
  } : v);

  // Filter dynamically by date-range globally
  const dateFilteredVouchers = filteredVouchers.filter(v => {
    return (!startDate || v.date >= startDate) && (!endDate || v.date <= endDate);
  });

  // Filter dynamically by all active filters in the Voucher list
  const voucherListFilteredVouchers = filteredVouchers.filter(v => {
    const searchMatch = v.number.toLowerCase().includes(search.toLowerCase()) || (v.narration || '').toLowerCase().includes(search.toLowerCase());
    const typeMatch = typeFilter === 'All' || v.type === typeFilter;
    const statusMatch = statusFilter === 'All' || v.status === statusFilter;
    const dateMatch = (!startDate || v.date >= startDate) && (!endDate || v.date <= endDate);
    const actorMatch = actorFilter === 'All' || v.actorId === actorFilter;
    return searchMatch && typeMatch && statusMatch && dateMatch && actorMatch;
  });

  const handleExportExcel = () => {
    const symbol = selectedReportCurrency?.symbol || '$';

    if (activeReport === 'vouchers') {
      exportVouchersToExcel(voucherListFilteredVouchers, ledgers, selectedReportCurrency?.code || 'Base');
    } else if (activeReport === 'stock') {
      if (isBase && serverStockRows) {
        exportInventoryToExcel(serverStockRows.map(row => { const qty = Number(row.quantity || 0); const totalValue = Number(row.inventoryValue || 0); return { productName: row.productName, warehouseName: row.warehouseName, qty, price: qty ? totalValue / qty : 0, totalValue }; }), symbol);
        return;
      }
      const stockMap = new Map<string, number>();
      dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
        v.stockLines?.forEach(line => {
          const key = `${line.productId}_${line.warehouseId}`;
          stockMap.set(key, (stockMap.get(key) || 0) + line.quantity);
        });
      });
      const summaryData = Array.from(stockMap.entries()).map(([key, qty]) => {
        const [pid, wid] = key.split('_');
        const product = products.find(p => p.id === pid);
        const warehouse = warehouses.find(w => w.id === wid);
        return {
          productName: product?.name || 'Unknown',
          warehouseName: warehouse?.name || 'Unknown',
          qty,
          price: (product?.sellingPrice || 0),
          totalValue: qty * (product?.sellingPrice || 0)
        };
      }).filter(s => s.qty !== 0);
      exportInventoryToExcel(summaryData, symbol);
    } else if (activeReport === 'trial') {
      const headers = ['Ledger Account', 'Group', 'Debit Balance', 'Credit Balance'];
      const rows: any[][] = [];
      if (isBase && serverTrialRows) {
        serverTrialRows.forEach(row => {
          const balance = Number(row.closingBalance || 0);
          if (Math.abs(balance) > 0.01) rows.push([`${row.accountCode || ''} ${row.ledgerName}`.trim(), row.groupName || '', balance > 0 ? balance : 0, balance < 0 ? Math.abs(balance) : 0]);
        });
        exportReportToExcel('Trial Balance', headers, rows);
        return;
      }
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group) return;
        let debitBase = 0;
        let creditBase = 0;
        
        if (isBase) {
          if (group.nature === 'Asset' || group.nature === 'Expense') {
            debitBase += (ledger.openingBalance || 0);
          } else {
            creditBase += (ledger.openingBalance || 0);
          }
        }

        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            debitBase += (l.txnDebit || l.debit || 0);
            creditBase += (l.txnCredit || l.credit || 0);
          });
        });
        const balance = debitBase - creditBase;
        if (balance > 0) {
          rows.push([ledger.name, group.name, balance, 0]);
        } else if (balance < 0) {
          rows.push([ledger.name, group.name, 0, Math.abs(balance)]);
        }
      });
      exportReportToExcel('Trial Balance', headers, rows);
    } else if (activeReport === 'pandl') {
      const headers = ['Ledger Account', 'Nature', 'Amount'];
      const rows: any[][] = [];
      if (isBase && serverPnlRows) {
        serverPnlRows.forEach(row => rows.push([`${row.accountCode || ''} ${row.ledgerName}`.trim(), row.nature, row.balance]));
        exportReportToExcel('Profit & Loss Statement', headers, rows);
        return;
      }
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group || (group.nature !== 'Income' && group.nature !== 'Expense')) return;
        let balance = 0;
        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            const lineDebit = l.txnDebit || l.debit || 0;
            const lineCredit = l.txnCredit || l.credit || 0;
            if (group.nature === 'Income') balance += (lineCredit - lineDebit);
            if (group.nature === 'Expense') balance += (lineDebit - lineCredit);
          });
        });
        rows.push([ledger.name, group.nature, balance]);
      });
      exportReportToExcel('Profit & Loss Statement', headers, rows);
    } else if (activeReport === 'balance') {
      const headers = ['Ledger Account', 'Group / Nature', 'Balance'];
      const rows: any[][] = [];
      if (isBase && serverBalanceRows) {
        serverBalanceRows.filter(row => ['Asset', 'Liability', 'Equity'].includes(row.nature)).forEach(row => rows.push([`${row.accountCode || ''} ${row.ledgerName}`.trim(), row.nature, row.balance]));
        exportReportToExcel('Balance Sheet', headers, rows);
        return;
      }
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group || (group.nature !== 'Asset' && group.nature !== 'Liability' && group.nature !== 'Equity')) return;
        let balance = isBase ? (ledger.openingBalance || 0) : 0;
        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            const lineDebit = l.txnDebit || l.debit || 0;
            const lineCredit = l.txnCredit || l.credit || 0;
            if (group.nature === 'Asset') balance += (lineDebit - lineCredit);
            else balance += (lineCredit - lineDebit);
          });
        });
        rows.push([ledger.name, group.nature + ' (' + group.name + ')', balance]);
      });
      exportReportToExcel('Balance Sheet', headers, rows);
    } else if (activeReport === 'outstanding') {
      const headers = ['Bill Number', 'Party Name', 'Outstanding Amount', 'Due Date'];
      const rows: any[][] = [];
      if (serverOutstandingRows) {
        serverOutstandingRows.forEach(row => rows.push([row.billNo, ledgers.find(ledger => ledger.id === row.ledgerId)?.name || 'Unknown Party', row.balance, row.dueDate || 'Immediate']));
        exportReportToExcel('Outstanding Bills', headers, rows);
        return;
      }
      const bills: { billNo: string; ledgerId: string; amount: number; dueDate?: string }[] = [];
      dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
        v.lines?.forEach(l => {
          if (l.billDetails && l.billDetails.length > 0) {
            l.billDetails.forEach(bd => {
              const existing = bills.find(b => b.billNo === bd.billNo && b.ledgerId === l.ledgerId);
              const lineDebit = l.txnDebit || l.debit || 0;
              const val = lineDebit > 0 ? bd.amount : -bd.amount; 
              if (existing) {
                existing.amount += val;
              } else {
                bills.push({ billNo: bd.billNo, ledgerId: l.ledgerId, amount: val, dueDate: bd.dueDate });
              }
            });
          }
        });
      });
      bills.filter(b => Math.abs(b.amount) > 0.01).forEach(b => {
        const partyName = ledgers.find(led => led.id === b.ledgerId)?.name || 'Unknown Party';
        rows.push([b.billNo, partyName, b.amount, b.dueDate || 'Immediate']);
      });
      exportReportToExcel('Outstanding Bills', headers, rows);
    } else if (activeReport === 'ledger') {
      const headers = ['Voucher Date', 'Voucher Number', 'Type', 'Debit', 'Credit', 'Narration'];
      const rows: any[][] = [];
      dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
        v.lines?.forEach(l => {
          const lineDebit = l.txnDebit || l.debit || 0;
          const lineCredit = l.txnCredit || l.credit || 0;
          rows.push([v.date, v.number, v.type, lineDebit, lineCredit, v.narration || '']);
        });
      });
      exportReportToExcel('Ledger General Statement', headers, rows);
    }
  };

  const renderKPIs = () => {
    const rate = selectedReportCurrency?.exchangeRate || 1;
    const symbol = selectedReportCurrency?.symbol || '$';

    if (activeReport === 'vouchers') {
      const posted = voucherListFilteredVouchers.filter(v => v.status === 'Posted');
      const totalVolume = posted.reduce((sum, v) => sum + (v.lines?.reduce((s, l) => s + (l.txnDebit || l.debit || 0), 0) || 0), 0);
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Total Postings</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{posted.length}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">vouchers successfully audited</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Accounting Volume</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">cumulative journal debit flow</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-olive group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Last Activity</span>
              <span className="text-lg font-serif italic text-zinc-900 leading-none">
                {posted.length > 0 
                  ? new Date(Math.max(...posted.map(v => new Date(v.date).getTime()))).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'No postings yet'}
              </span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">most recent voucher audit date</span>
          </div>
        </div>
      );
    }

    if (activeReport === 'stock') {
      const stockMap = new Map<string, number>();
      if (isBase && serverStockRows) serverStockRows.forEach(row => stockMap.set(`${row.productId}_${row.warehouseId}`, Number(row.quantity || 0)));
      else dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => v.stockLines?.forEach(line => {
        const key = `${line.productId}_${line.warehouseId}`;
        stockMap.set(key, (stockMap.get(key) || 0) + line.quantity);
      }));
      let totalStockValue = 0;
      let totalQty = 0;
      let itemsCount = 0;
      Array.from(stockMap.entries()).forEach(([key, qty]) => {
        if (qty === 0) return;
        const [pid] = key.split('_');
        const product = products.find(p => p.id === pid);
        const price = (product?.sellingPrice || 0);
        const serverRow = serverStockRows?.find(row => row.productId === pid && row.warehouseId === key.split('_')[1]);
        totalStockValue += serverRow?.inventoryValue != null ? Number(serverRow.inventoryValue) : qty * price;
        totalQty += qty;
        itemsCount++;
      });

      // Convert stock value using currency exchange rate if non-base
      const convertedStockValue = totalStockValue * rate;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Total Stock Value</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{convertedStockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">{isBase && serverStockRows ? 'backend moving-average cost' : 'provisional selling price'} ({selectedReportCurrency?.code})</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Stock Items Balance</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{totalQty.toLocaleString()} <span className="text-xs font-sans font-medium text-zinc-400">units</span></span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">total units across all warehouse positions</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Active SKUs</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{itemsCount} <span className="text-xs font-sans font-medium text-zinc-400">positions</span></span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">unique product-warehouse allocations</span>
          </div>
        </div>
      );
    }

    if (activeReport === 'trial') {
      let totalDebits = 0;
      let totalCredits = 0;
      ledgers.forEach(ledger => {
        let debitBase = 0;
        let creditBase = 0;
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group) return;
        
        if (isBase) {
          if (group.nature === 'Asset' || group.nature === 'Expense') {
            debitBase += (ledger.openingBalance || 0);
          } else {
            creditBase += (ledger.openingBalance || 0);
          }
        }

        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            debitBase += (l.txnDebit || l.debit || 0);
            creditBase += (l.txnCredit || l.credit || 0);
          });
        });
        const balance = debitBase - creditBase;
        if (balance > 0) totalDebits += balance;
        else if (balance < 0) totalCredits += Math.abs(balance);
      });
      const discrepancy = Math.abs(totalDebits - totalCredits);
      const isBalanced = discrepancy < 0.01;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Total Debits Summary</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{totalDebits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">asset and expense balances</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Total Credits Summary</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{totalCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">liability, equity and income balances</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-300", isBalanced ? "bg-emerald-500" : "bg-rose-500")} />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Ledger Integrity</span>
              <div className="mt-0.5">
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block border",
                  isBalanced 
                    ? "bg-emerald-50/50 text-emerald-700 border-emerald-100" 
                    : "bg-rose-50/50 text-rose-700 border-rose-100"
                )}>
                  {isBalanced ? "✓ Balanced Perfectly" : "⚠ Trial Disbalance"}
                </span>
              </div>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">
              {isBalanced ? "Double-entry integrity verified" : `Discrepancy: ${symbol}${discrepancy.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>
      );
    }

    if (activeReport === 'pandl') {
      let revenue = 0;
      let expenses = 0;
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group || (group.nature !== 'Income' && group.nature !== 'Expense')) return;
        let balance = 0;
        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            const lineDebit = l.txnDebit || l.debit || 0;
            const lineCredit = l.txnCredit || l.credit || 0;
            if (group.nature === 'Income') balance += (lineCredit - lineDebit);
            if (group.nature === 'Expense') balance += (lineDebit - lineCredit);
          });
        });
        if (group.nature === 'Income') revenue += balance;
        if (group.nature === 'Expense') expenses += balance;
      });
      const netProfit = revenue - expenses;
      const isProfitable = netProfit >= 0;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Gross Revenue</span>
              <span className="text-xl font-mono font-black text-emerald-700 leading-none">+{symbol}{revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">cumulative operating income streams</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Operating Expenses</span>
              <span className="text-xl font-mono font-black text-rose-600 leading-none">-{symbol}{expenses.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">all audited expenses and costs</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-300", isProfitable ? "bg-emerald-500" : "bg-rose-500")} />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Net Earnings Position</span>
              <span className={cn(
                "text-xl font-mono font-black block mt-0.5 leading-none",
                isProfitable ? "text-emerald-800" : "text-rose-800"
              )}>
                {isProfitable ? '+' : ''}{symbol}{netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">
              {isProfitable ? "★ operating in net surplus" : "⚠ operating at a loss"}
            </span>
          </div>
        </div>
      );
    }

    if (activeReport === 'balance') {
      let assets = 0;
      let liabilities = 0;
      let equity = 0;
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group || (group.nature !== 'Asset' && group.nature !== 'Liability' && group.nature !== 'Equity')) return;
        let balance = isBase ? (ledger.openingBalance || 0) : 0;
        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            const lineDebit = l.txnDebit || l.debit || 0;
            const lineCredit = l.txnCredit || l.credit || 0;
            if (group.nature === 'Asset') balance += (lineDebit - lineCredit);
            else balance += (lineCredit - lineDebit);
          });
        });
        if (group.nature === 'Asset') assets += balance;
        if (group.nature === 'Liability') liabilities += balance;
        if (group.nature === 'Equity') equity += balance;
      });
      let plRev = 0;
      let plExp = 0;
      ledgers.forEach(ledger => {
        const group = groups.find(g => g.id === ledger.groupId);
        if (!group || (group.nature !== 'Income' && group.nature !== 'Expense')) return;
        let balance = 0;
        dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
          v.lines?.filter(l => l.ledgerId === ledger.id).forEach(l => {
            const lineDebit = l.txnDebit || l.debit || 0;
            const lineCredit = l.txnCredit || l.credit || 0;
            if (group.nature === 'Income') balance += (lineCredit - lineDebit);
            if (group.nature === 'Expense') balance += (lineDebit - lineCredit);
          });
        });
        if (group.nature === 'Income') plRev += balance;
        if (group.nature === 'Expense') plExp += balance;
      });
      const curProfit = plRev - plExp;
      const totalEquityLiab = liabilities + equity + curProfit;
      const equationsMatch = Math.abs(assets - totalEquityLiab) < 0.05;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Total Assets</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{assets.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">cash, accounts receivable, inventory value</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Equity & Liabilities</span>
              <span className="text-xl font-mono font-black text-zinc-900 leading-none">{symbol}{totalEquityLiab.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">retained earnings, capital and liabilities</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-300", equationsMatch ? "bg-emerald-500" : "bg-rose-500")} />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Accounting Balance Check</span>
              <div className="mt-0.5">
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block border",
                  equationsMatch 
                    ? "bg-emerald-50/50 text-emerald-700 border-emerald-100" 
                    : "bg-rose-50/50 text-rose-700 border-rose-100"
                )}>
                  {equationsMatch ? "✓ Assets = Liab + Equity" : "⚠ Balanced Disruption"}
                </span>
              </div>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">
              {equationsMatch ? "Full balance sheet equilibrium" : "Assets mismatch liabilities & equity"}
            </span>
          </div>
        </div>
      );
    }

    if (activeReport === 'outstanding') {
      const bills: { billNo: string; ledgerId: string; amount: number; dueDate?: string }[] = [];
      dateFilteredVouchers.filter(v => v.status === 'Posted').forEach(v => {
        v.lines?.forEach(l => {
          if (l.billDetails && l.billDetails.length > 0) {
            l.billDetails.forEach(bd => {
              const existing = bills.find(b => b.billNo === bd.billNo && b.ledgerId === l.ledgerId);
              const lineDebit = l.txnDebit || l.debit || 0;
              const val = lineDebit > 0 ? bd.amount : -bd.amount; 
              if (existing) {
                existing.amount += val;
              } else {
                bills.push({ billNo: bd.billNo, ledgerId: l.ledgerId, amount: val, dueDate: bd.dueDate });
              }
            });
          }
        });
      });
      const outstandingBills = bills.filter(b => Math.abs(b.amount) > 0.01);
      const receivables = outstandingBills.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
      const payables = outstandingBills.filter(b => b.amount < 0).reduce((sum, b) => sum + Math.abs(b.amount), 0);
      const netCreditPosition = receivables - payables;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-8 no-print">
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Accounts Receivable (AR)</span>
              <span className="text-xl font-mono font-black text-emerald-700 leading-none">+{symbol}{receivables.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">outstanding customer bills receivable</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 group-hover:w-1.5 transition-all duration-300" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Accounts Payable (AP)</span>
              <span className="text-xl font-mono font-black text-rose-600 leading-none">-{symbol}{payables.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">due supplier bills payable</span>
          </div>
          <div className="relative overflow-hidden pl-5 py-3 pr-4 bg-white border border-zinc-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-zinc-200/80 group flex flex-col justify-between h-20">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all duration-300", netCreditPosition >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-0.5">Net Credit Balance</span>
              <span className={cn(
                "text-xl font-mono font-black block mt-0.5 leading-none",
                netCreditPosition >= 0 ? "text-emerald-800" : "text-rose-800"
              )}>
                {netCreditPosition >= 0 ? '+' : ''}{symbol}{netCreditPosition.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[8px] text-zinc-400 font-medium block truncate">
              {netCreditPosition >= 0 ? "★ favorable trade receivables position" : "⚠ high supplier credit obligations"}
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  const reportCategories = [
    {
      title: 'Registers & Books',
      items: [
        { id: 'vouchers', label: 'Voucher List', icon: FileText, desc: 'Detailed transaction logs' },
        { id: 'ledger', label: 'Ledger Statement', icon: FileText, desc: 'Account-wise history' },
      ]
    },
    {
      title: 'Financial Statements',
      items: [
        { id: 'trial', label: 'Trial Balance', icon: TableIcon, desc: 'Debit/Credit summaries' },
        { id: 'pandl', label: 'Profit & Loss', icon: BarChart2, desc: 'Revenue vs Expenses' },
        { id: 'balance', label: 'Balance Sheet', icon: Scale, desc: 'Assets & Liabilities' },
      ]
    },
    {
      title: 'Operational Reports',
      items: [
        { id: 'stock', label: 'Inventory', icon: BarChart2, desc: 'Stock levels & value' },
        { id: 'outstanding', label: 'Outstanding Bills', icon: FileText, desc: 'Receivables & Payables' },
      ]
    }
  ];

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-olive" /></div>;

  if (editingVoucher) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setEditingVoucher(null)}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-bold text-sm transition-colors"
          >
            <X className="w-4 h-4" /> Cancel Edit & Return to Reports
          </button>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-olive bg-brand-olive/5 px-6 py-2 rounded-full border border-brand-olive/10">
            Editing Mode: {editingVoucher.number}
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-zinc-100 shadow-2xl p-1 shadow-brand-olive/10">
          {editingVoucher.type === 'Sale' && <SaleForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {editingVoucher.type === 'Purchase' && <PurchaseForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {editingVoucher.type === 'Journal' && <JournalForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {editingVoucher.type === 'StockAdjustment' && <StockAdjustmentForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {editingVoucher.type === 'StockTransfer' && <StockTransferForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {editingVoucher.type === 'Payroll' && <PayrollForm editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />}
          {(editingVoucher.type === 'Payment' || editingVoucher.type === 'Receipt' || editingVoucher.type === 'Contra') && (
            <FinanceVoucherForm type={editingVoucher.type} editVoucher={editingVoucher} onComplete={() => setEditingVoucher(null)} />
          )}
        </div>
      </div>
    );
  }

  const activeReportItem = reportCategories.flatMap(c => c.items).find(i => i.id === activeReport);

  return (
    <div className="space-y-4 sm:space-y-8 pb-12">
      {/* Title Header */}
      <div className="space-y-2 px-4 lg:px-0 no-print">
        <h2 className="text-3xl sm:text-5xl font-serif italic text-zinc-900 tracking-tight">Reports Hub</h2>
        <div className="flex items-center gap-3">
          <div className="h-[2px] w-12 bg-zinc-950" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Audited Financial Intelligence</p>
        </div>
      </div>

      {/* Horizontal Scroll Navigation */}
      <div className="flex flex-nowrap gap-3 pb-3 overflow-x-auto scrollbar-hide px-4 lg:px-0 no-print">
        {reportCategories.flatMap(cat => cat.items.map(item => ({ ...item, category: cat.title }))).map((item) => {
          const Icon = item.icon;
          const isActive = activeReport === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveReport(item.id as ReportType)}
              className={cn(
                "flex flex-col items-start px-6 py-3.5 rounded-2xl text-left border transition-all duration-300 whitespace-nowrap active:scale-95 min-w-[170px]",
                isActive 
                  ? "bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-950/25 scale-[1.02]" 
                  : "bg-white border-zinc-100 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-200"
              )}
            >
              <span className={cn("text-[7px] font-black uppercase tracking-[0.15em] mb-1.5 block", isActive ? "text-zinc-400" : "text-zinc-300")}>
                {item.category}
              </span>
              <div className="flex items-center gap-2">
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-white" : "text-zinc-300")} />
                <span className="text-[10px] font-black uppercase tracking-wider leading-none">{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-none sm:rounded-[40px] border-y sm:border border-zinc-100 shadow-2xl shadow-zinc-900/5 min-h-[780px] overflow-hidden flex flex-col print-card w-full">
        <div className="px-8 pt-8 pb-6 border-b border-zinc-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-50/10 print:bg-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-white shadow-lg shadow-zinc-950/10 print:hidden">
              {activeReportItem?.icon && <activeReportItem.icon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5 print:hidden mb-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                  {reportCategories.find(c => c.items.some(i => i.id === activeReport))?.title || 'Statement'}
                </span>
                <span className="text-[8px] text-zinc-300">•</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <div className="hidden print:block text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-1">
                {business?.name || "Enterprise Auditor"} • Financial Records
              </div>
              <h3 className="text-xl sm:text-2xl font-serif italic text-zinc-900 leading-none">{activeReportItem?.label}</h3>
              <p className="hidden print:block text-[9px] font-mono tracking-widest text-zinc-500 mt-1">
                Statement Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} • Base Currency: {selectedReportCurrency?.code}
              </p>
            </div>
          </div>

          {/* Action buttons + currency drop down */}
          <div className="flex flex-wrap items-center gap-3 no-print">
            <div className="px-4 py-2 bg-zinc-100/60 rounded-xl border border-zinc-200/40 flex items-center gap-2">
               <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Currency</span>
               <select 
                 value={reportCurrencyId} 
                 onChange={(e) => setReportCurrencyId(e.target.value)}
                 className="bg-transparent focus:outline-none font-serif italic text-xs text-zinc-800 font-bold cursor-pointer"
               >
                 {currencies.map(c => (
                   <option key={c.id} value={c.id} className="bg-white text-zinc-900">{c.code}</option>
                 ))}
               </select>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm shadow-zinc-950/10"
              >
                 <Printer className="w-3.5 h-3.5" />
                 <span>PDF Print</span>
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-zinc-200 hover:border-zinc-900 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
              >
                 <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                 <span>Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic KPI Widgets */}
        <div className="pt-6">
          {renderKPIs()}
        </div>

        <div className="flex-1 print-full-width">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeReport}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {activeReport === 'vouchers' && (
                <VoucherList 
                  vouchers={filteredVouchers} 
                  onEdit={setEditingVoucher} 
                  ledgers={ledgers} 
                  products={products} 
                  warehouses={warehouses} 
                  search={search}
                  setSearch={setSearch}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  actorFilter={actorFilter}
                  setActorFilter={setActorFilter}
                />
              )}
              {activeReport === 'ledger' && <LedgerReport vouchers={voucherListFilteredVouchers} ledgers={ledgers} currency={selectedReportCurrency} isBase={isBase} />}
              {activeReport === 'stock' && <StockSummary vouchers={voucherListFilteredVouchers} products={products} warehouses={warehouses} currency={selectedReportCurrency} serverRows={isBase ? serverStockRows : undefined} />}
              {activeReport === 'trial' && <TrialBalance vouchers={voucherListFilteredVouchers} ledgers={ledgers} groups={groups} currency={selectedReportCurrency} isBase={isBase} serverRows={isBase ? serverTrialRows : undefined} />}
              {activeReport === 'pandl' && <ProfitLoss vouchers={voucherListFilteredVouchers} ledgers={ledgers} groups={groups} currency={selectedReportCurrency} serverRows={isBase ? serverPnlRows : undefined} />}
              {activeReport === 'balance' && <BalanceSheet vouchers={voucherListFilteredVouchers} ledgers={ledgers} groups={groups} currency={selectedReportCurrency} isBase={isBase} serverRows={isBase ? serverBalanceRows : undefined} />}
              {activeReport === 'outstanding' && <OutstandingReport vouchers={voucherListFilteredVouchers} ledgers={ledgers} currency={selectedReportCurrency} serverRows={serverOutstandingRows} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
