import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Ledger, ChartDefinition } from '../../types';
import { useBusiness } from '../../hooks/useBusiness';
import { handleApiError, OperationType } from '../../lib/data';

export default function ChartOfAccountsTab() {
  const { business } = useBusiness();
  const [definition, setDefinition] = useState<ChartDefinition | null>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;
    let alive = true;
    setLoading(true);
    Promise.all([api<ChartDefinition>('/chart-of-accounts'), api<Ledger[]>('/masters/ledgers')])
      .then(([chart, accounts]) => { if (alive) { setDefinition(chart); setLedgers(accounts); } })
      .catch(error => handleApiError(error, OperationType.LIST, 'Chart of Accounts'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [business]);

  const visible = useMemo(() => ledgers.filter(account => `${account.accountCode || ''} ${account.name}`.toLowerCase().includes(search.toLowerCase())), [ledgers, search]);
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>;
  if (!definition) return <div className="p-8 text-center text-zinc-400">Chart definition could not be loaded.</div>;

  return <div className="p-6 space-y-8">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Chart of Accounts</h3><p className="text-xs text-zinc-400 mt-1">Backend-defined ranges and normal balances</p></div>
      <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or account..." className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" /></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {definition.ranges.map(range => <div key={range.accountClass} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{range.accountClass}</p><p className="font-mono font-bold text-brand-olive mt-2">{range.fromCode}–{range.toCode}</p><p className="text-[10px] text-zinc-500 mt-2">Normal {range.normalBalance}</p></div>)}
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-zinc-100"><th className="px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-400">Code</th><th className="px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-400">Account</th><th className="px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-400">Nature</th><th className="px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-400">Normal</th><th className="px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-400">Status</th></tr></thead><tbody className="divide-y divide-zinc-50">{visible.map(account => <tr key={account.id}><td className="px-4 py-3 font-mono text-sm font-bold text-brand-olive">{account.accountCode}</td><td className="px-4 py-3 text-sm font-semibold text-zinc-900">{account.name}</td><td className="px-4 py-3 text-xs text-zinc-500">{account.nature}</td><td className="px-4 py-3 text-xs font-bold">{account.normalBalance}</td><td className="px-4 py-3 text-xs text-zinc-400">{account.isSystem ? 'System' : account.active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div>
  </div>;
}
