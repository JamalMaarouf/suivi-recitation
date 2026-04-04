import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://uwqhtahknhftinlzmusi.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cWh0YWhrbmhmdGlubHptdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTA2MTAsImV4cCI6MjA5MDI2NjYxMH0.gdX0JeqSfGnr6xGFqBUSK78z_XiWQg93R6MEa8w1klU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
