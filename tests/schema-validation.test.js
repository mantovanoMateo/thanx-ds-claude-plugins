import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Schema Validation', () => {
  const pluginsDir = path.join(__dirname, '..', 'plugins');

  describe('.mcp.json validation', () => {
    const findMcpJsonFiles = (dir) => {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') {
            continue;
          }
          files.push(...findMcpJsonFiles(fullPath));
        } else if (entry.isFile() && entry.name === '.mcp.json') {
          files.push(fullPath);
        }
      }

      return files;
    };

    const mcpJsonFiles = findMcpJsonFiles(pluginsDir);

    if (mcpJsonFiles.length > 0) {
      test.each(mcpJsonFiles)('%s should be valid JSON', (file) => {
        const content = fs.readFileSync(file, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
      });

      test.each(mcpJsonFiles)('%s should have valid MCP server configurations', (file) => {
        const content = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(content);

        const servers = json.mcpServers || json;

        expect(Object.keys(servers).length).toBeGreaterThan(0);

        for (const [serverName, config] of Object.entries(servers)) {
          if (config.type === 'sse' || config.type === 'http') {
            expect(config).toHaveProperty('url');
            expect(typeof config.url).toBe('string');
          } else {
            expect(config).toHaveProperty('command');
            expect(typeof config.command).toBe('string');

            if (config.args) {
              expect(Array.isArray(config.args)).toBe(true);
            }
          }

          if (config.env) {
            expect(typeof config.env).toBe('object');
          }
        }
      });
    }
  });

  describe('Command and Agent frontmatter validation', () => {
    const getPluginDirectories = () => {
      return fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
        .map(entry => path.join(pluginsDir, entry.name));
    };

    const findMarkdownFilesInDir = (dir, subdir) => {
      const targetDir = path.join(dir, subdir);
      if (!fs.existsSync(targetDir)) {
        return [];
      }

      return fs.readdirSync(targetDir)
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(targetDir, file));
    };

    const getAllCommandsAndAgents = () => {
      const files = [];
      const pluginDirs = getPluginDirectories();

      for (const pluginDir of pluginDirs) {
        files.push(...findMarkdownFilesInDir(pluginDir, 'commands'));
        files.push(...findMarkdownFilesInDir(pluginDir, 'agents'));
      }

      return files;
    };

    const commandsAndAgents = getAllCommandsAndAgents();

    if (commandsAndAgents.length > 0) {
      test.each(commandsAndAgents)('%s should have YAML frontmatter', (file) => {
        const content = fs.readFileSync(file, 'utf8');
        expect(content.startsWith('---\n')).toBe(true);

        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        expect(frontmatterMatch).not.toBeNull();
      });

      test.each(commandsAndAgents)('%s should have description in frontmatter', (file) => {
        const content = fs.readFileSync(file, 'utf8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          expect(frontmatter).toContain('description:');
        }
      });
    }
  });
});
