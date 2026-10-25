import type {FranchiseStore,FranchiseStaff} from '@/lib/franchise/types';
export const store:FranchiseStore={id:'30000000-0000-4000-8000-000000000001',franchise_id:'tenant-A',name:'Alpha Store',slug:'alpha',is_active:true,store_access_status:'active',physical_store_address:'123 Test Road',city:'Pretoria',province:'Gauteng',postal_code:'0001',store_phone_number:'+27821234567',store_contact_email:'store@example.invalid',store_image_url:null,opening_hours:{monday:{open:'09:00',close:'17:00'}},created_at:'2026-01-01T12:00:00Z'};
export const staff:FranchiseStaff={id:'50000000-0000-4000-8000-000000000001',auth_user_id:'10000000-0000-4000-8000-000000000001',store_id:store.id,full_name:'Fixture Manager',first_name:'Fixture',surname:'Manager',email:'fixture@example.invalid',phone_number:null,mobile_number:null,role:'manager',account_status:'active',assigned_at:null,created_at:store.created_at};
export const now='2026-10-16T12:00:00+02:00';
export const period={from:'2026-10-01',to:'2026-10-16'};
export const snapshot={from:'2026-01-01',to:period.to,daily:[{store_id:store.id,day:'2026-10-16',revenue:9.99,transactions:2}]};
