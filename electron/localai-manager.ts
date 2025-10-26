import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { WSLManager } from './wsl-manager.js'

export type LocalAIMode = 'standalone' | 'federated' | 'worker'

export interface LocalAIConfig {
  port: number
  p2pPort: number
  modelsPath: string
  token?: string
  mode: LocalAIMode
  generateToken?: boolean
}

export class LocalAIManager {
  private process?: ChildProcess
  private config: LocalAIConfig
  private binaryPath: string
  private isRunning = false
  private startupPromise?: Promise<void>
  private wslManager?: WSLManager
  private usingWSL = false

  constructor(config?: Partial<LocalAIConfig>) {
    this.config = {
      port: config?.port || 8080,
      p2pPort: config?.p2pPort || 9000,
      modelsPath: config?.modelsPath || this.getDefaultModelsPath(),
      token: config?.token,
      mode: config?.mode || 'worker',
      generateToken: config?.generateToken !== false
    }

    this.binaryPath = this.getBinaryPath()
  }

  private getBinaryPath(): string {
    const isDev = process.env.NODE_ENV === 'development'
    const platform = process.platform
    const arch = process.arch
    
    // Binary name
    let binaryName = `local-ai-${platform}-${arch}`
    if (platform === 'win32') {
      binaryName += '.exe'
    }

    if (isDev) {
      // In development, look in resources/bin
      return path.join(process.cwd(), 'resources', 'bin', binaryName)
    } else {
      // In production, look in app resources
      return path.join(process.resourcesPath, 'bin', binaryName)
    }
  }

  private getDefaultModelsPath(): string {
    return path.join(app.getPath('userData'), 'models')
  }

  isBinaryAvailable(): boolean {
    return fs.existsSync(this.binaryPath)
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('LocalAI is already running')
      return
    }

    // Return existing startup promise if already starting
    if (this.startupPromise) {
      return this.startupPromise
    }

    this.startupPromise = this._start()
    try {
      await this.startupPromise
    } finally {
      this.startupPromise = undefined
    }
  }

  private async _start(): Promise<void> {
    // Check if native binary is available
    if (!this.isBinaryAvailable()) {
      // On Windows, try WSL fallback automatically
      if (process.platform === 'win32') {
        console.log('Native LocalAI binary not found, attempting WSL fallback...')
        return this._startViaWSL()
      }
      throw new Error(`LocalAI binary not found at: ${this.binaryPath}. To use distributed inference on Windows, please install WSL and enable it manually in settings.`)
    }

    // Ensure models directory exists
    if (!fs.existsSync(this.config.modelsPath)) {
      fs.mkdirSync(this.config.modelsPath, { recursive: true })
    }

    console.log('Starting LocalAI...')
    console.log('Binary path:', this.binaryPath)
    console.log('Models path:', this.config.modelsPath)
    console.log('Config:', this.config)

    const args = ['run']
    
    // Mode-specific configuration
    if (this.config.mode === 'federated') {
      args.push('--p2p', '--federated')
    } else if (this.config.mode === 'worker') {
      args.push('--p2p')
    }
    // standalone mode = no p2p flags

    // Common args
    args.push(
      '--address', `0.0.0.0:${this.config.port}`,
      '--models-path', this.config.modelsPath,
      '--context-size', '2048',
      '--threads', '4'
    )

    // Add token if provided
    if (this.config.token) {
      args.push('--p2ptoken', this.config.token)
    }

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      LOCALAI_P2P_DISABLE_DHT: 'true', // Use mDNS for local discovery only
    }

    if (this.config.token) {
      env.LOCALAI_P2P_TOKEN = this.config.token
    }

    console.log('Spawning LocalAI with args:', args)

    this.process = spawn(this.binaryPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // Wait for startup
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('LocalAI startup timeout'))
      }, 30000)

      let output = ''

      const handleOutput = (data: Buffer) => {
        const text = data.toString()
        output += text
        console.log('[LocalAI]', text.trim())

        // Look for startup indicators
        if (text.includes('Starting LocalAI') || 
            text.includes('Listening on') ||
            text.includes('API Server listening')) {
          clearTimeout(timeout)
          this.isRunning = true
          console.log('✓ LocalAI started successfully')
          resolve()
        }
      }

      this.process!.stdout?.on('data', handleOutput)
      this.process!.stderr?.on('data', handleOutput)

      this.process!.on('error', (error) => {
        clearTimeout(timeout)
        console.error('LocalAI process error:', error)
        this.isRunning = false
        reject(error)
      })

      this.process!.on('exit', (code, signal) => {
        clearTimeout(timeout)
        this.isRunning = false
        console.log(`LocalAI process exited with code ${code}, signal ${signal}`)
        
        if (code !== 0 && code !== null) {
          reject(new Error(`LocalAI exited with code ${code}`))
        }
      })

      // If we don't see startup message within 5 seconds, assume it's running
      setTimeout(() => {
        if (!this.isRunning && this.process && !this.process.killed) {
          clearTimeout(timeout)
          this.isRunning = true
          console.log('✓ LocalAI appears to be running')
          resolve()
        }
      }, 5000)
    })
  }

  private async _startViaWSL(): Promise<void> {
    if (!this.wslManager) {
      this.wslManager = new WSLManager()
    }

    // Check if WSL is available
    const wslAvailable = await this.wslManager.checkWSLAvailability()
    if (!wslAvailable) {
      throw new Error('WSL is not available. Please install WSL2 or download the native LocalAI binary.')
    }

    console.log('Using WSL to run LocalAI...')

    // Setup LocalAI in WSL (download if needed)
    const setupSuccess = await this.wslManager.setupLocalAI()
    if (!setupSuccess) {
      throw new Error('Failed to setup LocalAI in WSL')
    }

    // Sync models to WSL
    try {
      await this.wslManager.syncModelsToWSL(this.config.modelsPath)
    } catch (error) {
      console.warn('Failed to sync models to WSL, continuing anyway:', error)
    }

    // Start LocalAI via WSL
    const process = await this.wslManager.startLocalAI({
      port: this.config.port,
      p2pPort: this.config.p2pPort,
      modelsPath: this.config.modelsPath,
      mode: this.config.mode,
      token: this.config.token
    })

    if (!process) {
      throw new Error('Failed to start LocalAI process via WSL')
    }

    this.process = process

    this.usingWSL = true

    // Wait for startup with same logic as native
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('LocalAI startup timeout (WSL)'))
      }, 60000) // 60 seconds for WSL (might need to download)

      let output = ''

      const handleOutput = (data: Buffer) => {
        const text = data.toString()
        output += text
        console.log('[LocalAI/WSL]', text.trim())

        // Look for startup indicators
        if (text.includes('Starting LocalAI') || 
            text.includes('Listening on') ||
            text.includes('API Server listening')) {
          clearTimeout(timeout)
          this.isRunning = true
          console.log('✓ LocalAI started successfully via WSL')
          resolve()
        }
      }

      this.process!.stdout?.on('data', handleOutput)
      this.process!.stderr?.on('data', handleOutput)

      this.process!.on('error', (error) => {
        clearTimeout(timeout)
        console.error('LocalAI process error (WSL):', error)
        this.isRunning = false
        reject(error)
      })

      this.process!.on('exit', (code, signal) => {
        clearTimeout(timeout)
        this.isRunning = false
        console.log(`LocalAI process exited (WSL) with code ${code}, signal ${signal}`)
        
        if (code !== 0 && code !== null) {
          reject(new Error(`LocalAI exited with code ${code} (WSL)`))
        }
      })

      // If we don't see startup message within 10 seconds, check if it's accessible
      setTimeout(async () => {
        if (!this.isRunning && this.process && !this.process.killed) {
          const running = await this.wslManager!.isLocalAIRunning(this.config.port)
          if (running) {
            clearTimeout(timeout)
            this.isRunning = true
            console.log('✓ LocalAI is accessible via WSL')
            resolve()
          }
        }
      }, 10000)
    })
  }

  async stop(): Promise<void> {
    if (!this.process || !this.isRunning) {
      return
    }

    console.log('Stopping LocalAI...')

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log('Force killing LocalAI process')
          this.process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      this.process!.once('exit', () => {
        clearTimeout(timeout)
        this.isRunning = false
        this.process = undefined
        console.log('✓ LocalAI stopped')
        resolve()
      })

      this.process!.kill('SIGTERM')
    })
  }

  getStatus(): {
    isRunning: boolean
    binaryAvailable: boolean
    binaryPath: string
    config: LocalAIConfig
    usingWSL: boolean
  } {
    return {
      isRunning: this.isRunning,
      binaryAvailable: this.isBinaryAvailable(),
      binaryPath: this.binaryPath,
      config: this.config,
      usingWSL: this.usingWSL
    }
  }

  getEndpoint(): string {
    return `http://localhost:${this.config.port}`
  }

  async getToken(): Promise<string | null> {
    if (!this.isRunning) {
      return null
    }

    try {
      const response = await fetch(`${this.getEndpoint()}/p2p/token`, {
        timeout: 2000
      } as any)

      if (response.ok) {
        const data = await response.text()
        return data.trim()
      }
    } catch (error) {
      console.error('Failed to get P2P token:', error)
    }

    return null
  }

  async getSwarmInfo(): Promise<{
    token?: string
    peers?: any[]
    nodeId?: string
  } | null> {
    if (!this.isRunning) {
      return null
    }

    try {
      const [tokenRes, peersRes] = await Promise.all([
        fetch(`${this.getEndpoint()}/p2p/token`, { timeout: 2000 } as any),
        fetch(`${this.getEndpoint()}/p2p/peers`, { timeout: 2000 } as any)
      ])

      const token = tokenRes.ok ? await tokenRes.text() : undefined
      const peers = peersRes.ok ? (await peersRes.json()) as any[] : undefined

      return {
        token: token?.trim(),
        peers,
        nodeId: undefined // Will be in peers response
      }
    } catch (error) {
      console.error('Failed to get swarm info:', error)
      return null
    }
  }

  updateConfig(config: Partial<LocalAIConfig>): void {
    this.config = { ...this.config, ...config }
  }

  async restart(): Promise<void> {
    await this.stop()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await this.start()
  }

  async startViaWSL(): Promise<void> {
    if (this.isRunning) {
      console.log('LocalAI is already running')
      return
    }

    if (this.startupPromise) {
      return this.startupPromise
    }

    this.startupPromise = this._startViaWSL()
    try {
      await this.startupPromise
    } finally {
      this.startupPromise = undefined
    }
  }

  async checkWSL(): Promise<{ available: boolean; error?: string }> {
    if (!this.wslManager) {
      this.wslManager = new WSLManager()
    }

    const available = await this.wslManager.checkWSLAvailability()
    if (!available) {
      return {
        available: false,
        error: 'WSL not available or no Linux distribution installed. Run: wsl --install -d Ubuntu'
      }
    }

    return { available: true }
  }
}


