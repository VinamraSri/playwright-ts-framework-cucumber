import { BasePage } from "./BasePage";

export class DynamicLoadingPage extends BasePage {
    
    dynamicLoadingheader = this.page.locator('h3')
    startButton = this.page.getByRole('button', { name: 'Start' })
    loadingBar = this.page.getByText('Loading... ')
    finishMsg = this.page.locator('#finish')

    async navigate(){
        await this.goto('/dynamic_loading/1')
    }

    async clickOnStartButton(){
        await this.startButton.click()
    }

    async getMasg(){
        return await this.finishMsg.textContent()
    }
}