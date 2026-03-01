# Sharkbait Security Model

**Version:** 2.0
**Date:** March 2026
**Previous:** No formal security documentation existed

---

## 1. Security Architecture Overview

Sharkbait's security model is built on **defense in depth** with four layers:

```
┌──────────────────────────────────────────────────┐
│ Layer 4: Lifecycle Hooks (PreToolUse/PostToolUse) │
│   - Shell safety (allowlist enforcement)         │
│   - Sensitive file guard (blocks writes)         │
│   - SSRF protection (blocks private IPs)         │
├──────────────────────────────────────────────────┤
│ Layer 3: ToolRegistry.execute() (hook gateway)   │
│   - ALL tool calls pass through hooks            │
│   - Centralized logging with sanitization        │
├──────────────────────────────────────────────────┤
│ Layer 2: Individual Tool Validation              │
│   - Shell: classifyCommand() allowlist           │
│   - File ops: validatePath() sandbox             │
│   - Fetch: validateUrl() SSRF check              │
├──────────────────────────────────────────────────┤
│ Layer 1: Configuration Security                  │
│   - JSON.parse (no code execution)               │
│   - Deep merge (partial configs safe)            │
│   - Project configs can't override features      │
└──────────────────────────────────────────────────┘
```

---

## 2. Command Execution Security

### Approach: Allowlist (not Denylist)

**Previous approach (v1):** Regex denylist blocking known-dangerous patterns.
**Problem:** Denylists are always incomplete — shell encoding, aliases, eval, and base64 can bypass any regex.

**New approach (v2):** Command allowlist. Only commands matching known-safe prefixes execute without confirmation. Everything else requires user confirmation or is blocked.

### Shell Chaining Protection

Commands containing shell metacharacters (`;`, `&&`, `||`, `|`, `$()`, backticks) are **always flagged for confirmation**, even if the first command is on the allowlist. This prevents the classic bypass of `echo hello; rm -rf /` where only the first token would be checked.

### Privilege Escalation Prevention

Commands prefixed with `sudo`, `doas`, `pkexec`, or `exec` **always require confirmation**, regardless of the inner command. This prevents `sudo cat /etc/shadow` from being auto-allowed because `cat` is on the allowlist.

### Classification

| Level | Behavior | Example |
|-------|----------|---------|
| **Allowed** | Executes immediately | `git status`, `bun test`, `ls -la` |
| **Requires Confirmation** | Blocked with explanation | `rm -rf ./dist`, `npm publish` |
| **Absolutely Blocked** | Cannot execute even with confirmation | Fork bombs, reverse shells, pipe-to-shell |

### Allowed Command Prefixes

`git`, `gh`, `bun`, `npm`, `npx`, `yarn`, `pnpm`, `tsc`, `eslint`, `prettier`, `vitest`, `jest`,
`ls`, `cat`, `head`, `tail`, `wc`, `file`, `stat`, `du`, `df`, `tree`,
`grep`, `rg`, `find`, `fd`, `ag`, `which`, `sort`, `uniq`, `diff`, `cut`, `tr`, `awk`, `sed`, `jq`,
`echo`, `printf`, `date`, `whoami`, `hostname`, `uname`, `env`, `pwd`,
`mkdir`, `touch`, `cp`, `mv`, `ps`

### `open_file` Application Allowlist

Only these applications can be specified: `code`, `cursor`, `chrome`, `firefox`, `safari`, `brave`, `edge`, `vim`, `nano`, `less`, `more`, `preview`

---

## 3. Filesystem Sandboxing

### Write Operations

All `write_file`, `edit_file`, and `create_directory` operations are **sandboxed to the project directory**. Writes outside `process.cwd()` are blocked.

### Forbidden Paths (always blocked)

`~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.npmrc`, `~/.netrc`, `~/.docker/config.json`

### Sensitive File Patterns (writes blocked, reads warned)

`.env`, `.env.local`, `.ssh/*`, `id_rsa`, `id_ed25519`, `*.pem`, `*.key`, `passwords.*`, `secrets.*`

---

## 4. SSRF Protection

All fetch operations (`fetch_webpage`, `fetch_json`) validate URLs at **two layers** (defense in depth):

1. **Inline validation:** Each tool calls `validateUrl()` directly before making the request
2. **Hook validation:** The `ssrf-protection` PreToolUse hook provides a second check

### Blocked

- **Private IPs:** `127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*` (AWS IMDS)
- **Hostnames:** `localhost`, `metadata.google.internal`, `metadata.google.com`
- **Protocols:** `file://`, anything except `http:` and `https:`
- **Redirects:** Redirect targets are re-validated to prevent SSRF via redirect

---

## 5. Configuration Security

### Safe Parsing

Config files are loaded with `JSON.parse(readFileSync())` — **never `require()`**. This prevents code execution from malicious config files.

### Deep Merge

Partial configs are deep-merged. A project config with only `{ "azure": { "endpoint": "..." } }` won't overwrite the entire `azure` object.

### Project Config Restrictions

Project-level `.sharkbait.json` files **cannot override the `features` section**. This prevents a malicious project config from disabling `confirmDestructive`.

---

## 6. Logging Safety

The `sanitizeForLogging()` function redacts:
- API keys (`api_key`, `password`, `secret`, `token`)
- Bearer tokens
- OpenAI keys (`sk-*`)
- GitHub tokens (`ghp_*`, `gho_*`)
- Slack tokens (`xox*`)
- AWS access keys (`AKIA*`)

All tool arguments are sanitized before debug logging.

---

## 7. Hook Integration

Security hooks are registered at startup via `registerBuiltinHooks()` and execute in `ToolRegistry.execute()`:

| Hook | Priority | Behavior |
|------|----------|----------|
| `shell-safety` | 10 | Blocks non-allowlisted commands |
| `ssrf-protection` | 15 | Blocks private IP fetches |
| `sensitive-file-guard` | 20 | Blocks writes to sensitive files |
| `result-cache` | 100 | Caches read-only results (PostToolUse) |

### Fail-Closed Design

If any PreToolUse security hook throws an error (due to malformed input, runtime bug, etc.), the tool execution is **blocked** rather than allowed to proceed. This prevents a crashing hook from becoming a security bypass.
