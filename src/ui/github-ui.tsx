/**
 * GitHub UI Components - PR and Issue display with clickable links
 */

import React from "react";
import { Box, Text } from "ink";
import Link from "ink-link";
import { colors, icons } from "./theme";

/**
 * GitHub PR data structure
 */
export interface GitHubPR {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  draft?: boolean;
  author?: string;
  createdAt?: Date;
  labels?: string[];
}

/**
 * GitHub Issue data structure
 */
export interface GitHubIssue {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  author?: string;
  createdAt?: Date;
  labels?: string[];
}

interface PRViewProps {
  pr: GitHubPR;
  compact?: boolean;
}

interface IssueViewProps {
  issue: GitHubIssue;
  compact?: boolean;
}

interface PRCreatedNotificationProps {
  number: number;
  title: string;
  url: string;
}

interface IssueCreatedNotificationProps {
  number: number;
  title: string;
  url: string;
}

/**
 * Get PR state icon and color
 */
function getPRStateStyle(state: GitHubPR["state"], draft?: boolean): { icon: string; color: string } {
  if (draft) {
    return { icon: "◯", color: colors.textMuted };
  }
  switch (state) {
    case "open":
      return { icon: "○", color: colors.success };
    case "closed":
      return { icon: "●", color: colors.error };
    case "merged":
      return { icon: "●", color: "#8957e5" }; // Purple for merged
    default:
      return { icon: "?", color: colors.textMuted };
  }
}

/**
 * Get issue state icon and color
 */
function getIssueStateStyle(state: GitHubIssue["state"]): { icon: string; color: string } {
  switch (state) {
    case "open":
      return { icon: "○", color: colors.success };
    case "closed":
      return { icon: "●", color: "#8957e5" }; // Purple for closed
    default:
      return { icon: "?", color: colors.textMuted };
  }
}

/**
 * Single PR view
 */
export function PRView({ pr, compact = false }: PRViewProps): React.JSX.Element {
  const { icon, color } = getPRStateStyle(pr.state, pr.draft);
  
  if (compact) {
    return (
      <Box>
        <Text color={color}>{icon} </Text>
        <Text color={colors.primary}>#{pr.number}</Text>
        <Text color={colors.text}> {pr.title.slice(0, 50)}</Text>
        {pr.title.length > 50 && <Text color={colors.textMuted}>...</Text>}
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={color}>{icon} </Text>
        <Text bold color={colors.primary}>PR #{pr.number}</Text>
        <Text color={colors.text}> {pr.title}</Text>
        {pr.draft && <Text color={colors.textMuted}> [Draft]</Text>}
      </Box>
      <Box marginLeft={3}>
        <Link url={pr.url}>
          <Text color="blue" underline>{pr.url}</Text>
        </Link>
      </Box>
      {pr.labels && pr.labels.length > 0 && (
        <Box marginLeft={3}>
          {pr.labels.map((label, i) => (
            <Text key={i} color={colors.primary}> [{label}]</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Single issue view
 */
export function IssueView({ issue, compact = false }: IssueViewProps): React.JSX.Element {
  const { icon, color } = getIssueStateStyle(issue.state);
  
  if (compact) {
    return (
      <Box>
        <Text color={color}>{icon} </Text>
        <Text color={colors.primary}>#{issue.number}</Text>
        <Text color={colors.text}> {issue.title.slice(0, 50)}</Text>
        {issue.title.length > 50 && <Text color={colors.textMuted}>...</Text>}
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={color}>{icon} </Text>
        <Text bold color={colors.primary}>Issue #{issue.number}</Text>
        <Text color={colors.text}> {issue.title}</Text>
      </Box>
      <Box marginLeft={3}>
        <Link url={issue.url}>
          <Text color="blue" underline>{issue.url}</Text>
        </Link>
      </Box>
      {issue.labels && issue.labels.length > 0 && (
        <Box marginLeft={3}>
          {issue.labels.map((label, i) => (
            <Text key={i} color={colors.primary}> [{label}]</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * PR created notification - for display after successful PR creation
 */
export function PRCreatedNotification({ 
  number, 
  title, 
  url 
}: PRCreatedNotificationProps): React.JSX.Element {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.success}>{icons.success} Created PR </Text>
        <Text bold color={colors.primary}>#{number}</Text>
        <Text color={colors.text}>: "{title}"</Text>
      </Box>
      <Box marginLeft={2}>
        <Link url={url}>
          <Text color="blue" underline>{url}</Text>
        </Link>
      </Box>
    </Box>
  );
}

/**
 * Issue created notification
 */
export function IssueCreatedNotification({ 
  number, 
  title, 
  url 
}: IssueCreatedNotificationProps): React.JSX.Element {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.success}>{icons.success} Created Issue </Text>
        <Text bold color={colors.primary}>#{number}</Text>
        <Text color={colors.text}>: "{title}"</Text>
      </Box>
      <Box marginLeft={2}>
        <Link url={url}>
          <Text color="blue" underline>{url}</Text>
        </Link>
      </Box>
    </Box>
  );
}

/**
 * PR confirmation dialog content
 */
export function PRConfirmation({ 
  title,
  branch,
  baseBranch,
  files,
  summary,
}: {
  title: string;
  branch: string;
  baseBranch: string;
  files: string[];
  summary?: string;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={colors.primary}>📋 Create Pull Request?</Text>
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Text>
          <Text color={colors.textMuted}>Title: </Text>
          <Text color={colors.text}>{title}</Text>
        </Text>
        <Text>
          <Text color={colors.textMuted}>Branch: </Text>
          <Text color={colors.primary}>{branch}</Text>
          <Text color={colors.textMuted}> → </Text>
          <Text color={colors.success}>{baseBranch}</Text>
        </Text>
        <Text>
          <Text color={colors.textMuted}>Files: </Text>
          <Text color={colors.text}>{files.length} changed</Text>
        </Text>
        {summary && (
          <Box marginTop={1}>
            <Text color={colors.textMuted}>Summary: </Text>
            <Text color={colors.text} wrap="wrap">{summary.slice(0, 200)}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Issue confirmation dialog content
 */
export function IssueConfirmation({ 
  title,
  labels,
  body,
}: {
  title: string;
  labels?: string[];
  body?: string;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={colors.primary}>🐛 Create Issue?</Text>
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <Text>
          <Text color={colors.textMuted}>Title: </Text>
          <Text color={colors.text}>{title}</Text>
        </Text>
        {labels && labels.length > 0 && (
          <Text>
            <Text color={colors.textMuted}>Labels: </Text>
            {labels.map((label, i) => (
              <Text key={i} color={colors.primary}>[{label}] </Text>
            ))}
          </Text>
        )}
        {body && (
          <Box marginTop={1}>
            <Text color={colors.textMuted}>Body: </Text>
            <Text color={colors.text} wrap="wrap">{body.slice(0, 200)}...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default PRView;
