import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/**
 * 建立伺服器端管理 client。延遲到 API 實際收到請求時才檢查環境變數，
 * 避免 Next.js 在 build 階段載入 route module 時因未提供 secrets 而失敗。
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase Environment Variables for Admin Client');
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return adminClient;
}

/**
 * 保留既有 route 的呼叫介面，同時將 client 建立延後至第一次存取時。
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseAdmin();
    const value = client[property as keyof SupabaseClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
