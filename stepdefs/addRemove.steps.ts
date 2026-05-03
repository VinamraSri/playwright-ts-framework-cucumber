import { Given, Then, When } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the AddRemove button page', async function (this : fixture) {
  await this.addRemoveService.openAddRemovePage();
});

When('I can see the AddRemove button page', async function (this : fixture) {
  await this.addRemoveService.IsAddRemovePageDisplayed();
});

Then('I click on Add button {int} times', async function (this : fixture, count: number) {
  await this.addRemoveService.AddDeleteButton(count);
});

Then('I can see the delete button count {int}', async function (this : fixture, count: number) {
  await this.addRemoveService.CheckDeleteButtonCount(count);
});

Then('I remove the {int} delete button', async function (this : fixture, count: number) {
  await this.addRemoveService.RemoveDeleteButton(count);
});
