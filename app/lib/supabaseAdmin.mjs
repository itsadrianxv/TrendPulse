import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

let supabaseAdminClient = null;

export const getSupabaseAdmin = () => {
  if (!isSupabaseAdminConfigured) {
    throw new Error('Supabase admin is not configured');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseAdminClient;
};

export const getSupabaseUserByAccessToken = async (accessToken) => {
  const token = String(accessToken || '').trim();
  if (!token) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    throw error;
  }

  return data?.user || null;
};
