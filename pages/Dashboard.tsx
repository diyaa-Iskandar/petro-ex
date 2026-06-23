
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserRole, ExpenseStatus, AdvanceStatus, Expense, InvoiceItem, Advance, Project } from '../types';
import { Plus, Check, X, AlertCircle, Search, Wallet, FileText, StickyNote, Upload, Image as ImageIcon, Sun, Moon, TrendingUp, Calendar, ChevronRight, User as UserIcon, Coins, PieChart as PieChartIcon, Briefcase, ArrowUpRight, PlusCircle, Trash2, FileCheck, FileMinus, Edit, Lock, Unlock, FileSpreadsheet, DollarSign, Eye, MoreHorizontal, CheckCircle, XCircle, ListTodo, Folder, RefreshCcw, Filter, XSquare, ChevronDown, Building2, Layers, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid, Sector } from 'recharts';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { useLanguage } from '../contexts/LanguageProvider';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNotification } from '../contexts/NotificationContext';
import { uploadFile } from '../services/supabase'; 
import { useTheme } from '../contexts/ThemeContext';
import * as XLSX from 'xlsx';

// --- CONSTANTS ---
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// --- PIE CHART ACTIVE SHAPE (Advanced Animation) ---
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-xl font-black drop-shadow-sm">
        {payload.name.substring(0, 10)}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-sm font-bold dark:fill-white">{`${value.toLocaleString()}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-xs">
        {`(Rate ${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

export const Dashboard: React.FC = () => {
  // ... (All existing logic, derived data, helper functions remain exactly the same until we reach the Modal rendering) ...
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { advances, expenses, addExpense, editExpense, addAdvance, updateExpenseStatus, toggleExpenseEditability, updateAdvanceStatus, deleteAdvance, projects, tasks, users, clients, redirectTarget, clearRedirectTarget, getStableAvatar } = useData(); 
  const { showNotification } = useNotification();

  const [dashStartDate, setDashStartDate] = useState('');
  const [dashEndDate, setDashEndDate] = useState('');
  const [chartFilterClient, setChartFilterClient] = useState('ALL');
  const [chartFilterProject, setChartFilterProject] = useState('ALL');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsType, setDetailsType] = useState<'LIQUIDITY_BREAKDOWN' | 'SPENT' | 'PENDING' | 'REJECTED_EXPENSES' | 'PROJECTS' | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null); 
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [activePieIndex, setActivePieIndex] = useState(0);
  const [approvingAdvanceId, setApprovingAdvanceId] = useState<string | null>(null);
  const [approvalReceiptUrl, setApprovalReceiptUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionType, setRejectionType] = useState<'EXPENSE' | 'ADVANCE' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const approvalFileRef = useRef<HTMLInputElement>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
      id: null as string | null,
      clientId: '',
      projectId: '',
      taskId: '',
      advanceId: '',
      description: '',
      notes: '',
      imagePreview: null as string | null,
      file: null as File | null,
      type: 'FIXED' as 'FIXED' | 'INVOICE',
      fixedAmount: '', 
      additionalAmount: '', 
      invoiceItems: [{ id: '1', itemName: '', quantity: 0, unitPrice: 0, total: 0 }] as InvoiceItem[]
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [advanceForm, setAdvanceForm] = useState({
      type: 'GENERAL' as 'GENERAL' | 'PROJECT',
      clientId: '',
      projectId: '',
      userId: '',
      amount: '',
      description: ''
  });
  const [isAdvanceSubmitting, setIsAdvanceSubmitting] = useState(false);

  useEffect(() => {
    const isAnyModalOpen = showExpenseModal || showAdvanceModal || showDetailsModal || selectedExpense || selectedAdvance || previewImage;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden'; 
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
    }
    return () => { 
        document.body.style.overflow = 'auto'; 
        document.body.style.height = 'auto';
    };
  }, [showExpenseModal, showAdvanceModal, showDetailsModal, selectedExpense, selectedAdvance, previewImage]);

  useEffect(() => {
    if (selectedExpense || showDetailsModal || showExpenseModal || showAdvanceModal) {
      const handlePopState = () => {
        setSelectedExpense(null);
        setShowDetailsModal(false);
        setShowExpenseModal(false);
        setShowAdvanceModal(false);
      };
      window.history.pushState({ modalOpen: true }, '', '');
      window.addEventListener('popstate', handlePopState);
      return () => { window.removeEventListener('popstate', handlePopState); };
    }
  }, [selectedExpense, showDetailsModal, showExpenseModal, showAdvanceModal]);

  const closeWithBack = () => { window.history.back(); };
  const isAdmin = user?.role === UserRole.ADMIN;

  const canTakeAction = (requestUserId: string) => {
      if (!user) return false;
      if (user.role === UserRole.ADMIN) return true;
      if (user.role === UserRole.MAIN_CUSTODY) {
          const reqUser = users.find(u => u.id === requestUserId);
          return reqUser?.managerId === user.id;
      }
      return false;
  };

  const greeting = useMemo(() => {
      const hour = new Date().getHours();
      let text = t('welcome');
      let icon = Sun;
      if (hour < 12) { text = language === 'ar' ? 'صباح الخير' : 'Good Morning'; icon = Sun; }
      else if (hour < 18) { text = language === 'ar' ? 'مساء الخير' : 'Good Afternoon'; icon = Sun; }
      else { text = language === 'ar' ? 'تصبح على خير' : 'Good Evening'; icon = Moon; }
      return { text, icon };
  }, [language, t]);
  const GreetingIcon = greeting.icon;

  const toggleNode = (id: string) => {
      const newSet = new Set(expandedNodes);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedNodes(newSet);
  };

  // ... (All other handlers: openAddExpense, openEditExpense, calculateTotalExpense, handleFileChange, etc. copied from previous file exactly) ...
  // To save space, assuming previous handlers are here unchanged.
  const openAddExpense = () => {
      setExpenseForm({
          id: null, clientId: '', projectId: '', taskId: '', advanceId: '',
          description: '', notes: '', imagePreview: null, file: null,
          type: 'FIXED', fixedAmount: '', additionalAmount: '',
          invoiceItems: [{ id: '1', itemName: '', quantity: 0, unitPrice: 0, total: 0 }]
      });
      setShowExpenseModal(true);
  };

  const openEditExpense = (expense: Expense) => {
       const task = tasks.find(t => t.id === expense.taskId);
       const advance = advances.find(a => a.id === expense.advanceId);
       const projId = task ? task.projectId : (advance ? advance.projectId : '');
       const proj = projects.find(p => p.id === projId);
       
       setExpenseForm({
          id: expense.id,
          clientId: proj ? proj.clientId : '',
          projectId: projId || '',
          taskId: expense.taskId || '',
          advanceId: expense.advanceId,
          description: expense.description,
          notes: expense.notes || '',
          imagePreview: expense.imageUrl || null,
          file: null,
          type: expense.isInvoice ? 'INVOICE' : 'FIXED',
          fixedAmount: expense.isInvoice ? '' : expense.amount.toString(),
          additionalAmount: expense.additionalAmount ? expense.additionalAmount.toString() : '',
          invoiceItems: expense.invoiceItems || [{ id: '1', itemName: '', quantity: 0, unitPrice: 0, total: 0 }]
      });
      setShowExpenseModal(true);
  };

  const calculateTotalExpense = () => {
      if (expenseForm.type === 'FIXED') {
          return parseFloat(expenseForm.fixedAmount || '0');
      } else {
          const itemsTotal = expenseForm.invoiceItems.reduce((sum, item) => sum + item.total, 0);
          const additional = parseFloat(expenseForm.additionalAmount || '0');
          return itemsTotal + additional;
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          const url = await uploadFile(file);
          setIsUploading(false);
          if(url) {
              setExpenseForm(prev => ({ ...prev, imagePreview: url }));
          }
      }
  };

  const handleInvoiceItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
      const newItems = [...expenseForm.invoiceItems];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
          newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
      }
      setExpenseForm(prev => ({ ...prev, invoiceItems: newItems }));
  };

  const handleAddInvoiceItem = () => {
      setExpenseForm(prev => ({
          ...prev,
          invoiceItems: [...prev.invoiceItems, { id: Date.now().toString(), itemName: '', quantity: 0, unitPrice: 0, total: 0 }]
      }));
  };

  const handleRemoveInvoiceItem = (index: number) => {
      const newItems = [...expenseForm.invoiceItems];
      newItems.splice(index, 1);
      setExpenseForm(prev => ({ ...prev, invoiceItems: newItems }));
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsUploading(true);
      try {
          const amount = calculateTotalExpense();
          const expenseData: any = {
              advanceId: expenseForm.advanceId,
              taskId: expenseForm.taskId || undefined,
              amount: amount,
              description: expenseForm.description,
              notes: expenseForm.notes,
              imageUrl: expenseForm.imagePreview || undefined,
              isInvoice: expenseForm.type === 'INVOICE',
              invoiceItems: expenseForm.type === 'INVOICE' ? expenseForm.invoiceItems : undefined,
              additionalAmount: expenseForm.type === 'INVOICE' ? parseFloat(expenseForm.additionalAmount || '0') : undefined
          };

          if (expenseForm.id) {
              await editExpense(expenseForm.id, expenseData);
          } else {
              await addExpense(expenseData);
          }
          setShowExpenseModal(false);
      } catch (error) {
          console.error(error);
          showNotification('Error saving expense', 'error');
      } finally {
          setIsUploading(false);
      }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAdvanceSubmitting(true);
      try {
          await addAdvance({
              projectId: advanceForm.projectId || undefined,
              userId: user?.role === UserRole.ADMIN ? advanceForm.userId : user!.id,
              amount: parseFloat(advanceForm.amount),
              description: advanceForm.description
          });
          setShowAdvanceModal(false);
          setAdvanceForm({ type: 'GENERAL', clientId: '', projectId: '', userId: '', amount: '', description: '' });
      } catch (error) {
          console.error(error);
      } finally {
          setIsAdvanceSubmitting(false);
      }
  };

  const handleUpdateAdvanceStatus = async (id: string, status: AdvanceStatus) => {
      if (status === AdvanceStatus.OPEN) {
          setApprovingAdvanceId(id);
          setApprovalReceiptUrl(null);
      } else {
          await updateAdvanceStatus(id, status);
      }
  };

  const handleAdvanceApprovalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsApproving(true);
          const url = await uploadFile(file);
          setApprovalReceiptUrl(url);
          setIsApproving(false);
      }
  };

  const confirmAdvanceApproval = async () => {
      if (approvingAdvanceId && approvalReceiptUrl) {
          await updateAdvanceStatus(approvingAdvanceId, AdvanceStatus.OPEN, undefined, approvalReceiptUrl);
          setApprovingAdvanceId(null);
          setApprovalReceiptUrl(null);
      }
  };

  const handleUpdateExpenseStatus = async (id: string, status: ExpenseStatus) => {
      await updateExpenseStatus(id, status);
  };

  const exportExpenseToExcel = (expense: Expense) => {
      const wb = XLSX.utils.book_new();
      const data = [
          ["Expense Report", expense.id],
          ["Date", expense.date],
          ["Description", expense.description],
          ["Amount", expense.amount],
          ["User", users.find(u => u.id === expense.userId)?.name],
          ["Status", expense.status],
          ["Notes", expense.notes || ""]
      ];
      if (expense.isInvoice && expense.invoiceItems) {
          data.push([]);
          data.push(["Invoice Items"]);
          data.push(["Item", "Qty", "Price", "Total"]);
          expense.invoiceItems.forEach(item => {
              data.push([item.itemName, item.quantity, item.unitPrice, item.total]);
          });
          data.push(["Additional", expense.additionalAmount || 0]);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Expense");
      XLSX.writeFile(wb, `Expense_${expense.id}.xlsx`);
  };

  const renderRejectionInput = (id: string, type: 'EXPENSE' | 'ADVANCE') => (
      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50 animate-fade-in">
          <input 
              type="text" 
              value={rejectionReason} 
              onChange={(e) => setRejectionReason(e.target.value)} 
              placeholder={t('rejectionReasonPlaceholder')}
              className="w-full p-2 mb-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg text-sm outline-none"
          />
          <div className="flex gap-2">
              <button 
                  onClick={async () => {
                      if (type === 'EXPENSE') await updateExpenseStatus(id, ExpenseStatus.REJECTED, rejectionReason);
                      else await updateAdvanceStatus(id, AdvanceStatus.REJECTED, rejectionReason);
                      setRejectingId(null);
                      setRejectionReason('');
                  }}
                  disabled={!rejectionReason}
                  className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                  {t('confirm')}
              </button>
              <button 
                  onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-1.5 rounded-lg text-xs font-bold"
              >
                  {t('cancel')}
              </button>
          </div>
      </div>
  );

  // --- Derived Data ---
  const activeProjectIds = useMemo(() => projects.filter(p => p.status === 'ACTIVE').map(p => p.id), [projects]);

  const availableProjects = useMemo(() => {
      if (!expenseForm.clientId) return [];
      return projects.filter(p => p.clientId === expenseForm.clientId && p.status === 'ACTIVE');
  }, [projects, expenseForm.clientId]);

  const availableTasks = useMemo(() => {
      if (!expenseForm.projectId) return [];
      return tasks.filter(t => t.projectId === expenseForm.projectId);
  }, [tasks, expenseForm.projectId]);

  const availableAdvances = useMemo(() => {
      if (!user) return [];
      let list = advances.filter(a => a.userId === user.id && a.status === AdvanceStatus.OPEN && (!a.projectId || activeProjectIds.includes(a.projectId)));
      if (expenseForm.projectId) {
          list = list.filter(a => !a.projectId || a.projectId === expenseForm.projectId);
      }
      return list;
  }, [advances, user, expenseForm.projectId, activeProjectIds]);

  const advanceProjects = useMemo(() => {
      if (!advanceForm.clientId) return [];
      return projects.filter(p => p.clientId === advanceForm.clientId && p.status === 'ACTIVE');
  }, [projects, advanceForm.clientId]);

  const usersForSelectedProject = useMemo(() => {
      if (advanceForm.type === 'GENERAL') return users.filter(u => !u.isDeleted);
      if (advanceForm.projectId) {
          const project = projects.find(p => p.id === advanceForm.projectId);
          if (!project) return [];
          return users.filter(u => {
              if (u.role === UserRole.ADMIN) return true;
              if (project.assignedEngineers?.includes(u.id)) return true;
              return false;
          });
      }
      return [];
  }, [advanceForm.type, advanceForm.projectId, projects, users]);

  // --- Redirect Handling ---
  useEffect(() => {
    if (redirectTarget && redirectTarget.page === 'dashboard' && redirectTarget.itemId && !showExpenseModal && !showAdvanceModal) {
        if (redirectTarget.itemType === 'EXPENSE') {
            const targetExp = expenses.find(e => e.id === redirectTarget.itemId);
            if (targetExp) {
                clearRedirectTarget(); 
                if (targetExp.status === ExpenseStatus.PENDING) {
                    setDetailsType('PENDING');
                    setShowDetailsModal(true);
                } else if (targetExp.status === ExpenseStatus.REJECTED) {
                    if (targetExp.userId === user?.id) {
                        setDetailsType('REJECTED_EXPENSES');
                        setShowDetailsModal(true);
                    } else {
                        setSelectedExpense(targetExp);
                    }
                } else {
                    setSelectedExpense(targetExp);
                }
            }
        } else if (redirectTarget.itemType === 'ADVANCE') {
            const targetAdv = advances.find(a => a.id === redirectTarget.itemId);
            if (targetAdv) {
                clearRedirectTarget();
                setSelectedAdvance(targetAdv);
            }
        }
    }
  }, [redirectTarget, expenses, advances, showExpenseModal, showAdvanceModal]); 

  // --- Data Calculations ---
  const isInRange = (dateStr: string) => {
      if (!dashStartDate && !dashEndDate) return true;
      const d = new Date(dateStr).getTime();
      const start = dashStartDate ? new Date(dashStartDate).getTime() : -Infinity;
      const end = dashEndDate ? new Date(dashEndDate).getTime() : Infinity;
      return d >= start && d <= end;
  };
  const hasDateFilter = !!dashStartDate || !!dashEndDate;

  // 1. Trend Data
  const trendData = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    const allDates: string[] = [];
    let curr = new Date(sixMonthsAgo);
    while (curr <= today) {
        allDates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const expenseMap: Record<string, number> = {};
    expenses.forEach(e => {
        if (!isAdmin && e.userId !== user?.id) return;
        if (e.status === ExpenseStatus.APPROVED) {
            const advance = advances.find(a => a.id === e.advanceId);
            if (!advance || !advance.projectId || activeProjectIds.includes(advance.projectId)) {
                expenseMap[e.date] = (expenseMap[e.date] || 0) + e.amount;
            }
        }
    });

    return allDates.map(dateStr => {
        const d = new Date(dateStr);
        const showLabel = d.getDate() === 1;
        const name = showLabel ? (d.getMonth() + 1).toString() : ''; 
        return { fullDate: dateStr, name: name, amount: expenseMap[dateStr] || 0 };
    });
  }, [expenses, t, activeProjectIds, advances, user, isAdmin]);

  // 2. Liquidity & Spent
  const totalLiquidity = useMemo(() => 
      advances
        .filter(a => a.status === AdvanceStatus.OPEN)
        .filter(a => isAdmin || a.userId === user?.id)
        .filter(a => !a.projectId || activeProjectIds.includes(a.projectId))
        .reduce((sum, a) => sum + a.remainingAmount, 0), 
  [advances, activeProjectIds, user, isAdmin]);

  const totalApprovedExpenses = useMemo(() => 
      expenses
        .filter(e => e.status === ExpenseStatus.APPROVED && isInRange(e.date))
        .filter(e => isAdmin || e.userId === user?.id)
        .filter(e => {
            const adv = advances.find(a => a.id === e.advanceId);
            return !adv || !adv.projectId || activeProjectIds.includes(adv.projectId);
        })
        .reduce((sum, e) => sum + e.amount, 0), 
  [expenses, dashStartDate, dashEndDate, advances, activeProjectIds, user, isAdmin]);
  
  const pendingRequestsCount = useMemo(() => {
      return expenses.filter(e => e.status === ExpenseStatus.PENDING && canTakeAction(e.userId)).length 
           + advances.filter(a => a.status === AdvanceStatus.PENDING && canTakeAction(a.userId)).length;
  }, [expenses, advances, user]);

  const rejectedExpensesCount = useMemo(() => {
      if (!user) return 0;
      return expenses.filter(e => e.userId === user.id && e.status === ExpenseStatus.REJECTED).length;
  }, [expenses, user]);

  // 3. Pie Chart
  const pieChartData = useMemo(() => {
      const spendingByProject: Record<string, number> = {};
      let source = expenses.filter(e => e.status === ExpenseStatus.APPROVED);
      if (hasDateFilter) source = source.filter(e => isInRange(e.date));
      if (!isAdmin) source = source.filter(e => e.userId === user?.id);
      source = source.filter(e => {
          const adv = advances.find(a => a.id === e.advanceId);
          return !adv || !adv.projectId || activeProjectIds.includes(adv.projectId);
      });
      if (chartFilterClient !== 'ALL') {
          const clientProjectIds = projects.filter(p => p.clientId === chartFilterClient && p.status === 'ACTIVE').map(p => p.id);
          source = source.filter(e => {
              const task = tasks.find(t => t.id === e.taskId);
              if (task) return clientProjectIds.includes(task.projectId);
              const adv = advances.find(a => a.id === e.advanceId);
              return adv && adv.projectId && clientProjectIds.includes(adv.projectId);
          });
      }
      if (chartFilterProject !== 'ALL') {
          source = source.filter(e => {
              const task = tasks.find(t => t.id === e.taskId);
              if (task) return task.projectId === chartFilterProject;
              const adv = advances.find(a => a.id === e.advanceId);
              return adv && adv.projectId === chartFilterProject;
          });
      }
      source.forEach(exp => {
          let keyName = t('generalAdvanceNoProject');
          if (chartFilterProject !== 'ALL') {
              const taskItem = tasks.find(tsk => tsk.id === exp.taskId);
              keyName = taskItem ? taskItem.name : t('generalAdvanceNoProject');
          } else {
              const adv = advances.find(a => a.id === exp.advanceId);
              if (adv && adv.projectId) {
                  const p = projects.find(proj => proj.id === adv.projectId);
                  if(p) keyName = p.name;
              }
          }
          spendingByProject[keyName] = (spendingByProject[keyName] || 0) + exp.amount;
      });
      const data = Object.entries(spendingByProject).map(([name, value]) => ({ name, value }));
      return data.sort((a, b) => b.value - a.value);
  }, [expenses, advances, projects, tasks, hasDateFilter, dashStartDate, dashEndDate, chartFilterClient, chartFilterProject, activeProjectIds, t, isAdmin, user]);

  // 4. Tree Data
  const treeData = useMemo(() => {
      let filteredExp = expenses.filter(e => isInRange(e.date));
      if (!isAdmin) filteredExp = filteredExp.filter(e => e.userId === user?.id);
      return clients.map(client => {
          const clientProjects = projects.filter(p => p.clientId === client.id && p.status === 'ACTIVE');
          const projectsWithData = clientProjects.map(proj => {
              const projTasks = tasks.filter(t => t.projectId === proj.id);
              const tasksWithData = projTasks.map(task => {
                  const taskExpenses = filteredExp.filter(e => e.taskId === task.id);
                  if (taskExpenses.length === 0) return null;
                  return { ...task, expenses: taskExpenses };
              }).filter(Boolean) as any[];
              if (tasksWithData.length === 0) return null;
              return { ...proj, tasks: tasksWithData };
          }).filter(Boolean) as any[];
          if (projectsWithData.length === 0) return null;
          return { ...client, projects: projectsWithData };
      }).filter(Boolean) as any[];
  }, [clients, projects, tasks, expenses, dashStartDate, dashEndDate, isAdmin, user]);

  // ... (JSX mostly same, except for the Expense Detail Modal logic below) ...

  return (
    <div className="space-y-8 animate-fade-in pb-20 relative">
       {/* ... (Banner, Quick Actions, Stats Cards, Tree/Pie Charts, Add Modal - All Same) ... */}
       {/* Keeping the Dashboard layout structure */}
       {/* 1. Greeting Banner */}
      <div className="relative rounded-[2rem] p-8 md:p-10 shadow-2xl overflow-hidden group">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900"></div>
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000"></div>
         <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl -ml-16 -mb-16 animate-pulse-soft"></div>
         <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-8">
            <div className="flex-1 text-center xl:text-start">
               <div className="inline-flex items-center gap-2 text-blue-200 mb-3 font-semibold bg-white/10 w-fit px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm mx-auto xl:mx-0"><GreetingIcon size={18} className="text-yellow-300" /><span>{greeting.text}</span></div>
               <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-md">{user?.name}</h1>
               <p className="text-slate-300 text-lg flex items-center justify-center xl:justify-start gap-2 font-medium"><Briefcase size={20} className="text-blue-400" />{user?.jobTitle || t('roleMainCustody')}</p>
            </div>
            {/* Chart Area */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/10 w-full xl:w-[480px] h-64 shadow-inner overflow-hidden flex flex-col">
                <div className="text-white/70 text-xs font-bold mb-2 flex justify-between uppercase tracking-wider"><span>{t('dailyExpenseFlow')}</span> <TrendingUp size={16}/></div>
                <div className="flex-1 w-full min-h-0 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6}/>
                                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" hide={false} axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 'bold'}} interval={0} />
                            <Tooltip contentStyle={{background: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff'}} itemStyle={{color: '#93c5fd'}} labelStyle={{color: '#cbd5e1'}} labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) return payload[0].payload.fullDate;
                                return label;
                            }}/>
                            <Area type="monotone" dataKey="amount" stroke="#93c5fd" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" activeDot={{r: 6, strokeWidth: 0, fill: "#fff"}} animationDuration={1500} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
         </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(user?.role === UserRole.ADMIN || user?.role === UserRole.MAIN_CUSTODY) && (
                  <button onClick={() => setShowAdvanceModal(true)} className="relative flex items-center justify-between p-6 rounded-3xl overflow-hidden group shadow-lg shadow-indigo-200/50 dark:shadow-none bg-gradient-to-br from-indigo-600 to-blue-700 hover:scale-[1.02] transition-transform active:scale-95">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-600 transition-colors"></div>
                      <div className="relative z-10 text-start"><h3 className="text-xl font-bold text-white mb-1">{user.role === UserRole.ADMIN ? t('issueNewAdvance') : t('newAdvanceRequest')}</h3><p className="text-blue-200 text-xs">{t('easyFinanceRequest')}</p></div>
                      <div className="relative z-10 bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><Wallet size={28} className="text-white" /></div>
                  </button>
              )}
              <button onClick={openAddExpense} className="relative flex items-center justify-between p-6 rounded-3xl overflow-hidden group shadow-lg shadow-orange-200/50 dark:shadow-none bg-gradient-to-br from-orange-500 to-rose-600 hover:scale-[1.02] transition-transform active:scale-95">
                  <div className="relative z-10 text-start"><h3 className="text-xl font-bold text-white mb-1">{t('addExpense')}</h3><p className="text-orange-200 text-xs">{t('newExpenseTitle')}</p></div>
                  <div className="relative z-10 bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ArrowUpRight size={28} className="text-white" /></div>
              </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center min-w-[300px]">
              <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Filter size={14} /> {t('systemFilter')}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input type="date" value={dashStartDate} onChange={e => setDashStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none w-full p-2" />
                  <span className="text-slate-300">|</span>
                  <input type="date" value={dashEndDate} onChange={e => setDashEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none w-full p-2" />
                  {(dashStartDate || dashEndDate) && <button onClick={() => { setDashStartDate(''); setDashEndDate(''); }} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"><XSquare size={16} /></button>}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div onClick={() => { setDetailsType('LIQUIDITY_BREAKDOWN'); setShowDetailsModal(true); }} className="glass-card p-6 rounded-[1.75rem] relative overflow-hidden group transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1">
              <div className="relative z-10 flex items-center justify-between mb-4"><div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 shadow-sm"><Wallet size={24} /></div></div>
              <div className="relative z-10"><h4 className="text-2xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">{totalLiquidity.toLocaleString()} <span className="text-xs font-bold text-slate-400">{t('currency')}</span></h4><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('currentLiquidity')}</p></div>
              <ChevronRight className="absolute bottom-6 left-6 text-slate-300 group-hover:text-emerald-500 transition-colors z-10 rtl:rotate-180" size={20} />
              <Wallet className="watermark-icon" size={140} />
          </div>

          <div className="glass-card p-6 rounded-[1.75rem] relative overflow-hidden group transition-all duration-300">
              <div className="relative z-10 flex items-center justify-between mb-4"><div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 shadow-sm"><TrendingUp size={24} /></div></div>
              <div className="relative z-10"><h4 className="text-2xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">{totalApprovedExpenses.toLocaleString()} <span className="text-xs font-bold text-slate-400">{t('currency')}</span></h4><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{hasDateFilter ? t('periodExpenses') : t('approvedActual')}</p></div>
              <TrendingUp className="watermark-icon" size={140} />
          </div>

          <div onClick={() => { setDetailsType('PENDING'); setShowDetailsModal(true); }} className="glass-card p-6 rounded-[1.75rem] relative overflow-hidden group transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1">
              <div className="relative z-10 flex items-center justify-between mb-4"><div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 shadow-sm"><AlertCircle size={24} /></div><span className="text-xs font-black px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500">{pendingRequestsCount} {t('pendingRequestsCount')}</span></div>
              <div className="relative z-10"><h4 className="text-2xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">{t('pendingRequests')}</h4><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('needsAttention')}</p></div>
              <ChevronRight className="absolute bottom-6 left-6 text-slate-300 group-hover:text-amber-500 transition-colors z-10 rtl:rotate-180" size={20} />
              <AlertCircle className="watermark-icon" size={140} />
          </div>

          <div onClick={() => { setDetailsType('REJECTED_EXPENSES'); setShowDetailsModal(true); }} className="glass-card p-6 rounded-[1.75rem] relative overflow-hidden group transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
              <div className="relative z-10 flex items-center justify-between mb-4"><div className="p-3.5 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 shadow-sm"><AlertTriangle size={24} /></div><span className="text-xs font-black px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">{rejectedExpensesCount}</span></div>
              <div className="relative z-10"><h4 className="text-2xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">{t('underRevision')}</h4><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('rejectedExpensesDetails')}</p></div>
              <ChevronRight className="absolute bottom-6 left-6 text-slate-300 group-hover:text-red-500 transition-colors z-10 rtl:rotate-180" size={20} />
              <AlertTriangle className="watermark-icon text-red-500" size={140} />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Tree View */}
        <div className="lg:col-span-2 glass-card rounded-[1.75rem] p-6 md:p-8 flex flex-col relative overflow-hidden h-[600px]">
            <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3"><div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><Layers size={24} /></div>{t('expenseTree')}</h2>
            </div>
            
            <div className="overflow-y-auto overflow-x-auto custom-scrollbar flex-1 pr-2 relative z-10 space-y-3">
                <div className="min-w-[500px]">
                    {treeData.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-medium">{t('noDataMatching')}</div>
                    ) : (
                        treeData.map((client: any) => (
                            <div key={client.id} className="border border-slate-100 dark:border-slate-700/50 rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-800/30 mb-3 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                <div 
                                    className="flex items-center p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    onClick={() => toggleNode(client.id)}
                                >
                                    {expandedNodes.has(client.id) ? <ChevronDown size={18} className="text-indigo-500"/> : <ChevronRight size={18} className="text-slate-400 rtl:rotate-180"/>}
                                    <Building2 size={20} className="text-indigo-500 mx-2" />
                                    <span className="font-bold text-slate-800 dark:text-white">{client.name}</span>
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded ml-auto">{client.projects.length} {t('projects')}</span>
                                </div>

                                {expandedNodes.has(client.id) && client.projects.map((proj: any) => (
                                    <div key={proj.id} className="ml-4 rtl:mr-4 border-l-2 rtl:border-l-0 rtl:border-r-2 border-indigo-100 dark:border-slate-700/50 pl-4 rtl:pr-4 py-1">
                                        <div 
                                            className="flex items-center p-2.5 cursor-pointer hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                                            onClick={() => toggleNode(proj.id)}
                                        >
                                            {expandedNodes.has(proj.id) ? <ChevronDown size={16} className="text-blue-500"/> : <ChevronRight size={16} className="text-slate-400 rtl:rotate-180"/>}
                                            <Briefcase size={16} className="text-blue-500 mx-2" />
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{proj.name}</span>
                                        </div>

                                        {expandedNodes.has(proj.id) && proj.tasks.map((task: any) => (
                                            <div key={task.id} className="ml-4 rtl:mr-4 border-l-2 rtl:border-l-0 rtl:border-r-2 border-blue-100 dark:border-slate-700/50 pl-4 rtl:pr-4 py-1">
                                                <div 
                                                    className="flex items-center p-2 cursor-pointer hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10"
                                                    onClick={() => toggleNode(task.id)}
                                                >
                                                    {expandedNodes.has(task.id) ? <ChevronDown size={14} className="text-emerald-500"/> : <ChevronRight size={14} className="text-slate-400 rtl:rotate-180"/>}
                                                    <ListTodo size={14} className="text-emerald-500 mx-2" />
                                                    <span className="font-medium text-xs text-slate-600 dark:text-slate-300">{task.name}</span>
                                                </div>

                                                {expandedNodes.has(task.id) && (
                                                    <div className="grid gap-2 mt-1 mb-2 pr-4 rtl:pl-4">
                                                        {task.expenses.map((exp: any) => (
                                                            <div 
                                                                key={exp.id} 
                                                                onClick={() => setSelectedExpense(exp)}
                                                                className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {exp.imageUrl ? (
                                                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"><img src={exp.imageUrl} className="w-full h-full object-cover"/></div>
                                                                    ) : <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300"><ImageIcon size={14}/></div>}
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 dark:text-white group-hover:text-blue-600">{exp.description}</p>
                                                                        <p className="text-[10px] text-slate-400">{exp.date}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-white">{exp.amount.toLocaleString()}</span>
                                                                    <StatusBadge status={exp.status} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Right: Pie Chart */}
        <div className="glass-card rounded-[1.75rem] p-6 md:p-8 flex flex-col justify-between relative overflow-hidden h-[600px]">
            <div className="relative z-10">
                <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-3"><div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-xl text-purple-600 dark:text-purple-400 shadow-sm"><PieChartIcon size={24} /></div>{t('expensesDistribution')}</h2>
                <div className="flex gap-2 mb-2">
                    <select value={chartFilterClient} onChange={e => {setChartFilterClient(e.target.value); setChartFilterProject('ALL');}} className="text-[10px] p-1.5 rounded-lg border bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none w-1/2">
                        <option value="ALL">{t('allClients')}</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={chartFilterProject} onChange={e => setChartFilterProject(e.target.value)} className="text-[10px] p-1.5 rounded-lg border bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none w-1/2">
                        <option value="ALL">{t('allProjects')}</option>
                        {projects.filter(p => chartFilterClient === 'ALL' || p.clientId === chartFilterClient).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="h-[360px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                activeIndex={activePieIndex}
                                activeShape={renderActiveShape}
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                onMouseEnter={(_, index) => setActivePieIndex(index)}
                                paddingAngle={4}
                                cornerRadius={6}
                                {...{ activeIndex: activePieIndex } as any}
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.15))'}} stroke="none" />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="space-y-2.5 mt-2 overflow-y-auto pr-2 custom-scrollbar relative z-10 flex-1">
                {pieChartData.length > 0 ? pieChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div><span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[120px] text-xs">{item.name}</span></div><span className="font-black text-slate-800 dark:text-white px-2 py-0.5 rounded-lg text-xs">{item.value.toLocaleString()}</span>
                    </div>
                )) : <p className="text-center text-slate-400 text-xs py-4">{t('noExpensesRecorded')}</p>}
            </div>
        </div>
      </div>

      {/* --- ADD/EDIT EXPENSE MODAL --- */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={closeWithBack}>
          <div className="bg-white dark:bg-slate-900 w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border-t border-white/20 md:border md:border-white/20 overflow-hidden relative modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{expenseForm.id ? t('editExpenseTitle') : t('newExpenseTitle')}</h3>
                    <p className="text-xs text-slate-400 font-medium">{t('enterInvoiceDetails')}</p>
                </div>
                <button onClick={closeWithBack} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm active:scale-90"><X size={22} /></button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30 dark:bg-slate-900/30">
                <form onSubmit={handleExpenseSubmit} className="space-y-6">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('filterClient')}</label><div className="relative"><select required value={expenseForm.clientId} onChange={(e) => setExpenseForm({...expenseForm, clientId: e.target.value, projectId: '', taskId: ''})} disabled={!!expenseForm.id} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all"><option value="">{t('selectClient')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Folder size={16}/></div></div></div>
                {/* ... (Rest of Expense Form Fields - kept same as before to save space in output, logic unchanged) ... */}
                {/* ... Assume standard expense form logic here ... */}
                {expenseForm.clientId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectProject')}</label><div className="relative"><select required value={expenseForm.projectId} onChange={(e) => setExpenseForm({...expenseForm, projectId: e.target.value, taskId: ''})} disabled={!!expenseForm.id} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all"><option value="">{t('selectProject')}</option>{/* availableProjects map */}{projects.filter(p => p.clientId === expenseForm.clientId && p.status === 'ACTIVE').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Briefcase size={16}/></div></div></div>)}
                {expenseForm.projectId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('filterTask')}</label><div className="relative"><select required value={expenseForm.taskId} onChange={(e) => setExpenseForm({...expenseForm, taskId: e.target.value})} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all"><option value="">{t('selectTask')}</option>{/* availableTasks map */}{tasks.filter(t => t.projectId === expenseForm.projectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><ListTodo size={16}/></div></div></div>)}
                {expenseForm.taskId && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('selectAdvance')}</label><div className="relative"><select required value={expenseForm.advanceId} onChange={(e) => setExpenseForm({...expenseForm, advanceId: e.target.value})} disabled={!!expenseForm.id} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all"><option value="">{t('selectAdvancePlaceholder')}</option>{/* availableAdvances map */}{advances.filter(a => a.userId === user?.id && a.status === AdvanceStatus.OPEN).map(adv => <option key={adv.id} value={adv.id}>{adv.description} ({t('advanceBalance')}: {adv.remainingAmount.toLocaleString()})</option>)}</select><div className="absolute left-3 top-4 pointer-events-none text-slate-400"><Wallet size={16}/></div></div></div>)}
                
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('expenseDesc')}</label><input required type="text" value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} className="input-modern w-full p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all" placeholder={language === 'ar' ? "مثال: فاتورة توريد مواد" : "e.g., Material supply invoice"} /></div>
                <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center shadow-inner"><button type="button" onClick={() => setExpenseForm({...expenseForm, type: 'FIXED'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${expenseForm.type === 'FIXED' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-md transform scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}><FileMinus size={16} /> {t('expenseTypeFixed')}</button><button type="button" onClick={() => setExpenseForm({...expenseForm, type: 'INVOICE'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${expenseForm.type === 'INVOICE' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-md transform scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}><FileCheck size={16} /> {t('expenseTypeInvoice')}</button></div>
                
                {expenseForm.type === 'FIXED' ? (
                    <div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('amount')} ({t('currency')})</label><input required type="number" value={expenseForm.fixedAmount} onChange={(e) => setExpenseForm({...expenseForm, fixedAmount: e.target.value})} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-white text-3xl font-black outline-none font-mono text-center border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 transition-all shadow-sm" placeholder="0.00" /></div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('invoiceItems')}</label>
                        {expenseForm.invoiceItems.map((item, index) => (
                            <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="hidden md:flex gap-2 items-center">
                                    <input type="text" placeholder={t('itemName')} className="input-modern flex-[2] p-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium outline-none text-slate-800 dark:text-white" value={item.itemName} onChange={(e) => handleInvoiceItemChange(index, 'itemName', e.target.value)}/>
                                    <input type="number" placeholder={t('quantity')} className="input-modern w-20 p-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-bold outline-none text-center text-slate-800 dark:text-white" value={item.quantity === 0 ? '' : item.quantity} onChange={(e) => handleInvoiceItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}/>
                                    <input type="number" placeholder={t('unitPrice')} className="input-modern w-24 p-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-bold outline-none text-center text-slate-800 dark:text-white" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={(e) => handleInvoiceItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}/>
                                    <div className="w-24 p-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-black text-center text-slate-600 dark:text-slate-300">{item.total.toLocaleString()}</div>
                                    <button type="button" onClick={() => handleRemoveInvoiceItem(index)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </div>
                                <div className="md:hidden flex flex-col gap-3">
                                    <input type="text" placeholder={t('itemName')} className="input-modern w-full p-3 bg-white dark:bg-slate-900 rounded-xl text-sm font-medium outline-none text-slate-800 dark:text-white shadow-sm" value={item.itemName} onChange={(e) => handleInvoiceItemChange(index, 'itemName', e.target.value)}/>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><p className="text-[10px] text-slate-400 mb-1 font-bold">{t('quantity')}</p><input type="number" placeholder="0" className="input-modern w-full p-2.5 bg-white dark:bg-slate-900 rounded-xl text-sm font-bold outline-none text-center text-slate-800 dark:text-white shadow-sm" value={item.quantity === 0 ? '' : item.quantity} onChange={(e) => handleInvoiceItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}/></div>
                                        <div className="flex-1"><p className="text-[10px] text-slate-400 mb-1 font-bold">{t('unitPrice')}</p><input type="number" placeholder="0" className="input-modern w-full p-2.5 bg-white dark:bg-slate-900 rounded-xl text-sm font-bold outline-none text-center text-slate-800 dark:text-white shadow-sm" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={(e) => handleInvoiceItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}/></div>
                                        <div className="flex-1"><p className="text-[10px] text-slate-400 mb-1 font-bold">{t('total')}</p><div className="w-full p-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl text-sm font-black text-center text-slate-600 dark:text-slate-300 h-[42px] flex items-center justify-center">{item.total.toLocaleString()}</div></div>
                                        <div className="flex flex-col justify-end"><button type="button" onClick={() => handleRemoveInvoiceItem(index)} className="p-2.5 h-[42px] bg-red-50 text-red-500 rounded-xl transition-colors border border-red-100 dark:border-red-900/30 hover:bg-red-100"><Trash2 size={18}/></button></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddInvoiceItem} className="w-full py-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800 border-dashed flex items-center justify-center gap-2 active:scale-95">
                            <PlusCircle size={18} /> {t('addItem')}
                        </button>
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('additionalValue')}</label>
                            <input type="number" value={expenseForm.additionalAmount} onChange={(e) => setExpenseForm({...expenseForm, additionalAmount: e.target.value})} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-bold outline-none text-center" placeholder="0" />
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1">{t('totalTotal')}</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white">{calculateTotalExpense().toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('additionalNotes')}</label>
                        <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none min-h-[80px] resize-none" placeholder="..." />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('invoiceReceiptImage')}</label>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 min-h-[120px] ${expenseForm.imagePreview ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            {expenseForm.imagePreview ? (
                                <div className="w-full h-32 rounded-lg overflow-hidden relative group">
                                    <img src={expenseForm.imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white text-xs font-bold">{t('changeImage')}</span></div>
                                </div>
                            ) : (
                                <><div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400"><Upload size={20}/></div><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('clickToUpload')}</span></>
                            )}
                        </div>
                    </div>
                </div>
                </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-20">
                <Button type="submit" onClick={handleExpenseSubmit} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all transform active:scale-95" disabled={calculateTotalExpense() <= 0 || isUploading} isLoading={isUploading}>{t('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ... ADD ADVANCE MODAL ... */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={closeWithBack}>
          <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-md md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col overflow-hidden relative modal-overlay" onClick={(e) => e.stopPropagation()}>
            {/* Same Modal Content - Omitted for brevity */}
            {/* ... Form Logic ... */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{user?.role === UserRole.ADMIN ? t('issueNewAdvance') : t('newAdvanceRequest')}</h3>
                    <p className="text-xs text-slate-400 font-medium">{t('easyFinanceRequest')}</p>
                </div>
                <button onClick={closeWithBack} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors shadow-sm active:scale-90"><X size={20} /></button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30 dark:bg-slate-900/30">
                <form onSubmit={handleAdvanceSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                      <button type="button" onClick={() => setAdvanceForm({ ...advanceForm, type: 'GENERAL', clientId: '', projectId: '' })} className={`py-3 rounded-xl text-xs font-bold transition-all ${advanceForm.type === 'GENERAL' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>{t('generalAdvance')}</button>
                      <button type="button" onClick={() => setAdvanceForm({ ...advanceForm, type: 'PROJECT' })} className={`py-3 rounded-xl text-xs font-bold transition-all ${advanceForm.type === 'PROJECT' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-white scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}>{t('projectAdvance')}</button>
                  </div>
                  {advanceForm.type === 'PROJECT' && (
                      <>
                        <div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('filterClient')}</label><div className="relative"><select required value={advanceForm.clientId} onChange={(e) => setAdvanceForm({ ...advanceForm, clientId: e.target.value, projectId: '' })} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none pl-10"><option value="">{t('selectClient')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Folder size={18}/></div></div></div>
                        <div className="animate-fade-in"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('filterProject')}</label><div className="relative"><select required value={advanceForm.projectId} onChange={(e) => setAdvanceForm({ ...advanceForm, projectId: e.target.value })} disabled={!advanceForm.clientId} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50 pl-10"><option value="">{t('selectProject')}</option>{/* advanceProjects map */}{projects.filter(p => p.clientId === advanceForm.clientId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Briefcase size={18}/></div></div></div>
                      </>
                  )}
                  {user?.role === UserRole.ADMIN && (<div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('recipient')}</label><div className="relative"><select required value={advanceForm.userId} onChange={(e) => setAdvanceForm({...advanceForm, userId: e.target.value})} disabled={isAdvanceSubmitting || (advanceForm.type === 'PROJECT' && !advanceForm.projectId)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none appearance-none disabled:opacity-50 pl-10"><option value="">{t('selectUser')}</option>{usersForSelectedProject.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><UserIcon size={18}/></div></div></div>)}
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('description')}</label><input required type="text" value={advanceForm.description} onChange={(e) => setAdvanceForm({...advanceForm, description: e.target.value})} disabled={isAdvanceSubmitting} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-white font-medium outline-none" placeholder={t('advanceDescriptionPlaceholder')} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('advanceValue')}</label><input required type="number" min="1" value={advanceForm.amount} onChange={(e) => setAdvanceForm({...advanceForm, amount: e.target.value})} disabled={isAdvanceSubmitting} className="input-modern w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-white text-3xl font-black outline-none font-mono text-center shadow-sm" placeholder="0" /></div>
                  <div className="pt-2 pb-2 md:pb-0"><Button type="submit" isLoading={isAdvanceSubmitting} className="w-full py-4 text-lg font-bold shadow-xl shadow-blue-500/20 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all">{t('save')}</Button></div>
                </form>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAILS MODAL --- */}
      {showDetailsModal && detailsType && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={closeWithBack}>
              <div className="bg-white dark:bg-slate-900 w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col overflow-hidden border border-white/10 modal-overlay" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-20">
                      <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                          {detailsType === 'LIQUIDITY_BREAKDOWN' && t('liquidityDetails')}
                          {detailsType === 'PENDING' && t('pendingRequestsDetails')}
                          {detailsType === 'REJECTED_EXPENSES' && t('rejectedExpensesTitle')}
                      </h3>
                      <button onClick={closeWithBack} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:text-red-500 shadow-sm active:scale-90"><X size={20} /></button>
                  </div>
                  <div className="overflow-y-auto p-6 flex-1 custom-scrollbar space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                      {detailsType === 'LIQUIDITY_BREAKDOWN' && (
                          <div className="space-y-3">
                              {/* ... Existing Liquidity List ... */}
                              {advances
                                .filter(a => a.status === AdvanceStatus.OPEN)
                                .filter(a => isAdmin || a.userId === user?.id) 
                                .map(adv => (
                                  <div key={adv.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex-1">
                                          <p className="font-bold text-slate-800 dark:text-white text-sm md:text-base">{adv.description}</p>
                                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><UserIcon size={10}/> {users.find(u => u.id === adv.userId)?.name}</p>
                                      </div>
                                      <div className="w-24 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800">{adv.remainingAmount.toLocaleString()}</div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Other detail types (PENDING, REJECTED) */}
                      {detailsType === 'REJECTED_EXPENSES' && (
                          <div className="space-y-4">
                              {/* ... Existing Rejected List ... */}
                              {expenses.filter(e => e.userId === user?.id && e.status === ExpenseStatus.REJECTED).map(exp => (
                                  <div key={exp.id} className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                      <div>
                                          <h4 className="font-bold text-slate-800 dark:text-white">{exp.description}</h4>
                                          <p className="text-sm text-slate-500 mt-1">{exp.date}</p>
                                          {exp.rejectionReason && <p className="text-xs font-bold text-red-600 mt-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900 w-fit">{t('rejectionReason')}: {exp.rejectionReason}</p>}
                                      </div>
                                      <div className="flex gap-2 w-full md:w-auto">
                                          <button onClick={() => openEditExpense(exp)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors w-full md:w-auto shadow-lg shadow-red-500/20 active:scale-95">
                                              <Edit size={16} /> {t('editAndResend')}
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {detailsType === 'PENDING' && (
                          <div className="space-y-4">
                              {/* Advances Pending */}
                              {advances.filter(a => a.status === AdvanceStatus.PENDING && canTakeAction(a.userId)).map(adv => (
                                  <div key={adv.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h4 className="font-bold text-lg text-slate-800 dark:text-white">{adv.description}</h4>
                                              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2"><UserIcon size={14}/> {users.find(u => u.id === adv.userId)?.name}</p>
                                          </div>
                                          <span className="font-mono font-black text-lg text-slate-800 dark:text-white">{adv.amount.toLocaleString()}</span>
                                      </div>
                                      
                                      <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                          {!rejectingId && !approvingAdvanceId && (
                                              <>
                                                <button onClick={() => handleUpdateAdvanceStatus(adv.id, AdvanceStatus.OPEN)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">{t('approve')}</button>
                                                <button onClick={() => {setRejectingId(adv.id); setRejectionType('ADVANCE');}} className="flex-1 bg-white dark:bg-slate-700 text-red-500 border border-red-100 dark:border-slate-600 hover:bg-red-50 py-2.5 rounded-xl font-bold active:scale-95 transition-all">{t('reject')}</button>
                                              </>
                                          )}
                                      </div>
                                      {(rejectingId === adv.id) && renderRejectionInput(adv.id, 'ADVANCE')}
                                      {(approvingAdvanceId === adv.id) && (/* Receipt Upload UI */ <div className="w-full bg-emerald-50 p-4 rounded-xl"><input type="file" onChange={handleAdvanceApprovalUpload}/><button onClick={confirmAdvanceApproval} disabled={!approvalReceiptUrl} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded">{t('confirm')}</button></div>)}
                                  </div>
                              ))}

                              {/* Expenses Pending - ENHANCED VIEW */}
                              {expenses.filter(e => e.status === ExpenseStatus.PENDING && canTakeAction(e.userId)).map(exp => (
                                  <div key={exp.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                  {exp.description}
                                                  {exp.isInvoice && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px]">فاتورة</span>}
                                              </h4>
                                              <p className="text-xs text-slate-500 mt-1">{users.find(u => u.id === exp.userId)?.name}</p>
                                          </div>
                                          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{exp.amount} <span className="text-xs font-medium text-slate-400">ج.م</span></p>
                                      </div>

                                      {/* --- NEW: Detailed Invoice Breakdown Table --- */}
                                      {exp.isInvoice && exp.invoiceItems && (
                                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                              <table className="w-full text-xs">
                                                  <thead>
                                                      <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                          <th className="pb-2 text-start">البند</th>
                                                          <th className="pb-2 text-center">العدد</th>
                                                          <th className="pb-2 text-center">السعر</th>
                                                          <th className="pb-2 text-end">الإجمالي</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                      {exp.invoiceItems.map((item, idx) => (
                                                          <tr key={idx}>
                                                              <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{item.itemName}</td>
                                                              <td className="py-2 text-center text-slate-500">{item.quantity}</td>
                                                              <td className="py-2 text-center text-slate-500">{item.unitPrice}</td>
                                                              <td className="py-2 text-end font-bold text-slate-800 dark:text-white">{item.total}</td>
                                                          </tr>
                                                      ))}
                                                      {exp.additionalAmount > 0 && (
                                                          <tr>
                                                              <td className="py-2 text-indigo-600 font-bold">قيمة إضافية</td>
                                                              <td colSpan={2}></td>
                                                              <td className="py-2 text-end font-bold text-indigo-600">{exp.additionalAmount}</td>
                                                          </tr>
                                                      )}
                                                  </tbody>
                                              </table>
                                          </div>
                                      )}

                                      {exp.notes && (
                                          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg italic">
                                              "{exp.notes}"
                                          </div>
                                      )}

                                      {exp.imageUrl && (
                                          <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer" onClick={() => setPreviewImage(exp.imageUrl!)}>
                                              <img src={exp.imageUrl} className="w-full h-full object-cover" />
                                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">عرض الصورة</div>
                                          </div>
                                      )}

                                      <div className="flex gap-2">
                                          {!rejectingId && (
                                              <>
                                                <button onClick={() => handleUpdateExpenseStatus(exp.id, ExpenseStatus.APPROVED)} className="flex-1 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-200 transition-colors active:scale-95"><CheckCircle size={18}/> {t('approve')}</button>
                                                <button onClick={() => {setRejectingId(exp.id); setRejectionType('EXPENSE');}} className="flex-1 py-2.5 bg-red-100 text-red-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-200 transition-colors active:scale-95"><XCircle size={18}/> {t('reject')}</button>
                                              </>
                                          )}
                                          <button onClick={() => setSelectedExpense(exp)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"><Eye size={20}/></button>
                                      </div>
                                      {(rejectingId === exp.id) && renderRejectionInput(exp.id, 'EXPENSE')}
                                  </div>
                              ))}
                              {pendingRequestsCount === 0 && <p className="text-center text-slate-400 py-10">{t('noDataMatching')}</p>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ... EXPENSE DETAILS MODAL & PREVIEW IMAGE (No logic changes needed) ... */}
      {selectedExpense && (
          <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={closeWithBack}>
               <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-2xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/20 modal-overlay" onClick={(e) => e.stopPropagation()}>
                   <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-[2rem]"><div><h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('expenseDetailsFor')}</h3><p className="text-slate-400 text-sm mt-1">#{selectedExpense.id.substring(0,8)}</p></div><div className="flex gap-2"><button onClick={() => exportExpenseToExcel(selectedExpense)} className="p-3 bg-green-50 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors shadow-sm active:scale-90"><FileSpreadsheet size={20}/></button><button onClick={closeWithBack} className="p-3 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all active:scale-90"><X size={20} /></button></div></div>
                  <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 max-h-[80vh]">
                      <div className="text-center"><h2 className="text-5xl font-black text-blue-600 dark:text-blue-400 tracking-tighter drop-shadow-sm">{selectedExpense.amount.toLocaleString()} <span className="text-2xl text-slate-400 font-medium">{t('currency')}</span ></h2><h3 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{selectedExpense.description}</h3><div className="mt-3 flex justify-center scale-110"><StatusBadge status={selectedExpense.status}/></div></div>
                      
                      {/* Grid for details - Enhanced for Invoice items */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('date')}</p><p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calendar size={14}/> {selectedExpense.date}</p></div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('user')}</p><p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><UserIcon size={14}/> {users.find(u => u.id === selectedExpense.userId)?.name}</p></div>
                          
                          {selectedExpense.isInvoice && (
                              <div className="col-span-2 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                  <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><FileCheck size={14}/> {t('invoiceItems')}</p>
                                  <div className="space-y-2">
                                      {selectedExpense.invoiceItems?.map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-sm border-b border-indigo-200 dark:border-indigo-800/50 pb-2 last:border-0 last:pb-0">
                                              <span className="font-medium text-slate-700 dark:text-white">{item.itemName} <span className="text-slate-400 text-xs">x{item.quantity}</span></span>
                                              <span className="font-bold">{item.total.toLocaleString()}</span>
                                          </div>
                                      ))}
                                      {selectedExpense.additionalAmount && selectedExpense.additionalAmount > 0 && (
                                          <div className="flex justify-between items-center text-sm pt-2 border-t border-indigo-200 dark:border-indigo-800">
                                              <span className="font-bold text-indigo-600">{t('additionalValue')}</span>
                                              <span className="font-black">{selectedExpense.additionalAmount.toLocaleString()}</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                          
                          <div className="col-span-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('notes')}</p>
                              <p className="font-medium text-slate-700 dark:text-white whitespace-pre-wrap">{selectedExpense.notes || 'لا توجد ملاحظات'}</p>
                          </div>
                      </div>

                      {selectedExpense.imageUrl && (<div><p className="text-sm font-bold mb-3 dark:text-white flex items-center gap-2"><ImageIcon size={16}/> المرفقات</p><div onClick={() => { setPreviewImage(selectedExpense.imageUrl!); }} className="relative h-48 w-full rounded-2xl overflow-hidden cursor-pointer group border-2 border-slate-200 dark:border-slate-700 shadow-sm"><img src={selectedExpense.imageUrl} alt="Receipt" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" /></div></div>)}
                  </div>
               </div>
          </div>
      )}

      {/* --- PREVIEW IMAGE --- */}
      {previewImage && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/95 p-0 m-0 backdrop-blur-xl" onClick={() => setPreviewImage(null)}>
              <img src={previewImage} className="max-w-full max-h-full object-contain" />
              <button className="absolute top-6 right-6 bg-white/20 p-4 rounded-full text-white hover:bg-white/30 transition-colors backdrop-blur-md"><X size={32}/></button>
          </div>
      )}
    </div>
  );
};
