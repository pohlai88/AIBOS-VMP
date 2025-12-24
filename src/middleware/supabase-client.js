import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client scoped to the authenticated user.
 * Uses anon key + user JWT so RLS policies are enforced.
 * 
 * CRITICAL: This ensures "Tenant Isolation Is Absolute" at database level.
 * 
 * @param {Express.Request} req - Express request object (must have session.authToken)
 * @returns {SupabaseClient} - Supabase client with user JWT set
 */
export function createUserScopedSupabaseClient(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }

  // Create client with anon key (RLS enforced)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // If user is authenticated, set their JWT
  // This makes all queries run as the authenticated user
  // Note: VMP uses req.session.authToken (not access_token)
  if (req.session?.authToken) {
    supabase.auth.setAuth(req.session.authToken);
  }

  return supabase;
}

/**
 * Express middleware: Attach user-scoped Supabase client to req.supabase
 * 
 * Usage:
 *   app.use(attachSupabaseClient);
 *   
 *   app.get('/vendor/cases/:id', async (req, res) => {
 *     const { data } = await req.supabase.from('vmp_cases').select('*');
 *     // RLS policies automatically enforce vendor/tenant isolation
 *   });
 */
export function attachSupabaseClient(req, res, next) {
  try {
    req.supabase = createUserScopedSupabaseClient(req);
    next();
  } catch (error) {
    console.error('Failed to create user-scoped Supabase client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
