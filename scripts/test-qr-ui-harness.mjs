// Isolated UI test server: real components, synthetic data, no application backdoor.
import { build } from "esbuild";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync("tmp", { recursive: true });
await build({
  stdin: { contents: `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import {RegistrationForm} from './components/registration/RegistrationForm'; import {StoreRegistrationQR} from './components/manager/StoreRegistrationQR'; import {ReceptionistPOS} from './components/receptionist/pos/ReceptionistPOS'; import {CustomerCheckoutDialog} from './components/receptionist/pos/CustomerCheckoutDialog';
    const product={id:'00000000-0000-4000-8000-000000000031',name:'Test Accessory',categoryName:'Accessories',categorySlug:'accessories',subcategory:'Grinders',cultivationType:null,description:'Synthetic fixture',imageUrl:null,imagePath:null,sizeLabel:null,strainType:null,sellingPrice:750,productStatus:'active',isActive:true,isNew:false,quantityAvailable:100,lowStockThreshold:5};
    function Checkout(){const [customer,setCustomer]=useState(null); return <CustomerCheckoutDialog open cart={[{productId:product.id,name:product.name,categoryName:'Accessories',subcategory:'Grinders',imageSrc:'/placeholder-images/Grinder.png',unitPrice:750,quantity:1,stockAvailable:100,sizeLabel:null}]} cartCount={1} selectedCustomer={customer} total={750} totalLabel="R750" isCompleting={false} storeName="Test Store" profileLabel="Test Receptionist" accountRole="receptionist" onClose={()=>{}} onClearCart={()=>{}} onChangeQuantity={()=>{}} onRemoveItem={()=>{}} onSelectCustomer={setCustomer} onCompleteSale={()=>{}}/>;}
    function POS(){const [sale,setSale]=useState(null);return <><ReceptionistPOS products={[product]} categories={[{name:'Accessories',slug:'accessories',count:1}]} storeName="Test Store" profileLabel="Test Receptionist" accountRole="receptionist" checkoutAction={async input=>{setSale(input);return {ok:true,message:'Sale completed',saleId:'test-sale'}}}/><output data-testid="completed-sale">{JSON.stringify(sale)}</output></>;}
    createRoot(document.getElementById('root')).render(location.pathname === '/manager' ? <StoreRegistrationQR/> : location.pathname === '/receptionist' ? <POS/> : location.pathname === '/checkout' ? <Checkout/> : <RegistrationForm token={'a'.repeat(64)} storeName="GreenChoice Test Store"/>);`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, outfile: "tmp/qr-ui-test.js", platform: "browser", jsx: "automatic",
  alias: { "@": process.cwd() }, define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "synthetic-staff-boundaries", setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    build.onResolve({ filter: /^@\/(app\/dashboard\/receptionist\/actions|components\/GreenChoiceDashboard|components\/account\/DashboardAccountMenu)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", resolveDir: process.cwd(), contents:
      args.path === "link" ? "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}"
      : args.path.includes("GreenChoiceDashboard") ? "export function Money({value}){return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value))}"
      : args.path.includes("DashboardAccountMenu") ? "export function DashboardAccountPanel(){return null}"
      : "export async function checkoutReceptionistSaleAction(){throw Error('Unexpected database write')}"
    }));
  } }]
});
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", "tmp/qr-ui-test.css"], { stdio: "pipe" });
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>`;
createServer((request, response) => {
  if (/^\/(branding|placeholder-images|images)\/[a-zA-Z0-9._/-]+\.png$/.test(request.url ?? "")) {
    const image = resolve("public", request.url.slice(1));
    response.setHeader("Content-Type", "image/png");
    if (existsSync(image)) response.end(readFileSync(image)); else { response.statusCode = 404; response.end(); }
    return;
  }
  if (request.url === "/test.js" || request.url === "/test.css") {
    response.setHeader("Content-Type", request.url.endsWith(".js") ? "text/javascript" : "text/css");
    response.end(readFileSync(resolve("tmp", request.url.endsWith(".js") ? "qr-ui-test.js" : "qr-ui-test.css"))); return;
  }
  response.setHeader("Content-Type", "text/html"); response.end(html);
}).listen(3107, "127.0.0.1", () => console.log("Isolated registration UI harness ready on http://127.0.0.1:3107"));
