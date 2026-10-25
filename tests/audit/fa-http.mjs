// Local HTTP checks: no valid credentials, notifications or remote mutations.
import { writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:3001';
const cases = [
  ...['/dashboard/franchise','/dashboard/franchise/stores','/dashboard/franchise/stores/new','/dashboard/franchise/stores/30000000-0000-4000-8000-000000000001','/dashboard/franchise/sales','/dashboard/franchise/sales/30000000-0000-4000-8000-000000000001','/franchise/setup'].map(path => ({name:`unauthenticated ${path}`,path,expected:307,location:'/login'})),
  {name:'unsupported login method',path:'/api/auth/login',method:'PUT',expected:405},
  {name:'login unsupported content type',path:'/api/auth/login',body:'{}',type:'text/plain',expected:415},
  {name:'login malformed JSON',path:'/api/auth/login',body:'{',expected:400},
  {name:'login empty fields',path:'/api/auth/login',body:'{}',expected:400},
  {name:'login wrong field types',path:'/api/auth/login',body:'{"email":42,"password":[]}',expected:400},
  {name:'login forged role field',path:'/api/auth/login',body:'{"email":"audit@example.invalid","password":"invalid","role":"admin"}',expected:400},
  {name:'login oversized password field',path:'/api/auth/login',body:JSON.stringify({email:'audit@example.invalid',password:'a'.repeat(20000)}),expected:400},
  {name:'login missing origin',path:'/api/auth/login',body:'{}',noOrigin:true,expected:403},
  {name:'login foreign origin',path:'/api/auth/login',body:'{}',foreignOrigin:true,expected:403},
];
const results=[];
for(const c of cases){
  const start=performance.now();
  try{
    const headers={};
    if(c.body){headers['Content-Type']=c.type||'application/json';if(!c.noOrigin)headers.Origin=c.foreignOrigin?'https://audit.invalid':origin;}
    const r=await fetch(origin+c.path,{method:c.method||(c.body?'POST':'GET'),headers,body:c.body,redirect:'manual',signal:AbortSignal.timeout(45000)});
    const location=r.headers.get('location')||'';
    const body = c.location && r.status===200 ? await r.text() : '';
    const streamedRedirect = r.status===200 && /NEXT_REDIRECT|http-equiv="refresh"/.test(body) && body.includes('/login');
    results.push({name:c.name,expected:c.expected,status:r.status,pass:(r.status===c.expected&&(!c.location||location.includes(c.location)))||Boolean(c.location&&streamedRedirect),streamedRedirect,location:location?new URL(location,origin).pathname:null,ms:Math.round((performance.now()-start)*100)/100,cacheControl:r.headers.get('cache-control'),csp:!!r.headers.get('content-security-policy')});
    if (!r.bodyUsed) await r.body?.cancel();
  }catch(e){results.push({name:c.name,pass:false,error:e.name});}
}
writeFileSync('../docs/fa-remediation-evidence/http.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass)}));
