# Sharkbait Slash Commands Reference

During an interactive chat session, you can use slash commands to control sharkbait directly without going through the AI.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/cd <path>` | Change working directory |
| `/pwd` | Show current working directory |
| `/clear` | Clear message history |
| `/help` | Show available commands |

---

## Detailed Command Reference

### `/cd <path>` - Change Directory

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

### `/pwd` - Print Working Directory

Display the current working directory.

**Usage:**
```
/pwd
```

**Output:**
```
Current directory: C:\Users\shyam\code\sharkbait
```

---

### `/clear` - Clear History

Clear all messages from the current session and return to the welcome screen.

**Usage:**
```
/clear
```

This is useful when you want to start fresh without restarting sharkbait.

---

### `/help` - Show Help

Display a list of all available slash commands.

**Usage:**
```
/help
```

**Output:**
```
Available commands:
  /cd <path>  - Change working directory
  /pwd        - Show current working directory
  /clear      - Clear message history
  /help       - Show this help message
```

---

## Tips

1. **Slash commands must start with `/`** - Type `/cd path` not `cd path` or `change directory /cd path`

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

---

## Keyboard Shortcuts

In addition to slash commands, these keyboard shortcuts are available:

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `ESC` | Exit sharkbait |
| `Backspace` | Delete character |

---

## Coming Soon

Future slash commands under consideration:

- `/model <name>` - Switch AI model
- `/context <file>` - Add file to context
- `/beads` - List active beads
- `/undo` - Undo last AI action
- `/history` - Show command history
- `/config` - View/edit configuration

---

## See Also

- [Main README](../README.md) - Getting started guide
- [Architecture](./AGENT_ARCHITECTURE.md) - How sharkbait works internally
