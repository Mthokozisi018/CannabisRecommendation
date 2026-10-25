import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
it('real POS refunds reconcile with FA daily, category and product aggregates without reducing transaction counts',()=>{
  expect(()=>execFileSync(process.execPath,['tests/audit/fa-pos-integration.mjs'],{stdio:'pipe',timeout:60000})).not.toThrow();
},65000);
