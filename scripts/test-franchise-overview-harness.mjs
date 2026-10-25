// Isolated real-component UI verification, synthetic data, no database connection.
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
mkdirSync("tmp", { recursive: true });
const managerLoginFixtures = Array.from({ length: 28 }, (_, i) => ({ id: `login-${i}`, store_id: "a", user_id: `10000000-0000-4000-8000-00000000000${i % 2 + 1}`, created_at: new Date(Date.UTC(2026, 9, 15, 12) - i * 3600000).toISOString(), result: "success", details: i === 1 ? { role: "manager" } : { role: "manager", ipAddress: "192.0.2.10", userAgent: "Recorded browser / desktop" } }));
await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {FranchiseSalesOverview} from './components/franchise/FranchiseSalesOverview';
    import {FranchiseRevenueReporting} from './components/franchise/FranchiseRevenueReporting';
    import {StoreManagement} from './components/franchise/StoreManagement';
    import {StoreDirectory} from './components/franchise/StoreDirectory';
    import {StoreSalesOverview} from './components/franchise/StoreSalesOverview';
    import {FranchiseDashboardBack} from './components/franchise/FranchiseDashboardBack';
    import {FranchiseStoresNavigation} from './components/franchise/FranchiseStoresNavigation';
    import StoresLoading from './app/dashboard/franchise/stores/loading';
    import StoresError from './app/dashboard/franchise/stores/error';
    import {FranchiseSalesNavigation} from './components/franchise/FranchiseSalesNavigation';
    import {NavigationLoadingOverlay} from './components/NavigationLoadingOverlay';
    import SalesLoading from './app/dashboard/franchise/sales/loading';
    import SalesError from './app/dashboard/franchise/sales/error';
    import styles from './components/franchise/Franchise.module.css';
    import {RevenueChart,BarChart} from './components/franchise/UI';
    const daily=[{store_id:'a',day:'2026-01-01',revenue:1576626.15,transactions:10},{store_id:'a',day:'2026-10-12',revenue:123.45,transactions:3},{store_id:'b',day:'2026-10-12',revenue:0.30,transactions:1},{store_id:'a',day:'2026-10-13',revenue:25.10,transactions:2}];
    const stores=['a','b'].map(id=>({store:{id,name:id==='a'?'Alpha Store':'Beta Store',franchise_id:'fixture',slug:id,is_active:true,store_access_status:'active',created_at:'2026-01-01T00:00:00Z',opening_hours:null,city:id==='a'?'Johannesburg':null,province:id==='a'?'Gauteng':null,physical_store_address:id==='a'?'Shop 123, Botanical Gardens Shopping Centre, 456 Main Road':null,postal_code:id==='a'?'2196':null,store_image_url:id==='a'?'/images/franchise/store-default.png?uploaded=1':null},managers:id==='a'?[{id:'manager-a',full_name:'Alexandra Example',email:'alexandra@example.test'},{id:'manager-b',full_name:'Second Manager',email:'second@example.test'}]:[],customers:20}));
    const performanceStores = new URLSearchParams(location.search).has('many-stores') ? Array.from({length:24},(_,i)=>({...stores[i%2],store:{...stores[i%2].store,id:i<2?stores[i].store.id:'extra-'+i,name:'GreenChoice Johannesburg Branch '+String(i+1).padStart(2,'0')}})) : stores;
    const managementMode = location.pathname.endsWith('/management-fixture') || location.pathname.startsWith('/dashboard/franchise/stores/directory-');
    const managerLogins = ${JSON.stringify(managerLoginFixtures)};
    const managementStaff = Array.from({length:8},(_,i)=>({id:'staff-'+i,auth_user_id:'10000000-0000-4000-8000-00000000000'+(i+1),store_id:'a',role:i<3?'manager':'receptionist',full_name:i<3?'Manager '+(i+1):'Receptionist '+(i-2),first_name:'Staff',surname:String(i+1),email:'staff'+i+'@example.test',account_status:'active',created_at:'2026-01-01T00:00:00Z'}));
    const directoryMode = location.pathname === '/dashboard/franchise/stores';
    const directoryStores = Array.from({length:7},(_,i)=>({...stores[i%2].store,id:'directory-'+i,name:i===0?'GreenChoice Johannesburg Botanical Gardens and Wellness Centre':i===1?'GreenChoice Rosebank':'GreenChoice Store '+(i+1),physical_store_address:i===0?'Shop 123, The Exceptionally Long Shopping Centre Name, 456 Botanical Gardens Boulevard':'12 Main Road',city:'Johannesburg',province:'Gauteng',postal_code:'2196',store_phone_number:i===2?null:'+27 11 555 0100',is_active:i!==1}));
    const directoryStaff = directoryStores.flatMap((store,i)=>i===2?[]:[{id:'manager-'+i,store_id:store.id,role:'manager',full_name:i===0?'Alexandra Long Manager Name, Thabo Second Manager Name':'Manager '+i,email:'manager'+i+'@example.test'}]);
    const storesNavigationMode = new URLSearchParams(location.search).has('stores-navigation-test');
    const storesRefreshMode = new URLSearchParams(location.search).has('stores-refresh-test');
    const navigationMode = storesNavigationMode || new URLSearchParams(location.search).has('navigation-test');
    const chartMode = new URLSearchParams(location.search).has('chart-test');
    function ChartFixtures() {
      const [scenario,setScenario]=React.useState('normal');
      const count=scenario==='year' ? 120 : scenario==='weekly' ? 60 : 13;
      const points=Array.from({length:count},(_,i)=>({label:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),value:scenario==='zero' ? 0 : scenario==='small' ? (i%4)*.01 : scenario==='large' ? 1576774.7*(i%4) : (i%4)*25.1}));
      const bars=Array.from({length:12},(_,i)=>({label:'Store '+(i+1)+' Johannesburg CBD branch',value:scenario==='zero' ? 0 : scenario==='small' ? i*.01 : scenario==='large' ? (i+1)*987654321.12 : (i+1)*25.1}));
      return <><label>Chart scenario<select aria-label='Chart scenario' value={scenario} onChange={e=>setScenario(e.target.value)}>{['normal','zero','small','large','weekly','year'].map(v=><option key={v}>{v}</option>)}</select></label><div className={styles.charts}><RevenueChart title='Axis test revenue' values={points} period={{preset:scenario==='year' ? 'year' : 'custom',from:points[0].label,to:points[points.length-1].label}}/><BarChart title='Axis test stores' values={bars}/></div></>;
    }
    let advance;
    function FirstSaleFixtures() {
      const [now,setNow]=React.useState('2026-10-13T12:00:00+02:00');
      const [hasSales,setHasSales]=React.useState(!new URLSearchParams(location.search).has('no-sales'));
      window.fixtureRevenueDate=setNow; window.fixtureRevenueStartSales=()=>setHasSales(true);
      const rows=hasSales?[
        {store_id:'a',day:'2026-06-18',revenue:20,transactions:1},
        {store_id:'a',day:'2026-10-12',revenue:5,transactions:1},
        {store_id:'b',day:'2026-10-12',revenue:100,transactions:1},
        {store_id:'b',day:'2026-10-13',revenue:50,transactions:1},
        {store_id:'b',day:'2027-01-04',revenue:7,transactions:1},
      ].filter(row=>row.day<=now.slice(0,10)):[];
      const snapshot={from:now.slice(0,4)+'-01-01',to:now.slice(0,10),daily:rows};
      const storeRows=rows.filter(row=>row.store_id==='b');
      return <div className={styles.charts}>
        <FranchiseRevenueReporting snapshot={snapshot} historyStart={hasSales?'2026-06-18':null} now={now} preferenceKey='fixture.franchise' loadRange={async range=>({...range,daily:rows.filter(row=>row.day>=range.from&&row.day<=range.to)})}/>
        <FranchiseRevenueReporting reportName='Store Revenue' snapshot={{...snapshot,daily:storeRows}} historyStart={hasSales?'2026-10-12':null} now={now} preferenceKey='fixture.store.b' loadRange={async range=>({...range,daily:storeRows.filter(row=>row.day>=range.from&&row.day<=range.to)})}/>
      </div>;
    }
    function Harness() {
      const [stage,setStage]=React.useState(storesRefreshMode ? 'loading' : navigationMode ? 'home' : 'ready');
      advance = (next) => {
        if (next !== 'home') { history.replaceState(null,'',storesNavigationMode || storesRefreshMode ? '/dashboard/franchise/stores' : '/dashboard/franchise/sales'); window.dispatchEvent(new Event('fixture-route')); }
        setStage(next);
      };
      window.fixtureAdvance=advance;
      window.fixtureRefresh=navigationMode||storesRefreshMode?()=>advance('loading'):()=>{window.fixtureRefreshCount=(window.fixtureRefreshCount||0)+1};
      return <FranchiseSalesNavigation><FranchiseStoresNavigation><NavigationLoadingOverlay/><main className={styles.shell}>
      <header className={styles.header}><a href='/dashboard/franchise' className={styles.brand}><span>Green</span>Choice</a><div className={styles.nav}><span className={styles.headerIdentity}><span>Fixture Administrator</span><span className={styles.headerRole}>Franchise Administrator</span></span><button className={styles.button}>Sign out</button></div></header>
      <FranchiseDashboardBack/>
      {(storesNavigationMode || storesRefreshMode) && stage === 'loading' ? <StoresLoading/> : (storesNavigationMode || storesRefreshMode) && stage === 'error' ? <StoresError error={new Error('Synthetic directory load failure')} retry={()=>advance('loading')}/> : (storesNavigationMode || storesRefreshMode) && stage === 'ready' ? <StoreDirectory stores={directoryStores} staff={directoryStaff}/> : managementMode ? <StoreManagement store={directoryStores.find(store=>location.pathname.endsWith('/'+store.id)) || stores[0].store} staff={new URLSearchParams(location.search).has('slots')?managementStaff.filter((_,i)=>i!==2&&i!==7):managementStaff} logins={managerLogins} managerHistory={{rows:new URLSearchParams(location.search).has('empty')?[]:managerLogins.slice(0,25),hasNext:!new URLSearchParams(location.search).has('empty'),filters:{from:'',to:'',manager:'',status:'all',page:1}}}/> : directoryMode ? <StoreDirectory stores={directoryStores} staff={directoryStaff}/> : new URLSearchParams(location.search).has('first-sale') ? <FirstSaleFixtures/> : chartMode ? <ChartFixtures/> : stage === 'home' ? <nav><a data-navigation-loading='franchise-sales' href='/dashboard/franchise/sales' onClick={event=>event.preventDefault()}>Sales and Performance</a><a data-navigation-loading='franchise-stores' href='/dashboard/franchise/stores' onClick={event=>event.preventDefault()}>Manage Store</a><a href='/dashboard/franchise/stores/new' onClick={event=>event.preventDefault()}>Add Store</a></nav> : stage === 'loading' ? <SalesLoading/> : stage === 'error' ? <SalesError error={new Error('Synthetic sales load failure')} retry={()=>advance('loading')}/> : location.pathname.endsWith('/sales/a') ?
      <StoreSalesOverview historyStart='2024-02-01' store={stores[0].store} managers='Fixture Manager' snapshot={{from:'2026-01-01',to:'2026-10-13',daily:daily.filter(r=>r.store_id==='a')}} details={{from:new URLSearchParams(location.search).get('from')||'2026-10-01',to:new URLSearchParams(location.search).get('to')||'2026-10-13',categories:[{label:'Flower',value:148.55}],products:[{key:'flower',name:'Fixture Flower',quantity:5,revenue:148.55}],transactions:[],transactionCount:5}} lowStock={[]} now='2026-10-13T12:00:00+02:00' kpis={[{label:'Revenue This Week',value:148.55,currency:true},{label:'Revenue This Month',value:148.55,currency:true},{label:'Revenue This Year',value:1576774.7,currency:true},{label:'Total Customers',value:20}]}/> :
      <FranchiseSalesOverview historyStart='2024-02-01' snapshot={{from:'2026-01-01',to:'2026-10-13',daily}} stores={performanceStores} now='2026-10-13T12:00:00+02:00' tablePeriod={{from:'2026-10-01',to:'2026-10-13'}} kpis={[{label:'Revenue This Week',value:148.85,currency:true},{label:'Revenue This Month',value:148.85,currency:true},{label:'Revenue This Year',value:1576775,currency:true},{label:'Total Customers',value:40}]}/>}
    </main></FranchiseStoresNavigation></FranchiseSalesNavigation>; } createRoot(document.getElementById('root')).render(<Harness/>);`,
  },
  outfile: "tmp/franchise-overview-ui.js",
  bundle: true,
  platform: "browser",
  external: ["/images/*"],
  jsx: "automatic",
  alias: { "@": process.cwd() },
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [
    {
      name: "fixture-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^next\/(link|image|form|navigation)$|^@\/app\/dashboard\/franchise\/sales\/actions$|^@\/app\/dashboard\/franchise\/stores\/login-history-actions$|^@\/app\/(dashboard\/franchise\/actions|dashboard\/admin\/franchises\/actions|franchise\/setup\/actions)$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents:
            a.path.endsWith("/login-history-actions")
              ? "export async function loadManagerLoginHistory(storeId,filters){const response=await fetch('/fixture-manager-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({storeId,...filters})});if(!response.ok)throw Error('Unavailable');return response.json()}"
              : /\/(franchise|franchises)\/actions$|\/setup\/actions$/.test(a.path) && !a.path.includes('/sales/')
              ? "export const registerFranchiseAction=async()=>({ok:true,message:'Fixture'});export const registerFranchiseAdminAction=registerFranchiseAction;export const completeFranchiseSetupAction=registerFranchiseAction;export const saveFranchiseStoreAction=registerFranchiseAction;export const createFranchiseStaffAction=registerFranchiseAction;export const manageFranchiseStaffAction=registerFranchiseAction;export const uploadFranchiseStoreImageAction=registerFranchiseAction;"
              : a.path === "next/navigation"
              ? "import {useSyncExternalStore} from 'react';const subscribe=(cb)=>{window.addEventListener('fixture-route',cb);return ()=>window.removeEventListener('fixture-route',cb)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname); export const useSearchParams=()=>new URLSearchParams(location.search);const router={push:(path)=>{window.fixtureAdvance('loading')},refresh:()=>window.fixtureRefresh()};export const useRouter=()=>router;"
              : a.path === "next/link"
                ? "import React from 'react';export default function Link(p){return <a {...p}/>}"
                : a.path === "next/image"
                  ? "import React from 'react';export default function Image({unoptimized,...p}){return <img {...p}/>}"
                  : a.path === "next/form"
                    ? "import React from 'react';export default function Form(p){return <form {...p}/>}"
                    : "async function load(path,input){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});if(!r.ok)throw Error('Fixture unavailable');return r.json()} export const loadFranchiseSalesPeriod=(input)=>load('/fixture-period',input); export const loadFranchiseHistoricalSalesRange=loadFranchiseSalesPeriod; export const loadStoreRevenuePeriod=(store,input)=>load('/fixture-period',{...input,store}); export const loadStoreDetailPeriod=(store,input)=>load('/fixture-details',{...input,store});",
        }));
      },
    },
  ],
});
const requests = [];
const historical = [
  { store_id: "a", day: "2025-06-01", revenue: 10, transactions: 1 },
  { store_id: "b", day: "2025-06-02", revenue: 20, transactions: 2 },
];
const publicRoot = resolve("public");
const globalCss = readFileSync("app/globals.css", "utf8");
const loaderStart = globalCss.indexOf(".greenchoice-loader-overlay {");
const loaderCss = globalCss.slice(loaderStart, globalCss.indexOf("@media (max-width: 639px)", loaderStart));
createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/fixture-manager-history") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { storeId, ...filters } = JSON.parse(body);
    const rows = managerLoginFixtures.filter(row => row.store_id === storeId && (!filters.manager || row.user_id === filters.manager) && (!filters.from || row.created_at >= new Date(filters.from+"T00:00:00+02:00").toISOString()) && (!filters.to || row.created_at < new Date(Date.parse(filters.to+"T00:00:00+02:00")+86400000).toISOString()));
    const offset = (filters.page - 1) * 25;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ rows: rows.slice(offset, offset + 25), hasNext: rows.length > offset + 25, filters }));
    return;
  }
  if (pathname === "/fixture-period" || pathname === "/fixture-details") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const period = JSON.parse(body);
    requests.push(period);
    if (period.from === "2025-07-01")
      await new Promise((r) => setTimeout(r, 500));
    else await new Promise((r) => setTimeout(r, 80));
    if (
      period.from === "2025-08-01" &&
      requests.filter((p) => p.from === period.from).length === 1
    ) {
      res.statusCode = 503;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/fixture-details") {
      const revenue =
        period.from === "2026-10-13"
          ? 25.1
          : period.from.startsWith("2025")
            ? 10
            : 148.55;
      res.end(
        JSON.stringify({
          ...period,
          categories: [{ label: "Flower", value: revenue }],
          products: [
            { key: "flower", name: "Fixture Flower", quantity: 2, revenue },
          ],
          transactions: [],
          transactionCount: period.from === "2026-10-13" ? 2 : 5,
        }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        ...period,
        daily: [...historical,
          { store_id: "a", day: "2026-01-01", revenue: 1576626.15, transactions: 10 },
          { store_id: "a", day: "2026-10-12", revenue: 123.45, transactions: 3 },
          { store_id: "b", day: "2026-10-12", revenue: .3, transactions: 1 },
          { store_id: "a", day: "2026-10-13", revenue: 25.1, transactions: 2 },
        ].filter(
          (r) => r.day >= period.from && r.day <= period.to && (!period.store || r.store_id === period.store),
        ),
      }),
    );
    return;
  }
  if (pathname === "/fixture-metrics") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(requests));
    return;
  }
  if (pathname === "/fixture.js" || pathname === "/fixture.css") {
    res.setHeader(
      "Content-Type",
      pathname.endsWith("js") ? "text/javascript" : "text/css",
    );
    res.end(
      readFileSync(
        pathname.endsWith("js")
          ? "tmp/franchise-overview-ui.js"
          : "tmp/franchise-overview-ui.css",
      ),
    );
    return;
  }
  if (pathname.startsWith("/images/")) {
    const file = resolve(publicRoot, "." + pathname);
    if (!file.startsWith(publicRoot + sep)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      res.end(readFileSync(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>${loaderCss}body{margin:0;background:#06130d;font-family:Arial}*{box-sizing:border-box}a{color:inherit;text-decoration:none}h1,h2,p{margin-top:0}button,input,select{font:inherit}button{color:inherit;background:transparent;border:0}button{cursor:pointer}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
}).listen(3113, "127.0.0.1", () =>
  console.log("Franchise overview isolated UI harness ready"),
);
