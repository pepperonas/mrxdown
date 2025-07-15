#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const version = args[0];

if (!version) {
    console.error('Usage: node scripts/version.js <version>');
    console.error('Example: node scripts/version.js 1.0.1');
    process.exit(1);
}

// Validate version format
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(version)) {
    console.error('Invalid version format. Use semantic versioning: X.Y.Z');
    process.exit(1);
}

// Update package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Update about dialog in main.js
const mainJsPath = path.join(__dirname, '..', 'main.js');
let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
mainJsContent = mainJsContent.replace(
    /Version \d+\.\d+\.\d+/,
    `Version ${version}`
);
fs.writeFileSync(mainJsPath, mainJsContent);

// Update about dialog in index.html
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
indexHtmlContent = indexHtmlContent.replace(
    /<div class="modal-version">Version \d+\.\d+\.\d+<\/div>/,
    `<div class="modal-version">Version ${version}</div>`
);
fs.writeFileSync(indexHtmlPath, indexHtmlContent);

console.log(`✅ Version updated to ${version}`);
console.log('📝 Updated files:');
console.log('   - package.json');
console.log('   - main.js');
console.log('   - index.html');
console.log('');
console.log('📋 Next steps:');
console.log(`   1. Update CHANGELOG.md with changes for v${version}`);
console.log(`   2. Commit changes: git add . && git commit -m "chore: bump version to ${version}"`);
console.log(`   3. Create tag: git tag v${version}`);
console.log(`   4. Push changes: git push origin main --tags`);
console.log(`   5. Create release on GitHub or run: npm run release`);