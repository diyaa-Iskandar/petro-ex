
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserRole, ExpenseStatus, AdvanceStatus, Expense, InvoiceItem, Advance, Project } from '../types';
import { Plus, Check, X, AlertCircle, Search, Wallet, FileText, StickyNote, Upload, Image as ImageIcon, Sun, Moon, TrendingUp, Calendar, ChevronRight, User as UserIcon, Coins, PieChart as PieChartIcon, Briefcase, ArrowUpRight, PlusCircle, Trash2, FileCheck, FileMinus, Edit, Lock, Unlock, FileSpreadsheet, DollarSign, Eye, MoreHorizontal, CheckCircle, XCircle, ListTodo, Folder, RefreshCcw, Filter, XSquare } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis } from 'recharts';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNotification } from '../contexts/NotificationContext';
import { uploadFile } from '../services/supabase'; 
import * as XLSX from 'xlsx';

export const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { advances, expenses, addExpense, editExpense, addAdvance, updateExpenseStatus, toggleExpenseEditability, updateAdvanceStatus, projects, tasks, users, clients, redirectTarget, clearRedirectTarget, getMyTeam, getStableAvatar } = useData(); 
  const { showNotification } = useNotification();

  // --- Date Filter State ---
  const [dashStartDate, setDashStartDate] = useState('');
  const [dashEndDate, setDashEndDate] = useState('');

  // --- Details Modal State ---
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsType, setDetailsType] = useState<'BALANCE' | 'SPENT' | 'PENDING' | 'PROJECTS' | null>(null);

  // --- Existing Modal States ---
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showCreateAdvanceModal, setShowCreateAdvanceModal] = useState(false);
  // We will reuse the generic modal for lists instead of specific pending modals where possible, or keep them for actions.
  // Keeping pending modal for "Action" logic specifically.
  const [showPendingExpensesModal, setShowPendingExpensesModal] = useState(false);
  const [showPendingAdvancesModal, setShowPendingAdvancesModal] = useState(false);
  
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- Logic States ---
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionType, setRejectionType] = useState<'EXPENSE' | 'ADVANCE' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [isEditingExpense, setIsEditingExpense] = useState(false); 
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // --- Form States (Expense) ---
  const [selectedClientId, setSelectedClientId] = useState<string>(''); 
  const [selectedExpenseProjectId, setSelectedExpenseProjectId] = useState<string>(''); 
  const [selectedTaskId, setSelectedTaskId] = useState<string>(''); 
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>(''); 
  
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseNote, setNewExpenseNote] = useState('');
  const [expenseImagePreview, setExpenseImagePreview] = useState<string | null>(null); 
  const [fileToUpload, setFileToUpload] = useState<File | null>(null); 
  const [isUploading, setIsUploading] = useState(false);
  const [expenseType, setExpenseType] = useState<'FIXED' | 'INVOICE'>('FIXED');
  const [fixedAmount, setFixedAmount] = useState('');
  const [additionalAmount, setAdditionalAmount] = useState(''); 
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
      { id: '1', itemName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived Data for Dropdowns ---
  const availableClients = useMemo(() => clients, [clients]);

  const availableProjects = useMemo(() => {
      if (!selectedClientId) return [];
      return projects.filter(p => p.clientId === selectedClientId && p.status === 'ACTIVE');
  }, [projects, selectedClientId]);

  const availableTasks = useMemo(() => {
      if (!selectedExpenseProjectId) return [];
      return tasks.filter(t => t.projectId === selectedExpenseProjectId);
  }, [tasks, selectedExpenseProjectId]);

  const availableAdvances = useMemo(() => {
      if (!user) return [];
      let list = advances.filter(a => a.userId === user.id && a.status === AdvanceStatus.OPEN);
      if (selectedExpenseProjectId) {
          list = list.filter(a => !a.projectId || a.projectId === selectedExpenseProjectId);
      }
      return list;
  }, [advances, user, selectedExpenseProjectId]);

  // --- Form States (Advance) ---
  const [newAdvanceProjectId, setNewAdvanceProjectId] = useState('');
  const [newAdvanceUserId, setNewAdvanceUserId] = useState('');
  const [newAdvanceParentId, setNewAdvanceParentId] = useState(''); 
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [newAdvanceDesc, setNewAdvanceDesc] = useState('');
  const [isAdvanceSubmitting, setIsAdvanceSubmitting] = useState(false);

  // --- Filters ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'ALL'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');

  // --- Effects ---
  useEffect(() => {
    if (redirectTarget && redirectTarget.page === 'dashboard' && redirectTarget.itemId) {
        if (redirectTarget.itemType === 'EXPENSE') {
            const targetExp = expenses.find(e => e.id === redirectTarget.itemId);
            if (targetExp) {
                if (targetExp.status === ExpenseStatus.PENDING || targetExp.status === ExpenseStatus.REJECTED) {
                    setShowPendingExpensesModal(true);
                } else {
                    setSelectedExpense(targetExp);
                }
                clearRedirectTarget();
            }
        }
    }
  }, [redirectTarget, expenses]);

  useEffect(() => {
    const isAnyModalOpen = showAddExpenseModal || showCreateAdvanceModal || showPendingExpensesModal || showPendingAdvancesModal || !!selectedExpense || !!previewImage || showDetailsModal;
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showAddExpenseModal, showCreateAdvanceModal, showPendingExpensesModal, showPendingAdvancesModal, selectedExpense, previewImage, showDetailsModal]);

  if (!user) return null;

  const canTakeAction = (requesterId: string) => {
      if (user.id === requesterId) return false;
      const requester = users.find(u => u.id === requesterId);
      if (!requester) return false;
      if (user.role === UserRole.ADMIN) {
          if (requester.role === UserRole.ENGINEER) return true;
          if (requester.role === UserRole.ADMIN) return true; 
          return false; 
      }
      if (user.role === UserRole.ENGINEER) {
          return requester.role === UserRole.TECHNICIAN; 
      }
      return false;
  };

  // --- FILTERED DATA FOR STATISTICS ---
  // Helper to check date range
  const isInRange = (dateStr: string) => {
      if (!dashStartDate && !dashEndDate) return true;
      const d = new Date(dateStr).getTime();
      const start = dashStartDate ? new Date(dashStartDate).getTime() : -Infinity;
      const end = dashEndDate ? new Date(dashEndDate).getTime() : Infinity;
      return d >= start && d <= end;
  };

  const hasDateFilter = !!dashStartDate || !!dashEndDate;

  // 1. Approved Expenses in Range
  const filteredApprovedExpenses = expenses.filter(e => e.status === ExpenseStatus.APPROVED && isInRange(e.date));
  const totalApprovedExpensesAmount = filteredApprovedExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 2. Advances Logic
  // IF Date Filter: Show Sum of Advances *Created/Issued* in that period.
  // IF No Filter: Show Current Remaining Balance (Snapshot).
  const filteredAdvancesForStats = advances.filter(a => isInRange(a.date));
  const totalAdvancesValueInRange = filteredAdvancesForStats.reduce((sum, a) => sum + a.amount, 0);
  
  const openAdvancesList = advances.filter(a => a.status === AdvanceStatus.OPEN);
  const totalRemainingBalanceCurrent = openAdvancesList.reduce((sum, a) => sum + a.remainingAmount, 0);

  const displayBalanceValue = hasDateFilter ? totalAdvancesValueInRange : totalRemainingBalanceCurrent;
  const displayBalanceLabel = hasDateFilter ? 'إجمالي العهد المستلمة' : 'رصيد متاح حالي';
  const displayBalanceSub = hasDateFilter ? 'خلال الفترة المحددة' : 'إجمالي السيولة النقدية';

  // 3. Pending Requests in Range
  const pendingExpensesList = expenses.filter(e => {
      // Filter by date first
      if (!isInRange(e.date)) return false;
      // Logic for visibility
      if (e.userId === user.id && e.status === ExpenseStatus.REJECTED) return true;
      if (e.status === ExpenseStatus.PENDING && canTakeAction(e.userId)) return true;
      return false;
  });

  const pendingAdvancesList = advances.filter(a => {
      if (!isInRange(a.date)) return false;
      if (a.userId === user.id && a.status === AdvanceStatus.REJECTED) return true;
      if (a.status === AdvanceStatus.PENDING && canTakeAction(a.userId)) return true;
      return false;
  });

  const totalPendingRequests = pendingExpensesList.length + pendingAdvancesList.length;

  // 4. Projects in Range (Active projects that had activity OR created in range)
  // For simplicity: Active Projects created in range, OR just Active Projects if no filter
  const activeProjectsList = projects.filter(p => p.status === 'ACTIVE'); // Base list
  // If date filter, maybe filter by createdAt? Or just show all active. 
  // Let's filter by creation date if filter exists to be consistent with "In this period"
  const displayProjectsList = hasDateFilter 
      ? projects.filter(p => isInRange(p.createdAt || new Date().toISOString())) 
      : activeProjectsList;

  // --- Handlers ---
  const handleCardClick = (type: 'BALANCE' | 'SPENT' | 'PENDING' | 'PROJECTS') => {
      setDetailsType(type);
      setShowDetailsModal(true);
  };

  const calculateTotalExpense = () => {
      const additional = parseFloat(additionalAmount) || 0;
      if (expenseType === 'FIXED') {
          return (parseFloat(fixedAmount) || 0) + additional;
      } else {
          const itemsTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          return itemsTotal + additional;
      }
  };
  const totalCalculated = calculateTotalExpense();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'صباح الخير', icon: Sun };
    return { text: 'مساء الخير', icon: Moon };
  };
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const trendData = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const expenseMap: Record<string, number> = {};
    expenses.forEach(e => {
        if (e.status === ExpenseStatus.APPROVED) {
            const dateKey = e.date; 
            expenseMap[dateKey] = (expenseMap[dateKey] || 0) + e.amount;
        }
    });
    const data = [];
    let currentDate = new Date(sixMonthsAgo);
    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = currentDate.toLocaleDateString(t('language') === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
        data.push({ date: dateStr, name: dayName, amount: expenseMap[dateStr] || 0 });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return data;
  }, [expenses, t]);

  const financialDistributionData = useMemo(() => {
      const data: { name: string; value: number; color1: string; color2: string }[] = [];
      const GRADIENTS = [
          { c1: '#60a5fa', c2: '#2563eb' }, { c1: '#f472b6', c2: '#db2777' }, { c1: '#a78bfa', c2: '#7c3aed' }, 
          { c1: '#fb923c', c2: '#ea580c' }, { c1: '#34d399', c2: '#059669' }, { c1: '#facc15', c2: '#ca8a04' }, 
      ];
      const spendingByProject: Record<string, number> = {};
      let totalSpentAll = 0;
      
      // Use filtered expenses if date is selected, else all approved
      const expensesSource = hasDateFilter ? filteredApprovedExpenses : expenses.filter(e => e.status === ExpenseStatus.APPROVED);

      expensesSource.forEach(exp => {
          const adv = advances.find(a => a.id === exp.advanceId);
          let projId = adv?.projectId;
          if (exp.taskId) {
              const task = tasks.find(t => t.id === exp.taskId);
              if(task) projId = task.projectId;
          }

          if (projId) {
              const proj = projects.find(p => p.id === projId);
              const projName = proj ? proj.name : 'مشروع غير محدد';
              spendingByProject[projName] = (spendingByProject[projName] || 0) + exp.amount;
              totalSpentAll += exp.amount;
          }
      });
      Object.entries(spendingByProject).forEach(([name, value], index) => {
          if (value > 0) {
              const colorIndex = index % GRADIENTS.length;
              data.push({ name: name, value: value, color1: GRADIENTS[colorIndex].c1, color2: GRADIENTS[colorIndex].c2 });
          }
      });
      data.sort((a, b) => b.value - a.value);
      return { data, totalBudget: totalSpentAll };
  }, [expenses, advances, projects, tasks, hasDateFilter, filteredApprovedExpenses]);

  const { data: pieChartData, totalBudget: totalSpentChart } = financialDistributionData;

  const myExpenses = useMemo(() => {
    let list = expenses;
    if (statusFilter !== 'ALL') list = list.filter(e => e.status === statusFilter);
    if (searchTerm) list = list.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Also apply date filter to the table list if active
    if (hasDateFilter) {
        list = list.filter(e => isInRange(e.date));
    }
    
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10); 
  }, [expenses, statusFilter, searchTerm, hasDateFilter, dashStartDate, dashEndDate]);

  const canEditExpense = (expense: Expense) => {
      if (expense.userId === user.id && (expense.status === ExpenseStatus.PENDING || expense.status === ExpenseStatus.REJECTED)) return true;
      if (expense.userId === user.id && expense.status === ExpenseStatus.APPROVED && expense.isEditable) return true;
      return false;
  };

  // --- ACTIONS ---
  const handleUpdateExpenseStatus = (id: string, status: ExpenseStatus, reason?: string) => { updateExpenseStatus(id, status, reason); if (status === ExpenseStatus.APPROVED) showNotification(t('msgExpenseApproved'), 'success', true); else showNotification(`${t('msgExpenseRejected')}: ${reason}`, 'error'); setRejectingId(null); setRejectionType(null); setRejectionReason(''); if (selectedExpense && selectedExpense.id === id) setSelectedExpense(null); };
  const handleUpdateAdvanceStatus = (id: string, status: AdvanceStatus, reason?: string) => { updateAdvanceStatus(id, status, reason); if (status === AdvanceStatus.OPEN) showNotification(t('msgAdvanceApproved'), 'success', true); else showNotification(`${t('msgAdvanceRejected')}: ${reason}`, 'error'); setRejectingId(null); setRejectionType(null); setRejectionReason(''); };
  const handleToggleEditability = (id: string, currentStatus: boolean) => toggleExpenseEditability(id, !currentStatus);
  const handleAddInvoiceItem = () => setInvoiceItems(prev => [...prev, { id: Date.now().toString(), itemName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const handleRemoveInvoiceItem = (id: string) => { if (invoiceItems.length > 1) setInvoiceItems(prev => prev.filter(item => item.id !== id)); };
  const handleInvoiceItemChange = (id: string, field: keyof InvoiceItem, value: any) => { setInvoiceItems(prev => prev.map(item => { if (item.id === id) { const updatedItem = { ...item, [field]: value }; if (field === 'quantity' || field === 'unitPrice') updatedItem.total = updatedItem.quantity * updatedItem.unitPrice; return updatedItem; } return item; })); };

  const handleSubmitAdvance = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAdvanceSubmitting(true);
      const userIdToAssign = user.role === UserRole.ADMIN ? newAdvanceUserId : user.id; 
      const finalProjectId = newAdvanceProjectId;
      
      if ((userIdToAssign) && newAdvanceAmount && newAdvanceDesc) {
          await addAdvance({ projectId: finalProjectId || undefined, userId: userIdToAssign, amount: parseFloat(newAdvanceAmount), description: newAdvanceDesc });
          setShowCreateAdvanceModal(false); setNewAdvanceProjectId(''); setNewAdvanceUserId(''); setNewAdvanceParentId(''); setNewAdvanceAmount(''); setNewAdvanceDesc('');
      }
      setIsAdvanceSubmitting(false);
  };

  const openEditExpense = (expense: Expense) => { 
      setIsEditingExpense(true); 
      setEditingExpenseId(expense.id); 
      const task = tasks.find(t => t.id === expense.taskId);
      const project = projects.find(p => p.id === task?.projectId);
      setSelectedClientId(project?.clientId || '');
      setSelectedExpenseProjectId(project?.id || '');
      setSelectedTaskId(expense.taskId || '');
      setSelectedAdvanceId(expense.advanceId);
      setNewExpenseDesc(expense.description); 
      setNewExpenseNote(expense.notes || ''); 
      setExpenseImagePreview(expense.imageUrl || null); 
      setFileToUpload(null); 
      if (expense.isInvoice) { setExpenseType('INVOICE'); setInvoiceItems(expense.invoiceItems || []); setFixedAmount(''); } else { setExpenseType('FIXED'); setFixedAmount((expense.amount - (expense.additionalAmount || 0)).toString()); setInvoiceItems([{ id: '1', itemName: '', quantity: 1, unitPrice: 0, total: 0 }]); } 
      setAdditionalAmount(expense.additionalAmount?.toString() || ''); 
      setShowAddExpenseModal(true); 
  };

  const openAddExpense = () => { setIsEditingExpense(false); setEditingExpenseId(null); setSelectedClientId(''); setSelectedExpenseProjectId(''); setSelectedAdvanceId(''); setSelectedTaskId(''); setNewExpenseDesc(''); setNewExpenseNote(''); setExpenseImagePreview(null); setFileToUpload(null); setExpenseType('FIXED'); setFixedAmount(''); setAdditionalAmount(''); setInvoiceItems([{ id: '1', itemName: '', quantity: 1, unitPrice: 0, total: 0 }]); setShowAddExpenseModal(true); };
  
  const handleSubmitExpense = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!selectedAdvanceId || !newExpenseDesc || totalCalculated <= 0) return; 
      setIsUploading(true); 
      let finalImageUrl = expenseImagePreview; 
      if (fileToUpload) { const uploadedUrl = await uploadFile(fileToUpload); if (uploadedUrl) finalImageUrl = uploadedUrl; } 
      const expenseData = { advanceId: selectedAdvanceId, userId: user.id, taskId: selectedTaskId || undefined, amount: totalCalculated, description: newExpenseDesc, notes: newExpenseNote, date: new Date().toISOString().split('T')[0], imageUrl: finalImageUrl || undefined, isInvoice: expenseType === 'INVOICE', invoiceItems: expenseType === 'INVOICE' ? invoiceItems : undefined, additionalAmount: parseFloat(additionalAmount) || 0, status: ExpenseStatus.PENDING }; 
      if (isEditingExpense && editingExpenseId) await editExpense(editingExpenseId, expenseData); else await addExpense(expenseData); 
      setIsUploading(false); setShowAddExpenseModal(false); 
  };
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setFileToUpload(file); const reader = new FileReader(); reader.onloadend = () => setExpenseImagePreview(reader.result as string); reader.readAsDataURL(file); } };
  const triggerFileInput = () => fileInputRef.current?.click();

  const exportSingleExpenseSheet = (expense: Expense) => {
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [
        ["تفاصيل المصروف"],
        ["الوصف", expense.description],
        ["المبلغ", expense.amount],
        ["التاريخ", expense.date],
        ["الحالة", expense.status],
        ["ملاحظات", expense.notes || "-"],
    ];
    if (expense.isInvoice && expense.invoiceItems) {
        wsData.push([]);
        wsData.push(["بنود الفاتورة"]);
        wsData.push(["البند", "الكمية", "سعر الوحدة", "الإجمالي"]);
        expense.invoiceItems.forEach(item => {
            wsData.push([item.itemName, item.quantity, item.unitPrice, item.total]);
        });
    }
    if (expense.additionalAmount) {
       wsData.push([]);
       wsData.push(["مبالغ إضافية", expense.additionalAmount]);
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Expense Details");
    XLSX.writeFile(wb, `Expense_${expense.id.substring(0,8)}.xlsx`);
  };

  const usersForSelectedProject = useMemo(() => {
      if (!newAdvanceProjectId || user.role !== UserRole.ADMIN) return [];
      const project = projects.find(p => p.id === newAdvanceProjectId);
      if (!project || !project.assignedEngineers) return [];
      return users.filter(u => project.assignedEngineers?.includes(u.id) && u.role === UserRole.ENGINEER);
  }, [newAdvanceProjectId, projects, users, user.role]);

  const renderRejectionInput = (id: string, type: 'EXPENSE' | 'ADVANCE') => (
      <div className="mt-2 bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800 animate-fade-in backdrop-blur-sm">
          <input type="text" placeholder={t('rejectionReasonPlaceholder')} className="input-modern w-full p-2.5 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white outline-none mb-3" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          <div className="flex justify-end gap-2">
              <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-4 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={() => type === 'EXPENSE' ? handleUpdateExpenseStatus(id, ExpenseStatus.REJECTED, rejectionReason) : handleUpdateAdvanceStatus(id, AdvanceStatus.REJECTED, rejectionReason)} className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-lg hover:bg-red-600 shadow-md shadow-red-500/20" disabled={!rejectionReason}>{t('confirm')}</button>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20 relative">
       {/* 1. Greeting Banner */}
      <div className="relative rounded-[2rem] p-8 md:p-10 shadow-2xl overflow-hidden group">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900"></div>
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000"></div>
         <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl -ml-16 -mb-16 animate-pulse-soft"></div>
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
               <div className="inline-flex items-center gap-2 text-blue-200 mb-3 font-semibold bg-white/10 w-fit px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm"><GreetingIcon size={18} className="text-yellow-300" /><span>{greeting.text}</span></div>
               <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-md">{user.name}</h1>
               <p className="text-slate-300 text-lg flex items-center gap-2 font-medium"><Briefcase size={20} className="text-blue-400" />{t('welcome')} — <span className="text-white">{user.jobTitle || t('roleEngineer')}</span></p>
            </div>
            {/* Chart Area */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/10 w-full md:w-[450px] h-48 shadow-inner overflow-hidden flex flex-col">
                <div className="text-white/70 text-xs font-bold mb-2 flex justify-between"><span>منحنى المصروفات (آخر 6 شهور)</span>{trendData.every(d => d.amount === 0) && <span className="text-amber-300">لا توجد بيانات</span>}</div>
                <div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6}/><stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" hide={false} axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} minTickGap={30} /><Tooltip contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff'}} itemStyle={{color: '#93c5fd'}} /><Area type="monotone" dataKey="amount" stroke="#93c5fd" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" activeDot={{r: 6, strokeWidth: 0}} /></AreaChart></ResponsiveContainer></div>
            </div>
         </div>
      </div>

      {/* 2. Quick Actions */}
      {(user.role === UserRole.ADMIN || user.role === UserRole.ENGINEER) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => setShowCreateAdvanceModal(true)} className="relative flex items-center justify-between p-8 rounded-3xl overflow-hidden group shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-600 transition-colors"></div>
                  <div className="relative z-10 text-start"><h3 className="text-2xl font-bold text-white mb-1">{user.role === UserRole.ADMIN ? 'صرف عهدة جديدة' : 'طلب عهدة جديدة'}</h3><p className="text-blue-100 text-sm opacity-90">{user.role === UserRole.ADMIN ? 'إسناد عهدة مالية لمهندس مشروع' : 'إرسال طلب عهدة جديدة للمشروع'}</p></div>
                  <div className="relative z-10 bg-white/20 p-4 rounded-2xl group-hover:bg-white/30 transition-colors backdrop-blur-sm"><Wallet size={36} className="text-white" /></div>
              </button>
              <button onClick={openAddExpense} className="relative flex items-center justify-between p-8 rounded-3xl overflow-hidden group shadow-lg shadow-orange-200/50 dark:shadow-none transition-all hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500"></div>
                  <div className="relative z-10 text-start"><h3 className="text-2xl font-bold text-white mb-1">تسجيل صرف (مصروف)</h3><p className="text-orange-100 text-sm opacity-90">إضافة فاتورة أو إيصال مصروف</p></div>
                  <div className="relative z-10 bg-white/20 p-4 rounded-2xl group-hover:bg-white/30 transition-colors backdrop-blur-sm"><ArrowUpRight size={36} className="text-white" /></div>
              </button>
          </div>
      )}
      {user.role === UserRole.TECHNICIAN && (
          <div className="grid grid-cols-1">
              <button onClick={openAddExpense} className="relative flex items-center justify-between p-8 rounded-3xl overflow-hidden group shadow-lg shadow-orange-200/50 dark:shadow-none transition-all hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500"></div>
                  <div className="relative z-10 text-start"><h3 className="text-2xl font-bold text-white mb-1">تسجيل صرف (مصروف)</h3><p className="text-orange-100 text-sm opacity-90">إضافة فاتورة أو إيصال مصروف</p></div>
                  <div className="relative z-10 bg-white/20 p-4 rounded-2xl group-hover:bg-white/30 transition-colors backdrop-blur-sm"><ArrowUpRight size={36} className="text-white" /></div>
              </button>
          </div>
      )}

      {/* --- DASHBOARD FILTERS (NEW) --- */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm">
              <Filter size={18} />
              <span>فلترة البيانات الزمنية:</span>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative group flex-1 md:w-40">
                  <input type="date" value={dashStartDate} onChange={e => setDashStartDate(e.target.value)} className="w-full p-2.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all" />
              </div>
              <span className="text-slate-400 font-bold">-</span>
              <div className="relative group flex-1 md:w-40">
                  <input type="date" value={dashEndDate} onChange={e => setDashEndDate(e.target.value)} className="w-full p-2.5 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all" />
              </div>
              {(dashStartDate || dashEndDate) && (
                  <button onClick={() => { setDashStartDate(''); setDashEndDate(''); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="مسح الفلتر">
                      <XSquare size={20} />
                  </button>
              )}
          </div>
      </div>

      {/* 3. Detailed Stats Grid (Clickable & Filtered) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div onClick={() => handleCardClick('BALANCE')} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl"><Wallet size={24} /></div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg flex items-center gap-1">{hasDateFilter ? <Filter size={10}/> : null} {displayBalanceLabel}</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{displayBalanceValue.toLocaleString()}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{displayBalanceSub}</p>
          </div>

          <div onClick={() => handleCardClick('SPENT')} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl"><TrendingUp size={24} /></div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg flex items-center gap-1">{hasDateFilter ? <Filter size={10}/> : null} مصروفات</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{totalApprovedExpensesAmount.toLocaleString()}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{hasDateFilter ? 'معتمدة في الفترة' : 'تم اعتمادها وصرفها'}</p>
          </div>

          <div onClick={() => handleCardClick('PENDING')} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl"><AlertCircle size={24} /></div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg flex items-center gap-1">{hasDateFilter ? <Filter size={10}/> : null} معلق / مرفوض</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{totalPendingRequests}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{hasDateFilter ? 'خلال الفترة' : 'طلبات تحتاج انتباهك'}</p>
          </div>

          <div onClick={() => handleCardClick('PROJECTS')} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Briefcase size={24} /></div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg flex items-center gap-1">{hasDateFilter ? <Filter size={10}/> : null} نشط</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">{displayProjectsList.length}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{hasDateFilter ? 'تم إنشاؤها في الفترة' : 'مشاريع قيد التنفيذ'}</p>
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Expenses Table */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden">
            <div className="flex flex-col gap-6 mb-8 relative z-10">
                <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3"><div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm"><FileText size={24} /></div>{t('recentExpenses')}</h2></div>
                <div className="flex flex-col md:flex-row gap-4 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200/50 dark:border-slate-700">
                    <div className="relative flex-1"><input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none shadow-sm" /><Search className="absolute left-4 top-3.5 text-slate-400" size={18} /></div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar"><select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="bg-white dark:bg-slate-800 border-none text-slate-700 dark:text-slate-200 py-3 px-5 rounded-xl text-sm font-bold outline-none cursor-pointer"><option value="ALL">{t('allProjects')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-white dark:bg-slate-800 border-none text-slate-700 dark:text-slate-200 py-3 px-5 rounded-xl text-sm font-bold outline-none cursor-pointer"><option value="ALL">{t('filterAll')}</option><option value={ExpenseStatus.PENDING}>{t('statusPending')}</option><option value={ExpenseStatus.APPROVED}>{t('statusApproved')}</option><option value={ExpenseStatus.REJECTED}>{t('statusRejected')}</option></select><Button onClick={openAddExpense} variant="primary" className="whitespace-nowrap px-6 py-3 rounded-xl shadow-lg shadow-blue-500/20"><Plus size={18} /><span className="hidden md:inline">{t('addExpense')}</span></Button></div>
                </div>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar relative z-10">
                <table className="w-full text-start border-separate border-spacing-y-3">
                    <thead><tr className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider font-bold"><th className="pb-2 px-4 text-start">{t('description')}</th><th className="pb-2 px-4 text-start">{t('amount')}</th><th className="pb-2 px-4 text-start">{t('date')}</th><th className="pb-2 px-4 text-start">{t('status')}</th><th className="pb-2 px-4 text-start">{t('actions')}</th></tr></thead>
                    <tbody className="text-sm">{myExpenses.map((expense) => { const hasAuthority = canTakeAction(expense.userId); const isUserEditable = canEditExpense(expense); const isAdmin = user.role === UserRole.ADMIN; return (<tr key={expense.id} className="bg-white dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-all duration-200 group cursor-pointer shadow-sm rounded-xl overflow-hidden" onClick={() => setSelectedExpense(expense)}><td className="py-4 px-4 rounded-r-xl border-l-4 border-transparent group-hover:border-blue-500"><div className="flex items-center gap-4">{expense.imageUrl ? (<div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100"><img src={expense.imageUrl} className="w-full h-full object-cover" /></div>) : (<div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100"><ImageIcon size={20} /></div>)}<div><p className="font-bold text-slate-800 dark:text-white text-base group-hover:text-blue-600 transition-colors">{expense.description}</p>{expense.notes && (<div className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md mt-1 w-fit"><StickyNote size={10} /><span>{expense.notes}</span></div>)}</div></div></td><td className="py-4 px-4 font-black text-slate-700 dark:text-slate-200 text-base">{expense.amount.toLocaleString()} <span className="text-xs font-normal text-slate-400">{t('currency')}</span></td><td className="py-4 px-4 text-slate-500 flex items-center gap-2 font-medium text-xs"><div className="bg-slate-100 p-1.5 rounded-lg"><Calendar size={14}/></div>{expense.date}</td><td className="py-4 px-4"><StatusBadge status={expense.status} /></td><td className="py-4 px-4 rounded-l-xl" onClick={(e) => e.stopPropagation()}><div className="flex gap-2 items-center justify-end">{hasAuthority && (<>{expense.status === ExpenseStatus.PENDING && (<><button onClick={() => handleUpdateExpenseStatus(expense.id, ExpenseStatus.APPROVED)} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><CheckCircle size={20} /> موافقة</button><button onClick={() => { setRejectingId(expense.id); setRejectionType('EXPENSE'); }} className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><XCircle size={20} /> رفض</button></>)}{expense.status === ExpenseStatus.APPROVED && (<button onClick={() => handleToggleEditability(expense.id, expense.isEditable || false)} className={`p-2 rounded-xl transition-all border ${expense.isEditable ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{expense.isEditable ? <Unlock size={18} /> : <Lock size={18} />}</button>)}</>)}{!isAdmin && isUserEditable && (<button onClick={() => openEditExpense(expense)} className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit size={18} /></button>)}{!hasAuthority && !isUserEditable && !isAdmin && (<span className="text-slate-300"><MoreHorizontal size={20} /></span>)}</div></td></tr>) })}</tbody>
                </table>
            </div>
        </div>
        {/* Financial Chart */}
        <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10"><h2 className="text-xl font-black text-slate-800 dark:text-white mb-4 flex items-center gap-3"><div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-xl text-purple-600 dark:text-purple-400 shadow-sm"><PieChartIcon size={24} /></div>توزيع المصروفات (حسب المشروع)</h2><div className="h-80 relative" style={{ minHeight: '300px' }}><ResponsiveContainer width="100%" height="100%"><PieChart><defs>{pieChartData.map((entry, index) => (<linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={entry.color1} stopOpacity={1}/><stop offset="100%" stopColor={entry.color2} stopOpacity={1}/></linearGradient>))}</defs><Pie data={pieChartData} cx="50%" cy="50%" innerRadius={75} outerRadius={105} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={6}>{pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={`url(#gradient-${index})`} style={{filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.15))'}} />))}</Pie><Tooltip formatter={(value: number) => `${value.toLocaleString()} ${t('currency')}`} contentStyle={{ borderRadius: '16px', background: 'rgba(15, 23, 42, 0.95)', color: '#fff', border: 'none' }} itemStyle={{ color: '#fff', fontWeight: 'bold' }}/></PieChart></ResponsiveContainer><div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"><p className="text-3xl font-black text-slate-800 dark:text-white tracking-tight drop-shadow-sm">{totalSpentChart.toLocaleString()}</p><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">إجمالي المصروف</p></div></div></div><div className="space-y-2.5 mt-4 max-h-52 overflow-y-auto pr-2 custom-scrollbar relative z-10">{pieChartData.length > 0 ? pieChartData.map((item, index) => (<div key={index} className="flex items-center justify-between text-sm p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full shadow-lg" style={{ background: `linear-gradient(to bottom right, ${item.color1}, ${item.color2})` }}></div><span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[120px] text-xs">{item.name}</span></div><span className="font-black text-slate-800 dark:text-white px-2 py-0.5 rounded-lg text-xs">{item.value.toLocaleString()}</span></div>)) : <p className="text-center text-slate-400 text-xs py-4">لا توجد مصروفات معتمدة للعرض</p>}</div>
        </div>
      </div>

      {/* --- GENERIC DETAILS MODAL --- */}
      {showDetailsModal && detailsType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in" onClick={() => setShowDetailsModal(false)}>
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                      <div>
                          <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                              {detailsType === 'BALANCE' && <><Wallet className="text-emerald-500"/> {displayBalanceLabel}</>}
                              {detailsType === 'SPENT' && <><TrendingUp className="text-blue-500"/> سجل المصروفات المعتمدة</>}
                              {detailsType === 'PENDING' && <><AlertCircle className="text-amber-500"/> الطلبات المعلقة</>}
                              {detailsType === 'PROJECTS' && <><Briefcase className="text-indigo-500"/> المشاريع النشطة</>}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{hasDateFilter ? `الفترة: ${dashStartDate} إلى ${dashEndDate}` : 'كل السجلات (بدون فلتر زمني)'}</p>
                      </div>
                      <button onClick={() => setShowDetailsModal(false)} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                      {/* CONTENT BASED ON TYPE */}
                      {detailsType === 'BALANCE' && (
                          <div className="space-y-4">
                              {hasDateFilter ? (
                                  // Show list of Advances Created in Range
                                  filteredAdvancesForStats.length > 0 ? filteredAdvancesForStats.map(adv => (
                                      <div key={adv.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                          <div>
                                              <p className="font-bold text-slate-800 dark:text-white">{adv.description}</p>
                                              <p className="text-xs text-slate-500">{users.find(u => u.id === adv.userId)?.name} • {adv.date}</p>
                                          </div>
                                          <div className="font-black text-emerald-600 dark:text-emerald-400">{adv.amount.toLocaleString()}</div>
                                      </div>
                                  )) : <p className="text-center text-slate-400">لا توجد عهد مستلمة في هذه الفترة</p>
                              ) : (
                                  // Show list of OPEN advances (Current Balance)
                                  openAdvancesList.length > 0 ? openAdvancesList.map(adv => (
                                      <div key={adv.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                          <div>
                                              <p className="font-bold text-slate-800 dark:text-white">{adv.description}</p>
                                              <p className="text-xs text-slate-500">{users.find(u => u.id === adv.userId)?.name} • {adv.date}</p>
                                          </div>
                                          <div className="text-end">
                                              <p className="text-xs text-slate-400 uppercase">متبقي</p>
                                              <p className="font-black text-emerald-600 dark:text-emerald-400">{adv.remainingAmount.toLocaleString()}</p>
                                          </div>
                                      </div>
                                  )) : <p className="text-center text-slate-400">لا توجد أرصدة متاحة حالياً</p>
                              )}
                          </div>
                      )}

                      {detailsType === 'SPENT' && (
                          <div className="space-y-4">
                              {filteredApprovedExpenses.length > 0 ? filteredApprovedExpenses.map(exp => (
                                  <div key={exp.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><FileCheck size={20}/></div>
                                          <div>
                                              <p className="font-bold text-slate-800 dark:text-white">{exp.description}</p>
                                              <p className="text-xs text-slate-500">{exp.date} • {users.find(u => u.id === exp.userId)?.name}</p>
                                          </div>
                                      </div>
                                      <div className="font-black text-blue-600 dark:text-blue-400">{exp.amount.toLocaleString()}</div>
                                  </div>
                              )) : <p className="text-center text-slate-400">لا توجد مصروفات معتمدة في هذه الفترة</p>}
                          </div>
                      )}

                      {detailsType === 'PENDING' && (
                          <div className="space-y-4">
                              {/* Using the filtered lists from Dashboard logic */}
                              {pendingExpensesList.map(exp => (
                                  <div key={exp.id} className="flex justify-between items-center p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                                      <div>
                                          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                              {exp.description} 
                                              {exp.status === ExpenseStatus.REJECTED && <span className="text-[10px] bg-red-100 text-red-600 px-2 rounded">مرفوض</span>}
                                          </p>
                                          <p className="text-xs text-slate-500">مصروف • {exp.date} • {users.find(u => u.id === exp.userId)?.name}</p>
                                      </div>
                                      <div className="font-black text-amber-600 dark:text-amber-400">{exp.amount.toLocaleString()}</div>
                                  </div>
                              ))}
                              {pendingAdvancesList.map(adv => (
                                  <div key={adv.id} className="flex justify-between items-center p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                                      <div>
                                          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                              {adv.description}
                                              {adv.status === AdvanceStatus.REJECTED && <span className="text-[10px] bg-red-100 text-red-600 px-2 rounded">مرفوض</span>}
                                          </p>
                                          <p className="text-xs text-slate-500">عهدة • {adv.date} • {users.find(u => u.id === adv.userId)?.name}</p>
                                      </div>
                                      <div className="font-black text-amber-600 dark:text-amber-400">{adv.amount.toLocaleString()}</div>
                                  </div>
                              ))}
                              {totalPendingRequests === 0 && <p className="text-center text-slate-400">لا توجد طلبات معلقة</p>}
                          </div>
                      )}

                      {detailsType === 'PROJECTS' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {displayProjectsList.map(proj => (
                                  <div key={proj.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <h4 className="font-bold text-slate-800 dark:text-white mb-1">{proj.name}</h4>
                                      <p className="text-xs text-slate-500">{proj.location}</p>
                                      <div className="mt-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded w-fit">{proj.code}</div>
                                  </div>
                              ))}
                              {displayProjectsList.length === 0 && <div className="col-span-full text-center text-slate-400">لا توجد مشاريع نشطة</div>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Pending Expenses Modal (Actionable - Kept for Approvals) */}
      {showPendingExpensesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
                   <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
                      <div><h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">{t('pendingExpensesTitle')}</h3><p className="text-sm text-slate-500 mt-1">المصروفات المعلقة والمرفوضة</p></div>
                      <button onClick={() => { setShowPendingExpensesModal(false); setRejectingId(null); }} className="p-2 bg-white rounded-full hover:text-red-500 shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar flex-1">
                       {pendingExpensesList.map(exp => {
                            const advance = advances.find(a => a.id === exp.advanceId);
                            const u = users.find(user => user.id === exp.userId);
                            const isRejecting = rejectingId === exp.id && rejectionType === 'EXPENSE';
                            const hasAuthority = canTakeAction(exp.userId);
                            const isUserEditable = canEditExpense(exp);
                            const isRejected = exp.status === ExpenseStatus.REJECTED;

                            return (
                                <div key={exp.id} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm ${isRejected ? 'border-red-300 dark:border-red-800 bg-red-50/20 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div className="flex gap-5">
                                             {exp.imageUrl ? (<div onClick={() => setPreviewImage(exp.imageUrl!)} className="w-20 h-20 rounded-xl overflow-hidden shadow-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border-2 border-transparent hover:border-blue-500"><img src={exp.imageUrl} className="w-full h-full object-cover" /></div>) : (<div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0"><ImageIcon size={24}/></div>)}
                                             <div>
                                                 <h4 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                                     {exp.description}
                                                     {isRejected && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">مرفوض</span>}
                                                 </h4>
                                                 <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 mt-2"><span className="bg-slate-100 px-2 py-1 rounded">{u?.name}</span><span className="bg-slate-100 px-2 py-1 rounded">{advance?.description}</span></div>
                                                 <p className="text-2xl font-black text-blue-600 mt-2">{exp.amount.toLocaleString()}</p>
                                                 {/* Show Rejection Reason if Rejected */}
                                                 {isRejected && exp.rejectionReason && (
                                                     <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                                         <strong>سبب الرفض:</strong> {exp.rejectionReason}
                                                     </div>
                                                 )}
                                             </div>
                                        </div>
                                        <div className="flex flex-col gap-3 items-end">
                                             <div className="flex gap-2">
                                                 <button onClick={() => setSelectedExpense(exp)} className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"><Eye size={16} /> عرض</button>
                                                 {!isRejecting && hasAuthority && !isRejected && (<><button onClick={() => handleUpdateExpenseStatus(exp.id, ExpenseStatus.APPROVED)} className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-1"><Check size={16}/> {t('approve')}</button><button onClick={() => { setRejectingId(exp.id); setRejectionType('EXPENSE'); }} className="py-2 px-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-100"><X size={18}/></button></>)}
                                             </div>
                                             {/* If Rejected, show "Edit & Resubmit" for owner */}
                                             {!user.role.includes(UserRole.ADMIN) && isUserEditable && (
                                                 <Button variant="primary" onClick={() => { setShowPendingExpensesModal(false); openEditExpense(exp); }} className="py-2 text-xs w-full bg-blue-600 hover:bg-blue-700">
                                                     {isRejected ? <><RefreshCcw size={14} /> تعديل وإعادة إرسال</> : <><Edit size={14}/> {t('edit')}</>}
                                                 </Button>
                                             )}
                                        </div>
                                    </div>
                                    {isRejecting && renderRejectionInput(exp.id, 'EXPENSE')}
                                </div>
                            );
                       })}
                       {pendingExpensesList.length === 0 && <p className="text-center text-slate-400">لا توجد طلبات معلقة</p>}
                  </div>
             </div>
        </div>
      )}

      {/* ... [Rest of existing modals: showPendingAdvancesModal, showAddExpenseModal, showCreateAdvanceModal, selectedExpense detail modal] ... */}
      {/* Kept unchanged for brevity, as they are essential features not requested to change but need to stay */}
      
      {showPendingAdvancesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
                   <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-900/10">
                      <div><h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">{t('pendingAdvancesTitle')}</h3><p className="text-sm text-slate-500 mt-1">طلبات عهد جديدة تحتاج للمراجعة</p></div>
                      <button onClick={() => { setShowPendingAdvancesModal(false); setRejectingId(null); }} className="p-2 bg-white rounded-full hover:text-red-500 shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar flex-1">
                       {pendingAdvancesList.map(adv => {
                            const project = projects.find(p => p.id === adv.projectId);
                            const u = users.find(user => user.id === adv.userId);
                            const isRejecting = rejectingId === adv.id && rejectionType === 'ADVANCE';
                            const canApprove = canTakeAction(adv.userId); 
                            return (
                                <div key={adv.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div className="flex gap-5">
                                             <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-800 flex-shrink-0"><Wallet size={32}/></div>
                                             <div><h4 className="font-bold text-lg text-slate-800 dark:text-white">{adv.description}</h4><div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 mt-2"><span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><UserIcon size={12}/> {u?.name}</span><span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Briefcase size={12}/> {project?.name}</span><span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Calendar size={12}/> {adv.date}</span></div><p className="text-2xl font-black text-indigo-600 mt-2">{adv.amount.toLocaleString()} <span className="text-sm text-slate-400 font-bold">{t('currency')}</span ></p></div>
                                        </div>
                                        <div className="flex flex-col gap-3 items-end">
                                             {!isRejecting && canApprove && (<div className="flex gap-2"><button onClick={() => handleUpdateAdvanceStatus(adv.id, AdvanceStatus.OPEN)} className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-1"><Check size={16}/> {t('approve')}</button><button onClick={() => { setRejectingId(adv.id); setRejectionType('ADVANCE'); }} className="py-2 px-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm border border-red-100"><X size={18}/></button></div>)}
                                             {!canApprove && <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">بانتظار الموافقة</span>}
                                        </div>
                                    </div>
                                    {isRejecting && renderRejectionInput(adv.id, 'ADVANCE')}
                                </div>
                            );
                       })}
                       {pendingAdvancesList.length === 0 && <p className="text-center text-slate-400 py-10">لا توجد طلبات عهد معلقة</p>}
                  </div>
             </div>
        </div>
      )}

      {showAddExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{isEditingExpense ? 'تعديل / إعادة إرسال المصروف' : t('newExpenseTitle')}</h3>
                <button onClick={() => setShowAddExpenseModal(false)} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={handleSubmitExpense} className="space-y-6">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">العميل</label><div className="relative"><select required value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setSelectedExpenseProjectId(''); setSelectedTaskId(''); }} disabled={isEditingExpense} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none"><option value="">اختر العميل...</option>{availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Folder size={16}/></div></div></div>
                {selectedClientId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectProject')}</label><div className="relative"><select required value={selectedExpenseProjectId} onChange={(e) => { setSelectedExpenseProjectId(e.target.value); setSelectedTaskId(''); }} disabled={isEditingExpense} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none"><option value="">اختر المشروع...</option>{availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Briefcase size={16}/></div></div></div>)}
                {selectedExpenseProjectId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">المهمة (التاسك)</label><div className="relative"><select required value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none"><option value="">اختر المهمة...</option>{availableTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><ListTodo size={16}/></div></div></div>)}
                {selectedTaskId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectAdvance')} (مصدر التمويل)</label><div className="relative"><select required value={selectedAdvanceId} onChange={(e) => setSelectedAdvanceId(e.target.value)} disabled={isEditingExpense} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('selectAdvancePlaceholder')}</option>{availableAdvances.map(adv => <option key={adv.id} value={adv.id}>{adv.description} (رصيد: {adv.remainingAmount.toLocaleString()})</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Wallet size={16}/></div></div></div>)}
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('expenseDesc')}</label><input required type="text" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none" placeholder="مثال: فاتورة توريد مواد" /></div>
                <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl flex items-center"><button type="button" onClick={() => setExpenseType('FIXED')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${expenseType === 'FIXED' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}><FileMinus size={16} /> مبلغ ثابت</button><button type="button" onClick={() => setExpenseType('INVOICE')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${expenseType === 'INVOICE' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}><FileCheck size={16} /> فاتورة تفصيلية</button></div>
                <div className="animate-fade-in">{expenseType === 'FIXED' ? (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('amount')} ({t('currency')})</label><div className="relative"><input required type="number" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white text-2xl font-black outline-none font-mono" placeholder="0.00" /><span className="absolute left-4 top-5 text-slate-400 font-bold text-sm">EGP</span></div></div>) : (<div className="space-y-3"><div className="flex justify-between items-center mb-1"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">بنود الفاتورة</label><button type="button" onClick={handleAddInvoiceItem} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold flex items-center gap-1 transition-colors"><PlusCircle size={14} /> إضافة بند</button></div><div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/50"><div className="p-2 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">{invoiceItems.map((item, index) => (<div key={item.id} className="grid grid-cols-12 gap-2 items-center animate-slide-up"><div className="col-span-5"><input type="text" placeholder={`بند ${index + 1}`} value={item.itemName} onChange={e => handleInvoiceItemChange(item.id, 'itemName', e.target.value)} className="w-full p-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700" /></div><div className="col-span-2"><input type="number" placeholder="0" min="1" value={item.quantity} onChange={e => handleInvoiceItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm text-center border border-slate-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 font-mono" /></div><div className="col-span-2"><input type="number" placeholder="0" value={item.unitPrice} onChange={e => handleInvoiceItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full p-2 text-sm text-center border border-slate-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 font-mono" /></div><div className="col-span-2 text-center font-bold text-slate-700 dark:text-slate-200 text-sm font-mono bg-slate-100 dark:bg-slate-900 py-2 rounded-lg">{item.total.toLocaleString()}</div><div className="col-span-1 flex justify-center"><button type="button" onClick={() => handleRemoveInvoiceItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" disabled={invoiceItems.length === 1}><Trash2 size={16} /></button></div></div>))}</div></div></div>)}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">مبالغ إضافية (اختياري)</label><input type="number" value={additionalAmount} onChange={(e) => setAdditionalAmount(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none font-mono text-slate-900 dark:text-white text-sm" placeholder="إكرامية، نقل، ضريبة..." /></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('receiptImage')}</label><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} /><div onClick={triggerFileInput} className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${expenseImagePreview ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{expenseImagePreview ? (<div className="text-blue-600 dark:text-blue-400 text-xs font-bold flex flex-col items-center justify-center gap-2"><div className="w-16 h-16 rounded-lg overflow-hidden border border-blue-200"><img src={expenseImagePreview} className="w-full h-full object-cover" /></div><span className="flex items-center gap-1"><ImageIcon size={14}/> تم اختيار الصورة (اضغط للتغيير)</span></div>) : (<div className="text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 py-4"><Upload size={16}/> اضغط لرفع صورة</div>)}</div></div></div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('notes')}</label><textarea value={newExpenseNote} onChange={(e) => setNewExpenseNote(e.target.value)} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none min-h-[80px] text-slate-900 dark:text-white text-sm" placeholder="أي ملاحظات إضافية..." /></div>
                <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl p-5 flex justify-between items-center border border-slate-200 dark:border-slate-700 shadow-sm"><span className="font-bold text-slate-600 dark:text-slate-300">المجموع الكلي:</span><span className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalCalculated.toLocaleString()} <span className="text-sm font-bold text-slate-400">{t('currency')}</span ></span></div>
                <div className="pt-2"><Button type="submit" className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all transform hover:-translate-y-1" disabled={totalCalculated <= 0 || isUploading} isLoading={isUploading}>{t('save')}</Button></div>
                </form>
            </div>
          </div>
        </div>
      )}

      {showCreateAdvanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in flex flex-col max-h-[90vh] border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{user.role === UserRole.ADMIN ? 'صرف عهدة جديدة' : 'طلب عهدة جديدة'}</h3>
                <button onClick={() => setShowCreateAdvanceModal(false)} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={handleSubmitAdvance} className="space-y-5">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectProject')}</label><div className="relative"><select required value={newAdvanceProjectId} onChange={(e) => { setNewAdvanceProjectId(e.target.value); setNewAdvanceParentId(''); }} disabled={isAdvanceSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">{t('selectProject')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Briefcase size={16}/></div></div></div>
                  {user.role === UserRole.ADMIN && (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectUser')} (المهندس)</label><div className="relative"><select required value={newAdvanceUserId} onChange={(e) => setNewAdvanceUserId(e.target.value)} disabled={isAdvanceSubmitting || !newAdvanceProjectId} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50"><option value="">اختر المهندس...</option>{usersForSelectedProject.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><UserIcon size={16}/></div></div></div>)}
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('description')}</label><input required type="text" value={newAdvanceDesc} onChange={(e) => setNewAdvanceDesc(e.target.value)} disabled={isAdvanceSubmitting} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none" placeholder="مثال: عهدة نقل ومواصلات" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('advanceValue')}</label><input required type="number" min="1" value={newAdvanceAmount} onChange={(e) => setNewAdvanceAmount(e.target.value)} disabled={isAdvanceSubmitting} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white text-2xl font-black outline-none font-mono" placeholder="0" /></div>
                  <div className="pt-4"><Button type="submit" isLoading={isAdvanceSubmitting} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20">{t('save')}</Button></div>
                </form>
            </div>
          </div>
        </div>
      )}

      {selectedExpense && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
               <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[90vh] border border-white/20">
                   <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50"><div><h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">تفاصيل المصروف</h3><p className="text-slate-400 text-sm mt-1">رقم المعاملة: #{selectedExpense.id.substring(0,8)}</p></div><button onClick={() => setSelectedExpense(null)} className="p-2.5 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all hover:rotate-90"><X size={20} /></button></div>
                  <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                      <div className="text-center"><h2 className="text-5xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{selectedExpense.amount.toLocaleString()} <span className="text-2xl text-slate-400 font-medium">{t('currency')}</span></h2><h3 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{selectedExpense.description}</h3><div className="mt-3 flex justify-center scale-110"><StatusBadge status={selectedExpense.status}/></div></div>
                      {selectedExpense.isInvoice && selectedExpense.invoiceItems && (<div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"><div className="p-4 bg-slate-100 dark:bg-slate-800 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700"><FileCheck size={18} className="text-blue-600 dark:text-blue-400" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">بنود الفاتورة</span></div><div className="p-4 space-y-3">{selectedExpense.invoiceItems.map((item, i) => (<div key={i} className="flex justify-between items-center text-sm border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 pb-3 last:pb-0"><div><p className="font-bold text-slate-700 dark:text-slate-200">{item.itemName}</p><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.quantity} × {item.unitPrice.toLocaleString()}</p></div><p className="font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm">{item.total.toLocaleString()}</p></div>))}</div>{selectedExpense.additionalAmount && selectedExpense.additionalAmount > 0 && (<div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 flex justify-between items-center text-sm border-t border-blue-100 dark:border-blue-900/30"><span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold"><DollarSign size={16}/> إضافات</span><span className="font-bold text-blue-700 dark:text-blue-300 text-lg">{selectedExpense.additionalAmount.toLocaleString()}</span></div>)}</div>)}
                      <div className="grid grid-cols-2 gap-4 text-sm"><div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-slate-400 text-xs font-bold uppercase mb-1">التاريخ</p><p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calendar size={14}/> {selectedExpense.date}</p></div><div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-slate-400 text-xs font-bold uppercase mb-1">بواسطة</p><p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><UserIcon size={14}/> {users.find(u => u.id === selectedExpense.userId)?.name}</p></div><div className="col-span-2 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30"><p className="text-amber-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><StickyNote size={12}/> ملاحظات</p><p className="font-medium text-amber-900 dark:text-amber-100 text-sm">{selectedExpense.notes || 'لا توجد ملاحظات إضافية.'}</p></div></div>
                      
                      {selectedExpense.status === ExpenseStatus.REJECTED && selectedExpense.rejectionReason && (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-center">
                              <p className="text-red-600 dark:text-red-400 font-bold mb-1">سبب الرفض</p>
                              <p className="text-slate-800 dark:text-white">{selectedExpense.rejectionReason}</p>
                          </div>
                      )}

                      {selectedExpense.imageUrl && (<div><p className="text-sm font-bold mb-3 dark:text-white flex items-center gap-2"><ImageIcon size={16}/> المرفقات</p><div onClick={() => setPreviewImage(selectedExpense.imageUrl!)} className="relative h-48 w-full rounded-2xl overflow-hidden cursor-pointer group border-2 border-slate-200 dark:border-slate-700 shadow-sm"><img src={selectedExpense.imageUrl} alt="Receipt" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" /><div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"><p className="text-white font-bold flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full"><ImageIcon size={18} /> عرض الصورة</p></div></div></div>)}
                      {selectedExpense.status === ExpenseStatus.PENDING && canTakeAction(selectedExpense.userId) && (<div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3"><Button onClick={() => handleUpdateExpenseStatus(selectedExpense.id, ExpenseStatus.APPROVED)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 py-3 text-lg font-bold"><CheckCircle size={20} /> موافقة</Button><Button variant="danger" onClick={() => { setRejectingId(selectedExpense.id); setRejectionType('EXPENSE'); setSelectedExpense(null); }} className="flex-1 py-3 text-lg font-bold"><XCircle size={20} /> رفض</Button></div>)}
                      
                      {selectedExpense.status === ExpenseStatus.REJECTED && canEditExpense(selectedExpense) && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                              <Button onClick={() => { openEditExpense(selectedExpense); setSelectedExpense(null); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 font-bold"><Edit size={18} className="mr-2"/> تعديل وإعادة إرسال</Button>
                          </div>
                      )}

                      <div className="pt-2"><Button onClick={() => exportSingleExpenseSheet(selectedExpense)} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 rounded-xl text-lg font-bold"><FileSpreadsheet size={20} /> تصدير فاتورة (Excel)</Button></div>
                  </div>
               </div>
          </div>
      )}

      {previewImage && (<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4 animate-fade-in backdrop-blur-md" onClick={() => setPreviewImage(null)}><div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"><button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 p-2 rounded-full"><X size={24}/></button><img src={previewImage} alt="Receipt" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/10" /></div></div>)}
    </div>
  );
};
