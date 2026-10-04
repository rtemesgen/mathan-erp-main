import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, where } from '../../lib/restStore';
import { db, handleApiError, OperationType } from '../../lib/data';
import { Employee } from '../../types';
import { Plus, Search, Loader2, UserCircle } from 'lucide-react';
import { useBusiness } from '../../hooks/useBusiness';
import { required } from '../../lib/validation';
import { toast } from 'sonner';

export default function EmployeesTab() {
  const { business } = useBusiness();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    basicSalary: 0,
    joinDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'employees'), where('businessId', '==', business.id));
    return onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[]);
      setLoading(false);
    }, (err) => {
      handleApiError(err, OperationType.LIST, 'employees');
    });
  }, [business]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = required(formData.name, 'Employee name');
    const designationError = required(formData.designation, 'Designation');
    if (nameError || designationError || !business) { toast.error(nameError || designationError || 'Business is required'); return; }
    try {
      await addDoc(collection(db, 'employees'), { 
        ...formData, name: formData.name.trim(), designation: formData.designation.trim(),
        businessId: business.id,
        active: true 
      });
      setFormData({ name: '', designation: '', basicSalary: 0, joinDate: new Date().toISOString().split('T')[0] });
      setShowAdd(false);
    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'employees');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search employees..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none text-sm" 
          />
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)} 
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-olive text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-olive/5"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-8 bg-zinc-50 rounded-[30px] border border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Employee Name</label>
            <input 
              required 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" 
              placeholder="e.g. John Doe" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Designation</label>
            <input 
              required 
              value={formData.designation} 
              onChange={(e) => setFormData({...formData, designation: e.target.value})} 
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" 
              placeholder="e.g. Senior Accountant" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Basic Salary</label>
            <input 
              type="number"
              required 
              value={formData.basicSalary} 
              onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value)})} 
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Join Date</label>
            <input 
              type="date"
              required 
              value={formData.joinDate} 
              onChange={(e) => setFormData({...formData, joinDate: e.target.value})} 
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm" 
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3">
             <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-zinc-400 hover:text-zinc-600 font-bold text-sm">Cancel</button>
             <button type="submit" className="px-8 py-2.5 bg-black text-white rounded-xl text-sm font-bold">Register Employee</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Employee</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Designation</th>
                <th className="px-4 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Basic Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map(e => (
                <tr key={e.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-brand-olive group-hover:text-white transition-colors">
                        <UserCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{e.name}</p>
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">Joined: {e.joinDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-6 text-sm text-zinc-500 italic font-serif">{e.designation}</td>
                  <td className="px-4 py-6 text-right font-mono font-bold text-zinc-900">
                    ${e.basicSalary.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
