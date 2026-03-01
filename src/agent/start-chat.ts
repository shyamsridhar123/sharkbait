/**
 * Start Chat - Interactive chat session entry point
 * Uses Ink for rich terminal UI
 */

import React from "react";
import { render } from "ink";
import { App } from "../ui/app";
import { getWorkingDir } from "../utils/config";
import { VERSION } from "../version";

export interface ChatOptions {
  context?: string[];
  beads?: boolean;
  workingDir?: string;
}

export async function startChat(options: ChatOptions = {}): Promise<void> {
  // Change to working directory if specified
  const workingDir = getWorkingDir(options.workingDir);
  try {
    if (workingDir !== process.cwd()) {
      process.chdir(workingDir);
    }
  } catch {
    // Directory doesn't exist (e.g. Linux path on Windows) — stay in cwd
  }

  const { waitUntilExit } = render(
    React.createElement(App, {
      contextFiles: options.context,
      enableBeads: options.beads ?? true,
      version: VERSION,
      workingDir,
    })
  );

  await waitUntilExit();
}
