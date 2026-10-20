import {test,expect} from '@playwright/test';
for(const width of [1440,1024,768,390]){
  test(`AUD-UI: expansion retains both stores across pagination at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/dashboard/franchise/sales');
    await page.getByRole('button',{name:'Expand sales by store graph',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'Sales by Store',exact:true});
    await expect(modal).toBeVisible();
    await expect.poll(()=>modal.locator('[class*="barPlot"] > svg').evaluate(el=>Math.abs((el as SVGSVGElement).viewBox.baseVal.width-el.getBoundingClientRect().width))).toBeLessThan(1);
    const labels:string[]=[];
    for(let i=0;i<5;i++){
      labels.push(...await modal.locator('g[aria-label]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')!)));
      const next=modal.getByRole('button',{name:'Next Sales by Store bars',exact:true});
      if(!await next.count()||await next.isDisabled())break;
      await next.click();
    }
    expect(labels.some(s=>s.includes('Alpha Store')&&s.includes('148,55'))).toBe(true);
    expect(labels.some(s=>s.includes('Beta Store')&&s.includes('0,30'))).toBe(true);
    expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`expanded-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(page.getByRole('button',{name:'Expand sales by store graph',exact:true})).toBeFocused();
  });
}
test('AUD-A11Y: management tabs support the standard arrow-key interaction',async({page})=>{
  await page.goto('/dashboard/franchise/stores/management-fixture');
  const first=page.getByRole('tab',{name:'Manager Login History',exact:true});
  const second=page.getByRole('tab',{name:'Staff Management',exact:true});
  await first.focus();await first.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-selected','true');
  await second.press('End');
  await expect(page.getByRole('tab',{name:'Store Settings',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(first).toBeFocused();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-selected','true');
});

test('FA management passes scoped WCAG automated browser checks',async({page})=>{
  await page.goto('/dashboard/franchise/stores/management-fixture');
  await page.getByRole('tab',{name:'Staff Management',exact:true}).click();
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const violations=await page.evaluate(async()=>{
    const axe=(window as unknown as {axe:typeof import('axe-core')}).axe;
    const result=await axe.run(document.querySelector('main')!,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));
  });
  expect(violations).toEqual([]);
});
