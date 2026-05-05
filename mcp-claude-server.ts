
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";

const server = new Server({
  name: "playwright-cucumber-mcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_smoke_tests",
      description: "Run all @smoke tagged tests",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "run_regression_tests",
      description: "Run all @regression tagged tests",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "run_tests_by_tag",
      description: "Run tests by a specific tag",
      inputSchema: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "The tag to filter tests (e.g., @add, @login, @dropdown)",
          },
        },
        required: ["tag"],
      },
    },
    {
      name: "run_all_tests",
      description: "Run all cucumber tests",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    let command: string;
    let result: string;

    switch (name) {
      case "run_smoke_tests":
        command = 'npx cucumber-js --tags "@smoke"';
        result = executeTests(command);
        break;

      case "run_regression_tests":
        command = 'npx cucumber-js --tags "@regression"';
        result = executeTests(command);
        break;

      case "run_tests_by_tag":
        if (!args || !args.tag) {
          throw new Error("Tag parameter is required");
        }
        command = `npx cucumber-js --tags "${args.tag}"`;
        result = executeTests(command);
        break;

      case "run_all_tests":
        command = "npx cucumber-js";
        result = executeTests(command);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

function executeTests(command: string): string {
  try {
    console.error(`Executing: ${command}`);
    const output = execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return `✅ Tests executed successfully:\n\n${output}`;
  } catch (error) {
    const stderr = (error as any).stderr?.toString() || "";
    const stdout = (error as any).stdout?.toString() || "";
    return `❌ Test execution failed:\n\n${stdout}\n${stderr}`;
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Server] Playwright Cucumber MCP server started");
}

main().catch(console.error);
