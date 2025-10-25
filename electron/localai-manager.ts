import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

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
    if (!this.isBinaryAvailable()) {
      throw new Error(`LocalAI binary not found at: ${this.binaryPath}`)
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

    const env = {
      ...process.env,
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
  } {
    return {
      isRunning: this.isRunning,
      binaryAvailable: this.isBinaryAvailable(),
      binaryPath: this.binaryPath,
      config: this.config
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
      const peers = peersRes.ok ? await peersRes.json() : undefined

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
}

