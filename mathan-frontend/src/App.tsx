/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BusinessProvider, useBusiness } from './hooks/useBusiness';
import Login from './Login';
import { Loader2 } from 'lucide-react';
import { UIProvider, useUI } from './context/UIContext';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const BusinessManager = React.lazy(() => import('./components/BusinessManager'));

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-beige">
      <Loader2 className="w-8 h-8 animate-spin text-brand-olive" />
    </div>
  );
}

function AppContent() {
  const { actor, isLoading: isAuthLoading, logout, setActor } = useAuth();
  const { business, setBusinessId, isLoading: isBusLoading } = useBusiness();
  const { notify, setGlobalLoading } = useUI();

  // Handle business selection and actor update
  const handleBusinessSelect = async (businessId: string) => {
    if (!actor) return;
    
    setGlobalLoading(true);
    try {
      const membership = actor.memberships?.find(m => m.businessId === businessId);
      setActor({ ...actor, businessId, role: membership?.role || actor.role, permissions: membership?.permissions || actor.permissions });
      setBusinessId(businessId);
      notify.success('Enterprise Environment Loaded');
    } catch (err) {
      console.error('Failed to select business', err);
      notify.error('Failed to load environment');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setBusinessId(null);
  };

  if (isAuthLoading || isBusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-beige">
        <Loader2 className="w-8 h-8 animate-spin text-brand-olive" />
      </div>
    );
  }

  // Phase 1: Not Logged In (No Actor)
  if (!actor) return <Login />;
  
  // Phase 2: Actor Profile exists but no Business selected
  if (!business) return <Suspense fallback={<AppLoading />}><BusinessManager ownerId={actor.id} onSelect={handleBusinessSelect} onLogout={handleLogout} /></Suspense>;

  // Phase 3: Full App Access
  return <Suspense fallback={<AppLoading />}><Dashboard onLogout={handleLogout} /></Suspense>;
}

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <BusinessProvider>
          <AppContent />
        </BusinessProvider>
      </AuthProvider>
    </UIProvider>
  );
}
