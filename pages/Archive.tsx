
import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageProvider';
import { Briefcase, MapPin, Archive as ArchiveIcon, Download, FileSpreadsheet, X, Wallet, FileText, ArrowDown, ChevronRight, RefreshCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExpenseStatus } from '../types';
import { Button } from '../components/Button';

export const Archive: React.FC = () => {
  const { t } = useLanguage();
  const { projects, advances, expenses, users, restoreProject } = useData();
  
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<string | null>(null);
  const [expandedAdvanceId, setExpandedAdvanceId] = useState<string | null>(null);

  // Filter Archived Projects Only - Status Based
  const archivedProjects = projects.filter(p => p.status === 'ARCHIVED');

  // --- EXPORT FULL PROJECT REPORT ---
  const exportFullProjectReport = (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const projectAdvances = advances.filter(a => a.projectId === projectId);
      
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summaryData: any[][] = [
          [{ v: "PETROTEC ENGINEERING - Project Archive Report", t: "s" }],
          [],
          ["Project Name", project.name],
          ["Location", project.location],
          ["Archived Date", new Date().toLocaleDateString()],
          [],
          ["Advance Description", "Employee", "Date", "Status", "Amount", "Spent", "Returned", "Deficit"]
      ];

      projectAdvances.forEach(adv => {
          const advExpenses = expenses.filter(e => e.advanceId === adv.id);
          const totalSpent = advExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
          const deficit = adv.settlementData?.deficitAmount || 0;
          const returned = adv.settlementData?.returnedCashAmount || 0;
          const user = users.find(u => u.id === adv.userId)?.name || adv.userId;

          summaryData.push([
              adv.description,
              user,
              adv.date,
              adv.status,
              adv.amount,
              totalSpent,
              returned,
              deficit
          ]);
      });

      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWS['!cols'] = [{wch: 30}, {wch: 20}, {wch: 15}, {wch: 10}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}];
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

      // Sheet 2: Expenses Log
      const expensesData: any[][] = [
          ["Advance", "Expense Description", "Date", "Amount", "Status", "Notes", "Type"]
      ];

      // Sheet 3: Itemized Breakdown
      const itemizedData: any[][] = [
          ["Advance", "Expense Desc", "Item Name", "Quantity", "Unit Price", "Line Total", "Status"]
      ];

      projectAdvances.forEach(adv => {
          const advExpenses = expenses.filter(e => e.advanceId === adv.id);
          advExpenses.forEach(exp => {
              // Add to Sheet 2
              expensesData.push([
                  adv.description,
                  exp.description,
                  exp.date,
                  exp.amount,
                  exp.status,
                  exp.notes || "",
                  exp.isInvoice ? "Invoice" : "Fixed"
              ]);

              // Add to Sheet 3 (If Invoice)
              if (exp.isInvoice && exp.invoiceItems) {
                  exp.invoiceItems.forEach(item => {
                      itemizedData.push([
                          adv.description,
                          exp.description,
                          item.itemName,
                          item.quantity,
                          item.unitPrice,
                          item.total,
                          exp.status
                      ]);
                  });
                  if (exp.additionalAmount && exp.additionalAmount > 0) {
                      itemizedData.push([adv.description, exp.description, "Additional Charges", 1, exp.additionalAmount, exp.additionalAmount, exp.status]);
                  }
              } else {
                  // Fixed expenses go to itemized as single line
                  itemizedData.push([
                      adv.description,
                      exp.description,
                      "Fixed Expense",
                      1,
                      exp.amount,
                      exp.amount,
                      exp.status
                  ]);
              }
          });
      });

      const expensesWS = XLSX.utils.aoa_to_sheet(expensesData);
      expensesWS['!cols'] = [{wch: 30}, {wch: 30}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 40}, {wch: 10}];
      XLSX.utils.book_append_sheet(wb, expensesWS, "Expenses Log");

      const itemizedWS = XLSX.utils.aoa_to_sheet(itemizedData);
      itemizedWS['!cols'] = [{wch: 25}, {wch: 25}, {wch: 30}, {wch: 10}, {wch: 12}, {wch: 12}, {wch: 12}];
      XLSX.utils.book_append_sheet(wb, itemizedWS, "Itemized Details");

      XLSX.writeFile(wb, `Archive_Report_${project.name}.xlsx`);
  };

  const handleRestore = async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      if(confirm(t('restoreConfirm'))) {
          await restoreProject(projectId);
      }
  };

  // --- Reuse Details Logic ---
  const projectDetails = useMemo(() => {
      if(!selectedProjectForDetails) return null;
      const project = projects.find(p => p.id === selectedProjectForDetails);
      if(!project) return null;

      const projectAdvances = advances.filter(a => a.projectId === project.id);
      
      const advancesWithExpenses = projectAdvances.map(adv => {
          const advExpenses = expenses.filter(e => e.advanceId === adv.id);
          const totalSpent = advExpenses.filter(e => e.status === ExpenseStatus.APPROVED).reduce((sum, e) => sum + e.amount, 0);
          
          let deficit = 0;
          let returned = 0;
          if (adv.settlementData) {
              deficit = adv.settlementData.deficitAmount || 0;
              returned = adv.settlementData.returnedCashAmount || 0;
          }

          return {
              ...adv,
              expenses: advExpenses,
              totalSpent,
              deficit,
              returned
          };
      });

      return { project, advances: advancesWithExpenses };
  }, [selectedProjectForDetails, projects, advances, expenses]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 shadow-sm"><ArchiveIcon size={24} /></div>
            {t('archive')} <span className="text-sm font-normal text-slate-400">({archivedProjects.length})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {archivedProjects.map(proj => (
            <div 
                key={proj.id} 
                onClick={() => setSelectedProjectForDetails(proj.id)}
                className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4 group transition-all duration-300 hover:shadow-lg cursor-pointer relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 bg-slate-200 dark:bg-slate-700 px-4 py-1 rounded-bl-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('archivedLabel')}</div>
                
                <div className="flex items-start justify-between mt-2">
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-2xl">
                        <Briefcase size={24} />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={(e) => handleRestore(e, proj.id)}
                            className="text-blue-600 hover:text-blue-700 p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-2"
                            title={t('restore')}
                        >
                            <RefreshCcw size={20} />
                        </button>
                        <button 
                            onClick={(e) => exportFullProjectReport(e, proj.id)}
                            className="text-green-600 hover:text-green-700 p-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-all flex items-center gap-2"
                            title={t('exportExcel')}
                        >
                            <FileSpreadsheet size={20} />
                        </button>
                    </div>
                </div>
                <div>
                    <h3 className="font-black text-xl text-slate-700 dark:text-slate-200 line-through decoration-slate-400 decoration-2">{proj.name}</h3>
                    <div className="flex items-center gap-2 text-slate-400 text-sm mt-2 font-medium">
                        <MapPin size={16} />
                        <span>{proj.location}</span>
                    </div>
                </div>
            </div>
        ))}
        {archivedProjects.length === 0 && (
            <div className="col-span-full py-24 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center">
                <ArchiveIcon size={64} className="mb-4 opacity-20" />
                <p className="font-bold">{t('noArchivedProjects')}</p>
            </div>
        )}
      </div>

      {/* --- ARCHIVE DETAILS MODAL (Same Layout as Projects) --- */}
      {selectedProjectForDetails && projectDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setSelectedProjectForDetails(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border border-white/10 modal-overlay" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20">
                      <div>
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                              <ArchiveIcon size={24} className="text-amber-600" />
                              {projectDetails.project.name}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                              <MapPin size={14} /> {projectDetails.project.location}
                          </p>
                      </div>
                      <div className="flex gap-2">
                          <Button onClick={(e) => {exportFullProjectReport(e, projectDetails.project.id)}} className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2">
                              <Download size={16} className="mr-2"/> Report
                          </Button>
                          <button onClick={() => setSelectedProjectForDetails(null)} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:text-red-500 shadow-sm"><X size={24} /></button>
                      </div>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                      {projectDetails.advances.map(adv => (
                          <div key={adv.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm opacity-90">
                              <div 
                                className="p-5 flex flex-col md:flex-row items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                onClick={() => setExpandedAdvanceId(expandedAdvanceId === adv.id ? null : adv.id)}
                              >
                                  <div className="flex items-center gap-4 w-full md:w-auto">
                                      <div className={`p-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700`}>
                                          <Wallet size={20} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                              {adv.description}
                                              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 px-2 py-0.5 rounded-full">{adv.status}</span>
                                          </h4>
                                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                              <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-2 py-0.5 rounded">{t('originalAmount')}: {adv.amount.toLocaleString()}</span>
                                              <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-0.5 rounded">{t('projectTotalSpent')}: {adv.totalSpent.toLocaleString()}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-4 md:mt-0 w-full md:w-auto justify-end">
                                       <div className="text-end">
                                           <div className="text-xs text-slate-400 mb-1">{t('deficit')} / {t('returned')}</div>
                                           <div className="font-mono font-bold text-slate-700 dark:text-white">
                                               <span className="text-red-500">{adv.deficit.toLocaleString()}</span> / <span className="text-green-500">{adv.returned.toLocaleString()}</span>
                                           </div>
                                       </div>
                                       {expandedAdvanceId === adv.id ? <ChevronRight size={20} className="rotate-90 text-slate-400 transition-transform" /> : <ChevronRight size={20} className="text-slate-400 transition-transform" />}
                                  </div>
                              </div>

                              {/* Expanded Expenses */}
                              {expandedAdvanceId === adv.id && (
                                  <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4">
                                      <table className="w-full text-xs text-start">
                                          <thead>
                                              <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                  <th className="pb-2 text-start px-2">Date</th>
                                                  <th className="pb-2 text-start">Description</th>
                                                  <th className="pb-2 text-start">Amount</th>
                                                  <th className="pb-2 text-start">Status</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                              {adv.expenses.length === 0 ? (
                                                  <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">No expenses recorded</td></tr>
                                              ) : (
                                                  adv.expenses.map(exp => (
                                                      <tr key={exp.id}>
                                                          <td className="py-3 px-2 text-slate-500">{exp.date}</td>
                                                          <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{exp.description}</td>
                                                          <td className="py-3 font-mono font-bold">{exp.amount.toLocaleString()}</td>
                                                          <td className="py-3"><span className={`px-2 py-0.5 rounded text-[10px] ${exp.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{exp.status}</span></td>
                                                      </tr>
                                                  ))
                                              )}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
