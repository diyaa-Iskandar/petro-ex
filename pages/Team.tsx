
import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Users, Plus, X, Trash2, Shield, Eye, EyeOff, Briefcase, Wallet, FileText, ChevronDown, ChevronUp, Image as ImageIcon, ArrowRight, UserPlus, Phone } from 'lucide-react';
import { UserRole, User as UserType, AdvanceStatus, ExpenseStatus } from '../types';

export const Team: React.FC = () => {
  const { t } = useLanguage();
  const { users, addUser, deleteUser, advances, expenses, projects, getStableAvatar } = useData(); 
  const { user: currentUser } = useAuth();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.TECHNICIAN);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  if (!currentUser) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(name && email && password) {
        setIsSubmitting(true);
        await addUser({
            name,
            email,
            password,
            role,
            managerId: currentUser.id,
            rootAdminId: currentUser.rootAdminId || currentUser.id 
        });
        setIsSubmitting(false);
        setShowAddModal(false);
        setName('');
        setEmail('');
        setPassword('');
    }
  };

  // --- Advanced User Details Logic (Hierarchy) ---
  const userDetails = useMemo(() => {
      if (!selectedUser) return null;
      
      // Get all advances where this user is the "Receiver" (userId)
      const userDirectAdvances = advances.filter(a => a.userId === selectedUser.id);
      
      // Group by Project
      const projectIds = Array.from(new Set(userDirectAdvances.map(a => a.projectId)));
      
      const hierarchy = projectIds.map(pid => {
          const project = projects.find(p => p.id === pid);
          const projectAdvances = userDirectAdvances.filter(a => a.projectId === pid);
          
          // For each advance, calculate stats
          const advancesStats = projectAdvances.map(adv => {
              const advExpenses = expenses.filter(e => e.advanceId === adv.id && e.status === ExpenseStatus.APPROVED);
              const spent = advExpenses.reduce((sum, e) => sum + e.amount, 0);
              return { 
                  ...adv, 
                  spent, 
                  // If it's a main advance (Engineer), check if there are sub-advances given out
                  subAdvancesGiven: advances.filter(sub => sub.parentAdvanceId === adv.id)
              };
          });

          // Also, if I am an Admin viewing an Engineer, I want to see Technicians under this Engineer in this project?
          // The prompt says: "When Admin clicks Engineer -> Show Technicians with him and their project links"
          // We handle "Team" separately below.

          return { project, advances: advancesStats };
      });

      // If Admin viewing Engineer, get their team members
      let teamMembers: UserType[] = [];
      if (currentUser.role === UserRole.ADMIN && selectedUser.role === UserRole.ENGINEER) {
          teamMembers = users.filter(u => u.managerId === selectedUser.id);
      }

      return { hierarchy, teamMembers };
  }, [selectedUser, advances, expenses, projects, users, currentUser.role]);

  // --- Render Team List ---
  const renderTeamView = () => {
    if (currentUser.role === UserRole.ADMIN) {
        const engineers = users.filter(u => u.role === UserRole.ENGINEER);
        return (
            <div className="grid grid-cols-1 gap-8">
                {engineers.map(engineer => {
                    const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.managerId === engineer.id);
                    return (
                        <div key={engineer.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden group hover:shadow-xl transition-shadow duration-300">
                             <div className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-100 dark:border-slate-700 gap-4">
                                 <div className="flex items-center gap-5 cursor-pointer" onClick={() => setSelectedUser(engineer)}>
                                     <div className="relative"><img src={engineer.avatarUrl || getStableAvatar(engineer.name)} alt={engineer.name} className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-700 shadow-md object-cover" /><div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div></div>
                                     <div><h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-3">{engineer.name}<span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 uppercase tracking-wider">{t('roleEngineer')}</span></h3><p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{engineer.email}</p></div>
                                 </div>
                                 <div className="flex items-center gap-3 self-end md:self-auto"><div className="bg-white dark:bg-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-sm">{technicians.length} فنيين</div><button onClick={(e) => { e.stopPropagation(); deleteUser(engineer.id); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full" title="حذف المهندس"><Trash2 size={20} /></button></div>
                             </div>
                             <div className="p-8 bg-white dark:bg-slate-800"><h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-5 flex items-center gap-2 uppercase tracking-widest"><ArrowRight size={14} /> الفريق الفني التابع</h4>
                                 {technicians.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{technicians.map(tech => (<div key={tech.id} onClick={() => setSelectedUser(tech)} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md cursor-pointer transition-all duration-200 group/tech"><img src={tech.avatarUrl || getStableAvatar(tech.name)} className="w-12 h-12 rounded-full shadow-sm object-cover" alt={tech.name} /><div className="flex-1 overflow-hidden"><p className="font-bold text-sm text-slate-800 dark:text-white truncate group-hover/tech:text-blue-600 transition-colors">{tech.name}</p><p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{tech.jobTitle || t('roleTechnician')}</p></div><button onClick={(e) => { e.stopPropagation(); deleteUser(tech.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/tech:opacity-100 transition-opacity"><Trash2 size={16} /></button></div>))}</div>) : (<div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700"><p className="text-xs text-slate-400 italic">لا يوجد فنيين مسندين لهذا المهندس</p></div>)}
                             </div>
                        </div>
                    );
                })}
            </div>
        );
    } 
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(u => (
                <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm hover:shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-5 relative group cursor-pointer hover:-translate-y-1 transition-all duration-300">
                    <button onClick={(e) => { e.stopPropagation(); deleteUser(u.id); }} className="absolute top-4 left-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10 bg-slate-50 dark:bg-slate-700 p-2 rounded-full hover:bg-red-50"><Trash2 size={18} /></button>
                    <div className="flex items-center gap-5"><img src={u.avatarUrl || getStableAvatar(u.name)} alt={u.name} className="w-14 h-14 rounded-full border-4 border-slate-50 dark:border-slate-700 shadow-sm object-cover" /><div><h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">{u.name}</h3><p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{u.email}</p></div></div>
                    {/* Password Hidden/Protected */}
                    <div className="pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center"><span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">{u.role === UserRole.ENGINEER ? t('roleEngineer') : t('roleTechnician')}</span></div>
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3"><div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400"><Users size={24} /></div>{t('teamManagement')}</h2>
        <Button onClick={() => setShowAddModal(true)} className="shadow-lg shadow-blue-500/20"><UserPlus size={18} /><span>{t('addUser')}</span></Button>
      </div>

      {users.length === 0 ? (<div className="py-24 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center"><Users size={64} className="mb-4 opacity-20"/><p className="font-bold">لا يوجد أعضاء في فريقك حالياً</p></div>) : renderTeamView()}

      {/* --- MODAL: ADD USER --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
             <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
               <h3 className="text-xl font-black text-slate-800 dark:text-white">{t('addUser')}</h3>
               <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
             </div>
             <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                 <form onSubmit={handleAdd} className="space-y-5">
                     <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('userName')}</label><input required type="text" value={name} onChange={e => setName(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none text-slate-900 dark:text-white font-medium" /></div>
                     <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('userEmail')}</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none text-slate-900 dark:text-white font-medium" /></div>
                     <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('userPassword')}</label><div className="relative"><input required type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none text-slate-900 dark:text-white font-medium" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-3.5 left-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">الوظيفة / الصلاحية</label>
                         <div className="relative">
                             <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none text-slate-900 dark:text-white font-medium appearance-none">
                                 {currentUser.role === UserRole.ADMIN && <option value={UserRole.ENGINEER}>مهندس (مشرف مشروع)</option>}
                                 <option value={UserRole.TECHNICIAN}>مساعد / فني</option>
                             </select>
                             <ChevronDown size={16} className="absolute left-4 top-4 text-slate-400 pointer-events-none"/>
                         </div>
                     </div>
                     <Button type="submit" className="w-full mt-4 py-4 text-lg font-bold shadow-xl shadow-blue-500/20" isLoading={isSubmitting}>{t('save')}</Button>
                 </form>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL: USER DETAILS (Projects > Advances > Expenses) --- */}
      {selectedUser && userDetails && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
                {/* Header */}
                <div className="flex justify-between items-start p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                     <div className="flex gap-6">
                        <img src={selectedUser.avatarUrl || getStableAvatar(selectedUser.name)} alt={selectedUser.name} className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-700 shadow-lg object-cover" />
                        <div>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{selectedUser.name}</h3>
                            <p className="text-blue-600 dark:text-blue-400 font-bold mb-2">{selectedUser.jobTitle || (selectedUser.role === UserRole.ENGINEER ? 'مهندس' : 'مساعد')}</p>
                            {selectedUser.phone && <p className="text-sm text-slate-500 flex items-center gap-2 mb-1"><Phone size={14}/> {selectedUser.phone}</p>}
                            <p className="text-sm text-slate-500 flex items-center gap-2"><Briefcase size={14}/> {userDetails.hierarchy.length} مشاريع نشطة</p>
                        </div>
                     </div>
                     <button onClick={() => setSelectedUser(null)} className="p-3 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all hover:rotate-90"><X size={24} /></button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* If Engineer, show Team Section first */}
                    {userDetails.teamMembers.length > 0 && (
                        <div className="mb-8">
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Users size={20}/> الفريق الفني</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {userDetails.teamMembers.map(tm => (
                                    <div key={tm.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl flex items-center gap-3 border border-slate-100 dark:border-slate-700">
                                        <img src={tm.avatarUrl || getStableAvatar(tm.name)} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-bold text-sm dark:text-white">{tm.name}</p>
                                            <p className="text-xs text-slate-500">{tm.jobTitle || 'فني'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Wallet size={20}/> سجل العهد والمشاريع</h4>
                    
                    {userDetails.hierarchy.length === 0 ? (<div className="text-center py-12 text-slate-400 dark:text-slate-500 flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl"><FileText size={48} className="mb-4 opacity-20"/><p className="font-medium italic">لا توجد سجلات مالية لهذا الموظف</p></div>) : (
                        userDetails.hierarchy.map((item) => (
                            <div key={item.project?.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                                <div onClick={() => setExpandedProject(expandedProject === item.project?.id ? null : item.project?.id || '')} className="bg-slate-50 dark:bg-slate-800 p-5 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><Briefcase size={18} /></div>{item.project?.name || 'مشروع غير محدد'}</h4>
                                    <div className="flex items-center gap-4"><span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">{item.advances.length} عهدة</span>{expandedProject === item.project?.id ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}</div>
                                </div>
                                {expandedProject === item.project?.id && (<div className="bg-white dark:bg-slate-900 p-5 space-y-4 border-t border-slate-200 dark:border-slate-700">
                                    {item.advances.map(adv => (
                                        <div key={adv.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-white text-md">{adv.description}</p>
                                                    <p className="text-xs text-slate-400">{adv.date}</p>
                                                </div>
                                                <div className="text-end">
                                                    <p className="font-black text-slate-800 dark:text-white">{adv.amount.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 text-xs">
                                                <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded flex-1 text-center">مصروف: {adv.spent.toLocaleString()}</div>
                                                <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded flex-1 text-center">متبقي: {adv.remainingAmount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>)}
                            </div>
                        ))
                    )}
                </div>
             </div>
         </div>
      )}
    </div>
  );
};
