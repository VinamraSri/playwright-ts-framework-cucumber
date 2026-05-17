import { expect } from "playwright/test";
import { BasePage } from "./BasePage";

export class WindowPage extends BasePage{

    header = this.page.locator('h3')
    clickButton = this.page.getByRole('link' , {name : 'Click Here'})
    
    async navigate(){
        await this.page.goto('/windows')
    }
    
    async newWindow(text : string){
        const newPage = await this.GetNewWindow(this.clickButton)
        const newHeader = newPage.locator('h3')
        await expect(newHeader).toHaveText(text)
    }

}