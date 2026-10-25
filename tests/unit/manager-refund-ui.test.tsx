import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('server-only',()=>({}));
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}));
vi.mock('@/components/DashboardBackdrop',()=>({DashboardBackdrop:()=>null}));
vi.mock('@/components/receptionist/pos/TransactionWorkspace',()=>({TransactionDetailsButton:()=>null}));
vi.mock('@/app/dashboard/manager/sales/actions',()=>({refreshManagerSalesReport:vi.fn()}));
import { ManagerSalesOverviewUI } from '@/components/manager/ManagerSalesOverviewUI';
import { buildManagerSalesReport, parseSalesReportFilters } from '@/lib/manager/sales-overview';
afterEach(cleanup);
it('keeps original amounts and a full-refund badge visible while collapsed and after expanding',async()=>{
 const report=buildManagerSalesReport({sales:[
  {id:'full',checkout_id:'FULL',customer_id:null,staff_user_id:null,total:150,refunded_amount:150,created_at:'2026-10-17T08:00:00Z'},
  {id:'complete',checkout_id:'COMPLETE',customer_id:null,staff_user_id:null,total:370,refunded_amount:0,created_at:'2026-10-17T08:00:00Z'},
  {id:'partial',checkout_id:'PARTIAL',customer_id:null,staff_user_id:null,total:100,refunded_amount:25,created_at:'2026-10-17T08:00:00Z'}
 ],items:[],customers:[],staff:[]},parseSalesReportFilters({month:'2026-10'}));
 render(<ManagerSalesOverviewUI initialReport={report} storeName="Test store" managerName="Test manager"/>);
 const row=screen.getByRole('button',{name:/FULL/});
 expect(row.getAttribute('aria-expanded')).toBe('false');
 expect(within(row).getByText('Refunded')).toBeTruthy();
 expect(within(row).getByText(/R 150[,.]00/)).toBeTruthy();
 expect(within(screen.getByRole('button',{name:/COMPLETE/})).queryByText('Refunded')).toBeNull();
 expect(within(screen.getByRole('button',{name:/PARTIAL/})).queryByText('Refunded')).toBeNull();
 await userEvent.setup().click(row);expect(row.getAttribute('aria-expanded')).toBe('true');
 expect(within(row).getByText('Refunded')).toBeTruthy();
 await userEvent.setup().click(row);expect(row.getAttribute('aria-expanded')).toBe('false');
 expect(within(row).getByText('Refunded')).toBeTruthy();
});
