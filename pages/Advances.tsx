
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useLanguage } from '../contexts/LanguageProvider';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Plus, X, Filter, Wallet, Calendar, User, FileText, Image as ImageIcon, Briefcase, StickyNote, Edit, FileSpreadsheet, FileCheck, DollarSign, AlertOctagon, CornerDownRight, ArrowRightCircle, Upload, CheckCircle, Clock, Archive, ChevronLeft, ArrowRight, ArrowDownRight, UserPlus, Timer, ChevronDown, UserSquare, Eye, FileMinus } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { AdvanceStatus, UserRole, Advance, Expense, ExpenseStatus, User as UserType } from '../types';
import { uploadFile } from '../services/supabase';
import * as XLSX from 'xlsx';

type ViewMode = 'SUMMARY' | 'ACTIVE_LIST' | 'SETTLED_LIST';

export const Advances: React.FC = () => {
  const { t, language } = useLanguage();
  const { advances, addAdvance, createSubAdvance, editAdvance, getMyTeam, projects, expenses, users, tasks, clients, getStableAvatar, redirectTarget, clearRedirectTarget } = useData();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('SUMMARY');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); 
  
  // Sub-Advance Modal State
  const [showSubAdvanceModal, setShowSubAdvanceModal] = useState(false);
  
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  // NEW: State for viewing full expense details
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- User Selection for Admin Detail View ---
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserType | null>(null);

  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New: Receipt Image for Advance
  const [transferReceiptUrl, setTransferReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sub Advance Form
  const [subTechnicianId, setSubTechnicianId] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subDesc, setSubDesc] = useState('');

  const [filterProject, setFilterProject] = useState('ALL');
  
  // Initialize View based on Redirect
  useEffect(() => {
    if (redirectTarget && redirectTarget.page === 'advances' && redirectTarget.itemId) {
        if (redirectTarget.itemType === 'ADVANCE') {
            const targetAdv = advances.find(a => a.id === redirectTarget.itemId);
            if (targetAdv) {
                setSelectedAdvance(targetAdv);
                // Automatically switch to the correct list view behind the modal
                if (targetAdv.status === AdvanceStatus.CLOSED || targetAdv.status === AdvanceStatus.REJECTED) {
                    setViewMode('SETTLED_LIST');
                } else {
                    setViewMode('ACTIVE_LIST');
                }
                clearRedirectTarget(); 
            }
        }
    }
  }, [redirectTarget, advances]);

  // --- BACK BUTTON MAGIC (History API) ---
  useEffect(() => {
    if (selectedAdvance || selectedUserForDetails || viewExpense) {
      window.history.pushState({ modalOpen: true }, '', window.location.href);
      const handlePopState = () => {
        if (viewExpense) setViewExpense(null);
        else if (selectedAdvance) setSelectedAdvance(null);
        else if (selectedUserForDetails) setSelectedUserForDetails(null);
      };
      window.addEventListener('popstate', handlePopState);
      return () => { window.removeEventListener('popstate', handlePopState); };
    }
  }, [selectedAdvance, selectedUserForDetails, viewExpense]);

  // Function to manually close modal and go back in history to keep sync
  const handleCloseModal = () => {
      window.history.back(); // This triggers popstate, which closes the modal
  };

  useEffect(() => {
    const isAnyModalOpen = showAddModal || showEditModal || !!selectedAdvance || !!previewImage || showSubAdvanceModal || !!selectedUserForDetails || !!viewExpense;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showAddModal, showEditModal, selectedAdvance, previewImage, showSubAdvanceModal, selectedUserForDetails, viewExpense]);

  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN;
  const canCreate = isAdmin || user.role === UserRole.MAIN_CUSTODY; 

  // --- FILTER OUT ARCHIVED PROJECTS ---
  const activeAdvances = useMemo(() => {
      const activeProjectIds = projects.filter(p => p.status === 'ACTIVE').map(p => p.id);
      return advances.filter(a => !a.projectId || activeProjectIds.includes(a.projectId));
  }, [advances, projects]);

  // --- Split Data Logic ---
  const activeAdvancesList = useMemo(() => {
      return activeAdvances.filter(a => {
          const isOpen = a.status === AdvanceStatus.OPEN;
          const isMine = a.userId === user.id;
          return isAdmin ? isOpen : (isOpen && isMine);
      });
  }, [activeAdvances, isAdmin, user.id]);
  
  const settledAdvancesList = useMemo(() => {
      return activeAdvances.filter(a => {
          const isSettled = a.status === AdvanceStatus.CLOSED || a.status === AdvanceStatus.REJECTED;
          const isMine = a.userId === user.id;
          return isAdmin ? isSettled : (isSettled && isMine);
      });
  }, [activeAdvances, isAdmin, user.id]);

  const myPendingRequests = activeAdvances.filter(a => a.userId === user.id && a.status === AdvanceStatus.PENDING);

  const totalActiveAmount = activeAdvancesList.reduce((sum, a) => sum + a.amount, 0);
  const totalSettledAmount = settledAdvancesList.reduce((sum, a) => sum + a.amount, 0);

  const filteredAdvances = useMemo(() => {
      let list: Advance[] = [];
      if (viewMode === 'ACTIVE_LIST') list = activeAdvancesList;
      else if (viewMode === 'SETTLED_LIST') list = settledAdvancesList;
      else list = activeAdvances;

      if (filterProject !== 'ALL') list = list.filter(a => a.projectId === filterProject);
      return list;
  }, [activeAdvances, filterProject, viewMode, activeAdvancesList, settledAdvancesList]);

  // --- ADMIN VIEW: Group by User ---
  const usersWithAdvances = useMemo(() => {
      if (!isAdmin || viewMode === 'SUMMARY') return [];
      const targetList = viewMode === 'ACTIVE_LIST' ? activeAdvances.filter(a => a.status === AdvanceStatus.OPEN) : filteredAdvances;
      const userMap = new Map<string, { user: UserType, advances: Advance[], totalAmount: number, totalRemaining: number, totalSpent: number }>();

      targetList.forEach(adv => {
          const u = users.find(user => user.id === adv.userId);
          if (u) {
              const current = userMap.get(u.id) || { user: u, advances: [], totalAmount: 0, totalRemaining: 0, totalSpent: 0 };
              current.advances.push(adv);
              current.totalAmount += adv.amount;
              current.totalRemaining += adv.remainingAmount;
              const advExpenses = expenses.filter(e => e.advanceId === adv.id && e.status === ExpenseStatus.APPROVED);
              const spent = advExpenses.reduce((sum, e) => sum + e.amount, 0);
              current.totalSpent += spent;
              userMap.set(u.id, current);
          }
      });
      return Array.from(userMap.values());
  }, [filteredAdvances, isAdmin, viewMode, users, expenses, activeAdvances]);

  // --- ACTIONS ---
  const openAddModal = () => { setEditingAdvanceId(null); setSelectedProjectId(''); setSelectedUserId(''); setAmount(''); setDescription(''); setTransferReceiptUrl(null); setShowAddModal(true); };
  const openEditModal = (e: React.MouseEvent, advance: Advance) => { 
      e.stopPropagation(); 
      setEditingAdvanceId(advance.id); 
      setSelectedProjectId(advance.projectId || ''); 
      setSelectedUserId(advance.userId); 
      setAmount(advance.amount.toString()); 
      setDescription(advance.description); 
      setTransferReceiptUrl(advance.transferReceiptUrl || null); 
      setShowEditModal(true); 
  };
  
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsSubmitting(true);
          const url = await uploadFile(file);
          if (url) setTransferReceiptUrl(url);
          setIsSubmitting(false);
      }
  };

  const exportExpenseToExcel = (expense: Expense) => {
      if (!expense) return;
      const u = users.find(user => user.id === expense.userId);
      const adv = advances.find(a => a.id === expense.advanceId);
      
      const wb = XLSX.utils.book_new();
      const wsData = [
          ["تفاصيل المصروف", expense.description],
          ["التاريخ", expense.date],
          ["المبلغ", expense.amount],
          ["الحالة", expense.status],
          ["الموظف", u?.name || expense.userId],
          ["العهدة", adv?.description || "-"],
          ["ملاحظات", expense.notes || ""],
          ["نوع الفاتورة", expense.isInvoice ? "فاتورة تفصيلية" : "مبلغ ثابت"]
      ];

      if (expense.isInvoice && expense.invoiceItems) {
          wsData.push([]);
          wsData.push(["بنود الفاتورة"]);
          wsData.push(["الصنف", "الكمية", "سعر الوحدة", "الإجمالي"]);
          expense.invoiceItems.forEach(item => {
              wsData.push([item.itemName, item.quantity, item.unitPrice, item.total]);
          });
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Expense Details");
      XLSX.writeFile(wb, `Expense_${expense.id.substring(0,6)}.xlsx`);
  };

  const handleExportAdvanceReport = () => { /* ... */ };

  const handleSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); setIsSubmitting(true); 
      try { 
          if (editingAdvanceId) { 
              await editAdvance(editingAdvanceId, { amount: parseFloat(amount), description: description, transferReceiptUrl: transferReceiptUrl || undefined }); 
              setShowEditModal(false); 
          } else { 
              if ((selectedUserId || user.id) && amount && description) { 
                  const targetUser = isAdmin ? selectedUserId : user.id;
                  await addAdvance({ projectId: selectedProjectId || undefined, userId: targetUser, amount: parseFloat(amount), description: description, transferReceiptUrl: transferReceiptUrl || undefined }); 
                  setShowAddModal(false); 
              } 
          } 
          setEditingAdvanceId(null); setSelectedProjectId(''); setSelectedUserId(''); setAmount(''); setDescription(''); setTransferReceiptUrl(null);
      } catch (error) { console.error("Error", error); showNotification('حدث خطأ', 'error'); } finally { setIsSubmitting(false); } 
  };

  const handleSubmitSubAdvance = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAdvance || !subTechnicianId || !subAmount || !subDesc) return;
      setIsSubmitting(true);
      await createSubAdvance(selectedAdvance.id, subTechnicianId, parseFloat(subAmount), subDesc);
      setIsSubmitting(false);
      setShowSubAdvanceModal(false);
      setSubTechnicianId('');
      setSubAmount('');
      setSubDesc('');
  };

  const availableTechnicians = useMemo(() => {
      return users.filter(u => u.role === UserRole.SUB_CUSTODY && (u.managerId === user.id || isAdmin));
  }, [users, user.id, isAdmin]);

  const selectedAdvanceDetails = useMemo(() => {
      if (!selectedAdvance) return null;
      const advExpenses = expenses.filter(e => e.advanceId === selectedAdvance.id);
      const project = projects.find(p => p.id === selectedAdvance.projectId); 
      const advUser = users.find(u => u.id === selectedAdvance.userId);
      const totalSpent = advExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
      let deficit = 0;
      let returned = 0;
      if (selectedAdvance.settlementData) {
          deficit = (selectedAdvance.settlementData as any).deficitAmount || 0;
          returned = selectedAdvance.settlementData.returnedCashAmount || 0;
      }
      const subAdvances = advances.filter(a => a.parentAdvanceId === selectedAdvance.id);
      
      const enhancedExpenses = advExpenses.map(exp => {
          const task = tasks.find(t => t.id === exp.taskId);
          const expProject = task ? projects.find(p => p.id === task.projectId) : (exp.advanceId === selectedAdvance.id ? project : null);
          const client = expProject ? clients.find(c => c.id === expProject.clientId) : null;
          return { ...exp, taskName: task?.name || '-', projectName: expProject?.name || '-', projectCode: expProject?.code || '', clientName: client?.name || '-', clientCode: client?.code || '' };
      });

      return { expenses: enhancedExpenses, project, user: advUser, totalSpent, deficit, returned, subAdvances };
  }, [selectedAdvance, expenses, projects, users, advances, tasks, clients]);

  // --- RENDERERS ---
  const renderSummaryView = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          <div onClick={() => setViewMode('ACTIVE_LIST')} className="group cursor-pointer bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
              <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                  <div className="flex justify-between items-start"><div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/10"><Wallet size={32} className="text-white" /></div><div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"><Clock size={16} /><span className="text-sm font-bold">{t('statusOpen')}</span></div></div>
                  <div className="mt-8"><p className="text-blue-100 font-medium mb-1">{isAdmin ? t('totalActiveAdvances') : t('myActiveAdvances')}</p><h2 className="text-5xl font-black tracking-tight">{totalActiveAmount.toLocaleString()} <span className="text-2xl opacity-70">ج.م</span></h2></div>
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20"><div className="flex items-center gap-2"><span className="text-3xl font-black">{activeAdvancesList.length}</span><span className="text-sm text-blue-100">{t('openAdvanceCount')}</span></div><div className="bg-white text-blue-600 p-2 rounded-full group-hover:bg-blue-50 transition-colors"><ArrowRight size={20} className="rtl:rotate-180"/></div></div>
              </div>
          </div>
          <div onClick={() => setViewMode('SETTLED_LIST')} className="group cursor-pointer bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-lg hover:shadow-2xl hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-2 transition-all duration-300">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-700"></div>
              <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                  <div className="flex justify-between items-start"><div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400"><CheckCircle size={32} /></div><div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full text-slate-500 dark:text-slate-300"><Archive size={16} /><span className="text-sm font-bold">{t('settled')}</span></div></div>
                  <div className="mt-8"><p className="text-slate-500 dark:text-slate-400 font-medium mb-1">{isAdmin ? t('totalSettledAdvances') : t('mySettledAdvances')}</p><h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">{totalSettledAmount.toLocaleString()} <span className="text-2xl text-slate-400 dark:text-slate-500">ج.م</span></h2></div>
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100 dark:border-slate-700"><div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="text-3xl font-black">{settledAdvancesList.length}</span><span className="text-sm">{t('settledAdvanceCount')}</span></div><div className="bg-slate-100 dark:bg-slate-700 text-slate-400 p-2 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors"><ArrowRight size={20} className="rtl:rotate-180"/></div></div>
              </div>
          </div>
      </div>
  );

  const renderAdvanceCard = (advance: Advance) => {
      const advUser = users.find(u => u.id === advance.userId) || { name: advance.userId, avatarUrl: undefined };
      const project = projects.find(p => p.id === advance.projectId);
      const spentRatio = advance.amount > 0 ? ((advance.amount - advance.remainingAmount) / advance.amount) * 100 : 0;
      const barColor = spentRatio > 90 ? 'bg-red-500' : (spentRatio > 75 ? 'bg-amber-500' : 'bg-blue-500');
      const parentAdvance = advance.parentAdvanceId ? advances.find(a => a.id === advance.parentAdvanceId) : null;

      return (
          <div key={advance.id} onClick={() => setSelectedAdvance(advance)} className="glass-card group bg-white/90 dark:bg-slate-800/90 p-6 rounded-[1.75rem] shadow-sm hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between h-full cursor-pointer overflow-hidden border border-white/50 dark:border-white/5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-700/30 rounded-bl-full opacity-50 pointer-events-none"></div>
            
            {/* --- FIX: EDIT BUTTON POSITION & Z-INDEX --- */}
            {isAdmin && viewMode === 'ACTIVE_LIST' && (
                <button 
                    onClick={(e) => openEditModal(e, advance)} 
                    className="absolute top-4 left-4 p-2 bg-slate-50 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors z-30 shadow-sm" 
                    title={t('edit')}
                >
                    <Edit size={16} />
                </button>
            )}

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-5">
                  {project ? <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 uppercase tracking-wide">{project.name}</div> : <div className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-full">{t('generalAdvance')}</div>}
                  <StatusBadge status={advance.status} />
              </div>
              {parentAdvance && (<div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-md w-fit border border-slate-100 dark:border-slate-800"><CornerDownRight size={12} className="text-slate-400" /> {t('fromAdvance')}: {parentAdvance.description}</div>)}
              <h3 className="font-black text-xl text-slate-800 dark:text-white mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{advance.description}</h3>
              <p className="text-xs font-medium text-slate-400 mb-6 flex items-center gap-1"><Calendar size={12}/> {advance.date}</p>
              {!isAdmin && <div className="flex items-center gap-3 mb-6 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700"><img src={advUser.avatarUrl || getStableAvatar(advUser.name)} alt={advUser.name} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-500 shadow-sm object-cover" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{advUser.name}</span></div>}
            </div>
            <div className="relative z-10 mt-auto">
              <div className="flex justify-between items-end mb-2"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('advanceValue')}</p><p className="font-black text-lg text-slate-800 dark:text-white">{advance.amount.toLocaleString()}</p></div><div className="text-end"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('remaining')}</p><p className={`font-black text-lg ${advance.remainingAmount < 500 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{advance.remainingAmount.toLocaleString()}</p></div></div>
              {viewMode === 'ACTIVE_LIST' && (
                  <>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden mb-1 shadow-inner"><div className={`h-full rounded-full transition-all duration-700 ${barColor} shadow-sm`} style={{ width: `${Math.min(spentRatio, 100)}%` }}/></div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1"><span>{t('spentPercentage')}</span><span>{spentRatio.toFixed(0)}%</span></div>
                  </>
              )}
            </div>
          </div>
      );
  };

  const renderListView = () => (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
              <button onClick={() => setViewMode('SUMMARY')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronLeft size={24} className="rtl:rotate-180 text-slate-600 dark:text-slate-300" /></button>
              <div><h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">{viewMode === 'ACTIVE_LIST' ? t('activeAdvances') : t('settledAdvances')}</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{viewMode === 'ACTIVE_LIST' ? t('advancesActiveListDesc') : t('advancesSettledListDesc')}</p></div>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"><Filter size={18} className="text-slate-400" /><select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-transparent text-sm font-bold outline-none text-slate-700 dark:text-slate-200 cursor-pointer"><option value="ALL">{t('allProjects')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
             {viewMode === 'ACTIVE_LIST' && canCreate && (<Button onClick={openAddModal} variant="primary" className="shadow-lg shadow-blue-500/20"><Plus size={18} /><span>{isAdmin ? t('issueNewAdvance') : t('newAdvanceRequest')}</span></Button>)}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {isAdmin && viewMode === 'ACTIVE_LIST' ? (
              usersWithAdvances.map((group) => (
                  <div 
                    key={group.user.id} 
                    onClick={() => setSelectedUserForDetails(group.user)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden"
                  >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                      <div className="flex items-center gap-4 mb-6">
                          <img src={group.user.avatarUrl || getStableAvatar(group.user.name)} className="w-16 h-16 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-sm" alt={group.user.name} />
                          <div>
                              <h3 className="font-black text-lg text-slate-800 dark:text-white leading-tight">{group.user.name}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">{group.user.jobTitle || t('roleMainCustody')}</p>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold text-slate-500">{t('totalValue')}</span>
                              <span className="font-black text-slate-800 dark:text-white">{group.totalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t('remaining')}</span>
                              <span className="font-black text-emerald-700 dark:text-emerald-400">{group.totalRemaining.toLocaleString()}</span>
                          </div>
                      </div>
                      <div className="mt-6 flex justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-4">
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{group.advances.length} عهد</span>
                          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors"><ArrowRight size={16} className="rtl:rotate-180"/></div>
                      </div>
                  </div>
              ))
          ) : (
              filteredAdvances.map(advance => renderAdvanceCard(advance))
          )}
          
          {((isAdmin && viewMode === 'ACTIVE_LIST' && usersWithAdvances.length === 0) || (!isAdmin && filteredAdvances.length === 0)) && (
              <div className="col-span-full py-24 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center">
                  <Wallet size={64} className="mb-4 opacity-30" />
                  <p className="font-bold">{t('noAdvancesInList')}</p>
              </div>
          )}
        </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {!isAdmin && myPendingRequests.length > 0 && viewMode === 'SUMMARY' && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-2xl p-4">
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2"><Timer size={16}/> {t('myPendingRequests')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {myPendingRequests.map(adv => (
                      <div key={adv.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex justify-between items-center opacity-75">
                          <div><p className="text-sm font-bold text-slate-800 dark:text-white">{adv.description}</p><p className="text-xs text-slate-500">{adv.date}</p></div><span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">{t('waiting')}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {viewMode === 'SUMMARY' && renderSummaryView()}
      {viewMode !== 'SUMMARY' && renderListView()}

      {/* --- USER DETAILS MODAL (ACTIVE ADVANCES LIST) --- */}
      {selectedUserForDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in" onClick={handleCloseModal}>
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10 overflow-hidden modal-overlay" onClick={e => e.stopPropagation()}>
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                              <img src={selectedUserForDetails.avatarUrl || getStableAvatar(selectedUserForDetails.name)} className="w-20 h-20 rounded-[1.5rem] border-4 border-white dark:border-slate-700 shadow-lg" />
                              <div>
                                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">{selectedUserForDetails.name}</h2>
                                  <p className="text-slate-500 font-bold">{selectedUserForDetails.jobTitle}</p>
                              </div>
                          </div>
                          <button onClick={handleCloseModal} className="absolute top-6 right-6 md:relative md:top-auto md:right-auto p-3 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-8">
                          {(() => {
                              const userAdvances = activeAdvances.filter(a => a.status === AdvanceStatus.OPEN && a.userId === selectedUserForDetails.id);
                              const totalAmt = userAdvances.reduce((sum, a) => sum + a.amount, 0);
                              const totalRem = userAdvances.reduce((sum, a) => sum + a.remainingAmount, 0);
                              const totalSpnt = userAdvances.reduce((sum, adv) => {
                                  const advExpenses = expenses.filter(e => e.advanceId === adv.id && e.status === ExpenseStatus.APPROVED);
                                  return sum + advExpenses.reduce((s, e) => s + e.amount, 0);
                              }, 0);
                              return (
                                  <>
                                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 text-center"><p className="text-xs font-bold text-blue-600 mb-1">{t('totalValue')}</p><p className="text-2xl font-black text-slate-800 dark:text-white">{totalAmt.toLocaleString()}</p></div>
                                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 text-center"><p className="text-xs font-bold text-amber-600 mb-1">{t('projectTotalSpent')}</p><p className="text-2xl font-black text-slate-800 dark:text-white">{totalSpnt.toLocaleString()}</p></div>
                                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center"><p className="text-xs font-bold text-emerald-600 mb-1">{t('remaining')}</p><p className="text-2xl font-black text-slate-800 dark:text-white">{totalRem.toLocaleString()}</p></div>
                                  </>
                              );
                          })()}
                      </div>
                  </div>
                  <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 flex-1">
                      <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4 flex items-center gap-2"><Wallet size={20} className="text-indigo-500"/> العهد السارية ({activeAdvances.filter(a => a.status === AdvanceStatus.OPEN && a.userId === selectedUserForDetails.id).length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activeAdvances.filter(a => a.status === AdvanceStatus.OPEN && a.userId === selectedUserForDetails.id).map(adv => renderAdvanceCard(adv))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- SUB ADVANCE MODAL --- */}
      {showSubAdvanceModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in flex flex-col max-h-[90vh] border border-white/10 modal-overlay">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-indigo-50 dark:bg-indigo-900/30">
                <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2"><ArrowDownRight size={24} /> {t('assignModalTitle')}</h3>
                <button onClick={() => setShowSubAdvanceModal(false)} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-sm text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
                    {t('availableBalance')}: <strong>{selectedAdvance?.remainingAmount.toLocaleString()}</strong>
                </div>
                <form onSubmit={handleSubmitSubAdvance} className="space-y-5">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectAssistant')}</label><div className="relative"><select required value={subTechnicianId} onChange={(e) => setSubTechnicianId(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('selectFromList')}</option>{availableTechnicians.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><UserPlus size={16}/></div></div></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('allocatedAmount')}</label><input required type="number" min="1" max={selectedAdvance?.remainingAmount} value={subAmount} onChange={(e) => setSubAmount(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white text-2xl font-black outline-none font-mono" placeholder="0" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('subAdvanceDesc')}</label><input required type="text" value={subDesc} onChange={(e) => setSubDesc(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none" placeholder={t('advanceDescriptionPlaceholder')} /></div>
                  <div className="pt-4"><Button type="submit" isLoading={isSubmitting} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20">{t('assign')}</Button></div>
                </form>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT MODAL (Moved to end and given high z-index) --- */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in flex flex-col max-h-[90vh] border border-white/10 modal-overlay">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"><h3 className="text-xl font-black text-slate-800 dark:text-white">{showEditModal ? t('edit') : (isAdmin ? t('issueNewAdvance') : t('newAdvanceRequest'))}</h3><button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button></div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1"><form onSubmit={handleSubmit} className="space-y-5"><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectProject')} ({t('optional')})</label><div className="relative"><select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={showEditModal || isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('generalAdvanceNoProject')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Briefcase size={16}/></div></div></div>{isAdmin && (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectUser')}</label><div className="relative"><select required value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={showEditModal || isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('selectUser')}</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><User size={16}/></div></div></div>)}<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('description')}</label><input required type="text" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none" placeholder={t('advanceDescriptionPlaceholder')} /></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('advanceValue')}</label><input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white text-2xl font-black outline-none font-mono" placeholder="0" /></div>{isAdmin && (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('transferReceipt')}</label><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleReceiptUpload} /><div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${transferReceiptUrl ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{transferReceiptUrl ? (<div className="text-blue-600 dark:text-blue-400 text-xs font-bold flex flex-col items-center justify-center gap-2"><div className="w-full h-32 rounded-lg overflow-hidden border border-blue-200"><img src={transferReceiptUrl} className="w-full h-full object-cover" /></div><span className="flex items-center gap-1"><ImageIcon size={14}/> {t('receiptUploaded')}</span></div>) : (<div className="text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 py-4"><Upload size={16}/> {t('uploadReceipt')}</div>)}</div></div>)}<div className="pt-4"><Button type="submit" isLoading={isSubmitting} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20">{t('save')}</Button></div></form></div>
          </div>
        </div>
      )}

      {/* Main Details Modal */}
      {selectedAdvance && selectedAdvanceDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fade-in" onClick={handleCloseModal}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-6xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10 overflow-hidden modal-overlay" onClick={(e) => e.stopPropagation()}>
                {/* ... (Existing details content) ... */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-md sticky top-0 z-50 gap-4">
                    <div className="flex-1">
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/30 shrink-0"><Wallet size={24} /></div>
                            <span className="line-clamp-1">{selectedAdvance.description}</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5"><Briefcase size={16} className="text-blue-500" /> {selectedAdvanceDetails.project?.name || t('generalAdvance')}</span>
                            <span className="hidden md:inline w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="flex items-center gap-1.5"><User size={16} className="text-blue-500" /> {selectedAdvanceDetails.user?.name}</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0 justify-end">
                        {user.role === UserRole.MAIN_CUSTODY && selectedAdvance.status === AdvanceStatus.OPEN && selectedAdvance.remainingAmount > 0 && (
                            <Button onClick={() => setShowSubAdvanceModal(true)} variant="primary" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md py-2 px-3">
                                <ArrowDownRight size={16} className="md:mr-1"/> <span className="hidden md:inline">{t('assignToAssistant')}</span>
                            </Button>
                        )}
                        <Button onClick={handleExportAdvanceReport} variant="secondary" className="text-xs bg-green-600 hover:bg-green-700 text-white border-none shadow-md py-2 px-3">
                            <FileSpreadsheet size={16} className="md:mr-1"/> <span className="hidden md:inline">{t('detailedReport')}</span>
                        </Button>
                        <button onClick={handleCloseModal} className="p-2.5 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all hover:rotate-90 shrink-0"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {/* ... (Existing card details and tables) ... */}
                    {selectedAdvance.transferReceiptUrl && (
                        <div className="mb-8 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2"><ImageIcon size={16}/> {t('transferReceipt')}</h4>
                            <div className="relative h-48 w-full md:w-1/2 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer hover:opacity-90" onClick={() => setPreviewImage(selectedAdvance.transferReceiptUrl!)}>
                                <img src={selectedAdvance.transferReceiptUrl} className="w-full h-full object-cover" alt="Transfer Receipt" />
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                         <div className="glass-card bg-blue-50/80 dark:bg-blue-900/20 p-6 rounded-[1.5rem] border border-blue-100 dark:border-blue-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mb-2">{t('totalValue')}</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvance.amount.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                         <div className="glass-card bg-amber-50/80 dark:bg-amber-900/20 p-6 rounded-[1.5rem] border border-amber-100 dark:border-amber-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-2">{t('projectTotalSpent')}</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvanceDetails.totalSpent.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                         <div className="glass-card bg-emerald-50/80 dark:bg-emerald-900/20 p-6 rounded-[1.5rem] border border-emerald-100 dark:border-emerald-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mb-2">{t('remaining')}</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvance.remainingAmount.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                    </div>
                    {/* ... (Sub advances and expenses table are same) ... */}
                    {selectedAdvanceDetails.subAdvances.length > 0 && (
                        <div className="mb-10">
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><ArrowDownRight size={20}/> {t('subAdvances')}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedAdvanceDetails.subAdvances.map(sub => (
                                    <div key={sub.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{sub.description}</p>
                                            <p className="text-xs text-slate-500">{users.find(u => u.id === sub.userId)?.name}</p>
                                        </div>
                                        <div className="text-end">
                                            <p className="font-bold text-indigo-600 dark:text-indigo-400">{sub.remainingAmount.toLocaleString()} / {sub.amount.toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-400">{t('remaining')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 font-bold text-sm">{t('expensesLog')}</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-start">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase">
                                    <tr><th className="p-4 text-start">{t('description')}</th><th className="p-4 text-start">{t('filterClient')}</th><th className="p-4 text-start">{t('filterProject')}</th><th className="p-4 text-start">{t('filterTask')}</th><th className="p-4 text-start">{t('date')}</th><th className="p-4 text-start">{t('amount')}</th><th className="p-4 text-start">{t('status')}</th><th className="p-4 text-start">{t('actions')}</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {selectedAdvanceDetails.expenses.length > 0 ? (
                                        selectedAdvanceDetails.expenses.map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setViewExpense(exp)}>
                                                <td className="p-4 font-bold text-slate-800 dark:text-white">{exp.description}</td><td className="p-4 text-slate-600 dark:text-slate-400">{exp.clientName !== '-' ? `${exp.clientName} (${exp.clientCode})` : '-'}</td><td className="p-4 text-slate-600 dark:text-slate-400">{exp.projectName !== '-' ? `${exp.projectName} (${exp.projectCode})` : '-'}</td><td className="p-4 text-slate-600 dark:text-slate-400">{exp.taskName}</td><td className="p-4 text-slate-500">{exp.date}</td><td className="p-4 font-black">{exp.amount.toLocaleString()}</td><td className="p-4"><StatusBadge status={exp.status} /></td>
                                                <td className="p-4"><button onClick={(e) => { e.stopPropagation(); setViewExpense(exp); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-slate-800 transition-colors"><Eye size={16}/></button></td>
                                            </tr>
                                        ))
                                    ) : (<tr><td colSpan={8} className="p-8 text-center text-slate-400">{t('noExpensesInAdvance')}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- VIEW EXPENSE DETAIL MODAL (NEW) --- */}
      {viewExpense && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in" onClick={handleCloseModal}>
               <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-2xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/20 modal-overlay" onClick={(e) => e.stopPropagation()}>
                   <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-[2rem]">
                       <div><h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('expenseDetailsFor')}</h3><p className="text-slate-400 text-sm mt-1">#{viewExpense.id.substring(0,8)}</p></div>
                       <div className="flex gap-2">
                           <button onClick={() => exportExpenseToExcel(viewExpense)} className="p-3 bg-green-50 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors shadow-sm active:scale-90" title="تصدير Excel"><FileSpreadsheet size={20}/></button>
                           <button onClick={handleCloseModal} className="p-3 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all active:scale-90"><X size={20} /></button>
                       </div>
                   </div>
                  <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 max-h-[80vh]">
                      <div className="text-center">
                          <h2 className="text-5xl font-black text-blue-600 dark:text-blue-400 tracking-tighter drop-shadow-sm">{viewExpense.amount.toLocaleString()} <span className="text-2xl text-slate-400 font-medium">{t('currency')}</span ></h2>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{viewExpense.description}</h3>
                          <div className="mt-3 flex justify-center scale-110"><StatusBadge status={viewExpense.status}/></div>
                      </div>
                      
                      {/* Full Details Grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('date')}</p>
                              <p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calendar size={14}/> {viewExpense.date}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('user')}</p>
                              <p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><User size={14}/> {users.find(u => u.id === viewExpense.userId)?.name}</p>
                          </div>
                          {viewExpense.isInvoice && (
                              <div className="col-span-2 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                  <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><FileCheck size={14}/> {t('invoiceItems')}</p>
                                  <div className="space-y-2">
                                      {viewExpense.invoiceItems?.map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-sm border-b border-indigo-200 dark:border-indigo-800/50 pb-2 last:border-0 last:pb-0">
                                              <span className="font-medium text-slate-700 dark:text-white">{item.itemName} <span className="text-slate-400 text-xs">x{item.quantity}</span></span>
                                              <span className="font-bold">{item.total.toLocaleString()}</span>
                                          </div>
                                      ))}
                                      {viewExpense.additionalAmount && viewExpense.additionalAmount > 0 && (
                                          <div className="flex justify-between items-center text-sm pt-2 border-t border-indigo-200 dark:border-indigo-800">
                                              <span className="font-bold text-indigo-600">{t('additionalValue')}</span>
                                              <span className="font-black">{viewExpense.additionalAmount.toLocaleString()}</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                          <div className="col-span-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('notes')}</p>
                              <p className="font-medium text-slate-700 dark:text-white whitespace-pre-wrap">{viewExpense.notes || 'لا توجد ملاحظات'}</p>
                          </div>
                      </div>

                      {viewExpense.imageUrl && (
                          <div>
                              <p className="text-sm font-bold mb-3 dark:text-white flex items-center gap-2"><ImageIcon size={16}/> المرفقات</p>
                              <div onClick={() => { setPreviewImage(viewExpense.imageUrl!); }} className="relative h-64 w-full rounded-2xl overflow-hidden cursor-pointer group border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                  <img src={viewExpense.imageUrl} alt="Receipt" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Eye className="text-white drop-shadow-md" size={32} />
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
               </div>
          </div>
      )}

      {previewImage && (<div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/95 p-0 m-0 backdrop-blur-xl" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', touchAction: 'none' }} onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}><div className="relative w-full h-full flex items-center justify-center"><img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" style={{ maxHeight: '90vh', maxWidth: '95vw' }} /><button onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} className="absolute top-4 right-4 z-50 bg-white/20 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur-md shadow-lg transition-colors"><X size={32} /></button></div></div>)}
    </div>
  );
};
