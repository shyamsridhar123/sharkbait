# Sharkbait Slash Commands Reference

During an interactive chat session, you can use slash commands to control sharkbait directly without going through the AI.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/cd <path>` | Change working directory |
| `/pwd` | Show current working directory |
| `/clear` | Clear message history |
| `/exit` | Exit Sharkbait (aliases: `/quit`, `/q`) |
| `/help [command]` | Show available commands (aliases: `/h`, `/?`) |
| `/version` | Show Sharkbait version (alias: `/v`) |
| `/beads [on\|off]` | Toggle Beads task tracking |
| `/context [add\|remove\|list] [files...]` | Manage context files (alias: `/ctx`) |
| `/init` | Initialize Sharkbait in current directory |
| `/run <task>` | Execute a task autonomously (alias: `/exec`) |

---

## Detailed Command Reference

### Navigation Commands

#### `/cd <path>` - Change Directory

Change the working directory for the current session. All file operations and shell commands will run from this directory.

**Usage:**
```
/cd C:\Users\yourname\projects\myapp
/cd ../other-project
/cd .
```

**Features:**
- Supports both absolute and relative paths
- If the directory doesn't exist, sharkbait will ask for permission to create it
- Changes persist for the entire session

**Examples:**
```
> /cd C:\Users\shyam\code\sandbox
Directory not found: C:\Users\shyam\code\sandbox

Create it? Type 'y' or 'yes' to create, anything else to cancel.

> y
✓ Created directory and changed to: C:\Users\shyam\code\sandbox
```

---

#### `/pwd` - Print Working Directory

Display the current working directory.

**Usage:**
```
/pwd
```

---

### Session Commands

#### `/clear` - Clear History

Clear all messages from the current session and return to the welcome screen.

**Usage:**
```
/clear
```

---

#### `/exit` - Exit Sharkbait

Exit the application cleanly.

**Aliases:** `/quit`, `/q`

**Usage:**
```
/exit
```

---

### Configuration Commands

#### `/beads [on|off]` - Toggle Beads

Enable or disable Beads task tracking. Without arguments, shows the current status.

**Usage:**
```
/beads         # Show current status
/beads on      # Enable beads
/beads off     # Disable beads
```

---

#### `/context` - Manage Context Files

Add, remove, or list files in the current context. Context files are included in every AI request.

**Aliases:** `/ctx`

**Usage:**
```
/context                      # List current context files
/context add file1.ts file2.ts   # Add files to context
/context remove file1.ts      # Remove files from context
/context list                 # List context files
/context clear                # Remove all context files
```

---

### Action Commands

#### `/init` - Initialize Project

Initialize Sharkbait configuration in the current directory. Creates `.sharkbait.json` and `.env.example`.

**Usage:**
```
/init
```

---

#### `/run <task>` - Execute Task

Execute a task autonomously. The AI will break down the task and execute it with minimal interaction.

**Aliases:** `/exec`

**Usage:**
```
/run create a new React component for user profile
/run refactor the authentication module
/run add unit tests for the utils folder
```

---

### Information Commands

#### `/help [command]` - Show Help

Display a list of all available slash commands, or detailed help for a specific command.

**Aliases:** `/h`, `/?`

**Usage:**
```
/help            # Show all commands
/help cd         # Show help for /cd command
/help context    # Show help for /context command
```

---

#### `/version` - Show Version

Display the current Sharkbait version.

**Aliases:** `/v`

**Usage:**
```
/version
```

---

## Tips

1. **Slash commands must start with `/`** - Type `/cd path` not `cd path`
   - Exception: `cd` and `pwd` work without the slash for convenience

2. **Commands are case-insensitive** - `/CD`, `/Cd`, and `/cd` all work the same

3. **Paths with spaces** - Use quotes or escape spaces:
   ```
   /cd "C:\Program Files\MyApp"
   ```

4. **Relative paths** - You can use `..` and `.`:
   ```
   /cd ..          # Go up one directory
   /cd ./src       # Go into src subdirectory
   /cd ../other    # Go to sibling directory
   ```

5. **Use aliases** - Many commands have shorter aliases for convenience:
   - `/q` instead of `/exit`
   - `/v` instead of `/version`
   - `/ctx` instead of `/context`

---

## Keyboard Shortcuts

In addition to slash commands, these keyboard shortcuts are available:

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `ESC` | Exit sharkbait |
| `Backspace` | Delete character |

---

## See Also

- [Main README](../README.md) - Getting started guide
- [Architecture](./AGENT_ARCHITECTURE.md) - How sharkbait works internally
