import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qlssrbkoxndiprbfjunk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
