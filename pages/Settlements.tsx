
import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageProvider';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { AdvanceStatus, ExpenseStatus, UserRole, User as UserType } from '../types';
import { CheckCircle, X, Calculator, AlertOctagon, Wallet, ArrowRight, Banknote, Scale, User, Calendar, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

export const Settlements: React.FC = () => {
  const { t } = useLanguage();
  const { advances, expenses, users, closeAdvance, getStableAvatar } = useData();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [selectedUserForSettlement, setSelectedUserForSettlement] = useState<UserType | null>(null);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  
  const [returnedCash, setReturnedCash] = useState<string>(''); // Keep as string for input handling
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter only OPEN advances
  const openAdvances = useMemo(() => {
      return advances.filter(a => a.status === AdvanceStatus.OPEN);
  }, [advances]);

  // Group Open Advances By User
  const usersWithOpenAdvances = useMemo(() => {
      const userMap = new Map<string, { user: UserType, advances: any[], totalRemaining: number }>();
      
      openAdvances.forEach(adv => {
          const u = users.find(usr => usr.id === adv.userId);
          if (u) {
              const current = userMap.get(u.id) || { user: u, advances: [], totalRemaining: 0 };
              current.advances.push(adv);
              current.totalRemaining += adv.remainingAmount;
              userMap.set(u.id, current);
          }
      });
      return Array.from(userMap.values());
  }, [openAdvances, users]);

  // Derived calculations for the Selected Advance
  const settlementDetails = useMemo(() => {
      if (!selectedAdvanceId) return null;
      
      const advance = advances.find(a => a.id === selectedAdvanceId);
      if (!advance) return null;

      const advExpenses = expenses.filter(e => e.advanceId === advance.id);
      const totalApproved = advExpenses
          .filter(e => e.status === ExpenseStatus.APPROVED)
          .reduce((sum, e) => sum + e.amount, 0);
      
      const totalPending = advExpenses
          .filter(e => e.status === ExpenseStatus.PENDING)
          .reduce((sum, e) => sum + e.amount, 0);

      // Theoretical Balance (What should be in hand) = Original Amount - Approved Expenses
      const theoreticalBalance = advance.amount - totalApproved;
      
      // Deficit = Theoretical Balance - Returned Cash
      const cashVal = parseFloat(returnedCash) || 0;
      const deficit = theoreticalBalance - cashVal;

      return {
          advance,
          totalApproved,
          totalPending,
          theoreticalBalance,
          deficit,
          advUser: users.find(u => u.id === advance.userId)
      };
  }, [selectedAdvanceId, advances, expenses, users, returnedCash]);

  const handleOpenSettlement = (id: string) => {
      setSelectedAdvanceId(id);
      setReturnedCash('');
      setSettlementNotes('');
  };

  const handleCloseModal = () => {
      setSelectedAdvanceId(null);
      setReturnedCash('');
      setSettlementNotes('');
  };

  const handleConfirmSettlement = async () => {
      if (!settlementDetails || !selectedAdvanceId) return;

      if (settlementDetails.totalPending > 0) {
          showNotification('لا يمكن تصفية العهدة بوجود مصروفات معلقة. يرجى الموافقة عليها أو رفضها أولاً.', 'error');
          return;
      }

      setIsSubmitting(true);
      try {
          await closeAdvance(selectedAdvanceId, {
              totalApprovedExpenses: settlementDetails.totalApproved,
              returnedCashAmount: parseFloat(returnedCash) || 0,
              deficitAmount: settlementDetails.deficit,
              notes: settlementNotes,
              settlementDate: new Date().toISOString().split('T')[0]
          });
          showNotification(t('msgAdvanceClosed'), 'success');
          handleCloseModal();
          // If this was the last advance for the user, close the user view too
          if (selectedUserForSettlement) {
              const remaining = openAdvances.filter(a => a.userId === selectedUserForSettlement.id && a.id !== selectedAdvanceId);
              if (remaining.length === 0) setSelectedUserForSettlement(null);
          }
      } catch (error) {
          console.error(error);
          showNotification('حدث خطأ أثناء التسوية', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  // Prevent non-admins from accessing if needed (optional logic)
  if (user?.role !== UserRole.ADMIN) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
              <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                  <Scale size={48} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">صفحة خاصة بالمحاسبين</h2>
              <p className="text-slate-500 mt-2">ليس لديك صلاحية لتصفية العهد.</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><Scale size={24} /></div>
                {t('settlementTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('noOpenAdvancesForSettlement').replace('لا توجد', `يوجد ${openAdvances.length}`)}
            </p>
        </div>
      </div>

      {/* Main Grid: Users Cards */}
      {!selectedUserForSettlement && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {usersWithOpenAdvances.map(group => (
                  <div 
                    key={group.user.id} 
                    onClick={() => setSelectedUserForSettlement(group.user)}
                    className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:shadow-lg transition-all duration-300 group cursor-pointer relative overflow-hidden"
                  >
                      {/* Left Border Decoration */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-l-2xl"></div>

                      <div>
                          <div className="flex items-center gap-4 mb-4">
                              <img src={group.user.avatarUrl || getStableAvatar(group.user.name)} className="w-14 h-14 rounded-2xl border-2 border-white dark:border-slate-700 shadow-sm object-cover" alt="User" />
                              <div>
                                  <h4 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1">{group.user.name}</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{group.user.jobTitle}</p>
                              </div>
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">إجمالي المتبقي</span>
                              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{group.totalRemaining.toLocaleString()}</span>
                          </div>
                      </div>

                      <div className="mt-6 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">
                                  {group.advances.length} عهد مفتوحة
                              </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              <ArrowRight size={16} className="rtl:rotate-180" />
                          </div>
                      </div>
                  </div>
              ))}
              {usersWithOpenAdvances.length === 0 && (
                  <div className="col-span-full py-24 text-center text-slate-400 flex flex-col items-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem]">
                      <CheckCircle size={64} className="mb-4 opacity-20 text-emerald-500" />
                      <p className="font-bold text-lg">لا توجد عهد مفتوحة للتصفية</p>
                      <p className="text-sm opacity-60">جميع العهد تمت تسويتها بنجاح</p>
                  </div>
              )}
          </div>
      )}

      {/* Detail View: Selected User's Advances */}
      {selectedUserForSettlement && (
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 p-8 animate-fade-in relative">
              <button 
                onClick={() => setSelectedUserForSettlement(null)} 
                className="absolute top-8 left-8 p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors z-10"
              >
                  <ArrowRight size={20} className="rtl:rotate-180 text-slate-600 dark:text-slate-300"/>
              </button>

              <div className="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-slate-100 dark:border-slate-700 items-center">
                  <img src={selectedUserForSettlement.avatarUrl || getStableAvatar(selectedUserForSettlement.name)} className="w-24 h-24 rounded-3xl border-4 border-white dark:border-slate-600 shadow-lg" />
                  <div className="text-center md:text-start">
                      <h2 className="text-3xl font-black text-slate-800 dark:text-white">{selectedUserForSettlement.name}</h2>
                      <p className="text-slate-500 font-bold">{selectedUserForSettlement.jobTitle}</p>
                  </div>
                  <div className="flex-1"></div>
                  {/* Summary Counters for this user */}
                  <div className="flex gap-4">
                      <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 text-center">
                          <p className="text-xs font-bold text-blue-600 uppercase mb-1">إجمالي العهد</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {openAdvances.filter(a => a.userId === selectedUserForSettlement.id).reduce((s, a) => s + a.amount, 0).toLocaleString()}
                          </p>
                      </div>
                      <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
                          <p className="text-xs font-bold text-emerald-600 uppercase mb-1">المتبقي للتوريد</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {openAdvances.filter(a => a.userId === selectedUserForSettlement.id).reduce((s, a) => s + a.remainingAmount, 0).toLocaleString()}
                          </p>
                      </div>
                  </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <Wallet size={20} className="text-indigo-500"/> العهد المتاحة للتصفية
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openAdvances.filter(a => a.userId === selectedUserForSettlement.id).map(adv => {
                      const relatedExp = expenses.filter(e => e.advanceId === adv.id);
                      const approvedSum = relatedExp.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
                      const pendingCount = relatedExp.filter(e => e.status === ExpenseStatus.PENDING).length;

                      return (
                          <div key={adv.id} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:border-indigo-400 transition-colors">
                              <div>
                                  <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-bold text-lg text-slate-800 dark:text-white">{adv.description}</h4>
                                      <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-500">{adv.date}</span>
                                  </div>
                                  <div className="space-y-2 mt-4">
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">{t('originalAmount')}</span>
                                          <span className="font-bold font-mono">{adv.amount.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">{t('totalSpent')} (المعتمد)</span>
                                          <span className="font-bold font-mono text-emerald-600">{approvedSum.toLocaleString()}</span>
                                      </div>
                                      <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                                      <div className="flex justify-between text-sm">
                                          <span className="font-bold text-slate-700 dark:text-slate-300">{t('theoreticalBalance')}</span>
                                          <span className="font-black font-mono text-blue-600">{(adv.amount - approvedSum).toLocaleString()}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="mt-6">
                                  {pendingCount > 0 ? (
                                      <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold p-3 rounded-xl text-center flex items-center justify-center gap-2">
                                          <AlertOctagon size={16} />
                                          يوجد {pendingCount} مصروفات معلقة
                                      </div>
                                  ) : (
                                      <Button onClick={() => handleOpenSettlement(adv.id)} className="w-full py-3 rounded-xl shadow-lg shadow-indigo-500/20">
                                          <Scale size={18} /> {t('closeAdvance')}
                                      </Button>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* --- SETTLEMENT MODAL --- */}
      {selectedAdvanceId && settlementDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in" onClick={handleCloseModal}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border border-white/10 modal-overlay" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Calculator className="text-blue-600" />
                            {t('settlementTitle')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                            <User size={12}/> {settlementDetails.advUser?.name}
                        </p>
                    </div>
                    <button onClick={handleCloseModal} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t('advanceValue')}</p>
                             <p className="text-xl font-black text-slate-800 dark:text-white">{settlementDetails.advance.amount.toLocaleString()}</p>
                         </div>
                         <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 text-center">
                             <p className="text-[10px] text-blue-600 dark:text-blue-300 font-bold uppercase mb-1">{t('totalSpent')}</p>
                             <p className="text-xl font-black text-blue-700 dark:text-blue-400">{settlementDetails.totalApproved.toLocaleString()}</p>
                         </div>
                    </div>

                    {/* Calculation Area */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 border-dashed">
                            <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2"><Wallet size={16}/> {t('theoreticalBalance')}</span>
                            <span className="font-mono font-black text-lg text-slate-800 dark:text-white">{settlementDetails.theoreticalBalance.toLocaleString()} {t('currency')}</span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('enterReturnedCash')}</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={returnedCash} 
                                    onChange={e => setReturnedCash(e.target.value)}
                                    className="w-full p-4 pl-12 bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/30 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none font-bold text-xl text-slate-800 dark:text-white transition-all shadow-sm"
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                    <Banknote size={24} />
                                </div>
                            </div>
                        </div>

                        {/* Deficit Result */}
                        <div className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-colors duration-300 ${settlementDetails.deficit > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : (settlementDetails.deficit < 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30')}`}>
                            <div className="flex items-center gap-3">
                                {settlementDetails.deficit > 0 ? <AlertOctagon className="text-red-500" size={24} /> : <CheckCircle className="text-green-500" size={24} />}
                                <div>
                                    <p className={`text-xs font-bold uppercase ${settlementDetails.deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>{t('calculatedDeficit')}</p>
                                    <p className="text-[10px] text-slate-500">{settlementDetails.deficit > 0 ? t('deficitNote') : (settlementDetails.deficit < 0 ? 'يوجد فائض في العهدة (مراجعة)' : t('settledFully'))}</p>
                                </div>
                            </div>
                            <span className={`font-mono font-black text-2xl ${settlementDetails.deficit > 0 ? 'text-red-600' : (settlementDetails.deficit < 0 ? 'text-amber-600' : 'text-green-600')}`}>
                                {Math.abs(settlementDetails.deficit).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('settlementNotes')}</label>
                        <textarea 
                            value={settlementNotes}
                            onChange={e => setSettlementNotes(e.target.value)}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none min-h-[100px] resize-none border border-transparent focus:border-blue-500 transition-all" 
                            placeholder={t('settlementNotesPlaceholder')}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-20">
                    <Button 
                        onClick={handleConfirmSettlement} 
                        className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20 rounded-2xl"
                        isLoading={isSubmitting}
                        variant={settlementDetails.deficit > 0 ? 'danger' : 'success'}
                    >
                        {t('confirmClose')}
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
