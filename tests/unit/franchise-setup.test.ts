import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),update:vi.fn(),mutation:vi.fn(),origin:vi.fn(),legal:vi.fn(),rate:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error(`redirect:${path}`)}}));
vi.mock('@/lib/franchise/auth',()=>({requireFranchiseAdmin:m.auth}));
vi.mock('@/lib/franchise/mutations',()=>({franchiseMutation:m.mutation}));
vi.mock('@/lib/security',()=>({verifyOrigin:m.origin,assertRateLimit:m.rate}));
vi.mock('@/lib/manager/legal-documents',()=>({LEGAL_DOCUMENTS:{terms:{version:'terms'},privacy:{version:'privacy'}},assertLegalDocumentsAvailable:m.legal}));
import {completeFranchiseSetupAction} from '@/app/franchise/setup/actions';
const form=(overrides:Record<string,string|undefined>={})=>{const f=new FormData();Object.entries({password:'LocalTesting!8Permanent',confirmPassword:'LocalTesting!8Permanent',termsAccepted:'on',privacyAccepted:'on',...overrides}).forEach(([k,v])=>typeof v === "string" && f.set(k,v));return f;};
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({session:{authUserId:'verified'},supabase:{auth:{updateUser:m.update}}});m.update.mockResolvedValue({error:null});});
it('changes Auth password before transactional setup and redirects only after both succeed',async()=>{
  await expect(completeFranchiseSetupAction({ok:false,message:''},form())).rejects.toThrow('redirect:/dashboard/franchise');
  expect(m.auth).toHaveBeenCalledWith(true);expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.mutation.mock.invocationCallOrder[0]);expect(m.mutation).toHaveBeenCalledWith('verified','complete_setup',{termsVersion:'terms',privacyVersion:'privacy'});
});
it.each([{password:'weak'},{confirmPassword:'different'},{termsAccepted:''},{privacyAccepted:''}])('rejects invalid setup before changing Auth: %j',async(change)=>{
  expect((await completeFranchiseSetupAction({ok:false,message:''},form(change))).ok).toBe(false);expect(m.update).not.toHaveBeenCalled();expect(m.mutation).not.toHaveBeenCalled();
});
it('does not mark setup complete on Auth failure',async()=>{m.update.mockResolvedValueOnce({error:{code:'weak_password'}});expect((await completeFranchiseSetupAction({ok:false,message:''},form())).message).toContain('could not be changed');expect(m.mutation).not.toHaveBeenCalled();});
it('describes recovery when password changes but profile transaction fails',async()=>{m.mutation.mockRejectedValueOnce(Error('DB down'));expect((await completeFranchiseSetupAction({ok:false,message:''},form())).message).toContain('password was changed');});
it('origin, legal and authentication failures stop setup',async()=>{
  for(const fn of [m.origin,m.legal,m.auth]){fn.mockImplementationOnce(()=>{throw Error('Denied')});expect((await completeFranchiseSetupAction({ok:false,message:''},form())).ok).toBe(false);}
  expect(m.update).not.toHaveBeenCalled();
});
