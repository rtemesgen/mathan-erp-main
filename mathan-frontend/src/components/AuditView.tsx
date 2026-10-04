import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from '../lib/restStore';
import { db, handleApiError, OperationType } from '../lib/data';
import { AuditLog } from '../types';
import { User, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useBusiness } from '../hooks/useBusiness';

export default function AuditView() {
  const { business } = useBusiness();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;

    const q = query(
      collection(db, 'auditLogs'), 
      where('businessId', '==', business.id)
    );
    
    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuditLog[]);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'auditLogs');
    });
  }, [business]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">System Audit Trail</h2>
        <p className="text-zinc-500">Immutable record of all business critical actions and actor events</p>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-zinc-200 z-0" />
        
        <div className="space-y-6 relative z-10">
          {logs.map((log) => {
            const ts = log.timestamp instanceof Date
              ? log.timestamp
              : new Date(log.timestamp || 0);
            
            return (
              <div key={log.id} className="flex gap-6 items-start group">
                <div className="w-16 flex flex-col items-center shrink-0 pt-2">
                   <span className="text-[10px] font-bold text-zinc-400 uppercase">{format(ts, 'HH:mm')}</span>
                   <div className="w-3 h-3 rounded-full bg-white border-2 border-zinc-200 group-hover:border-blue-500 transition-colors mt-2" />
                </div>
                
                <div className="flex-1 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900">{log.action}</span>
                      <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full" />
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
                        <User className="w-3 h-3" />
                        {log.actorName || 'Unknown Actor'}
                        <span className="text-[10px] bg-zinc-100 px-1.5 rounded uppercase font-bold text-zinc-400">(system)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                       <Clock className="w-3 h-3" />
                       {format(ts, 'MMM dd, yyyy')}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed font-mono bg-zinc-50/50 p-2 rounded-lg border border-zinc-100">
                    {log.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
