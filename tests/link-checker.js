import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import markdownLinkCheck from 'markdown-link-check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  ignorePatterns: [
    { pattern: '^https://github.com/.+/commit/' },
    { pattern: '^https://.*\\.atlassian\\.net/' },
    { pattern: '^https://www\\.notion\\.so/' },
    { pattern: '^https://claude\\.ai/' },
    { pattern: '^file://' }
  ],
  timeout: '10s',
  retryOn429: true,
  retryCount: 2,
  fallbackRetryDelay: '5s'
};

const findMarkdownFiles = (dir) => {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage') {
        continue;
      }
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
};

const checkLinksInFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const markdown = fs.readFileSync(filePath, 'utf8');

    markdownLinkCheck(markdown, { ...config, baseUrl: `file://${path.dirname(filePath)}/` }, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      const deadLinks = results.filter(result => result.status === 'dead');
      resolve({ filePath, results, deadLinks });
    });
  });
};

const main = async () => {
  console.log('Checking links in markdown files...\n');

  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const rootReadme = path.join(__dirname, '..', 'README.md');
  const claudeMd = path.join(__dirname, '..', 'CLAUDE.md');

  const markdownFiles = [
    ...findMarkdownFiles(pluginsDir),
    rootReadme,
    claudeMd
  ].filter(f => fs.existsSync(f));

  console.log(`Found ${markdownFiles.length} markdown files to check.\n`);

  let hasErrors = false;
  const results = [];

  for (const file of markdownFiles) {
    const relativePath = path.relative(process.cwd(), file);
    process.stdout.write(`Checking ${relativePath}... `);

    try {
      const result = await checkLinksInFile(file);
      results.push(result);

      if (result.deadLinks.length > 0) {
        console.log(`Found ${result.deadLinks.length} dead link(s)`);
        hasErrors = true;

        result.deadLinks.forEach(link => {
          console.log(`  - ${link.link} (${link.statusCode || 'unreachable'})`);
        });
      } else {
        console.log('OK');
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\nSummary:');
  const totalFiles = results.length;
  const filesWithDeadLinks = results.filter(r => r.deadLinks.length > 0).length;
  const totalDeadLinks = results.reduce((sum, r) => sum + r.deadLinks.length, 0);

  console.log(`  Total files checked: ${totalFiles}`);
  console.log(`  Files with dead links: ${filesWithDeadLinks}`);
  console.log(`  Total dead links: ${totalDeadLinks}`);

  if (hasErrors) {
    console.log('\nLink check failed. Please fix the dead links above.');
    process.exit(1);
  } else {
    console.log('\nAll links are valid!');
    process.exit(0);
  }
};

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { findMarkdownFiles, checkLinksInFile };
