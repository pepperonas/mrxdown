# Contributing to MrxDown

Thank you for your interest in contributing to MrxDown! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/mrxdown.git
   cd mrxdown
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   npm start
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## 📋 How to Contribute

### Reporting Bugs

1. **Check existing issues** first to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Include steps to reproduce** the problem
4. **Add screenshots** if applicable
5. **Specify your environment** (OS, version, etc.)

### Suggesting Features

1. **Check the roadmap** in README.md
2. **Use the feature request template**
3. **Explain the use case** and expected behavior
4. **Consider backwards compatibility**

### Code Contributions

1. **Pick an issue** or create one for discussion
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following the coding standards
4. **Test thoroughly** on all platforms if possible
5. **Commit with clear messages**
   ```bash
   git commit -m "Add amazing feature for better UX"
   ```
6. **Push and create a pull request**
   ```bash
   git push origin feature/amazing-feature
   ```

## 🎨 Coding Standards

### Code Style

- **Follow existing patterns** in the codebase
- **Use meaningful variable names**
- **Keep functions focused** and single-purpose
- **Add comments** for complex logic
- **Use consistent indentation** (2 spaces)

### File Structure

```
mrxdown/
├── main.js           # Electron main process
├── preload.js        # Secure IPC bridge
├── index.html        # UI structure
├── renderer.js       # Frontend logic
├── assets/           # Icons, images, etc.
├── .github/          # GitHub workflows
└── docs/             # Documentation
```

### CSS Guidelines

- **Use CSS custom properties** for theming
- **Follow BEM methodology** for class names
- **Keep styles modular** and reusable
- **Use semantic HTML** elements
- **Ensure responsive design**

### JavaScript Guidelines

- **Use ES6+ features**
- **Prefer const/let** over var
- **Use arrow functions** where appropriate
- **Handle errors gracefully**
- **Avoid global variables**

## 🧪 Testing

### Manual Testing

1. **Test all features** thoroughly
2. **Check different file types** (.md, .txt, .markdown)
3. **Test keyboard shortcuts**
4. **Verify drag & drop functionality**
5. **Test export functions**

### Platform Testing

- **macOS**: Test on both Intel and Apple Silicon
- **Windows**: Test on Windows 10 and 11
- **Linux**: Test on Ubuntu/Debian and other distributions

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] All features work as expected
- [ ] No console errors or warnings
- [ ] Responsive design works on different screen sizes
- [ ] Accessibility considerations are met
- [ ] Performance is not negatively impacted

## 📝 Pull Request Process

1. **Update documentation** if needed
2. **Add entry to CHANGELOG.md**
3. **Fill out the PR template**
4. **Link related issues**
5. **Request review** from maintainers
6. **Address feedback** promptly

### PR Title Format

```
type(scope): description

Examples:
feat(editor): add syntax highlighting
fix(toolbar): resolve button alignment issue
docs(readme): update installation instructions
```

## 🎯 Types of Contributions

### 🐛 Bug Fixes
- Fix existing functionality
- Improve error handling
- Performance optimizations

### ✨ New Features
- New editor features
- UI improvements
- Export formats
- Keyboard shortcuts

### 📚 Documentation
- README improvements
- Code comments
- API documentation
- Tutorial content

### 🎨 Design
- UI/UX improvements
- Icon design
- Theme development
- Accessibility enhancements

## 🔧 Development Guidelines

### Adding New Features

1. **Discuss the feature** in an issue first
2. **Keep changes focused** and atomic
3. **Update relevant documentation**
4. **Add keyboard shortcuts** if applicable
5. **Ensure cross-platform compatibility**

### Code Architecture

- **Main Process**: Handle system integration
- **Renderer Process**: Handle UI and user interactions
- **Preload Script**: Secure IPC communication
- **Keep security in mind** always

### Performance Considerations

- **Optimize large file handling**
- **Minimize main thread blocking**
- **Use efficient DOM operations**
- **Consider memory usage**

## 🔒 Security

### Reporting Security Issues

**Do not open public issues** for security vulnerabilities. Instead:

1. **Email**: security@mrxdown.com
2. **Include detailed description**
3. **Provide steps to reproduce**
4. **Allow time for patch development**

### Security Best Practices

- **Use secure IPC communication**
- **Validate all input**
- **Avoid eval() and similar functions**
- **Keep dependencies updated**
- **Follow Electron security guidelines**

## 📞 Communication

### Getting Help

- **GitHub Issues**: Technical questions
- **GitHub Discussions**: General discussions
- **Email**: contrib@mrxdown.com

### Community Guidelines

- **Be respectful** and constructive
- **Help others** in the community
- **Follow the Code of Conduct**
- **Keep discussions relevant**

## 📜 License

By contributing to MrxDown, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be:
- **Listed in CONTRIBUTORS.md**
- **Mentioned in release notes**
- **Credited in about dialog**

---

**Thank you for helping make MrxDown better!** 🚀

For questions about contributing, please open an issue or contact us at contrib@mrxdown.com.