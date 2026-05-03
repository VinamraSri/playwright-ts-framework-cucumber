import { expect } from "@playwright/test"; 
import { LoginPage } from "../pages/LoginPage";

export class LoginService{
    constructor(private login_page : LoginPage){}

    async openLoginPage(){
        
        await this.login_page.navigate()
    }
    
    async isLoginPageDisplayed(){
        
        await expect(this.login_page.loginPageHeader).toBeVisible({timeout : 10000})
    }

    async login(user : string , pass : string){
        
        await this.login_page.login(user,pass)
    }

    async isDashboardDisplayed(){
        
        await expect(this.login_page.dashboardHeader).toBeVisible()
    }

    async clickOnLogout(){
        
        await this.login_page.logout()
    }
}