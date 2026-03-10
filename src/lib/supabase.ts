import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qlssrbkoxndiprbfjunk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsc3NyYmtveG5kaXByYmZqdW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzcxNjUsImV4cCI6MjA4ODc1MzE2NX0.2PeP3mUeg1XJIxaCdj4FR8E9REw4TpHHFfSCoO-8XuQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
