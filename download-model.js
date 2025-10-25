#!/usr/bin/env node

import { execSync } from 'child_process'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const modelDir = join(homedir(), 'Library', 'Application Support', 'latentra', 'models')

console.log('Creating models directory...')
mkdirSync(modelDir, { recursive: true })

console.log('Downloading TinyLlama model (this may take a few minutes)...')
console.log('Model will be saved to:', modelDir)

try {
  // Download a small model for testing
  const modelUrl = 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
  const modelPath = join(modelDir, 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf')
  
  console.log('Downloading from:', modelUrl)
  execSync(`curl -L "${modelUrl}" -o "${modelPath}"`, { stdio: 'inherit' })
  
  console.log('✅ Model downloaded successfully!')
  console.log('You can now restart the app and use the LLM Chat feature.')
} catch (error) {
  console.error('❌ Failed to download model:', error.message)
  console.log('\nAlternatively, you can manually download a GGUF model and place it at:')
  console.log(modelDir)
}
