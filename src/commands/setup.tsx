/**
 * Setup Command - Interactive guided setup wizard
 * Helps users configure Sharkbait step by step
 */

import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { colors, icons } from "../ui/theme";

type SetupStep = 
  | "welcome"
  | "azure-endpoint"
  | "azure-key"
  | "azure-deployment"
  | "working-dir"
  | "features"
  | "confirm"
  | "complete";

interface SetupState {
  azureEndpoint: string;
  azureKey: string;
  azureDeployment: string;
  defaultWorkingDir: string;
  enableBeads: boolean;
  confirmDestructive: boolean;
}

function SetupWizard(): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<SetupStep>("welcome");
  const [state, setState] = useState<SetupState>({
    azureEndpoint: "",
    azureKey: "",
    azureDeployment: "gpt-codex-5.2",
    defaultWorkingDir: "",
    enableBeads: true,
    confirmDestructive: true,
  });
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    loadExistingConfig();
  }, []);

  async function loadExistingConfig(): Promise<void> {
    const configDir = join(homedir(), ".sharkbait");
    const configPath = join(configDir, "config.json");
    
    try {
      if (existsSync(configPath)) {
        const content = await readFile(configPath, "utf-8");
        const existing = JSON.parse(content);
        setState(prev => ({
          ...prev,
          azureEndpoint: existing.azure?.endpoint || prev.azureEndpoint,
          azureDeployment: existing.azure?.deployment || prev.azureDeployment,
          defaultWorkingDir: existing.paths?.defaultWorkingDir || prev.defaultWorkingDir,
          enableBeads: existing.features?.beads ?? prev.enableBeads,
          confirmDestructive: existing.features?.confirmDestructive ?? prev.confirmDestructive,
        }));
      }
    } catch {
      // No existing config, that's fine
    }

    // Also check environment variables
    if (process.env["AZURE_OPENAI_ENDPOINT"]) {
      setState(prev => ({ ...prev, azureEndpoint: process.env["AZURE_OPENAI_ENDPOINT"]! }));
    }
    if (process.env["AZURE_OPENAI_CODEX_DEPLOYMENT"] || process.env["AZURE_OPENAI_DEPLOYMENT"]) {
      setState(prev => ({ 
        ...prev, 
        azureDeployment: process.env["AZURE_OPENAI_CODEX_DEPLOYMENT"] || process.env["AZURE_OPENAI_DEPLOYMENT"]! 
      }));
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (step === "welcome" && key.return) {
      setStep("azure-endpoint");
      setInputValue(state.azureEndpoint);
      return;
    }

    if (step === "features") {
      if (input === "1") {
        setState(prev => ({ ...prev, enableBeads: !prev.enableBeads }));
      } else if (input === "2") {
        setState(prev => ({ ...prev, confirmDestructive: !prev.confirmDestructive }));
      } else if (key.return) {
        setStep("confirm");
      }
      return;
    }

    if (step === "confirm") {
      if (input === "y" || input === "Y" || key.return) {
        saveConfig();
      } else if (input === "n" || input === "N") {
        exit();
      }
      return;
    }

    if (step === "complete" && key.return) {
      exit();
      return;
    }
  });

  function handleInputSubmit(value: string): void {
    setError(null);

    switch (step) {
      case "azure-endpoint":
        if (!value.startsWith("https://")) {
          setError("Endpoint must start with https://");
          return;
        }
        setState(prev => ({ ...prev, azureEndpoint: value }));
        setStep("azure-key");
        setInputValue(state.azureKey ? "********" : "");
        break;

      case "azure-key":
        if (!value || value === "********") {
          if (!state.azureKey) {
            setError("API key is required");
            return;
          }
        } else {
          setState(prev => ({ ...prev, azureKey: value }));
        }
        setStep("azure-deployment");
        setInputValue(state.azureDeployment);
        break;

      case "azure-deployment":
        setState(prev => ({ ...prev, azureDeployment: value || "gpt-codex-5.2" }));
        setStep("working-dir");
        setInputValue(state.defaultWorkingDir);
        break;

      case "working-dir":
        setState(prev => ({ ...prev, defaultWorkingDir: value }));
        setStep("features");
        break;
    }
  }

  async function saveConfig(): Promise<void> {
    setSaving(true);
    
    try {
      const configDir = join(homedir(), ".sharkbait");
      await mkdir(configDir, { recursive: true });

      // Save config.json (without API key for security)
      const config = {
        azure: {
          endpoint: state.azureEndpoint,
          deployment: state.azureDeployment,
          apiVersion: "2024-10-21",
        },
        features: {
          beads: state.enableBeads,
          confirmDestructive: state.confirmDestructive,
        },
        paths: {
          defaultWorkingDir: state.defaultWorkingDir || null,
        },
        ui: {
          theme: "dark",
          showSpinner: true,
        },
      };

      await writeFile(
        join(configDir, "config.json"),
        JSON.stringify(config, null, 2)
      );

      // Save credentials to .env file
      const envContent = `# Sharkbait Azure OpenAI Configuration
# Generated by 'sharkbait setup' on ${new Date().toISOString()}

AZURE_OPENAI_ENDPOINT=${state.azureEndpoint}
AZURE_OPENAI_API_KEY=${state.azureKey}
AZURE_OPENAI_CODEX_DEPLOYMENT=${state.azureDeployment}
AZURE_OPENAI_API_VERSION=2024-10-21
`;

      await writeFile(join(configDir, ".env"), envContent);

      setStep("complete");
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  const configDir = join(homedir(), ".sharkbait");

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>
          {icons.shark} Sharkbait Setup Wizard
        </Text>
      </Box>

      {/* Welcome Step */}
      {step === "welcome" && (
        <Box flexDirection="column">
          <Text color={colors.text}>
            Welcome! This wizard will help you configure Sharkbait.
          </Text>
          <Text color={colors.textMuted}>
            {"\n"}Configuration will be saved to:
          </Text>
          <Text color={colors.primary}>{configDir}</Text>
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              Press <Text color={colors.success}>Enter</Text> to continue, <Text color={colors.warning}>ESC</Text> to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Azure Endpoint */}
      {step === "azure-endpoint" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Step 1/5: Azure OpenAI Endpoint</Text>
          <Text color={colors.textMuted}>
            Enter your Azure OpenAI resource endpoint URL
          </Text>
          <Text color={colors.textDim} italic>
            Example: https://your-resource.openai.azure.com
          </Text>
          <Box marginTop={1}>
            <Text color={colors.primary}>{">"} </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              placeholder="https://..."
            />
          </Box>
          {error && (
            <Text color={colors.error}>{icons.error} {error}</Text>
          )}
        </Box>
      )}

      {/* Azure Key */}
      {step === "azure-key" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Step 2/5: Azure OpenAI API Key</Text>
          <Text color={colors.textMuted}>
            Enter your Azure OpenAI API key
          </Text>
          <Text color={colors.textDim} italic>
            This will be stored in ~/.sharkbait/.env
          </Text>
          <Box marginTop={1}>
            <Text color={colors.primary}>{">"} </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              mask="*"
              placeholder="your-api-key"
            />
          </Box>
          {error && (
            <Text color={colors.error}>{icons.error} {error}</Text>
          )}
        </Box>
      )}

      {/* Azure Deployment */}
      {step === "azure-deployment" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Step 3/5: Model Deployment Name</Text>
          <Text color={colors.textMuted}>
            Enter your Azure OpenAI model deployment name
          </Text>
          <Text color={colors.textDim} italic>
            Default: gpt-codex-5.2
          </Text>
          <Box marginTop={1}>
            <Text color={colors.primary}>{">"} </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              placeholder="gpt-codex-5.2"
            />
          </Box>
        </Box>
      )}

      {/* Working Directory */}
      {step === "working-dir" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Step 4/5: Default Working Directory</Text>
          <Text color={colors.textMuted}>
            Set a default project directory (optional)
          </Text>
          <Text color={colors.textDim} italic>
            Leave empty to always use current directory
          </Text>
          <Box marginTop={1}>
            <Text color={colors.primary}>{">"} </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              placeholder="(press Enter to skip)"
            />
          </Box>
        </Box>
      )}

      {/* Features */}
      {step === "features" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Step 5/5: Features</Text>
          <Text color={colors.textMuted}>
            Toggle features with number keys, Enter to continue
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color={colors.primary}>[1]</Text>{" "}
              <Text color={state.enableBeads ? colors.success : colors.textDim}>
                {state.enableBeads ? icons.check : "○"} Beads Memory
              </Text>
              <Text color={colors.textDim}> - Git-backed task persistence</Text>
            </Text>
            <Text>
              <Text color={colors.primary}>[2]</Text>{" "}
              <Text color={state.confirmDestructive ? colors.success : colors.textDim}>
                {state.confirmDestructive ? icons.check : "○"} Confirm Destructive
              </Text>
              <Text color={colors.textDim}> - Require confirmation for risky commands</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              Press <Text color={colors.success}>Enter</Text> to continue
            </Text>
          </Box>
        </Box>
      )}

      {/* Confirm */}
      {step === "confirm" && (
        <Box flexDirection="column">
          <Text color={colors.text} bold>Review Configuration</Text>
          <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={2} paddingY={1}>
            <Text>
              <Text color={colors.textMuted}>Endpoint:</Text>{" "}
              <Text color={colors.text}>{state.azureEndpoint}</Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>API Key:</Text>{" "}
              <Text color={colors.text}>{"*".repeat(8)}</Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>Deployment:</Text>{" "}
              <Text color={colors.text}>{state.azureDeployment}</Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>Working Dir:</Text>{" "}
              <Text color={colors.text}>{state.defaultWorkingDir || "(current directory)"}</Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>Beads:</Text>{" "}
              <Text color={state.enableBeads ? colors.success : colors.textDim}>
                {state.enableBeads ? "enabled" : "disabled"}
              </Text>
            </Text>
            <Text>
              <Text color={colors.textMuted}>Confirm Destructive:</Text>{" "}
              <Text color={state.confirmDestructive ? colors.success : colors.textDim}>
                {state.confirmDestructive ? "enabled" : "disabled"}
              </Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              Save configuration? <Text color={colors.success}>[Y]es</Text> / <Text color={colors.error}>[N]o</Text>
            </Text>
          </Box>
          {saving && (
            <Text color={colors.primary}>Saving...</Text>
          )}
          {error && (
            <Text color={colors.error}>{icons.error} {error}</Text>
          )}
        </Box>
      )}

      {/* Complete */}
      {step === "complete" && (
        <Box flexDirection="column">
          <Text color={colors.success} bold>
            {icons.check} Setup Complete!
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={colors.textMuted}>Configuration saved to:</Text>
            <Text color={colors.text}>  {configDir}/config.json</Text>
            <Text color={colors.text}>  {configDir}/.env</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color={colors.textMuted}>To load credentials, either:</Text>
            <Text color={colors.text}>  • Source the env file: <Text color={colors.primary}>source ~/.sharkbait/.env</Text></Text>
            <Text color={colors.text}>  • Or copy to your project's .env file</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textMuted}>
              Run <Text color={colors.primary}>sharkbait</Text> to start chatting!
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textDim}>Press Enter to exit</Text>
          </Box>
        </Box>
      )}

      {/* Progress indicator */}
      {step !== "welcome" && step !== "complete" && (
        <Box marginTop={2}>
          <Text color={colors.textDim}>
            {["azure-endpoint", "azure-key", "azure-deployment", "working-dir", "features", "confirm"].map((s, i) => (
              <Text key={s} color={step === s ? colors.primary : colors.textDim}>
                {step === s ? "●" : "○"}{" "}
              </Text>
            ))}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export async function runSetup(): Promise<void> {
  const { waitUntilExit } = render(React.createElement(SetupWizard));
  await waitUntilExit();
}
