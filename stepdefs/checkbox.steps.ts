import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the Checkbox page', async function (this: fixture) {
  await this.checkboxService.openCheckboxPage();
});

When('I can see the checkbox page', async function (this: fixture) {
  await this.checkboxService.IsCheckboxPageDisplayed();
});

Then('I check the checkbox {int}', async function (this: fixture, index: number) {
  await this.checkboxService.checkTheCheckbox(index);
});

Then('I uncheck the checkbox {int}', async function (this: fixture, index: number) {
  await this.checkboxService.unCheckTheCheckbox(index);
});

Then('I can see the checkbox {int} is checked', async function (this: fixture, index: number) {
  if (!(await this.checkboxService.isCheckBoxChecked(index))) {
    throw new Error(`Checkbox at index ${index} is not checked`);
  }
});

Then('I can see the checkbox {int} is unchecked', async function (this: fixture, index: number) {
  if (!(await this.checkboxService.isCheckBoxUnChecked(index))) {
    throw new Error(`Checkbox at index ${index} is not unchecked`);
  }
});