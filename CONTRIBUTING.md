# Contributing

Thanks for your interest in contributing to LinkCollector!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Commit: `git commit -m "feat: add your feature"`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

## Development Setup

```bash
# Clone
git clone https://github.com/your-username/link-collector.git
cd link-collector

# Install dependencies
cd worker && npm install
cd ../frontend && npm install

# Configure
cp worker/wrangler.toml.example worker/wrangler.toml
# Edit wrangler.toml with your keys

# Run
cd worker && npm run dev  # http://localhost:8787
cd frontend && npm run dev  # http://localhost:5173
```

Or use `dev.bat` on Windows for one-click startup.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` code style (formatting, missing semicolons, etc.)
- `refactor:` code refactoring without feature changes
- `test:` adding or updating tests
- `chore:` build process or auxiliary tool changes

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- Functional components with hooks
- Chinese comments are welcome

## Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation if needed
- Test your changes locally before submitting
- Describe what your PR does and why

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include browser/OS info if UI-related
- Screenshots welcome
