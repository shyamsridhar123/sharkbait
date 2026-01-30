/**
 * Main App Component - Claude Code inspired UI
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Agent } from "../agent/agent";
import { MessageView } from "./message";
import { Spinner } from "./spinner";
import { WelcomeScreen } from "./welcome";
import { StatusBar } from "./status-bar";
import { InputPrompt } from "./input-prompt";
import { InlineLogo } from "./logo";
import { colors, box } from "./theme";
import { getWorkingDir } from "../utils/config";
import { executeCommand } from "./commands";
import type { CommandContext } from "./commands";
import type { AgentEvent } from "../agent/types";
import { basename } from "path";

/**
 * Format tool info with relevant details (like file paths)
 */
function formatToolInfo(name: string, args?: Record<string, unknown>): string {
  if (!args) return name;
  
  // Extract the most relevant info based on tool type
  const path = args.path || args.filePath || args.file;
  const command = args.command;
  const taskName = args.name || args.task;
  
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

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
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
  const [currentDir, setCurrentDir] = useState(() => getWorkingDir(cliWorkingDir));
  const [pendingConfirm, setPendingConfirm] = useState<{ type: string; data: any } | null>(null);
  const [beadsEnabled, setBeadsEnabled] = useState(initialBeadsEnabled);
  const [contextFiles, setContextFiles] = useState<string[]>(initialContextFiles || []);
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
  }), [currentDir, agent, version, exit, beadsEnabled, contextFiles]);

  useInput((inputChar, key) => {
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
    setCurrentOutput("");

    try {
      let assistantContent = "";
      let toolOutput = "";  // Separate tracking for tool execution output
      
      for await (const event of agent.run(userMessage)) {
        switch (event.type) {
          case "text":
            assistantContent += event.content;
            setCurrentOutput(toolOutput + assistantContent);
            break;
          case "tool_start":
            const toolInfo = formatToolInfo(event.name, event.args);
            toolOutput += `⚡ ${toolInfo}...\n`;
            setCurrentOutput(toolOutput + assistantContent);
            break;
          case "tool_result":
            // Tool completed - show success indicator (match tool name with optional args)
            toolOutput = toolOutput.replace(
              new RegExp(`⚡ ${(event as any).name}( →[^\\n]*)?\\.\\.\\.\n`),
              `✓ ${(event as any).name}$1\n`
            );
            setCurrentOutput(toolOutput + assistantContent);
            break;
          case "tool_error":
            // Tool failed - show error indicator
            toolOutput = toolOutput.replace(
              new RegExp(`⚡ ${(event as any).name}( →[^\\n]*)?\\.\\.\\.\n`),
              `✗ ${(event as any).name}$1: ${(event as any).error}\n`
            );
            setCurrentOutput(toolOutput + assistantContent);
            break;
          case "done":
            // Only add message if there's actual content
            const finalContent = (toolOutput + assistantContent).trim();
            if (finalContent) {
              setMessages(prev => [...prev, { 
                role: "assistant", 
                content: finalContent,
                timestamp: new Date()
              }]);
            }
            setCurrentOutput("");
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
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages(prev => [...prev, { 
        role: "system", 
        content: `Error: ${message}`,
        timestamp: new Date()
      }]);
    }

    setIsLoading(false);
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
            <MessageView 
              key={i} 
              role={msg.role} 
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}
          
          {currentOutput && (
            <MessageView role="assistant" content={currentOutput} />
          )}
        </Box>
      )}

      {/* Loading or Input */}
      <Box marginTop={0}>
        {isLoading ? (
          <Box marginLeft={1}>
            <Spinner text="Thinking..." showTokens={true} tokens={tokenCount} />
          </Box>
        ) : (
          <InputPrompt value={input} />
        )}
      </Box>

      {/* Status Bar */}
      <Box marginTop={0}>
        <StatusBar mode="chat" tokens={tokenCount} />
      </Box>

      {/* Help hint */}
      <Box marginTop={0} justifyContent="center">
        <Text color={colors.textDim}>
          Press <Text color={colors.primary}>ESC</Text> to exit • 
          <Text color={colors.primary}> Enter</Text> to send
        </Text>
      </Box>
    </Box>
  );
}
