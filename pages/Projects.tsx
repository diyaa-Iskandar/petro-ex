
import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Briefcase, MapPin, Plus, X, Folder, ChevronRight, Users, Edit, Image as ImageIcon, CheckCircle, ListTodo, FileText, ArrowRightCircle, Archive, Save, FileSpreadsheet, AlertTriangle, Calendar, Wallet, Building2, MoreHorizontal } from 'lucide-react';
import { UserRole, ExpenseStatus, Project, Client, Task, Advance } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { uploadFile } from '../services/supabase';
import * as XLSX from 'xlsx';

// Helper for views
type ViewMode = 'CLIENTS' | 'PROJECTS' | 'TASKS' | 'EXPENSES';

// --- Client Card Component to handle Image Errors ---
const ClientCard: React.FC<{ 
    client: Client; 
    projectCount: number; 
    onClick: () => void; 
    onEdit: (e: React.MouseEvent) => void;
    isAdmin: boolean; 
}> = ({ client, projectCount, onClick, onEdit, isAdmin }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div 
            onClick={onClick}
            className="group relative bg-gradient-to-br from-white via-slate-50 to-blue-50/50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 rounded-[2rem] p-6 border border-white/60 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-blue-200/40 dark:hover:shadow-blue-900/10 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden"
        >
            {/* Decorative Background Blobs - Enhanced Colors */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-400/10 dark:bg-blue-500/10 rounded-full group-hover:scale-125 transition-transform duration-700 blur-3xl pointer-events-none"></div>
            <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full group-hover:scale-125 transition-transform duration-700 blur-3xl pointer-events-none"></div>
            
            {/* Action Button (Admin) */}
            {isAdmin && (
                <div className="absolute top-5 right-5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                        onClick={onEdit} 
                        className="p-2.5 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full shadow-lg hover:shadow-xl transition-all"
                        title="تعديل"
                    >
                        <Edit size={16} />
                    </button>
                </div>
            )}

            <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div className="flex justify-between items-start">
                    {/* Enlarged Logo Container */}
                    <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800/50 flex items-center justify-center p-3 border border-slate-100 dark:border-slate-700/50 shadow-md group-hover:shadow-lg transition-all duration-300 overflow-hidden">
                        {client.logoUrl && !imgError ? (
                            <img 
                                src={client.logoUrl} 
                                alt={client.name} 
                                className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-500" 
                                onError={() => setImgError(true)} 
                            />
                        ) : (
                            <Building2 size={40} className="text-slate-300 dark:text-slate-600" />
                        )}
                    </div>
                    
                    <span className="text-[10px] font-black bg-white/80 dark:bg-slate-900/50 backdrop-blur-md text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl uppercase tracking-wider border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        {client.code}
                    </span>
                </div>

                <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-3 line-clamp-2">
                        {client.name}
                    </h3>
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Briefcase size={16} />
                        </div>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                            {projectCount} {projectCount === 1 ? 'مشروع' : 'مشاريع'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Projects: React.FC = () => {
  const { t } = useLanguage();
  const { clients, projects, tasks, expenses, users, advances, addClient, editClient, addProject, editProject, archiveProject, addTask, editTask, getStableAvatar } = useData();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [viewMode, setViewMode] = useState<ViewMode>('CLIENTS');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Forms State
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [blockingItems, setBlockingItems] = useState<any[]>([]);
  
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
  const allEngineers = users.filter(u => u.role === UserRole.ENGINEER);

  // --- Navigation Logic ---
  const handleClientClick = (id: string) => {
      setSelectedClientId(id);
      setViewMode('PROJECTS');
  };

  const handleProjectClick = (id: string) => {
      setSelectedProjectId(id);
      setViewMode('TASKS');
  };

  const handleTaskClick = (id: string) => {
      setSelectedTaskId(id);
      setViewMode('EXPENSES');
  };

  // --- Reports Logic ---
  const handleExportTaskReport = () => {
      if (!selectedTaskId) return;
      const task = tasks.find(t => t.id === selectedTaskId);
      const project = projects.find(p => p.id === task?.projectId);
      const client = clients.find(c => c.id === project?.clientId);
      const taskExpenses = expenses.filter(e => e.taskId === selectedTaskId);

      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [
          [`تقرير مصروفات مهمة: ${task?.name}`],
          [`المشروع: ${project?.name} (${project?.code})`],
          [`العميل: ${client?.name} (${client?.code})`],
          [],
          ["التاريخ", "وصف المصروف", "القائم بالصرف", "مصدر الصرف (العهدة)", "القيمة", "الحالة", "ملاحظات", "يوجد فاتورة؟"]
      ];

      taskExpenses.forEach(exp => {
          const u = users.find(user => user.id === exp.userId);
          const adv = advances.find(a => a.id === exp.advanceId);
          const advanceLabel = adv ? `${adv.description}` : 'غير محدد';

          wsData.push([
              exp.date,
              exp.description,
              u?.name || exp.userId,
              advanceLabel,
              exp.amount,
              t(exp.status === ExpenseStatus.APPROVED ? 'statusApproved' : (exp.status === ExpenseStatus.PENDING ? 'statusPending' : 'statusRejected')),
              exp.notes || '-',
              exp.imageUrl ? 'نعم' : 'لا'
          ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 15}, {wch: 30}, {wch: 20}, {wch: 25}, {wch: 12}, {wch: 15}, {wch: 25}, {wch: 10}];
      XLSX.utils.book_append_sheet(wb, ws, "Task Expenses");
      XLSX.writeFile(wb, `Task_Report_${task?.name}.xlsx`);
  };

  const handleExportProjectReport = () => {
      if (!selectedProjectId) return;
      const project = projects.find(p => p.id === selectedProjectId);
      const client = clients.find(c => c.id === project?.clientId);
      const projectTasks = tasks.filter(t => t.projectId === selectedProjectId);
      
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [
          [`تقرير شامل للمشروع: ${project?.name} (${project?.code})`],
          [`العميل: ${client?.name} (${client?.code})`],
          [`الموقع: ${project?.location}`],
          [],
          ["المهمة (Task)", "التاريخ", "وصف المصروف", "القائم بالصرف", "مصدر الصرف (العهدة)", "القيمة", "الحالة", "ملاحظات"]
      ];

      projectTasks.forEach(task => {
          const taskExpenses = expenses.filter(e => e.taskId === task.id);
          taskExpenses.forEach(exp => {
              const u = users.find(user => user.id === exp.userId);
              const adv = advances.find(a => a.id === exp.advanceId);
              const advanceLabel = adv ? `${adv.description}` : 'غير محدد';

              wsData.push([
                  task.name,
                  exp.date,
                  exp.description,
                  u?.name || exp.userId,
                  advanceLabel,
                  exp.amount,
                  t(exp.status === ExpenseStatus.APPROVED ? 'statusApproved' : (exp.status === ExpenseStatus.PENDING ? 'statusPending' : 'statusRejected')),
                  exp.notes || '-'
              ]);
          });
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 20}, {wch: 15}, {wch: 30}, {wch: 20}, {wch: 25}, {wch: 12}, {wch: 15}, {wch: 25}];
      XLSX.utils.book_append_sheet(wb, ws, "Project Report");
      XLSX.writeFile(wb, `Project_Report_${project?.code}.xlsx`);
  };

  // --- Actions (Add/Edit/Archive) ---
  
  // Client
  const openAddClientModal = () => {
      setIsEditingClient(false); setEditingClientId(null); setClientName(''); setClientCode(''); setClientLogo(null); setShowClientModal(true);
  };
  const openEditClientModal = (e: React.MouseEvent, client: Client) => {
      e.stopPropagation();
      setIsEditingClient(true); setEditingClientId(client.id); setClientName(client.name); setClientCode(client.code); setClientLogo(client.logoUrl || null); setShowClientModal(true);
  };

  // Project
  const openAddProjectModal = () => {
      setIsEditingProject(false); setEditingProjectId(null); setProjectName(''); setProjectCode(''); setProjectLocation(''); setSelectedEngineers([]); setShowProjectModal(true);
  };
  const openEditProjectModal = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      setIsEditingProject(true); setEditingProjectId(project.id); setProjectName(project.name); setProjectCode(project.code); setProjectLocation(project.location); setSelectedEngineers(project.assignedEngineers || []); setShowProjectModal(true);
  };

  const handleArchiveProject = async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      if (confirm('هل أنت متأكد من أرشفة هذا المشروع؟')) {
          const result = await archiveProject(projectId);
          if (!result.success && result.blockedBy) {
              // Show Blocking Modal
              setBlockingItems(result.blockedBy);
              setShowBlockingModal(true);
          }
      }
  };

  // Task
  const openAddTaskModal = () => {
      setIsEditingTask(false); setEditingTaskId(null); setTaskName(''); setTaskDesc(''); setShowTaskModal(true);
  };
  const openEditTaskModal = (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      setIsEditingTask(true); setEditingTaskId(task.id); setTaskName(task.name); setTaskDesc(task.description || ''); setShowTaskModal(true);
  };

  // --- Submits ---
  const handleClientSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        if (isEditingClient && editingClientId) {
            await editClient(editingClientId, { name: clientName, code: clientCode, logoUrl: clientLogo || undefined });
        } else {
            await addClient({ name: clientName, code: clientCode, logoUrl: clientLogo || undefined });
        }
        setShowClientModal(false); setClientName(''); setClientCode(''); setClientLogo(null);
      } catch (error) {
        console.error(error);
        showNotification('حدث خطأ', 'error');
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          if (isEditingProject && editingProjectId) {
              await editProject(editingProjectId, { name: projectName, code: projectCode, location: projectLocation, assignedEngineers: selectedEngineers });
          } else {
              if(selectedClientId) {
                  await addProject({ clientId: selectedClientId, name: projectName, code: projectCode, location: projectLocation, managerId: user.id, assignedEngineers: selectedEngineers });
              }
          }
          setShowProjectModal(false);
      } catch (error) {
          console.error(error);
          showNotification('حدث خطأ', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        if (isEditingTask && editingTaskId) {
            await editTask(editingTaskId, { name: taskName, description: taskDesc });
        } else {
            if(selectedProjectId) {
                await addTask({ projectId: selectedProjectId, name: taskName, description: taskDesc });
            }
        }
        setShowTaskModal(false); setTaskName(''); setTaskDesc('');
      } catch (error) {
        console.error(error);
        showNotification('حدث خطأ', 'error');
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = await uploadFile(file);
          if(url) setClientLogo(url);
      }
  };

  // --- Filtered Data ---
  const displayProjects = useMemo(() => {
      if (!selectedClientId) return [];
      return projects.filter(p => p.clientId === selectedClientId && p.status !== 'ARCHIVED');
  }, [projects, selectedClientId]);

  const displayTasks = useMemo(() => {
      if (!selectedProjectId) return [];
      return tasks.filter(t => t.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  const displayExpenses = useMemo(() => {
      if (!selectedTaskId) return [];
      return expenses.filter(e => e.taskId === selectedTaskId);
  }, [expenses, selectedTaskId]);

  const taskTotalSpent = displayExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);

  // --- Views ---

  // 1. Clients View (Modern Clean Cards)
  const renderClients = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clients.map(client => {
              const projectCount = projects.filter(p => p.clientId === client.id).length;
              return (
                  <ClientCard 
                    key={client.id}
                    client={client}
                    projectCount={projectCount}
                    onClick={() => handleClientClick(client.id)}
                    onEdit={(e) => openEditClientModal(e, client)}
                    isAdmin={isAdmin}
                  />
              );
          })}
          {clients.length === 0 && (
              <div className="col-span-full py-24 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/30">
                  <Folder size={48} className="mb-4 opacity-20" />
                  <p>لا يوجد عملاء. قم بإضافة عميل جديد.</p>
              </div>
          )}
      </div>
  );

  // 2. Projects View
  const renderProjects = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayProjects.map(proj => (
              <div key={proj.id} onClick={() => handleProjectClick(proj.id)} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
                  
                  {/* Admin Actions */}
                  {isAdmin && (
                      <div className="absolute top-4 left-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                              onClick={(e) => openEditProjectModal(e, proj)} 
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
                              title="تعديل المشروع / المهندسين"
                          >
                              <Edit size={16} />
                          </button>
                          <button 
                              onClick={(e) => handleArchiveProject(e, proj.id)} 
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                              title="أرشفة المشروع"
                          >
                              <Archive size={16} />
                          </button>
                      </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"><Briefcase size={24} /></div>
                      <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded">{proj.code}</span>
                  </div>
                  <h3 className="font-black text-xl text-slate-800 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">{proj.name}</h3>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mb-4"><MapPin size={14} /> {proj.location}</div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                          {proj.assignedEngineers?.slice(0, 3).map(uid => (
                              <img key={uid} src={getStableAvatar(users.find(u => u.id === uid)?.name || 'U')} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800" title={users.find(u => u.id === uid)?.name} />
                          ))}
                          {(proj.assignedEngineers?.length || 0) > 3 && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold border-2 border-white">+{(proj.assignedEngineers?.length || 0) - 3}</div>}
                      </div>
                      <div className="text-xs font-bold text-blue-600 flex items-center gap-1">عرض المهام <ArrowRightCircle size={14}/></div>
                  </div>
              </div>
          ))}
          {displayProjects.length === 0 && <div className="col-span-full py-20 text-center text-slate-400">لا توجد مشاريع نشطة لهذا العميل.</div>}
      </div>
  );

  // 3. Tasks View
  const renderTasks = () => (
      <div className="space-y-4">
          {displayTasks.map(task => {
              const taskExpenses = expenses.filter(e => e.taskId === task.id && e.status === ExpenseStatus.APPROVED);
              const total = taskExpenses.reduce((sum, e) => sum + e.amount, 0);
              
              return (
                  <div key={task.id} onClick={() => handleTaskClick(task.id)} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group relative">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl"><ListTodo size={20} /></div>
                          <div>
                              <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                  {task.name}
                                  {isAdmin && <button onClick={(e) => openEditTaskModal(e, task)} className="p-1 text-slate-300 hover:text-blue-500 rounded transition-colors"><Edit size={14}/></button>}
                              </h4>
                              <p className="text-sm text-slate-500">{task.description}</p>
                          </div>
                      </div>
                      <div className="text-end">
                          <p className="text-xs text-slate-400 mb-1">إجمالي المصروف</p>
                          <p className="font-black text-xl text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} <span className="text-xs text-slate-500">ج.م</span></p>
                      </div>
                  </div>
              );
          })}
          {displayTasks.length === 0 && <div className="py-20 text-center text-slate-400">لا توجد مهام في هذا المشروع.</div>}
      </div>
  );

  // 4. Expenses View
  const renderExpenses = () => (
      <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-6 text-white flex justify-between items-center shadow-lg">
              <div>
                  <p className="text-blue-100 text-sm font-bold mb-1">إجمالي تكلفة المهمة</p>
                  <h2 className="text-4xl font-black">{taskTotalSpent.toLocaleString()} <span className="text-lg opacity-80">ج.م</span></h2>
              </div>
              <div className="flex items-center gap-3">
                  <Button onClick={handleExportTaskReport} variant="secondary" className="text-xs !py-2 !px-3 shadow-none bg-white/10 hover:bg-white/20 border-none text-white">
                      <FileSpreadsheet size={16} className="mr-1"/> تقرير المهمة
                  </Button>
                  <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md"><ListTodo size={32} /></div>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-start">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-bold">
                          <tr>
                              <th className="p-4 text-start">التاريخ</th>
                              <th className="p-4 text-start">الوصف</th>
                              <th className="p-4 text-start">القائم بالصرف</th>
                              <th className="p-4 text-start">مصدر الصرف (العهدة)</th>
                              <th className="p-4 text-start">القيمة</th>
                              <th className="p-4 text-start">الفاتورة</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                          {displayExpenses.map(exp => {
                              const adv = advances.find(a => a.id === exp.advanceId);
                              return (
                                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <td className="p-4 font-medium text-slate-500">{exp.date}</td>
                                      <td className="p-4 font-bold text-slate-800 dark:text-white">{exp.description}</td>
                                      <td className="p-4 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                          <img src={getStableAvatar(users.find(u => u.id === exp.userId)?.name || 'U')} className="w-6 h-6 rounded-full" />
                                          {users.find(u => u.id === exp.userId)?.name}
                                      </td>
                                      <td className="p-4 text-slate-600 dark:text-slate-300">
                                          {adv ? <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">{adv.description}</span> : '-'}
                                      </td>
                                      <td className="p-4 font-black text-slate-800 dark:text-white">{exp.amount.toLocaleString()}</td>
                                      <td className="p-4">
                                          {exp.imageUrl ? (
                                              <button onClick={() => setPreviewImage(exp.imageUrl!)} className="text-blue-600 hover:underline flex items-center gap-1"><ImageIcon size={14}/> عرض</button>
                                          ) : <span className="text-slate-400">-</span>}
                                      </td>
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

  // --- Breadcrumb Header ---
  const renderHeader = () => {
      const client = clients.find(c => c.id === selectedClientId);
      const project = projects.find(p => p.id === selectedProjectId);
      const task = tasks.find(t => t.id === selectedTaskId);

      return (
          <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-bold overflow-x-auto whitespace-nowrap pb-2">
                  <span onClick={() => { setViewMode('CLIENTS'); setSelectedClientId(null); }} className="cursor-pointer hover:text-blue-600 transition-colors">العملاء</span>
                  {client && <><ChevronRight size={14} className="rtl:rotate-180"/><span onClick={() => { setViewMode('PROJECTS'); setSelectedProjectId(null); }} className={`cursor-pointer hover:text-blue-600 transition-colors ${viewMode === 'PROJECTS' ? 'text-slate-800 dark:text-white' : ''}`}>{client.name}</span></>}
                  {project && <><ChevronRight size={14} className="rtl:rotate-180"/><span onClick={() => { setViewMode('TASKS'); setSelectedTaskId(null); }} className={`cursor-pointer hover:text-blue-600 transition-colors ${viewMode === 'TASKS' ? 'text-slate-800 dark:text-white' : ''}`}>{project.name}</span></>}
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
                      {viewMode === 'TASKS' && selectedProjectId && (
                          <Button onClick={handleExportProjectReport} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3">
                              <FileSpreadsheet size={16} className="mr-1"/> تقرير المشروع
                          </Button>
                      )}
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

      {/* --- Modals --- */}
      {/* 1. Add/Edit Client Modal */}
      {showClientModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scale-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold dark:text-white">{isEditingClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3><button onClick={() => setShowClientModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={20}/></button></div>
                  <form onSubmit={handleClientSubmit} className="space-y-4">
                      <div><label className="block text-xs font-bold mb-2">اسم العميل</label><input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      <div><label className="block text-xs font-bold mb-2">كود العميل</label><input required type="text" value={clientCode} onChange={e => setClientCode(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      <div><label className="block text-xs font-bold mb-2">لوجو العميل (اختياري)</label><input type="file" onChange={handleLogoUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>
                      <Button type="submit" className="w-full mt-4">حفظ</Button>
                  </form>
              </div>
          </div>
      )}

      {/* 2. Add/Edit Project Modal */}
      {showProjectModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scale-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold dark:text-white">{isEditingProject ? 'تعديل بيانات المشروع' : 'إضافة مشروع جديد'}</h3><button onClick={() => setShowProjectModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={20}/></button></div>
                  <form onSubmit={handleProjectSubmit} className="space-y-4">
                      <div><label className="block text-xs font-bold mb-2">اسم المشروع</label><input required type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      <div><label className="block text-xs font-bold mb-2">كود المشروع</label><input required type="text" value={projectCode} onChange={e => setProjectCode(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      <div><label className="block text-xs font-bold mb-2">الموقع</label><input required type="text" value={projectLocation} onChange={e => setProjectLocation(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      
                      <div>
                          <label className="block text-xs font-bold mb-2">مهندسين المشروع (صلاحية الصرف)</label>
                          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl max-h-48 overflow-y-auto custom-scrollbar space-y-2 border border-slate-200 dark:border-slate-700">
                              {allEngineers.map(eng => (
                                  <div key={eng.id} onClick={() => setSelectedEngineers(prev => prev.includes(eng.id) ? prev.filter(id => id !== eng.id) : [...prev, eng.id])} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedEngineers.includes(eng.id) ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'}`}>
                                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedEngineers.includes(eng.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'}`}>
                                          {selectedEngineers.includes(eng.id) && <CheckCircle size={14} className="text-white"/>}
                                      </div>
                                      <span className="text-sm font-medium">{eng.name}</span>
                                  </div>
                              ))}
                              {allEngineers.length === 0 && <p className="text-xs text-slate-400 text-center py-2">لا يوجد مهندسين متاحين</p>}
                          </div>
                      </div>

                      <Button type="submit" className="w-full mt-4" isLoading={isSubmitting}>
                          {isEditingProject ? <><Save size={18}/> حفظ التعديلات</> : <><Plus size={18}/> إنشاء المشروع</>}
                      </Button>
                  </form>
              </div>
          </div>
      )}

      {/* 3. Add/Edit Task Modal */}
      {showTaskModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scale-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold dark:text-white">{isEditingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3><button onClick={() => setShowTaskModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={20}/></button></div>
                  <form onSubmit={handleTaskSubmit} className="space-y-4">
                      <div><label className="block text-xs font-bold mb-2">اسم المهمة</label><input required type="text" value={taskName} onChange={e => setTaskName(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" /></div>
                      <div><label className="block text-xs font-bold mb-2">وصف المهمة</label><textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="input-modern w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none h-24" /></div>
                      <Button type="submit" className="w-full mt-4">حفظ</Button>
                  </form>
              </div>
          </div>
      )}

      {/* 4. Blocking Items Modal (Archive Warning) */}
      {showBlockingModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-fade-in" onClick={() => setShowBlockingModal(false)}>
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[90vh] border border-white/10" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20">
                      <div>
                          <h3 className="text-xl font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                              <AlertTriangle size={24} />
                              لا يمكن أرشفة المشروع
                          </h3>
                          <p className="text-sm text-red-500 dark:text-red-300 mt-1">يوجد متعلقات مالية (عهد/مصروفات) لم يتم تسويتها.</p>
                      </div>
                      <button onClick={() => setShowBlockingModal(false)} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 font-bold">يرجى تصفية العناصر التالية أولاً:</p>
                      {blockingItems.map((item: any, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-white">
                                      {item.description}
                                  </p>
                                  <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                      {item.remainingAmount !== undefined ? (
                                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">عهدة مفتوحة</span>
                                      ) : (
                                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">مصروف معلق</span>
                                      )}
                                      <span>{item.date}</span>
                                      <span>•</span>
                                      <span>{item.amount} ج.م</span>
                                  </div>
                              </div>
                              <div className="text-end">
                                  {item.remainingAmount !== undefined ? (
                                       <span className="text-xs font-bold text-slate-400 block">المتبقي: {item.remainingAmount}</span>
                                  ) : null}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                      <Button variant="secondary" onClick={() => setShowBlockingModal(false)}>حسناً، فهمت</Button>
                  </div>
              </div>
          </div>
      )}

      {previewImage && (<div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/95 p-4 animate-fade-in backdrop-blur-md" onClick={() => setPreviewImage(null)}><div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"><button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 p-2 rounded-full"><X size={24}/></button><img src={previewImage} alt="Receipt" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/10" /></div></div>)}
    </div>
  );
};
