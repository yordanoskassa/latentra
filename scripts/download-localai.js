#!/usr/bin/env node

/**
 * Download LocalAI binaries for bundling with Electron app
 */

import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LOCALAI_VERSION = 'v2.21.1' // Update as needed - v2.24.1 doesn't have Windows binary
const BINARIES_DIR = path.join(__dirname, '..', 'resources', 'bin')

const DOWNLOAD_URLS = {
  darwin: {
    arm64: `https://github.com/mudler/LocalAI/releases/download/${LOCALAI_VERSION}/local-ai-Darwin-arm64`,
    x64: `https://github.com/mudler/LocalAI/releases/download/${LOCALAI_VERSION}/local-ai-Darwin-x86_64`
  },
  linux: {
    x64: `https://github.com/mudler/LocalAI/releases/download/${LOCALAI_VERSION}/local-ai-Linux-x86_64`,
    arm64: `https://github.com/mudler/LocalAI/releases/download/${LOCALAI_VERSION}/local-ai-Linux-arm64`
  },
  win32: {
    x64: `https://github.com/mudler/LocalAI/releases/download/${LOCALAI_VERSION}/local-ai-Windows-x86_64.exe`
  }
}

// Create binaries directory
if (!fs.existsSync(BINARIES_DIR)) {
  fs.mkdirSync(BINARIES_DIR, { recursive: true })
  console.log(`Created directory: ${BINARIES_DIR}`)
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`)
    console.log(`Saving to: ${dest}`)

    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject)
      }

      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`Failed to download: ${response.statusCode}`))
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1)
          process.stdout.write(`\rProgress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`)
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close(() => {
          console.log('\n✓ Download complete')
          
          // Make executable on Unix-like systems
          if (process.platform !== 'win32') {
            try {
              fs.chmodSync(dest, 0o755)
              console.log('✓ Made executable')
            } catch (err) {
              console.warn('Warning: Could not make file executable:', err.message)
            }
          }
          
          resolve()
        })
      })

      file.on('error', (err) => {
        file.close()
        fs.unlinkSync(dest)
        reject(err)
      })
    })

    request.on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
      reject(err)
    })

    request.setTimeout(60000, () => {
      request.destroy()
      file.close()
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
      reject(new Error('Download timeout'))
    })
  })
}

async function downloadForPlatform(platform, arch) {
  const urls = DOWNLOAD_URLS[platform]
  if (!urls || !urls[arch]) {
    console.log(`⚠ No LocalAI binary available for ${platform}-${arch}`)
    return
  }

  const url = urls[arch]
  const fileName = platform === 'win32' ? `local-ai-${platform}-${arch}.exe` : `local-ai-${platform}-${arch}`
  const dest = path.join(BINARIES_DIR, fileName)

  // Check if file exists and is complete (>200MB for full binary)
  if (fs.existsSync(dest)) {
    const stats = fs.statSync(dest)
    const fileSizeMB = stats.size / (1024 * 1024)
    
    if (fileSizeMB > 200) {
      console.log(`✓ Binary already exists: ${fileName} (${fileSizeMB.toFixed(1)}MB)`)
      return
    } else {
      console.log(`⚠ Incomplete binary found (${fileSizeMB.toFixed(1)}MB), re-downloading...`)
      fs.unlinkSync(dest)
    }
  }

  console.log(`\nDownloading LocalAI for ${platform}-${arch}...`)
  
  try {
    await downloadFile(url, dest)
    console.log(`✓ Successfully downloaded: ${fileName}\n`)
  } catch (error) {
    console.error(`✗ Failed to download ${fileName}:`, error.message)
    throw error
  }
}

async function main() {
  console.log('=================================')
  console.log('LocalAI Binary Downloader')
  console.log('=================================\n')

  const currentPlatform = process.platform
  const currentArch = process.arch

  console.log(`Current platform: ${currentPlatform}-${currentArch}`)
  console.log(`LocalAI version: ${LOCALAI_VERSION}\n`)

  // Download for current platform
  try {
    await downloadForPlatform(currentPlatform, currentArch)
    console.log('\n✓ All downloads complete!')
  } catch (error) {
    console.error('\n✗ Download failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

export { downloadForPlatform, downloadFile }

