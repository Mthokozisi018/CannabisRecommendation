import { expect, it } from "vitest";
import { allocateNetItemCents } from "@/lib/franchise/net-item-allocation";

it('allocates partial refund cents with deterministic largest remainders', () => {
  const items = [{ id: 'b', line_total: 4 }, { id: 'a', line_total: 4 }, { id: 'c', line_total: 4 }];
  expect(allocateNetItemCents({ total: 10, refunded_amount: 0.02 }, items)).toEqual([333,333,332]);
  expect(allocateNetItemCents({ total: 10, refunded_amount: 10 }, items)).toEqual([0,0,0]);
});
it('uses recorded proportions and authoritative totals even with discounted item sums', () => {
  expect(allocateNetItemCents({ total: '8.99', refunded_amount: '1.00' }, [{ id:'a',line_total:3 },{ id:'b',line_total:6 }])).toEqual([266,533]);
});
it('handles zero weights, empty receipts and negative recorded net values', () => {
  expect(allocateNetItemCents({ total: 1 }, [{id:'b',line_total:0},{id:'a',line_total:0}])).toEqual([0,100]);
  expect(allocateNetItemCents({ total: 1 }, [])).toEqual([]);
  expect(allocateNetItemCents({ total:0,refunded_amount:0.01 }, [{id:'a',line_total:1},{id:'b',line_total:1}])).toEqual([0,-1]);
});
