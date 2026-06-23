
import { createClient } from '@supabase/supabase-js';

// استخدام الروابط مباشرة لتجنب أي مشاكل في قراءة متغيرات البيئة
const SUPABASE_URL = 'https://amxhaqifwezrqpexpbpc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteGhhcWlmd2V6cnFwZXhwYnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTA4MDAsImV4cCI6MjA4NTkyNjgwMH0.-1d9XgOB8ff1NuUmwV20iNrWyjiaCZ1u0fbkoN75iKc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const uploadFile = async (file: File): Promise<string | null> => {
  try {
    // 1. Sanitize filename to avoid header issues with non-ASCII characters
    // Remove non-ASCII characters and spaces for safety
    const sanitizedOriginalName = file.name.replace(/[^\x00-\x7F]/g, "file").replace(/\s/g, '_');
    const fileExt = sanitizedOriginalName.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload Error (Supabase):', error);
      // تنبيه المستخدم بأن الرفع فشل
      alert('فشل رفع الصورة للسيرفر. تأكد من إعدادات سياسات التخزين (Storage Policies) في Supabase.\nسيتم استخدام معاينة محلية مؤقتة فقط.');
      
      // Fallback: Create a local URL so the user flow doesn't break
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (err) {
    console.error('Upload Exception:', err);
    alert('حدث خطأ غير متوقع أثناء الرفع.');
    // Fallback on network/fetch exception
    return URL.createObjectURL(file);
  }
};
