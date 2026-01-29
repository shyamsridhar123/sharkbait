/**
 * Start Chat - Interactive chat session entry point
 * Uses Ink for rich terminal UI
 */

import React from "react";
import { render } from "ink";
import { App } from "../ui/app";

export interface ChatOptions {
  context?: string[];
  beads?: boolean;
}

export async function startChat(options: ChatOptions = {}): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(App, {
      contextFiles: options.context,
      enableBeads: options.beads ?? true,
      version: "1.0.0",
    })
  );

  await waitUntilExit();
}
