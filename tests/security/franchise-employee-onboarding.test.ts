import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({context:vi.fn(),session:vi.fn(),password:vi.fn(),rpc:vi.fn(),redirect:vi.fn((path:string)=>{throw Error(`REDIRECT ${path}`);})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("@/lib/security",()=>({verifyOrigin:vi.fn(),assertRateLimit:vi.fn()}));
vi.mock("@/lib/cache/redis",()=>({invalidateManagerStaffCache:vi.fn()}));
vi.mock("@/lib/logger",()=>({reportServerException:vi.fn()}));
vi.mock("@/lib/dashboard-session",()=>({requireDashboardRoleSession:mocks.session}));
vi.mock("@/lib/manager/legal-documents",()=>({assertLegalDocumentsAvailable:vi.fn(),LEGAL_DOCUMENTS:{terms:{version:"v1"},privacy:{version:"v1"}}}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:()=>({auth:{updateUser:mocks.password},rpc:mocks.rpc}),createSupabaseAdminClient:()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/manager/onboarding",()=>({getCurrentManagerSetupProfile:mocks.context,accountSetupComplete:()=>false,managerAccountSetupSchema:{parse:(value:unknown)=>value},normalizeSAPhone:(value:string)=>value,linkedManagerStore:vi.fn(),managerOnboardingComplete:vi.fn(),slugForStoreName:vi.fn(),storeRegistrationSchema:{parse:vi.fn()}}));
import {completeManagerAccountSetupAction} from "@/app/manager/setup/actions";
import {completeReceptionistAccountSetupAction} from "@/app/staff/setup/actions";
const initial={ok:false,message:""};
function form(role:"manager"|"receptionist") {
 const result=new FormData();
 const values={fullName:"Employee",firstName:"Employee",surname:"Example",phoneNumber:"+27821234567",physicalAddress:"123 Test Road",city:"Pretoria",province:"Gauteng",postalCode:"0001",termsAccepted:"on",privacyAccepted:"on",permanentPassword:"Secure!7QzExample",password:"Secure!7QzExample",confirmPassword:"Secure!7QzExample",storeId:"forged-store",authUserId:"forged-user"};
 for(const [key,value] of Object.entries(values)) result.set(key,value);
 result.set("role",role);return result;
}
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.context.mockResolvedValue({user:{id:"trusted-manager"},profile:{id:"manager-profile",store_id:"assigned-store",temporary_password_active:true}});
 mocks.session.mockResolvedValue({authUserId:"trusted-receptionist",assignedStoreId:"assigned-store"});
 mocks.password.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({data:"profile-id",error:null});
});
it("finishes the existing assigned-manager account flow using authenticated identity after the password change",async()=>{
 await expect(completeManagerAccountSetupAction(initial,form("manager"))).rejects.toThrow("REDIRECT /manager/setup/store");
 expect(mocks.rpc).toHaveBeenCalledWith("complete_manual_manager_account_setup",expect.objectContaining({p_auth_user_id:"trusted-manager",p_full_name:"Employee"}));
 expect(mocks.password.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
 expect(JSON.stringify(mocks.rpc.mock.calls)).not.toMatch(/forged|storeId/);
});
it("finishes receptionist setup with their own name and authenticated store assignment",async()=>{
 await expect(completeReceptionistAccountSetupAction(initial,form("receptionist"))).rejects.toThrow("REDIRECT /dashboard/receptionist");
 expect(mocks.rpc).toHaveBeenCalledWith("complete_manager_created_receptionist_setup",expect.objectContaining({p_first_name:"Employee",p_surname:"Example"}));
 expect(mocks.password.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
 expect(JSON.stringify(mocks.rpc.mock.calls)).not.toMatch(/forged|storeId/);
});
it.each(["manager","receptionist"] as const)("does not complete %s onboarding when permanent password replacement fails",async role=>{
 mocks.password.mockResolvedValue({error:{code:"same_password",message:"Choose a different password"}});
 const action=role==="manager"?completeManagerAccountSetupAction:completeReceptionistAccountSetupAction;
 const result=await action(initial,form(role));
 expect(result.ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.redirect).not.toHaveBeenCalled();
});
