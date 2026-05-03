import { expect } from "playwright/test";
import { DynamicLoadingPage } from "../pages/DynamicLoadingPage";

export class DynamicLoadingService{
    constructor( private dynamicaLoadingPage : DynamicLoadingPage){}

    async gotoPage(){
        await this.dynamicaLoadingPage.navigate()
    }

    async IsDynamicLoadingPageDisplay(){
        await expect(this.dynamicaLoadingPage.dynamicLoadingheader).toBeVisible({timeout : 1000})
    }

    async ClickOnStartButton(){
        await this.dynamicaLoadingPage.clickOnStartButton()
    }

    async IsloadingBarDisplayed(){
        await expect(this.dynamicaLoadingPage.loadingBar).toBeVisible({timeout : 1000})
    }

    async IsFinishMsgDisplayed()
    {
        await expect(this.dynamicaLoadingPage.finishMsg).toHaveText('Hello World!')
    }

    async getFinishMsg(){
        return await this.dynamicaLoadingPage.getMasg()
    }
}