import React, { useState } from 'react';
import { User, SubscriptionPlan } from '../types';
import { PLAN_DETAILS } from '../constants';
import { authService } from '../services/authService';

interface AccountSettingsProps {
  user: User;
  onPlanUpdate: (newPlan: SubscriptionPlan) => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onPlanUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePlanChange = async (newPlan: SubscriptionPlan) => {
    if (newPlan === user.plan) return;
    
    setLoading(true);
    setSuccessMsg(null);
    
    try {
      const updated = await authService.updateMyPlan(newPlan);
      onPlanUpdate(updated.plan);
      setSuccessMsg(`Successfully switched to ${PLAN_DETAILS[newPlan].name}`);
    } catch (e: any) {
      setSuccessMsg(e?.message ? `Failed to update plan: ${e.message}` : 'Failed to update plan');
    }
    
    setLoading(false);
    
    // Clear message after 3 seconds
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
           <h3 className="text-lg font-bold text-slate-800">Account Settings</h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div>
             <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Profile Information</h4>
             <div className="space-y-4">
               <div>
                 <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                 <div className="font-medium text-slate-800">{user.name}</div>
               </div>
               <div>
                 <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                 <div className="font-medium text-slate-800">{user.email}</div>
               </div>
               <div>
                 <label className="block text-xs text-slate-400 mb-1">Member Since</label>
                 <div className="text-sm text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</div>
               </div>
               <div>
                 <label className="block text-xs text-slate-400 mb-1">Account Status</label>
                 <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                   {user.status}
                 </span>
               </div>
             </div>
           </div>

           <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Subscription Plan</h4>
              {successMsg && (
                <div className="mb-4 bg-green-50 text-green-700 px-4 py-2 rounded text-sm border border-green-200">
                  {successMsg}
                </div>
              )}
              
              <div className="space-y-3">
                {(Object.keys(PLAN_DETAILS) as SubscriptionPlan[]).map(planKey => {
                   const isCurrent = user.plan === planKey;
                   return (
                     <div 
                        key={planKey}
                        className={`border rounded-lg p-4 flex justify-between items-center transition-all ${
                          isCurrent 
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                            : 'border-slate-200 hover:border-slate-300'
                        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                     >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            {PLAN_DETAILS[planKey].name}
                            {isCurrent && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">Current</span>}
                          </div>
                          <div className="text-xs text-slate-500">{PLAN_DETAILS[planKey].desc}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-slate-900">{PLAN_DETAILS[planKey].price}</div>
                           {!isCurrent && (
                             <button 
                               onClick={() => handlePlanChange(planKey)}
                               className="mt-1 text-xs text-blue-600 hover:underline font-medium"
                             >
                               Switch
                             </button>
                           )}
                        </div>
                     </div>
                   );
                })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;