# Contributing to PROCTOR-FORGE

Thank you for your interest in contributing to **PROCTOR-FORGE**! This project was built during a 24-hour hackathon by Team **Cyber Attack**.

## Development Workflow

1. **Branching Strategy:**
   - Feature branches: `feat/<feature-name>`
   - Bug fixes: `fix/<issue-name>`
   - Documentation: `docs/<topic>`

2. **Commit Convention:**
   We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   - `feat(scope): add new feature`
   - `fix(scope): resolve bug`
   - `test(scope): add automated unit test`
   - `docs(scope): update documentation`
   - `refactor(scope): internal restructuring`

3. **Pre-commit Checklist:**
   ```bash
   pnpm run typecheck
   pnpm run test
   pnpm run validate-bank
   ```

