import { expect } from "playwright/test"
import { CheckboxPage } from "../pages/CheckboxPage"

export class CheckboxService{
    constructor (private CheckboxPage : CheckboxPage){}

    async openCheckboxPage()
    {
        await this.CheckboxPage.navigate()
    }

    async IsCheckboxPageDisplayed()
    {
        await expect(this.CheckboxPage.checkboxHeader).toBeVisible({timeout : 1000})
    }

    async checkTheCheckbox(index : number)
    {
        await this.CheckboxPage.checkbox(index)
    }

    async unCheckTheCheckbox(index : number)
    {
        await this.CheckboxPage.unCheckbox(index)
    }

    async isCheckBoxChecked(index : number)
    {
        return await this.CheckboxPage.checkboxes.nth(index-1).isChecked()
    }

    async isCheckBoxUnChecked(index : number)
    {
        return !(await this.CheckboxPage.checkboxes.nth(index-1).isChecked())
    }
}