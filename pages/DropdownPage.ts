import { BasePage } from "./BasePage";

export class DropdownPage extends BasePage{
   
     dropdownPageHeader = this.page.locator('h3')
     dropdownList = this.page.locator('#dropdown')
     selectedDropdow = this.page.locator('//option[@selected= "selected"]')

     async navigate(){
        await this.goto('/dropdown')
     }
     async selectByLabel(label : string){
        await this.dropdownList.selectOption({label : label})    
     }

     async unSelectByValue(value : string){
        await this.dropdownList.selectOption(value)
     }

     async selectByIndex(index : number){
        await this.dropdownList.selectOption({index : index})
     }
}