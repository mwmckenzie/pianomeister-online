// PostToolUse hook: format + lint-fix the file Claude just edited,
// so formatting never depends on the model remembering to do it.
// Never blocks Claude: any failure exits 0.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

try {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const file = input?.tool_input?.file_path
  if (!file) process.exit(0)

  const normalized = file.replaceAll('\\', '/')
  if (/\/(node_modules|dist|\.idea)\//.test(normalized)) process.exit(0)

  const ext = path.extname(file)
  const prettierExts = ['.ts', '.vue', '.js', '.mjs', '.json', '.css', '.md', '.html']
  const eslintExts = ['.ts', '.vue', '.js', '.mjs']

  const run = (cmd) => {
    try {
      execSync(cmd, { stdio: 'ignore' })
    } catch {
      // Lint errors that can't be auto-fixed are caught by `npm run check`.
    }
  }

  if (prettierExts.includes(ext)) run(`npx prettier --write "${file}"`)
  if (eslintExts.includes(ext)) run(`npx eslint --fix "${file}"`)
} catch {
  // Malformed input — ignore.
}
process.exit(0)
