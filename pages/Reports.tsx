
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Sector 
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useData } from '../contexts/DataContext';
import { 
  Filter, FileSpreadsheet, ChevronRight, ChevronDown, 
  Briefcase, User, Calendar, Folder, FileText, 
  Wallet, Layers, ArrowLeft, Building2, CheckCircle2,
  PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { ExpenseStatus, AdvanceStatus } from '../types';
import * as XLSX from 'xlsx';
import { CustomLoader } from '../components/CustomLoader';

// --- COLORS FOR CHARTS ---
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const Reports: React.FC = () => {
  const { t } = useLanguage();
  const { expenses, advances, projects, clients, users, tasks, isLoading } = useData(); 

  // --- FILTER STATES ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState('ALL');

  // --- UI STATES ---
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedChartAdvance, setSelectedChartAdvance] = useState<any | null>(null); // For Drill-down
  const [activeIndex, setActiveIndex] = useState(0); // For Pie Chart interaction

  // --- TOGGLE TREE NODES ---
  const toggleNode = (id: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedNodes(newSet);
  };

  // --- DATA PROCESSING (HIERARCHY) ---
  const reportData = useMemo(() => {
    // 1. Filter Base Data
    let filteredExpenses = expenses;
    let filteredAdvances = advances;

    // Apply strict date/user filters on the leaf nodes (expenses/advances)
    if (startDate) {
        filteredExpenses = filteredExpenses.filter(e => e.date >= startDate);
        filteredAdvances = filteredAdvances.filter(a => a.date >= startDate);
    }
    if (endDate) {
        filteredExpenses = filteredExpenses.filter(e => e.date <= endDate);
        filteredAdvances = filteredAdvances.filter(a => a.date <= endDate);
    }
    if (selectedUserId !== 'ALL') {
        filteredExpenses = filteredExpenses.filter(e => e.userId === selectedUserId);
        filteredAdvances = filteredAdvances.filter(a => a.userId === selectedUserId);
    }
    if (selectedTaskId !== 'ALL') {
        filteredExpenses = filteredExpenses.filter(e => e.taskId === selectedTaskId);
    }

    const hasActiveFilters = startDate || endDate || selectedUserId !== 'ALL' || selectedTaskId !== 'ALL';

    // 2. Build Hierarchy: Client -> Project -> Advance -> Expense
    const hierarchy = clients
      .filter(c => selectedClientId === 'ALL' || c.id === selectedClientId)
      .map(client => {
        const clientProjects = projects
          .filter(p => p.clientId === client.id)
          .filter(p => selectedProjectId === 'ALL' || p.id === selectedProjectId)
          .map(project => {
            const projectAdvances = filteredAdvances
              .filter(a => a.projectId === project.id)
              .map(advance => {
                const advanceExpenses = filteredExpenses.filter(e => e.advanceId === advance.id);
                const totalSpent = advanceExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
                
                if (selectedTaskId !== 'ALL' && advanceExpenses.length === 0) return null; 

                return {
                  ...advance,
                  expenses: advanceExpenses,
                  totalSpent
                };
              }).filter(Boolean) as any[];

            if (projectAdvances.length === 0 && hasActiveFilters) return null;

            return {
              ...project,
              advances: projectAdvances,
              totalProjectSpent: projectAdvances.reduce((sum, a) => sum + a.totalSpent, 0)
            };
          }).filter(Boolean) as any[];

        if (clientProjects.length === 0 && hasActiveFilters) return null;

        return {
          ...client,
          projects: clientProjects,
          totalClientSpent: clientProjects.reduce((sum, p) => sum + p.totalProjectSpent, 0)
        };
      }).filter(Boolean) as any[];

      return hierarchy;
  }, [clients, projects, advances, expenses, startDate, endDate, selectedClientId, selectedProjectId, selectedUserId, selectedTaskId]);

  // --- CHART DATA PREPARATION ---
  
  // 1. Level 1: All Advances (Bar Chart)
  const advancesChartData = useMemo(() => {
      const data: any[] = [];
      reportData.forEach(client => {
          client.projects.forEach((proj: any) => {
              proj.advances.forEach((adv: any) => {
                  data.push({
                      id: adv.id,
                      name: adv.description.length > 15 ? adv.description.substring(0, 15) + '..' : adv.description, 
                      fullName: adv.description,
                      amount: adv.amount,
                      spent: adv.totalSpent,
                      user: users.find(u => u.id === adv.userId)?.name,
                      project: proj.name,
                      rawData: adv 
                  });
              });
          });
      });
      return data;
  }, [reportData, users]);

  // 2. Level 2: Expenses Breakdown (Pie Chart) - Derived from selectedChartAdvance
  const expensesChartData = useMemo(() => {
      if (!selectedChartAdvance) return [];
      
      const categoryMap: Record<string, number> = {};
      selectedChartAdvance.expenses.forEach((exp: any) => {
          const key = exp.taskId 
            ? (tasks.find(t => t.id === exp.taskId)?.name || 'مهمة غير معروفة')
            : (exp.description.length > 20 ? exp.description.substring(0, 20) + '...' : exp.description);
            
          categoryMap[key] = (categoryMap[key] || 0) + exp.amount;
      });

      return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  }, [selectedChartAdvance, tasks]);


  // --- EXCEL EXPORT ---
  const handleExportExcel = () => {
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];

      // Headers
      wsData.push(["تقرير شامل - نظام بتروتك"]);
      wsData.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString()}`]);
      wsData.push([]);
      wsData.push(["العميل", "المشروع", "العهدة", "الموظف", "التاسك (المهمة)", "تاريخ المصروف", "بند المصروف", "القيمة", "الحالة"]);

      reportData.forEach(client => {
          client.projects.forEach((proj: any) => {
              if(proj.advances.length === 0) {
                 wsData.push([client.name, proj.name, "لا يوجد عهد", "-", "-", "-", "-", "-", "-"]);
              } else {
                  proj.advances.forEach((adv: any) => {
                      const empName = users.find(u => u.id === adv.userId)?.name || '-';
                      if (adv.expenses.length === 0) {
                          wsData.push([
                              client.name, 
                              proj.name, 
                              adv.description, 
                              empName, 
                              "-", 
                              adv.date, 
                              "رصيد عهدة (بدون مصروفات)", 
                              adv.amount, 
                              adv.status
                          ]);
                      } else {
                          adv.expenses.forEach((exp: any) => {
                              const taskName = exp.taskId ? tasks.find((t: any) => t.id === exp.taskId)?.name : '-';
                              wsData.push([
                                  client.name,
                                  proj.name,
                                  adv.description,
                                  empName,
                                  taskName,
                                  exp.date,
                                  exp.description,
                                  exp.amount,
                                  exp.status
                              ]);
                          });
                      }
                  });
              }
          });
          if(client.projects.length === 0) {
             wsData.push([client.name, "لا يوجد مشاريع", "-", "-", "-", "-", "-", "-", "-"]);
          }
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch: 20}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 30}, {wch: 10}, {wch: 12}];
      XLSX.utils.book_append_sheet(wb, ws, "Full Report");
      XLSX.writeFile(wb, `Petrotec_Full_Report_${Date.now()}.xlsx`);
  };

  // --- RENDER HELPERS ---
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
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-sm font-bold">
          {payload.name.substring(0, 10)}
        </text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize={12}>{`${value.toLocaleString()}`}</text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" fontSize={10}>
          {`(Rate ${(percent * 100).toFixed(0)}%)`}
        </text>
      </g>
    );
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
              <CustomLoader scale={1.5} />
              <p className="mt-8 text-slate-500 dark:text-slate-400 font-bold text-lg animate-pulse">جاري تحميل البيانات...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* 1. FILTER BAR */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-lg">
                  <Filter className="text-blue-600" size={24} />
                  <h3>تصفية البيانات (System Filter)</h3>
              </div>
              <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white shadow-green-500/20 px-6">
                  <FileSpreadsheet size={18} className="mr-2"/> تصدير Excel
              </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Clients */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">العميل</label>
                  <select value={selectedClientId} onChange={e => {setSelectedClientId(e.target.value); setSelectedProjectId('ALL');}} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ALL">كل العملاء</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              {/* Projects */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">المشروع</label>
                  <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ALL">كل المشاريع</option>
                      {projects
                        .filter(p => selectedClientId === 'ALL' || p.clientId === selectedClientId)
                        .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
              </div>
              {/* Users */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">الموظف</label>
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ALL">كل الموظفين</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
              </div>
              {/* Tasks */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">التاسك</label>
                  <select value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="ALL">كل التاسكات</option>
                      {tasks
                        .filter(t => selectedProjectId === 'ALL' || t.projectId === selectedProjectId)
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
              </div>
              {/* Date From */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">من تاريخ</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Date To */}
              <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">إلى تاريخ</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
          </div>
      </div>

      {/* 2. ADVANCED CHARTING (Drill-down) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden relative">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  {selectedChartAdvance ? (
                      <><button onClick={() => setSelectedChartAdvance(null)} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-full transition-colors"><ArrowLeft size={20}/></button> <span>تفاصيل مصروفات:</span> <span className="text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{selectedChartAdvance.description}</span></>
                  ) : (
                      <><BarChart3 className="text-indigo-500" /> تحليل العهد والمصروفات (إضغط على العمود للتفاصيل)</>
                  )}
              </h3>
          </div>
          
          <div className="h-96 w-full p-4 relative bg-slate-50/50 dark:bg-slate-900/50">
              {selectedChartAdvance ? (
                  // Detail View (Pie Chart for Advance Expenses)
                  expensesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                activeIndex={activeIndex}
                                activeShape={renderActiveShape}
                                data={expensesChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                paddingAngle={2}
                            >
                                {expensesChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <PieChartIcon size={48} className="mb-2 opacity-20" />
                        <p>لا توجد مصروفات مسجلة لهذه العهدة</p>
                    </div>
                  )
              ) : (
                  // Overview View (Bar Chart of Advances)
                  advancesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} interval={0} />
                            <YAxis tick={{fontSize: 10, fill: '#64748b'}} />
                            <Tooltip 
                                cursor={{fill: 'rgba(0,0,0,0.05)'}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-slate-800 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700">
                                                <p className="font-bold mb-1 text-sm">{data.fullName}</p>
                                                <p>قيمة العهدة: <span className="font-mono text-emerald-400">{data.amount.toLocaleString()}</span></p>
                                                <p>المصروف: <span className="font-mono text-amber-400">{data.spent.toLocaleString()}</span></p>
                                                <p className="text-slate-400 mt-1">{data.user} | {data.project}</p>
                                                <p className="mt-2 text-[10px] text-blue-300 italic">إضغط للعرض التفصيلي</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="amount" radius={[6, 6, 0, 0]} onClick={(data) => setSelectedChartAdvance(data.rawData)}>
                                {advancesChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cursor="pointer" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <BarChart3 size={64} className="mb-2 opacity-20" />
                        <p>لا توجد بيانات عهد لعرضها حالياً</p>
                    </div>
                  )
              )}
          </div>
      </div>

      {/* 3. REGISTRY-LIKE TREE VIEW */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Layers className="text-indigo-500" />
                  سجل البيانات الشجري (Tree View)
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                  {reportData.length} عملاء
              </span>
          </div>

          <div className="overflow-x-auto">
              <div className="min-w-[800px] text-sm">
                  {/* Header Row */}
                  <div className="flex items-center p-3 bg-slate-100 dark:bg-slate-950 font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex-1 pl-4">البيان (Hierarchy)</div>
                      <div className="w-32 text-center">التاريخ</div>
                      <div className="w-32 text-center">القيمة</div>
                      <div className="w-32 text-center">المصروف</div>
                      <div className="w-32 text-center">الحالة</div>
                  </div>

                  {reportData.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 flex flex-col items-center">
                          <Folder size={48} className="opacity-20 mb-2"/>
                          {clients.length === 0 ? "لا يوجد بيانات مسجلة في قاعدة البيانات" : "لا توجد بيانات مطابقة للفلاتر"}
                      </div>
                  ) : (
                      reportData.map(client => (
                          <React.Fragment key={client.id}>
                              {/* CLIENT ROW */}
                              <div 
                                  className="flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors group"
                                  onClick={() => toggleNode(client.id)}
                              >
                                  <div className="flex-1 flex items-center gap-2 font-black text-slate-800 dark:text-white text-base">
                                      {expandedNodes.has(client.id) ? <ChevronDown size={18} className="text-slate-400"/> : <ChevronRight size={18} className="text-slate-400 rtl:rotate-180"/>}
                                      <Building2 size={20} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                      {client.name}
                                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 rounded-full font-medium">{client.projects.length} مشاريع</span>
                                  </div>
                                  <div className="w-32 text-center text-slate-400 text-xs">-</div>
                                  <div className="w-32 text-center font-bold">-</div>
                                  <div className="w-32 text-center font-bold text-blue-600">{client.totalClientSpent.toLocaleString()}</div>
                                  <div className="w-32 text-center">-</div>
                              </div>

                              {/* PROJECTS ROWS */}
                              {expandedNodes.has(client.id) && client.projects.map((proj: any) => (
                                  <React.Fragment key={proj.id}>
                                      <div 
                                          className="flex items-center p-3 pr-10 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors border-r-4 border-r-blue-500/20 dark:border-r-blue-500/10"
                                          onClick={() => toggleNode(proj.id)}
                                      >
                                          <div className="flex-1 flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                              {expandedNodes.has(proj.id) ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400 rtl:rotate-180"/>}
                                              <Briefcase size={18} className="text-indigo-500" />
                                              {proj.name}
                                              <span className="text-[10px] font-normal text-slate-400">({proj.advances.length} عهد)</span>
                                          </div>
                                          <div className="w-32 text-center text-xs text-slate-500">{new Date(proj.createdAt).toLocaleDateString()}</div>
                                          <div className="w-32 text-center font-bold">-</div>
                                          <div className="w-32 text-center font-bold text-indigo-600">{proj.totalProjectSpent.toLocaleString()}</div>
                                          <div className="w-32 text-center"><span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded">{proj.status}</span></div>
                                      </div>

                                      {/* ADVANCES ROWS */}
                                      {expandedNodes.has(proj.id) && (
                                          proj.advances.length > 0 ? (
                                              proj.advances.map((adv: any) => (
                                                  <React.Fragment key={adv.id}>
                                                      <div 
                                                          className="flex items-center p-2.5 pr-20 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors bg-slate-50/30 dark:bg-slate-900/20"
                                                          onClick={() => toggleNode(adv.id)}
                                                      >
                                                          <div className="flex-1 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 text-sm">
                                                              {expandedNodes.has(adv.id) ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400 rtl:rotate-180"/>}
                                                              <Wallet size={16} className="text-emerald-500" />
                                                              {adv.description}
                                                              <span className="text-[10px] text-slate-400 flex items-center gap-1"><User size={10}/> {users.find(u => u.id === adv.userId)?.name}</span>
                                                          </div>
                                                          <div className="w-32 text-center text-xs text-slate-500">{adv.date}</div>
                                                          <div className="w-32 text-center font-bold text-slate-800 dark:text-white">{adv.amount.toLocaleString()}</div>
                                                          <div className="w-32 text-center font-bold text-emerald-600">{adv.totalSpent.toLocaleString()}</div>
                                                          <div className="w-32 text-center flex justify-center"><StatusBadge status={adv.status} /></div>
                                                      </div>

                                                      {/* EXPENSES ROWS (Leaf Nodes) */}
                                                      {expandedNodes.has(adv.id) && (
                                                          adv.expenses.length > 0 ? (
                                                              adv.expenses.map((exp: any) => (
                                                                  <div key={exp.id} className="flex items-center p-2 pr-32 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 border-b border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-950">
                                                                      <div className="flex-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                                                          <FileText size={14} className="text-slate-300" />
                                                                          <span className="font-bold">{exp.description}</span>
                                                                          {/* Task Indicator */}
                                                                          {exp.taskId && (
                                                                              <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-500">
                                                                                  <CheckCircle2 size={10} className="text-blue-500"/>
                                                                                  {tasks.find((t:any) => t.id === exp.taskId)?.name}
                                                                              </span>
                                                                          )}
                                                                      </div>
                                                                      <div className="w-32 text-center text-xs text-slate-400">{exp.date}</div>
                                                                      <div className="w-32 text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{exp.amount.toLocaleString()}</div>
                                                                      <div className="w-32 text-center"></div>
                                                                      <div className="w-32 text-center flex justify-center scale-90"><StatusBadge status={exp.status} /></div>
                                                                  </div>
                                                              ))
                                                          ) : (
                                                              <div className="pr-32 py-2 text-xs text-slate-400 italic bg-white dark:bg-slate-950">لا توجد مصروفات مسجلة</div>
                                                          )
                                                      )}
                                                  </React.Fragment>
                                              ))
                                          ) : (
                                              <div className="pr-20 py-3 text-xs text-slate-400 italic text-center">لا توجد عهد مسجلة لهذا المشروع</div>
                                          )
                                      )}
                                  </React.Fragment>
                              ))}
                          </React.Fragment>
                      ))
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
