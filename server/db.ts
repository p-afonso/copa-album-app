import 'server-only'
import { createClient } from '@supabase/supabase-js'

// service_role bypasses RLS — user_id filtering é feito manualmente nas queries
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
