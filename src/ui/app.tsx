/**
 * Main App Component - Root Ink application
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Agent } from "../agent/agent";
import { MessageView } from "./message";
import { Spinner } from "./spinner";
import type { AgentEvent } from "../agent/types";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AppProps {
  contextFiles?: string[];
  enableBeads?: boolean;
}

export function App({ contextFiles, enableBeads = true }: AppProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOutput, setCurrentOutput] = useState("");
  const { exit } = useApp();

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

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
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
            setCurrentOutput(prev => prev + `\n[Calling ${event.name}...]\n`);
            break;
          case "done":
            setMessages(prev => [...prev, { role: "assistant", content: assistantContent }]);
            setCurrentOutput("");
            break;
          case "error":
            setMessages(prev => [...prev, { role: "system", content: `Error: ${event.message}` }]);
            break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages(prev => [...prev, { role: "system", content: `Error: ${message}` }]);
    }

    setIsLoading(false);
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🦈 Sharkbait</Text>
        <Text color="gray"> - AI Coding Assistant</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg, i) => (
          <MessageView key={i} role={msg.role} content={msg.content} />
        ))}
        
        {currentOutput && (
          <MessageView role="assistant" content={currentOutput} />
        )}
      </Box>

      <Box>
        {isLoading ? (
          <Spinner text="Thinking..." />
        ) : (
          <Box>
            <Text color="green">&gt; </Text>
            <Text>{input}</Text>
            <Text color="gray">█</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press ESC to exit | Enter to send
        </Text>
      </Box>
    </Box>
  );
}
