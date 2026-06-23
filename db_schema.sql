
-- 1. تنظيف شامل (حذف الجداول القديمة لإعادة البناء)
-- تحذير: هذا سيحذف جميع البيانات الحالية
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS advances CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. تفعيل الإضافات
create extension if not exists "pgcrypto";

-- 3. إنشاء الجداول

-- جدول المستخدمين
create table users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  password text not null, 
  role text not null, 
  "avatarUrl" text,
  phone text,
  "jobTitle" text,
  "managerId" uuid, 
  "rootAdminId" uuid, 
  "isDeleted" boolean default false,
  preferences jsonb default '{"soundEnabled": true}',
  "createdAt" timestamptz default now()
);

-- جدول العملاء (جديد)
create table clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text not null,
  "logoUrl" text,
  "createdAt" timestamptz default now()
);

-- جدول المشاريع (محدث)
create table projects (
  id uuid default gen_random_uuid() primary key,
  "clientId" uuid references clients(id) on delete cascade, -- ربط بالعميل
  name text not null,
  code text, -- كود المشروع
  location text,
  "managerId" uuid, 
  status text default 'ACTIVE',
  "assignedEngineers" jsonb default '[]',
  "createdAt" timestamptz default now()
);

-- جدول التاسكات / المهام (جديد)
create table tasks (
  id uuid default gen_random_uuid() primary key,
  "projectId" uuid references projects(id) on delete cascade,
  name text not null,
  description text,
  status text default 'OPEN',
  "createdAt" timestamptz default now()
);

-- جدول العهد
create table advances (
  id uuid default gen_random_uuid() primary key,
  "projectId" uuid references projects(id) on delete set null,
  "userId" uuid references users(id) on delete cascade,
  amount numeric default 0,
  "remainingAmount" numeric default 0,
  description text,
  status text default 'PENDING',
  date text,
  "rejectionReason" text,
  "transferReceiptUrl" text, -- صورة قسيمة التحويل
  "parentAdvanceId" uuid references advances(id) on delete set null,
  "settlementData" jsonb,
  "createdAt" timestamptz default now()
);

-- جدول المصروفات (محدث)
create table expenses (
  id uuid default gen_random_uuid() primary key,
  "advanceId" uuid references advances(id) on delete cascade,
  "userId" uuid references users(id) on delete cascade,
  "taskId" uuid references tasks(id) on delete set null, -- ربط بالمهمة
  amount numeric default 0,
  description text,
  notes text,
  category text default 'General',
  "imageUrl" text,
  status text default 'PENDING',
  date text,
  "rejectionReason" text,
  "isEditable" boolean default false,
  "isInvoice" boolean default false,
  "invoiceItems" jsonb,
  "additionalAmount" numeric default 0,
  "createdAt" timestamptz default now()
);

-- جدول الإشعارات
create table notifications (
  id uuid default gen_random_uuid() primary key,
  "userId" uuid references users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  "isRead" boolean default false,
  "targetPage" text,
  "targetId" text,
  "createdAt" timestamptz default now()
);

-- 4. سياسات الأمان (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Advances" ON advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- 5. التخزين (Storage)
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true) on conflict (id) do nothing;
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
create policy "Public Select" on storage.objects for select using ( bucket_id = 'uploads' );
create policy "Public Insert" on storage.objects for insert with check ( bucket_id = 'uploads' );

-- 6. البيانات الأولية
INSERT INTO users (id, name, email, password, role, "jobTitle", "avatarUrl", "rootAdminId") VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mohsen Baza', 'Mohsen.baza@petrotec-eng.net', 'Mohsen12--', 'ADMIN', 'Senior Accountant', 'https://ui-avatars.com/api/?name=Mohsen+Baza&background=0D8ABC&color=fff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- 8. تفعيل Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table clients, projects, tasks, advances, expenses, users, notifications;
