
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Advance, Expense, Project, User, ExpenseStatus, AdvanceStatus, UserRole, AppNotification, Client, Task } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

interface DataContextType {
  users: User[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  advances: Advance[];
  expenses: Expense[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  
  redirectTarget: { page: string; itemId?: string; itemType?: 'ADVANCE' | 'EXPENSE'; timestamp: number } | null;
  clearRedirectTarget: () => void;
  setRedirect: (page: string, itemId: string, itemType: 'ADVANCE' | 'EXPENSE') => void;

  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<void>;
  editClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addProject: (project: Omit<Project, 'id' | 'status'>) => Promise<void>;
  editProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<{ success: boolean; blockedBy?: any[] }>;
  restoreProject: (projectId: string) => Promise<boolean>;
  
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<void>;
  editTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  
  addAdvance: (advance: Omit<Advance, 'id' | 'status' | 'remainingAmount' | 'date'>) => Promise<void>;
  createSubAdvance: (parentAdvanceId: string, technicianId: string, amount: number, description: string) => Promise<void>;
  editAdvance: (id: string, updates: Partial<Advance>) => Promise<void>;
  deleteAdvance: (id: string) => Promise<void>;
  
  addExpense: (expense: Omit<Expense, 'id' | 'status' | 'rejectionReason' | 'date'>) => Promise<void>;
  editExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  
  updateExpenseStatus: (expenseId: string, status: ExpenseStatus, reason?: string) => Promise<void>;
  toggleExpenseEditability: (expenseId: string, isEditable: boolean) => Promise<void>;
  
  updateAdvanceStatus: (advanceId: string, status: AdvanceStatus, rejectionReason?: string, receiptUrl?: string) => Promise<void>;
  closeAdvance: (advanceId: string, settlementData: any) => Promise<void>;
  
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  getMyTeam: () => User[];
  getStableAvatar: (name: string) => string; 
  isOffline: boolean;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();
  const { showNotification } = useNotification(); 
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allAdvances, setAllAdvances] = useState<Advance[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [redirectTarget, setRedirectTarget] = useState<{ page: string; itemId?: string; itemType?: 'ADVANCE' | 'EXPENSE'; timestamp: number } | null>(null);
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  
  const hasPlayedInitialSound = useRef(false);

  // Reset sound flag on user change
  useEffect(() => {
      hasPlayedInitialSound.current = false;
  }, [currentUser?.id]);

  // --- Offline Handler ---
  useEffect(() => {
    const handleOnline = () => { 
        setIsOffline(false); 
        showNotification('تم استعادة الاتصال بالإنترنت', 'success'); 
        processOfflineQueue(); 
        fetchData(true); 
    };
    const handleOffline = () => { setIsOffline(true); showNotification('انقطع الاتصال، سيتم حفظ الطلبات مؤقتاً', 'warning'); };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const processOfflineQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      if (queue.length === 0) return;
      
      showNotification(`جاري معالجة ${queue.length} طلبات معلقة...`, 'info');
      const newQueue = [];
      
      for (const req of queue) {
          try {
              const { table, data, type } = req;
              if (type === 'INSERT') await supabase.from(table).insert([data]);
              else if (type === 'UPDATE') await supabase.from(table).update(data).eq('id', data.id);
              else if (type === 'DELETE') await supabase.from(table).delete().eq('id', data.id);
          } catch (e) {
              console.error('Failed to process queued item', e);
              newQueue.push(req); // Keep failed items
          }
      }
      
      localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
      if(newQueue.length === 0) {
          showNotification('تمت مزامنة جميع البيانات بنجاح', 'success');
          fetchData();
      }
  };

  const addToQueue = (table: string, data: any, type: 'INSERT' | 'UPDATE' | 'DELETE') => {
      const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
      queue.push({ table, data, type, timestamp: Date.now() });
      localStorage.setItem('offlineQueue', JSON.stringify(queue));
      showNotification('تم حفظ الطلب وسيتم إرساله عند توفر الإنترنت', 'info');
  };

  const playNotificationSound = () => {
    if (currentUser?.preferences?.soundEnabled !== false) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play blocked:', e));
    }
  };

  const fetchData = useCallback(async (isReconnect = false) => {
    setIsLoading(true);
    try {
        const [
            { data: usersData },
            { data: clientsData },
            { data: projectsData },
            { data: tasksData },
            { data: advancesData },
            { data: expensesData }
        ] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('clients').select('*'),
            supabase.from('projects').select('*'),
            supabase.from('tasks').select('*'),
            supabase.from('advances').select('*'),
            supabase.from('expenses').select('*')
        ]);

        if (usersData) setAllUsers(usersData);
        if (clientsData) setAllClients(clientsData);
        if (projectsData) setAllProjects(projectsData);
        if (tasksData) setAllTasks(tasksData);
        if (advancesData) setAllAdvances(advancesData);
        if (expensesData) setAllExpenses(expensesData);

        if (currentUser) {
            const { data: notifData } = await supabase
                .from('notifications')
                .select('*')
                .eq('userId', currentUser.id)
                .order('createdAt', { ascending: false });
            
            if (notifData) {
                setNotifications(notifData);
                const unreadCount = notifData.filter(n => !n.isRead).length;
                if (unreadCount > 0 && !hasPlayedInitialSound.current) {
                    playNotificationSound();
                    hasPlayedInitialSound.current = true;
                    if(isReconnect) showNotification(`لديك ${unreadCount} إشعارات جديدة`, 'info');
                }
            }
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
      fetchData(); 
      if (!currentUser) return;

      const channel = supabase.channel('global-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
          if (['advances', 'expenses', 'projects', 'clients', 'tasks', 'users'].includes(payload.table)) {
             await fetchData();
          }
          
          if (payload.table === 'notifications' && payload.eventType === 'INSERT') {
              const newNotif = payload.new as AppNotification;
              if (newNotif.userId === currentUser.id) {
                  playNotificationSound();
                  showNotification(newNotif.message, newNotif.type as any);
                  await fetchData(); 
              }
          }
      })
      .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, fetchData]); 

  // --- MEMOIZED FILTERS (Prevents Infinite Re-renders) ---
  const activeUserList = useMemo(() => allUsers.length > 0 ? allUsers : (currentUser ? [currentUser] : []), [allUsers, currentUser]);

  const filteredProjects = useMemo(() => allProjects.filter(p => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) { return true; }
    if (currentUser.role === UserRole.MAIN_CUSTODY) { return (p.assignedEngineers && p.assignedEngineers.includes(currentUser.id)); }
    if (currentUser.role === UserRole.SUB_CUSTODY) { 
        return p.assignedEngineers && p.assignedEngineers.includes(currentUser.managerId || '');
    }
    return false;
  }), [allProjects, currentUser]);

  const filteredUsers = useMemo(() => activeUserList.filter(u => {
      if (!currentUser) return false;
      if (u.isDeleted) return false; 
      if (u.id === currentUser.id) return true; 
      if (currentUser.role === UserRole.ADMIN) return true; 
      if (currentUser.role === UserRole.MAIN_CUSTODY) return u.managerId === currentUser.id || u.role === UserRole.SUB_CUSTODY; 
      return false; 
  }), [activeUserList, currentUser]);

  const filteredAdvances = useMemo(() => allAdvances.filter(a => {
      if (!currentUser) return false;
      if (currentUser.role === UserRole.ADMIN) return true;
      if (currentUser.role === UserRole.MAIN_CUSTODY) {
          if (a.userId === currentUser.id) return true; 
          if (a.parentAdvanceId) {
              const parentAdv = allAdvances.find(p => p.id === a.parentAdvanceId);
              if (parentAdv && parentAdv.userId === currentUser.id) return true;
          }
          return false;
      }
      if (currentUser.role === UserRole.SUB_CUSTODY) return a.userId === currentUser.id;
      return false;
  }), [allAdvances, currentUser]);
  
  const filteredExpenses = useMemo(() => allExpenses.filter(e => {
      if (currentUser?.role === UserRole.SUB_CUSTODY) {
          return e.userId === currentUser.id;
      }
      if (currentUser?.role === UserRole.MAIN_CUSTODY) {
          if (e.userId === currentUser.id) return true;
          const advance = allAdvances.find(a => a.id === e.advanceId);
          if (advance && advance.parentAdvanceId) {
              const parentAdv = allAdvances.find(p => p.id === advance.parentAdvanceId);
              if (parentAdv && parentAdv.userId === currentUser.id) return true;
          }
      }
      return filteredAdvances.some(a => a.id === e.advanceId);
  }), [allExpenses, allAdvances, filteredAdvances, currentUser]);

  const getStableAvatar = (name: string) => {
    if (!name) return `https://ui-avatars.com/api/?name=NA&background=000&color=fff`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const color = "00000".substring(0, 6 - c.length) + c;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&bold=true&size=128`;
  };

  // --- CRUD Operations ---
  const addClient = async (data: Omit<Client, 'id' | 'createdAt'>) => {
      if (isOffline) { addToQueue('clients', data, 'INSERT'); return; }
      const { data: newClient, error } = await supabase.from('clients').insert([data]).select().single();
      if (error) showNotification('فشل إضافة العميل', 'error');
      else { setAllClients(prev => [...prev, newClient]); showNotification('تم إضافة العميل بنجاح', 'success'); }
  };

  const editClient = async (id: string, updates: Partial<Client>) => {
      if (isOffline) { addToQueue('clients', { ...updates, id }, 'UPDATE'); return; }
      const { error } = await supabase.from('clients').update(updates).eq('id', id);
      if (error) showNotification('فشل تعديل العميل', 'error');
      else { setAllClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); showNotification('تم تعديل بيانات العميل', 'success'); }
  };

  const deleteClient = async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) { 
        console.error(error);
        showNotification('فشل حذف العميل', 'error'); 
      }
      else { 
        setAllClients(prev => prev.filter(c => c.id !== id)); 
        showNotification('تم حذف العميل بنجاح', 'success'); 
      }
  };

  const addProject = async (data: Omit<Project, 'id' | 'status'>) => {
    const managerId = currentUser?.id;
    const payload = { ...data, managerId, status: 'ACTIVE', assignedEngineers: data.assignedEngineers || [] };
    if (isOffline) { addToQueue('projects', payload, 'INSERT'); return; }
    const { data: newProject, error } = await supabase.from('projects').insert([payload]).select().single();
    if (error) { showNotification('فشل إضافة المشروع', 'error'); } 
    else { setAllProjects(prev => [...prev, newProject]); showNotification('تم إضافة المشروع وتعيين المهندسين', 'success'); }
  };

  const editProject = async (id: string, updates: Partial<Project>) => {
      if (isOffline) { addToQueue('projects', { ...updates, id }, 'UPDATE'); return; }
      const { error } = await supabase.from('projects').update(updates).eq('id', id);
      if (error) showNotification('فشل تعديل المشروع', 'error');
      else { setAllProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); showNotification('تم تحديث بيانات المشروع', 'success'); }
  };

  const deleteProject = async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) { 
        console.error(error);
        showNotification('فشل حذف المشروع', 'error'); 
      }
      else { 
        setAllProjects(prev => prev.filter(p => p.id !== id)); 
        showNotification('تم حذف المشروع بنجاح', 'success'); 
      }
  };

  const archiveProject = async (projectId: string): Promise<{ success: boolean; blockedBy?: any[] }> => {
      // 1. Check for OPEN Advances linked to this project
      const blockingAdvances = allAdvances.filter(a => a.projectId === projectId && a.status === AdvanceStatus.OPEN);
      
      // 2. Check for PENDING Expenses linked to tasks within this project
      const projectTasks = allTasks.filter(t => t.projectId === projectId).map(t => t.id);
      const blockingExpenses = allExpenses.filter(exp => {
          if (exp.taskId && projectTasks.includes(exp.taskId)) { 
              return exp.status === ExpenseStatus.PENDING; 
          }
          // Also check expenses directly on advances of this project if any (edge case)
          const parentAdv = allAdvances.find(a => a.id === exp.advanceId);
          if (parentAdv && parentAdv.projectId === projectId) {
              return exp.status === ExpenseStatus.PENDING;
          }
          return false;
      });

      const blockingItems = [...blockingAdvances, ...blockingExpenses];
      
      if (blockingItems.length > 0) {
          // Return the blocking items so the UI can display them
          return { success: false, blockedBy: blockingItems };
      }
      
      // Proceed to Archive
      const { error } = await supabase.from('projects').update({ status: 'ARCHIVED' }).eq('id', projectId); 
      if (error) { 
          showNotification('فشل أرشفة المشروع', 'error'); 
          return { success: false }; 
      } 
      
      setAllProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'ARCHIVED' as any } : p));
      showNotification('تم نقل المشروع للأرشيف', 'success'); 
      return { success: true }; 
  };

  const restoreProject = async (projectId: string): Promise<boolean> => {
      const { error } = await supabase.from('projects').update({ status: 'ACTIVE' }).eq('id', projectId); 
      if (error) { showNotification('فشل استعادة المشروع', 'error'); return false; } 
      setAllProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'ACTIVE' as any } : p));
      showNotification('تم استعادة المشروع بنجاح', 'success'); return true; 
  };
  
  const addTask = async (data: Omit<Task, 'id' | 'status'>) => {
      if (isOffline) { addToQueue('tasks', data, 'INSERT'); return; }
      const { data: newTask, error } = await supabase.from('tasks').insert([data]).select().single();
      if (error) showNotification('فشل إضافة المهمة', 'error');
      else { setAllTasks(prev => [...prev, newTask]); showNotification('تم إضافة المهمة بنجاح', 'success'); }
  };

  const editTask = async (id: string, updates: Partial<Task>) => {
      if (isOffline) { addToQueue('tasks', { ...updates, id }, 'UPDATE'); return; }
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) showNotification('فشل تعديل المهمة', 'error');
      else { setAllTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)); showNotification('تم تعديل المهمة بنجاح', 'success'); }
  };

  const deleteTask = async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        console.error(error);
        showNotification('فشل حذف المهمة', 'error');
      }
      else {
        setAllTasks(prev => prev.filter(t => t.id !== id));
        showNotification('تم حذف المهمة بنجاح', 'success');
      }
  };

  const addUser = async (data: Omit<User, 'id'>) => { 
      const avatarUrl = getStableAvatar(data.name); 
      let managerId = data.managerId; 
      let rootAdminId = currentUser?.rootAdminId || currentUser?.id; 
      if (currentUser?.role === UserRole.MAIN_CUSTODY) { managerId = currentUser.id; } 
      else if (currentUser?.role === UserRole.ADMIN) { if (!managerId) managerId = currentUser.id; rootAdminId = currentUser.id; } 
      const payload = { ...data, avatarUrl, managerId, rootAdminId };
      if (isOffline) { addToQueue('users', payload, 'INSERT'); return; }
      const { data: newUser, error } = await supabase.from('users').insert([payload]).select().single(); 
      if (error) { showNotification('فشل إضافة المستخدم', 'error'); } 
      else { setAllUsers(prev => [...prev, newUser]); showNotification('تم إضافة المستخدم بنجاح', 'success'); } 
  };

  const deleteUser = async (userId: string) => { 
      const { error } = await supabase.from('users').update({ isDeleted: true }).eq('id', userId); 
      if (error) showNotification('فشل الحذف', 'error'); 
      else { setAllUsers(prev => prev.filter(u => u.id !== userId)); showNotification('تم حذف المستخدم بنجاح', 'success'); } 
  };

  const addAdvance = async (data: Omit<Advance, 'id' | 'status' | 'remainingAmount' | 'date'>) => {
    let initialStatus = AdvanceStatus.PENDING;
    if (currentUser?.role === UserRole.ADMIN) { initialStatus = AdvanceStatus.OPEN; } 
    else if (currentUser?.role === UserRole.MAIN_CUSTODY) { initialStatus = AdvanceStatus.PENDING; }
    const payload = { ...data, status: initialStatus, remainingAmount: Number(data.amount), date: new Date().toISOString().split('T')[0] };
    if (isOffline) { addToQueue('advances', payload, 'INSERT'); return; }
    const { data: newAdvData, error } = await supabase.from('advances').insert([payload]).select().single();
    if (error) { showNotification('فشل العملية', 'error'); fetchData(); } 
    else { 
        setAllAdvances(prev => [...prev, newAdvData]); 
        showNotification('تمت العملية بنجاح', 'success'); 
        let notifyTargetId = currentUser?.rootAdminId;
        if (currentUser?.role === UserRole.SUB_CUSTODY) notifyTargetId = currentUser.managerId; 
        if (notifyTargetId && notifyTargetId !== currentUser?.id) {
            await supabase.from('notifications').insert([{
                userId: notifyTargetId,
                title: 'طلب عهدة جديد',
                message: `قام ${currentUser?.name} بطلب عهدة جديدة: ${data.description}`,
                type: 'info',
                targetPage: 'advances',
                targetId: newAdvData.id
            }]);
        }
    }
  };

  const createSubAdvance = async (parentAdvanceId: string, technicianId: string, amount: number, description: string) => {
      const parentAdv = allAdvances.find(a => a.id === parentAdvanceId);
      if (!parentAdv) { showNotification('العهدة الأم غير موجودة', 'error'); return; }
      if (parentAdv.remainingAmount < amount) { showNotification('رصيد العهدة غير كافٍ لتخصيص هذا المبلغ', 'error'); return; }
      const newParentRemaining = Number(parentAdv.remainingAmount) - Number(amount);
      const { error: parentError } = await supabase.from('advances').update({ remainingAmount: newParentRemaining }).eq('id', parentAdvanceId);
      if (parentError) { showNotification('فشل تحديث العهدة الأم', 'error'); return; }
      setAllAdvances(prev => prev.map(a => a.id === parentAdvanceId ? { ...a, remainingAmount: newParentRemaining } : a));
      const subAdvancePayload = { projectId: parentAdv.projectId, userId: technicianId, amount: amount, remainingAmount: amount, description: description, status: AdvanceStatus.OPEN, date: new Date().toISOString().split('T')[0], parentAdvanceId: parentAdvanceId };
      const { data: newSubAdv, error: subError } = await supabase.from('advances').insert([subAdvancePayload]).select().single();
      if (subError) { showNotification('فشل إنشاء العهدة الفرعية', 'error'); fetchData(); } 
      else {
          setAllAdvances(prev => [...prev, newSubAdv]);
          showNotification('تم تخصيص العهدة للمساعد بنجاح', 'success');
          await supabase.from('notifications').insert([{ userId: technicianId, title: 'تم استلام عهدة فرعية', message: `قام المهندس ${currentUser?.name} بتخصيص عهدة لك: ${description}`, type: 'success', targetPage: 'advances', targetId: newSubAdv.id }]);
      }
  };

  const editAdvance = async (id: string, updates: Partial<Advance>) => { 
      if (isOffline) { addToQueue('advances', { ...updates, id }, 'UPDATE'); return; }
      const { error } = await supabase.from('advances').update(updates).eq('id', id); 
      if (error) showNotification('فشل التعديل', 'error'); 
      else { setAllAdvances(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a)); showNotification('تم التعديل بنجاح', 'success'); } 
  };

  const deleteAdvance = async (id: string) => {
      if (isOffline) { addToQueue('advances', { id }, 'DELETE'); return; }
      const { error } = await supabase.from('advances').delete().eq('id', id);
      if (error) showNotification('فشل الحذف', 'error');
      else { setAllAdvances(prev => prev.filter(a => a.id !== id)); }
  };

  const addExpense = async (data: Omit<Expense, 'id' | 'status' | 'rejectionReason' | 'date'>) => { 
      const payload = { ...data, userId: currentUser?.id, date: new Date().toISOString().split('T')[0], status: ExpenseStatus.PENDING };
      if (isOffline) { addToQueue('expenses', payload, 'INSERT'); return; }
      const { data: newExp, error } = await supabase.from('expenses').insert([payload]).select().single(); 
      if (error) showNotification('فشل التسجيل', 'error'); 
      else { 
          setAllExpenses(prev => [...prev, newExp]); 
          showNotification('تم التسجيل بنجاح', 'success'); 
          let notifyTargetId = currentUser?.rootAdminId;
          const advance = allAdvances.find(a => a.id === data.advanceId);
          if (advance && advance.parentAdvanceId) {
              const parentAdv = allAdvances.find(p => p.id === advance.parentAdvanceId);
              if (parentAdv) notifyTargetId = parentAdv.userId; 
          } else if (currentUser?.role === UserRole.SUB_CUSTODY) {
              notifyTargetId = currentUser.managerId; 
          }
          if (notifyTargetId && notifyTargetId !== currentUser?.id) {
              await supabase.from('notifications').insert([{ userId: notifyTargetId, title: 'مصروف جديد معلق', message: `قام ${currentUser?.name} بإضافة مصروف جديد: ${data.description}`, type: 'warning', targetPage: 'dashboard', targetId: newExp.id }]);
          }
      } 
  };

  const editExpense = async (id: string, updates: Partial<Expense>) => { 
      const payload = { ...updates, id };
      // Reset status to PENDING on edit if it was REJECTED, so it goes back for approval
      if (updates.status === undefined) {
          payload.status = ExpenseStatus.PENDING;
      }
      
      if (isOffline) { addToQueue('expenses', payload, 'UPDATE'); return; }
      const { error } = await supabase.from('expenses').update(payload).eq('id', id); 
      if (error) showNotification('فشل التعديل', 'error'); 
      else { 
          setAllExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates, status: ExpenseStatus.PENDING } : e)); 
          showNotification('تم التعديل وإعادة الإرسال', 'success'); 
          
          // Notify Manager/Admin again
          const expense = allExpenses.find(e => e.id === id);
          if (expense) {
              let notifyTargetId = currentUser?.rootAdminId;
              const advance = allAdvances.find(a => a.id === expense.advanceId);
              if (advance && advance.parentAdvanceId) {
                  const parentAdv = allAdvances.find(p => p.id === advance.parentAdvanceId);
                  if (parentAdv) notifyTargetId = parentAdv.userId; 
              } else if (currentUser?.role === UserRole.SUB_CUSTODY) {
                  notifyTargetId = currentUser.managerId; 
              }
              if (notifyTargetId && notifyTargetId !== currentUser?.id) {
                  await supabase.from('notifications').insert([{ userId: notifyTargetId, title: 'مصروف معدل', message: `قام ${currentUser?.name} بتعديل مصروف: ${expense.description}`, type: 'warning', targetPage: 'dashboard', targetId: id }]);
              }
          }
      } 
  };

  const updateExpenseStatus = async (expenseId: string, status: ExpenseStatus, reason?: string) => { 
      const expense = allExpenses.find(e => e.id === expenseId);
      if (!expense) return;
      const { error } = await supabase.from('expenses').update({ status, rejectionReason: reason, isEditable: false }).eq('id', expenseId); 
      if (!error) {
          setAllExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status, rejectionReason: reason } : e));
          if (status === ExpenseStatus.APPROVED) { 
              const advance = allAdvances.find(a => a.id === expense.advanceId); 
              if (advance) { 
                  const newRemaining = Number(advance.remainingAmount) - Number(expense.amount); 
                  setAllAdvances(prev => prev.map(a => a.id === advance.id ? { ...a, remainingAmount: newRemaining } : a)); 
                  await supabase.from('advances').update({ remainingAmount: newRemaining }).eq('id', advance.id); 
              }
              if (expense.userId !== currentUser?.id) {
                  await supabase.from('notifications').insert([{ userId: expense.userId, title: 'تم قبول المصروف', message: `تمت الموافقة على المصروف: ${expense.description}`, type: 'success', targetPage: 'dashboard', targetId: expense.id }]);
              }
          } else if (status === ExpenseStatus.REJECTED) {
              if (expense.userId !== currentUser?.id) {
                  await supabase.from('notifications').insert([{ userId: expense.userId, title: 'تم رفض المصروف', message: `تم رفض المصروف: ${expense.description}. السبب: ${reason}`, type: 'error', targetPage: 'dashboard', targetId: expense.id }]);
              }
          }
      }
  };

  const toggleExpenseEditability = async (expenseId: string, isEditable: boolean) => { 
      await supabase.from('expenses').update({ isEditable }).eq('id', expenseId); 
      setAllExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, isEditable } : e));
      showNotification(isEditable ? 'تم فتح التعديل' : 'تم قفل التعديل', 'info'); 
  };

  const updateAdvanceStatus = async (advanceId: string, status: AdvanceStatus, reason?: string, receiptUrl?: string) => { 
      const advance = allAdvances.find(a => a.id === advanceId);
      if(!advance) return;
      const updatePayload: any = { status, rejectionReason: reason };
      if (receiptUrl) updatePayload.transferReceiptUrl = receiptUrl;
      await supabase.from('advances').update(updatePayload).eq('id', advanceId); 
      setAllAdvances(prev => prev.map(a => a.id === advanceId ? { ...a, ...updatePayload } : a));
      if (status === AdvanceStatus.OPEN) {
          if (advance.userId !== currentUser?.id) {
              await supabase.from('notifications').insert([{ userId: advance.userId, title: 'تم صرف العهدة', message: `تمت الموافقة على العهدة: ${advance.description}`, type: 'success', targetPage: 'advances', targetId: advance.id }]);
          }
      } 
  };

  const closeAdvance = async (advanceId: string, settlementData: any) => { 
      const { error } = await supabase.from('advances').update({ status: AdvanceStatus.CLOSED, settlementData }).eq('id', advanceId); 
      if (!error) { 
          setAllAdvances(prev => prev.map(a => a.id === advanceId ? { ...a, status: AdvanceStatus.CLOSED, settlementData } : a));
          const oldAdvance = allAdvances.find(a => a.id === advanceId); 
          if (oldAdvance && settlementData.deficitAmount > 0) { 
              const newDeficitAdvance = { projectId: oldAdvance.projectId, userId: oldAdvance.userId, amount: Number(settlementData.deficitAmount), remainingAmount: Number(settlementData.deficitAmount), description: `تسوية عجز: ${oldAdvance.description}`, status: AdvanceStatus.OPEN, date: new Date().toISOString().split('T')[0], parentAdvanceId: oldAdvance.parentAdvanceId }; 
              const { data: newAdv } = await supabase.from('advances').insert([newDeficitAdvance]).select().single(); 
              if(newAdv) setAllAdvances(prev => [...prev, newAdv]);
              showNotification('تم ترحيل العجز لعهدة جديدة', 'warning'); 
          } 
      } 
  };

  const markNotificationAsRead = async (id: string) => { setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n)); await supabase.from('notifications').update({ isRead: true }).eq('id', id); };
  const markAllNotificationsAsRead = async () => { setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); if (currentUser) { await supabase.from('notifications').update({ isRead: true }).eq('userId', currentUser.id); } };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const clearRedirectTarget = () => setRedirectTarget(null);
  const setRedirect = (page: string, itemId: string, itemType: 'ADVANCE' | 'EXPENSE') => {
      setRedirectTarget({ page, itemId, itemType, timestamp: Date.now() });
  };

  return (
    <DataContext.Provider value={{ 
        users: filteredUsers.filter(u => u.id !== currentUser?.id), 
        clients: allClients,
        projects: filteredProjects, 
        tasks: allTasks,
        advances: filteredAdvances, 
        expenses: filteredExpenses, 
        notifications, 
        unreadNotificationsCount, 
        redirectTarget, 
        clearRedirectTarget, 
        setRedirect, 
        addClient,
        editClient,
        deleteClient,
        addProject, 
        editProject, 
        deleteProject,
        archiveProject, 
        restoreProject,
        addTask,
        editTask,
        deleteTask,
        addUser, 
        deleteUser, 
        addAdvance,
        createSubAdvance,
        editAdvance, 
        deleteAdvance,
        addExpense, 
        editExpense, 
        updateExpenseStatus, 
        toggleExpenseEditability, 
        updateAdvanceStatus, 
        closeAdvance, 
        markNotificationAsRead, 
        markAllNotificationsAsRead, 
        getMyTeam: () => filteredUsers.filter(u => u.id !== currentUser?.id), 
        getStableAvatar,
        isOffline,
        isLoading
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => { const context = useContext(DataContext); if (context === undefined) throw new Error('useData must be used within a DataProvider'); return context; };
