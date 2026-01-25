# Agent Orchestration - lk.housler.ru

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| security-reviewer | Security analysis | After writing auth/API code |
| code-reviewer | Code review | After any code changes |
| tdd-guide | Test-driven dev | New features, bug fixes |
| build-error-resolver | Fix build errors | When build fails |

## Automatic Agent Usage

No user prompt needed:

1. **Code written/modified** → Use **code-reviewer**
2. **Auth or API code** → Use **security-reviewer**
3. **New feature** → Use **tdd-guide**
4. **Build fails** → Use **build-error-resolver**

## Parallel Execution

For independent tasks, run agents in parallel:

```markdown
# Good: Parallel
Launch 2 agents in parallel:
1. Security review of auth.py
2. Code review of deals.py

# Bad: Sequential when unnecessary
First security review, then code review
```

## Security-First Rule

**ALWAYS** run security-reviewer before committing code that:
- Handles authentication
- Processes user input
- Accesses database
- Uses API tokens
- Handles PII
