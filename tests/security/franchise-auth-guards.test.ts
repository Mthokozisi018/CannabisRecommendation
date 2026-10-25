import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),client:vi.fn(),single:vi.fn(),eq:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error(`redirect:${path}`);}}));
vi.mock('@/lib/dashboard-session',()=>({requireDashboardRoleSession:m.session}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:m.client}));
import {requireFranchiseAdmin,requireFranchiseStore} from '@/lib/franchise/auth';
const profile={role:'franchise_admin',franchise_id:'A'};
beforeEach(()=>{
  vi.clearAllMocks();m.session.mockResolvedValue({profile,accountSetupComplete:true});
  const query={select:vi.fn().mockReturnThis(),eq:m.eq.mockReturnThis(),maybeSingle:m.single};
  m.single.mockResolvedValue({data:{id:'own',franchise_id:'A'},error:null});m.client.mockResolvedValue({from:vi.fn(()=>query)});
});
it('requires the dedicated role before returning the authenticated scoped client',async()=>{
  expect(await requireFranchiseAdmin()).toMatchObject({franchiseId:'A'});expect(m.session).toHaveBeenCalledWith(['franchise_admin']);
});
it.each(['admin','manager','receptionist','customer'])('rejects an unexpected %s role even if a session helper returns it',async(role)=>{
  m.session.mockResolvedValue({profile:{...profile,role},accountSetupComplete:true});await expect(requireFranchiseAdmin()).rejects.toThrow('Franchise assignment required');expect(m.client).not.toHaveBeenCalled();
});
it('rejects absent franchise assignment and denied/expired sessions before database reads',async()=>{
  m.session.mockResolvedValueOnce({profile:{role:'franchise_admin'},accountSetupComplete:true});await expect(requireFranchiseAdmin()).rejects.toThrow('Franchise assignment');
  m.session.mockRejectedValueOnce(Error('session expired'));await expect(requireFranchiseStore('own')).rejects.toThrow('session expired');expect(m.client).not.toHaveBeenCalled();
});
it('redirects incomplete setup but permits the guarded setup flow',async()=>{
  m.session.mockResolvedValue({profile,accountSetupComplete:false});await expect(requireFranchiseAdmin()).rejects.toThrow('redirect:/franchise/setup');await expect(requireFranchiseAdmin(true)).resolves.toMatchObject({franchiseId:'A'});
});
it('fails closed when the authenticated client or store query is unavailable',async()=>{
  m.client.mockResolvedValueOnce(null);await expect(requireFranchiseAdmin()).rejects.toThrow('temporarily unavailable');
  m.single.mockResolvedValueOnce({data:null,error:{code:'unavailable'}});await expect(requireFranchiseStore('own')).rejects.toThrow('could not be loaded');
});
it.each([null,{id:'foreign',franchise_id:'B'}])('rejects missing and foreign store results',async(data)=>{
  m.single.mockResolvedValueOnce({data,error:null});await expect(requireFranchiseStore('foreign')).rejects.toThrow('Store not found');
});
it('combines requested store and authenticated franchise predicates',async()=>{
  expect(await requireFranchiseStore('own')).toMatchObject({store:{id:'own',franchise_id:'A'}});expect(m.eq.mock.calls).toEqual([['id','own'],['franchise_id','A']]);
});
