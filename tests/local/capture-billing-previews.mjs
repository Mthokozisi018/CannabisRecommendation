import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const browser = await chromium.launch({ headless: true });
const folder = path.join(process.cwd(), "artifacts", "billing-previews");
for (const kind of ["fa", "manager"]) {
  for (const [label, width, height] of [["desktop", 1536, 1024], ["tablet", 768, 1024], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(folder, `billing-${kind}.html`)).href);
    const dimmer = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector(".page"), "::after");
      return { background: style.backgroundColor, pointerEvents: style.pointerEvents, position: style.position };
    });
    assert.deepEqual(dimmer, { background: "rgba(0, 0, 0, 0.06)", pointerEvents: "none", position: "absolute" });
    const colours = await page.evaluate(() => Object.fromEntries(
      ["onboardingCard", "monthlyCard", "greenPlanIcon", "bluePlanIcon", "summary", "receipt"].map(name =>
        [name, getComputedStyle(document.querySelector("." + name)).backgroundColor]),
    ));
    assert.deepEqual(colours, {
      onboardingCard: "rgb(53, 241, 170)", monthlyCard: "rgb(102, 195, 255)",
      greenPlanIcon: "rgb(255, 255, 255)", bluePlanIcon: "rgb(255, 255, 255)",
      summary: "rgb(4, 31, 24)", receipt: "rgb(255, 255, 255)",
    });
    const textColours = await page.evaluate(() => ["onboardingCard", "monthlyCard"].flatMap(name =>
      ["", " .titleLine h2", " .titleLine span", " .planTitle p", " .feature h3", " .feature li"]
        .map(selector => getComputedStyle(document.querySelector("." + name + selector)).color),
    ));
    assert.ok(textColours.every(colour => colour === "rgb(255, 255, 255)"));
    const priceColours = await page.evaluate(() => [
      getComputedStyle(document.querySelector(".onboardingCard .amountBlock strong")).color,
      getComputedStyle(document.querySelector(".monthlyCard .amountBlock strong")).color,
    ]);
    assert.deepEqual(priceColours, ["rgb(4, 31, 24)", "rgb(4, 27, 44)"]);
    if (kind === "fa") {
      const stripColours = await page.evaluate(() => [".additionalStrip p", ".additionalStrip>span strong"]
        .map(selector => getComputedStyle(document.querySelector(selector)).color));
      assert.deepEqual(stripColours, ["rgb(255, 255, 255)", "rgb(4, 31, 24)"]);
    }
    const checkmarks = await page.evaluate(() => ["onboardingCard", "monthlyCard"].map(name => {
      const marks = [...document.querySelectorAll("." + name + " .feature li svg")];
      return marks.map(mark => ({ fill: getComputedStyle(mark).backgroundColor, tick: getComputedStyle(mark).color }));
    }));
    assert.ok(checkmarks[0].length > 0 && checkmarks[1].length > 0);
    assert.ok(checkmarks[0].every(mark => mark.fill === "rgb(255, 255, 255)" && mark.tick === "rgb(4, 31, 24)"));
    assert.ok(checkmarks[1].every(mark => mark.fill === "rgb(255, 255, 255)" && mark.tick === "rgb(4, 27, 44)"));
    const accents = await page.evaluate(() => [
      ".onboardingCard .amountBlock small", ".monthlyCard .amountBlock small",
      ".onboardingCard .feature>svg", ".monthlyCard .feature>svg",
    ].map(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return { background: style.backgroundColor, color: style.color };
    }));
    assert.deepEqual(accents.slice(0, 2).map(accent => accent.background), ["rgb(4, 31, 24)", "rgb(4, 27, 44)"]);
    assert.deepEqual(accents.slice(0, 2).map(accent => accent.color), ["rgb(255, 255, 255)", "rgb(255, 255, 255)"]);
    assert.deepEqual(accents.slice(2).map(accent => accent.color), ["rgb(255, 255, 255)", "rgb(255, 255, 255)"]);
    await page.screenshot({ path: path.join(folder, `billing-${kind}-${label}.png`), fullPage: true });
    console.log(`${kind} ${label}: body ${await page.locator("body").evaluate(element => element.scrollWidth)}px, viewport ${width}px`);
    await page.close();
  }
}
await browser.close();
