import { Before, After, setWorldConstructor } from "@cucumber/cucumber";
import { chromium, Browser, BrowserContext, Page } from "@playwright/test";
import { config } from "../playwright.config";
import { fixture } from "../fixtures/fixtures";

let browser: Browser;
let context: BrowserContext;
export let page: Page;

setWorldConstructor(fixture);

Before(async function () {
  browser = await chromium.launch({
    headless: config.use?.headless,
    slowMo: config.use?.launchOptions?.slowMo,
  });

  context = await browser.newContext({
    baseURL: config.use?.baseURL,
  });

  page = await context.newPage();
  this.page = page;

  // Initialize all pages and services using fixture
  this.initializePages();
});

After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    await page.screenshot({
      path: `screenshots/${Date.now()}.png`,
    });
  }

  await page.close();
  await context.close();
  await browser.close();
});