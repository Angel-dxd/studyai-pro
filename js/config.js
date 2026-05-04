// ══════════════════════════════════════════
// SUPABASE CONFIG
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://ezrwxczyemrmyphujtcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnd4Y3p5ZW1ybXlwaHVqdGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTg5MTIsImV4cCI6MjA5MzM3NDkxMn0.EnhSqxGLbWhZamxnFcze9P-sq_p6vly_fQlgAtu3t9I';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
