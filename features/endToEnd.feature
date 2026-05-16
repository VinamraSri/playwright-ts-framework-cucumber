Feature: End to End Tests

@smoke @regression
Scenario: Login and Logout
   Given I open the login page
   When I can see the login page
   Then I enter the user name "tomsmith" and password "SuperSecretPassword!"
   Then I should see the dashboard page
   Then I click on logout button

@regression
Scenario: Dropdown Selection
   Given I open the dropdown page
   When I can see the dropdown page
   Then I select "Option 1" from the dropdown
   Then I should see "Option 1" is selected in the dropdown

@regression
Scenario: Add/Remove Button
   Given I open the AddRemove button page
   When I can see the AddRemove button page
   Then I click on Add button 3 times
   Then I can see the delete button count 3
   Then I remove the 3 delete button
   Then I can see the delete button count 0

@smoke @regression
Scenario: Checkboxes
   Given I open the Checkbox page
   When I can see the checkbox page
   Then I check the checkbox 1
   Then I uncheck the checkbox 2
   Then I can see the checkbox 1 is checked
   Then I can see the checkbox 2 is unchecked

@regression
Scenario: Dynamic Loading
   Given I open the Dynamic Loading page
   When I can see the Dynamic Loading page
   Then I click on the start button
   Then I can see the loading bar
   Then I can see the "Hello World!" text after loading is complete

@regression @table
Scenario: Handling Data Tables
   Given I open the Data Tables page
   When I can see the Data Tables page
   Then I can see the email "jdoe@hotmail.com" for user having last name "Doe"