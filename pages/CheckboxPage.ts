import { BasePage } from "./BasePage";

export class CheckboxPage extends BasePage{

    checkboxHeader = this.page.locator('h3')
    checkboxes = this.page.locator('input[type="checkbox"]')

    async navigate(){
        await this.page.goto('/checkboxes')
    }

    async checkbox( index : number){
            await this.checkboxes.nth(index-1).check()
    }

    async unCheckbox( index : number){
            await this.checkboxes.nth(index-1).uncheck()
    }
}