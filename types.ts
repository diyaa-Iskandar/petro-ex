
// أنواع المستخدمين
export enum UserRole {
  ADMIN = 'ADMIN', // محاسب
  MAIN_CUSTODY = 'MAIN_CUSTODY', // عهدة رئيسية
  SUB_CUSTODY = 'SUB_CUSTODY' // عهدة فرعية
}

// حالة العهدة
export enum AdvanceStatus {
  PENDING = 'PENDING', // طلب عهدة جديد (جديد)
  OPEN = 'OPEN',       // تمت الموافقة عليها وسارية
  CLOSED = 'CLOSED',   // تم تسويتها وإغلاقها
  REJECTED = 'REJECTED' // تم رفض الطلب (جديد)
}

// حالة المصروف
export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

// حالة المشروع (نظام جديد)
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

// واجهة العميل (جديد)
export interface Client {
  id: string;
  name: string;
  code: string;
  logoUrl?: string;
  createdAt?: string;
}

// واجهة المشروع (محدثة)
export interface Project {
  id: string;
  clientId: string; // ربط بالعميل
  name: string;
  code: string; // كود المشروع
  location: string;
  managerId: string;
  status: ProjectStatus; 
  assignedEngineers?: string[]; // قائمة معرفات المهندسين المعينين للمشروع
}

// واجهة التاسك / المهمة (جديد)
export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'OPEN' | 'COMPLETED';
}

// واجهة المستخدم
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  managerId?: string;
  rootAdminId?: string;
  isDeleted?: boolean; // حقل الحذف الناعم
  preferences?: {
    soundEnabled: boolean;
  };
}

// واجهة العهدة
export interface Advance {
  id: string;
  projectId?: string; // اختياري الآن لأن العهدة قد تكون عامة أو مرتبطة بمشروع مبدئي
  userId: string;
  amount: number;
  remainingAmount: number;
  description: string;
  status: AdvanceStatus;
  date: string;
  transferReceiptUrl?: string; // صورة قسيمة التحويل (جديد)
  rejectionReason?: string;
  parentAdvanceId?: string; // ربط بالعهدة الأم (للعهد الفرعية)
  
  // حقول التصفية
  settlementData?: {
    totalApprovedExpenses: number;
    returnedCashAmount: number;
    deficitAmount: number;
    settlementDate?: string;
    notes?: string;
  };
}

// عنصر الفاتورة
export interface InvoiceItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// واجهة المصروف (محدثة)
export interface Expense {
  id: string;
  advanceId: string; // مصدر الأموال
  userId: string;
  taskId?: string; // ربط بالمهمة (الوجهة)
  amount: number;
  description: string;
  notes?: string;
  imageUrl?: string;
  status: ExpenseStatus;
  date: string;
  rejectionReason?: string;
  
  // التحكم في التعديل
  isEditable?: boolean; // هل يسمح المحاسب بتعديل هذا المصروف بعد الموافقة؟

  // حقول الفاتورة التفصيلية
  isInvoice?: boolean;
  invoiceItems?: InvoiceItem[];
  additionalAmount?: number;
}

// واجهة الإشعارات
export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  relatedId?: string;
  targetPage?: string; // الصفحة المستهدفة (dashboard, advances, etc)
  targetId?: string;   // معرف العنصر لفتحه
  createdAt: string;
}
