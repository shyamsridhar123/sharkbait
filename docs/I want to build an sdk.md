<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I want to build an sdk

Based on the latest research, here's a comprehensive guide to building an SDK for your custom coding agent:

## Building a Coding Agent SDK: Complete Architecture Guide

### SDK Design Philosophy

Your SDK should follow the **GitHub Copilot SDK architecture pattern** - expose a clean client interface that communicates with your agent runtime via JSON-RPC, handling orchestration, streaming, and tool invocation automatically.[^1]

### Core Architecture

```
Developer's Application
         ↓
    Your SDK Client
         ↓ (JSON-RPC / REST)
    Agent Runtime Server
         ↓
  Azure OpenAI GPT-5.1 Codex Max
```


### Multi-Language Support

Build SDKs for the four most popular languages:[^1]

1. **Python** - `pip install your-coding-agent-sdk`
2. **TypeScript/Node.js** - `npm install @yourorg/coding-agent-sdk`
3. **Go** - `go get github.com/yourorg/coding-agent-sdk`
4. **.NET** - `dotnet add package YourOrg.CodingAgent.SDK`

***

## 1. Python SDK Implementation

### Project Structure

```
coding-agent-sdk-python/
├── src/
│   └── coding_agent/
│       ├── __init__.py
│       ├── client.py           # Main SDK client
│       ├── models.py           # Pydantic data models
│       ├── agents.py           # Agent management
│       ├── sessions.py         # Session handling
│       ├── tools.py            # Tool definitions
│       ├── streaming.py        # Streaming responses
│       ├── exceptions.py       # Custom exceptions
│       └── utils/
│           ├── auth.py         # Authentication
│           ├── retry.py        # Retry logic
│           └── validation.py   # Input validation
├── tests/
├── examples/
├── docs/
├── pyproject.toml
└── README.md
```


### Core Client Implementation

```python
# src/coding_agent/client.py
from typing import Optional, List, Dict, Any, AsyncIterator
import httpx
from pydantic import BaseModel, Field
from .models import AgentConfig, SessionConfig, ToolDefinition
from .exceptions import AgentError, AuthenticationError
from .utils.retry import with_retry
from .utils.auth import AuthProvider

class CodingAgentClient:
    """
    Main SDK client for interacting with the coding agent.
    
    Example:
        ```python
        client = CodingAgentClient(
            api_key="your-key",
            endpoint="https://your-agent.api.com"
        )
        
        agent = client.agents.create(
            model="gpt-5.1-codex-max",
            instructions="You are an expert Python developer"
        )
        
        response = await client.sessions.run(
            agent_id=agent.id,
            prompt="Refactor this code to use async/await"
        )
        ```
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        azure_endpoint: Optional[str] = None,
        azure_deployment: Optional[str] = None,
        timeout: int = 300,
        max_retries: int = 3,
        **kwargs
    ):
        self.auth = AuthProvider(api_key=api_key, **kwargs)
        self.endpoint = endpoint or azure_endpoint
        self.deployment = azure_deployment
        
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers=self._build_headers()
        )
        
        # Initialize sub-clients
        self.agents = AgentClient(self)
        self.sessions = SessionClient(self)
        self.tools = ToolClient(self)
        
    def _build_headers(self) -> Dict[str, str]:
        """Build request headers with authentication"""
        return {
            "Authorization": f"Bearer {self.auth.get_token()}",
            "Content-Type": "application/json",
            "User-Agent": "coding-agent-sdk-python/1.0.0"
        }
    
    @with_retry(max_attempts=3, backoff_factor=2)
    async def _request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic"""
        url = f"{self.endpoint}/{path}"
        
        try:
            response = await self._client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise AuthenticationError("Invalid API key")
            raise AgentError(f"Request failed: {e}")
    
    async def close(self):
        """Close the HTTP client"""
        await self._client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, *args):
        await self.close()
```


### Agent Management

```python
# src/coding_agent/agents.py
from typing import List, Optional
from pydantic import BaseModel
from .models import Agent, AgentConfig, ToolDefinition

class AgentClient:
    """Manage coding agents"""
    
    def __init__(self, client):
        self._client = client
    
    async def create(
        self,
        model: str = "gpt-5.1-codex-max",
        name: Optional[str] = None,
        instructions: Optional[str] = None,
        tools: Optional[List[ToolDefinition]] = None,
        temperature: float = 0.7,
        **kwargs
    ) -> Agent:
        """
        Create a new coding agent.
        
        Args:
            model: Model to use (default: gpt-5.1-codex-max)
            name: Agent name for identification
            instructions: System instructions for the agent
            tools: List of tools the agent can use
            temperature: Sampling temperature (0-1)
            
        Returns:
            Agent instance with unique ID
            
        Example:
            ```python
            agent = await client.agents.create(
                model="gpt-5.1-codex-max",
                name="python-refactor-agent",
                instructions="Expert at Python code refactoring",
                tools=[
                    CodeInterpreterTool(),
                    FileSearchTool()
                ]
            )
            ```
        """
        payload = {
            "model": model,
            "name": name,
            "instructions": instructions or self._default_instructions(),
            "tools": [t.dict() for t in (tools or [])],
            "temperature": temperature,
            **kwargs
        }
        
        response = await self._client._request(
            "POST",
            "agents",
            json=payload
        )
        
        return Agent(**response)
    
    async def get(self, agent_id: str) -> Agent:
        """Retrieve agent by ID"""
        response = await self._client._request(
            "GET",
            f"agents/{agent_id}"
        )
        return Agent(**response)
    
    async def list(self, limit: int = 20) -> List[Agent]:
        """List all agents"""
        response = await self._client._request(
            "GET",
            "agents",
            params={"limit": limit}
        )
        return [Agent(**a) for a in response["data"]]
    
    async def delete(self, agent_id: str) -> bool:
        """Delete an agent"""
        await self._client._request(
            "DELETE",
            f"agents/{agent_id}"
        )
        return True
    
    def _default_instructions(self) -> str:
        return """You are an expert software engineer specializing in code generation,
refactoring, and debugging. You write clean, maintainable, well-tested code
following industry best practices."""
```


### Session Management with Streaming

```python
# src/coding_agent/sessions.py
from typing import AsyncIterator, Optional, Dict, Any
from .models import Message, RunStatus, StreamEvent
from .streaming import StreamHandler

class SessionClient:
    """Manage agent sessions and conversations"""
    
    def __init__(self, client):
        self._client = client
    
    async def create_session(
        self,
        agent_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new session"""
        payload = {
            "agent_id": agent_id,
            "context": context or {}
        }
        
        response = await self._client._request(
            "POST",
            "sessions",
            json=payload
        )
        
        return response["session_id"]
    
    async def send_message(
        self,
        session_id: str,
        content: str,
        role: str = "user"
    ) -> Message:
        """Send a message to the session"""
        payload = {
            "role": role,
            "content": content
        }
        
        response = await self._client._request(
            "POST",
            f"sessions/{session_id}/messages",
            json=payload
        )
        
        return Message(**response)
    
    async def run(
        self,
        session_id: str,
        agent_id: Optional[str] = None,
        additional_instructions: Optional[str] = None
    ) -> RunStatus:
        """Execute agent on session (non-streaming)"""
        payload = {
            "agent_id": agent_id,
            "additional_instructions": additional_instructions
        }
        
        response = await self._client._request(
            "POST",
            f"sessions/{session_id}/runs",
            json=payload
        )
        
        return RunStatus(**response)
    
    async def stream(
        self,
        session_id: str,
        agent_id: Optional[str] = None,
        additional_instructions: Optional[str] = None
    ) -> AsyncIterator[StreamEvent]:
        """
        Execute agent with streaming responses.
        
        Example:
            ```python
            async for event in client.sessions.stream(session_id):
                if event.type == "message.delta":
                    print(event.content, end="", flush=True)
                elif event.type == "tool.call":
                    print(f"\\n[Tool: {event.tool_name}]")
                elif event.type == "message.complete":
                    print("\\nDone!")
            ```
        """
        payload = {
            "agent_id": agent_id,
            "additional_instructions": additional_instructions,
            "stream": True
        }
        
        async with self._client._client.stream(
            "POST",
            f"{self._client.endpoint}/sessions/{session_id}/runs",
            json=payload,
            headers=self._client._build_headers()
        ) as response:
            handler = StreamHandler()
            async for event in handler.parse_stream(response):
                yield event
```


### Pydantic Models

```python
# src/coding_agent/models.py
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class ToolDefinition(BaseModel):
    """Tool that agents can use"""
    type: str
    function: Optional[Dict[str, Any]] = None

class Agent(BaseModel):
    """Agent instance"""
    id: str
    model: str
    name: Optional[str] = None
    instructions: str
    tools: List[ToolDefinition] = []
    created_at: datetime

class Message(BaseModel):
    """Chat message"""
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime

class RunStatus(BaseModel):
    """Status of an agent run"""
    id: str
    status: Literal["queued", "in_progress", "completed", "failed"]
    session_id: str
    agent_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

class StreamEvent(BaseModel):
    """Streaming event"""
    type: str
    content: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = {}
```


### Retry Logic

```python
# src/coding_agent/utils/retry.py
import asyncio
from functools import wraps
from typing import Callable, TypeVar, Any

T = TypeVar('T')

def with_retry(
    max_attempts: int = 3,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """Decorator for retry logic with exponential backoff"""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            attempt = 0
            while attempt < max_attempts:
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    attempt += 1
                    if attempt >= max_attempts:
                        raise
                    
                    wait_time = backoff_factor ** attempt
                    await asyncio.sleep(wait_time)
            
        return wrapper
    return decorator
```


***

## 2. TypeScript/Node.js SDK Implementation

### Project Structure

```
coding-agent-sdk-typescript/
├── src/
│   ├── index.ts              # Main exports
│   ├── client.ts             # Core client
│   ├── agents.ts             # Agent management
│   ├── sessions.ts           # Session handling
│   ├── tools.ts              # Tool definitions
│   ├── streaming.ts          # Stream handling
│   ├── types.ts              # TypeScript types
│   └── utils/
│       ├── auth.ts
│       └── retry.ts
├── tests/
├── examples/
├── package.json
├── tsconfig.json
└── README.md
```


### Core Client

```typescript
// src/client.ts
import axios, { AxiosInstance } from 'axios';
import { AgentClient } from './agents';
import { SessionClient } from './sessions';
import { ToolClient } from './tools';

export interface ClientConfig {
  apiKey?: string;
  endpoint?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  timeout?: number;
  maxRetries?: number;
}

export class CodingAgentClient {
  private httpClient: AxiosInstance;
  public agents: AgentClient;
  public sessions: SessionClient;
  public tools: ToolClient;

  /**
   * Create a new coding agent client
   * 
   * @example
   * ```typescript
   * const client = new CodingAgentClient({
   *   apiKey: process.env.AGENT_API_KEY,
   *   endpoint: 'https://your-agent.api.com'
   * });
   * 
   * const agent = await client.agents.create({
   *   model: 'gpt-5.1-codex-max',
   *   instructions: 'You are an expert TypeScript developer'
   * });
   * ```
   */
  constructor(config: ClientConfig) {
    this.httpClient = axios.create({
      baseURL: config.endpoint || config.azureEndpoint,
      timeout: config.timeout || 300000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'coding-agent-sdk-typescript/1.0.0'
      }
    });

    // Initialize sub-clients
    this.agents = new AgentClient(this.httpClient);
    this.sessions = new SessionClient(this.httpClient);
    this.tools = new ToolClient(this.httpClient);
  }

  /**
   * Test the connection to the agent service
   */
  async ping(): Promise<boolean> {
    try {
      await this.httpClient.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}
```


### Agent Management

```typescript
// src/agents.ts
import { AxiosInstance } from 'axios';
import { Agent, AgentConfig, ToolDefinition } from './types';

export class AgentClient {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Create a new coding agent
   */
  async create(config: AgentConfig): Promise<Agent> {
    const response = await this.httpClient.post<Agent>('/agents', {
      model: config.model || 'gpt-5.1-codex-max',
      name: config.name,
      instructions: config.instructions || this.defaultInstructions(),
      tools: config.tools || [],
      temperature: config.temperature || 0.7
    });

    return response.data;
  }

  /**
   * Get agent by ID
   */
  async get(agentId: string): Promise<Agent> {
    const response = await this.httpClient.get<Agent>(`/agents/${agentId}`);
    return response.data;
  }

  /**
   * List all agents
   */
  async list(limit: number = 20): Promise<Agent[]> {
    const response = await this.httpClient.get<{ data: Agent[] }>('/agents', {
      params: { limit }
    });
    return response.data.data;
  }

  /**
   * Delete an agent
   */
  async delete(agentId: string): Promise<void> {
    await this.httpClient.delete(`/agents/${agentId}`);
  }

  private defaultInstructions(): string {
    return `You are an expert software engineer specializing in code generation,
refactoring, and debugging. You write clean, maintainable, well-tested code
following industry best practices.`;
  }
}
```


### TypeScript Types

```typescript
// src/types.ts
export interface Agent {
  id: string;
  model: string;
  name?: string;
  instructions: string;
  tools: ToolDefinition[];
  createdAt: Date;
}

export interface AgentConfig {
  model?: string;
  name?: string;
  instructions?: string;
  tools?: ToolDefinition[];
  temperature?: number;
}

export interface ToolDefinition {
  type: string;
  function?: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface RunStatus {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  sessionId: string;
  agentId: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type StreamEvent = 
  | { type: 'message.delta'; content: string }
  | { type: 'tool.call'; toolName: string; toolInput: any }
  | { type: 'message.complete' };
```


### Streaming Support

```typescript
// src/streaming.ts
import { AxiosInstance } from 'axios';
import { StreamEvent } from './types';

export class SessionClient {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Stream agent responses
   * 
   * @example
   * ```typescript
   * for await (const event of client.sessions.stream(sessionId)) {
   *   if (event.type === 'message.delta') {
   *     process.stdout.write(event.content);
   *   } else if (event.type === 'tool.call') {
   *     console.log(`\n[Tool: ${event.toolName}]`);
   *   }
   * }
   * ```
   */
  async *stream(
    sessionId: string,
    options?: {
      agentId?: string;
      additionalInstructions?: string;
    }
  ): AsyncGenerator<StreamEvent> {
    const response = await this.httpClient.post(
      `/sessions/${sessionId}/runs`,
      {
        agent_id: options?.agentId,
        additional_instructions: options?.additionalInstructions,
        stream: true
      },
      {
        responseType: 'stream'
      }
    );

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean);
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          yield this.parseStreamEvent(data);
        }
      }
    }
  }

  private parseStreamEvent(data: any): StreamEvent {
    // Parse server-sent events into StreamEvent types
    return data as StreamEvent;
  }
}
```


***

## 3. SDK Best Practices

### Documentation[^2][^3]

```python
# Include comprehensive docstrings
def create_agent(
    self,
    model: str = "gpt-5.1-codex-max",
    instructions: Optional[str] = None
) -> Agent:
    """
    Create a new coding agent with custom configuration.
    
    This method initializes an agent instance that can be used for
    code generation, refactoring, debugging, and other software
    engineering tasks.
    
    Args:
        model: The AI model to use. Supported models:
            - gpt-5.1-codex-max: Best for complex, long-running tasks
            - gpt-5.1-codex: Standard coding tasks
            - gpt-5.1-codex-mini: Quick iterations and simple fixes
        instructions: System-level instructions that define the agent's
            behavior, personality, and expertise. If not provided, uses
            a default software engineering persona.
    
    Returns:
        Agent: A configured agent instance with a unique ID that can
            be used for subsequent operations.
    
    Raises:
        AuthenticationError: If API credentials are invalid
        ValidationError: If configuration parameters are invalid
        AgentError: If agent creation fails
    
    Example:
        Basic usage:
        ```python
        agent = client.agents.create(
            model="gpt-5.1-codex-max",
            instructions="Expert Python developer specializing in FastAPI"
        )
        print(f"Created agent: {agent.id}")
        ```
        
        With custom tools:
        ```python
        agent = client.agents.create(
            model="gpt-5.1-codex-max",
            instructions="Code review specialist",
            tools=[
                CodeInterpreterTool(),
                CustomLinterTool()
            ]
        )
        ```
    
    See Also:
        - agents.get(): Retrieve an existing agent
        - agents.list(): List all available agents
        - agents.delete(): Remove an agent
    """
```


### Error Handling[^2]

```python
# src/coding_agent/exceptions.py
class AgentError(Exception):
    """Base exception for agent SDK"""
    pass

class AuthenticationError(AgentError):
    """Raised when authentication fails"""
    pass

class ValidationError(AgentError):
    """Raised when input validation fails"""
    pass

class RateLimitError(AgentError):
    """Raised when rate limit is exceeded"""
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after}s")

class TimeoutError(AgentError):
    """Raised when request times out"""
    pass

# Usage in SDK
try:
    agent = await client.agents.create(model="invalid-model")
except ValidationError as e:
    print(f"Invalid configuration: {e}")
except AuthenticationError:
    print("Check your API key")
except RateLimitError as e:
    print(f"Rate limited, wait {e.retry_after} seconds")
```


### Configuration Management[^3]

```python
# Support multiple configuration methods

# 1. Environment variables
client = CodingAgentClient()  # Reads from env

# 2. Direct parameters
client = CodingAgentClient(
    api_key="key",
    endpoint="https://api.example.com"
)

# 3. Configuration file
import yaml
with open("config.yaml") as f:
    config = yaml.safe_load(f)
client = CodingAgentClient(**config)

# 4. Azure-specific
client = CodingAgentClient(
    azure_endpoint="https://resource.openai.azure.com",
    azure_deployment="gpt-5-1-codex-max",
    azure_ad_token_provider=get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default"
    )
)
```


### Modular Design[^4][^2]

```python
# Allow selective imports to reduce bloat
from coding_agent import CodingAgentClient  # Full client
from coding_agent.agents import AgentClient  # Just agents
from coding_agent.tools import CodeInterpreterTool  # Specific tools

# Tree-shaking style
from coding_agent import (
    CodingAgentClient,
    StreamEvent,
    AgentConfig
)
```


### Testing Support

```python
# src/coding_agent/testing.py
class MockCodingAgentClient:
    """Mock client for testing"""
    def __init__(self):
        self.agents = MockAgentClient()
        self.sessions = MockSessionClient()
    
# Allow dependency injection
class MyApp:
    def __init__(self, client: CodingAgentClient):
        self.client = client
    
# Testing
def test_my_app():
    mock_client = MockCodingAgentClient()
    app = MyApp(mock_client)
    # Test with mock
```


***

## 4. Distribution \& Packaging

### Python (PyPI)

```toml
# pyproject.toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "coding-agent-sdk"
version = "1.0.0"
description = "SDK for building with coding agents"
authors = [{name = "Your Name", email = "you@example.com"}]
readme = "README.md"
requires-python = ">=3.9"
dependencies = [
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
    "tenacity>=8.0.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "black>=24.0.0",
    "mypy>=1.8.0"
]

[project.urls]
Homepage = "https://github.com/yourorg/coding-agent-sdk"
Documentation = "https://docs.yourcodingagent.com"
```


### TypeScript (NPM)

```json
// package.json
{
  "name": "@yourorg/coding-agent-sdk",
  "version": "1.0.0",
  "description": "SDK for building with coding agents",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  },
  "files": [
    "dist"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/coding-agent-sdk"
  }
}
```


***

## 5. Advanced Features

### Context Compaction Support

```python
class SessionClient:
    async def compact_context(self, session_id: str) -> Dict[str, Any]:
        """
        Trigger context compaction for long-running sessions.
        GPT-5.1 Codex Max automatically compacts context to handle
        millions of tokens efficiently.
        """
        response = await self._client._request(
            "POST",
            f"sessions/{session_id}/compact"
        )
        return response
```


### Multi-Model Routing

```python
class SmartAgentClient:
    """Agent client with intelligent model routing"""
    
    MODEL_ROUTING = {
        "complex": "gpt-5.1-codex-max",
        "standard": "gpt-5.1-codex",
        "quick": "gpt-5.1-codex-mini"
    }
    
    async def smart_create(
        self,
        complexity: Literal["complex", "standard", "quick"],
        **kwargs
    ) -> Agent:
        """Create agent with automatic model selection"""
        model = self.MODEL_ROUTING[complexity]
        return await self.create(model=model, **kwargs)
```


### Middleware Support

```python
from typing import Callable, Awaitable

Middleware = Callable[[Dict], Awaitable[Dict]]

class CodingAgentClient:
    def __init__(self, **kwargs):
        self.middlewares: List[Middleware] = []
    
    def use(self, middleware: Middleware):
        """Add middleware for request/response processing"""
        self.middlewares.append(middleware)
    
    async def _execute_middlewares(self, data: Dict) -> Dict:
        for middleware in self.middlewares:
            data = await middleware(data)
        return data

# Usage
async def logging_middleware(data: Dict) -> Dict:
    print(f"Request: {data}")
    return data

client.use(logging_middleware)
```


***

This SDK architecture gives you a production-ready foundation for building on top of your coding agent, with clean APIs, comprehensive error handling, streaming support, and the flexibility to extend with custom functionality. The multi-language approach ensures maximum adoption across developer ecosystems.[^2][^1]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/github/copilot-sdk

[^2]: https://www.devprojournal.com/technology-trends/integration/sdk-creation-best-practices-empowering-developers-to-succeed/

[^3]: https://auth0.com/blog/guiding-principles-for-building-sdks/

[^4]: https://vineeth.io/posts/sdk-development

[^5]: https://www.linkedin.com/posts/satyanadella_build-an-agent-into-any-app-with-the-github-activity-7420126187286568961-TdW7

[^6]: https://refactoring.guru/design-patterns/typescript

[^7]: https://liblab.com/blog/how-to-build-an-sdk

[^8]: https://www.beyondcloudwithchriz.com/post/building-agents-with-github-copilot-sdk-a-practical-guide-to-automated-tech-update-tracking

[^9]: https://www.stainless.com/mcp/mcp-sdk-comparison-python-vs-typescript-vs-go-implementations

[^10]: https://www.speakeasy.com/blog/sdk-best-practices

[^11]: https://www.youtube.com/watch?v=GsEPS1yHaHQ

[^12]: https://www.linkedin.com/posts/meri-nova_12-agentic-design-patterns-every-ai-engineer-activity-7341909405757558784-4vW1

[^13]: https://newsletter.pragmaticengineer.com/p/building-great-sdks

[^14]: https://www.youtube.com/watch?v=ZGo362en01M

[^15]: https://github.com/arunpshankar/Python-Design-Patterns-for-AI

