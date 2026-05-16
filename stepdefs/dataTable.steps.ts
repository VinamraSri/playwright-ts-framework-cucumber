import { Given, When, Then } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the Data Tables page', async function (this : fixture) {
    await this.dataTableService.OpenTablePage()
});

When('I can see the Data Tables page', async function (this : fixture) {
    await this.dataTableService.IsDataTablePageOpen()
});

Then('I can see the email {string} for user having last name {string}', async function (this : fixture, email : string, lname : string) {
    const LnameIndex = await this.dataTableService.getIndex('Last Name')
    const EmailIndex = await this.dataTableService.getIndex('Email')
    if (LnameIndex === null || EmailIndex === null) {
        throw new Error('Column index not found');
    }
    const actEmail = await this.dataTableService.getColvalue(LnameIndex, EmailIndex, lname)
    if (actEmail?.trim() !== email) {
        throw new Error('Expected email' + email + ' does not match actual email' + actEmail);
    }
});