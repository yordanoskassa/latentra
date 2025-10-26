import { exec, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const execAsync = promisify(exec)

export class WSLManager {
  private isWSLAvailable: boolean | null = null
  private wslVersion: string | null = null
  private localAIPath: string | null = null

  /**
   * Get the path to wsl.exe
   */
  private getWSLExePath(): string {
    const systemRoot = process.env.SYSTEMROOT || 'C:\\Windows'
    const candidates = [
      path.join(systemRoot, 'System32', 'wsl.exe'),
      // Sysnative lets 32-bit processes access 64-bit System32
      path.join(systemRoot, 'Sysnative', 'wsl.exe'),
      'wsl.exe'
    ]

    for (const candidate of candidates) {
      try {
        if (candidate === 'wsl.exe') return candidate
        if (fs.existsSync(candidate)) return candidate
      } catch {}
    }

    return 'wsl.exe'
  }

  /**
   * Run a command via WSL and capture output
   */
  private runWSLCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }>{
    return new Promise((resolve) => {
      const wslPath = this.getWSLExePath()
      const child = spawn(wslPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (d) => { stdout += d.toString() })
      child.stderr?.on('data', (d) => { stderr += d.toString() })
      child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }))
      child.on('error', () => resolve({ stdout, stderr: 'spawn error', code: -1 }))
    })
  }

  /**
   * Check if WSL is available on the system
   */
  async checkWSLAvailability(): Promise<boolean> {
    // Don't use cache - always check fresh to handle WSL installation during runtime
    const result = await this.runWSLCommand(['bash', '-lc', 'echo test'])

    // Check for error messages indicating no distribution
    if (result.stdout.includes('no installed distributions') || 
        result.stderr.includes('no installed distributions')) {
      console.log('✗ WSL installed but no Linux distribution found')
      console.log('   Run: wsl --install -d Ubuntu')
      this.isWSLAvailable = false
      return false
    }

    if (result.code === 0 && result.stdout.trim() === 'test') {
      this.isWSLAvailable = true

      // Check WSL version
      try {
        const version = await this.runWSLCommand(['--status'])
        const statusOutput = version.stdout
        if (statusOutput.includes('WSL 2') || statusOutput.includes('Version: 2')) {
          this.wslVersion = '2'
          console.log('✓ WSL 2 with Linux distribution detected')
        } else if (statusOutput) {
          this.wslVersion = '1'
          console.log('✓ WSL 1 with Linux distribution detected')
        } else {
          this.wslVersion = 'unknown'
          console.log('✓ WSL with Linux distribution detected')
        }
      } catch {
        this.wslVersion = 'unknown'
        console.log('✓ WSL with Linux distribution detected')
      }

      return true
    }

    console.log('WSL not available:', { code: result.code, stderr: result.stderr.trim() })
    this.isWSLAvailable = false
    return false
  }

  /**
   * Get the WSL path for a Windows path
   */
  private getWSLPath(windowsPath: string): string {
    // Convert C:\Users\... to /mnt/c/Users/...
    const normalized = windowsPath.replace(/\\/g, '/')
    const match = normalized.match(/^([A-Za-z]):\/(.*)/)
    
    if (match) {
      const drive = match[1].toLowerCase()
      const restPath = match[2]
      return `/mnt/${drive}/${restPath}`
    }
    
    return windowsPath
  }

  /**
   * Download and setup LocalAI in WSL
   */
  async setupLocalAI(): Promise<boolean> {
    const isAvailable = await this.checkWSLAvailability()
    if (!isAvailable) {
      return false
    }

    console.log('Setting up LocalAI in WSL...')

    // Create a directory in WSL for LocalAI
    const wslHomeDir = await this.getWSLHomeDir()
    const localAIDir = `${wslHomeDir}/.latentra`
    const localAIBinary = `${localAIDir}/local-ai`
    const wslPath = this.getWSLExePath()

    try {
      // Create directory
      await execAsync(`"${wslPath}" bash -c "mkdir -p ${localAIDir}"`, { timeout: 10000 })

      // Check if LocalAI is already downloaded
      const checkResult = await execAsync(
        `"${wslPath}" bash -c "test -f ${localAIBinary} && echo 'exists' || echo 'not_found'"`,
        { timeout: 5000 }
      )

      if (checkResult.stdout.trim() === 'exists') {
        // Check if it's executable and has reasonable size
        const sizeResult = await execAsync(
          `"${wslPath}" bash -c "stat -f '%z' ${localAIBinary} 2>/dev/null || stat -c '%s' ${localAIBinary}"`,
          { timeout: 5000 }
        )
        const size = parseInt(sizeResult.stdout.trim())
        
        if (size > 200 * 1024 * 1024) { // > 200MB
          console.log('✓ LocalAI binary already exists in WSL')
          this.localAIPath = localAIBinary
          
          // Ensure it's executable
          await execAsync(`"${wslPath}" chmod +x ${localAIBinary}`)
          return true
        }
      }

      // Download LocalAI for Linux (use bash -lc to avoid quoting issues)
      console.log('Downloading LocalAI for Linux in WSL...')
      const version = 'v2.21.1'
      const downloadUrl = `https://github.com/mudler/LocalAI/releases/download/${version}/local-ai-Linux-x86_64`

      const downloadCmd = [
        `mkdir -p ${localAIDir}`,
        `cd ${localAIDir}`,
        // Use single quotes around URL to avoid nested double-quote escaping
        `curl -L '${downloadUrl}' -o local-ai`,
        `chmod +x local-ai`,
        `ls -lh local-ai`
      ].join(' && ')

      const dl = await this.runWSLCommand(['bash', '-lc', downloadCmd])
      if (dl.stdout) console.log('Download output:', dl.stdout)
      if (dl.stderr) console.log('Download stderr:', dl.stderr)
      if (dl.code !== 0) {
        console.error('✗ LocalAI download failed')
        return false
      }

      // Verify the download
      const verify = await this.runWSLCommand(['bash', '-lc', `test -f ${localAIBinary} && echo success || echo failed`])
      if (verify.stdout.trim() === 'success') {
        this.localAIPath = localAIBinary
        console.log('✓ LocalAI downloaded successfully to WSL')
        return true
      } else {
        console.error('✗ LocalAI download verification failed')
        return false
      }
    } catch (error) {
      console.error('Failed to setup LocalAI in WSL:', error)
      return false
    }
  }

  /**
   * Get WSL home directory
   */
  private async getWSLHomeDir(): Promise<string> {
    try {
      const wslPath = this.getWSLExePath()
      const { stdout } = await execAsync(`"${wslPath}" bash -c "echo $HOME"`, { timeout: 5000 })
      return stdout.trim()
    } catch (error) {
      return '/root' // Fallback
    }
  }

  /**
   * Start LocalAI in WSL
   */
  async startLocalAI(config: {
    port: number
    p2pPort: number
    modelsPath: string
    mode?: 'standalone' | 'federated' | 'worker'
    token?: string
  }): Promise<ChildProcess | null> {
    if (!this.localAIPath) {
      const setupSuccess = await this.setupLocalAI()
      if (!setupSuccess) {
        throw new Error('Failed to setup LocalAI in WSL')
      }
    }

    console.log('Starting LocalAI in WSL...')
    console.log('Binary path:', this.localAIPath)
    console.log('Config:', config)

    // Convert Windows models path to WSL path
    const wslModelsPath = this.getWSLPath(config.modelsPath)

    // Build command arguments
    const args: string[] = ['run']

    if (config.mode === 'federated') {
      args.push('--p2p', '--federated')
    } else if (config.mode === 'worker' || !config.mode) {
      args.push('--p2p')
    }

    args.push(
      '--address', `0.0.0.0:${config.port}`,
      '--models-path', wslModelsPath,
      '--context-size', '2048',
      '--threads', '4'
    )

    if (config.token) {
      args.push('--p2ptoken', config.token)
    }

    const fullCommand = `${this.localAIPath} ${args.join(' ')}`
    
    console.log('Executing WSL command:', fullCommand)

    const env = { ...process.env }
    if (config.token) {
      env.LOCALAI_P2P_TOKEN = config.token
    }
    env.LOCALAI_P2P_DISABLE_DHT = 'true'

    // Start LocalAI via WSL
    const wslPath = this.getWSLExePath()
    const wslProcess = spawn(wslPath, ['bash', '-c', fullCommand], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    return wslProcess
  }

  /**
   * Check if LocalAI is running
   */
  async isLocalAIRunning(port: number = 8080): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/v1/models`, {
        timeout: 2000
      } as any)
      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Copy models from Windows to WSL if needed
   */
  async syncModelsToWSL(windowsModelsPath: string): Promise<void> {
    const wslHomeDir = await this.getWSLHomeDir()
    const wslModelsPath = `${wslHomeDir}/.latentra/models`
    const wslPath = this.getWSLExePath()

    console.log('Syncing models to WSL...')
    console.log('From:', windowsModelsPath)
    console.log('To:', wslModelsPath)

    try {
      // Create models directory in WSL
      await execAsync(`"${wslPath}" bash -c "mkdir -p ${wslModelsPath}"`, { timeout: 10000 })

      // Get list of model files
      const modelFiles = fs.readdirSync(windowsModelsPath)
        .filter(f => f.endsWith('.gguf'))

      if (modelFiles.length === 0) {
        console.log('No models to sync')
        return
      }

      console.log(`Found ${modelFiles.length} model(s) to sync`)

      // Copy each model file
      for (const modelFile of modelFiles) {
        const windowsPath = path.join(windowsModelsPath, modelFile)
        const wslPath = `${wslModelsPath}/${modelFile}`

        // Check if file already exists in WSL
        try {
          const checkResult = await execAsync(
            `"${this.getWSLExePath()}" bash -c "test -f ${wslPath} && echo 'exists' || echo 'not_found'"`,
            { timeout: 5000 }
          )

          if (checkResult.stdout.trim() === 'exists') {
            console.log(`✓ Model already exists in WSL: ${modelFile}`)
            continue
          }
        } catch (error) {
          // File doesn't exist, continue with copy
        }

        console.log(`Copying ${modelFile} to WSL...`)
        
        // Use wsl cp command
        const wslWindowsPath = this.getWSLPath(windowsPath)
        await execAsync(
          `"${this.getWSLExePath()}" bash -c "cp '${wslWindowsPath}' '${wslPath}'"`,
          { timeout: 300000 } // 5 minutes for large models
        )

        console.log(`✓ Copied ${modelFile}`)
      }

      console.log('✓ Models synced to WSL')
    } catch (error) {
      console.error('Failed to sync models to WSL:', error)
      throw error
    }
  }

  getWSLModelsPath(): string {
    return `${process.env.HOME || '/root'}/.latentra/models`
  }
}

