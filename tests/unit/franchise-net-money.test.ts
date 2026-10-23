import {expect,it} from 'vitest';
import {netSaleCents,sumNetSales} from '@/lib/sales-money';
it.each([[125,125,0],[125,25.01,9999],[0.30,0.10,20],[0.10,0,10]] as const)('net cents preserve recorded decimals: gross %s, refunded %s', (total,refunded_amount,expected)=>{
 expect(netSaleCents({total,refunded_amount})).toBe(expected);
});
it('sums store net amounts in integer cents without cumulative floating-point drift',()=>{
 expect(sumNetSales(Array.from({length:10000},()=>({total:'0.30',refunded_amount:'0.10'})))).toBe(2000);
 expect(sumNetSales([])).toBe(0);
});
