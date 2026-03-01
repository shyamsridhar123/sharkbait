# Azure Identity Migration Brainstorm

**Date:** 2026-03-01
**Status:** Decided

## What We're Building

Migrate Sharkbait's Azure OpenAI authentication from static API keys to Azure Identity (DefaultAzureCredential), with backward-compatible fallback to API keys.

## Why This Approach

- **Security**: API keys are static credentials that can leak. Azure Identity uses short-lived tokens rotated automatically.
- **Production readiness**: Managed identity in Azure deployments requires zero secrets management.
- **Developer experience**: DefaultAzureCredential auto-discovers credentials from Azure CLI, VS Code, environment — no manual key setup for developers already authenticated.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth strategy | Azure Identity first, API key fallback | Best of both worlds — modern auth primary, backward compat for existing users |
| `@azure/identity` | Required dependency | Simpler code, no lazy-loading complexity. ~2MB is acceptable. |
| Token provider | Use `azureADTokenProvider` option on `AzureOpenAI` constructor | Native SDK support, no custom HTTP header management needed |
| Config change | `apiKey` becomes optional in `LLMConfig` interface | Allows identity-only auth without requiring an empty string |
| Credential chain | `DefaultAzureCredential` | Automatically tries: env vars → managed identity → Azure CLI → VS Code → browser |

## Architecture

```
loadConfig()
    |
    ├── Has AZURE_OPENAI_API_KEY? ──→ Use API key auth (legacy path)
    |
    └── No API key? ──→ Create DefaultAzureCredential
                           |
                           └──→ azureADTokenProvider (scope: https://cognitiveservices.azure.com/.default)
                                   |
                                   └──→ AzureOpenAI SDK handles token refresh automatically
```

## Resolved Questions

- **Should we support both auth methods simultaneously?** Yes — Azure Identity first, API key as fallback.
- **Token caching?** The openai SDK + @azure/identity handle this internally. No custom caching needed.
- **Breaking change?** No — existing API key users will continue to work unchanged.
