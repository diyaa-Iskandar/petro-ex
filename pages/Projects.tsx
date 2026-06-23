
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageProvider';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Briefcase, MapPin, Plus, X, Folder, ChevronRight, Users, Edit, Image as ImageIcon, CheckCircle, ListTodo, FileText, ArrowRightCircle, Archive, Save, FileSpreadsheet, AlertTriangle, Calendar, Wallet, Building2, MoreHorizontal, FileCheck, Eye, Trash2 } from 'lucide-react';
import { UserRole, ExpenseStatus, Project, Client, Task, Advance, Expense } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { uploadFile } from '../services/supabase';
import { StatusBadge } from '../components/StatusBadge';
import * as XLSX from 'xlsx';

// Helper for views
type ViewMode = 'CLIENTS' | 'PROJECTS' | 'TASKS' | 'EXPENSES';

// --- Client Card Component (Optimized) ---
const ClientCard: React.FC<{ 
    client: Client; 
    projectCount: number; 
    onClick: () => void; 
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onExport: (e: React.MouseEvent) => void;
    isAdmin: boolean; 
}> = ({ client, projectCount, onClick, onEdit, onDelete, onExport, isAdmin }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div 
            onClick={onClick}
            className="glass-card group bg-white/90 dark:bg-slate-800/90 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-white/50 dark:border-white/5 relative"
        >
            {/* Watermark */}
            <Building2 className="watermark-icon text-slate-300 dark:text-slate-600" size={120} />
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black bg-white/80 dark:bg-slate-900/50 backdrop-blur-md text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl uppercase tracking-wider border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        {client.code}
                    </span>

                    <div className="flex gap-1 z-20">
                        <button 
                            onClick={onExport} 
                            className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg shadow-sm hover:bg-green-600 hover:text-white transition-all active:scale-95"
                            title="تقرير شامل للعميل"
                        >
                            <FileSpreadsheet size={16} />
                        </button>
                        {isAdmin && (
                            <>
                                <button 
                                    onClick={onEdit} 
                                    className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                                    title="تعديل العميل"
                                >
                                    <Edit size={16} />
                                </button>
                                <button 
                                    onClick={onDelete} 
                                    className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg shadow-sm hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                    title="حذف العميل"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 shrink-0 rounded-[1rem] bg-white dark:bg-slate-800/50 flex items-center justify-center p-2 border border-slate-100 dark:border-slate-700/50 shadow-md overflow-hidden">
                        {client.logoUrl && !imgError ? (
                            <img 
                                src={client.logoUrl} 
                                alt={client.name} 
                                className="w-full h-full object-contain" 
                                onError={() => setImgError(true)} 
                            />
                        ) : (
                            <Building2 size={28} className="text-slate-300 dark:text-slate-600" />
                        )}
                    </div>

                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1 line-clamp-2">
                            {client.name}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                {projectCount} مشاريع
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Projects: React.FC = () => {
  const { t } = useLanguage();
  const { clients, projects, tasks, expenses, users, advances, addClient, editClient, deleteClient, addProject, editProject, deleteProject, archiveProject, addTask, editTask, deleteTask, getStableAvatar } = useData();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [viewMode, setViewMode] = useState<ViewMode>('CLIENTS');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Detail View State
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);

  // Forms State
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [blockingItems, setBlockingItems] = useState<any[]>([]);

  // Delete Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, type: 'CLIENT' | 'PROJECT' | 'TASK' | null, id: string | null }>({ isOpen: false, type: null, id: null });
  
  // Edit State
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN;
  const allEngineers = users.filter(u => u.role === UserRole.MAIN_CUSTODY);

  // --- SCROLL LOCK HOOK ---
  useEffect(() => {
    const isAnyModalOpen = showClientModal || showProjectModal || showTaskModal || showBlockingModal || previewImage || viewExpense;
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
  }, [showClientModal, showProjectModal, showTaskModal, showBlockingModal, previewImage, viewExpense]);

  // --- BACK BUTTON MAGIC (History API) for Navigation Levels ---
  useEffect(() => {
    if (viewMode !== 'CLIENTS' || viewExpense) {
        const handlePopState = (event: PopStateEvent) => {
            if (viewExpense) {
                setViewExpense(null);
            } else if (viewMode === 'EXPENSES') {
                setSelectedTaskId(null);
                setViewMode('TASKS');
            } else if (viewMode === 'TASKS') {
                setSelectedProjectId(null);
                setViewMode('PROJECTS');
            } else if (viewMode === 'PROJECTS') {
                setSelectedClientId(null);
                setViewMode('CLIENTS');
            }
        };
        window.history.pushState({ viewMode }, '', '');
        window.addEventListener('popstate', handlePopState);
        return () => { window.removeEventListener('popstate', handlePopState); };
    }
  }, [viewMode, viewExpense]);

  const navigateUp = (targetMode: ViewMode) => {
      if (targetMode === 'CLIENTS') { setSelectedClientId(null); setSelectedProjectId(null); setSelectedTaskId(null); }
      if (targetMode === 'PROJECTS') { setSelectedProjectId(null); setSelectedTaskId(null); }
      if (targetMode === 'TASKS') { setSelectedTaskId(null); }
      setViewMode(targetMode);
  };

  const handleClientClick = (id: string) => { setSelectedClientId(id); setViewMode('PROJECTS'); };
  const handleProjectClick = (id: string) => { setSelectedProjectId(id); setViewMode('TASKS'); };
  const handleTaskClick = (id: string) => { setSelectedTaskId(id); setViewMode('EXPENSES'); };

  // --- EXCEL REPORTS LOGIC ---

  const handleExportClientReport = (e: React.MouseEvent, client: Client) => {
      e.stopPropagation();
      const wb = XLSX.utils.book_new();
      
      // Get all projects for this client
      const clientProjects = projects.filter(p => p.clientId === client.id);
      
      // Summary Sheet
      const summaryData: any[][] = [
          [`Client Report: ${client.name}`],
          [`Extracted: ${new Date().toLocaleDateString()}`],
          [],
          ["Project Name", "Code", "Location", "Total Tasks", "Total Expenses (Approved)"]
      ];

      clientProjects.forEach(proj => {
          const projTasks = tasks.filter(t => t.projectId === proj.id);
          const projExpenses = expenses.filter(exp => {
              const task = tasks.find(t => t.id === exp.taskId);
              return task && task.projectId === proj.id && exp.status === ExpenseStatus.APPROVED;
          });
          const totalSpent = projExpenses.reduce((sum, e) => sum + e.amount, 0);
          summaryData.push([proj.name, proj.code, proj.location, projTasks.length, totalSpent]);
      });

      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

      // Sheet for each project details
      clientProjects.forEach(proj => {
          const projData: any[][] = [["Task", "Expense Desc", "Amount", "Date", "Status", "User"]];
          const projTasks = tasks.filter(t => t.projectId === proj.id);
          
          projTasks.forEach(task => {
              const taskExpenses = expenses.filter(e => e.taskId === task.id);
              taskExpenses.forEach(exp => {
                  const u = users.find(user => user.id === exp.userId);
                  projData.push([
                      task.name,
                      exp.description,
                      exp.amount,
                      exp.date,
                      exp.status,
                      u?.name || '-'
                  ]);
              });
          });
          
          if (projData.length > 1) { // Only create sheet if data exists
              const ws = XLSX.utils.aoa_to_sheet(projData);
              // Limit sheet name length to 31 chars (Excel limit)
              const sheetName = proj.name.substring(0, 30);
              XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }
      });

      XLSX.writeFile(wb, `Client_Report_${client.name}.xlsx`);
  };

  const handleExportProjectReport = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      const wb = XLSX.utils.book_new();
      const projTasks = tasks.filter(t => t.projectId === project.id);
      
      const flatData: any[][] = [
          ["Task", "Expense Description", "Item/Details", "Qty", "Unit Price", "Total Cost", "Date", "Status", "User", "Notes"]
      ];

      projTasks.forEach(task => {
          const taskExpenses = expenses.filter(e => e.taskId === task.id);
          taskExpenses.forEach(exp => {
              const u = users.find(user => user.id === exp.userId);
              
              if (exp.isInvoice && exp.invoiceItems) {
                  exp.invoiceItems.forEach(item => {
                      flatData.push([
                          task.name,
                          exp.description,
                          item.itemName,
                          item.quantity,
                          item.unitPrice,
                          item.total,
                          exp.date,
                          exp.status,
                          u?.name || '-',
                          exp.notes || ''
                      ]);
                  });
                  if (exp.additionalAmount) {
                      flatData.push([task.name, exp.description, "Additional", 1, exp.additionalAmount, exp.additionalAmount, exp.date, exp.status, u?.name || '-', exp.notes || '']);
                  }
              } else {
                  flatData.push([
                      task.name,
                      exp.description,
                      "Fixed Amount",
                      1,
                      exp.amount,
                      exp.amount,
                      exp.date,
                      exp.status,
                      u?.name || '-',
                      exp.notes || ''
                  ]);
              }
          });
      });

      const ws = XLSX.utils.aoa_to_sheet(flatData);
      ws['!cols'] = [{wch: 20}, {wch: 25}, {wch: 25}, {wch: 8}, {wch: 10}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 15}, {wch: 30}];
      XLSX.utils.book_append_sheet(wb, ws, "Project Expenses");
      XLSX.writeFile(wb, `Project_Report_${project.code}.xlsx`);
  };

  const handleExportTaskReport = (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      const wb = XLSX.utils.book_new();
      const taskExpenses = expenses.filter(exp => exp.taskId === task.id);
      const approvedTotal = taskExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((s, e) => s + e.amount, 0);

      // Summary
      const summary: any[][] = [
          ["Task Name", task.name],
          ["Description", task.description],
          ["Total Approved Expenses", approvedTotal],
          [],
          ["Expense Description", "Details", "Amount", "Date", "Status", "Receipt?"]
      ];

      taskExpenses.forEach(exp => {
          let details = "Fixed Amount";
          if (exp.isInvoice && exp.invoiceItems) {
              details = exp.invoiceItems.map(i => `${i.itemName} (${i.quantity}x${i.unitPrice})`).join(", ");
          }
          summary.push([
              exp.description,
              details,
              exp.amount,
              exp.date,
              exp.status,
              exp.imageUrl ? "Yes" : "No"
          ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(summary);
      ws['!cols'] = [{wch: 25}, {wch: 40}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 8}];
      XLSX.utils.book_append_sheet(wb, ws, "Task Details");
      XLSX.writeFile(wb, `Task_Report_${task.name}.xlsx`);
  };

  const exportSingleExpense = (expense: Expense) => {
      const wb = XLSX.utils.book_new();
      const u = users.find(user => user.id === expense.userId);
      const adv = advances.find(a => a.id === expense.advanceId);
      
      const headerInfo: any[][] = [
          ["Expense ID", expense.id],
          ["Description", expense.description],
          ["User", u?.name],
          ["Advance", adv?.description],
          ["Date", expense.date],
          ["Status", expense.status],
          ["Total Amount", expense.amount],
          [],
          ["Item", "Quantity", "Unit Price", "Total"]
      ];

      if (expense.isInvoice && expense.invoiceItems) {
          expense.invoiceItems.forEach(item => {
              headerInfo.push([item.itemName, item.quantity, item.unitPrice, item.total]);
          });
          if (expense.additionalAmount) headerInfo.push(["Additional", 1, expense.additionalAmount, expense.additionalAmount]);
      } else {
          headerInfo.push(["Fixed Value", 1, expense.amount, expense.amount]);
      }

      const ws = XLSX.utils.aoa_to_sheet(headerInfo);
      XLSX.utils.book_append_sheet(wb, ws, "Expense Sheet");
      XLSX.writeFile(wb, `Expense_${expense.id.substring(0,5)}.xlsx`);
  };

  // --- Modal & Action Handlers ---
  const openAddClientModal = () => { setIsEditingClient(false); setEditingClientId(null); setClientName(''); setClientCode(''); setClientLogo(null); setShowClientModal(true); };
  const openEditClientModal = (e: React.MouseEvent, client: Client) => { e.stopPropagation(); setIsEditingClient(true); setEditingClientId(client.id); setClientName(client.name); setClientCode(client.code); setClientLogo(client.logoUrl || null); setShowClientModal(true); };
  const openAddProjectModal = () => { setIsEditingProject(false); setEditingProjectId(null); setProjectName(''); setProjectCode(''); setProjectLocation(''); setSelectedEngineers([]); setShowProjectModal(true); };
  const openEditProjectModal = (e: React.MouseEvent, project: Project) => { e.stopPropagation(); setIsEditingProject(true); setEditingProjectId(project.id); setProjectName(project.name); setProjectCode(project.code); setProjectLocation(project.location); setSelectedEngineers(project.assignedEngineers || []); setShowProjectModal(true); };
  const handleArchiveProject = async (e: React.MouseEvent, projectId: string) => { e.stopPropagation(); if (confirm('هل أنت متأكد من أرشفة هذا المشروع؟')) { const result = await archiveProject(projectId); if (!result.success && result.blockedBy) { setBlockingItems(result.blockedBy); setShowBlockingModal(true); } } };
  const handleDeleteClick = (e: React.MouseEvent, type: 'CLIENT' | 'PROJECT' | 'TASK', id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, type, id });
  };
  
  const executeDelete = async () => {
      if (!deleteConfirm.id || !deleteConfirm.type) return;
      try {
          if (deleteConfirm.type === 'CLIENT') {
              await deleteClient(deleteConfirm.id);
              if (selectedClientId === deleteConfirm.id) {
                 setViewMode('CLIENTS');
                 setSelectedClientId(null);
              }
          }
          else if (deleteConfirm.type === 'PROJECT') {
              await deleteProject(deleteConfirm.id);
              if (selectedProjectId === deleteConfirm.id) {
                 setViewMode('PROJECTS');
                 setSelectedProjectId(null);
              }
          }
          else if (deleteConfirm.type === 'TASK') {
              await deleteTask(deleteConfirm.id);
          }
          setDeleteConfirm({ isOpen: false, type: null, id: null });
      } catch (e) {
          console.error(e);
          showNotification('حدث خطأ أثناء الحذف', 'error');
      }
  };
  const openAddTaskModal = () => { setIsEditingTask(false); setEditingTaskId(null); setTaskName(''); setTaskDesc(''); setShowTaskModal(true); };
  const openEditTaskModal = (e: React.MouseEvent, task: Task) => { e.stopPropagation(); setIsEditingTask(true); setEditingTaskId(task.id); setTaskName(task.name); setTaskDesc(task.description || ''); setShowTaskModal(true); };

  const handleClientSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { if (isEditingClient && editingClientId) { await editClient(editingClientId, { name: clientName, code: clientCode, logoUrl: clientLogo || undefined }); } else { await addClient({ name: clientName, code: clientCode, logoUrl: clientLogo || undefined }); } setShowClientModal(false); setClientName(''); setClientCode(''); setClientLogo(null); } catch (error) { console.error(error); showNotification('حدث خطأ', 'error'); } finally { setIsSubmitting(false); } };
  const handleProjectSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { if (isEditingProject && editingProjectId) { await editProject(editingProjectId, { name: projectName, code: projectCode, location: projectLocation, assignedEngineers: selectedEngineers }); } else { if(selectedClientId) { await addProject({ clientId: selectedClientId, name: projectName, code: projectCode, location: projectLocation, managerId: user.id, assignedEngineers: selectedEngineers }); } } setShowProjectModal(false); } catch (error) { console.error(error); showNotification('حدث خطأ', 'error'); } finally { setIsSubmitting(false); } };
  const handleTaskSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { if (isEditingTask && editingTaskId) { await editTask(editingTaskId, { name: taskName, description: taskDesc }); } else { if(selectedProjectId) { await addTask({ projectId: selectedProjectId, name: taskName, description: taskDesc }); } } setShowTaskModal(false); setTaskName(''); setTaskDesc(''); } catch (error) { console.error(error); showNotification('حدث خطأ', 'error'); } finally { setIsSubmitting(false); } };
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const url = await uploadFile(file); if(url) setClientLogo(url); } };

  // --- Views ---
  const renderClients = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clients.map(client => {
              const projectCount = projects.filter(p => p.clientId === client.id).length;
              return (
                  <ClientCard key={client.id} client={client} projectCount={projectCount} onClick={() => handleClientClick(client.id)} onEdit={(e) => openEditClientModal(e, client)} onDelete={(e) => handleDeleteClick(e, 'CLIENT', client.id)} onExport={(e) => handleExportClientReport(e, client)} isAdmin={isAdmin} />
              );
          })}
          {clients.length === 0 && <div className="col-span-full py-24 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/30"><Folder size={48} className="mb-4 opacity-20" /><p>لا يوجد عملاء. قم بإضافة عميل جديد.</p></div>}
      </div>
  );

  const renderProjects = () => {
      const displayProjects = projects.filter(p => p.clientId === selectedClientId && p.status !== 'ARCHIVED');
      return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayProjects.map(proj => (
                  <div key={proj.id} onClick={() => handleProjectClick(proj.id)} className="glass-card bg-white/90 dark:bg-slate-800/90 p-6 rounded-[1.75rem] shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                      <Briefcase className="watermark-icon text-slate-300 dark:text-slate-600" size={130} />
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2"><div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"><Briefcase size={20} /></div><span className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">{proj.code}</span></div>
                              <div className="flex gap-1 z-20" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={(e) => handleExportProjectReport(e, proj)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" title="تصدير Excel"><FileSpreadsheet size={16} /></button>
                                  {isAdmin && (<><button onClick={(e) => openEditProjectModal(e, proj)} className="p-2 bg-slate-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100 dark:bg-slate-700 dark:text-blue-400 dark:border-slate-600" title="تعديل"><Edit size={16} /></button><button onClick={(e) => handleArchiveProject(e, proj.id)} className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-500 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" title="أرشفة"><Archive size={16} /></button><button onClick={(e) => handleDeleteClick(e, 'PROJECT', proj.id)} className="p-2 bg-slate-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100 dark:bg-slate-700 dark:text-red-400 dark:border-slate-600" title="حذف"><Trash2 size={16} /></button></>)}
                              </div>
                          </div>
                          <h3 className="font-black text-xl text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">{proj.name}</h3>
                          <div className="flex items-center gap-1 text-slate-500 text-sm mb-5"><MapPin size={14} /> {proj.location}</div>
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                              <div className="flex -space-x-2 rtl:space-x-reverse">{proj.assignedEngineers?.slice(0, 3).map(uid => (<img key={uid} src={getStableAvatar(users.find(u => u.id === uid)?.name || 'U')} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800" title={users.find(u => u.id === uid)?.name} />))}{(proj.assignedEngineers?.length || 0) > 3 && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold border-2 border-white">+{(proj.assignedEngineers?.length || 0) - 3}</div>}</div>
                              <div className="text-xs font-bold text-blue-600 flex items-center gap-1">عرض المهام <ArrowRightCircle size={14}/></div>
                          </div>
                      </div>
                  </div>
              ))}
              {displayProjects.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">لا توجد مشاريع نشطة لهذا العميل.</div>}
          </div>
      );
  };

  const renderTasks = () => {
      const displayTasks = tasks.filter(t => t.projectId === selectedProjectId);
      return (
          <div className="space-y-4">
              {displayTasks.map(task => {
                  const taskExpenses = expenses.filter(e => e.taskId === task.id && e.status === ExpenseStatus.APPROVED);
                  const total = taskExpenses.reduce((sum, e) => sum + e.amount, 0);
                  return (
                      <div key={task.id} onClick={() => handleTaskClick(task.id)} className="glass-card bg-white/80 dark:bg-slate-800/80 p-5 rounded-2xl hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group relative shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl"><ListTodo size={20} /></div>
                              <div>
                                  <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors flex items-center gap-2">{task.name}
                                      <div onClick={e => e.stopPropagation()} className="flex gap-1">
                                          {isAdmin && (
                                              <>
                                                  <button onClick={(e) => openEditTaskModal(e, task)} className="p-1 text-slate-300 hover:text-blue-500 rounded transition-colors"><Edit size={14}/></button>
                                                  <button onClick={(e) => handleDeleteClick(e, 'TASK', task.id)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors" title="حذف"><Trash2 size={14}/></button>
                                              </>
                                          )}
                                          <button onClick={(e) => handleExportTaskReport(e, task)} className="p-1 text-slate-300 hover:text-green-500 rounded transition-colors" title="تقرير التاسك"><FileSpreadsheet size={14}/></button>
                                      </div>
                                  </h4>
                                  <p className="text-sm text-slate-500">{task.description}</p>
                              </div>
                          </div>
                          <div className="text-end"><p className="text-xs text-slate-400 mb-1">إجمالي المصروف</p><p className="font-black text-xl text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span></p></div>
                      </div>
                  );
              })}
              {displayTasks.length === 0 && <div className="py-20 text-center text-slate-400">لا توجد مهام في هذا المشروع.</div>}
          </div>
      );
  };

  const renderExpenses = () => {
      const displayExpenses = expenses.filter(e => e.taskId === selectedTaskId);
      const taskTotalSpent = displayExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
      
      return (
          <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-[2rem] p-8 text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                      <p className="text-blue-100 text-sm font-bold mb-1">إجمالي تكلفة المهمة</p>
                      <h2 className="text-4xl font-black">{taskTotalSpent.toLocaleString()} <span className="text-lg opacity-80">ج.م</span></h2>
                  </div>
                  <div className="relative z-10 flex items-center gap-3"><div className="bg-white/20 p-3 rounded-xl backdrop-blur-md"><ListTodo size={32} /></div></div>
                  <ListTodo className="absolute -bottom-6 -left-6 text-white opacity-10 rotate-12" size={150} />
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                      <table className="w-full text-start">
                          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-bold"><tr><th className="p-4 text-start">التاريخ</th><th className="p-4 text-start">الوصف</th><th className="p-4 text-start">القائم بالصرف</th><th className="p-4 text-start">مصدر الصرف (العهدة)</th><th className="p-4 text-start">القيمة</th><th className="p-4 text-start">الفاتورة</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                              {displayExpenses.map(exp => {
                                  const adv = advances.find(a => a.id === exp.advanceId);
                                  return (
                                      <tr key={exp.id} onClick={() => setViewExpense(exp)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                          <td className="p-4 font-medium text-slate-500">{exp.date}</td>
                                          <td className="p-4 font-bold text-slate-800 dark:text-white group-hover:text-blue-600">{exp.description}</td>
                                          <td className="p-4 text-slate-600 dark:text-slate-300 flex items-center gap-2"><img src={getStableAvatar(users.find(u => u.id === exp.userId)?.name || 'U')} className="w-6 h-6 rounded-full" />{users.find(u => u.id === exp.userId)?.name}</td>
                                          <td className="p-4 text-slate-600 dark:text-slate-300">{adv ? <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">{adv.description}</span> : '-'}</td>
                                          <td className="p-4 font-black text-slate-800 dark:text-white">{exp.amount.toLocaleString()}</td>
                                          <td className="p-4">{exp.imageUrl ? (<span className="text-blue-600 flex items-center gap-1"><ImageIcon size={14}/> عرض</span>) : <span className="text-slate-400">-</span>}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
                  {displayExpenses.length === 0 && <div className="p-10 text-center text-slate-400">لا توجد مصروفات مسجلة لهذه المهمة.</div>}
              </div>
          </div>
      );
  };

  const renderHeader = () => {
      const client = clients.find(c => c.id === selectedClientId);
      const project = projects.find(p => p.id === selectedProjectId);
      const task = tasks.find(t => t.id === selectedTaskId);
      return (
          <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-bold overflow-x-auto whitespace-nowrap pb-2">
                  <span onClick={() => navigateUp('CLIENTS')} className="cursor-pointer hover:text-blue-600 transition-colors">العملاء</span>
                  {client && <><ChevronRight size={14} className="rtl:rotate-180"/><span onClick={() => navigateUp('PROJECTS')} className={`cursor-pointer hover:text-blue-600 transition-colors ${viewMode === 'PROJECTS' ? 'text-slate-800 dark:text-white' : ''}`}>{client.name}</span></>}
                  {project && <><ChevronRight size={14} className="rtl:rotate-180"/><span onClick={() => navigateUp('TASKS')} className={`cursor-pointer hover:text-blue-600 transition-colors ${viewMode === 'TASKS' ? 'text-slate-800 dark:text-white' : ''}`}>{project.name}</span></>}
                  {task && <><ChevronRight size={14} className="rtl:rotate-180"/><span className="text-slate-800 dark:text-white">{task.name}</span></>}
              </div>
              <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                      {viewMode === 'CLIENTS' && <><Folder className="text-blue-500"/> قائمة العملاء</>}
                      {viewMode === 'PROJECTS' && <><Briefcase className="text-blue-500"/> مشاريع {client?.name}</>}
                      {viewMode === 'TASKS' && <><ListTodo className="text-blue-500"/> مهام {project?.name}</>}
                      {viewMode === 'EXPENSES' && <><FileText className="text-blue-500"/> مصروفات {task?.name}</>}
                  </h2>
                  <div className="flex gap-2">
                      {isAdmin && viewMode === 'CLIENTS' && <Button onClick={() => setShowClientModal(true)}><Plus size={18}/> إضافة عميل</Button>}
                      {isAdmin && viewMode === 'PROJECTS' && <Button onClick={openAddProjectModal}><Plus size={18}/> إضافة مشروع</Button>}
                      {isAdmin && viewMode === 'TASKS' && <Button onClick={() => setShowTaskModal(true)}><Plus size={18}/> إضافة مهمة</Button>}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="animate-fade-in pb-20">
      {renderHeader()}
      {viewMode === 'CLIENTS' && renderClients()}
      {viewMode === 'PROJECTS' && renderProjects()}
      {viewMode === 'TASKS' && renderTasks()}
      {viewMode === 'EXPENSES' && renderExpenses()}

      {/* --- MODALS --- */}
      {/* View Expense Detail Modal */}
      {viewExpense && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setViewExpense(null)}>
               <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-2xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/20 modal-overlay" onClick={(e) => e.stopPropagation()}>
                   <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-[2rem]">
                       <div><h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('expenseDetailsFor')}</h3><p className="text-slate-400 text-sm mt-1">#{viewExpense.id.substring(0,8)}</p></div>
                       <div className="flex gap-2">
                           <button onClick={() => exportSingleExpense(viewExpense)} className="p-3 bg-green-50 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors shadow-sm active:scale-90" title="تصدير Excel"><FileSpreadsheet size={20}/></button>
                           <button onClick={() => setViewExpense(null)} className="p-3 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 text-slate-400 shadow-md transition-all active:scale-90"><X size={20} /></button>
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
                              <p className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Users size={14}/> {users.find(u => u.id === viewExpense.userId)?.name}</p>
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

      {/* Client Modal */}
      {showClientModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-md md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/10 modal-overlay">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                      <h3 className="text-xl font-bold dark:text-white">{isEditingClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
                      <button onClick={() => setShowClientModal(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full active:scale-90 transition-transform"><X size={20}/></button>
                  </div>
                  <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50">
                      <form onSubmit={handleClientSubmit} className="space-y-4">
                          <div><label className="block text-xs font-bold mb-2">اسم العميل</label><input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          <div><label className="block text-xs font-bold mb-2">كود العميل</label><input required type="text" value={clientCode} onChange={e => setClientCode(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          <div><label className="block text-xs font-bold mb-2">لوجو العميل (اختياري)</label><input type="file" onChange={handleLogoUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>
                          <Button type="submit" className="w-full mt-4 py-4 rounded-xl shadow-lg active:scale-95 transition-transform">حفظ</Button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 w-full h-[80vh] md:h-auto md:max-w-md md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/10 modal-overlay">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                      <h3 className="text-xl font-bold dark:text-white">{isEditingProject ? 'تعديل بيانات المشروع' : 'إضافة مشروع جديد'}</h3>
                      <button onClick={() => setShowProjectModal(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full active:scale-90 transition-transform"><X size={20}/></button>
                  </div>
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                      <form onSubmit={handleProjectSubmit} className="space-y-4">
                          <div><label className="block text-xs font-bold mb-2">اسم المشروع</label><input required type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          <div><label className="block text-xs font-bold mb-2">كود المشروع</label><input required type="text" value={projectCode} onChange={e => setProjectCode(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          <div><label className="block text-xs font-bold mb-2">الموقع</label><input required type="text" value={projectLocation} onChange={e => setProjectLocation(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          
                          <div>
                              <label className="block text-xs font-bold mb-2">مهندسين المشروع (صلاحية الصرف)</label>
                              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl max-h-48 overflow-y-auto custom-scrollbar space-y-2 border border-slate-200 dark:border-slate-700 shadow-inner">
                                  {allEngineers.map(eng => (
                                      <div key={eng.id} onClick={() => setSelectedEngineers(prev => prev.includes(eng.id) ? prev.filter(id => id !== eng.id) : [...prev, eng.id])} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedEngineers.includes(eng.id) ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'}`}>
                                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedEngineers.includes(eng.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'}`}>
                                              {selectedEngineers.includes(eng.id) && <CheckCircle size={14} className="text-white"/>}
                                          </div>
                                          <span className="text-sm font-medium">{eng.name}</span>
                                      </div>
                                  ))}
                                  {allEngineers.length === 0 && <p className="text-xs text-slate-400 text-center py-2">لا يوجد مهندسين متاحين</p>}
                              </div>
                          </div>

                          <Button type="submit" className="w-full mt-4 py-4 rounded-xl shadow-lg active:scale-95 transition-transform" isLoading={isSubmitting}>
                              {isEditingProject ? <><Save size={18}/> حفظ التعديلات</> : <><Plus size={18}/> إنشاء المشروع</>}
                          </Button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 w-full h-auto md:max-w-md md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-slide-up flex flex-col border border-white/10 modal-overlay">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
                      <h3 className="text-xl font-bold dark:text-white">{isEditingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3>
                      <button onClick={() => setShowTaskModal(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full active:scale-90 transition-transform"><X size={20}/></button>
                  </div>
                  <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50">
                      <form onSubmit={handleTaskSubmit} className="space-y-4">
                          <div><label className="block text-xs font-bold mb-2">اسم المهمة</label><input required type="text" value={taskName} onChange={e => setTaskName(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none shadow-sm" /></div>
                          <div><label className="block text-xs font-bold mb-2">وصف المهمة</label><textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="input-modern w-full p-4 bg-white dark:bg-slate-800 rounded-xl outline-none h-32 shadow-sm" /></div>
                          <Button type="submit" className="w-full mt-4 py-4 rounded-xl shadow-lg active:scale-95 transition-transform" isLoading={isSubmitting}>حفظ</Button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-center">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl animate-scale-in flex flex-col p-8 border border-white/10">
                  <div className="mx-auto bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-6">
                      <AlertTriangle size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">تأكيد الحذف</h3>
                  <p className="text-slate-500 font-medium mb-8">
                      {deleteConfirm.type === 'CLIENT' ? 'هل أنت متأكد من أنك تريد حذف هذا العميل؟ سيتم مسح جميع المشاريع والمهام المرتبطة به نهائياً.' : 
                       deleteConfirm.type === 'PROJECT' ? 'هل أنت متأكد من حذف هذا المشروع بالكامل؟ سيتم مسح جميع المهام التابعة له نهائياً ولا يمكن استعادة البيانات.' : 
                       'هل أنت متأكد من حذف هذه المهمة؟'}
                  </p>
                  <div className="flex gap-4 w-full">
                     <Button onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null })} variant="secondary" className="flex-1 py-3 px-0">إلغاء</Button>
                     <Button onClick={executeDelete} variant="primary" className="flex-1 py-3 px-0 !bg-red-500 hover:!bg-red-600 shadow-md shadow-red-500/20 text-white border-0">نعم، متأكد</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Blocking Modal */}
      {showBlockingModal && (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/80 backdrop-blur-xl p-0 md:p-4 animate-fade-in" onClick={() => setShowBlockingModal(false)}>
              <div className="bg-white dark:bg-slate-900 w-full h-[90vh] md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[2rem] rounded-t-[2.5rem] shadow-2xl animate-scale-in flex flex-col border border-white/10 modal-overlay overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 sticky top-0 z-20">
                      <div>
                          <h3 className="text-xl font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                              <AlertTriangle size={24} />
                              لا يمكن أرشفة المشروع
                          </h3>
                          <p className="text-sm text-red-500 dark:text-red-300 mt-1">يوجد متعلقات مالية (عهد/مصروفات) لم يتم تسويتها.</p>
                      </div>
                      <button onClick={() => setShowBlockingModal(false)} className="p-3 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 shadow-sm active:scale-90"><X size={20} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 font-bold">يرجى تصفية العناصر التالية أولاً لتتمكن من الأرشفة:</p>
                      {blockingItems.map((item: any, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm hover:border-red-300 transition-colors group">
                              <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg mt-1 ${item.remainingAmount !== undefined ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                      {item.remainingAmount !== undefined ? <Wallet size={18}/> : <FileText size={18}/>}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-800 dark:text-white group-hover:text-red-600 transition-colors">
                                          {item.description}
                                      </p>
                                      <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                          {item.remainingAmount !== undefined ? (
                                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">عهدة مفتوحة</span>
                                          ) : (
                                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">مصروف معلق</span>
                                          )}
                                          <span>{item.date}</span>
                                          <span>•</span>
                                          <span>{users.find(u => u.id === item.userId)?.name}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-end">
                                  <p className="font-black text-slate-800 dark:text-white">{item.amount.toLocaleString()}</p>
                                  {item.remainingAmount !== undefined && (
                                       <span className="text-[10px] font-bold text-slate-400 block">المتبقي: {item.remainingAmount}</span>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-20 flex justify-end">
                      <Button variant="secondary" onClick={() => setShowBlockingModal(false)} className="w-full md:w-auto py-3 md:py-2">إغلاق</Button>
                  </div>
              </div>
          </div>
      )}

      {previewImage && (<div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/95 p-0 m-0 backdrop-blur-xl" onClick={() => setPreviewImage(null)}><div className="relative w-full h-full flex items-center justify-center"><button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 text-white hover:text-red-400 transition-colors bg-white/20 p-4 rounded-full backdrop-blur-md z-50"><X size={24}/></button><img src={previewImage} alt="Receipt" className="max-w-full max-h-full object-contain" /></div></div>)}
    </div>
  );
};
