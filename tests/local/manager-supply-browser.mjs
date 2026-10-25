// Local browser verification with synthetic identities/data. No remote services.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync,readFileSync,writeFileSync,existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium,expect } from "@playwright/test";
import assert from "node:assert/strict";
import { buildSupplyReport,parseSupplyFilters } from "../../lib/manager/supply-report-model.ts";
import { supplySource } from "../fixtures/supply-report.ts";
const root=process.cwd(),out="tmp/manager-supply-verification";
mkdirSync(out,{recursive:true});
const context={store_id:"20000000-0000-4000-8000-000000000001",store_name:"Pretoria East",franchise_id:"franchise",franchise_name:"GreenChoice Franchise"};
const products=[
 {id:"10000000-0000-4000-8000-000000000001",sku:"GC-F-001",name:"Sunrise Flower",category:"Flower",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:"/images/product-placeholders/flower/indoor.png",available:true},
 {id:"10000000-0000-4000-8000-000000000002",sku:"GC-F-002",name:"Coastal Flower",category:"Flower",subcategory:"Indica",strain_type:"Indica",cultivation_type:"Greenhouse",image_url:null,available:false},
 {id:"10000000-0000-4000-8000-000000000003",sku:"GC-E-001",name:"Berry Gummies",category:"Edibles",subcategory:"Gummies",strain_type:null,cultivation_type:null,image_url:"/images/receptionist/edibles-gummies.png",available:true},
 {id:"10000000-0000-4000-8000-000000000004",sku:"GC-P-001",name:"Sunrise Pre-Roll",category:"Pre-Rolls",subcategory:"Sativa",strain_type:"Sativa",cultivation_type:"Indoor",image_url:null,available:true},
];
const requests=[],distributions=[];let writes=0;
const report=buildSupplyReport(supplySource,parseSupplyFilters({month:"2026-10"}));
execFileSync(process.execPath,["node_modules/tailwindcss/lib/cli.js","-i","app/globals.css","-o",`${out}/style.css`],{stdio:"pipe"});
await build({stdin:{resolveDir:root,loader:"tsx",contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ManagerSupplyRequestForm,ManagerSupplyRequests}from'./components/manager/ManagerSupplyRequests';import{SupplierManagement}from'./components/manager/SupplierManagement';let path=location.pathname;createRoot(document.getElementById('root')).render(path.startsWith('/suppliers')?<SupplierManagement storeName="Pretoria East" managerName="Test Manager" canRequestSupply={!path.endsWith('independent')} initialReport={window.__REPORT__}/>:path.endsWith('/new')?<ManagerSupplyRequestForm data={window.__DATA__}/>:<ManagerSupplyRequests data={window.__DATA__}/>);`},bundle:true,platform:"browser",outfile:`${out}/browser.js`,jsx:"automatic",alias:{"@":root},plugins:[{name:"local-boundaries",setup(b){
 b.onResolve({filter:/^next\/(image|navigation|link)$/},args=>({path:args.path,namespace:"mock"}));
 b.onResolve({filter:/^@\/app\/dashboard\/(franchise\/supply|manager\/suppliers)\/actions$/},args=>({path:args.path.includes("franchise")?"supply":"supplier",namespace:"mock"}));
 b.onLoad({filter:/.*/,namespace:"mock"},args=>({loader:"js",resolveDir:root,contents:args.path==="next/navigation"?"const router={refresh(){}};export function useRouter(){return router}":args.path==="next/image"?"import React from'react';export default function Image({unoptimized,...p}){return <img {...p}/>}".replace("return <img {...p}/>","return React.createElement('img',p)"):args.path==="next/link"?"import React from'react';export default function Link(p){return React.createElement('a',p)}":args.path==="supply"?"export async function masterSupplyAction(action,input){return fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input})}).then(r=>r.json())}":"export async function refreshManagerSupplyReport(){return {ok:true,report:window.__REPORT__}};export async function loadManagerSupplierProfile(){return {ok:false,message:'Not used'}};export async function saveSupplierAction(){throw Error('Unexpected write')};export async function archiveSupplierAction(){throw Error('Unexpected write')}"}));
}}]});
const server=createServer(async(req,res)=>{
 const map={"/browser.js":"browser.js","/browser.css":"browser.css","/style.css":"style.css"};
 if(map[req.url]){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(`${out}/${map[req.url]}`));return;}
 if(req.url.startsWith('/images/')){const p=resolve(root,'public',req.url.slice(1));if(p.startsWith(resolve(root,'public'))&&existsSync(p)){res.setHeader('Content-Type','image/png');res.end(readFileSync(p));}else{res.statusCode=404;res.end();}return;}
 if(req.url==='/submit'){
  let body='';for await(const chunk of req)body+=chunk;
  const {action,input}=JSON.parse(body);assert.equal(action,'request');assert.equal(input.expectedStoreId,context.store_id);assert.equal(input.items.length,2);
  writes++;requests.unshift({id:input.id,franchise_id:context.franchise_id,store_id:context.store_id,requested_by:'synthetic-manager',status:'pending',notes:input.notes,rejection_reason:'',created_at:new Date().toISOString(),reviewed_at:null,master_supply_request_items:input.items.map(i=>({product_id:i.productId,requested_quantity:i.quantity,approved_quantity:null}))});
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,id:input.id}));return;
 }
 res.setHeader('Content-Type','text/html');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/browser.css"></head><body style="margin:0;background:#061713"><div id="root"></div><script>window.__REPORT__=${JSON.stringify(report)};window.__DATA__=${JSON.stringify({context,products,requests,distributions})}</script><script src="/browser.js"></script></body></html>`);
});
await new Promise(done=>server.listen(3023,'127.0.0.1',done));
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3023/suppliers');
  await expect(page.getByRole('heading',{name:'Suppliers',exact:true,level:1})).toBeVisible();
  await expect(page.getByRole('link',{name:'View Supply Requests',exact:true})).toBeVisible();
  await expect(page.getByText('Dispensary System',{exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${out}/suppliers-${width}.png`,fullPage:true});
  await page.goto('http://127.0.0.1:3023/suppliers-independent');
  await expect(page.getByRole('link',{name:'Send Supply Request',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'View Supply Requests',exact:true})).toHaveCount(0);
  await page.goto('http://127.0.0.1:3023/dashboard/manager/suppliers/requests/new');
  await expect(page.getByRole('heading',{name:'Request Supply',exact:true})).toBeVisible();
  const unavailable=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Coastal Flower',exact:true})});await expect(unavailable.getByRole('button')).toBeDisabled();
  await page.getByLabel('Cultivation Type').selectOption('Indoor');await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Cultivation Type').selectOption('');
  await page.screenshot({path:`${out}/catalogue-${width}.png`,fullPage:true});
  const flower=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Sunrise Flower',exact:true})});
  await flower.getByRole('spinbutton').fill('500');await flower.getByRole('button',{name:'Add to Request'}).click();
  await page.getByRole('button',{name:'Edibles',exact:true}).click();await expect(page.getByLabel('Cultivation Type')).toHaveCount(0);
  const gummy=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Berry Gummies',exact:true})});await gummy.getByRole('spinbutton').fill('20');await gummy.getByRole('button',{name:'Add to Request'}).click();
  await page.getByLabel('Optional manager notes').fill('Weekend replenishment');await page.getByRole('button',{name:'Review Supply Request',exact:true}).click();
  await page.screenshot({path:`${out}/review-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Submit Supply Request',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Confirm Submission'}).click();await expect(page.getByRole('heading',{name:'Supply Request Submitted Successfully'})).toBeVisible();
  await page.getByRole('link',{name:'View Supply Requests',exact:true}).click();await page.getByRole('button',{name:'View',exact:true}).first().click();
  await expect(page.getByText('Your notes: Weekend replenishment')).toBeVisible();await page.screenshot({path:`${out}/history-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);results.push({width,passed:true});await page.close();
 }
 assert.equal(writes,3);writeFileSync(`${out}/results.json`,JSON.stringify({syntheticBrowserVerification:true,remoteServicesUsed:false,writes,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(done=>server.close(done));}
