import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useUI } from './context/UIContext';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();
  const { notify, setGlobalLoading } = useUI();

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setIsLoggingIn(true);
    setGlobalLoading(true);
    setError('');
    try {
      const success = await login(username, pin);
      if (!success) {
        setError('Access Denied. Check your PIN.');
        notify.error('Invalid Credentials');
      } else {
        notify.success('Identity Verified');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection failed.');
      notify.error('Network Error');
    } finally {
      setIsLoggingIn(false);
      setGlobalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-beige font-sans p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-12 bg-white rounded-[50px] shadow-2xl space-y-10 border-t-8 border-brand-olive relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldCheck className="w-32 h-32" />
        </div>

        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-serif italic text-zinc-800 mb-2">Mathan ERP</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Terminal Access</p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-10">
          <div className="space-y-4">
             <label className="block text-[10px] font-black uppercase tracking-widest text-center text-zinc-300">Username</label>
             <input
               type="text"
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               required
               autoComplete="username"
               className="w-full text-center py-4 bg-zinc-50 border-2 border-transparent focus:border-brand-olive/20 rounded-2xl focus:outline-none text-zinc-900"
             />
             <label className="block text-[10px] font-black uppercase tracking-widest text-center text-zinc-300">Enter Security PIN</label>
             <input 
               type="password"
               value={pin}
               required
               inputMode="numeric"
               pattern="[0-9]{4,8}"
               autoComplete="current-password"
               onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
               placeholder="••••"
               className="w-full text-center text-5xl tracking-[0.5em] py-8 bg-zinc-50 border-2 border-transparent focus:border-brand-olive/20 rounded-[2.5rem] focus:outline-none transition-all font-serif italic text-zinc-900"
               maxLength={8}
             />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn || !username.trim() || pin.length < 4}
            className="w-full py-5 bg-brand-olive text-white rounded-[2rem] font-bold text-xs uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-olive/20 active:scale-95"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              'Unlock Terminal'
            )}
          </button>
        </form>
        
        {error && (
          <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest animate-pulse">{error}</p>
        )}
        
        <div className="text-center italic text-[10px] text-zinc-300">
          Professional Enterprise Management
        </div>
      </motion.div>
    </div>
  );
}
