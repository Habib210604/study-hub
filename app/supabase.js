import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://twdnpsarabyvpmvexyue.supabase.co';
const supabaseAnonKey = 'sb_publishable_WN_3RzqHq6zWRHRtwxVV3Q_qpfN5MFq';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);