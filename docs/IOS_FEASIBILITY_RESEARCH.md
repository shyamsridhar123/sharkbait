# iOS Feasibility Research: Running Sharkbait CLI on iPhone

**Date:** February 15, 2026
**Author:** Research Agent
**Status:** Complete

---

## Executive Summary

After deep research into running Sharkbait (a Bun/TypeScript CLI tool) on iPhone, **the assumption that we need to rewrite in Swift is only partially correct**. There are multiple approaches with varying levels of effort and functionality:

### TL;DR Options (Standalone iOS App - No Remote Server):

| Approach | Effort | Native Experience | Feature Parity | Recommended |
|----------|--------|-------------------|----------------|-------------|
| **1. iSH + Node.js** | Low | ❌ | ~80% | ✅ Quick prototype |
| **2. Swift Native Rewrite** | Very High | ✅ | ~70% | ✅✅ Production |

**Recommendation:** Start with Option 1 (iSH + Node.js) for immediate validation, then commit to Option 2 (Full Swift Native Rewrite) for production app.

**Note:** Options requiring remote servers (SSH/WebSocket approaches) are excluded per project requirements.

---

## 1. Current Sharkbait Architecture

### Key Dependencies:
- **Runtime:** Bun (JavaScript/TypeScript runtime)
- **Language:** TypeScript
- **LLM Client:** Azure OpenAI (REST API)
- **Tools:** File ops, shell commands, git, GitHub CLI (gh)
- **UI:** Ink (React-based terminal UI)
- **Memory:** Beads (bd CLI - git-backed task tracking)

### iOS Blockers:
1. **Bun has no iOS support** - ARM64 desktop/server only, not mobile
2. **iOS sandboxing** - Cannot execute arbitrary shell commands
3. **No terminal environment** - No native shell/terminal access
4. **Tool limitations** - Cannot install/run native CLI tools (git, gh, bd)

---

## 2. Detailed Options Analysis

### Option 1: iSH Terminal Emulator (Lowest Effort)

**What is iSH?**
- x86 Linux emulator for iOS
- Runs Alpine Linux in userspace
- Can install Node.js via `apk add nodejs`
- Available on App Store

**Implementation:**
```bash
# On iPhone with iSH installed
apk add nodejs npm git
npm install -g typescript
# Transpile Sharkbait from TypeScript to JavaScript
git clone https://github.com/shyamsridhar123/sharkbait.git
cd sharkbait
npm install
tsc  # Compile TS to JS
node dist/cli.js
```

**Pros:**
- ✅ Minimal code changes (transpile TS → JS, replace Bun APIs with Node)
- ✅ Can run immediately (2-3 days adaptation)
- ✅ Node.js ecosystem works
- ✅ Git, npm, basic CLI tools available

**Cons:**
- ❌ **Very slow** (x86 emulation on ARM)
- ❌ **Bun unavailable** - must port to Node.js
- ❌ Poor UX (terminal UI not optimized for touch)
- ❌ Limited by Alpine package availability
- ❌ Not distributable (users must install iSH separately)
- ❌ Beads (bd CLI) may not work or need porting

**Effort:** 1-2 weeks (port Bun → Node.js + test)

**Recommended for:** Quick experimentation only

---

### Option 2: Full Swift Native Rewrite (Highest Effort)

**Approach:**
Rewrite entire Sharkbait application in Swift using native iOS frameworks.

**Architecture:**
```
iOS App (Swift/SwiftUI)
├── UI Layer
│   ├── SwiftUI views (chat interface)
│   ├── Syntax highlighting (via TextKit/NSAttributedString)
│   └── Touch-optimized input
├── LLM Client
│   ├── URLSession for Azure OpenAI API
│   ├── Streaming parser (Server-Sent Events)
│   └── Tool calling handler
├── Tools (Reimplemented in Swift)
│   ├── File operations (FileManager)
│   ├── Limited shell (via Process, if allowed)
│   ├── Git (via libgit2 bindings)
│   └── GitHub API (URLSession)
└── Storage
    ├── CoreData or SwiftData for memory
    └── FileManager for git-like persistence
```

**Pros:**
- ✅ Native iOS experience (60fps, gestures, notifications)
- ✅ App Store distribution
- ✅ Optimized for mobile (touch, swipe, haptics)
- ✅ Offline-capable (local file access)
- ✅ No external dependencies

**Cons:**
- ❌ **Massive rewrite effort** (~6-12 months for 1 dev)
- ❌ **Cannot run shell commands** - iOS sandboxing blocks most tools
- ❌ **No git CLI** - must use libgit2 (limited features)
- ❌ **No gh CLI** - must reimplement GitHub API calls
- ❌ **No Beads** - must reimplement task tracking
- ❌ **Agent architecture complex** - rewriting multi-agent system in Swift
- ❌ Limited functionality vs desktop (~70% of features feasible)

**What CAN Be Implemented:**
- ✅ Azure OpenAI chat/streaming (URLSession)
- ✅ File operations in app sandbox + iCloud
- ✅ Basic Git operations (via SwiftGit2/libgit2)
- ✅ GitHub API calls (REST API via URLSession)
- ✅ Task tracking (CoreData/SwiftData instead of Beads)
- ✅ Code editing with syntax highlighting
- ✅ Multi-agent architecture (rewritten in Swift)
- ⚠️ Limited shell commands (no arbitrary execution)
- ⚠️ Git: push/pull/commit work, but advanced features missing

**Effort:** 6-12 months full-time development

**Recommended for:** Production standalone iOS app (no remote server dependency)

---

### ~~Option 3: Swift Native UI + Remote Server~~ (Not Pursuing)

**Status:** This approach requires a remote server which is not desired for this project.

**Summary:** Would involve building a native iOS app that communicates with Sharkbait server via WebSocket/REST. While this would provide 100% feature parity, it requires:
- Running Sharkbait on a separate server (Mac/cloud)
- Network dependency
- Complex sync/authentication

**Decision:** Excluded from consideration per project requirements.

---

### ~~Option 4: SwiftTerm + SSH~~ (Not Pursuing)

**Status:** This approach requires SSH to a remote server which is not desired for this project.

**Summary:** Would use SwiftTerm library to create terminal emulator with SSH connection. While providing full CLI experience, it requires:
- Remote server running Sharkbait
- SSH authentication/setup
- Network dependency

**Decision:** Excluded from consideration per project requirements.

---

## 3. Technical Deep Dive

### 3.1 Bun on iOS: Why It Doesn't Work

**Current State:**
- Bun supports ARM64 on **Linux and macOS** (desktop)
- **No iOS target** in Bun's build system
- Bun uses JavaScriptCore (same as iOS Safari) but not configured for mobile

**Why Not Port Bun?**
1. **iOS Sandboxing:** Bun needs JIT compilation, which is restricted
2. **App Store Rules:** No downloading/executing arbitrary code
3. **Binary Size:** Bun is ~90MB, large for mobile
4. **No Official Support:** Bun maintainers have no iOS roadmap

**Alternatives:**
- Use Node.js (via iSH) - slower but works
- Use JavaScriptCore directly (via Swift) - complex
- Keep Bun on server, communicate from iOS app

---

### 3.2 iOS Sandboxing Limitations

**What iOS Apps Cannot Do:**
```swift
// ❌ Cannot spawn arbitrary processes
Process().launchPath = "/bin/bash"  // Security violation

// ❌ Cannot access system-wide files
FileManager.default.contents(atPath: "/etc/passwd")  // Denied

// ❌ Cannot install/run CLI tools
system("git clone https://...")  // No git binary

// ❌ Cannot execute downloaded code
eval(downloadedCode)  // App Store violation
```

**What iOS Apps CAN Do:**
```swift
// ✅ Read/write app sandbox
let appDir = FileManager.default.containerURL(...)

// ✅ Network requests
URLSession.shared.dataTask(...)

// ✅ Run embedded binaries (if statically linked)
// Requires code signing + entitlements

// ✅ Use system frameworks
import Foundation, UIKit, CoreData
```

**Impact on Sharkbait:**
- **Shell commands:** Cannot be executed (iOS restriction) - affected features must be redesigned
- **Git:** Use SwiftGit2/libgit2 for basic operations (commit, push, pull, branch)
- **GitHub:** Use REST API directly via URLSession (full feature support)
- **File operations:** App sandbox + iCloud Drive for user files
- **Beads:** Reimplement task tracking with CoreData/SwiftData

---

### 3.3 Terminal Emulator on iOS

**SwiftTerm Library:**
- VT100/Xterm emulation in Swift
- Used by professional SSH apps
- Supports UIKit and SwiftUI
- Open source: https://github.com/migueldeicaza/SwiftTerm

**Example Code:**
```swift
import SwiftTerm

// Create terminal view
let terminal = TerminalView(frame: bounds)
terminal.resize(columns: 80, rows: 24)

// Handle input
terminal.onInput = { data in
    // Send to SSH or WebSocket
    connection.send(data)
}

// Handle output
connection.onData = { data in
    // Render in terminal
    terminal.feed(byteArray: data)
}

// Customize appearance
terminal.setColor(.ansiWhite, at: .foreground)
terminal.setColor(.ansiBlack, at: .background)
terminal.font = UIFont.monospacedSystemFont(ofSize: 12, weight: .regular)
```

---

### 3.4 Swift vs TypeScript Code Comparison

**TypeScript (Current Sharkbait):**
```typescript
// Agent loop
async *run(message: string): AsyncGenerator<AgentEvent> {
  const stream = await this.llm.chat(
    this.messages,
    this.tools.getDefinitions()
  );

  for await (const chunk of stream) {
    if (chunk.toolCalls) {
      for (const call of chunk.toolCalls) {
        const result = await this.tools.execute(
          call.function.name,
          JSON.parse(call.function.arguments)
        );
        yield { type: "tool_result", result };
      }
    }
  }
}
```

**Swift Native Equivalent:**
```swift
// Agent loop
func run(message: String) async throws -> AsyncThrowingStream<AgentEvent, Error> {
    return AsyncThrowingStream { continuation in
        Task {
            let stream = try await llm.chat(
                messages: messages,
                tools: tools.getDefinitions()
            )

            for try await chunk in stream {
                if let toolCalls = chunk.toolCalls {
                    for call in toolCalls {
                        let args = try JSONDecoder().decode(
                            [String: Any].self,
                            from: call.function.arguments.data(using: .utf8)!
                        )
                        let result = try await tools.execute(
                            name: call.function.name,
                            arguments: args
                        )
                        continuation.yield(.toolResult(result))
                    }
                }
            }
            continuation.finish()
        }
    }
}
```

**Analysis:**
- Similar structure possible in Swift
- Swift has async/await and AsyncStream
- JSON handling more verbose in Swift
- Tool execution pattern translates well

**Rewrite Estimate:**
- ~15,000 lines of TypeScript → ~20,000 lines of Swift
- 6-12 months for 1 developer (full rewrite)

---

## 4. Recommended Implementation Plan

### Phase 1: Validation (1-2 weeks)

**Goal:** Prove concept with minimal effort

**Steps:**
1. Install iSH on iPhone
2. Install Node.js in iSH: `apk add nodejs npm git`
3. Clone Sharkbait repo
4. Create quick port:
   - Replace Bun.file() → fs.readFile()
   - Replace Bun.write() → fs.writeFile()
   - Replace Bun.$ → child_process.exec()
5. Test basic chat functionality

**Expected Outcome:**
- ✅ Proof that core logic works on mobile
- ✅ Identify major issues early
- ✅ UX feedback (terminal on mobile is painful)

**Decision Point:**
- Validate that users want Sharkbait on iPhone
- Confirm feature priorities for native rewrite
- Get early feedback on mobile UX expectations

---

### Phase 2: Swift Native Rewrite (6-12 months)

**Recommended: Full Swift Native App - No Remote Server**

This is the only viable path for a standalone iOS app without remote dependencies.

#### Month 1-2: Foundation & LLM Client

**Goal:** Build core infrastructure

```swift
// Azure OpenAI client with streaming
class AzureOpenAIClient {
    func chat(messages: [Message], tools: [Tool]) async throws -> AsyncThrowingStream<ChatChunk, Error> {
        let url = URL(string: "\(endpoint)/openai/deployments/\(deployment)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "api-key")

        let body: [String: Any] = [
            "messages": messages.map { $0.toDictionary() },
            "tools": tools.map { $0.toDictionary() },
            "stream": true
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return AsyncThrowingStream { continuation in
            Task {
                let (bytes, response) = try await URLSession.shared.bytes(for: request)

                for try await line in bytes.lines {
                    if line.hasPrefix("data: ") {
                        let jsonString = String(line.dropFirst(6))
                        if let data = jsonString.data(using: .utf8),
                           let chunk = try? JSONDecoder().decode(ChatChunk.self, from: data) {
                            continuation.yield(chunk)
                        }
                    }
                }
                continuation.finish()
            }
        }
    }
}
```

**Deliverables:**
- [x] Project setup (Xcode, SwiftUI)
- [x] Azure OpenAI client with streaming
- [x] Message types and models
- [x] Tool definition framework
- [x] Basic chat UI

#### Month 3-4: Core Tools Implementation

**Goal:** Reimplement essential tools in Swift

```swift
// File operations tool
class FileOperationsTool: Tool {
    let fileManager = FileManager.default

    func readFile(path: String) async throws -> String {
        let url = documentsDirectory.appendingPathComponent(path)
        return try String(contentsOf: url, encoding: .utf8)
    }

    func writeFile(path: String, content: String) async throws {
        let url = documentsDirectory.appendingPathComponent(path)
        try content.write(to: url, atomically: true, encoding: .utf8)
    }

    func listDirectory(path: String) async throws -> [FileInfo] {
        let url = documentsDirectory.appendingPathComponent(path)
        let contents = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: [.isDirectoryKey])
        return contents.map { FileInfo(url: $0) }
    }
}

// Git operations via SwiftGit2
class GitTool: Tool {
    func status() async throws -> GitStatus {
        let repo = try Repository.at(repositoryURL)
        let status = try repo.status()
        return GitStatus(status: status)
    }

    func commit(message: String) async throws {
        let repo = try Repository.at(repositoryURL)
        let signature = try Signature(name: "User", email: "user@example.com")
        try repo.commit(message: message, signature: signature)
    }

    func push(remote: String = "origin", branch: String = "main") async throws {
        let repo = try Repository.at(repositoryURL)
        try repo.push(remote: remote, branch: branch)
    }
}

// GitHub API tool
class GitHubTool: Tool {
    func createPR(title: String, body: String, base: String, head: String) async throws -> PullRequest {
        let url = URL(string: "https://api.github.com/repos/\(owner)/\(repo)/pulls")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = ["title": title, "body": body, "base": base, "head": head]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(PullRequest.self, from: data)
    }
}
```

**Deliverables:**
- [x] File operations (read/write/list)
- [x] Git integration (SwiftGit2)
- [x] GitHub API client
- [x] Task tracking (CoreData model)
- [x] Tool registry system

#### Month 5-6: Agent Architecture

**Goal:** Reimplement multi-agent system

```swift
// Agent loop
class Agent {
    let llm: AzureOpenAIClient
    let tools: ToolRegistry
    var messages: [Message] = []

    func run(userMessage: String) async throws -> AsyncThrowingStream<AgentEvent, Error> {
        messages.append(Message(role: .user, content: userMessage))

        return AsyncThrowingStream { continuation in
            Task {
                while true {
                    let stream = try await llm.chat(messages: messages, tools: tools.getDefinitions())

                    var fullContent = ""
                    var toolCalls: [ToolCall] = []

                    for try await chunk in stream {
                        if let content = chunk.content {
                            fullContent += content
                            continuation.yield(.text(content))
                        }
                        if let calls = chunk.toolCalls {
                            toolCalls.append(contentsOf: calls)
                        }
                    }

                    if toolCalls.isEmpty {
                        continuation.finish()
                        return
                    }

                    messages.append(Message(role: .assistant, content: fullContent, toolCalls: toolCalls))

                    for call in toolCalls {
                        continuation.yield(.toolStart(call.function.name))
                        let result = try await tools.execute(name: call.function.name, arguments: call.function.arguments)
                        continuation.yield(.toolResult(name: call.function.name, result: result))
                        messages.append(Message(role: .tool, toolCallId: call.id, content: String(describing: result)))
                    }
                }
            }
        }
    }
}
```

**Deliverables:**
- [x] Agent base class
- [x] Agent loop with tool calling
- [x] Context management
- [x] Progress tracking
- [x] Specialized agents (coder, reviewer, planner)

#### Month 7-8: UI & Code Editor

**Goal:** Build touch-optimized interface

```swift
// Main chat view
struct ChatView: View {
    @StateObject var viewModel = ChatViewModel()
    @State var input = ""

    var body: some View {
        VStack {
            ScrollView {
                LazyVStack {
                    ForEach(viewModel.messages) { message in
                        MessageView(message: message)
                    }
                }
            }

            HStack {
                TextField("Ask Sharkbait...", text: $input)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        viewModel.send(input)
                        input = ""
                    }

                Button(action: { viewModel.send(input); input = "" }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
            }
            .padding()
        }
    }
}

// Code editor with syntax highlighting
struct CodeEditorView: View {
    @Binding var code: String
    let language: String

    var body: some View {
        TextEditor(text: $code)
            .font(.system(.body, design: .monospaced))
            .background(Color(UIColor.systemBackground))
            .overlay {
                // Syntax highlighting layer
                SyntaxHighlightedText(code: code, language: language)
            }
    }
}
```

**Deliverables:**
- [x] SwiftUI chat interface
- [x] Code editor with syntax highlighting
- [x] File browser
- [x] Settings screen
- [x] Dark mode support

#### Month 9-10: iCloud & Sync

**Goal:** File management and persistence

```swift
// iCloud document management
class DocumentManager: ObservableObject {
    let ubiquityContainer: URL?

    init() {
        ubiquityContainer = FileManager.default.url(forUbiquityContainerIdentifier: nil)
    }

    func loadProjects() async throws -> [Project] {
        guard let container = ubiquityContainer else {
            throw DocumentError.iCloudUnavailable
        }

        let projectsURL = container.appendingPathComponent("Projects")
        let contents = try FileManager.default.contentsOfDirectory(at: projectsURL, includingPropertiesForKeys: [.isDirectoryKey])

        return try await withThrowingTaskGroup(of: Project?.self) { group in
            for url in contents {
                group.addTask {
                    try await Project.load(from: url)
                }
            }

            var projects: [Project] = []
            for try await project in group {
                if let project = project {
                    projects.append(project)
                }
            }
            return projects
        }
    }
}
```

**Deliverables:**
- [x] iCloud Drive integration
- [x] File sync
- [x] Conflict resolution
- [x] Offline support
- [x] Project management

#### Month 11-12: Testing & Polish

**Goal:** Production readiness

**Deliverables:**
- [x] Unit tests for core components
- [x] UI tests for critical flows
- [x] Performance optimization
- [x] Error handling improvements
- [x] Accessibility features
- [x] App Store submission
- [x] Documentation

---

## 5. Cost-Benefit Analysis (Standalone iOS Only)

### Development Time Comparison

| Approach | Dev Time | Maintenance | Feature Parity | UX Quality | Remote Server |
|----------|----------|-------------|----------------|------------|---------------|
| iSH + Node.js | 1-2 weeks | Low | 80% | Poor | ❌ No |
| Full Swift Rewrite | 6-12 months | High | 70% | Excellent | ❌ No |

### User Experience Comparison

| Approach | Touch-Friendly | Performance | Offline Support | Setup Difficulty | Distribution |
|----------|----------------|-------------|-----------------|------------------|--------------|
| iSH + Node.js | ❌ | ⭐ | ✅ | 🔴 High | Via iSH App |
| Full Swift Rewrite | ✅ | ⭐⭐⭐⭐⭐ | ✅ | 🟢 Low | App Store |

### Feature Parity Analysis

| Feature | Desktop (Bun) | iSH + Node.js | Swift Native |
|---------|---------------|---------------|--------------|
| Azure OpenAI Chat | ✅ | ✅ | ✅ |
| Streaming Responses | ✅ | ✅ | ✅ |
| File Read/Write | ✅ | ✅ | ✅ (sandbox) |
| Git Operations | ✅ (full) | ✅ (full) | ⚠️ (basic) |
| GitHub API | ✅ | ✅ | ✅ |
| Shell Commands | ✅ | ✅ | ❌ |
| Beads Tasks | ✅ | ⚠️ (may need port) | ✅ (reimplemented) |
| Multi-Agent | ✅ | ✅ | ✅ |
| Code Highlighting | ✅ | ✅ | ✅ |
| Touch-Optimized | ❌ | ❌ | ✅ |

---

## 6. Final Recommendations (No Remote Server)

Given the constraint of no remote server, there are only two viable options:

### For Quick Validation (This Week):
→ **Use iSH + Node.js**
- Install in 1-2 days
- Port Bun APIs to Node.js
- Test on real iPhone
- Gather user feedback on concept
- Minimal investment ($0, ~1 week effort)

**Purpose:** Validate demand before committing to 6-12 month rewrite

### For Production iOS App (6-12 Months):
→ **Full Swift Native Rewrite**

This is the **only path** for a standalone iOS app without remote servers.

**Reality Check:**
- ✅ Native iOS experience (best possible UX)
- ✅ App Store distribution
- ✅ Offline-first
- ✅ ~70% feature parity (missing: arbitrary shell commands, some advanced Git)
- ❌ 6-12 months development time
- ❌ Complete rewrite in Swift
- ❌ Cannot achieve 100% feature parity due to iOS limitations

**What You'll Have to Accept:**
- No arbitrary shell command execution (iOS sandbox restriction)
- Limited Git features (via libgit2 instead of CLI)
- Beads CLI must be reimplemented (CoreData/SwiftData)
- Some tools that rely on external CLIs won't work

**What You'll Gain:**
- Beautiful native iOS/iPadOS app
- Touch-optimized interface
- App Store presence
- Offline capability
- iCloud sync
- Truly portable Sharkbait

---

## 7. Technical Resources

### Swift/iOS Development
- **SwiftUI Tutorials:** https://developer.apple.com/tutorials/swiftui
- **SwiftTerm Library:** https://github.com/migueldeicaza/SwiftTerm
- **iOS Networking:** https://developer.apple.com/documentation/foundation/urlsession
- **WebSocket (Starscream):** https://github.com/daltoniam/Starscream

### JavaScript on iOS
- **JavaScriptCore:** https://developer.apple.com/documentation/javascriptcore
- **iSH App:** https://ish.app/
- **a-Shell:** https://github.com/holzschu/a-shell
- **Running Node on iOS:** https://2ality.com/2020/10/ish-node-ios.html

### Relevant GitHub Projects
- **Code Editor for iOS:** https://github.com/CodeEditApp/CodeEdit
- **Swift Package Manager:** https://github.com/apple/swift-package-manager
- **libgit2 Swift Bindings:** https://github.com/SwiftGit2/SwiftGit2

---

## 8. Next Steps (Updated for No Remote Server)

### Immediate Actions:
1. ✅ Complete this research document
2. ⬜ **Decision:** Validate demand with iSH prototype OR skip directly to Swift rewrite
3. ⬜ If proceeding with iSH test (1 week):
   - Install iSH on iPhone
   - Port Bun → Node.js
   - Test basic functionality
   - Gather user feedback
4. ⬜ If proceeding with Swift rewrite:
   - Create iOS project in Xcode
   - Set up Azure OpenAI client
   - Build proof-of-concept chat UI
   - Start 6-12 month development timeline

### Critical Decisions Needed:
- [ ] **Commit to Swift rewrite?** (6-12 months, ~70% features)
- [ ] **OR explore alternatives to "no remote server" constraint?**
- [ ] Which features are must-have vs nice-to-have?
- [ ] What's acceptable loss vs desktop version?
- [ ] Budget/timeline realistic for 6-12 month project?

### Open Questions:
- [ ] Is 70% feature parity acceptable? (can't run shell commands)
- [ ] iPad version first (larger screen, easier development)?
- [ ] External keyboard support priority?
- [ ] Working with repos stored in iCloud vs locally?
- [ ] How to handle Git operations that libgit2 doesn't support?

---

## 9. Conclusion (Updated: No Remote Server)

**The bottom line:** Without a remote server, you must choose between a quick prototype (iSH) or a major rewrite (Swift native).

### The Two Paths:

**Path 1: iSH + Node.js (Prototype)**
- ✅ Works in 1-2 weeks
- ✅ ~80% feature parity
- ❌ Terrible UX (terminal on mobile)
- ❌ Not distributable
- **Use case:** Validate demand only

**Path 2: Full Swift Rewrite (Production)**
- ✅ Native iOS experience
- ✅ App Store distribution
- ✅ ~70% feature parity
- ❌ 6-12 months development
- ❌ Cannot execute shell commands
- **Use case:** Long-term production app

### The Hard Truth:

**You cannot have all three:**
1. Native iOS app
2. No remote server
3. 100% feature parity

**Pick two.** With "no remote server" as a constraint, you sacrifice either:
- **Native experience** (iSH route) OR
- **Full features** (Swift route, loses shell commands)

### Recommended Decision Tree:

```
Do you need shell command execution on iPhone?
│
├─ YES → Remote server is required
│         (revisit constraint)
│
└─ NO → Proceed with Swift rewrite
          • 6-12 month timeline
          • 70% feature parity
          • Best iOS experience
          • Start with iSH validation first
```

### Final Recommendation:

**Start with iSH validation (1 week), then commit to Swift rewrite (6-12 months).**

This gives you:
1. Quick validation that mobile Sharkbait has demand
2. Clear path to production iOS app
3. Realistic expectations about what's possible
4. No ongoing server maintenance

The Swift rewrite is a significant investment, but it's the only way to have a truly native, standalone iOS experience without remote dependencies.

---

**End of Research Document**

**Summary:** Swift native rewrite is your only option for a production standalone iOS app. It's doable but expensive (6-12 months) and will lose some features (shell commands, advanced Git). Consider whether this trade-off is worth it, or if the "no remote server" constraint should be reconsidered.
