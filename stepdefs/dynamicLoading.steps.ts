import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";


Given('I open the Dynamic Loading page', async function (this: fixture) {
  await this.dynamicLoadingService.gotoPage();
});

When('I can see the Dynamic Loading page', async function (this: fixture) {
  await this.dynamicLoadingService.IsDynamicLoadingPageDisplay();
});

Then('I click on the start button', async function (this: fixture) {
  await this.dynamicLoadingService.ClickOnStartButton();
});

Then('I can see the loading bar', async function (this: fixture) {
  await this.dynamicLoadingService.IsloadingBarDisplayed();
});

Then('I can see the {string} text after loading is complete', async function (this: fixture, finishMsg: string) {
  await this.dynamicLoadingService.IsFinishMsgDisplayed();
  const msg : string = await this.dynamicLoadingService.getFinishMsg() ?? ""
  if(!msg.includes(finishMsg)){
    throw new Error('Message should be ' + finishMsg)
  }
});