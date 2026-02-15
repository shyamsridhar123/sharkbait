# GitHub Copilot Custom Agent Setup - Quick Start Guide

## What We Added

We've configured custom instructions for GitHub Copilot to understand Sharkbait's development conventions, tech stack, and workflows.

## Files Created

```
.github/
├── copilot-instructions.md      # Project-wide Copilot instructions
└── agents/
    ├── README.md                 # Documentation for this setup
    ├── default.md                # General development agent
    └── testing.md                # Testing specialist agent
```

## What This Means for You

### Automatic Context

When you use GitHub Copilot in this repository, it now knows:

- ✅ We use Bun (not Node.js)
- ✅ We use Azure OpenAI (don't suggest other providers)
- ✅ We track tasks with Beads (bd CLI)
- ✅ We use git + gh CLI (not Octokit)
- ✅ We follow specific security patterns
- ✅ We require task IDs in commits
- ✅ We have specific code style preferences

### Better Suggestions

Copilot will now:
- Suggest code that matches our patterns
- Remember to create tests
- Follow our TypeScript style
- Respect security boundaries
- Include proper error handling
- Use the right tools and libraries

## How to Use

### In VS Code

1. **Install GitHub Copilot** extension (if not already installed)
2. **Open the repository** - Copilot automatically loads `.github/copilot-instructions.md`
3. **Write code** - Copilot suggestions will follow project conventions
4. **Ask questions** - Copilot Chat understands project context

### Example Interactions

#### General Development
```
You: Add input validation to the login endpoint

Copilot: [Reads copilot-instructions.md]
I'll add validation following Sharkbait patterns:
1. Read the file first
2. Add TypeScript validation
3. Use proper error types (ToolError)
4. Create tests
5. Update docs
```

#### Testing
```
You: Write tests for the new file-ops tool

Copilot: [Uses testing.md agent]
I'll create comprehensive tests:
- Unit tests in tests/unit/tools/
- Happy path, errors, edge cases
- Proper setup/teardown
- Mock external dependencies
```

### In GitHub Copilot Chat

You can invoke specific agents:

```
@sharkbait_developer write a new GitHub integration tool
@test_engineer add integration tests for the agent loop
```

## Verifying It Works

### Test 1: Ask About Tech Stack
```
In Copilot Chat:
"What runtime should I use for Sharkbait?"

Expected: "Use Bun runtime, not Node.js"
```

### Test 2: Request Code
```
In Copilot Chat:
"Add a new tool to list git branches"

Expected:
- Uses Bun's $ syntax
- Follows Tool interface
- Includes proper types
- Suggests test location
- Mentions task tracking
```

### Test 3: Ask About Conventions
```
In Copilot Chat:
"How should I format my commit message?"

Expected: "Include task ID like 'SB-001.02: Description'"
```

## Benefits

### For Developers

- **Faster onboarding**: Copilot teaches new developers the conventions
- **Consistent code**: Suggestions match existing patterns
- **Fewer mistakes**: Copilot remembers security rules
- **Better tests**: Testing agent ensures coverage

### For Code Quality

- **Type safety**: Copilot suggests proper TypeScript
- **Error handling**: Remembers to use custom error types
- **Documentation**: Prompts for doc updates
- **Testing**: Reminds about test requirements

### For Security

- **Validation**: Suggests input validation
- **Boundaries**: Respects file path restrictions
- **Safe commands**: Won't suggest dangerous shell commands
- **Secrets**: Reminds not to commit credentials

## Customizing

### Update Global Instructions

Edit `.github/copilot-instructions.md` when:
- Tech stack changes
- New conventions are established
- Security requirements evolve
- Development workflow changes

### Add New Agents

Create `.github/agents/your-agent.md` for:
- Documentation writing
- Security reviews
- Performance optimization
- Database migrations
- Specific domain work

### Agent Template

```yaml
---
name: agent_name
description: What this agent does
target: github-copilot
tools: ["read_file", "write_file"]  # or ["*"] for all
infer: false  # true for automatic, false for manual selection
---

# Agent Instructions

Clear, focused instructions for this specific role...
```

## Troubleshooting

### Copilot Not Following Instructions

1. **Restart VS Code**: Sometimes needed to reload config
2. **Check file location**: Must be `.github/copilot-instructions.md`
3. **Verify YAML**: Check frontmatter in agent files
4. **Update Copilot**: Ensure latest version installed

### Suggestions Don't Match Style

1. **Be specific**: "Add a tool following Sharkbait patterns"
2. **Reference docs**: "Check copilot-instructions.md"
3. **Invoke agent**: "@sharkbait_developer help me..."

### Agent Not Available

1. **Check filename**: Must be in `.github/agents/`
2. **Check YAML**: Must have valid frontmatter
3. **Check infer setting**: May need explicit invocation

## Best Practices

### For Using Copilot

1. **Trust but verify**: Review all suggestions
2. **Ask questions**: Copilot knows project context
3. **Be specific**: Reference files, patterns, requirements
4. **Iterate**: Refine suggestions if first attempt isn't perfect

### For Maintaining Config

1. **Keep updated**: Review files when conventions change
2. **Be concise**: Clear, focused instructions work best
3. **Include examples**: Code samples are very helpful
4. **Test changes**: Verify Copilot follows new instructions

## Resources

- **Main docs**: `.github/agents/README.md`
- **Project rules**: `AGENTS.md` (root of repo)
- **Architecture**: `docs/ARCHITECTURE.md`
- **Tech specs**: `docs/TRD.md`

## Need Help?

1. Read `.github/agents/README.md` for detailed documentation
2. Check examples in agent files
3. Ask in team chat
4. Consult GitHub Copilot docs: https://docs.github.com/copilot

---

**Setup Date**: February 2026
**Configured By**: Shyam Sridhar
**Status**: ✅ Active and Ready to Use
