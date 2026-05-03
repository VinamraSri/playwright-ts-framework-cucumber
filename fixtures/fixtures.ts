import { World, IWorldOptions } from "@cucumber/cucumber";
import { Page } from "@playwright/test";
import { CheckboxPage } from "../pages/CheckboxPage";
import { CheckboxService } from "../services/CheckboxService";
import { DynamicLoadingPage } from "../pages/DynamicLoadingPage";
import { DynamicLoadingService } from "../services/DynamicLoadingService";
import { AddRemovePage } from "../pages/AddRemovePage";
import { AddRemoveService } from "../services/AddRemoveService";
import { DropdownPage } from "../pages/DropdownPage";
import { DropdownService } from "../services/DropdownService";
import { LoginPage } from "../pages/LoginPage";
import { LoginService } from "../services/LoginService";

export class fixture extends World {
  page!: Page;
  checkboxPage!: CheckboxPage;
  checkboxService!: CheckboxService;
  dynamicLoadingPage!: DynamicLoadingPage;
  dynamicLoadingService!: DynamicLoadingService;
  addRemovePage!: AddRemovePage;
  addRemoveService!: AddRemoveService;
  dropdownPage!: DropdownPage;
  dropdownService!: DropdownService;
  loginPage!: LoginPage;
  loginService!: LoginService;

  constructor(options: IWorldOptions) {
    super(options);
  }

  initializePages() {
    // Initialize all pages
    this.checkboxPage = new CheckboxPage(this.page);
    this.dynamicLoadingPage = new DynamicLoadingPage(this.page);
    this.addRemovePage = new AddRemovePage(this.page);
    this.dropdownPage = new DropdownPage(this.page);
    this.loginPage = new LoginPage(this.page);

    // Initialize all services
    this.checkboxService = new CheckboxService(this.checkboxPage);
    this.dynamicLoadingService = new DynamicLoadingService(this.dynamicLoadingPage);
    this.addRemoveService = new AddRemoveService(this.addRemovePage);
    this.dropdownService = new DropdownService(this.dropdownPage);
    this.loginService = new LoginService(this.loginPage);
  }
}
