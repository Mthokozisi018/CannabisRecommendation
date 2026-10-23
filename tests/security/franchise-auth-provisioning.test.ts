import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({admin:vi.fn(),create:vi.fn(),log:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseAdminClient:mocks.admin,createSupabaseServerClient:vi.fn()}));
vi.mock("@/lib/franchise/totals-cache",()=>({invalidateFranchiseTotals:vi.fn()}));
vi.mock("@/lib/security",()=>({assertRateLimit:vi.fn()}));
vi.mock("@/lib/logger",()=>({reportServerException:mocks.log}));
import {createFranchiseAuthAccount} from "@/lib/franchise/mutations";
beforeEach(()=>{vi.clearAllMocks();mocks.admin.mockReturnValue({auth:{admin:{createUser:mocks.create}}});mocks.create.mockResolvedValue({data:{user:{id:"new-user"}},error:null});});
it.each(["manager","receptionist"] as const)("creates %s with trusted role, creator, store and franchise metadata",async role=>{
  expect(await createFranchiseAuthAccount("trusted-actor",role,{email:"employee@example.test",password:"provider-approved"},{storeId:"trusted-store",franchiseId:"trusted-franchise"})).toBe("new-user");
  expect(mocks.create).toHaveBeenCalledWith({email:"employee@example.test",password:"provider-approved",email_confirm:true,app_metadata:{greenchoice_role:role,greenchoice_created_by:"trusted-actor",greenchoice_store_id:"trusted-store",greenchoice_franchise_id:"trusted-franchise",greenchoice_manager_id:"trusted-actor",greenchoice_registration:role==="manager"?"franchise_created":"manager_created"}});
});
it("surfaces provider password requirements without weakening the provider policy",async()=>{
  mocks.create.mockResolvedValue({data:{user:null},error:{code:"weak_password",message:"Password must contain at least 8 characters."}});
  await expect(createFranchiseAuthAccount("actor","receptionist",{email:"employee@example.test",password:"abc"},{storeId:"store"})).rejects.toThrow("at least 8 characters");
  expect(mocks.log).not.toHaveBeenCalled();
});
