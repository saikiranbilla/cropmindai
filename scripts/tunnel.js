import { spawn } from 'child_process'
import net       from 'net'

const PORT = 5173

function tryConnect(port, host) {
  return new Promise(resolve => {
    const s = new net.Socket()
    s.once('connect', () => { s.destroy(); resolve(true)  })
    s.once('error',   () => { s.destroy(); resolve(false) })
    s.connect(port, host)
  })
}

async function waitForPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await tryConnect(port, '127.0.0.1')) return true
    if (await tryConnect(port, '::1'))       return true
    await new Promise(r => setTimeout(r, 300))
  }
  return false
}

const ready = await waitForPort(PORT)
if (!ready) {
  console.error(`\n  ✗  Could not reach localhost:${PORT}\n`)
  process.exit(1)
}

console.log(`\n  ✔  Vite detected — connecting to serveo.net...`)

// Uses Windows built-in OpenSSH — no install or account needed
const ssh = spawn('ssh', [
  '-R', `80:localhost:${PORT}`,
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ExitOnForwardFailure=yes',
  'serveo.net'
], { stdio: ['ignore', 'pipe', 'pipe'] })

let printed = false

function findUrl(data) {
  if (printed) return
  const match = data.toString().match(/https:\/\/[^\s]+serveo\.net/)
  if (match) {
    console.log(`\n  🌐  Public URL: ${match[0]}`)
    console.log(`      Open on any device — no firewall rules needed.\n`)
    printed = true
  }
}

ssh.stdout.on('data', findUrl)
ssh.stderr.on('data', findUrl)
ssh.on('error', err => console.error(`\n  ✗  SSH error: ${err.message}`))
ssh.on('close', code => { if (code !== 0) console.error(`\n  Tunnel closed (code ${code}).`) })
