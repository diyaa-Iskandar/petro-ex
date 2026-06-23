
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useLanguage } from '../contexts/LanguageContext';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Plus, X, Filter, Wallet, Calendar, User, FileText, Image as ImageIcon, Briefcase, StickyNote, Edit, FileSpreadsheet, FileCheck, DollarSign, AlertOctagon, CornerDownRight, ArrowRightCircle, Upload, CheckCircle, Clock, Archive, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { AdvanceStatus, UserRole, Advance, Expense, ExpenseStatus } from '../types';
import { uploadFile } from '../services/supabase';
import * as XLSX from 'xlsx';

type ViewMode = 'SUMMARY' | 'ACTIVE_LIST' | 'SETTLED_LIST';

export const Advances: React.FC = () => {
  const { t } = useLanguage();
  const { advances, addAdvance, editAdvance, getMyTeam, projects, expenses, users, tasks, clients, getStableAvatar, redirectTarget, clearRedirectTarget } = useData();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('SUMMARY');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); 
  
  // Sub-Advance Modal State
  const [showSubAdvanceModal, setShowSubAdvanceModal] = useState(false);
  
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New: Receipt Image for Advance
  const [transferReceiptUrl, setTransferReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const isAnyModalOpen = showAddModal || showEditModal || !!selectedAdvance || !!selectedExpense || !!previewImage || showSubAdvanceModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showAddModal, showEditModal, selectedAdvance, selectedExpense, previewImage, showSubAdvanceModal]);

  if (!user) return null;

  const myTeam = getMyTeam();
  const isAdmin = user.role === UserRole.ADMIN;
  const canCreate = isAdmin || user.role === UserRole.ENGINEER; 

  // --- Split Data Logic ---
  const activeAdvancesList = advances.filter(a => a.status === AdvanceStatus.OPEN || a.status === AdvanceStatus.PENDING);
  const settledAdvancesList = advances.filter(a => a.status === AdvanceStatus.CLOSED || a.status === AdvanceStatus.REJECTED);

  const totalActiveAmount = activeAdvancesList.reduce((sum, a) => sum + a.amount, 0);
  const totalSettledAmount = settledAdvancesList.reduce((sum, a) => sum + a.amount, 0);

  const filteredAdvances = useMemo(() => {
      let list: Advance[] = [];
      
      if (viewMode === 'ACTIVE_LIST') list = activeAdvancesList;
      else if (viewMode === 'SETTLED_LIST') list = settledAdvancesList;
      else list = advances; // Should not happen in summary view

      if (filterProject !== 'ALL') list = list.filter(a => a.projectId === filterProject);
      
      return list;
  }, [advances, filterProject, viewMode]);

  const selectedAdvanceDetails = useMemo(() => {
      if (!selectedAdvance) return null;
      const advExpenses = expenses.filter(e => e.advanceId === selectedAdvance.id);
      const project = projects.find(p => p.id === selectedAdvance.projectId);
      const advUser = users.find(u => u.id === selectedAdvance.userId);
      const totalSpent = advExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);

      let deficit = 0;
      let returned = 0;
      let settlementNotes = '';
      if (selectedAdvance.settlementData) {
          deficit = (selectedAdvance.settlementData as any).deficitAmount || (selectedAdvance.settlementData as any).deficit || 0;
          returned = selectedAdvance.settlementData.returnedCashAmount || 0;
          settlementNotes = selectedAdvance.settlementData.notes || '';
      }

      const subAdvances = advances.filter(a => a.parentAdvanceId === selectedAdvance.id);

      // Enhance expenses with context (Client > Project > Task)
      const enhancedExpenses = advExpenses.map(exp => {
          const task = tasks.find(t => t.id === exp.taskId);
          const expProject = task ? projects.find(p => p.id === task.projectId) : (exp.advanceId === selectedAdvance.id ? project : null);
          const client = expProject ? clients.find(c => c.id === expProject.clientId) : null;
          
          return {
              ...exp,
              taskName: task?.name || '-',
              projectName: expProject?.name || '-',
              projectCode: expProject?.code || '',
              clientName: client?.name || '-',
              clientCode: client?.code || ''
          };
      });

      return {
          expenses: enhancedExpenses,
          project,
          user: advUser,
          totalSpent,
          deficit,
          returned,
          settlementNotes,
          subAdvances
      };
  }, [selectedAdvance, expenses, projects, users, advances, tasks, clients]);

  // --- Detailed Excel Report Generation ---
  const handleExportAdvanceDetailedReport = () => {
      if(!selectedAdvance || !selectedAdvanceDetails) return;

      const wb = XLSX.utils.book_new();
      
      const wsData: any[][] = [
          [`تقرير تفصيلي للعهدة: ${selectedAdvance.description}`],
          [`الموظف: ${selectedAdvanceDetails.user?.name}`],
          [`تاريخ العهدة: ${selectedAdvance.date}`],
          [`القيمة الإجمالية: ${selectedAdvance.amount}`],
          [],
          ["م", "العميل", "المشروع", "المهمة", "تاريخ الصرف", "وصف المصروف", "القيمة", "الحالة"]
      ];

      // Sort by Project Name -> Task Name
      const sortedExpenses = [...selectedAdvanceDetails.expenses].sort((a, b) => {
          if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
          return a.taskName.localeCompare(b.taskName);
      });

      sortedExpenses.forEach((exp, index) => {
          wsData.push([
              index + 1,
              exp.clientName !== '-' ? `${exp.clientName} (${exp.clientCode})` : '-',
              exp.projectName !== '-' ? `${exp.projectName} (${exp.projectCode})` : '-',
              exp.taskName,
              exp.date,
              exp.description,
              exp.amount,
              t(exp.status === ExpenseStatus.APPROVED ? 'statusApproved' : (exp.status === ExpenseStatus.PENDING ? 'statusPending' : 'statusRejected'))
          ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 5}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 15}, {wch: 30}, {wch: 12}, {wch: 15}];
      XLSX.utils.book_append_sheet(wb, ws, "Advance Details");
      XLSX.writeFile(wb, `Advance_Detail_Report_${selectedAdvance.id.substring(0,6)}.xlsx`);
  };

  const openAddModal = () => { setEditingAdvanceId(null); setSelectedProjectId(''); setSelectedUserId(''); setAmount(''); setDescription(''); setTransferReceiptUrl(null); setShowAddModal(true); };
  const openEditModal = (e: React.MouseEvent, advance: Advance) => { e.stopPropagation(); setEditingAdvanceId(advance.id); setSelectedProjectId(advance.projectId || ''); setSelectedUserId(advance.userId); setAmount(advance.amount.toString()); setDescription(advance.description); setTransferReceiptUrl(advance.transferReceiptUrl || null); setShowEditModal(true); };
  
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsSubmitting(true);
          const url = await uploadFile(file);
          if (url) setTransferReceiptUrl(url);
          setIsSubmitting(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      setIsSubmitting(true); 
      try { 
          if (editingAdvanceId) { 
              await editAdvance(editingAdvanceId, { amount: parseFloat(amount), description: description, transferReceiptUrl: transferReceiptUrl || undefined }); 
              setShowEditModal(false); 
          } else { 
              if ((selectedUserId || user.id) && amount && description) { 
                  const targetUser = isAdmin ? selectedUserId : user.id;
                  await addAdvance({ 
                      projectId: selectedProjectId || undefined, 
                      userId: targetUser, 
                      amount: parseFloat(amount), 
                      description: description,
                      transferReceiptUrl: transferReceiptUrl || undefined
                  }); 
                  setShowAddModal(false); 
              } 
          } 
          setEditingAdvanceId(null); setSelectedProjectId(''); setSelectedUserId(''); setAmount(''); setDescription(''); setTransferReceiptUrl(null);
      } catch (error) { 
          console.error("Error", error); 
          showNotification('حدث خطأ', 'error'); 
      } finally { 
          setIsSubmitting(false); 
      } 
  };

  // --- VIEW: SUMMARY CARDS ---
  const renderSummaryView = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          {/* Active Advances Card */}
          <div 
            onClick={() => setViewMode('ACTIVE_LIST')}
            className="group cursor-pointer bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
          >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-xl"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                  <div className="flex justify-between items-start">
                      <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/10">
                          <Wallet size={32} className="text-white" />
                      </div>
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                          <Clock size={16} />
                          <span className="text-sm font-bold">نشط / ساري</span>
                      </div>
                  </div>
                  
                  <div className="mt-8">
                      <p className="text-blue-100 font-medium mb-1">إجمالي العهد النشطة</p>
                      <h2 className="text-5xl font-black tracking-tight">{totalActiveAmount.toLocaleString()} <span className="text-2xl opacity-70">ج.م</span></h2>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20">
                      <div className="flex items-center gap-2">
                          <span className="text-3xl font-black">{activeAdvancesList.length}</span>
                          <span className="text-sm text-blue-100">عهدة مفتوحة حالياً</span>
                      </div>
                      <div className="bg-white text-blue-600 p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                          <ArrowRight size={20} className="rtl:rotate-180"/>
                      </div>
                  </div>
              </div>
          </div>

          {/* Settled Advances Card */}
          <div 
            onClick={() => setViewMode('SETTLED_LIST')}
            className="group cursor-pointer bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-lg hover:shadow-2xl hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-2 transition-all duration-300"
          >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-700"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                  <div className="flex justify-between items-start">
                      <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                          <CheckCircle size={32} />
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full text-slate-500 dark:text-slate-300">
                          <Archive size={16} />
                          <span className="text-sm font-bold">تمت التسوية</span>
                      </div>
                  </div>
                  
                  <div className="mt-8">
                      <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">إجمالي العهد المسواة</p>
                      <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">{totalSettledAmount.toLocaleString()} <span className="text-2xl text-slate-400 dark:text-slate-500">ج.م</span></h2>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="text-3xl font-black">{settledAdvancesList.length}</span>
                          <span className="text-sm">عهدة مغلقة</span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700 text-slate-400 p-2 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <ArrowRight size={20} className="rtl:rotate-180"/>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  // --- VIEW: LIST (Active or Settled) ---
  const renderListView = () => (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setViewMode('SUMMARY')} 
                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                  <ChevronLeft size={24} className="rtl:rotate-180 text-slate-600 dark:text-slate-300" />
              </button>
              <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                      {viewMode === 'ACTIVE_LIST' ? 'العهد النشطة (السارية)' : 'أرشيف العهد (تمت التسوية)'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {viewMode === 'ACTIVE_LIST' ? 'قائمة بجميع العهد المفتوحة والمعلقة حالياً' : 'قائمة بجميع العهد التي تم إغلاقها أو رفضها'}
                  </p>
              </div>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
             {/* Filters */}
             <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Filter size={18} className="text-slate-400" />
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="bg-transparent text-sm font-bold outline-none text-slate-700 dark:text-slate-200 cursor-pointer"><option value="ALL">{t('allProjects')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
             </div>
             
             {viewMode === 'ACTIVE_LIST' && canCreate && (<Button onClick={openAddModal} variant="primary" className="shadow-lg shadow-blue-500/20"><Plus size={18} /><span>{isAdmin ? 'صرف عهدة' : 'طلب عهدة'}</span></Button>)}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filteredAdvances.map((advance) => {
            const advUser = users.find(u => u.id === advance.userId) || { name: advance.userId, avatarUrl: undefined };
            const project = projects.find(p => p.id === advance.projectId);
            const spentRatio = advance.amount > 0 ? ((advance.amount - advance.remainingAmount) / advance.amount) * 100 : 0;
            const barColor = spentRatio > 90 ? 'bg-red-500' : (spentRatio > 75 ? 'bg-amber-500' : 'bg-blue-500');
            const parentAdvance = advance.parentAdvanceId ? advances.find(a => a.id === advance.parentAdvanceId) : null;

            return (
                <div key={advance.id} onClick={() => setSelectedAdvance(advance)} className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl dark:hover:shadow-blue-900/10 transition-all duration-300 relative flex flex-col justify-between h-full cursor-pointer overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-700/30 rounded-bl-full opacity-50 pointer-events-none"></div>
                  {isAdmin && viewMode === 'ACTIVE_LIST' && (<button onClick={(e) => openEditModal(e, advance)} className="absolute top-4 left-4 p-2 bg-slate-50 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors z-20 shadow-sm" title={t('edit')}><Edit size={16} /></button>)}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-5">
                        {project ? <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 uppercase tracking-wide">{project.name}</div> : <div className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-full">عهدة عامة</div>}
                        <StatusBadge status={advance.status} />
                    </div>
                    {parentAdvance && (<div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-md w-fit border border-slate-100 dark:border-slate-800"><CornerDownRight size={12} className="text-slate-400" /> من عهدة: {parentAdvance.description}</div>)}
                    <h3 className="font-black text-xl text-slate-800 dark:text-white mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{advance.description}</h3>
                    <p className="text-xs font-medium text-slate-400 mb-6 flex items-center gap-1"><Calendar size={12}/> {advance.date}</p>
                    <div className="flex items-center gap-3 mb-6 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700"><img src={advUser.avatarUrl || getStableAvatar(advUser.name)} alt={advUser.name} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-500 shadow-sm object-cover" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{advUser.name}</span></div>
                  </div>
                  <div className="relative z-10 mt-auto">
                    <div className="flex justify-between items-end mb-2"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('totalValue')}</p><p className="font-black text-lg text-slate-800 dark:text-white">{advance.amount.toLocaleString()} <span className="text-xs font-medium text-slate-400">{t('currency')}</span></p></div><div className="text-end"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('remaining')}</p><p className={`font-black text-lg ${advance.remainingAmount < 500 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{advance.remainingAmount.toLocaleString()} <span className="text-xs font-medium opacity-70">{t('currency')}</span></p></div></div>
                    {viewMode === 'ACTIVE_LIST' && (
                        <>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden mb-1 shadow-inner"><div className={`h-full rounded-full transition-all duration-700 ${barColor} shadow-sm`} style={{ width: `${Math.min(spentRatio, 100)}%` }}/></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1"><span>{t('spentPercentage')}</span><span>{spentRatio.toFixed(0)}%</span></div>
                        </>
                    )}
                  </div>
                </div>
            );
          })}
          {filteredAdvances.length === 0 && (<div className="col-span-full py-24 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center"><Wallet size={64} className="mb-4 opacity-30" /><p className="font-bold">لا توجد عهد في هذه القائمة</p></div>)}
        </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {viewMode === 'SUMMARY' && renderSummaryView()}
      {viewMode !== 'SUMMARY' && renderListView()}

      {/* --- ADD MODAL (Standard) --- */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{showEditModal ? 'تعديل العهدة' : (isAdmin ? 'صرف عهدة' : 'طلب عهدة')}</h3>
                <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* For Advances, Project can be optional now if it's a general advance */}
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectProject')} (اختياري)</label><div className="relative"><select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={showEditModal || isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">عهدة عامة (بدون مشروع محدد)</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Briefcase size={16}/></div></div></div>
                  
                  {isAdmin && (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectUser')}</label><div className="relative"><select required value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={showEditModal || isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('selectUser')}</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><User size={16}/></div></div></div>)}
                  
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('description')}</label><input required type="text" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none" placeholder="مثال: عهدة نقل ومواصلات" /></div>
                  
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('advanceValue')}</label><input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isSubmitting} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white text-2xl font-black outline-none font-mono" placeholder="0" /></div>
                  
                  {/* Transfer Receipt Image Upload */}
                  {isAdmin && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">صورة قسيمة التحويل</label>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleReceiptUpload} />
                          <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${transferReceiptUrl ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                              {transferReceiptUrl ? (
                                  <div className="text-blue-600 dark:text-blue-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                      <div className="w-full h-32 rounded-lg overflow-hidden border border-blue-200"><img src={transferReceiptUrl} className="w-full h-full object-cover" /></div>
                                      <span className="flex items-center gap-1"><ImageIcon size={14}/> تم الرفع (اضغط للتغيير)</span>
                                  </div>
                              ) : (
                                  <div className="text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 py-4"><Upload size={16}/> ارفاق صورة القسيمة</div>
                              )}
                          </div>
                      </div>
                  )}

                  <div className="pt-4"><Button type="submit" isLoading={isSubmitting} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20">{t('save')}</Button></div>
                </form>
            </div>
          </div>
        </div>
      )}

      {/* Main Details Modal (Z-50) */}
      {selectedAdvance && selectedAdvanceDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
                <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div><h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3"><div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/30"><Wallet size={24} /></div>{selectedAdvance.description}</h3><div className="flex flex-wrap items-center gap-4 mt-2 text-sm font-medium text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1.5"><Briefcase size={16} className="text-blue-500" /> {selectedAdvanceDetails.project?.name || 'عهدة عامة'}</span><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span className="flex items-center gap-1.5"><User size={16} className="text-blue-500" /> {selectedAdvanceDetails.user?.name}</span></div></div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportAdvanceDetailedReport} variant="secondary" className="text-xs bg-green-600 hover:bg-green-700 text-white border-none shadow-md">
                            <FileSpreadsheet size={16} className="mr-1"/> تقرير تفصيلي
                        </Button>
                        <button onClick={() => setSelectedAdvance(null)} className="p-2.5 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all hover:rotate-90"><X size={20} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    
                    {/* Display Transfer Receipt if exists */}
                    {selectedAdvance.transferReceiptUrl && (
                        <div className="mb-8 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2"><ImageIcon size={16}/> صورة قسيمة التحويل البنكي</h4>
                            <div className="relative h-48 w-full md:w-1/2 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer hover:opacity-90" onClick={() => setPreviewImage(selectedAdvance.transferReceiptUrl!)}>
                                <img src={selectedAdvance.transferReceiptUrl} className="w-full h-full object-cover" alt="Transfer Receipt" />
                            </div>
                        </div>
                    )}

                    {/* Advance Details Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mb-2">قيمة العهدة</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvance.amount.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                         <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-2">المصروف الفعلي</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvanceDetails.totalSpent.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                         <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div><p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mb-2">الرصيد المتبقي</p><p className="text-3xl font-black text-slate-800 dark:text-white">{selectedAdvance.remainingAmount.toLocaleString()} <small className="text-sm font-bold text-slate-400">{t('currency')}</small></p></div>
                    </div>

                    {/* Detailed Expenses Table */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 font-bold text-sm">سجل المصروفات التفصيلي</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-start">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="p-4 text-start">الوصف / البند</th>
                                        <th className="p-4 text-start">العميل</th>
                                        <th className="p-4 text-start">المشروع</th>
                                        <th className="p-4 text-start">المهمة</th>
                                        <th className="p-4 text-start">التاريخ</th>
                                        <th className="p-4 text-start">القيمة</th>
                                        <th className="p-4 text-start">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {selectedAdvanceDetails.expenses.length > 0 ? (
                                        selectedAdvanceDetails.expenses.map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="p-4 font-bold text-slate-800 dark:text-white">{exp.description}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{exp.clientName !== '-' ? `${exp.clientName} (${exp.clientCode})` : '-'}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{exp.projectName !== '-' ? `${exp.projectName} (${exp.projectCode})` : '-'}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-400">{exp.taskName}</td>
                                                <td className="p-4 text-slate-500">{exp.date}</td>
                                                <td className="p-4 font-black">{exp.amount.toLocaleString()}</td>
                                                <td className="p-4"><StatusBadge status={exp.status} /></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد مصروفات مسجلة لهذه العهدة</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
