# Sharkbait - GitHub Copilot Instructions

## Project Overview

Sharkbait is an AI-powered coding assistant CLI tool built with:
- **Runtime**: Bun (TypeScript)
- **LLM**: Azure OpenAI GPT Codex 5.2
- **Memory**: Beads (bd CLI) for git-backed task tracking
- **GitHub**: git + gh CLI (no Octokit)
- **UI**: ink (React for terminals)
- **CLI Framework**: commander

## Tech Stack Rules

**NEVER deviate from the approved tech stack:**
- ✅ Use Bun for runtime and TypeScript for all code
- ✅ Use Azure OpenAI API (never switch to other providers without approval)
- ✅ Use git + gh CLI for GitHub operations (never Octokit)
- ✅ Use ink for terminal UI components
- ✅ Use commander for CLI argument parsing
- ❌ Do NOT add new frameworks or major dependencies without discussion

## Architecture

```
src/
├── cli.ts              # Entry point with commander
├── agent/              # Agent loop and context management
├── llm/                # Azure OpenAI client
├── tools/              # Tool registry and implementations
├── ui/                 # ink components
└── utils/              # Config, logging, errors
```

See `docs/ARCHITECTURE.md` and `docs/TRD.md` for detailed specifications.

## Development Workflow

### Before Making Changes

1. **Always read AGENTS.md** - Contains mandatory project rules
2. **Check backlog**: Run `backlog task list` to see existing work
3. **Search for related tasks**: Use `backlog task search "query"`
4. **Link to a task**: Start work with `backlog task start <id>`

### During Development

1. **Read before editing**: Always use Read tool on files before modifying
2. **Make minimal changes**: Change only what's necessary
3. **Follow existing patterns**: Match the code style in surrounding files
4. **Test your changes**: Run `bun test` for unit tests
5. **Type check**: Run `bun run typecheck` before committing

### Commit Requirements

All commits MUST include the task ID:
```bash
# ✅ Good
git commit -m "SB-001.02: Add input validation to login endpoint"

# ❌ Bad
git commit -m "Add validation"
```

### After Changes

1. **Complete the task**: `backlog task complete <id>`
2. **Update documentation** if behavior changed
3. **Run quality checks**: lint, typecheck, test

## Code Style Guidelines

### TypeScript

```typescript
// ✅ Use explicit types
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ✅ Use async/await (not .then())
async function executetool(name: string): Promise<ToolResult> {
  const result = await tool.execute();
  return result;
}

// ✅ Use descriptive names
const userAuthenticationToken = getToken(); // Good
const t = getToken(); // Bad

// ✅ Handle errors explicitly
try {
  await dangerousOperation();
} catch (error) {
  log.error(`Operation failed: ${error.message}`);
  throw new ToolError("Failed to execute", toolName);
}
```

### File Organization

- One class/interface per file (exceptions for small related types)
- Export interfaces before implementations
- Group imports: external → internal → types
- Use barrel exports (index.ts) for clean imports

### Testing

```typescript
// ✅ Write focused tests
describe("read_file tool", () => {
  test("reads entire file when no range specified", async () => {
    const result = await readFile({ path: "test.txt" });
    expect(result).toBe("content");
  });
});

// ✅ Test error cases
test("throws when file not found", async () => {
  await expect(readFile({ path: "missing.txt" }))
    .rejects.toThrow("File not found");
});
```

## Security Rules

### Never Allow

❌ **Arbitrary command execution** without validation
❌ **Exposing API keys** in logs or error messages
❌ **Modifying files outside project directory**
❌ **Force-pushing to main/master branches**
❌ **Destructive operations** without confirmation (rm -rf, DROP DATABASE)

### Always Validate

✅ **File paths**: Must be within project directory
✅ **Shell commands**: Check against blocklist in `src/utils/security.ts`
✅ **API inputs**: Validate all user-provided data
✅ **Permissions**: Check reversibility before destructive actions

## Tool Development

When adding new tools to `src/tools/`:

```typescript
export const myTool: Tool = {
  name: "tool_name",
  description: "Clear description for the LLM",
  parameters: {
    type: "object",
    properties: {
      param: {
        type: "string",
        description: "What this param does"
      },
    },
    required: ["param"],
  },
  async execute({ param }) {
    // Validate inputs
    if (!isValid(param)) {
      throw new ToolError("Invalid param", "tool_name");
    }

    // Do the work
    const result = await doWork(param);

    // Return structured result
    return { success: true, data: result };
  },
};
```

### Tool Registry

Register new tools in `src/tools/index.ts`:

```typescript
import { myTool } from "./my-tool";

export class ToolRegistry {
  constructor() {
    this.registerAll([...existingTools, myTool]);
  }
}
```

## Common Commands

| Task | Command |
|------|---------|
| Run dev mode | `bun run dev` |
| Run tests | `bun test` |
| Type check | `bun run typecheck` |
| Lint | `bun run lint` |
| Build | `bun run build` |
| Build binary | `bun run build:binary` |
| Test LLM connection | `bun run test:llm` |
| Test agent loop | `bun run test:agent` |

## Context Management

The agent has token limits. When working on changes:

- **Preserved context** (never compacted):
  - System prompt
  - Task ledger (current plan)
  - Last 10 messages
  - Currently edited files
  - Recent errors

- **Compactable context**:
  - Older conversation
  - Tool results (keep last 5 full, summarize rest)
  - Exploration findings

See `src/agent/context.ts` for implementation details.

## Error Handling Patterns

```typescript
// ✅ Use typed errors
import { ToolError, LLMError, ConfigError } from "../utils/errors";

// ✅ Wrap external calls
try {
  const result = await externalAPI.call();
} catch (error) {
  throw new LLMError("API call failed", error.statusCode);
}

// ✅ Provide recovery hints
catch (error) {
  if (error.code === "ENOENT") {
    throw new ToolError(
      `File not found: ${path}. Did you mean ${suggestedPath}?`,
      "read_file"
    );
  }
}
```

## Testing Strategy

1. **Unit tests**: Test individual functions and tools
   - Location: `tests/unit/`
   - Run: `bun test tests/unit/`

2. **Integration tests**: Test component interactions
   - Location: `tests/integration/`
   - Run: `bun test tests/integration/`

3. **E2E tests**: Test full agent workflows
   - Location: `tests/e2e/`
   - Run: `bun run test:e2e`

## When Stuck

1. Read `docs/ARCHITECTURE.md` for system design
2. Read `docs/TRD.md` for technical specifications
3. Check `AGENTS.md` for project rules
4. Search existing code for similar patterns
5. Ask for clarification rather than guessing

## Prohibited Actions

🚫 **NEVER**:
- Change the tech stack without explicit approval
- Remove or disable security checks
- Commit secrets or API keys
- Force-push to protected branches
- Delete or modify `.github/` configuration
- Skip task tracking workflow
- Make breaking changes without updating tests
- Add new major dependencies without discussion

## Documentation

When adding features:
- Update relevant docs in `docs/`
- Add JSDoc comments to public APIs
- Update README.md if user-facing changes
- Add examples to help future developers

## Build & Distribution

- **Development**: `bun run dev` uses source files directly
- **Testing**: `bun test` runs all test suites
- **Production build**: `bun run build` creates dist/
- **Binary build**: `bun run build:binary` creates standalone executable
- **Multi-platform**: `bun run build:all` creates binaries for all platforms

## Performance Considerations

- Keep context window under 85% to avoid compaction
- Use streaming for LLM responses (don't buffer)
- Batch file operations when possible
- Cache tool definitions (don't rebuild each call)
- Use Bun's native APIs (faster than Node.js equivalents)

## Helpful Resources

- [Bun Documentation](https://bun.sh/docs)
- [Azure OpenAI API Reference](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Commander.js Guide](https://github.com/tj/commander.js)
- [Ink Components](https://github.com/vadimdemedes/ink)
- [Beads Task Tracker](https://github.com/beadl/beads)

---

**Remember**: Read AGENTS.md before starting any work. Follow the backlog workflow. Make minimal, focused changes. Test thoroughly. Keep it simple.
