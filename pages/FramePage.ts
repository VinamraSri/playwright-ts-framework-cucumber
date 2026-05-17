
import { BasePage } from "./BasePage"

export class FramePage extends BasePage{

    header =  this.page.locator('h3')
    frame = this.getFrame('#mce_0_ifr')
    frametext = this.frame.locator('#tinymce');
    
    async navigate(){
        await this.goto('/iframe')
    }
    
    async getFrameBodyText()
    {
        return await this.frametext.textContent()
    }
}