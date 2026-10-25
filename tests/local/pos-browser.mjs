import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const root = process.cwd();
const out = 'tmp/pos-local-validation';
mkdirSync(out,{recursive:true});
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','app/globals.css','-o',`${out}/style.css`,'--config','tailwind.config.ts'],{stdio:'pipe'});
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{CustomerCheckoutDialog}from'./components/receptionist/pos/CustomerCheckoutDialog';
const cart=[{productId:'00000000-0000-4000-8000-000000000031',name:'Local Accessory',categoryName:'Accessories',subcategory:'Grinders',imageSrc:'/placeholder-images/Grinder.png',unitPrice:750,quantity:1,stockAvailable:100,sizeLabel:null}];
function Test(){const[c,setC]=useState(null);const[p,setP]=useState(null);return <><CustomerCheckoutDialog open cart={cart} cartCount={1} selectedCustomer={c} total={750} totalLabel="R750.00" isCompleting={false} storeName="Local Store" profileLabel="Local Test" accountRole="receptionist" onClose={()=>{}} onClearCart={()=>{}} onChangeQuantity={()=>{}} onRemoveItem={()=>{}} onSelectCustomer={setC} onCompleteSale={setP}/><output data-testid="payment">{JSON.stringify(p)}</output></>};createRoot(document.getElementById('root')).render(<Test/>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:true,outfile:`${out}/browser.js`,jsx:'automatic',plugins:[{name:'local-action',setup(b){
 b.onResolve({filter:/^@\/app\/dashboard\/receptionist\/actions$/},()=>({path:'local-action',namespace:'test'}));
 b.onResolve({filter:/^@\/components\/GreenChoiceDashboard$/},()=>({path:'money',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='money'?`export function Money({value}){return new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(Number(value))}`:`export async function registerReceptionistCustomerAction(input){return fetch('/register',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json())}`,loader:'js'}));
}}]});
const posEntry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{ReceptionistPOS}from'./components/receptionist/pos/ReceptionistPOS';
const product={id:'00000000-0000-4000-8000-000000000031',name:'Local Accessory',categoryName:'Accessories',categorySlug:'accessories',subcategory:'Grinders',cultivationType:null,description:'Local fixture',imageUrl:null,imagePath:null,sizeLabel:null,strainType:null,sellingPrice:750,productStatus:'active',isActive:true,isNew:false,quantityAvailable:100,lowStockThreshold:5};
function Test(){const[s,setS]=useState(null);return <><ReceptionistPOS products={[product]} categories={[{name:'Accessories',slug:'accessories',count:1}]} profileLabel="Local Test" checkoutAction={async(input)=>{setS(input);return{ok:true,message:'Sale completed',saleId:'local-sale'}}}/><output data-testid="sale">{JSON.stringify(s)}</output></>};createRoot(document.getElementById('root')).render(<Test/>);`;
await build({stdin:{contents:posEntry,resolveDir:root,loader:'tsx'},bundle:true,outfile:`${out}/pos.js`,jsx:'automatic',plugins:[{name:'local-boundaries',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));
 b.onResolve({filter:/^@\/(app\/dashboard\/receptionist\/actions|components\/GreenChoiceDashboard|components\/account\/DashboardAccountMenu)$/},args=>({path:args.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='link'?`import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`:args.path.includes('GreenChoiceDashboard')?`export function Money({value}){return 'R'+value.toFixed(2)}`:args.path.includes('DashboardAccountMenu')?`export function DashboardAccountPanel(){return null}`:`export async function checkoutReceptionistSaleAction(){throw Error('Unexpected real checkout')};export async function registerReceptionistCustomerAction(input){return fetch('/register',{method:'POST',body:JSON.stringify(input)}).then(r=>r.json())}`,loader:'js',resolveDir:root}));
}}]});
let searches=[];
const customers=[{id:'alice',firstName:'Alice',surname:'Local',fullName:'Alice Local',phoneNumber:'082 000 0001'},{id:'bongi',firstName:'Bongi',surname:'Local',fullName:'Bongi Local',phoneNumber:'082 000 0002'}];
const server=createServer(async(req,res)=>{
 if(req.url==='/pos.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(`${out}/pos.js`));return;}
 if(req.url==='/browser.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(`${out}/browser.js`));return;}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync(`${out}/style.css`));return;}
 if(req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);res.setHeader('Content-Type','application/json');
  if(req.url==='/register'){const customer={id:'registered',...data,fullName:data.firstName+' '+data.surname};customers.push(customer);res.end(JSON.stringify({ok:true,customer,duplicate:false}));return;}
  searches.push(data.query);const found=customers.filter(c=>(data.mode==='phone'?c.phoneNumber:c.fullName).toLowerCase().includes(data.query.toLowerCase()));
  setTimeout(()=>res.end(JSON.stringify({ok:true,customers:found})),data.query==='Alice'?1000:25);return;
 }
 res.end(('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="background:#07100c"><div id="root"></div><script src="/browser.js"></script></body></html>').replace('/browser.js',req.url==='/pos'?'/pos.js':'/browser.js'));
});
await new Promise(r=>server.listen(3017,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const results=[];
async function choosePayment(page, method){
 await page.locator('label').filter({has:page.getByRole('radio',{name:method,exact:true})}).click();
}
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:3017')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:3017');
  const search=page.getByRole('textbox',{name:'Customer search'});
  searches=[];await search.pressSequentially('Bongi',{delay:25});
  await page.getByRole('button',{name:'Select Bongi Local'}).waitFor();assert.deepEqual(searches,['Bongi']);
  await search.fill('Alice');await page.waitForTimeout(280);const start=Date.now();await search.fill('Bongi');
  await page.getByRole('button',{name:'Select Bongi Local'}).waitFor();const latestResultMs=Date.now()-start;assert.ok(latestResultMs<850);
  await page.waitForTimeout(1050);assert.equal(await page.getByRole('button',{name:'Select Alice Local'}).count(),0);
  await page.getByRole('button',{name:'Select Bongi Local'}).click();
  const complete=page.getByRole('button',{name:/Complete sale/i});assert.equal(await complete.isEnabled(),false);
  for(const method of ['Cash','Card','Split']){
   await choosePayment(page,method);
   if(method==='Split'){
    for(const [cash,card] of [['300','449'],['-1','751'],['751','0'],['300.001','449.999'],['','750']]){
     await page.getByLabel('Cash amount').fill(cash);await page.getByLabel('Card amount').fill(card);assert.equal(await complete.isEnabled(),false);
    }
    await page.getByLabel('Cash amount').fill('300');await page.getByLabel('Card amount').fill('450');
    await page.screenshot({path:`${out}/split-${viewport.width}.png`,fullPage:true});
   }
   assert.equal(await complete.isEnabled(),true);await complete.click();
   const payment=JSON.parse(await page.getByTestId('payment').textContent());assert.equal(payment.method,method.toLowerCase());assert.equal(payment.cashAmount+payment.cardAmount,750);
  }
  await page.getByRole('button',{name:'Register New Customer'}).click();
  for(const label of ['Name','Surname','Cellphone Number']){const field=page.getByLabel(label,{exact:true});assert.equal(await field.inputValue(),'');assert.equal(await field.getAttribute('placeholder'),null);}
  await page.getByLabel('Name',{exact:true}).fill('Discarded');await page.getByRole('button',{name:'Register New Customer'}).click();await page.getByRole('button',{name:'Register New Customer'}).click();assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'');
  await page.screenshot({path:`${out}/registration-${viewport.width}.png`,fullPage:true});
  await page.getByLabel('Name',{exact:true}).fill('Zola');await page.getByLabel('Surname',{exact:true}).fill('Local');await page.getByLabel('Cellphone Number').fill('082 123 4567');await page.getByRole('button',{name:'Register and Select'}).click();await page.getByRole('button',{name:'Complete sale for Zola Local'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
  results.push({viewport,latestResultMs,checks:'Cash/Card/Split callbacks, invalid split blocked, debounce one request, stale result suppressed, empty registration/reopening, registration selects customer, no horizontal overflow or JS errors'});await page.close();
  const pos=await browser.newPage({viewport});const posErrors=[];pos.on('pageerror',e=>posErrors.push(e.message));
  await pos.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:3017')?route.continue():route.abort());
  await pos.goto('http://127.0.0.1:3017/pos');
  await pos.getByRole('button',{name:'Accessories',exact:true}).click();
  await pos.getByRole('button',{name:/Grinders/}).click();
  await pos.getByRole('button',{name:'Add to cart',exact:true}).waitFor();
  await pos.getByRole('button',{name:'Add to cart',exact:true}).click();
  await pos.getByRole('button',{name:'Checkout (1)',exact:true}).click();
  await pos.getByRole('button',{name:'Clear All Items'}).click();
  await pos.getByRole('dialog').waitFor();
  assert.equal(await pos.getByRole('button',{name:/Complete sale/i}).isEnabled(),false);
  await pos.getByRole('button',{name:'Back to POS'}).click();
  await pos.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await pos.getByRole('button',{name:'Checkout',exact:true}).isEnabled(),false);
  for(const method of ['Cash','Card','Split']){
    await pos.getByRole('button',{name:'Add to cart',exact:true}).click();
    await pos.getByRole('button',{name:'Checkout (1)',exact:true}).click();
    await pos.getByRole('textbox',{name:'Customer search'}).fill('Bongi');await pos.getByRole('button',{name:'Select Bongi Local'}).click();
    await choosePayment(pos,method);
    if(method==='Split'){await pos.getByLabel('Cash amount').fill('300');await pos.getByLabel('Card amount').fill('450');}
    await pos.getByRole('button',{name:'Complete sale for Bongi Local'}).click();
    await pos.getByRole('dialog').waitFor({state:'hidden'});
    await pos.waitForFunction((expected) => {
      const text = document.querySelector('[data-testid="sale"]')?.textContent;
      if (!text || text === 'null') return false;
      return JSON.parse(text).payment?.method === expected.toLowerCase();
    }, method);
    const saved=JSON.parse(await pos.getByTestId('sale').textContent());assert.equal(saved.payment.method,method.toLowerCase());assert.equal(saved.items.length,1);assert.equal(saved.items[0].unitPrice,750);assert.equal(saved.customerId,'bongi');
    assert.equal(await pos.getByRole('button',{name:'Checkout',exact:true}).isEnabled(),false);
  }
  assert.deepEqual(posErrors,[]);results.push({viewport,checks:'Full POS: add product -> clear items keeps modal open -> search/select customer -> Cash/Card/Split payload -> success closes dialog and clears cart'});await pos.close();
 }
 writeFileSync(`${out}/browser-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
