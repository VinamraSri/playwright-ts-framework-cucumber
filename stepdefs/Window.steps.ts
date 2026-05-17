import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the Windows page', async function (this: fixture) {
    await this.windowService.openNewWindowPage()    
})

When('I can see the Windows page', async function (this: fixture) {
    await this.windowService.isPageOpen()
})

Then('I can see the new window with text {string} after I click on the Click Here link', async function (this: fixture, expectedText : string) {
    await this.windowService.isNewWindowOpen(expectedText);
})