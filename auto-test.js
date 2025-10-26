#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🚀 Starting Latentra Auto Test Suite...')

// Start the test peer
console.log('📡 Starting test peer...')
const testPeer = spawn('node', ['test-peer.cjs'], {
  cwd: __dirname,
  stdio: 'inherit'
})

// Handle cleanup
const cleanup = () => {
  console.log('\n🧹 Cleaning up...')
  testPeer.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

testPeer.on('error', (error) => {
  console.error('❌ Test peer error:', error)
})

testPeer.on('exit', (code) => {
  console.log(`📡 Test peer exited with code ${code}`)
})

console.log('✅ Auto test suite running!')
console.log('💡 The test peer is now discoverable as "Lenovo"')
console.log('🔍 Start discovery in the app to see the simulation')
console.log('⚡ Click on Lenovo devices to see combined VRAM')
console.log('🛑 Press Ctrl+C to stop')
