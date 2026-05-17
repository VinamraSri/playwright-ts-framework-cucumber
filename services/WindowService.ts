import { expect } from "playwright/test";
import { WindowPage } from "../pages/WindowPage";

export class WindowService{
    constructor(private window_page : WindowPage){}

    async openNewWindowPage(){
        await this.window_page.navigate()
    }

    async isPageOpen(){
        await expect(this.window_page.header).toBeVisible()
    }

    async isNewWindowOpen(text : string){
        await this.window_page.newWindow(text)
    }
}