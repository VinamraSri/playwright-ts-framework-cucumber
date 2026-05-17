import { Locator, Page } from "@playwright/test";

export class BasePage {
  constructor(protected page: Page) {}

  async goto(endPoint: string) {
    await this.page.goto(endPoint); // uses baseURL from config
  }

  getFrame(frameName : string){
        return this.page.frameLocator(frameName)

    }

    async GetNewWindow(locator: Locator){
      const [newPage] = await Promise.all([
        this.page.waitForEvent('popup'),
        locator.click()
      ])
      return newPage
    }
}