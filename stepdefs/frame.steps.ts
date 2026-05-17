import { Given, When, Then } from "@cucumber/cucumber";
import { fixture } from "../fixtures/fixtures";

Given('I open the Frames page', async function (this: fixture) {
    await this.frameService.goto()
});

When('I can see the Frames page', async function (this: fixture) {
    await this.frameService.IsFramePageOpen()
});

Then('I can see the text {string} in the frame', async function (this: fixture, expectedText: string) {
    const text = await this.frameService.GetFrameBodyText() ?? ""
    if(!text.includes(expectedText)){
        throw new Error('Text should be ' + expectedText)
    }
});