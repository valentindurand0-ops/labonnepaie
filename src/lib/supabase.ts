import { createClient } from "@supabase/supabase-js";

// Client Supabase unique pour toute l'application.
// Les valeurs proviennent de .env.local (voir .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables Supabase manquantes. Copier .env.example en .env.local et renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
