# iOS Feasibility Research: Running Sharkbait CLI on iPhone

**Date:** February 15, 2026
**Author:** Research Agent
**Status:** Complete

---

## Executive Summary

After deep research into running Sharkbait (a Bun/TypeScript CLI tool) on iPhone, **the assumption that we need to rewrite in Swift is only partially correct**. There are multiple approaches with varying levels of effort and functionality:

### TL;DR Options:

| Approach | Effort | Native Experience | Full Functionality | Recommended |
|----------|--------|-------------------|-------------------|-------------|
| **1. iSH + Node.js** | Low | ❌ | ~80% | ✅ Quick prototype |
| **2. Swift Native Rewrite** | Very High | ✅ | ~60% | ⚠️ Best UX, but limited |
| **3. Swift + Remote Server** | Medium | ✅ | 100% | ✅✅ Best overall |
| **4. SwiftTerm + Remote** | Medium-High | ✅ | 100% | ✅ Power users |

**Recommendation:** Option 3 (Swift Native UI + Remote Server) for production, Option 1 for immediate experimentation.

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
- ❌ Limited functionality vs desktop (60% of features feasible)

**Effort:** 6-12 months full-time development

**Recommended for:** Only if building a dedicated iOS product (not a port)

---

### Option 3: Swift Native UI + Remote Server (RECOMMENDED)

**Approach:**
Build native iOS app that communicates with Sharkbait server running remotely.

**Architecture:**
```
┌─────────────────────────┐
│   iOS App (Swift)       │
│   - Chat UI             │
│   - File browser        │
│   - Code editor         │
│   - Syntax highlight    │
└────────┬────────────────┘
         │ WebSocket/HTTP
         │ (encrypted)
┌────────┴────────────────┐
│  Sharkbait Server       │
│  (Bun/TypeScript)       │
│  - Agent loop           │
│  - Tools execution      │
│  - Git/GitHub/Beads     │
│  - File system access   │
└─────────────────────────┘
```

**Implementation Options:**

#### A. Cloud Server (Easiest)
- Deploy Sharkbait to VPS/AWS/Azure
- iOS app connects via WebSocket
- Server runs full Sharkbait with all tools

#### B. Local Mac/PC Server (Best for security)
- Run Sharkbait on user's Mac
- iOS app discovers via Bonjour/mDNS
- Direct local network connection (no cloud)

#### C. Hybrid (Best UX)
- Optional cloud server for mobile-only use
- Auto-discover local server when on same network
- Seamless switching

**Pros:**
- ✅ **100% feature parity** - server runs full Sharkbait
- ✅ Native iOS UI/UX
- ✅ App Store distribution possible
- ✅ Moderate effort (2-3 months)
- ✅ Can work on files stored on Mac
- ✅ All tools work (git, gh, bd, shell)
- ✅ Security: keep code on local machine

**Cons:**
- ⚠️ Requires server running (Mac or cloud)
- ⚠️ Network dependency
- ⚠️ Authentication/encryption needed
- ⚠️ Complexity in sync/offline handling

**Effort:** 2-3 months
- 2-3 weeks: iOS app with chat UI
- 2-3 weeks: Server protocol & API
- 2-3 weeks: File sync & editing
- 2-3 weeks: Testing & polish

**Recommended for:** Production iOS app

---

### Option 4: SwiftTerm + SSH to Remote Server

**Approach:**
Use SwiftTerm library to create terminal emulator, SSH to server running Sharkbait.

**Architecture:**
```
┌─────────────────────────┐
│   iOS App (Swift)       │
│   - SwiftTerm (VT100)   │
│   - Keyboard toolbar    │
└────────┬────────────────┘
         │ SSH
┌────────┴────────────────┐
│  Remote Server          │
│  - Full terminal        │
│  - Sharkbait CLI        │
│  - All tools available  │
└─────────────────────────┘
```

**Implementation:**
```swift
import SwiftTerm

class TerminalViewController: UIViewController {
    var terminalView: TerminalView!
    var sshConnection: SSHConnection!

    override func viewDidLoad() {
        super.viewDidLoad()

        // SwiftTerm provides VT100/Xterm emulation
        terminalView = TerminalView(frame: view.bounds)
        terminalView.resize(columns: 80, rows: 40)
        view.addSubview(terminalView)

        // Connect to server via SSH
        sshConnection = SSHConnection(host: "your-server.com")
        sshConnection.connect(username: "user", key: privateKey)

        // Run Sharkbait
        sshConnection.execute("sharkbait chat")
    }
}
```

**Pros:**
- ✅ **100% feature parity** - full CLI experience
- ✅ Moderate effort (1-2 months)
- ✅ SwiftTerm is mature library
- ✅ Existing terminal experience carries over
- ✅ No protocol design needed (SSH is standard)

**Cons:**
- ❌ Terminal UI not optimized for mobile
- ❌ Requires server/SSH access
- ❌ Keyboard-centric (touch not ideal)
- ❌ Text size issues on small screens

**Effort:** 1-2 months
- 1 week: SwiftTerm integration
- 1-2 weeks: SSH client + auth
- 1-2 weeks: Mobile keyboard toolbar
- 1-2 weeks: Testing & UX polish

**Recommended for:** Power users who want full CLI access

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
- **Shell commands:** Must run on remote server
- **Git:** Use libgit2 (limited) or remote Git server
- **GitHub:** Can use REST API directly
- **File operations:** Only in app sandbox (or iCloud)

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
- If UX is terrible → Move to Option 3 (Swift + Server)
- If performance OK → Consider improving iSH approach

---

### Phase 2: Production Approach (2-3 months)

**Recommended: Option 3 - Swift Native UI + Remote Server**

#### Sprint 1: Server Protocol (2 weeks)
```typescript
// Add WebSocket server to Sharkbait
import { Server } from "bun";

const server = Bun.serve({
  port: 3000,
  websocket: {
    message(ws, message) {
      // Parse command from iOS client
      const cmd = JSON.parse(message);

      // Execute in agent
      const stream = agent.run(cmd.message);

      // Stream back to client
      for await (const event of stream) {
        ws.send(JSON.stringify(event));
      }
    }
  }
});
```

#### Sprint 2: iOS Chat UI (2 weeks)
```swift
// SwiftUI chat interface
struct ChatView: View {
    @State var messages: [Message] = []
    @State var input: String = ""
    @StateObject var connection = WebSocketConnection()

    var body: some View {
        VStack {
            ScrollView {
                ForEach(messages) { msg in
                    MessageBubble(message: msg)
                }
            }

            HStack {
                TextField("Ask Sharkbait...", text: $input)
                Button("Send") {
                    connection.send(input)
                    input = ""
                }
            }
        }
        .onAppear {
            connection.connect(to: "ws://localhost:3000")
        }
    }
}
```

#### Sprint 3: File Browser (2 weeks)
```swift
// File tree view
struct FileTreeView: View {
    @State var files: [FileNode]

    var body: some View {
        List(files) { file in
            if file.isDirectory {
                DisclosureGroup(file.name) {
                    FileTreeView(files: file.children)
                }
            } else {
                NavigationLink(file.name) {
                    CodeEditor(file: file)
                }
            }
        }
    }
}
```

#### Sprint 4: Code Editor (2 weeks)
```swift
// Syntax-highlighted code editor
struct CodeEditor: View {
    @State var file: FileNode
    @State var content: AttributedString

    var body: some View {
        TextEditor(text: $content)
            .font(.system(.body, design: .monospaced))
            .onChange(of: content) { newValue in
                // Send changes to server
                connection.updateFile(file.path, content: newValue)
            }
    }
}
```

#### Sprint 5: Testing & Polish (2 weeks)
- Error handling
- Offline mode
- Settings screen
- Authentication
- App icon & branding

---

### Phase 3: Advanced Features (1-2 months)

**Optional Enhancements:**
- [ ] Siri shortcuts for common tasks
- [ ] Widget showing current task status
- [ ] Watch app for notifications
- [ ] Handoff between iPhone/iPad/Mac
- [ ] Drag & drop file support (iPad)
- [ ] Keyboard shortcuts (iPad with keyboard)
- [ ] Dark mode / themes
- [ ] Voice input (Whisper API)

---

## 5. Cost-Benefit Analysis

### Development Time Comparison

| Approach | Dev Time | Maintenance | Feature Parity | UX Quality |
|----------|----------|-------------|----------------|------------|
| iSH + Node.js | 1-2 weeks | Low | 80% | Poor |
| Full Swift Rewrite | 6-12 months | High | 60% | Excellent |
| Swift + Server | 2-3 months | Medium | 100% | Excellent |
| SwiftTerm + SSH | 1-2 months | Low | 100% | Good |

### User Experience Comparison

| Approach | Touch-Friendly | Performance | Offline Support | Setup Difficulty |
|----------|----------------|-------------|-----------------|------------------|
| iSH + Node.js | ❌ | ⭐ | ✅ | 🔴 High |
| Full Swift Rewrite | ✅ | ⭐⭐⭐⭐⭐ | ✅ | 🟢 Low |
| Swift + Server | ✅ | ⭐⭐⭐⭐ | ❌ | 🟡 Medium |
| SwiftTerm + SSH | ⚠️ | ⭐⭐⭐⭐ | ❌ | 🟡 Medium |

---

## 6. Final Recommendations

### For Quick Experimentation (This Week):
→ **Use iSH + Node.js**
- Get it working in 1-2 weeks
- Validate use cases
- Gather user feedback
- Minimal investment

### For Production iOS App (Next Quarter):
→ **Build Swift Native UI + Remote Server**
- Best balance of effort vs features
- Native iOS experience
- 100% feature parity
- 2-3 months to launch

### For Power Users (Alternative):
→ **SwiftTerm + SSH**
- Terminal purists
- Faster to build
- Full CLI experience
- 1-2 months to launch

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

## 8. Next Steps

### Immediate Actions:
1. ✅ Complete this research document
2. ⬜ Test iSH + Node.js prototype (1 week)
3. ⬜ Design Swift app architecture (1 week)
4. ⬜ Prototype WebSocket protocol (1 week)
5. ⬜ Build MVP iOS app (4 weeks)

### Open Questions:
- [ ] Should we support both cloud and local server?
- [ ] What authentication mechanism for server?
- [ ] How to handle file sync conflicts?
- [ ] Should we build iPad version first (larger screen)?
- [ ] Open source the iOS app separately or monorepo?

### Decisions Needed:
- **Approve recommended approach** (Swift + Server)
- **Prioritize features** for MVP
- **Choose deployment model** (cloud vs local vs hybrid)
- **Set timeline** and allocate resources

---

## 9. Conclusion

**You do NOT necessarily need to rewrite in Swift**, but it's the best path for a quality iOS experience.

**The reality is:**
- Running Sharkbait natively on iPhone (like on desktop) is **not possible** due to iOS limitations
- **iSH + Node.js** works but provides poor UX
- **Swift + Remote Server** gives the best of both worlds: native UI + full functionality
- **Full Swift rewrite** is only needed if you want offline-first, standalone iOS app (but loses 40% features)

**Recommended Path:**
1. **Week 1-2:** Test with iSH to validate demand
2. **Month 1:** Build WebSocket server API
3. **Month 2:** Build Swift iOS app
4. **Month 3:** Polish, test, and launch

This approach gives you a **production-ready iOS app in 3 months** with **100% feature parity** with the desktop version.

---

**End of Research Document**
