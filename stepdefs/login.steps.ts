import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the login page', async function (this : fixture) {
  await this.loginService.openLoginPage();
});

When('I can see the login page', async function (this : fixture) {
  await this.loginService.isLoginPageDisplayed();
});

Then(
  'I enter the user name {string} and password {string}',
  async function (this : fixture, user: string, pass: string) {
    await this.loginService.login(user, pass);
  }
);

Then('I should see the dashboard page', async function (this : fixture) {
  await this.loginService.isDashboardDisplayed();
});

Then('I click on logout button', async function (this : fixture) {
  await this.loginService.clickOnLogout();
});