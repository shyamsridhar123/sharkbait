/**
 * Beads Task Display Component - Shows Beads task status in the terminal
 */

import React from "react";
import { Box, Text } from "ink";
import { colors, icons } from "./theme";

export interface BeadsTask {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  parent?: string;
  subtasks?: BeadsTask[];
}

interface BeadsTaskViewProps {
  task: BeadsTask;
  depth?: number;
  compact?: boolean;
}

interface BeadsTaskListProps {
  tasks: BeadsTask[];
  title?: string;
  showCompleted?: boolean;
}

/**
 * Get status icon and color for a task
 */
function getTaskStatus(status: BeadsTask["status"]): { icon: string; color: string } {
  switch (status) {
    case "pending":
      return { icon: "○", color: colors.textMuted };
    case "in-progress":
      return { icon: "◐", color: colors.primary };
    case "completed":
      return { icon: icons.success, color: colors.success };
    case "blocked":
      return { icon: icons.warning, color: colors.warning };
    default:
      return { icon: "?", color: colors.textMuted };
  }
}

/**
 * Single task view
 */
export function BeadsTaskView({
  task,
  depth = 0,
  compact = false,
}: BeadsTaskViewProps): React.JSX.Element {
  const { icon, color } = getTaskStatus(task.status);
  const indent = "  ".repeat(depth);
  
  if (compact) {
    return (
      <Box>
        <Text color={colors.textDim}>{indent}</Text>
        <Text color={color}>{icon} </Text>
        <Text color={colors.primary}>{task.id}</Text>
        <Text color={colors.text}> {task.title}</Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box>
        <Text color={colors.textDim}>{indent}</Text>
        <Text color={color}>{icon} </Text>
        <Text bold color={colors.primary}>{task.id}</Text>
        <Text color={colors.text}> {task.title}</Text>
      </Box>
      {task.description && (
        <Box marginLeft={depth * 2 + 4}>
          <Text color={colors.textMuted} wrap="wrap">
            {task.description}
          </Text>
        </Box>
      )}
      {task.subtasks && task.subtasks.length > 0 && (
        <Box flexDirection="column">
          {task.subtasks.map(subtask => (
            <BeadsTaskView 
              key={subtask.id} 
              task={subtask} 
              depth={depth + 1} 
              compact={compact}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Task list view
 */
export function BeadsTaskList({
  tasks,
  title = "Tasks",
  showCompleted = false,
}: BeadsTaskListProps): React.JSX.Element {
  const filteredTasks = showCompleted 
    ? tasks 
    : tasks.filter(t => t.status !== "completed");
  
  const pending = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  
  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor={colors.border} paddingX={1} marginBottom={1}>
        <Text bold color={colors.primary}>{icons.shark} {title}</Text>
        <Text color={colors.textMuted}>  </Text>
        <Text color={colors.textMuted}>
          {pending} pending • {inProgress} active • {completed} done
        </Text>
      </Box>
      
      {/* Tasks */}
      {filteredTasks.length === 0 ? (
        <Box paddingX={2}>
          <Text color={colors.textMuted}>No tasks found</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingX={1}>
          {filteredTasks.map(task => (
            <BeadsTaskView key={task.id} task={task} compact={true} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Active task indicator for status bar
 */
export function ActiveTaskIndicator({ 
  taskId, 
  taskTitle 
}: { 
  taskId: string; 
  taskTitle?: string;
}): React.JSX.Element {
  return (
    <Box>
      <Text color={colors.primary}>◐ </Text>
      <Text color={colors.text}>{taskId}</Text>
      {taskTitle && (
        <Text color={colors.textMuted}> - {taskTitle.slice(0, 30)}</Text>
      )}
    </Box>
  );
}

/**
 * Task notification component
 */
export function TaskNotification({
  type,
  taskId,
  taskTitle,
}: {
  type: "created" | "started" | "completed" | "blocked";
  taskId: string;
  taskTitle: string;
}): React.JSX.Element {
  const config = {
    created: { icon: "➕", color: colors.info, verb: "Created" },
    started: { icon: "▶", color: colors.primary, verb: "Started" },
    completed: { icon: icons.success, color: colors.success, verb: "Completed" },
    blocked: { icon: icons.warning, color: colors.warning, verb: "Blocked" },
  };
  
  const { icon, color, verb } = config[type];
  
  return (
    <Box>
      <Text color={color}>{icon} {verb} task: </Text>
      <Text bold color={colors.primary}>{taskId}</Text>
      <Text color={colors.text}> - {taskTitle}</Text>
    </Box>
  );
}

export default BeadsTaskList;
