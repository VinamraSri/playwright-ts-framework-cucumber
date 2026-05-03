import { Page } from "@playwright/test";

export class BasePage {
  constructor(protected page: Page) {}

  async goto(endPoint: string) {
    await this.page.goto(endPoint); // uses baseURL from config
  }
}