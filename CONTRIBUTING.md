# Contributing to ScreenKonect

Thank you for your interest in contributing to ScreenKonect! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup

```bash
# Install dependencies
make install

# Start development
make dev

# Run tests
make test

# Run linter
make lint

# Run type checker
make typecheck
```

## Code Style

### TypeScript
- Use strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add types for function parameters and return values
- Avoid `any` type

### Rust
- Use safe abstractions
- Avoid `unwrap()` in production code
- Use `thiserror` for error types
- Use `anyhow` for application errors
- Add documentation comments

### General
- Write self-documenting code
- Keep functions small and focused
- Follow existing patterns in the codebase
- Add tests for new functionality

## Commit Messages

Use conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Testing

- Write unit tests for new functions
- Write integration tests for new endpoints
- Test edge cases and error handling
- Ensure tests are deterministic

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Follow security best practices
- Report vulnerabilities responsibly (see SECURITY.md)

## Code Review

All submissions require review. We use GitHub pull requests. Provide:

- Clear description of changes
- Testing instructions
- Screenshots if applicable
- Related issue links

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
