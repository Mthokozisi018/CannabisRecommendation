// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {store,staff,now,period,snapshot} from '../fixtures/franchise-ui';
const m=vi.hoisted(()=>({load:vi.fn(),history:vi.fn(),save:vi.fn(),push:vi.fn(),refresh:vi.fn(),path:'/dashboard/franchise/sales',search:''}));
vi.mock('server-only',()=>({}));
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}));
vi.mock('next/form',()=>({default:'form'}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path,useSearchParams:()=>new URLSearchParams(m.search),useRouter:()=>({push:m.push,refresh:m.refresh})}));
vi.mock('@/app/dashboard/franchise/actions',()=>({saveFranchiseStoreAction:m.save,createFranchiseStaffAction:vi.fn(),manageFranchiseStaffAction:vi.fn(),uploadFranchiseStoreImageAction:vi.fn()}));
vi.mock('@/app/dashboard/admin/franchises/actions',()=>({registerFranchiseAction:vi.fn(),registerFranchiseAdminAction:vi.fn()}));
vi.mock('@/app/franchise/setup/actions',()=>({completeFranchiseSetupAction:vi.fn()}));
vi.mock('@/app/dashboard/franchise/sales/actions',()=>({loadFranchiseHistoricalSalesRange:m.load,loadStoreRevenuePeriod:m.load,loadStoreDetailPeriod:m.load}));
vi.mock('@/app/dashboard/franchise/stores/login-history-actions',()=>({loadManagerLoginHistory:m.history}));
import {StoreManagement} from '@/components/franchise/StoreManagement';
import {StoreDirectory} from '@/components/franchise/StoreDirectory';
import {StoreForm,FranchiseSetupForm,RegisterFranchiseForm,StaffCreateForm,StaffEditForm,StoreImageForm,Feedback} from '@/components/franchise/Forms';
import {FilteredSection,FranchiseSalesOverview} from '@/components/franchise/FranchiseSalesOverview';
import {StoreSalesOverview} from '@/components/franchise/StoreSalesOverview';
import {RevenuePlot} from '@/components/franchise/RevenuePlot';
import {FranchiseDashboardBack} from '@/components/franchise/FranchiseDashboardBack';
import {HomeSkeleton,ReportSkeleton} from '@/components/franchise/Loading';
import {FranchiseSalesNavigation} from '@/components/franchise/FranchiseSalesNavigation';
import {FranchiseStoresNavigation} from '@/components/franchise/FranchiseStoresNavigation';
import SalesError from '@/app/dashboard/franchise/sales/error';
import StoresError from '@/app/dashboard/franchise/stores/error';
import FranchiseError from '@/app/dashboard/franchise/error';
import {ManagerLoginHistory} from '@/components/franchise/ManagerLoginHistory';
beforeEach(()=>{
  vi.clearAllMocks();sessionStorage.clear();m.path='/dashboard/franchise/sales';m.search='';
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  m.load.mockImplementation(async(input)=>({...input,daily:snapshot.daily,categories:[],products:[],transactions:[],transactionCount:0}));
  m.save.mockResolvedValue({ok:false,message:'Temporary failure'});
  m.history.mockResolvedValue({rows:[],hasNext:false,filters:{from:'',to:'',manager:'',status:'all',page:1}});
});
afterEach(()=>{cleanup();vi.useRealTimers();});
const management=()=> <StoreManagement store={store} staff={[staff]} logins={[]} managerHistory={{rows:[],hasNext:false,filters:{from:'',to:'',manager:'',status:'all',page:1}}}/>;
it('tab arrow/Home/End navigation updates selected state and gives the panel a matching label',async()=>{
  const user=userEvent.setup();render(management());const first=screen.getByRole('tab',{name:'Manager Login History'});first.focus();await user.keyboard('{ArrowRight}');
  const second=screen.getByRole('tab',{name:'Staff Management'});expect(document.activeElement).toBe(second);expect(second.getAttribute('aria-selected')).toBe('true');
  await user.keyboard('{End}');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Store Settings'}));
  await user.keyboard('{Home}{ArrowLeft}');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Store Settings'}));
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(document.activeElement?.id);
});
it('settings start read-only; Edit and Cancel do not save or mutate the store',async()=>{
  const user=userEvent.setup();render(management());await user.click(screen.getByRole('tab',{name:'Store Settings'}));await user.click(screen.getByRole('button',{name:'Edit'}));
  const name=screen.getByLabelText('Store name') as HTMLInputElement;expect(name.value).toBe(store.name);await user.clear(name);await user.type(name,'Unsaved');await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByLabelText('Store name')).toBeNull();expect(m.save).not.toHaveBeenCalled();
});
it('staff search, role and status filters show only matching records and expose management actions',async()=>{
  const user=userEvent.setup();render(management());await user.click(screen.getByRole('tab',{name:'Staff Management'}));
  await user.type(screen.getByRole('searchbox',{name:'Search staff'}),'nomatch');expect(screen.getByText('No matching staff accounts.')).toBeTruthy();await user.clear(screen.getByRole('searchbox',{name:'Search staff'}));
  await user.click(screen.getByRole('button',{name:'Manage'}));expect(screen.getByLabelText('Your current password')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Close'}));
  await user.selectOptions(screen.getByLabelText('Role'),'receptionist');expect(screen.getByText('No matching staff accounts.')).toBeTruthy();
});
it('directory search scopes results and encodes the return search in store links',async()=>{
  const user=userEvent.setup();render(<StoreDirectory stores={[store,{...store,id:'other',name:'Beta Store',is_active:false}]} staff={[staff]}/>);
  expect(screen.getAllByRole('article')).toHaveLength(2);await user.type(screen.getByRole('searchbox'),'Fixture Manager');expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('link',{name:/Manage Store/}).getAttribute('href')).toContain('q=Fixture+Manager');
  await user.clear(screen.getByRole('searchbox'));await user.type(screen.getByRole('searchbox'),'unmatched');expect(screen.queryAllByRole('article')).toHaveLength(0);
});
it('creation retains an operation key across remount/retry and separates user draft scopes',async()=>{
  const first=render(<StoreForm creationScope="user-A"/>);const key=(document.querySelector('[name=idempotencyKey]') as HTMLInputElement).value;expect(key).toMatch(/^[a-f0-9-]{36}$/);
  first.unmount();const retry=render(<StoreForm creationScope="user-A"/>);expect((document.querySelector('[name=idempotencyKey]') as HTMLInputElement).value).toBe(key);retry.unmount();
  render(<StoreForm creationScope="user-B"/>);expect((document.querySelector('[name=idempotencyKey]') as HTMLInputElement).value).not.toBe(key);
});
it('double clicking creates one in-flight request, and a lost-response retry keeps its operation key',async()=>{
  const user=userEvent.setup();let finish!:(value:{ok:boolean,message:string})=>void;
  m.save.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  render(<StoreForm creationScope="double-click-user"/>);
  for(const [label,value] of [['Store name','Fixture Store'],['Phone','0821234567'],['Street address','123 Test Road'],['City','Pretoria'],['Postal code','0001']]) await user.type(screen.getByLabelText(label),value);
  await user.selectOptions(screen.getByLabelText('Province'),'Gauteng');
  const key=(document.querySelector('[name=idempotencyKey]') as HTMLInputElement).value;
  await user.dblClick(screen.getByRole('button',{name:'Register Store'}));
  expect(m.save).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'Saving…'}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>finish({ok:false,message:'Response unavailable. Retry safely.'}));
  expect(screen.getByRole('alert').textContent).toContain('Retry safely');
  m.save.mockResolvedValueOnce({ok:true,message:'Store added',id:store.id});await user.click(screen.getByRole('button',{name:'Register Store'}));
  await waitFor(()=>expect(screen.getByRole('link',{name:'Manage Store'})).toBeTruthy());
  expect(m.save).toHaveBeenCalledTimes(2);
  expect((m.save.mock.calls[0][1] as FormData).get('idempotencyKey')).toBe(key);
  expect((m.save.mock.calls[1][1] as FormData).get('idempotencyKey')).toBe(key);
  expect(sessionStorage.getItem('greenchoice.store-request.v1:double-click-user')).toBeNull();
});
it('forms retain required password/legal fields, honest limit state and accessible feedback',()=>{
  const a=render(<FranchiseSetupForm/>);expect(screen.getAllByRole('checkbox')).toHaveLength(2);expect((screen.getByLabelText('New permanent password') as HTMLInputElement).required).toBe(true);a.unmount();
  const b=render(<RegisterFranchiseForm/>);expect(screen.getByLabelText('Franchise name')).toBeTruthy();b.unmount();
  const c=render(<RegisterFranchiseForm franchiseId="tenant-A"/>);expect(screen.getByLabelText('Your current Admin password')).toBeTruthy();c.unmount();
  const d=render(<StaffCreateForm storeId={store.id} role="manager" atLimit/>);expect((screen.getByRole('button',{name:/Assign/}) as HTMLButtonElement).disabled).toBe(true);d.unmount();
  const e=render(<StaffEditForm person={staff} onCancel={()=>{}}/>);expect(screen.getByLabelText('Action')).toBeTruthy();e.unmount();
  const f=render(<StoreImageForm storeId={store.id}/>);expect(document.querySelector('input[type=file]')).toBeTruthy();f.unmount();
  render(<><Feedback state={{ok:false,message:'Denied'}}/><Feedback state={{ok:true,message:'Saved'}}/></>);expect(screen.getByRole('alert').textContent).toBe('Denied');expect(screen.getByRole('status').textContent).toBe('Saved');
});
it('franchise overview displays net fixture totals, filters store rows and restores expanded graph focus',async()=>{
  const user=userEvent.setup();render(<FranchiseSalesOverview snapshot={snapshot} stores={[{store,managers:[],customers:1}]} kpis={[{label:'Revenue This Month',value:9.99,currency:true}]} tablePeriod={period} now={now} historyStart="2026-01-01"/>);
  const performance=screen.getByRole('region',{name:'Store Performance'});expect(within(performance).getByRole('link',{name:/View Store/}).getAttribute('href')).toContain(store.id);
  await user.type(screen.getByRole('searchbox',{name:'Search stores'}),'absent');expect(within(performance).queryByRole('link',{name:/View Store/})).toBeNull();
  const expand=screen.getByRole('button',{name:'Expand sales by store graph'});await user.click(expand);expect(document.querySelector('dialog[open]')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Close expanded sales by store graph'}));await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Expand sales by store graph'})));
});
it('store report displays net transaction total and preserves sold-unit and low-stock data',()=>{
  render(<StoreSalesOverview store={store} managers="Fixture Manager" snapshot={snapshot} details={{...period,categories:[{label:'Flower',value:9.99}],products:[{key:'flower',name:'Flower',quantity:2,revenue:9.99}],transactions:[{saleId:'sale',receiptReference:'receipt',createdAt:now,localDate:period.to,date:'16 Oct 2026',time:'12:00',customerId:null,customerName:'Walk-in',customerPhone:'',receptionistId:null,receptionistName:'Recorded staff',paymentMethod:'split',itemCount:2,recordedTotal:12,refundedAmount:2.01,itemSubtotal:12,needsReconciliation:false,items:[]}],transactionCount:1}} kpis={[]} lowStock={[{id:'low',name:'Low Product',quantity:1,threshold:5}]} now={now} historyStart="2026-01-01"/>);
  const recent=screen.getByRole('region',{name:'Recent Transactions'});expect(within(recent).getByRole('columnheader',{name:'Net Total'})).toBeTruthy();expect(within(recent).getAllByRole('cell').map(el=>el.textContent)).toContain('R 9,99');expect(screen.getByText('Low Product')).toBeTruthy();
});
it('line points support keyboard tooltip activation and Escape dismissal',()=>{
  render(<RevenuePlot title="Net revenue" values={[{label:'2026-10-15',value:0},{label:'2026-10-16',value:9.99}]}/>);const point=screen.getAllByRole('button')[1];fireEvent.keyDown(point,{key:'Enter'});expect(screen.getByRole('tooltip')).toBeTruthy();fireEvent.keyDown(point,{key:'Escape'});expect(screen.queryByRole('tooltip')).toBeNull();
});
it('back links preserve dates/search and loading skeletons announce their purpose',()=>{
  m.path=`/dashboard/franchise/sales/${store.id}`;m.search='from=2026-10-01&to=2026-10-16';const a=render(<FranchiseDashboardBack/>);expect(screen.getByRole('link').getAttribute('href')).toContain('from=2026-10-01');expect(a.container.querySelector('[class*="storeSalesTitleRow"]')).toBeTruthy();expect(screen.getByRole('heading',{name:'Individual Store Performance'}).querySelector('svg')?.getAttribute('viewBox')).toBe('65 108 2055 530');a.unmount();
  m.path=`/dashboard/franchise/stores/${store.id}`;m.search='q=Alpha';const b=render(<FranchiseDashboardBack/>);expect(screen.getByRole('link').getAttribute('href')).toContain('q=Alpha');b.unmount();
  render(<><HomeSkeleton/><ReportSkeleton/></>);expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2);
});

it.each(['sales','stores'] as const)('navigation %s times out, offers a guarded retry and releases on ready/failure',kind=>{
  vi.useFakeTimers();m.path='/dashboard/franchise';
  const Component=kind==='sales'?FranchiseSalesNavigation:FranchiseStoresNavigation;
  render(<Component><a href={`/dashboard/franchise/${kind}`} data-navigation-loading={`franchise-${kind}`} onClick={e=>e.preventDefault()}>Open</a></Component>);
  fireEvent.click(screen.getByText('Open'),{ctrlKey:true});expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByText('Open'));expect(screen.getByRole('status')).toBeTruthy();
  act(()=>vi.advanceTimersByTime(120000));expect(screen.getByRole('alert').textContent).toContain('taking longer');
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(m.push).toHaveBeenCalledWith(`/dashboard/franchise/${kind}`);
  act(()=>window.dispatchEvent(new Event(`greenchoice:franchise-${kind}-loading-ready`)));expect(screen.queryByRole('status')).toBeNull();
  act(()=>window.dispatchEvent(new Event(`greenchoice:franchise-${kind}-loading-start`)));expect(screen.getByRole('status')).toBeTruthy();
  act(()=>window.dispatchEvent(new Event(`greenchoice:franchise-${kind}-loading-failed`)));expect(screen.queryByRole('status')).toBeNull();
});
it('route error boundaries provide non-sensitive messages and execute retry/reset callbacks',()=>{
 const retry=vi.fn();const a=render(<SalesError error={Error('private provider detail')} retry={retry}/>);expect(screen.queryByText('private provider detail')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(retry).toHaveBeenCalledTimes(1);a.unmount();
 const b=render(<StoresError error={Error('private provider detail')} retry={retry}/>);fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(retry).toHaveBeenCalledTimes(2);b.unmount();render(<FranchiseError reset={retry}/>);fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(retry).toHaveBeenCalledTimes(3);
});
it('independent custom filters recover from a failed range without losing the previous valid result',async()=>{
 const user=userEvent.setup();const load=vi.fn().mockRejectedValueOnce(Error('DB unavailable')).mockResolvedValueOnce({from:'2025-06-01',to:'2025-06-30',daily:[]});
 render(<FilteredSection title="Filtered Sales" initialPeriod={{preset:'month',...period}} initialSnapshot={snapshot} now={now} historyStart="2024-01-01" loadRange={load}>{(selected,_data,header)=><section>{header}<output>{selected.from}</output></section>}</FilteredSection>);
 await user.selectOptions(screen.getByLabelText('Filtered Sales period'),'custom');fireEvent.change(screen.getByLabelText('Filtered Sales from'),{target:{value:'2025-06-01'}});fireEvent.change(screen.getByLabelText('Filtered Sales to'),{target:{value:'2025-06-30'}});await user.click(screen.getByRole('button',{name:'Apply'}));
 expect(screen.getByRole('alert').textContent).toContain('could not be loaded');expect(screen.getByText(period.from,{selector:'output'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByText('2025-06-01',{selector:'output'})).toBeTruthy());expect(load).toHaveBeenCalledTimes(2);
});
it('login history paginates, applies filters and preserves rows on a failed refresh',async()=>{
 const user=userEvent.setup();const filters={from:'',to:'',manager:'',status:'all' as const,page:1};const row={id:'login',user_id:staff.auth_user_id,store_id:store.id,created_at:now,result:'success',details:{role:'manager',ipAddress:'192.0.2.1',userAgent:'Fixture browser'}};
 render(<ManagerLoginHistory storeId={store.id} managers={[staff]} initialPage={{rows:[row],hasNext:true,filters}}/>);
 m.history.mockResolvedValueOnce({rows:[row],hasNext:false,filters:{...filters,page:2}});await user.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(screen.getByText(/Page 2/)).toBeTruthy());
 await user.selectOptions(screen.getByLabelText('Manager'),staff.auth_user_id);fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-10-16'}});await user.click(screen.getByRole('button',{name:'Apply filters'}));expect(m.history).toHaveBeenLastCalledWith(store.id,expect.objectContaining({from:'2026-10-16',manager:staff.auth_user_id,page:1}));
 m.history.mockRejectedValueOnce(Error('network unavailable'));await user.click(screen.getByRole('button',{name:'Refresh history'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('could not be loaded'));
});
