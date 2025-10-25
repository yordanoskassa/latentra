import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { LLMService } from './llm-service.js'
import { DistributedInferenceService } from './distributed-service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development'
const llmService = new LLMService()
const distributedService = new DistributedInferenceService(llmService)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    icon: path.join(__dirname, '../src/assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5176')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  createWindow()

  // Initialize LLM service (optional - can be done on first chat)
  try {
    await llmService.initialize()
  } catch (error) {
    console.log('LLM service initialization failed, will try again on first chat:', error)
  }

  // Initialize distributed service
  try {
    await distributedService.initialize()
  } catch (error) {
    console.log('Distributed service initialization failed:', error)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

if (isDev) {
  Menu.setApplicationMenu(null)
}

// IPC handlers for model downloading
ipcMain.handle('model:download', async (event, modelUrl: string, filename: string) => {
  const https = await import('https')
  const fs = await import('fs')
  const modelDir = path.join(app.getPath('userData'), 'models')
  
  // Create models directory if it doesn't exist
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true })
    console.log(`Created models directory: ${modelDir}`)
  }
  
  const modelPath = path.join(modelDir, filename)
  
  // Check if file already exists
  if (fs.existsSync(modelPath)) {
    console.log(`Model ${filename} already exists`)
    return { success: false, error: 'Model already exists' }
  }
  
  const downloadFile = (url: string, maxRedirects = 5): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (maxRedirects === 0) {
        reject(new Error('Too many redirects'))
        return
      }
      
      console.log(`Downloading from: ${url}`)
      
      const tempFilePath = path.join(modelDir, `${filename}.tmp`)
      
      // Clean up any existing temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
      
      const file = fs.createWriteStream(tempFilePath)
      let downloadTimeout: NodeJS.Timeout
      let isComplete = false
      let lastProgressTime = Date.now()
      
      const cleanup = () => {
        if (downloadTimeout) clearTimeout(downloadTimeout)
        if (fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath)
          } catch (error) {
            console.error('Error cleaning up temp file:', error)
          }
        }
      }
      
      // Set overall download timeout (15 minutes)
      downloadTimeout = setTimeout(() => {
        if (!isComplete) {
          file.close()
          cleanup()
          reject(new Error('Download timeout - the download took too long'))
        }
      }, 900000)
      
      const request = https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          file.close()
          cleanup()
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            console.log(`Following redirect to: ${redirectUrl}`)
            clearTimeout(downloadTimeout)
            resolve(downloadFile(redirectUrl, maxRedirects - 1))
            return
          } else {
            reject(new Error('Redirect response without location header'))
            return
          }
        }
        
        if (response.statusCode !== 200) {
          cleanup()
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0
        
        if (totalSize === 0) {
          cleanup()
          reject(new Error('Invalid file size - content-length header missing or zero'))
          return
        }
        
        console.log(`Download started - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
        
        response.pipe(file)
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          const progress = Math.round((downloadedSize / totalSize) * 100)
          const now = Date.now()
          
          // Send progress update every 500ms
          if (now - lastProgressTime > 500) {
            event.sender.send('model:download-progress', { filename, progress, downloadedSize, totalSize })
            lastProgressTime = now
          }
        })
        
        file.on('finish', () => {
          file.close((closeErr) => {
            if (closeErr) {
              cleanup()
              reject(closeErr)
              return
            }
            
            // Verify file size
            try {
              const stats = fs.statSync(tempFilePath!)
              if (stats.size !== totalSize) {
                cleanup()
                reject(new Error(`File size mismatch. Expected ${totalSize}, got ${stats.size}`))
                return
              }
              
              // Move temp file to final location
              fs.renameSync(tempFilePath!, modelPath)
              isComplete = true
              clearTimeout(downloadTimeout)
              
              console.log(`Download completed successfully: ${filename}`)
              console.log(`Final file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
              
              // Try to reinitialize LLM service with new model
              llmService.reinitialize().catch(err => {
                console.log('Failed to auto-load new model:', err.message)
              })
              
              resolve({ success: true, path: modelPath, size: stats.size })
              
            } catch (error) {
              cleanup()
              reject(error)
            }
          })
        })
        
        file.on('error', (err) => {
          console.error('File write error:', err)
          cleanup()
          reject(err)
        })
        
        response.on('error', (err) => {
          console.error('Response error:', err)
          cleanup()
          reject(err)
        })
      })
      
      request.on('error', (err) => {
        console.error('Request error:', err)
        cleanup()
        reject(err)
      })
      
      // Set request timeout
      request.setTimeout(30000, () => {
        cleanup()
        reject(new Error('Request timeout - no response from server'))
      })
    })
  }
  
  try {
    console.log(`Starting download: ${filename}`)
    return await downloadFile(modelUrl)
  } catch (error) {
    console.error('Download error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown download error' 
    }
  }
})

ipcMain.handle('model:openDirectory', async () => {
  try {
    const { shell } = await import('electron')
    const modelDir = path.join(app.getPath('userData'), 'models')
    const fs = await import('fs')
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true })
    }
    
    shell.openPath(modelDir)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC handlers for LLM communication
ipcMain.handle('llm:chat', async (event, message: string) => {
  try {
    if (!llmService) {
      throw new Error('LLM service not available')
    }
    
    // Try to initialize if not already done
    const modelInfo = await llmService.getModelInfo()
    if (!modelInfo.isLoaded) {
      console.log('Model not loaded, attempting to initialize...')
      await llmService.initialize()
    }
    
    const response = await llmService.chat(message)
    return { success: true, response }
  } catch (error) {
    console.error('Chat error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('llm:getModelInfo', async () => {
  try {
    return await llmService.getModelInfo()
  } catch (error) {
    console.error('Error getting model info:', error)
    return { isLoaded: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('llm:reinitialize', async () => {
  try {
    await llmService.reinitialize()
    return { success: true }
  } catch (error) {
    console.error('Reinitialize error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('llm:getAvailableModels', async () => {
  try {
    const models = await llmService.getAvailableModels()
    return { success: true, models }
  } catch (error) {
    console.error('Error getting available models:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('llm:getPerformanceProfiles', async () => {
  try {
    const profiles = llmService.getAvailableProfiles()
    const current = llmService.getPerformanceProfile()
    const config = llmService.getCurrentConfig()
    return { success: true, profiles, current, config }
  } catch (error) {
    console.error('Error getting performance profiles:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('llm:setPerformanceProfile', async (event, profile: string) => {
  try {
    llmService.setPerformanceProfile(profile as any)
    return { success: true, message: 'Profile updated. Restart required for changes to take effect.' }
  } catch (error) {
    console.error('Error setting performance profile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC handlers for distributed inference
ipcMain.handle('distributed:getStatus', async () => {
  try {
    return { success: true, status: distributedService.getStatus() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getConfig', async () => {
  try {
    return { success: true, config: distributedService.getConfig() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:updateConfig', async (event, config) => {
  try {
    await distributedService.updateConfig(config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:updateUserProfile', async (event, profile) => {
  try {
    await distributedService.updateUserProfile(profile)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:testLocalAI', async () => {
  try {
    return await distributedService.testLocalAI()
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getPeers', async () => {
  try {
    return { success: true, peers: distributedService.getPeers() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getMetrics', async () => {
  try {
    return { success: true, metrics: distributedService.getMetrics() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getComputeDistribution', async () => {
  try {
    return { success: true, distribution: distributedService.getComputeDistribution() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getCurrentRequest', async () => {
  try {
    return { success: true, request: distributedService.getCurrentRequest() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getLocalAIStatus', async () => {
  try {
    return { success: true, status: distributedService.getLocalAIStatus() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:startLocalAI', async () => {
  try {
    await distributedService.startLocalAI()
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:stopLocalAI', async () => {
  try {
    await distributedService.stopLocalAI()
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:restartLocalAI', async () => {
  try {
    await distributedService.restartLocalAI()
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getP2PToken', async () => {
  try {
    const token = await distributedService.getP2PToken()
    return { success: true, token }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:getSwarmInfo', async () => {
  try {
    const info = await distributedService.getSwarmInfo()
    return { success: true, info }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

ipcMain.handle('distributed:updateLocalAIConfig', async (event, config) => {
  try {
    distributedService.updateLocalAIConfig(config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Cleanup on app quit
app.on('before-quit', () => {
  if (llmService) {
    llmService.dispose()
  }
  if (distributedService) {
    distributedService.dispose()
  }
})
