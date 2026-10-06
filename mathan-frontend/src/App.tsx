/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BusinessProvider, useBusiness } from './hooks/useBusiness';
import { OpenBusinessResult } from './lib/businessContext';
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
  const { business, openBusiness, clearBusiness, isLoading: isBusLoading } = useBusiness();
  const { notify, setGlobalLoading } = useUI();
  const actorRef = useRef(actor);
  actorRef.current = actor;

  // Handle business selection and actor update
  const handleBusinessSelect = async (businessId: string): Promise<OpenBusinessResult> => {
    if (!actor) return { ok: false, code: 'BUSINESS_NOT_AVAILABLE', message: 'No signed-in user can open this business' };
    
    setGlobalLoading(true);
    try {
      const result = await openBusiness(businessId);
      if (!result.ok) {
        notify.error(result.message);
        return result;
      }
      const membership = actor.memberships?.find(m => m.businessId === businessId);
      setActor({ ...actor, businessId, role: membership?.role || actor.role, permissions: membership?.permissions || actor.permissions });
      notify.success('Enterprise Environment Loaded');
      return result;
    } catch (err) {
      console.error('Failed to select business', err);
      notify.error('Failed to load environment');
      return { ok: false, code: 'BUSINESS_CONTEXT_UNAVAILABLE', message: 'Failed to load environment' };
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleSwitchBusiness = () => {
    if (actor) setActor({ ...actor, businessId: '', permissions: undefined });
    clearBusiness();
    notify.success('Choose a business to continue');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearBusiness();
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!actor) {
      clearBusiness();
      return;
    }
    const storedBusinessId = localStorage.getItem('currentBusinessId');
    if (!storedBusinessId) {
      clearBusiness();
      return;
    }
    void openBusiness(storedBusinessId).then(result => {
      if (actorRef.current?.id !== actor.id) return;
      if (result.ok) {
        const membership = actor.memberships?.find(m => m.businessId === storedBusinessId);
        setActor({ ...actor, businessId: storedBusinessId, role: membership?.role || actor.role, permissions: membership?.permissions || actor.permissions });
      } else if (result.code !== 'OPEN_IN_PROGRESS') {
        notify.error(result.message);
      }
    });
  }, [actor?.id, isAuthLoading, openBusiness, clearBusiness, setActor]);

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
  return <Suspense fallback={<AppLoading />}><Dashboard onLogout={handleLogout} onSwitchBusiness={handleSwitchBusiness} /></Suspense>;
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
