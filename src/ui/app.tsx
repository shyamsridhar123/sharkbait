/**
 * Main App Component - Claude Code inspired UI
 *
 * Refactored to fix terminal flickering:
 * 1. useAgentSession hook — all state in one useReducer (batched transitions)
 * 2. ManagedInput — self-contained input state (keystrokes don't re-render messages)
 * 3. Throttled streaming — text/tool/reasoning updates batched via refs
 * 4. All child components wrapped in React.memo()
 *
 * The compound effect: keystrokes, streaming chunks, and spinner ticks
 * no longer cascade through the entire component tree.
 */

import React, { useCallback, useMemo } from "react";
import { Box, Text, Static, useApp } from "ink";
import { Agent } from "../agent/agent";
import { MessageView } from "./message";
import { Spinner } from "./spinner";
import { WelcomeScreen } from "./welcome";
import { StatusBar } from "./status-bar";
import { InlineLogo } from "./logo";
import { ToolCallView } from "./tool-call";
import { ParallelProgressView } from "./parallel-progress";
import { DiffView } from "./diff-view";
import { ConfirmDialog } from "./confirm-dialog";
import { colors, icons } from "./theme";
import { executeCommand } from "./commands";
import type { CommandContext } from "./commands";
import { useAgentSession } from "./hooks/useAgentSession";
import { ManagedInput } from "./hooks/managed-input";

interface AppProps {
  contextFiles?: string[];
  enableBeads?: boolean;
  version?: string;
  workingDir?: string;
}

export function App({
  contextFiles: initialContextFiles,
  enableBeads: initialBeadsEnabled = true,
  version = "0.0.0",
  workingDir: cliWorkingDir,
}: AppProps): React.JSX.Element {
  const { exit } = useApp();

  // ─── Session state via useReducer (batched transitions) ─────────────────
  const { state, dispatch, processAgentEvents, cancelOperation } = useAgentSession({
    contextFiles: initialContextFiles,
    enableBeads: initialBeadsEnabled,
    workingDir: cliWorkingDir,
  });

  const {
    messages,
    isLoading,
    currentOutput,
    showWelcome,
    tokenCount,
    sessionCost,
    currentDir,
    pendingConfirm,
    beadsEnabled,
    contextFiles,
    activeToolCalls,
    currentAgent,
    isExecuting,
    parallelProgress,
    thinkingMessage,
    currentReasoning,
    currentModel,
  } = state;

  // ─── Agent instance (memoized on dependency changes) ────────────────────
  const agent = useMemo(
    () => new Agent({ contextFiles, enableBeads: beadsEnabled }),
    [contextFiles, beadsEnabled]
  );

  // ─── Command context (memoized) ────────────────────────────────────────
  const commandContext: CommandContext = useMemo(
    () => ({
      currentDir,
      setCurrentDir: (dir: string) => dispatch({ type: "SET_CURRENT_DIR", value: dir }),
      addMessage: (role: "user" | "assistant" | "system", content: string) => {
        dispatch({ type: "ADD_MESSAGE", message: { role, content, timestamp: new Date() } });
      },
      clearMessages: () => dispatch({ type: "CLEAR_MESSAGES" }),
      showWelcome: () => dispatch({ type: "SHOW_WELCOME" }),
      agent,
      version,
      exit,
      setPendingConfirm: (confirm: { type: string; data: any } | null) =>
        dispatch({ type: "SET_PENDING_CONFIRM", value: confirm }),
      beadsEnabled,
      setBeadsEnabled: (enabled: boolean) => dispatch({ type: "SET_BEADS_ENABLED", value: enabled }),
      contextFiles,
      setContextFiles: (files: string[]) => dispatch({ type: "SET_CONTEXT_FILES", value: files }),
      emitParallelStart: (agents, strategy) => {
        dispatch({ type: "SET_PARALLEL_PROGRESS", value: { agents, strategy } });
      },
      emitParallelProgress: (agents) => {
        dispatch({
          type: "SET_PARALLEL_PROGRESS",
          value: { agents, strategy: "all" as const },
        });
      },
      emitParallelComplete: (_results, consolidated) => {
        dispatch({ type: "SET_PARALLEL_PROGRESS", value: null });
        dispatch({
          type: "ADD_MESSAGE",
          message: { role: "assistant", content: consolidated, timestamp: new Date() },
        });
      },
      currentModel,
      setCurrentModel: (model: string) => dispatch({ type: "SET_MODEL", value: model }),
    }),
    [currentDir, agent, version, exit, beadsEnabled, contextFiles, currentModel, dispatch]
  );

  // ─── Confirmation handler ──────────────────────────────────────────────
  const handleConfirmation = useCallback(
    (response: string): boolean => {
      if (!pendingConfirm) return false;

      const isYes = response.toLowerCase() === "y" || response.toLowerCase() === "yes";

      if (pendingConfirm.type === "mkdir") {
        const { path: targetPath } = pendingConfirm.data;
        const { mkdirSync } = require("fs");

        if (isYes) {
          try {
            mkdirSync(targetPath, { recursive: true });
            process.chdir(targetPath);
            dispatch({ type: "SET_CURRENT_DIR", value: targetPath });
            dispatch({
              type: "ADD_MESSAGE",
              message: {
                role: "system",
                content: `Created directory and changed to: ${targetPath}`,
                timestamp: new Date(),
              },
            });
          } catch (err: any) {
            dispatch({
              type: "ADD_MESSAGE",
              message: {
                role: "system",
                content: `Error creating directory: ${err.message}`,
                timestamp: new Date(),
              },
            });
          }
        } else {
          dispatch({
            type: "ADD_MESSAGE",
            message: { role: "system", content: "Cancelled. Directory not created.", timestamp: new Date() },
          });
        }

        dispatch({ type: "SET_PENDING_CONFIRM", value: null });
        return true;
      }

      dispatch({ type: "SET_PENDING_CONFIRM", value: null });
      return false;
    },
    [pendingConfirm, dispatch]
  );

  // ─── Submit handler (called by ManagedInput) ───────────────────────────
  const handleSubmit = useCallback(
    async (userMessage: string) => {
      // Handle pending confirmations first
      if (pendingConfirm) {
        if (showWelcome) dispatch({ type: "HIDE_WELCOME" });
        dispatch({
          type: "ADD_MESSAGE",
          message: { role: "user", content: userMessage, timestamp: new Date() },
        });
        handleConfirmation(userMessage);
        return;
      }

      // Handle slash commands
      const lowerMessage = userMessage.toLowerCase();
      if (
        userMessage.startsWith("/") ||
        lowerMessage.startsWith("cd ") ||
        lowerMessage === "cd" ||
        lowerMessage === "pwd"
      ) {
        let normalizedCommand = userMessage;
        if (!userMessage.startsWith("/")) {
          normalizedCommand = "/" + userMessage;
        }

        const result = await executeCommand(normalizedCommand, commandContext);
        if (result.handled) {
          if (result.message) {
            dispatch({
              type: "ADD_MESSAGE",
              message: { role: "system", content: result.message, timestamp: new Date() },
            });
          }
          if (showWelcome) dispatch({ type: "HIDE_WELCOME" });
          return;
        }
      }

      // Hide welcome on first message
      if (showWelcome) dispatch({ type: "HIDE_WELCOME" });

      // Add user message to history
      dispatch({
        type: "ADD_MESSAGE",
        message: { role: "user", content: userMessage, timestamp: new Date() },
      });

      // Run agent (streaming is throttled inside processAgentEvents)
      await processAgentEvents(agent, userMessage);
    },
    [pendingConfirm, showWelcome, commandContext, agent, processAgentEvents, handleConfirmation, dispatch]
  );

  // ─── Message rendering ─────────────────────────────────────────────────
  // Committed messages are rendered via <Static> — they are written to
  // stdout once and removed from the Ink reconciliation tree.  Only the
  // latest message (if currently streaming) stays in the live area.
  // This eliminates the O(n) re-render cost that caused flickering as
  // conversations grew.
  const committedMessages = messages;

  // ─── Memoized active tool calls ────────────────────────────────────────
  const activeToolCallList = useMemo(
    () =>
      activeToolCalls.length > 0 ? (
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
      ) : null,
    [activeToolCalls]
  );

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" padding={0}>
      {/* Welcome Screen */}
      {showWelcome && (
        <WelcomeScreen version={version} workingDir={currentDir} />
      )}

      {/* Committed messages — rendered once, then removed from Ink tree */}
      {!showWelcome && (
        <Static items={committedMessages}>
          {(msg, i) => (
            <Box key={`msg-${i}-${msg.timestamp?.getTime() ?? i}`} flexDirection="column">
              {i === 0 && (
                <Box marginBottom={0} justifyContent="space-between">
                  <InlineLogo />
                  <Text color={colors.textDim}>v{version}</Text>
                </Box>
              )}
              <MessageView role={msg.role} content={msg.content} timestamp={msg.timestamp} />
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
          )}
        </Static>
      )}

      {/* Live area — only this section re-renders on streaming updates */}
      {!showWelcome && (
        <Box flexDirection="column" marginBottom={0}>
          {/* Active tool calls */}
          {activeToolCallList}

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
                pendingConfirm.type === "edit_file" &&
                pendingConfirm.data.oldContent &&
                pendingConfirm.data.newContent ? (
                  <DiffView
                    filePath={pendingConfirm.data.filePath}
                    oldContent={pendingConfirm.data.oldContent}
                    newContent={pendingConfirm.data.newContent}
                  />
                ) : undefined
              }
            />
          )}

          {currentReasoning && (
            <Box marginLeft={3} marginBottom={0}>
              <Text color={colors.textDim} dimColor>
                {"💭 "}
              </Text>
              <Text color={colors.textDim} dimColor wrap="wrap">
                {currentReasoning}
              </Text>
            </Box>
          )}

          {currentOutput && (
            <MessageView role="assistant" content={currentOutput} enableHighlighting={false} />
          )}
        </Box>
      )}

      {/* Loading Spinner or Input */}
      <Box marginTop={0}>
        {isLoading && (
          <Box flexDirection="column" marginLeft={1}>
            <Spinner
              text={thinkingMessage || (currentAgent ? `${currentAgent} thinking...` : "Thinking...")}
              showTokens={true}
              tokens={tokenCount}
            />
          </Box>
        )}
        <ManagedInput
          onSubmit={handleSubmit}
          visible={!isLoading}
          isExecuting={isExecuting}
          onCancel={cancelOperation}
        />
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
            <>
              Press <Text color={colors.warning}>Ctrl+C</Text> to cancel
            </>
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
