# Git Workflow - lk.housler.ru

## Commit Message Format

```
<type>: <description>

<optional body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Examples

```bash
feat: Add employee invitation API
fix: Rate limiting for OTP endpoint
refactor: Extract auth utils to separate module
docs: Update API documentation
test: Add tests for deal creation
```

## Branch Strategy

- `main` - production-ready code
- Feature branches from main
- PRs require review

## PR Workflow

1. Check all commits with `git diff main...HEAD`
2. Summarize ALL changes (not just latest commit)
3. Include test plan
4. Push with `-u` flag for new branches

## Before Commit

- [ ] Tests pass
- [ ] No console.log
- [ ] No hardcoded secrets
- [ ] Type check passes
- [ ] Lint passes

## Deploy

```bash
# Production
ssh -i ~/.ssh/id_housler root@95.163.227.26
cd /root/lk-housler && git pull && docker compose -f docker-compose.prod.yml up -d --build
```
