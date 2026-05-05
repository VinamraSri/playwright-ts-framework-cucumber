
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
    let suite: WorkflowSuite;
    let tag = "";

    switch (name) {
      case "run_smoke_tests":
        suite = "smoke";
        break;

      case "run_regression_tests":
        suite = "regression";
        break;

      case "run_tests_by_tag":
        if (!args || !args.tag) {
          throw new Error("Tag parameter is required");
        }
        suite = "tag";
        tag = String(args.tag);
        break;

      case "run_all_tests":
        suite = "all";
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    const result = await dispatchGitHubWorkflow(suite, tag);

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

type WorkflowSuite = "all" | "smoke" | "regression" | "tag";

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const workflow = process.env.GITHUB_WORKFLOW_FILE || "playwright.yml";
  const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_BRANCH || "main";
  const repository = process.env.GITHUB_REPOSITORY || getRepositoryFromRemote();
  const [owner, repo] = repository.split("/");

  if (!token) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN is required to trigger GitHub Actions.");
  }

  if (!owner || !repo) {
    throw new Error("Unable to determine GitHub repository. Set GITHUB_REPOSITORY=owner/repo.");
  }

  return { token, owner, repo, workflow, ref };
}

function getRepositoryFromRemote(): string {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
    return match ? `${match[1]}/${match[2]}` : "";
  } catch {
    return "";
  }
}

async function dispatchGitHubWorkflow(suite: WorkflowSuite, tag = ""): Promise<string> {
  const config = getGitHubConfig();
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`;
  const runsUrl = `https://github.com/${config.owner}/${config.repo}/actions/workflows/${config.workflow}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "playwright-cucumber-mcp",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: config.ref,
      inputs: { suite, tag },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub Actions dispatch failed (${response.status}): ${details}`);
  }

  return [
    "GitHub Actions workflow dispatched.",
    `Repository: ${config.owner}/${config.repo}`,
    `Workflow: ${config.workflow}`,
    `Ref: ${config.ref}`,
    `Suite: ${suite}${tag ? ` (${tag})` : ""}`,
    `Runs: ${runsUrl}`,
  ].join("\n");
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Server] Playwright Cucumber MCP server started");
}

main().catch(console.error);
