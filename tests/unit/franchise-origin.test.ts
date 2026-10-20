import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({origin:'http://127.0.0.1:3001'}));
vi.mock('server-only',()=>({}));
vi.mock('next/headers',()=>({headers:async()=>new Headers(state.origin?{origin:state.origin}:{})}));
vi.mock('@/lib/rate-limit',()=>({requireRateLimit:vi.fn()}));
import {RequestOriginError,verifyOrigin} from '@/lib/security';
import {POST} from '@/app/api/auth/login/route';
beforeEach(()=>{vi.stubEnv('APP_URL','https://greenchoice.example');state.origin='http://127.0.0.1:3001';});
it.each(['https://greenchoice.example','http://127.0.0.1:3001'])('accepts configured origin %s',async(origin)=>{state.origin=origin;await expect(verifyOrigin()).resolves.toBe(true);});
it.each(['','null','malformed','https://other.invalid','https://greenchoice.example/path','https://greenchoice.example@other.invalid','https://user:pass@greenchoice.example'])('rejects missing, foreign or malformed origin %s',async(origin)=>{state.origin=origin;await expect(verifyOrigin()).rejects.toBeInstanceOf(RequestOriginError);});
it.each(['','https://other.invalid','invalid'])('login returns 403 rather than a service error for rejected origin %s',async(origin)=>{
  state.origin=origin;
  const result=await POST(new Request('http://127.0.0.1:3001/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
  expect(result.status).toBe(403);expect(await result.json()).toEqual({error:'Invalid request origin.'});
});
