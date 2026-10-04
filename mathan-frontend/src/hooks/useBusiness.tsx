import React, { createContext, useContext, useState, useEffect } from 'react';
import { Business, Currency } from '../types';
import { doc, onSnapshot } from '../lib/restStore';
import { db } from '../lib/data';
import { useUI } from '../context/UIContext';

interface BusinessContextType {
  business: Business | null;
  currency: Currency | null;
  setBusinessId: (id: string | null) => void;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useUI();
  const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
  const [businessId, setBusinessId] = useState<string | null>(browserStorage?.getItem('currentBusinessId') || null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [isLoading, setIsLoading] = useState(!!businessId);

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      setCurrency(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setBusiness(null);
    setCurrency(null);
    let unsubCurrency: (() => void) | undefined;
    const unsubBusiness = onSnapshot(doc(db, 'businesses', businessId), (snap) => {
      if (snap.exists()) {
        const bData = { id: snap.id, ...snap.data() } as Business;
        setBusiness(bData);
        
        // Listen to currency changes too
        unsubCurrency?.();
        if (!bData.baseCurrencyId) { setIsLoading(false); return; }
        unsubCurrency = onSnapshot(doc(db, 'currencies', bData.baseCurrencyId), (cSnap) => {
          if (cSnap.exists()) {
            setCurrency({ id: cSnap.id, ...cSnap.data() } as Currency);
          }
          setIsLoading(false);
        });
      } else {
        setBusinessId(null);
        browserStorage?.removeItem('currentBusinessId');
        setIsLoading(false);
      }
    }, (err) => {
      console.error('Fetch business failed:', err);
      notify.error('Unable to load the selected business');
      setIsLoading(false);
    });

    return () => { unsubCurrency?.(); unsubBusiness(); };
  }, [businessId]);

  const handleSetBusinessId = (id: string | null) => {
    setBusinessId(id);
    if (id) browserStorage?.setItem('currentBusinessId', id);
    else browserStorage?.removeItem('currentBusinessId');
  };

  return (
    <BusinessContext.Provider value={{ business, currency, setBusinessId: handleSetBusinessId, isLoading }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
