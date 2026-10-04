import React, { createContext, useContext, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface UIContextType {
  setGlobalLoading: (loading: boolean) => void;
  notify: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [globalLoading, setGlobalLoading] = useState(false);

  const notify = {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    info: (msg: string) => toast(msg),
  };

  return (
    <UIContext.Provider value={{ setGlobalLoading, notify }}>
      {children}
      <Toaster position="top-right" expand={false} richColors closeButton />
      
      <AnimatePresence>
        {globalLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 bg-zinc-950 rounded-[2rem] flex items-center justify-center shadow-2xl">
               <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
            <div className="flex flex-col items-center gap-1">
               <p className="font-serif italic text-xl text-zinc-900">Mathan Enterprise</p>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Processing Secure Request...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
