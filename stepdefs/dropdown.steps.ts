import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the dropdown page', async function (this : fixture) {
  await this.dropdownService.openDropdownPage();
});

When('I can see the dropdown page', async function (this : fixture) {
  await this.dropdownService.isDropdownPageDisplayed();
});

Then('I select {string} from the dropdown', async function (this : fixture, option: string) {
  await this.dropdownService.selectByLabel(option);
});

Then('I should see {string} is selected in the dropdown', async function (this : fixture, option: string) {
  await this.dropdownService.isSelectedDropdown(option);
});