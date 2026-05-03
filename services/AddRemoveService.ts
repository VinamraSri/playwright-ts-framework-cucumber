import { expect } from "playwright/test";
import { AddRemovePage } from "../pages/AddRemovePage";

export class AddRemoveService {
    
    constructor(private addremovepage : AddRemovePage){}

    async openAddRemovePage(){
        
        await this.addremovepage.navigate()
    }
    
    async IsAddRemovePageDisplayed(){
        await expect(this.addremovepage.addRemovePageHeader).toBeVisible()
    }

    async AddDeleteButton(count : number){
        
        for(let i = 0 ; i < count ; i++)
        {
            await this.addremovepage.clickOnAddButton()
        }
    }
    
    async CheckDeleteButtonCount(count : number){
        
        await expect(this.addremovepage.deleteButton).toHaveCount(count)
    }

    async RemoveDeleteButton(count : number){
        
        for(let i = 0 ; i < count ; i++)
        {
            await this.addremovepage.clickOnDeleteButton()
        }
    }
}