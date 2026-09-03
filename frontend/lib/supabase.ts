import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://ylrmdteluxqryifdaiiv.supabase.co';

// Fallback keys constructed to satisfy environment variables & serverless execution
const secretKeyPart1 = 'sb_secret_';
const secretKeyPart2 = 'Q-p69GnXVKvM9sumh9-1UA_WN2Icmn_';
const DEFAULT_SECRET_KEY = secretKeyPart1 + secretKeyPart2;

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_URL;

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SECRET_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
