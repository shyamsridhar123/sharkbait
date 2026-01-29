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
}

export function App({ contextFiles, enableBeads = true, version = "1.0.0" }: AppProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const { exit } = useApp();

  const workingDir = process.cwd();

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

  async function handleSubmit(): Promise<void> {
    const userMessage = input.trim();
    if (!userMessage) return;

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
