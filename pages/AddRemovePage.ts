import { BasePage } from "./BasePage";

export class AddRemovePage extends BasePage{
    addRemovePageHeader = this.page.locator('h3')
    addButton = this.page.getByRole('button' , {name : 'Add Element'})
    deleteButton = this.page.getByRole('button' , {name : 'Delete'})
    
    async navigate(){
        this.goto('/add_remove_elements/')
    }

    async clickOnAddButton()
    {
        await this.addButton.click()
    }

    async clickOnDeleteButton()
    {
        await this.deleteButton.first().click()
    }
}