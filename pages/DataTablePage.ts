import { BasePage } from "./BasePage";

export class DataTablePage extends BasePage{

    header = this.page.locator('h3');
    tableHeaderRow = this.page.locator('#table1 thead')
    tableRows = this.page.locator('#table1 tbody tr')

    async navigate(){
        this.page.goto('/tables')
    }
    
    async getIndex(expColName : string) {
        let index = null
        const count = await this.tableHeaderRow.locator('th').count()
        for ( let i = 0 ; i < count ; i++){
            const actColName = await this.tableHeaderRow.locator('th').nth(i).textContent()
            if(actColName?.includes(expColName)){
                index = i;
            }
        }
        return index
    }

    async getEmail(Lname : string , LnameIndex : number , EmailIndex : number){
        let email = null
        let count = await this.tableRows.count()
        for( let i = 0 ; i < count ; i++){
            let row = await this.tableRows.nth(i)
            const actLname = await row.locator('td').nth(LnameIndex).textContent()
            if(actLname?.includes(Lname)){
                email = await row.locator('td').nth(EmailIndex).textContent()
                console.log(email)
                break
            }
        }
        return email
    }
}

