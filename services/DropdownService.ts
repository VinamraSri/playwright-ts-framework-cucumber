import { expect } from "playwright/test";
import { DropdownPage } from "../pages/DropdownPage";

export class DropdownService {
    constructor( private dropdown_page : DropdownPage){}

    async openDropdownPage(){
        
        await this.dropdown_page.navigate()
    }

    async isDropdownPageDisplayed(){
        await expect(this.dropdown_page.dropdownPageHeader).toBeVisible()
    }
    
    async selectByLabel(label : string){
        await this.dropdown_page.selectByLabel(label)
    }

    async selectByValue(value : string){
        await this.dropdown_page.unSelectByValue(value)
    }

    async selectByIndex(index : number){
        await this.dropdown_page.selectByIndex(index)
    }

    async isSelectedDropdown(value : string){
        await expect(this.dropdown_page.selectedDropdow).toHaveText(value)
    }
}