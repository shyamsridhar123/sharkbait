import { AzureOpenAI } from "openai";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env manually to support Node execution without Bun
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '..', '.env');
  
  if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      envConfig.split('\n').forEach(line => {
          const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
          if (match) {
              const key = match[1];
              const value = match[2] ? match[2].trim() : '';
              process.env[key] = value;
          }
      });
  }
} catch (e) {
  console.warn("Could not load .env file:", e);
}

const config = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
  apiKey: process.env.AZURE_OPENAI_API_KEY || "",
  deployment: process.env.AZURE_OPENAI_CODEX_DEPLOYMENT || "",
  apiVersion: "2025-03-01-preview",  // Responses API requires 2025-03-01-preview or later
};

console.log("Testing Azure OpenAI Codex Configuration:");
console.log(`Endpoint: ${config.endpoint}`);
console.log(`Deployment: ${config.deployment}`);
console.log(`API Version: ${config.apiVersion}`);

if (!config.endpoint || !config.apiKey || !config.deployment) {
  console.error("❌ Missing required environment variables!");
  process.exit(1);
}

const client = new AzureOpenAI({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    apiVersion: config.apiVersion,
});

async function run() {
  console.log("\nTesting Codex model with Responses API...");
  try {
    const response = await client.responses.create({
        model: config.deployment,
        input: "Write a TypeScript function that adds two numbers together.",
    });
    
    console.log("Response:");
    console.log(response.output_text);
    console.log("\n✅ Codex model test successful!");
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ Responses API failed:", error.message);
    
    // Try streaming version
    console.log("\nTrying streaming Responses API...");
    try {
        const stream = await client.responses.create({
            model: config.deployment,
            input: "Write a hello world function in TypeScript",
            stream: true
        });
        
        process.stdout.write("Response: ");
        for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
                process.stdout.write((event as any).delta || "");
            }
        }
        console.log("\n\n✅ Streaming Responses API successful!");
        process.exit(0);
    } catch (streamError: any) {
        console.error("\n❌ Streaming also failed:", streamError.message);
    }
    process.exit(1);
  }
}

run();
