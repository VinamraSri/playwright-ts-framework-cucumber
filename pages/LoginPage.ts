import { BasePage } from "./BasePage";

export class LoginPage extends BasePage{
    
    loginPageHeader = this.page.locator('h2')
    dashboardHeader = this.page.locator('h4')
    userName = this.page.getByLabel('Username')
    userPass = this.page.getByLabel('Password')
    submitButton = this.page.getByRole('button' , {name : 'Login'})
    logoutButton = this.page.getByRole('link' , {name : 'Logout'})

    async navigate(){
        await this.goto('/login')
    }

    async login(user : string , pass : string)
    {
        await this.userName.fill(user)
        await this.userPass.fill(pass)
        await this.submitButton.click()
    }

    async logout(){
       
        await this.logoutButton.click()
    }
}