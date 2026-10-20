import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({admin:vi.fn(),server:vi.fn(),rpc:vi.fn(),create:vi.fn(),remove:vi.fn(),lookup:vi.fn(),signin:vi.fn(),rate:vi.fn(),log:vi.fn(),invalidate:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseAdminClient:m.admin,createSupabaseServerClient:m.server}));
vi.mock('@/lib/security',()=>({assertRateLimit:m.rate}));
vi.mock('@/lib/logger',()=>({reportServerException:m.log}));
vi.mock('@/lib/franchise/totals-cache',()=>({invalidateFranchiseTotals:m.invalidate}));
import {franchiseServiceClient,franchiseMutation,createFranchiseAuthAccount,cleanupUnboundFranchiseAuthAccount,verifyFranchiseSensitiveAction} from '@/lib/franchise/mutations';
beforeEach(()=>{
 vi.resetAllMocks();m.lookup.mockResolvedValue({data:null,error:null});m.create.mockResolvedValue({data:{user:{id:'new-user'}},error:null});m.rpc.mockResolvedValue({data:'result',error:null});
 m.admin.mockReturnValue({rpc:m.rpc,auth:{admin:{createUser:m.create,deleteUser:m.remove}},from:()=>({select:()=>({eq:()=>({maybeSingle:m.lookup})})})});
 m.signin.mockResolvedValue({data:{user:{id:'verified'}},error:null});m.server.mockResolvedValue({auth:{signInWithPassword:m.signin}});
});
it('fails closed without server credentials',()=>{m.admin.mockReturnValue(null);expect(franchiseServiceClient).toThrow('temporarily unavailable');});
it('passes verified actor and operation to the service RPC and invalidates only after success',async()=>{
 expect(await franchiseMutation('verified','create_store',{idempotencyKey:'key'})).toBe('result');expect(m.rpc).toHaveBeenCalledWith('franchise_mutation_v2',{p_actor:'verified',p_action:'create_store',p_data:{idempotencyKey:'key'}});expect(m.invalidate).toHaveBeenCalledWith('verified');
});
it.each(['manager limit reached (3)','This request key was already used for different store details','Activate this store before assigning staff'])('returns an actionable safe business error: %s',async(message)=>{
 m.rpc.mockResolvedValueOnce({data:null,error:{message}});await expect(franchiseMutation('verified','create_store',{})).rejects.toThrow(message);expect(m.invalidate).not.toHaveBeenCalled();
});
it('sanitizes unexpected provider/SQL errors',async()=>{m.rpc.mockResolvedValueOnce({data:null,error:{message:'internal relation metadata'}});await expect(franchiseMutation('verified','update_store',{})).rejects.toThrow('The change could not be saved');expect(m.log).toHaveBeenCalled();});
it.each(['manager','receptionist','franchise_admin'] as const)('provisions trusted %s metadata without sending an invitation',async(role)=>{
 expect(await createFranchiseAuthAccount('verified',role,{email:'synthetic@example.invalid',password:'Synthetic!8Password'},{storeId:'store-A',franchiseId:'tenant-A'})).toBe('new-user');expect(m.create).toHaveBeenCalledWith(expect.objectContaining({email_confirm:true,app_metadata:expect.objectContaining({greenchoice_role:role,greenchoice_created_by:'verified',greenchoice_franchise_id:'tenant-A'})}));
});
it('keeps provider password guidance but sanitizes other provisioning failures',async()=>{
 m.create.mockResolvedValueOnce({data:{user:null},error:{code:'weak_password',message:'Choose a stronger password'}});await expect(createFranchiseAuthAccount('verified','manager',{email:'x',password:'x'},{})).rejects.toThrow('Choose a stronger password');
 m.create.mockResolvedValueOnce({data:{user:null},error:{code:'internal',message:'provider details'}});await expect(createFranchiseAuthAccount('verified','manager',{email:'x',password:'x'},{})).rejects.toThrow('Account creation failed');
});
it('deletes only a confirmed unbound Auth account, never a bound or uncertain identity',async()=>{
 await cleanupUnboundFranchiseAuthAccount('new-user');expect(m.remove).toHaveBeenCalledWith('new-user');m.remove.mockClear();m.lookup.mockResolvedValueOnce({data:{id:'bound'},error:null});await cleanupUnboundFranchiseAuthAccount('bound');m.lookup.mockResolvedValueOnce({data:null,error:{code:'timeout'}});await cleanupUnboundFranchiseAuthAccount('uncertain');expect(m.remove).not.toHaveBeenCalled();
});
it('requires the current password and matching authenticated identity for sensitive actions',async()=>{
 const session={email:'synthetic@example.invalid',authUserId:'verified'} as Parameters<typeof verifyFranchiseSensitiveAction>[0];
 await expect(verifyFranchiseSensitiveAction(session,'')).rejects.toThrow('Enter your current password');expect(m.signin).not.toHaveBeenCalled();await expect(verifyFranchiseSensitiveAction(session,'Synthetic!8Password')).resolves.toBeUndefined();
 m.signin.mockResolvedValueOnce({data:{user:{id:'other'}},error:null});await expect(verifyFranchiseSensitiveAction(session,'Synthetic!8Password')).rejects.toThrow('verification failed');m.server.mockResolvedValueOnce(null);await expect(verifyFranchiseSensitiveAction(session,'Synthetic!8Password')).rejects.toThrow('verification failed');
});
