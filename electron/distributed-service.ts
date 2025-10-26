import { LLMService } from './llm-service.js'
import { LocalAIManager } from './localai-manager.js'
import { NativeP2PDiscovery } from './native-p2p.js'
import os from 'os'

export type InferenceMode = 'local' | 'distributed' | 'hybrid'

export interface PeerDevice {
  id: string
  name: string
  address: string
  port: number
  status: 'connected' | 'disconnected' | 'busy'
  specs: {
    cpu: string
    memory: number
    gpuLayers: number
  }
  lastSeen: Date
  contribution: number // % of model layers handled
}

export interface UserProfile {
  id: string
  displayName: string
  deviceName: string
  color: string // for UI identification
  avatar?: string
}

export interface DistributedConfig {
  mode: InferenceMode
  localAIEndpoint?: string // e.g., http://localhost:8080
  p2pPort?: number
  coordinatorAddress?: string
  userProfile: UserProfile
  enableP2P: boolean
}

export interface ComputeMetrics {
  peerId: string
  cpuUsage: number // 0-100
  memoryUsage: number // MB
  tokensProcessed: number
  latency: number // ms
  timestamp: Date
  layersHandled?: number[]
}

export class DistributedInferenceService {
  private llmService: LLMService
  private config: DistributedConfig
  private peers: Map<string, PeerDevice> = new Map()
  private localAIAvailable: boolean = false
  private heartbeatInterval?: NodeJS.Timeout
  private metricsHistory: ComputeMetrics[] = []
  private maxMetricsHistory = 100
  private currentRequest?: {
    id: string
    startTime: Date
    peersInvolved: string[]
  }
  private localAIManager: LocalAIManager
  private manuallyStopped: boolean = false
  private nativeP2P?: NativeP2PDiscovery

  constructor(llmService: LLMService) {
    this.llmService = llmService
    
    // Default configuration - P2P enabled by default
    this.config = {
      mode: 'hybrid', // Use hybrid mode for automatic switching
      localAIEndpoint: 'http://localhost:8080',
      p2pPort: 9000,
      userProfile: this.generateDefaultProfile(),
      enableP2P: true // Always on
    }

    // Initialize LocalAI manager
    this.localAIManager = new LocalAIManager({
      port: 8080,
      p2pPort: 9000
    })
  }

  private generateDefaultProfile(): UserProfile {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
    const platform = process.platform
    const hostname = os.hostname()
    
    return {
      id: `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      displayName: hostname.split('.')[0] || 'Anonymous',
      deviceName: `${platform} device`,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  }

  async initialize(config?: Partial<DistributedConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Check if LocalAI is already running first
    const status = this.localAIManager.getStatus()
    if (status.isRunning) {
      console.log('LocalAI already running, skipping auto-start')
      this.localAIAvailable = true
    } else if (this.config.enableP2P && !this.manuallyStopped) {
      // Auto-start LocalAI (will try WSL on Windows if native binary not available)
      try {
        console.log('Auto-starting LocalAI...')
        await this.localAIManager.start()
        this.localAIAvailable = true
        console.log('✓ LocalAI started successfully')
      } catch (error) {
        console.error('Failed to auto-start LocalAI:', error)
        console.error('Error details:', error)
        // Fall back to checking if it's already running
        this.localAIAvailable = await this.checkLocalAI()
      }
    } else {
      // Check if LocalAI is available
      if (this.config.localAIEndpoint) {
        this.localAIAvailable = await this.checkLocalAI()
      }
    }

    // Start peer discovery if P2P is enabled
    if (this.config.enableP2P) {
      // Always use native mDNS P2P discovery for device detection
      console.log('Starting native P2P discovery for device detection')
      this.startNativeP2PDiscovery()
      
      // Also start LocalAI P2P if available (for actual distributed inference)
      if (this.localAIAvailable) {
        console.log('LocalAI available, also starting LocalAI P2P')
        this.startPeerDiscovery()
      }
    }

    console.log('Distributed service initialized:', {
      mode: this.config.mode,
      localAIAvailable: this.localAIAvailable,
      p2pEnabled: this.config.enableP2P,
      nativeP2PEnabled: !!this.nativeP2P,
      userProfile: this.config.userProfile,
      localAIStatus: this.localAIManager.getStatus()
    })
  }

  private async checkLocalAI(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.localAIEndpoint}/v1/models`, {
        timeout: 2000
      } as any)
      return response.ok
    } catch (error) {
      console.log('LocalAI not available:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  async chat(message: string): Promise<string> {
    const mode = this.getOptimalMode()
    
    console.log(`Using inference mode: ${mode}`)

    switch (mode) {
      case 'local':
        return this.localChat(message)
      
      case 'distributed':
        return this.distributedChat(message)
      
      case 'hybrid':
        // Use distributed if available and model is large, otherwise local
        if (this.localAIAvailable && this.peers.size > 0) {
          return this.distributedChat(message)
        }
        return this.localChat(message)
      
      default:
        return this.localChat(message)
    }
  }

  private async localChat(message: string): Promise<string> {
    return this.llmService.chat(message)
  }

  private async distributedChat(message: string): Promise<string> {
    if (!this.localAIAvailable) {
      throw new Error('LocalAI not available. Please start LocalAI server.')
    }

    const requestId = `req-${Date.now()}`
    const startTime = Date.now()

    this.currentRequest = {
      id: requestId,
      startTime: new Date(),
      peersInvolved: Array.from(this.peers.keys())
    }

    try {
      console.log(`[Distributed] Starting request ${requestId} with ${this.peers.size} peers`)
      
      const response = await fetch(`${this.config.localAIEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.config.userProfile.id,
          'X-Device-Name': this.config.userProfile.deviceName,
          'X-Request-ID': requestId
        },
        body: JSON.stringify({
          model: 'default', // LocalAI will use the loaded model
          messages: [
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`LocalAI request failed: ${response.statusText}`)
      }

      const data = await response.json() as any
      const latency = Date.now() - startTime
      
      console.log(`[Distributed] Request ${requestId} completed in ${latency}ms`)
      
      // Collect metrics after request
      await this.collectMetrics(requestId, latency, data.usage)
      
      this.currentRequest = undefined
      
      return data.choices[0].message.content
    } catch (error) {
      console.error('Distributed chat failed, falling back to local:', error)
      this.currentRequest = undefined
      return this.localChat(message)
    }
  }

  private async collectMetrics(requestId: string, latency: number, usage?: any): Promise<void> {
    try {
      // Try to get metrics from LocalAI
      const response = await fetch(`${this.config.localAIEndpoint}/metrics`, {
        timeout: 1000
      } as any)
      
      if (response.ok) {
        const metrics = await response.json() as any
        
        // Store metrics for each peer
        for (const [peerId, peer] of this.peers.entries()) {
          const peerMetrics: ComputeMetrics = {
            peerId,
            cpuUsage: metrics[peerId]?.cpu || 0,
            memoryUsage: metrics[peerId]?.memory || 0,
            tokensProcessed: usage?.total_tokens || 0,
            latency,
            timestamp: new Date(),
            layersHandled: metrics[peerId]?.layers || []
          }
          
          this.metricsHistory.push(peerMetrics)
        }
        
        // Trim history
        if (this.metricsHistory.length > this.maxMetricsHistory) {
          this.metricsHistory = this.metricsHistory.slice(-this.maxMetricsHistory)
        }
      }
    } catch (error) {
      // Metrics collection is optional
      console.log('Could not collect metrics:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private getOptimalMode(): InferenceMode {
    if (this.config.mode === 'local') return 'local'
    if (this.config.mode === 'distributed') return 'distributed'
    
    // Hybrid logic: use distributed if peers are available
    if (this.localAIAvailable && this.peers.size > 0) {
      return 'distributed'
    }
    
    return 'local'
  }

  private startPeerDiscovery(): void {
    // Simple heartbeat to discover and maintain peer connections
    this.heartbeatInterval = setInterval(async () => {
      await this.discoverPeers()
    }, 5000)
  }

  private async discoverPeers(): Promise<void> {
    // In a real implementation, this would use mDNS or a discovery service
    // For now, we'll check if LocalAI P2P mode is reporting peers
    
    if (!this.localAIAvailable) return

    try {
      const response = await fetch(`${this.config.localAIEndpoint}/p2p/peers`, {
        timeout: 1000
      } as any)
      
      if (response.ok) {
        const peers = await response.json() as any[]
        
        // Update peer list
        peers.forEach((peer: any) => {
          this.peers.set(peer.id, {
            id: peer.id,
            name: peer.name || 'Unknown',
            address: peer.address,
            port: peer.port || 9000,
            status: 'connected',
            specs: peer.specs || {},
            lastSeen: new Date(),
            contribution: peer.contribution || 0
          })
        })

        // Remove stale peers (not seen in 30 seconds)
        const now = Date.now()
        for (const [id, peer] of this.peers.entries()) {
          if (now - peer.lastSeen.getTime() > 30000) {
            this.peers.delete(id)
          }
        }
      }
    } catch (error) {
      // Silent fail - peer discovery is optional
    }
  }

  private startNativeP2PDiscovery(): void {
    console.log('Starting native mDNS P2P discovery...')
    
    this.nativeP2P = new NativeP2PDiscovery(
      this.config.userProfile.id,
      this.config.userProfile.displayName,
      8080 // API port
    )

    // Listen for peer events
    this.nativeP2P.on('peer-discovered', (peer: any) => {
      console.log(`Native P2P: Peer discovered - ${peer.name}`, peer.specs)
      this.peers.set(peer.id, {
        id: peer.id,
        name: peer.name,
        address: peer.address,
        port: peer.port,
        status: 'connected',
        specs: peer.specs || {
          cpu: 'Unknown',
          memory: 0,
          vram: 0,
          gpuLayers: 0
        },
        lastSeen: new Date(),
        contribution: 0
      })
    })

    this.nativeP2P.on('peer-lost', (peer: any) => {
      console.log(`Native P2P: Peer lost - ${peer.name}`)
      this.peers.delete(peer.id)
    })

    this.nativeP2P.start()
  }

  // Public API for UI
  
  getConfig(): DistributedConfig {
    return { ...this.config }
  }

  async updateConfig(config: Partial<DistributedConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    
    // Reinitialize if necessary
    if (config.localAIEndpoint || config.enableP2P !== undefined) {
      await this.initialize()
    }
  }

  async updateUserProfile(profile: Partial<UserProfile>): Promise<void> {
    this.config.userProfile = { ...this.config.userProfile, ...profile }
    console.log('User profile updated:', this.config.userProfile)
  }

  getPeers(): PeerDevice[] {
    return Array.from(this.peers.values())
  }

  getStatus(): {
    mode: InferenceMode
    localAIAvailable: boolean
    peersConnected: number
    userProfile: UserProfile
  } {
    return {
      mode: this.getOptimalMode(),
      localAIAvailable: this.localAIAvailable,
      peersConnected: this.peers.size,
      userProfile: this.config.userProfile
    }
  }

  async testLocalAI(): Promise<{ success: boolean; error?: string; latency?: number }> {
    if (!this.config.localAIEndpoint) {
      return { success: false, error: 'No LocalAI endpoint configured' }
    }

    try {
      const startTime = Date.now()
      const response = await fetch(`${this.config.localAIEndpoint}/v1/models`, {
        timeout: 5000
      } as any)
      const latency = Date.now() - startTime

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      this.localAIAvailable = true
      return { success: true, latency }
    } catch (error) {
      this.localAIAvailable = false
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  getMetrics(): ComputeMetrics[] {
    return [...this.metricsHistory]
  }

  getCurrentRequest(): typeof this.currentRequest {
    return this.currentRequest
  }

  getComputeDistribution(): {
    totalCompute: number
    distribution: Array<{
      peerId: string
      peerName: string
      percentage: number
      tokensProcessed: number
      avgLatency: number
    }>
  } {
    if (this.metricsHistory.length === 0) {
      return { totalCompute: 0, distribution: [] }
    }

    // Group metrics by peer
    const peerMetrics = new Map<string, { tokens: number; latencies: number[] }>()
    
    for (const metric of this.metricsHistory) {
      if (!peerMetrics.has(metric.peerId)) {
        peerMetrics.set(metric.peerId, { tokens: 0, latencies: [] })
      }
      const pm = peerMetrics.get(metric.peerId)!
      pm.tokens += metric.tokensProcessed
      pm.latencies.push(metric.latency)
    }

    const totalTokens = Array.from(peerMetrics.values()).reduce((sum, pm) => sum + pm.tokens, 0)

    const distribution = Array.from(peerMetrics.entries()).map(([peerId, pm]) => {
      const peer = this.peers.get(peerId)
      return {
        peerId,
        peerName: peer?.name || peerId,
        percentage: totalTokens > 0 ? (pm.tokens / totalTokens) * 100 : 0,
        tokensProcessed: pm.tokens,
        avgLatency: pm.latencies.reduce((sum, l) => sum + l, 0) / pm.latencies.length
      }
    })

    return {
      totalCompute: totalTokens,
      distribution: distribution.sort((a, b) => b.percentage - a.percentage)
    }
  }

  getLocalAIStatus(): ReturnType<LocalAIManager['getStatus']> {
    return this.localAIManager.getStatus()
  }

  async startLocalAI(): Promise<void> {
    this.manuallyStopped = false
    await this.localAIManager.start()
    this.localAIAvailable = true
  }

  async stopLocalAI(): Promise<void> {
    this.manuallyStopped = true
    await this.localAIManager.stop()
    this.localAIAvailable = false
  }

  async restartLocalAI(): Promise<void> {
    await this.localAIManager.restart()
    this.localAIAvailable = true
  }

  async getP2PToken(): Promise<string | null> {
    return this.localAIManager.getToken()
  }

  async getSwarmInfo(): Promise<ReturnType<LocalAIManager['getSwarmInfo']>> {
    return this.localAIManager.getSwarmInfo()
  }

  updateLocalAIConfig(config: any): void {
    this.localAIManager.updateConfig(config)
  }

  dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    // Stop native P2P if running
    if (this.nativeP2P) {
      this.nativeP2P.stop()
      this.nativeP2P = undefined
    }
    
    this.peers.clear()
    this.metricsHistory = []
    this.currentRequest = undefined
    
    // Stop LocalAI if we started it
    if (this.localAIManager.getStatus().isRunning) {
      this.localAIManager.stop().catch(err => {
        console.error('Error stopping LocalAI:', err)
      })
    }
  }
}



