import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

const cargoBin = join(homedir(), '.cargo', 'bin')
const pathEnv = process.env.PATH ?? ''
const env = {
  ...process.env,
  PATH: pathEnv ? `${cargoBin}${delimiter}${pathEnv}` : cargoBin,
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('with-cargo-path: missing command')
  process.exit(1)
}

const [cmd, ...cmdArgs] = args
const shell = process.platform === 'win32'
const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', env, shell })
process.exit(r.status ?? 1)
