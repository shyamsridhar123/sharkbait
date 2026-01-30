/**
 * Main App Component - Claude Code inspired UI
 * Enhanced with tool visualization, token tracking, and Ctrl+C handling
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Agent } from "../agent/agent";
import { MessageView } from "./message";
import { Spinner } from "./spinner";
import { WelcomeScreen } from "./welcome";
import { StatusBar } from "./status-bar";
import { InputPrompt } from "./input-prompt";
import { InlineLogo } from "./logo";
import { ToolCallView } from "./tool-call";
import { ParallelProgressView } from "./parallel-progress";
import { DiffView } from "./diff-view";
import { ConfirmDialog, isConfirmation } from "./confirm-dialog";
import { colors, box, icons } from "./theme";
import { getWorkingDir, loadConfig } from "../utils/config";
import { executeCommand } from "./commands";
import type { CommandContext } from "./commands";
import type { AgentEvent, ParallelAgentProgress } from "../agent/types";
import { basename } from "path";

/**
 * Estimate token count from text (~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format tool info with relevant details (like file paths)
 */
function formatToolInfo(name: string, args?: Record<string, unknown>): string {
  if (!args) return name;
  
  // Extract the most relevant info based on tool type
  const path = args["path"] || args["filePath"] || args["file"];
  const command = args["command"];
  const taskName = args["name"] || args["task"];
  
  if (path && typeof path === "string") {
    // Show just the filename for brevity
    return `${name} → ${basename(path)}`;
  }
  
  if (command && typeof command === "string") {
    // Truncate long commands
    const shortCmd = command.length > 40 ? command.slice(0, 37) + "..." : command;
    return `${name} → ${shortCmd}`;
  }
  
  if (taskName && typeof taskName === "string") {
    return `${name} → "${taskName}"`;
  }
  
  return name;
}

/**
 * Tracked tool call with timing info
 */
interface TrackedToolCall {
  id: string;
  name: string;
  displayName: string;
  status: "running" | "success" | "error";
  startTime: number;
  duration?: number;
  result?: string;
  error?: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: TrackedToolCall[];
}

interface AppProps {
  contextFiles?: string[];
  enableBeads?: boolean;
  version?: string;
  workingDir?: string;  // Allow CLI to override working directory
}

export function App({ contextFiles: initialContextFiles, enableBeads: initialBeadsEnabled = true, version = "0.1.0", workingDir: cliWorkingDir }: AppProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [currentDir, setCurrentDir] = useState(() => getWorkingDir(cliWorkingDir));
  const [pendingConfirm, setPendingConfirm] = useState<{ type: string; data: any } | null>(null);
  const [beadsEnabled, setBeadsEnabled] = useState(initialBeadsEnabled);
  const [contextFiles, setContextFiles] = useState<string[]>(initialContextFiles || []);
  const [activeToolCalls, setActiveToolCalls] = useState<TrackedToolCall[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [parallelProgress, setParallelProgress] = useState<{
    agents: ParallelAgentProgress[];
    strategy: "all" | "race" | "quorum";
  } | null>(null);
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(() => {
    const config = loadConfig();
    return config.azure.deployment;
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const workingDir = currentDir;

  const agent = React.useMemo(() => new Agent({
    contextFiles,
    enableBeads: beadsEnabled,
  }), [contextFiles, beadsEnabled]);

  // Build command context for slash commands
  const commandContext: CommandContext = React.useMemo(() => ({
    currentDir,
    setCurrentDir,
    addMessage: (role, content) => {
      setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
    },
    clearMessages: () => setMessages([]),
    showWelcome: () => setShowWelcome(true),
    agent,
    version,
    exit,
    setPendingConfirm,
    beadsEnabled,
    setBeadsEnabled,
    contextFiles,
    setContextFiles,
    emitParallelStart: (agents, strategy) => {
      setParallelProgress({ agents, strategy });
    },
    emitParallelProgress: (agents) => {
      setParallelProgress(prev => prev ? { ...prev, agents } : null);
    },
    emitParallelComplete: (results, consolidated) => {
      setParallelProgress(null);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: consolidated,
        timestamp: new Date()
      }]);
    },
    currentModel,
    setCurrentModel,
  }), [currentDir, agent, version, exit, beadsEnabled, contextFiles, currentModel]);

  useInput((inputChar, key) => {
    // Handle Ctrl+C - cancel operation or exit
    if (key.ctrl && inputChar === "c") {
      if (isExecuting && abortControllerRef.current) {
        // Cancel current operation
        abortControllerRef.current.abort();
        setMessages(prev => [...prev, {
          role: "system",
          content: "⚠️ Operation cancelled",
          timestamp: new Date()
        }]);
        setIsLoading(false);
        setIsExecuting(false);
        setCurrentOutput("");
        setActiveToolCalls([]);
      } else if (!input.trim()) {
        // Exit if at empty prompt
        exit();
      }
      return;
    }

    if (key.escape) {
      exit();
      return;
    }

    if (key.return && input.trim() && !isLoading) {
      handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && inputChar) {
      setInput(prev => prev + inputChar);
    }
  });

  // Handle pending confirmation responses
  function handleConfirmation(response: string): boolean {
    if (!pendingConfirm) return false;
    
    const isYes = response.toLowerCase() === "y" || response.toLowerCase() === "yes";
    
    if (pendingConfirm.type === "mkdir") {
      const { path: targetPath } = pendingConfirm.data;
      const { mkdirSync } = require("fs");
      
      if (isYes) {
        try {
          mkdirSync(targetPath, { recursive: true });
          process.chdir(targetPath);
          setCurrentDir(targetPath);
          setMessages(prev => [...prev, {
            role: "system",
            content: `✓ Created directory and changed to: ${targetPath}`,
            timestamp: new Date()
          }]);
        } catch (err: any) {
          setMessages(prev => [...prev, {
            role: "system",
            content: `Error creating directory: ${err.message}`,
            timestamp: new Date()
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          role: "system",
          content: `Cancelled. Directory not created.`,
          timestamp: new Date()
        }]);
      }
      
      setPendingConfirm(null);
      return true;
    }
    
    setPendingConfirm(null);
    return false;
  }

  async function handleSubmit(): Promise<void> {
    const userMessage = input.trim();
    if (!userMessage) return;

    // Handle pending confirmations first
    if (pendingConfirm) {
      setInput("");
      if (showWelcome) setShowWelcome(false);
      setMessages(prev => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
      handleConfirmation(userMessage);
      return;
    }

    // Handle slash commands (and common shortcuts like "cd" without slash)
    const lowerMessage = userMessage.toLowerCase();
    if (userMessage.startsWith("/") || lowerMessage.startsWith("cd ") || lowerMessage === "cd" || lowerMessage === "pwd") {
      setInput("");
      // Normalize: add "/" if missing for known commands
      let normalizedCommand = userMessage;
      if (!userMessage.startsWith("/")) {
        normalizedCommand = "/" + userMessage;
      }
      
      // Use the command registry
      const result = await executeCommand(normalizedCommand, commandContext);
      if (result.handled) {
        if (result.message) {
          setMessages(prev => [...prev, {
            role: "system",
            content: result.message!,
            timestamp: new Date()
          }]);
        }
        if (showWelcome) setShowWelcome(false);
        return;
      }
    }

    // Hide welcome screen on first message
    if (showWelcome) {
      setShowWelcome(false);
    }

    setMessages(prev => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
    setInput("");
    setIsLoading(true);
    setIsExecuting(true);
    setCurrentOutput("");
    setActiveToolCalls([]);
    
    // Track tokens from user message
    const inputTokens = estimateTokens(userMessage);
    setTokenCount(prev => prev + inputTokens);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      let assistantContent = "";
      const completedToolCalls: TrackedToolCall[] = [];
      
      for await (const event of agent.run(userMessage)) {
        // Check if cancelled
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        switch (event.type) {
          case "text":
            assistantContent += event.content;
            setCurrentOutput(assistantContent);
            // Track output tokens
            const chunkTokens = estimateTokens(event.content);
            setTokenCount(prev => prev + chunkTokens);
            // Approximate cost: $0.01/1K input, $0.03/1K output
            setSessionCost(prev => prev + (chunkTokens * 0.00003));
            break;
            
          case "agent_start":
            setCurrentAgent(event.agent);
            setMessages(prev => [...prev, {
              role: "system",
              content: `${icons.shark} ${event.agent} agent starting${event.mode ? ` (${event.mode} mode)` : ""}...`,
              timestamp: new Date()
            }]);
            break;
            
          case "handoff":
            setMessages(prev => [...prev, {
              role: "system",
              content: `📤 Delegating to ${event.to}...`,
              timestamp: new Date()
            }]);
            break;
            
          case "replan":
            setMessages(prev => [...prev, {
              role: "system",
              content: `⚠️ Re-planning: ${event.reason}`,
              timestamp: new Date()
            }]);
            break;
            
          case "thinking":
            setThinkingMessage(event.message || `${event.agent} is thinking...`);
            break;
            
          case "parallel_start":
            setParallelProgress({
              agents: event.agents,
              strategy: event.strategy,
            });
            setMessages(prev => [...prev, {
              role: "system",
              content: `🔀 Starting parallel execution (${event.strategy} strategy) with ${event.agents.length} agents...`,
              timestamp: new Date()
            }]);
            break;
            
          case "parallel_progress":
            setParallelProgress(prev => prev ? {
              ...prev,
              agents: event.agents,
            } : null);
            break;
            
          case "parallel_complete":
            setParallelProgress(null);
            setMessages(prev => [...prev, {
              role: "system",
              content: `✅ Parallel execution complete:\n${event.consolidated}`,
              timestamp: new Date()
            }]);
            break;
            
          case "tool_start": {
            const toolInfo = formatToolInfo(event.name, event.args);
            const newTool: TrackedToolCall = {
              id: `${event.name}-${Date.now()}`,
              name: event.name,
              displayName: toolInfo,
              status: "running",
              startTime: Date.now(),
            };
            setActiveToolCalls(prev => [...prev, newTool]);
            break;
          }
          
          case "tool_result": {
            const duration = event.duration;
            // Update the tool call status
            setActiveToolCalls(prev => prev.map(tc => 
              tc.name === event.name && tc.status === "running"
                ? { 
                    ...tc, 
                    status: "success" as const, 
                    duration,
                    result: typeof event.result === "string" 
                      ? event.result.slice(0, 100) 
                      : JSON.stringify(event.result).slice(0, 100)
                  }
                : tc
            ));
            // Move to completed
            setActiveToolCalls(prev => {
              const completed = prev.find(tc => tc.name === event.name && tc.status === "success");
              if (completed) {
                completedToolCalls.push(completed);
              }
              return prev.filter(tc => !(tc.name === event.name && tc.status === "success"));
            });
            break;
          }
          
          case "tool_error": {
            const duration = event.duration;
            // Update the tool call status
            setActiveToolCalls(prev => prev.map(tc => 
              tc.name === event.name && tc.status === "running"
                ? { 
                    ...tc, 
                    status: "error" as const, 
                    duration,
                    error: event.error
                  }
                : tc
            ));
            break;
          }
          
          case "token_usage":
            setTokenCount(event.totalTokens);
            break;
            
          case "done":
            // Only add message if there's actual content
            if (assistantContent.trim()) {
              setMessages(prev => [...prev, { 
                role: "assistant", 
                content: assistantContent.trim(),
                timestamp: new Date(),
                toolCalls: completedToolCalls.length > 0 ? [...completedToolCalls] : undefined,
              }]);
            }
            setCurrentOutput("");
            setActiveToolCalls([]);
            setCurrentAgent(null);
            setThinkingMessage(null);
            setParallelProgress(null);
            break;
            
          case "error":
            setMessages(prev => [...prev, { 
              role: "system", 
              content: `Error: ${event.message}`,
              timestamp: new Date()
            }]);
            break;
        }
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        // Already handled by Ctrl+C
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        setMessages(prev => [...prev, { 
          role: "system", 
          content: `Error: ${message}`,
          timestamp: new Date()
        }]);
      }
    }

    setIsLoading(false);
    setIsExecuting(false);
    abortControllerRef.current = null;
  }

  return (
    <Box flexDirection="column" padding={0}>
      {/* Welcome Screen or Header */}
      {showWelcome ? (
        <WelcomeScreen version={version} workingDir={workingDir} />
      ) : (
        <Box marginBottom={0} justifyContent="space-between">
          <InlineLogo />
          <Text color={colors.textDim}>v{version}</Text>
        </Box>
      )}

      {/* Messages */}
      {!showWelcome && (
        <Box flexDirection="column" marginBottom={0}>
          {messages.map((msg, i) => (
            <Box key={i} flexDirection="column">
              <MessageView 
                role={msg.role} 
                content={msg.content}
                timestamp={msg.timestamp}
              />
              {/* Show tool calls for this message if any */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <Box flexDirection="column" marginLeft={2}>
                  {msg.toolCalls.map((tc, j) => (
                    <ToolCallView
                      key={j}
                      name={tc.displayName}
                      status={tc.status}
                      result={tc.result}
                      error={tc.error}
                      duration={tc.duration}
                    />
                  ))}
                </Box>
              )}
            </Box>
          ))}
          
          {/* Active tool calls */}
          {activeToolCalls.length > 0 && (
            <Box flexDirection="column" marginLeft={2}>
              {activeToolCalls.map((tc, i) => (
                <ToolCallView
                  key={i}
                  name={tc.displayName}
                  status={tc.status}
                  result={tc.result}
                  error={tc.error}
                  duration={tc.duration}
                />
              ))}
            </Box>
          )}
          
          {/* Parallel execution progress */}
          {parallelProgress && (
            <ParallelProgressView
              title="Parallel Execution"
              agents={parallelProgress.agents}
              strategy={parallelProgress.strategy}
            />
          )}
          
          {/* Pending confirmation dialog */}
          {pendingConfirm && (
            <ConfirmDialog
              message={
                pendingConfirm.type === "mkdir" 
                  ? `Create directory: ${pendingConfirm.data.path}?`
                  : pendingConfirm.type === "edit_file"
                  ? `Apply changes to: ${pendingConfirm.data.filePath}?`
                  : `Confirm ${pendingConfirm.type}?`
              }
              details={pendingConfirm.data.details}
              showDiff={
                pendingConfirm.type === "edit_file" && pendingConfirm.data.oldContent && pendingConfirm.data.newContent ? (
                  <DiffView
                    filePath={pendingConfirm.data.filePath}
                    oldContent={pendingConfirm.data.oldContent}
                    newContent={pendingConfirm.data.newContent}
                  />
                ) : undefined
              }
            />
          )}
          
          {currentOutput && (
            <MessageView role="assistant" content={currentOutput} />
          )}
        </Box>
      )}

      {/* Loading or Input */}
      <Box marginTop={0}>
        {isLoading ? (
          <Box flexDirection="column" marginLeft={1}>
            <Spinner 
              text={thinkingMessage || (currentAgent ? `${currentAgent} thinking...` : "Thinking...")} 
              showTokens={true} 
              tokens={tokenCount} 
            />
          </Box>
        ) : (
          <InputPrompt value={input} />
        )}
      </Box>

      {/* Status Bar */}
      <Box marginTop={0}>
        <StatusBar 
          mode={isExecuting ? "agent" : "chat"} 
          tokens={tokenCount} 
          cost={sessionCost}
          model={currentModel}
        />
      </Box>

      {/* Help hint */}
      <Box marginTop={0} justifyContent="center">
        <Text color={colors.textDim}>
          {isExecuting ? (
            <>Press <Text color={colors.warning}>Ctrl+C</Text> to cancel</>
          ) : (
            <>
              Press <Text color={colors.primary}>Ctrl+C</Text> to exit • 
              <Text color={colors.primary}> Enter</Text> to send
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}
