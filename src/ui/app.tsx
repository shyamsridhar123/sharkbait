/**
 * Main App Component - Claude Code inspired UI
 */

import React, { useState, useEffect } from "react";
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
import type { AgentEvent } from "../agent/types";

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

export function App({ contextFiles, enableBeads = true, version = "1.0.0", workingDir: cliWorkingDir }: AppProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const [currentDir, setCurrentDir] = useState(() => getWorkingDir(cliWorkingDir));
  const [pendingConfirm, setPendingConfirm] = useState<{ type: string; data: any } | null>(null);
  const { exit } = useApp();

  const workingDir = currentDir;

  const agent = React.useMemo(() => new Agent({
    contextFiles,
    enableBeads,
  }), [contextFiles, enableBeads]);

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

  // Handle slash commands
  function handleSlashCommand(command: string): boolean {
    const parts = command.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (cmd) {
      case "cd": {
        if (!args) {
          setMessages(prev => [...prev, {
            role: "system",
            content: `Current directory: ${currentDir}\n\nUsage: /cd <path>`,
            timestamp: new Date()
          }]);
          return true;
        }
        
        // Resolve path (handle relative paths)
        const { resolve, isAbsolute } = require("path");
        const { existsSync, statSync, mkdirSync } = require("fs");
        
        const newPath = isAbsolute(args) ? args : resolve(currentDir, args);
        
        if (!existsSync(newPath)) {
          // Directory doesn't exist - ask for permission to create it
          setMessages(prev => [...prev, {
            role: "system",
            content: `Directory not found: ${newPath}\n\nCreate it? Type 'y' or 'yes' to create, anything else to cancel.`,
            timestamp: new Date()
          }]);
          setPendingConfirm({ type: "mkdir", data: { path: newPath } });
          return true;
        }
        
        try {
          const stat = statSync(newPath);
          if (!stat.isDirectory()) {
            setMessages(prev => [...prev, {
              role: "system",
              content: `Error: Not a directory: ${newPath}`,
              timestamp: new Date()
            }]);
            return true;
          }
        } catch {
          setMessages(prev => [...prev, {
            role: "system",
            content: `Error: Cannot access: ${newPath}`,
            timestamp: new Date()
          }]);
          return true;
        }
        
        // Change directory
        process.chdir(newPath);
        setCurrentDir(newPath);
        setMessages(prev => [...prev, {
          role: "system",
          content: `Changed directory to: ${newPath}`,
          timestamp: new Date()
        }]);
        return true;
      }
      
      case "pwd": {
        setMessages(prev => [...prev, {
          role: "system",
          content: `Current directory: ${currentDir}`,
          timestamp: new Date()
        }]);
        return true;
      }
      
      case "help": {
        setMessages(prev => [...prev, {
          role: "system",
          content: `Available commands:
  /cd <path>  - Change working directory
  /pwd        - Show current working directory
  /clear      - Clear message history
  /help       - Show this help message`,
          timestamp: new Date()
        }]);
        return true;
      }
      
      case "clear": {
        setMessages([]);
        setShowWelcome(true);
        return true;
      }
      
      default:
        return false;
    }
  }

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

    // Handle slash commands
    if (userMessage.startsWith("/")) {
      setInput("");
      if (handleSlashCommand(userMessage)) {
        if (showWelcome) setShowWelcome(false);
        return;
      }
      // Unknown command - show error
      setMessages(prev => [...prev, {
        role: "system",
        content: `Unknown command: ${userMessage.split(/\s+/)[0]}\nType /help for available commands.`,
        timestamp: new Date()
      }]);
      if (showWelcome) setShowWelcome(false);
      return;
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
      
      for await (const event of agent.run(userMessage)) {
        switch (event.type) {
          case "text":
            assistantContent += event.content;
            setCurrentOutput(assistantContent);
            break;
          case "tool_start":
            setCurrentOutput(prev => prev + `\n⚡ ${event.name}...\n`);
            break;
          case "done":
            setMessages(prev => [...prev, { 
              role: "assistant", 
              content: assistantContent,
              timestamp: new Date()
            }]);
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
    <Box flexDirection="column" padding={1}>
      {/* Welcome Screen or Header */}
      {showWelcome ? (
        <WelcomeScreen version={version} workingDir={workingDir} />
      ) : (
        <Box marginBottom={1} justifyContent="space-between">
          <InlineLogo />
          <Text color={colors.textDim}>v{version}</Text>
        </Box>
      )}

      {/* Messages */}
      {!showWelcome && (
        <Box flexDirection="column" marginBottom={1}>
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
      <Box marginTop={1}>
        {isLoading ? (
          <Box marginLeft={1}>
            <Spinner text="Thinking..." showTokens={true} tokens={tokenCount} />
          </Box>
        ) : (
          <InputPrompt value={input} />
        )}
      </Box>

      {/* Status Bar */}
      <Box marginTop={1}>
        <StatusBar mode="chat" tokens={tokenCount} />
      </Box>

      {/* Help hint */}
      <Box marginTop={1} justifyContent="center">
        <Text color={colors.textDim}>
          Press <Text color={colors.primary}>ESC</Text> to exit • 
          <Text color={colors.primary}> Enter</Text> to send
        </Text>
      </Box>
    </Box>
  );
}
