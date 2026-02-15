# GitHub Copilot Custom Agent Configuration

This directory contains custom instructions and agent configurations for GitHub Copilot to work effectively with the Sharkbait project.

## Files Overview

### `.github/copilot-instructions.md`
- **Purpose**: Project-wide instructions for GitHub Copilot
- **Scope**: Applies to all Copilot interactions in this repository
- **Content**: Tech stack rules, development workflow, code standards, security guidelines

### `.github/agents/default.md`
- **Purpose**: Default developer agent configuration
- **Target**: General development tasks
- **Capabilities**: Full access to all tools
- **Use When**: Writing features, fixing bugs, refactoring code

### `.github/agents/testing.md`
- **Purpose**: Specialized testing agent
- **Target**: Writing and maintaining tests
- **Capabilities**: Limited to testing-related files and tools
- **Use When**: Creating tests, fixing test failures, improving coverage

## How It Works

GitHub Copilot reads these files to understand:
1. **Project conventions**: Tech stack, coding style, naming patterns
2. **Development workflow**: Task tracking, commit messages, testing requirements
3. **Security boundaries**: What operations are allowed/prohibited
4. **Quality standards**: When code is considered "done"

## Agent Configuration Format

Each agent file uses YAML frontmatter + Markdown content:

```yaml
---
name: agent_name
description: What this agent does
target: github-copilot
tools: ["*"]  # or ["tool1", "tool2"]
infer: true   # false requires manual selection
metadata:
  maintainer: your_name
---

# Agent Instructions

Detailed instructions in Markdown...
```

## Using Custom Agents

### In VS Code with Copilot

1. Copilot automatically reads `.github/copilot-instructions.md`
2. Specialized agents can be invoked when needed
3. Agents provide context-aware suggestions

### In GitHub Copilot Chat

```
@sharkbait_developer write a new file operation tool
@test_engineer add tests for the new tool
```

### Best Practices

1. **Always read project instructions first**: Check AGENTS.md
2. **Follow the tech stack**: Don't substitute approved technologies
3. **Use the backlog workflow**: Track all work with task IDs
4. **Test before committing**: Run tests, typecheck, lint
5. **Make minimal changes**: Only modify what's necessary

## Customization

### Adding a New Agent

1. Create a new file in `.github/agents/`:
```bash
.github/agents/
├── default.md        # General development
├── testing.md        # Testing specialist
├── documentation.md  # Documentation writer (example)
└── security.md       # Security reviewer (example)
```

2. Define the agent with YAML frontmatter:
```yaml
---
name: documentation_writer
description: Writes and maintains project documentation
target: github-copilot
tools: ["read_file", "write_file", "grep_search"]
infer: false
---
```

3. Add detailed instructions in Markdown

### Updating Instructions

When project conventions change:
1. Update `.github/copilot-instructions.md` for global changes
2. Update specific agent files for specialized changes
3. Test that Copilot follows the new instructions
4. Commit with descriptive message

## Tools Configuration

Agents can specify which tools they have access to:

- `tools: ["*"]` - All tools available (default agent)
- `tools: ["read_file", "write_file"]` - Specific tools only (testing agent)
- Restricting tools helps keep agents focused on their purpose

## Inference Mode

- `infer: true` - Agent is automatically selected based on context
- `infer: false` - Agent must be explicitly invoked by user

## Security Considerations

Custom agents have the same security boundaries as defined in the codebase:

- Cannot access files outside project directory
- Cannot execute dangerous commands (rm -rf, etc.)
- Cannot expose secrets or API keys
- Cannot skip security validations

These boundaries are enforced at the tool execution level, not just by instructions.

## Testing Agent Configuration

After making changes:

1. **Ask Copilot about project rules**:
   ```
   What tech stack should I use for Sharkbait?
   ```

2. **Request a code change**:
   ```
   Add input validation to the login endpoint
   ```

3. **Verify it follows conventions**:
   - Uses correct tech stack
   - Follows coding style
   - Creates tests
   - Includes task ID in commits

## Troubleshooting

### Copilot not following instructions

1. Check file location: Must be in `.github/` directory
2. Check YAML frontmatter: Must be valid YAML
3. Restart VS Code: May need to reload
4. Check Copilot version: Ensure you have latest version

### Instructions too long

- Split into multiple agent files
- Focus each agent on specific domain
- Use concise, clear language
- Prioritize critical rules at the top

### Conflicting instructions

- Root-level instructions take precedence
- More specific agents override general rules
- Document exceptions clearly

## Maintenance

Review and update these files:
- When tech stack changes
- When development workflow evolves
- When new patterns emerge
- When security requirements change

## References

- [GitHub Copilot Custom Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Custom Agents Configuration](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)
- [Sharkbait AGENTS.md](../../AGENTS.md) - Project-wide rules
- [Sharkbait TRD](../../docs/TRD.md) - Technical specifications

---

**Last Updated**: February 2026
**Maintainer**: Shyam Sridhar
