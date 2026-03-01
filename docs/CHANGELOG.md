# Changelog

All notable changes to Sharkbait are documented here.

## [Unreleased] — March 2026

### Security Hardening (Phase 1)

- **BREAKING:** Shell command execution now uses an **allowlist** instead of a denylist. Commands not on the allowlist require user confirmation. See `docs/SECURITY.md` for the full list.
- **BREAKING:** File write operations are **sandboxed to the project directory**. Writes to `~/.ssh`, `~/.aws`, `.env`, etc. are blocked by default.
- **Added:** SSRF protection on `fetch_webpage` and `fetch_json`. Requests to private IPs (including AWS IMDS `169.254.169.254`), localhost, and `file://` URLs are blocked.
- **Fixed:** Configuration loading no longer uses `require()` (which executes JS). Now uses `JSON.parse(readFileSync())`.
- **Fixed:** Config deep merge — partial configs no longer overwrite entire nested objects.
- **Fixed:** Project configs cannot override `features.confirmDestructive`.
- **Fixed:** `open_file` application parameter restricted to a safe allowlist.
- **Wired:** Lifecycle hooks (`PreToolUse`, `PostToolUse`) now execute on EVERY tool call via `ToolRegistry.execute()`. Previously registered but never invoked.
- **Added:** `sanitizeForLogging()` is now called before debug logging of tool arguments.

### Architecture Integrity (Phase 2)

- **Azure Identity migration:** Authentication now uses `DefaultAzureCredential` from `@azure/identity` by default. API keys are supported as a fallback when `AZURE_OPENAI_API_KEY` is set. No configuration changes needed — the client auto-detects the auth method.
- **Extracted:** `accumulateToolCalls()` into `src/llm/stream-utils.ts` — eliminates 3-copy duplication (was in `AgentLoop`, `BaseAgent`, and unused `StreamHandler`).
- **Fixed:** `BaseAgent.run()` now yields `tool_error` events instead of silently swallowing tool failures.
- **Added:** `tool_error` variant to `AgentStreamEvent` type union.
- **Made `result` optional on `done` event** in `AgentStreamEvent` for compatibility with `AgentEvent`.
- **Added:** `.github/workflows/ci.yml` — GitHub Actions CI with type checking, tests, and secret scanning.
- **Fixed:** Tests are now version-tracked (removed `tests/` from `.gitignore`).
- **Replaced:** Switch-based `AgentFactory.create()` with registration-based `Map<AgentRole, AgentConstructor>`.
- **Replaced:** Switch-based `Agent.runWorkflow()` with `WORKFLOW_REGISTRY` map. New workflows can be added via `Agent.registerWorkflow()`.

### Performance (Phase 3)

- **Parallel tool execution:** Tool calls from the LLM are now executed with `Promise.allSettled()` instead of sequential `for...of`. N independent tool calls complete in O(1) instead of O(N).
- **Bounded messages array:** `AgentLoop` caps messages at 200, keeping the first (user request) and most recent entries.
- **Cached `getDefinitions()`:** `ToolRegistry` caches tool definitions, invalidating only when tools are registered. Eliminates per-iteration array allocation.
- **Extracted `useAgentSession` hook:** 160-line event dispatch loop extracted from `App.tsx` into `src/ui/hooks/useAgentSession.ts`. State management consolidated into `useReducer` (single state update per event instead of 3 `setState` calls).

### Code Quality (Phase 4)

- **Created `runProcess()` utility** (`src/utils/process.ts`) — eliminates 27+ instances of `Bun.spawn + new Response(proc.stdout)` boilerplate.
- **Created `getErrorMessage()` utility** (`src/utils/security.ts`) — eliminates 29 instances of `error instanceof Error ? error.message : "Unknown error"`.
- **Consolidated security** — `shell.ts` and `builtins.ts` now import from `src/utils/security.ts` instead of maintaining separate blocklists.
- **Deleted dead code:** `StreamHandler` class (replaced by `stream-utils`), `TOOL_DEFINITIONS` export (replaced by `ToolRegistry.getDefinitions()`).
- **Added SSRF protection hook** to built-in hooks (`registerSsrfProtectionHook()`).

### Documentation (Phase 5)

- **Created `docs/SECURITY.md`** — comprehensive security model documentation.
- **Created `docs/CHANGELOG.md`** — this file.

### Security Review Fixes (Post-Review)

- **Fixed:** Command chaining bypass — `classifyCommand()` now detects shell metacharacters (`;`, `&&`, `||`, `|`, `$()`, backticks) and requires confirmation for any command containing them, preventing allowlist bypass via chaining.
- **Fixed:** Privilege escalation via `sudo` — `sudo`, `doas`, `pkexec`, and `exec` prefixes are no longer silently stripped. Commands with these prefixes always require confirmation.
- **Fixed:** `BaseAgent` now correctly emits `tool_error` events (was emitting generic `error` events for tool failures, which could terminate sessions prematurely).
- **Fixed:** Fetch tools (`fetch_webpage`, `fetch_json`) now have inline SSRF validation via `validateUrl()` (defense in depth — no longer relies solely on hooks).
- **Fixed:** PreToolUse hooks now **fail-closed** — if a security hook throws an error, the tool execution is blocked rather than allowed to proceed.
- **Fixed:** Pre-existing type errors in `setup.tsx` (`icons.check` → `icons.success`), `demo.tsx` (removed invalid `showTagline` prop), `perf.ts` (array index safety), `tracer.ts` (UUID split safety), `azure-openai.ts` (SDK type alignment), `parallel-executor.ts` (optional result handling).
- **Added:** 69 unit tests for the security module covering command classification, path sandboxing, URL validation, log sanitization, command chaining bypass prevention, and privilege escalation prevention.
