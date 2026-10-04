import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  BarChart3, 
  Package, 
  Users, 
  ShoppingCart, 
  Tag, 
  FileText, 
  History, 
  LogOut, 
  LayoutDashboard,
  Box,
  Wallet,
  CalendarDays,
  Menu,
  X,
  Plus,
  Settings as SettingsIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Import View Components (Will create these next)
const Overview = React.lazy(() => import('./Overview'));
const MastersManager = React.lazy(() => import('./MastersManager'));
const TransactionPoster = React.lazy(() => import('./TransactionPoster'));
const ReportCenter = React.lazy(() => import('./ReportCenter'));
const AuditView = React.lazy(() => import('./AuditView'));
const UserManagement = React.lazy(() => import('./UserManagement'));
const Settings = React.lazy(() => import('./Settings'));

type View = 'overview' | 'masters' | 'transactions' | 'reports' | 'audit' | 'users' | 'settings';

export default function Dashboard({ onLogout }: { onLogout?: () => Promise<void> }) {
  const { actor, logout } = useAuth();
  const [activeView, setActiveView] = useState<View>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Automatically hide menu if clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if sidebar element exists
      const sidebar = document.getElementById('sidebar-menu');
      const toggleBtn = document.getElementById('sidebar-menu-btn');
      
      if (isSidebarOpen && sidebar && toggleBtn) {
        const targetNode = event.target as Node;
        // If click is outside the sidebar and not on/inside the toggle button, close it
        if (!sidebar.contains(targetNode) && !toggleBtn.contains(targetNode)) {
          setIsSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'masters', label: 'Masters', icon: Users, permission: 'masters' },
    { id: 'transactions', label: 'Transactions', icon: ShoppingCart, permission: 'transactions' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
    { id: 'audit', label: 'Audit Trail', icon: History, permission: 'audit' },
    { id: 'users', label: 'Users', icon: Users, permission: 'users' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, permission: 'settings' },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.permission) return true;
    if (actor?.role === 'admin') return true;
    return actor?.permissions?.[item.permission as keyof typeof actor.permissions];
  });

  return (
    <div className="flex h-screen bg-brand-beige font-sans overflow-hidden">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        id="sidebar-menu"
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (window.innerWidth < 1024 ? 200 : 160) : 0,
          x: isSidebarOpen ? 0 : -280
        }}
        className={cn(
          "bg-white border-r-2 border-zinc-900 text-zinc-600 flex flex-col fixed inset-y-0 left-0 z-50 transition-all print:hidden",
          !isSidebarOpen && "pointer-events-none opacity-0"
        )}
      >
        <div className="p-2 pb-3 flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="w-7 h-7 bg-zinc-950 rounded-lg flex items-center justify-center shrink-0 shadow-lg mt-1">
            <span className="text-white font-serif italic text-base">M</span>
          </div>
          <div className="text-center">
            <span className="text-zinc-900 font-serif italic text-base tracking-tight block leading-none">Mathan</span>
            <span className="text-[6px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-0.5 block">Enterprise</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-1 right-1 p-1 text-zinc-300 hover:text-zinc-900 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <nav className="flex-1 px-1.5 py-1 space-y-0.5 overflow-y-auto pointer-events-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as View);
                  if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all group relative",
                  isActive 
                    ? "bg-zinc-950 text-white shadow-lg shadow-zinc-900/20" 
                    : "hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900"
                )}
              >
                <Icon className={cn("w-3 h-3 shrink-0", isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-900")} />
                <span className="font-bold text-[8px] uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-zinc-100 space-y-1.5 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-[8px] font-black text-zinc-400 uppercase grow-0 shrink-0 border-2 border-white shadow-inner">
              {actor?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-zinc-900 truncate uppercase tracking-tight leading-none">{actor?.name}</p>
              <p className="text-[7px] uppercase tracking-widest font-black text-zinc-300 leading-none mt-0.5">{actor?.role}</p>
            </div>
            <button 
              onClick={onLogout || logout}
              className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-300 hover:text-red-500 active:scale-90"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-screen bg-brand-beige overflow-y-auto">
        <header className="h-8 lg:h-9 bg-white border-b-2 border-zinc-900/5 flex items-center justify-between px-2 lg:px-4 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <button 
              id="sidebar-menu-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 bg-zinc-50 hover:bg-zinc-100 rounded-md transition-all text-zinc-900 shadow-sm flex items-center gap-1"
            >
              <Menu className="w-3 h-3" />
              {!isSidebarOpen && <span className="text-[7px] font-black uppercase tracking-widest hidden sm:block">Menu</span>}
            </button>
            <div className="h-3 w-[1px] bg-zinc-100" />
            <h2 className="text-xs lg:text-sm font-serif italic text-zinc-900 capitalize tracking-tight">{activeView}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-zinc-50 text-[7px] text-zinc-400 rounded-full font-black uppercase tracking-[0.2em] border border-zinc-100">
              <span className="w-1 h-1 bg-zinc-950 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </header>

        <div className="flex-1 p-0 sm:p-0.5 lg:p-1 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <div className="w-full h-full px-0">
                <React.Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-olive" /></div>}>
                  {activeView === 'overview' && <Overview onNavigate={setActiveView} />}
                  {activeView === 'masters' && <MastersManager />}
                  {activeView === 'transactions' && <TransactionPoster />}
                  {activeView === 'reports' && <ReportCenter />}
                  {activeView === 'audit' && <AuditView />}
                  {activeView === 'users' && <UserManagement />}
                  {activeView === 'settings' && <Settings />}
                </React.Suspense>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
