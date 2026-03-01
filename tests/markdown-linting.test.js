import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Markdown Linting', () => {
  const pluginsDir = path.join(__dirname, '..', 'plugins');

  const findMarkdownFiles = (dir) => {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || (entry.name.startsWith('.') && entry.name !== '.claude-plugin')) {
          continue;
        }
        files.push(...findMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  };

  const markdownFiles = findMarkdownFiles(pluginsDir);

  test('should find markdown files in plugins directory', () => {
    expect(markdownFiles.length).toBeGreaterThan(0);
  });

  test.each(markdownFiles)('%s should have valid markdown structure', (file) => {
    const content = fs.readFileSync(file, 'utf8');

    expect(content).not.toBe('');
    expect(content.length).toBeGreaterThan(0);
  });

  test.each(markdownFiles)('%s should have proper frontmatter if it is a command or agent', (file) => {
    const content = fs.readFileSync(file, 'utf8');
    const isCommandOrAgent = file.includes('/commands/') || file.includes('/agents/');

    if (isCommandOrAgent) {
      const hasFrontmatter = content.startsWith('---\n');
      expect(hasFrontmatter).toBe(true);

      if (hasFrontmatter) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        expect(frontmatterMatch).not.toBeNull();

        const frontmatter = frontmatterMatch[1];
        expect(frontmatter).toContain('description:');
      }
    }
  });

  test.each(markdownFiles)('%s should have a title (# heading)', (file) => {
    const content = fs.readFileSync(file, 'utf8');

    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    const hasTitle = /^#\s+.+/m.test(contentWithoutFrontmatter);
    expect(hasTitle).toBe(true);
  });

  test.each(markdownFiles)('%s should not have trailing whitespace', (file) => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    const linesWithTrailingWhitespace = lines
      .map((line, idx) => ({ line: idx + 1, content: line }))
      .filter(({ content }) => /\s+$/.test(content) && content.trim() !== '');

    expect(linesWithTrailingWhitespace.length).toBe(0);
  });

  test.each(markdownFiles)('%s should not have multiple consecutive blank lines', (file) => {
    const content = fs.readFileSync(file, 'utf8');
    const hasMultipleBlankLines = /\n\n\n+/.test(content);

    expect(hasMultipleBlankLines).toBe(false);
  });
});
