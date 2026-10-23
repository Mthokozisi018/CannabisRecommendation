// Read-only anonymous capability probe. No fixtures or hosted SQL changes.
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
const e=process.env;
if(e.GREENCHOICE_ENV!=='staging'||new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]!==e.EXPECTED_SUPABASE_PROJECT_REF||e.EXPECTED_SUPABASE_PROJECT_REF===e.PRODUCTION_SUPABASE_PROJECT_REF)throw Error('Isolation guard failed');
const c=createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {error}=await c.rpc('franchise_dashboard_totals_v2',{p_franchise_id:'00000000-0000-4000-8000-000000000000',p_start:'2026-01-01',p_end:'2026-01-02',p_customers:false});
const result={readOnly:true,hostedMigrationAppliedByAgent:false,code:error?.code||null,missingMigration:error?.code==='PGRST202',note:'Hosted E2E requires the forward migration; no fallback to old financial or unkeyed mutation RPCs.'};
writeFileSync('../docs/fa-remediation-evidence/hosted-preflight.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
