module.exports = {
  default: {
    require: ['stepdefs/**/*.steps.ts', 'hooks/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
    timeout: 60000,
  },
};
