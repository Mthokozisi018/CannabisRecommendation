// Read-only verification after the fixture-owned E2E cleanup.
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
const e=process.env;
if(e.GREENCHOICE_ENV!=='staging'||new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]!==e.EXPECTED_SUPABASE_PROJECT_REF||e.EXPECTED_SUPABASE_PROJECT_REF===e.PRODUCTION_SUPABASE_PROJECT_REF)throw Error('Isolation guard failed');
const client=createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.SUPABASE_SECRET_KEY||e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const output={};
for(const [table,field,pattern] of [['franchises','name','FA verification %'],['stores','name','Updated Store %'],['stores','name','Other Store %']]){
 const {count,error}=await client.from(table).select('id',{count:'exact',head:true}).like(field,pattern);
 output[`${table}:${pattern}`]={count,errorCode:error?.code||null};
}
let users=0,complete=false;
for(let page=1;page<=100;page++){
 const {data,error}=await client.auth.admin.listUsers({page,perPage:100});
 if(error){output.authError=true;break;}
 users+=data.users.filter(u=>/^(?:fa(?:-other)?|manager|receptionist)-[a-f0-9]{8}(?:-\d+)?@example\.com$/.test(u.email||'')).length;
 if(data.users.length<100){complete=true;break;}
}
output.syntheticAuthUsers={count:users,complete};
writeFileSync('../docs/fa-audit-evidence/cleanup-check.json',JSON.stringify(output,null,2));
console.log(JSON.stringify(output));
