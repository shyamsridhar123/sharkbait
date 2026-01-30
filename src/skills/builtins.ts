/**
 * Built-in Skills - Default domain knowledge modules
 */

import type { Skill } from "./registry";

/**
 * TypeScript/JavaScript coding standards
 */
export const codeStandardsSkill: Skill = {
  id: "code-standards-typescript",
  name: "TypeScript/JavaScript Code Standards",
  category: "code-standards",
  description: "Modern TypeScript and JavaScript coding conventions and best practices",
  languages: ["typescript", "javascript"],
  priority: 100,
  content: `
## Naming Conventions
- **Variables/Functions**: camelCase (e.g., \`getUserData\`, \`isValid\`)
- **Classes/Types/Interfaces**: PascalCase (e.g., \`UserService\`, \`ApiResponse\`)
- **Constants**: UPPER_SNAKE_CASE (e.g., \`MAX_RETRIES\`, \`API_URL\`)
- **Private members**: Prefix with underscore or use \`#\` (e.g., \`_internal\`, \`#private\`)
- **Boolean variables**: Prefix with is/has/can/should (e.g., \`isLoading\`, \`hasPermission\`)

## TypeScript Best Practices
- Prefer \`interface\` over \`type\` for object shapes
- Use \`unknown\` instead of \`any\` when type is truly unknown
- Prefer \`const\` assertions for literal types
- Use discriminated unions for state management
- Enable strict mode in tsconfig.json

## Function Guidelines
- Keep functions small and focused (single responsibility)
- Use descriptive parameter names
- Prefer explicit return types for public APIs
- Use async/await over raw promises
- Handle errors appropriately (try/catch or .catch())

## Import Organization
1. Node.js built-ins
2. External packages
3. Internal modules (absolute paths)
4. Relative imports

## Comments
- Write self-documenting code; comment "why" not "what"
- Use JSDoc for public APIs
- TODO comments should include context and owner
`,
  examples: [
    {
      scenario: "Naming a boolean variable",
      input: "active",
      output: "isActive",
    },
    {
      scenario: "Naming a class",
      input: "user_service",
      output: "UserService",
    },
  ],
};

/**
 * Testing best practices
 */
export const testingSkill: Skill = {
  id: "testing-patterns",
  name: "Testing Best Practices",
  category: "testing",
  description: "Unit testing patterns, TDD, and test organization",
  languages: ["typescript", "javascript"],
  priority: 90,
  content: `
## Test Structure (AAA Pattern)
\`\`\`typescript
describe("Component", () => {
  it("should do something specific", () => {
    // Arrange - set up test data and conditions
    const input = createTestInput();
    
    // Act - perform the action being tested
    const result = component.process(input);
    
    // Assert - verify the outcome
    expect(result).toBe(expected);
  });
});
\`\`\`

## Naming Conventions
- Test files: \`*.test.ts\` or \`*.spec.ts\`
- Describe blocks: Component or function name
- It blocks: "should [expected behavior] when [condition]"

## Best Practices
- Test behavior, not implementation
- One assertion per test (when practical)
- Use descriptive test names
- Avoid testing private methods directly
- Mock external dependencies
- Keep tests independent (no shared state)
- Use factories for test data

## Test Categories
- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user flows

## Coverage Goals
- Aim for 80%+ coverage on business logic
- Focus on critical paths and edge cases
- Don't chase 100% - diminishing returns
`,
  examples: [
    {
      scenario: "Naming a test case",
      input: "Test that login works",
      output: "should authenticate user when valid credentials provided",
    },
  ],
};

/**
 * Security best practices
 */
export const securitySkill: Skill = {
  id: "security-owasp",
  name: "Security Best Practices",
  category: "security",
  description: "OWASP Top 10 and secure coding practices",
  priority: 100,
  content: `
## OWASP Top 10 Prevention

### 1. Injection
- Use parameterized queries/prepared statements
- Validate and sanitize all input
- Use ORM with proper escaping

### 2. Broken Authentication
- Use secure session management
- Implement rate limiting
- Use bcrypt/argon2 for passwords
- Enforce strong password policies

### 3. Sensitive Data Exposure
- Never log sensitive data
- Encrypt data at rest and in transit
- Use environment variables for secrets
- Never commit secrets to git

### 4. XSS (Cross-Site Scripting)
- Escape output in templates
- Use Content Security Policy headers
- Sanitize HTML input
- Use textContent instead of innerHTML

### 5. Insecure Deserialization
- Validate and verify serialized data
- Use JSON instead of native serialization
- Implement integrity checks

## Secure Coding Checklist
- [ ] Input validation on all user data
- [ ] Output encoding for display
- [ ] Authentication on sensitive endpoints
- [ ] Authorization checks before operations
- [ ] HTTPS for all communications
- [ ] Security headers configured
- [ ] Dependencies regularly updated
- [ ] Secrets in environment variables
`,
};

/**
 * Performance optimization
 */
export const performanceSkill: Skill = {
  id: "performance-optimization",
  name: "Performance Optimization",
  category: "performance",
  description: "Performance patterns and optimization techniques",
  priority: 80,
  content: `
## Common Performance Issues

### N+1 Queries
- **Problem**: Loading related data in a loop
- **Solution**: Use eager loading, batch queries, or joins

### Memory Leaks
- **Problem**: Event listeners not removed, closures holding references
- **Solution**: Cleanup in useEffect returns, weak references

### Unnecessary Re-renders (React)
- **Problem**: Components re-render without prop changes
- **Solution**: React.memo, useMemo, useCallback

## Optimization Strategies

### Database
- Add indexes for frequently queried columns
- Use pagination for large result sets
- Cache frequently accessed data
- Optimize query patterns

### Frontend
- Code splitting and lazy loading
- Image optimization (WebP, lazy loading)
- Bundle size analysis and reduction
- Virtual scrolling for long lists

### Backend
- Connection pooling
- Response caching (Redis, CDN)
- Async processing for heavy tasks
- Horizontal scaling

## Profiling Tools
- Chrome DevTools Performance tab
- Node.js --inspect and --prof
- Database EXPLAIN plans
- Memory profilers

## Rules of Optimization
1. Don't optimize prematurely
2. Measure before and after
3. Focus on bottlenecks
4. Consider trade-offs (complexity vs. gain)
`,
};

/**
 * Architecture and design patterns
 */
export const architectureSkill: Skill = {
  id: "architecture-patterns",
  name: "Architecture & Design Patterns",
  category: "architecture",
  description: "Software architecture patterns and SOLID principles",
  priority: 85,
  content: `
## SOLID Principles

### S - Single Responsibility
Each class/module should have one reason to change.

### O - Open/Closed
Open for extension, closed for modification.

### L - Liskov Substitution
Subtypes must be substitutable for their base types.

### I - Interface Segregation
Many specific interfaces over one general-purpose interface.

### D - Dependency Inversion
Depend on abstractions, not concretions.

## Common Patterns

### Creational
- **Factory**: Create objects without specifying exact class
- **Builder**: Construct complex objects step by step
- **Singleton**: Single instance (use sparingly)

### Structural
- **Adapter**: Convert interface to another
- **Facade**: Simplified interface to complex subsystem
- **Decorator**: Add behavior dynamically

### Behavioral
- **Strategy**: Interchangeable algorithms
- **Observer**: Notify dependents of state changes
- **Command**: Encapsulate requests as objects

## Architecture Patterns
- **Layered**: Presentation → Business → Data
- **Clean Architecture**: Dependencies point inward
- **Event-Driven**: Loosely coupled via events
- **Microservices**: Independent, deployable services

## Decision Guidelines
- Start simple, evolve as needed
- Avoid over-engineering
- Document architectural decisions (ADRs)
- Consider team expertise
`,
};

/**
 * Documentation standards
 */
export const documentationSkill: Skill = {
  id: "documentation-standards",
  name: "Documentation Standards",
  category: "documentation",
  description: "Code documentation and JSDoc/TSDoc patterns",
  languages: ["typescript", "javascript"],
  priority: 70,
  content: `
## JSDoc/TSDoc Format

\`\`\`typescript
/**
 * Brief description of the function.
 * 
 * @param name - Description of the parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 * @example
 * const result = myFunction("input");
 */
function myFunction(name: string): Result {
  // ...
}
\`\`\`

## When to Document
- Public APIs (always)
- Complex algorithms (explain the "why")
- Non-obvious behavior
- Workarounds and their reasons
- Configuration options

## README Structure
1. Project name and description
2. Installation instructions
3. Quick start / usage example
4. Configuration options
5. API reference
6. Contributing guidelines
7. License

## Inline Comments
- Explain "why", not "what"
- Keep comments updated with code
- Remove commented-out code
- Use TODO/FIXME with context

## API Documentation
- Document all public methods
- Include usage examples
- Note breaking changes
- Version appropriately
`,
};

/**
 * Debugging strategies
 */
export const debuggingSkill: Skill = {
  id: "debugging-strategies",
  name: "Debugging Strategies",
  category: "debugging",
  description: "Systematic debugging approaches and tools",
  priority: 75,
  content: `
## Systematic Debugging Process

### 1. Reproduce
- Create minimal reproduction case
- Identify exact conditions
- Document steps to reproduce

### 2. Isolate
- Binary search to find the breaking change
- Remove components until bug disappears
- Check if issue is data or code related

### 3. Hypothesize
- Form theories about the cause
- Check assumptions
- Consider recent changes

### 4. Test
- Verify hypothesis with targeted tests
- Use debugger to trace execution
- Add logging at key points

### 5. Fix & Verify
- Make minimal change to fix
- Add regression test
- Verify fix in original context

## Common Bug Categories
- **Logic errors**: Wrong conditions, off-by-one
- **State issues**: Race conditions, stale state
- **Type errors**: Null/undefined, wrong types
- **Integration**: API mismatches, timing issues

## Debugging Tools
- **Breakpoints**: Pause execution, inspect state
- **Console.log**: Quick state inspection
- **Network tab**: API request/response
- **Memory profiler**: Leak detection
- **Git bisect**: Find breaking commit

## Rubber Duck Debugging
Explain the problem out loud, step by step.
Often reveals the issue during explanation.
`,
};

/**
 * Git workflow patterns
 */
export const gitWorkflowSkill: Skill = {
  id: "git-workflow-patterns",
  name: "Git Workflow Patterns",
  category: "git-workflow",
  description: "Git branching strategies and commit conventions",
  priority: 80,
  content: `
## Conventional Commits
Format: \`<type>(<scope>): <description>\`

Types:
- \`feat\`: New feature
- \`fix\`: Bug fix
- \`docs\`: Documentation
- \`style\`: Formatting (no code change)
- \`refactor\`: Code restructuring
- \`test\`: Adding tests
- \`chore\`: Maintenance tasks

Examples:
- \`feat(auth): add OAuth2 login support\`
- \`fix(api): handle null response from server\`

## Branch Naming
- \`feature/short-description\`
- \`fix/issue-number-description\`
- \`hotfix/critical-bug-name\`
- \`release/v1.2.0\`

## Git Flow
1. \`main\`: Production-ready code
2. \`develop\`: Integration branch
3. Feature branches from develop
4. Release branches for final testing
5. Hotfix branches from main

## Best Practices
- Commit early, commit often
- Write meaningful commit messages
- Squash WIP commits before merge
- Keep PRs focused and small
- Review your own PR before requesting review
- Rebase to keep history clean
`,
};

/**
 * API design best practices
 */
export const apiDesignSkill: Skill = {
  id: "api-design-rest",
  name: "API Design Best Practices",
  category: "api-design",
  description: "REST API design patterns and conventions",
  priority: 75,
  content: `
## REST Conventions

### HTTP Methods
- \`GET\`: Retrieve resource(s)
- \`POST\`: Create resource
- \`PUT\`: Replace resource
- \`PATCH\`: Partial update
- \`DELETE\`: Remove resource

### URL Structure
- Use nouns for resources: \`/users\`, \`/orders\`
- Use IDs for specific items: \`/users/123\`
- Nested resources: \`/users/123/orders\`
- Use query params for filtering: \`/users?status=active\`

### Status Codes
- \`200\`: Success
- \`201\`: Created
- \`204\`: No Content (DELETE success)
- \`400\`: Bad Request
- \`401\`: Unauthorized
- \`403\`: Forbidden
- \`404\`: Not Found
- \`500\`: Server Error

## Response Format
\`\`\`json
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 },
  "errors": []
}
\`\`\`

## Best Practices
- Version your API: \`/v1/users\`
- Use consistent naming
- Implement pagination for lists
- Return appropriate status codes
- Provide meaningful error messages
- Document with OpenAPI/Swagger
`,
};

/**
 * All built-in skills
 */
export const builtinSkills: Skill[] = [
  codeStandardsSkill,
  testingSkill,
  securitySkill,
  performanceSkill,
  architectureSkill,
  documentationSkill,
  debuggingSkill,
  gitWorkflowSkill,
  apiDesignSkill,
];
