import { expect } from "playwright/test";
import { DataTablePage } from "../pages/DataTablePage";

export class DataTableService{
    constructor( private datatable_page : DataTablePage){}

    async OpenTablePage(){
        await this.datatable_page.navigate()
    }

    async IsDataTablePageOpen(){
        await expect(this.datatable_page.header).toBeVisible()
    }

    async getIndex(colName : string){
        return await this.datatable_page.getIndex(colName)
    }

    async getColvalue(refColIndex : number, targetColIndex : number , refColValue : string)
    {
        let ColValue = await this.datatable_page.getEmail(refColValue, refColIndex, targetColIndex)
        return ColValue
    }
}