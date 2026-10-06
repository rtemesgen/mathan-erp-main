import React, { createContext, useContext, useRef, useState } from 'react';
import { Business, Currency } from '../types';
import { apiWithoutStoredBusinessHeader } from '../lib/api';
import { createBusinessContextController, OpenBusinessResult } from '../lib/businessContext';

interface BusinessContextType {
  business: Business | null;
  currency: Currency | null;
  openBusiness: (id: string) => Promise<OpenBusinessResult>;
  clearBusiness: () => void;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
  const [business, setBusiness] = useState<Business | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [isLoading, setIsLoading] = useState(!!browserStorage?.getItem('currentBusinessId'));
  const controllerRef = useRef<ReturnType<typeof createBusinessContextController> | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createBusinessContextController({
      listBusinesses: () => apiWithoutStoredBusinessHeader<Business[]>('/businesses'),
      storage: browserStorage ?? { setItem() {}, removeItem() {} },
      setBusiness,
      setCurrency,
      setLoading: setIsLoading,
    });
  }
  const controller = controllerRef.current;

  return (
    <BusinessContext.Provider value={{
      business,
      currency,
      openBusiness: controller.openBusiness,
      clearBusiness: controller.clearBusiness,
      isLoading,
    }}>
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
