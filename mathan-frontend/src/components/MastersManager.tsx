import React, { useState } from 'react';
import { 
  Users, 
  Layers, 
  Building2, 
  Package, 
  Ruler, 
  Calendar,
  Search,
  Plus,
  Filter,
  MoreVertical,
  ChevronRight,
  Wallet,
  Box,
  CalendarDays,
  Target,
  UserRound,
  Globe,
  ListTree
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Helper components (will define within or separate)
import AccountGroupsTab from './masters/AccountGroupsTab';
import LedgersTab from './masters/LedgersTab';
import PartiesTab from './masters/PartiesTab';
import UnitsTab from './masters/UnitsTab';
import WarehousesTab from './masters/WarehousesTab';
import ProductsTab from './masters/ProductsTab';
import PeriodsTab from './masters/PeriodsTab';
import CostCentersTab from './masters/CostCentersTab';
import EmployeesTab from './masters/EmployeesTab';
import CurrenciesTab from './masters/CurrenciesTab';
import ChartOfAccountsTab from './masters/ChartOfAccountsTab';

const tabs = [
  { id: 'chart', label: 'Chart of Accounts', icon: ListTree },
  { id: 'groups', label: 'Groups', icon: Layers },
  { id: 'ledgers', label: 'All Ledgers', icon: Wallet },
  { id: 'parties', label: 'Customers & Suppliers', icon: Users },
  { id: 'units', label: 'Units', icon: Ruler },
  { id: 'warehouses', label: 'Warehouses', icon: Package },
  { id: 'products', label: 'Products', icon: Box },
  { id: 'periods', label: 'Periods', icon: CalendarDays },
  { id: 'costCenters', label: 'Cost Centers', icon: Target },
  { id: 'employees', label: 'Employees', icon: UserRound },
  { id: 'currencies', label: 'Currencies', icon: Globe },
];

export default function MastersManager() {
  const [activeTab, setActiveTab] = useState('groups');

  return (
    <div className="space-y-4 sm:space-y-10 pb-12">
      <div className="space-y-2 px-4 lg:px-0">
        <h2 className="text-3xl sm:text-5xl font-serif italic text-zinc-900 tracking-tight">Master Foundations</h2>
        <div className="flex items-center gap-3">
          <div className="h-[2px] w-12 bg-zinc-950" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Core Configuration Entities</p>
        </div>
      </div>

      <div className="flex flex-nowrap gap-3 pb-2 overflow-x-auto scrollbar-hide px-4 lg:px-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 active:scale-95",
                isActive 
                  ? "bg-brand-olive border-brand-olive text-white shadow-xl shadow-brand-olive/20" 
                  : "bg-white border-transparent text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-none sm:rounded-[40px] shadow-2xl border-y sm:border border-zinc-100 shadow-zinc-900/5 min-h-[600px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'groups' && <AccountGroupsTab />}
            {activeTab === 'chart' && <ChartOfAccountsTab />}
            {activeTab === 'ledgers' && <LedgersTab />}
            {activeTab === 'parties' && <PartiesTab />}
            {activeTab === 'units' && <UnitsTab />}
            {activeTab === 'warehouses' && <WarehousesTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'periods' && <PeriodsTab />}
            {activeTab === 'costCenters' && <CostCentersTab />}
            {activeTab === 'employees' && <EmployeesTab />}
            {activeTab === 'currencies' && <CurrenciesTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
