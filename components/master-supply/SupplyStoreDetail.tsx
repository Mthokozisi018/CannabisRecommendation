"use client";
import { useEffect, useMemo, useState } from "react";
import { Package, Banknote, Boxes, CalendarDays, Maximize2, X } from "lucide-react";
import type { SupplySnapshot } from "@/lib/master-supply/data";
import { buildSupplyPerformance, performanceBucket, performanceBuckets, type PerformancePeriod } from "@/lib/master-supply/performance";
import { StoreBanner } from "@/components/franchise/UI";
import styles from "./SupplyPerformance.module.css";

const money=(n:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(n);
const count=(n:number)=>new Intl.NumberFormat("en-ZA").format(n);
type Mode="revenue"|"products";
type Chart="trend"|"ranking";
const periods:PerformancePeriod[]=["days","weeks","months","years"];

function Plot({values,bar,currency,large}:{values:{label:string;value:number}[];bar:boolean;currency:boolean;large:boolean}) {
 const [active,setActive]=useState<number|null>(null);
 const width=Math.max(560,values.length*76),height=large?360:270,left=62,right=20,top=28,bottom=60;
 const max=Math.max(1,...values.map(v=>v.value)),span=width-left-right,plotHeight=height-top-bottom;
 const x=(i:number)=>left+(i+.5)*span/Math.max(1,values.length);
 const y=(v:number)=>top+plotHeight-v/max*plotHeight;
 const formatted=(v:number)=>currency?money(v):count(v);
 if(!values.some(v=>v.value>0))return <p className={styles.empty}>No attributable {currency?"revenue":"product sales"} in this period.</p>;
 return <div className={styles.chartScroll} tabIndex={0} aria-label="Scroll chart horizontally"><svg role="img" aria-label={bar?"Performance ranking":"Performance over time"} viewBox={"0 0 "+width+" "+height} style={{width,height}}>
  {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={width-right} y1={y(t*max)} y2={y(t*max)} stroke="#285541" strokeDasharray="4 5"/><text x={left-8} y={y(t*max)+4} textAnchor="end" className={styles.axis}>{currency?"R "+Math.round(t*max):count(Math.round(t*max))}</text></g>)}
  {!bar?<polyline points={values.map((v,i)=>x(i)+","+y(v.value)).join(" ")} fill="none" stroke="#59e9a2" strokeWidth="3"/>:null}
  {values.map((v,i)=><g key={v.label+":"+i}>
   {bar?<rect x={x(i)-23} y={y(v.value)} width="46" height={Math.max(1,top+plotHeight-y(v.value))} rx="5" fill={["#22d99a","#53b9fa","#b785ed","#f4b654"][i%4]} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)}><title>{v.label}: {formatted(v.value)}</title></rect>:<circle cx={x(i)} cy={y(v.value)} r="5" fill="#59e9a2"/>}
   <circle cx={x(i)} cy={bar?Math.max(top+12,y(v.value)):y(v.value)} r="16" fill="transparent" role="button" tabIndex={0} aria-label={v.label+": "+formatted(v.value)} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setActive(i);}}}><title>{v.label}: {formatted(v.value)}</title></circle>
   {active===i?<g pointerEvents="none"><rect x={Math.max(0,Math.min(width-188,x(i)-94))} y={Math.max(2,y(v.value)-51)} width="188" height="38" rx="6" fill="#081e15" stroke="#59e9a2"/><text x={Math.max(0,Math.min(width-188,x(i)-94))+94} y={Math.max(2,y(v.value)-51)+16} textAnchor="middle" className={styles.tooltip}>{v.label.slice(0,24)}</text><text x={Math.max(0,Math.min(width-188,x(i)-94))+94} y={Math.max(2,y(v.value)-51)+31} textAnchor="middle" className={styles.tooltip}>{formatted(v.value)}</text></g>:null}
   <text x={x(i)} y={height-23} textAnchor="middle" className={styles.axis}><title>{v.label}</title>{v.label.length>12?v.label.slice(0,10)+"…":v.label}</text>
  </g>)}
  <text x={width/2} y={height-3} textAnchor="middle" className={styles.axis}>{bar?currency?"Category":"Product":"Sale period"}</text>
 </svg></div>;
}

export function SupplyStoreDetail({snapshot}:{snapshot:SupplySnapshot}) {
 const store=snapshot.stores.find(s=>s.id===snapshot.storeId);
 const now=useMemo(()=>new Date(),[]);
 const report=useMemo(()=>buildSupplyPerformance(snapshot,now),[snapshot,now]);
 const [mode,setMode]=useState<Mode>("revenue"),[trendPeriod,setTrendPeriod]=useState<PerformancePeriod>("months"),[rankPeriod,setRankPeriod]=useState<PerformancePeriod>("months"),[expanded,setExpanded]=useState<Chart|null>(null);
 useEffect(()=>{if(!expanded)return;const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(null);};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[expanded]);
 if(!store)return <p className={styles.empty}>This store is unavailable.</p>;
 const trend=performanceBuckets(now,trendPeriod).map(label=>({label,value:report.sales.filter(s=>performanceBucket(s.date,trendPeriod)===label).reduce((n,s)=>n+(mode==="revenue"?s.revenueCents/100:s.units),0)}));
 const rankSet=new Set(performanceBuckets(now,rankPeriod)),rankMap=new Map<string,{label:string;value:number}>();
 for(const sale of report.sales){if(!rankSet.has(performanceBucket(sale.date,rankPeriod)))continue;const key=mode==="revenue"?sale.category:sale.productId;const row=rankMap.get(key)??{label:mode==="revenue"?sale.category:sale.product,value:0};row.value+=mode==="revenue"?sale.revenueCents/100:sale.units;rankMap.set(key,row);}
 const ranking=[...rankMap.values()].filter(r=>r.value>0).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
 const cards=[
  {label:"Supply This Month",value:count(report.monthReceived)+" Products",icon:Package,theme:"green"},
  {label:"Revenue From This Month's Supply",value:report.monthRevenueCents===null?"Unavailable":money(report.monthRevenueCents/100),icon:Banknote,theme:"blue"},
  {label:"Total Supply This Year",value:count(report.yearReceived)+" Products",icon:Boxes,theme:"purple"},
  {label:"Revenue From This Year's Supply",value:report.yearRevenueCents===null?"Unavailable":money(report.yearRevenueCents/100),icon:CalendarDays,theme:"gold"},
 ];
 const chart=(which:Chart,large=false)=>{
  const isTrend=which==="trend",title=isTrend?(mode==="revenue"?"Supply Revenue Over Time":"Supplied Products Sold Over Time"):(mode==="revenue"?"Supply Revenue by Category":"Product Sales Performance");
  const period=isTrend?trendPeriod:rankPeriod,setPeriod=isTrend?setTrendPeriod:setRankPeriod;
  const reliable=mode==="revenue"?report.revenueReliable:report.unitsReliable;
  return <section className={styles.chartCard} key={which}><div className={styles.chartHeader}><h2>{title}</h2><div className={styles.controls}><select value={period} aria-label={title+" period"} onChange={e=>setPeriod(e.target.value as PerformancePeriod)}>{periods.map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select><button type="button" aria-label={(large?"Close ":"Expand ")+title} onClick={()=>setExpanded(large?null:which)}>{large?<X size={18}/>:<Maximize2 size={18}/>}</button></div></div>
   {reliable?<Plot values={isTrend?trend:ranking} bar={!isTrend} currency={mode==="revenue"} large={large}/>:<p className={styles.empty}>{report.reason}</p>}
  </section>;
 };
 return <div className={styles.dashboard}>
  <StoreBanner store={{...store,physical_store_address:store.physical_store_address??null,postal_code:store.postal_code??null,store_phone_number:store.store_phone_number??null,store_contact_email:store.store_contact_email??null,created_at:store.created_at??new Date(0).toISOString()}}/>
  <div className={styles.kpis}>{cards.map(card=><div className={styles.kpi} data-theme={card.theme} key={card.label}><span className={styles.kpiIcon}><card.icon size={25}/></span><div><p>{card.label}</p><strong>{card.value}</strong></div></div>)}</div>
  {report.reason?<p className={styles.limit} role="status">{report.reason}</p>:null}
  <div className={styles.mode} role="group" aria-label="Performance view"><button type="button" aria-pressed={mode==="revenue"} onClick={()=>setMode("revenue")}>Store Revenue</button><button type="button" aria-pressed={mode==="products"} onClick={()=>setMode("products")}>Product Performance</button></div>
  <div className={styles.charts}>{chart("trend")}{chart("ranking")}</div>
  {expanded?<div className={styles.dialogBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)setExpanded(null);}}><div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Expanded supply performance graph">{chart(expanded,true)}</div></div>:null}
 </div>;
}
