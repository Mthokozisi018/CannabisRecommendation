import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { execFileSync } from "node:child_process";

const registrationLink = `http://127.0.0.1:3107/register/${"a".repeat(64)}`;

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
  test(`POS onboarding and checkout layout fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/receptionist");
    const onboarding = page.locator('[aria-label="Customer registration"]');
    const register = await onboarding.getByRole("button", { name: "Register Customer", exact: true }).boundingBox();
    const qr = await onboarding.getByRole("button", { name: "QR Code", exact: true }).boundingBox();
    const row = await onboarding.boundingBox();
    expect(register).not.toBeNull(); expect(qr).not.toBeNull(); expect(row).not.toBeNull();
    expect(Math.abs(register!.y - qr!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(qr!.x + qr!.width - row!.x - row!.width)).toBeLessThanOrEqual(1);
    expect(register!.x).toBeGreaterThanOrEqual(0);
    expect(register!.x + register!.width).toBeLessThan(qr!.x);
    const category = await page.getByRole("button", { name: "Accessories", exact: true }).boundingBox();
    const cart = await page.locator("#current-sale aside").boundingBox();
    expect(category).not.toBeNull(); expect(cart).not.toBeNull();
    if (width >= 1280) {
      expect(Math.abs(register!.y - category!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(cart!.y - (row!.y + row!.height + 12))).toBeLessThanOrEqual(1);
      expect(cart!.width).toBeGreaterThanOrEqual(400);
      expect(cart!.width).toBeLessThanOrEqual(460);
      expect(cart!.x).toBeGreaterThan(category!.x + category!.width);
    } else {
      expect(cart!.y).toBeGreaterThan(category!.y + category!.height);
    }
    expect(cart!.x + cart!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

let poster: string;
test.beforeAll(() => {
  // Exercise the actual server composer without adding a production test route.
  poster = execFileSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--eval",
    `import('./lib/registration/poster.ts').then(async m => process.stdout.write(await m.generateRegistrationPoster('${registrationLink}')))`
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
});

async function attachImage(page: Page) {
  const bytes = await sharp({ create: { width: 100, height: 60, channels: 3, background: "#ddd" } }).jpeg().toBuffer();
  await page.getByLabel("Choose document from gallery").setInputFiles({ name: "synthetic.jpg", mimeType: "image/jpeg", buffer: bytes });
}
async function fillForm(page: Page) {
  await page.getByLabel("Full Name").fill("Test Customer");
  await page.getByLabel("Email Address (Required)").fill("test@example.invalid");
  await page.getByLabel("Cellphone Number").fill("0821234567");
  await page.getByRole("radio", { name: "Passport" }).check();
  await page.getByLabel("Passport Number").fill("A00123456");
  await attachImage(page);
  await page.locator("#acceptTerms").check(); await page.locator("#acceptPrivacy").check(); await page.locator("#acceptVerification").check();
}
for (const width of [360, 390, 430]) {
  test(`one scrollable form fits ${width}px including large text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto("/");
    await expect(page.getByRole("heading", { name: "Customer Registration" })).toBeAttached();
    await expect(page.locator("form")).toHaveCount(1);
    for (const name of ["Your Details", "Verify Your Document", "Agreements"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/qr-registration-${width}.png`, fullPage: true });
  });
}
test("camera/gallery are distinct and preview replace/remove preserve details", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Take document photo")).toHaveAttribute("capture", "environment");
  await expect(page.getByLabel("Choose document from gallery")).not.toHaveAttribute("capture");
  await page.getByLabel("Full Name").fill("Test Customer");
  await attachImage(page); await expect(page.getByAltText("Preview of your selected identity document")).toBeVisible();
  const picker = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Replace Photo" }).click();
  const chooser = await picker; const bytes = await sharp({ create: { width: 110, height: 60, channels: 3, background: "white" } }).png().toBuffer();
  await chooser.setFiles({ name: "replacement.png", mimeType: "image/png", buffer: bytes });
  await expect(page.getByAltText("Preview of your selected identity document")).toBeVisible();
  await page.getByRole("button", { name: "Remove Photo" }).click();
  await expect(page.getByAltText("Preview of your selected identity document")).toHaveCount(0);
  await expect(page.getByLabel("Full Name")).toHaveValue("Test Customer");
});
test("exact legal documents and anchors preserve form, image, consent and scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await fillForm(page);
  await page.locator("#acceptTerms").uncheck();
  for (const name of ["Customer Terms & Conditions", "Privacy Notice", "ID Verification Notice"]) {
    const link = page.getByRole("link", { name, exact: true }); await link.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => window.scrollY);
    await link.click(); await expect(page.getByRole("dialog").getByRole("heading", { name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to Registration" }).click();
    await expect(page.locator("#acceptTerms")).not.toBeChecked();
    expect(Math.abs(await page.evaluate(() => window.scrollY) - position)).toBeLessThan(5);
  }
  await page.getByRole("link", { name: "How your document image is handled" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Identity documents", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Full Name")).toHaveValue("Test Customer");
  await expect(page.getByAltText("Preview of your selected identity document")).toHaveCount(1);
});
test("validation focuses the first missing input and keeps marketing optional", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Register Customer" }).click();
  await expect(page.getByLabel("Full Name")).toBeFocused(); await expect(page.getByRole("alert")).toContainText("full name");
  await fillForm(page);
  await expect(page.getByRole("checkbox", { name: "Send me promotions" })).not.toBeChecked();
  let received = 0;
  await page.route("**/api/registration/**", async route => {
    received++;
    expect(route.request().postData()).toContain('"marketing":false');
    await route.fulfill({ status: 422, json: { field: "documentNumber", error: "The number on the document does not match the number entered." } });
  });
  await page.getByRole("button", { name: "Register Customer" }).click();
  await expect(page.getByRole("alert")).toContainText("does not match");
  await expect(page.getByLabel("Passport Number")).toBeFocused();
  await expect(page.getByLabel("Full Name")).toHaveValue("Test Customer");
  await page.getByLabel("Passport Number").fill("A00123457"); await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("radio", { name: "SA ID", exact: true }).check();
  await expect(page.getByLabel("SA ID Number")).toHaveValue("");
  expect(received).toBe(1);
});
test("in-flight duplicate taps produce one submission and success redirects", async ({ page }) => {
  await page.goto("/"); await fillForm(page);
  let requests = 0;
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/registration/**", async route => { requests++; await wait; await route.fulfill({ status: 201, json: { redirectTo: "/register/success" } }); });
  await page.getByRole("button", { name: "Register Customer" }).click();
  await expect(page.getByRole("button", { name: "Verifying ID and registering…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Checking your document…");
  expect(requests).toBe(1); release!(); await expect(page).toHaveURL(/\/register\/success$/);
});
test("manager QR modal reopens the same link and supports download and copy", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { document.documentElement.dataset.copiedRegistrationLink = value; } } });
    window.print = () => { document.documentElement.dataset.qrPrinted = "true"; };
  });
  await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ json: { storeName: "Test Store", link: registrationLink, image: poster } }));
  await page.goto("/manager"); await page.getByRole("button", { name: "QR Code" }).click();
  await expect(page.getByRole("dialog")).toContainText("Test Store");
  const link = await page.getByLabel("Registration Link").inputValue();
  await expect(page.getByRole("status").filter({ hasText: "Poster ready" })).toBeVisible();
  await expect(page.getByAltText("GreenChoice registration poster with QR code for Test Store")).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download Poster" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("GreenChoice-Test Store-Registration-QR.png");
  await file.saveAs("test-results/greenchoice-registration-poster.png");
  const downloaded = await sharp(await file.path() as string).toBuffer();
  expect(downloaded.equals(Buffer.from(poster.split(",")[1], "base64"))).toBe(true);
  await page.getByRole("button", { name: "Copy Registration Link" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-copied-registration-link", link);
  await page.getByRole("button", { name: "Print Poster" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-qr-printed", "true");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "QR Code" }).click(); await expect(page.getByLabel("Registration Link")).toHaveValue(link);
});

for (const width of [360, 768, 1440]) {
  test(`registration poster fits ${width}px and print isolates the same full poster`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ json: { storeName: "Test Store", link: registrationLink, image: poster } }));
    await page.goto("/manager"); await page.getByRole("button", { name: "QR Code" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Poster ready" })).toBeVisible();
    const image = page.getByAltText("GreenChoice registration poster with QR code for Test Store");
    const box = (await image.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(360); expect(box.height / box.width).toBeCloseTo(1.5);
    expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const dialogBox = (await page.getByRole("dialog").boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0); expect(dialogBox.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: `test-results/registration-poster-${width}.png` });
    await page.emulateMedia({ media: "print" });
    expect(await page.locator("html").evaluate(node => getComputedStyle(node).colorScheme)).toBe("light");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".gc-qr-print-poster")).toBeVisible();
    expect(await page.locator(".gc-qr-print-poster img").getAttribute("src")).toBe(poster);
    await page.pdf({ path: `test-results/registration-poster-${width}.pdf`, preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator(".gc-qr-print-poster")).toHaveCount(0);
  });
}

test("short mobile viewport keeps a scan-sized poster and scrolls within the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ json: { storeName: "Test Store", link: registrationLink, image: poster } }));
  await page.goto("/manager"); await page.getByRole("button", { name: "QR Code" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Poster ready" })).toBeVisible();
  expect((await page.locator(".gc-qr-poster").boundingBox())!.width).toBe(288);
  expect(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight > node.clientHeight)).toBe(true);
  await page.getByRole("button", { name: "Download Poster" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Download Poster" })).toBeVisible();
});

test("broken poster cannot be exported and retry recovers", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/dashboard/registration-qr", route => {
    requests++;
    return route.fulfill({ json: { storeName: "Test Store", link: registrationLink, image: requests === 1 ? "data:image/png;base64,broken" : poster } });
  });
  await page.goto("/manager"); await page.getByRole("button", { name: "QR Code" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unable to display" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download Poster" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print Poster" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("button", { name: "Download Poster" })).toBeEnabled();
});
test("QR modal displays actionable setup errors without rendering an undefined URL", async ({ page }) => {
  await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ status: 503, json: { error: "Store QR setup is incomplete. Apply the QR token migration." } }));
  await page.goto("/manager"); await page.getByRole("button", { name: "QR Code" }).click();
  await expect(page.getByRole("status")).toContainText("Apply the QR token migration");
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
});

async function mockStorePoster(page: Page) {
  await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ json: { storeName: "Test Store", link: registrationLink, image: poster } }));
}

for (const width of [360, 768, 1440]) {
  test(`receptionist onboarding controls and shared QR poster fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await mockStorePoster(page);
    await page.addInitScript(() => { window.print = () => { document.documentElement.dataset.qrPrinted = "true"; }; });
    await page.goto("/receptionist");
    await expect(page.getByRole("button", { name: "Register Customer", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "QR Code", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Store Registration QR", exact: true });
    await expect(modal.getByRole("status").filter({ hasText: "Poster ready" })).toBeVisible();
    await expect(modal.getByRole("heading", { name: "Test Store", exact: true })).toBeVisible();
    expect(await modal.locator("img").getAttribute("src")).toBe(poster);
    await expect(modal.getByLabel("Registration Link")).toHaveValue(registrationLink);
    const download = page.waitForEvent("download"); await modal.getByRole("button", { name: "Download QR Code", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("GreenChoice-Test Store-Registration-QR.png");
    await modal.getByRole("button", { name: "Print QR Code", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-qr-printed", "true");
    expect(await modal.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/receptionist-qr-${width}.png` });
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("checkout offers both onboarding methods and shares the same store QR", async ({ page }) => {
  await mockStorePoster(page); await page.goto("/checkout");
  const checkout = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Select Customer", exact: true }) });
  await expect(checkout.getByRole("button", { name: "Register Customer", exact: true })).toBeVisible();
  await checkout.getByRole("button", { name: "QR Code", exact: true }).click();
  const qr = page.getByRole("dialog", { name: "Store Registration QR", exact: true });
  await expect(qr.getByRole("status").filter({ hasText: "Poster ready" })).toBeVisible();
  await expect(qr.getByLabel("Registration Link")).toHaveValue(registrationLink);
  await qr.getByRole("button", { name: "Close", exact: true }).click();
  await expect(checkout).toContainText("Test Accessory");
});

test("assisted registration uses the verified form, keeps the cart and links the new customer to a sale", async ({ page }) => {
  await mockStorePoster(page);
  let attempts = 0;
  let release: (() => void) | undefined;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/registration/**", async route => {
    expect(route.request().url()).toBe(`http://127.0.0.1:3107/api/registration/${"a".repeat(64)}`);
    expect(route.request().postData()).toContain('"acceptVerification":true');
    expect(route.request().postData()).not.toContain('"verified":true');
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 422, json: { field: "documentNumber", error: "The document number could not be verified." } });
    else { await hold; await route.fulfill({ status: 201, json: { redirectTo: "/register/success" } }); }
  });
  await page.route("**/api/dashboard/receptionist/customers/search", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ mode: "phone", query: "0821234567" });
    await route.fulfill({ json: { ok: true, customers: [{ id: "test-customer", firstName: "Test", surname: "Customer", fullName: "Test Customer", phoneNumber: "0821234567" }] } });
  });
  await page.goto("/receptionist");
  await page.getByRole("button", { name: "Accessories", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "Register Customer", exact: true }).click();
  const registration = page.getByRole("dialog", { name: "Register Customer", exact: true });
  await expect(registration.getByRole("heading", { name: "Customer Registration" })).toBeAttached();
  await expect(page.locator("#acceptTerms")).not.toBeChecked();
  await expect(page.locator("#acceptPrivacy")).not.toBeChecked();
  await expect(page.locator("#acceptVerification")).not.toBeChecked();
  await fillForm(page);
  await registration.getByRole("button", { name: "Register Customer", exact: true }).click();
  await expect(registration.getByRole("alert")).toContainText("could not be verified");
  await expect(registration.getByLabel("Full Name")).toHaveValue("Test Customer");
  await registration.getByLabel("Passport Number").fill("A00123457");
  await registration.getByRole("button", { name: "Register Customer", exact: true }).click();
  await expect(registration.getByRole("button", { name: "Close Registration" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(registration).toBeVisible();
  release!();
  await expect(registration).not.toBeVisible(); await expect(page).toHaveURL(/\/receptionist$/);
  await expect(page.getByRole("textbox", { name: "Customer search" })).toHaveValue("0821234567");
  await page.getByRole("button", { name: "Select Test Customer", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Linked to sale");
  await expect(page.getByRole("dialog")).toContainText("Test Accessory");
  await page.getByText("Cash", { exact: true }).click();
  await page.getByRole("button", { name: "Complete sale for Test Customer", exact: true }).click();
  await expect(page.getByTestId("completed-sale")).toContainText("test-customer");
  const sale = JSON.parse((await page.getByTestId("completed-sale").textContent())!);
  expect(sale).toMatchObject({ customerId: "test-customer", items: [{ productId: "00000000-0000-4000-8000-000000000031", quantity: 1, unitPrice: 750 }] });
  expect(attempts).toBe(2);
});

test("cancelled assisted registration clears details and unavailable links offer retry", async ({ page }) => {
  await mockStorePoster(page); await page.goto("/receptionist");
  const trigger = page.getByRole("button", { name: "Register Customer", exact: true });
  await trigger.click();
  const registration = page.getByRole("dialog", { name: "Register Customer", exact: true });
  await registration.getByLabel("Full Name").fill("Discarded Customer");
  await registration.getByRole("button", { name: "Close Registration" }).click();
  await trigger.click(); await expect(registration.getByLabel("Full Name")).toHaveValue("");
  await registration.getByRole("button", { name: "Close Registration" }).click();
  await page.route("**/api/dashboard/registration-qr", route => route.fulfill({ status: 409, json: { error: "Your staff profile has no assigned store." } }));
  await trigger.click(); await expect(registration.getByRole("alert")).toContainText("no assigned store");
  await expect(registration.locator("form")).toHaveCount(0); await expect(registration.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("registering during checkout refreshes an earlier empty search for the same phone", async ({ page }) => {
  await mockStorePoster(page);
  let registered = false;
  let searches = 0;
  await page.route("**/api/dashboard/receptionist/customers/search", route => {
    searches++;
    return route.fulfill({ json: { ok: true, customers: registered ? [{ id: "new-customer", firstName: "Test", surname: "Customer", fullName: "Test Customer", phoneNumber: "0821234567" }] : [] } });
  });
  await page.route("**/api/registration/**", route => { registered = true; return route.fulfill({ status: 201, json: { redirectTo: "/register/success" } }); });
  await page.goto("/checkout"); await page.getByRole("textbox", { name: "Customer search" }).fill("0821234567");
  await expect(page.getByText("No customers found.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Register Customer", exact: true }).click();
  const registration = page.getByRole("dialog", { name: "Register Customer", exact: true });
  await expect(registration.getByLabel("Full Name")).toBeVisible();
  await fillForm(page); await registration.getByRole("button", { name: "Register Customer", exact: true }).click();
  await expect(registration).not.toBeVisible();
  await page.getByRole("button", { name: "Select Test Customer", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Linked to sale");
  expect(searches).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/checkout$/);
});
