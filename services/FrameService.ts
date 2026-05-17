import { expect } from "playwright/test";
import { FramePage } from "../pages/FramePage";

export class FrameService{
    constructor(private frame_page : FramePage){}

    async goto(){
        await this.frame_page.navigate()
    }

    async IsFramePageOpen(){
        await expect(this.frame_page.header).toBeVisible()
    }

    async GetFrameBodyText(){
        return await this.frame_page.getFrameBodyText()
    }
}