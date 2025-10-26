import multicastDns from 'multicast-dns'
import os from 'os'
import { EventEmitter } from 'events'

export interface SystemSpecs {
  cpu: string
  memory: number
  vram: number
  platform: string
  arch: string
}

export interface Peer {
  id: string
  name: string
  address: string
  port: number
  userAgent: string
  lastSeen: number
  specs?: SystemSpecs
}

export class NativeP2PDiscovery extends EventEmitter {
  private mdns: any
  private peers: Map<string, Peer> = new Map()
  private serviceType = '_latentra._tcp.local'
  private deviceId: string
  private deviceName: string
  private apiPort: number
  private isRunning = false
  private cleanupInterval?: NodeJS.Timeout
  private announceInterval?: NodeJS.Timeout
  private queryInterval?: NodeJS.Timeout
  private systemSpecs: SystemSpecs

  constructor(deviceId: string, deviceName: string, apiPort: number = 3000) {
    super()
    this.deviceId = deviceId
    this.deviceName = deviceName
    this.apiPort = apiPort
    this.systemSpecs = this.collectSystemSpecs()
  }

  start(): void {
    if (this.isRunning) {
      console.log('Native P2P discovery already running')
      return
    }

    console.log('Starting native P2P discovery...')
    this.mdns = multicastDns()
    this.isRunning = true

    // Listen for responses
    this.mdns.on('response', (response: any) => {
      this.handleResponse(response)
    })

    // Listen for queries and respond
    this.mdns.on('query', (query: any) => {
      const hasOurService = query.questions?.some((q: any) => 
        q.name === this.serviceType && q.type === 'PTR'
      )
      if (hasOurService) {
        console.log('Received query for our service, announcing...')
        this.announceService()
      }
    })

    // Announce ourselves immediately and periodically
    this.announceService()
    this.announceInterval = setInterval(() => this.announceService(), 20000) // Every 20 seconds

    // Query for peers immediately and periodically (more frequently)
    this.queryPeers()
    this.queryInterval = setInterval(() => this.queryPeers(), 5000) // Every 5 seconds

    // Clean up stale peers
    this.cleanupInterval = setInterval(() => this.cleanupStalePeers(), 15000)

    console.log('✓ Native P2P discovery started')
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping native P2P discovery...')
    
    if (this.mdns) {
      this.mdns.destroy()
      this.mdns = null
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    if (this.announceInterval) {
      clearInterval(this.announceInterval)
      this.announceInterval = undefined
    }

    if (this.queryInterval) {
      clearInterval(this.queryInterval)
      this.queryInterval = undefined
    }

    this.peers.clear()
    this.isRunning = false
    console.log('✓ Native P2P discovery stopped')
  }

  private announceService(): void {
    if (!this.mdns) return

    const hostname = os.hostname()
    const addresses = this.getLocalAddresses()

    this.mdns.respond({
      answers: [
        {
          name: this.serviceType,
          type: 'PTR',
          ttl: 120,
          data: `${this.deviceName}.${this.serviceType}`
        },
        {
          name: `${this.deviceName}.${this.serviceType}`,
          type: 'SRV',
          ttl: 120,
          data: {
            port: this.apiPort,
            target: hostname,
            priority: 0,
            weight: 0
          }
        },
        {
          name: `${this.deviceName}.${this.serviceType}`,
          type: 'TXT',
          ttl: 120,
          data: [
            `id=${this.deviceId}`,
            `name=${this.deviceName}`,
            `platform=${this.systemSpecs.platform}`,
            `arch=${this.systemSpecs.arch}`,
            `cpu=${this.systemSpecs.cpu}`,
            `memory=${this.systemSpecs.memory}`,
            `vram=${this.systemSpecs.vram}`
          ]
        },
        ...addresses.map((addr: string) => ({
          name: hostname,
          type: addr.includes(':') ? 'AAAA' : 'A',
          ttl: 120,
          data: addr
        }))
      ]
    })
  }

  private queryPeers(): void {
    if (!this.mdns) return

    this.mdns.query({
      questions: [
        {
          name: this.serviceType,
          type: 'PTR'
        }
      ]
    })
  }

  private handleResponse(response: any): void {
    try {
      // Parse PTR, SRV, TXT, and A/AAAA records from both answers and additionals
      const allRecords = [...(response.answers || []), ...(response.additionals || [])]
      const ptrRecords = allRecords.filter((a: any) => a.type === 'PTR')
      const srvRecords = allRecords.filter((a: any) => a.type === 'SRV')
      const txtRecords = allRecords.filter((a: any) => a.type === 'TXT')
      const aRecords = allRecords.filter((a: any) => a.type === 'A' || a.type === 'AAAA')

      for (const ptr of ptrRecords) {
        if (!ptr.data || !ptr.data.includes(this.serviceType)) continue

        // Find matching SRV and TXT records
        const srv = srvRecords.find((s: any) => s.name === ptr.data)
        const txt = txtRecords.find((t: any) => t.name === ptr.data)

        if (!srv || !txt) continue

        // Parse TXT data
        const txtData: Record<string, string> = {}
        for (const item of txt.data) {
          const str = Buffer.isBuffer(item) ? item.toString() : item
          const [key, ...valueParts] = str.split('=')
          txtData[key] = valueParts.join('=')
        }

        // Skip ourselves
        if (txtData.id === this.deviceId) continue

        // Find IP address
        const aRecord = aRecords.find((a: any) => a.name === srv.data.target)
        if (!aRecord) continue

        const peer: Peer = {
          id: txtData.id,
          name: txtData.name || 'Unknown Device',
          address: aRecord.data,
          port: srv.data.port,
          userAgent: `${txtData.platform || 'unknown'}/${txtData.arch || 'unknown'}`,
          lastSeen: Date.now(),
          specs: {
            cpu: txtData.cpu || 'Unknown',
            memory: parseInt(txtData.memory || '0'),
            vram: parseInt(txtData.vram || '0'),
            platform: txtData.platform || 'unknown',
            arch: txtData.arch || 'unknown'
          }
        }

        const isNewPeer = !this.peers.has(peer.id)
        this.peers.set(peer.id, peer)

        if (isNewPeer) {
          console.log(`✓ Discovered peer: ${peer.name} (${peer.address}:${peer.port})`)
          this.emit('peer-discovered', peer)
        }
      }
    } catch (error) {
      // Silent fail - mDNS responses can be malformed
    }
  }

  private cleanupStalePeers(): void {
    const now = Date.now()
    const timeout = 45000 // 45 seconds

    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > timeout) {
        console.log(`Removing stale peer: ${peer.name}`)
        this.peers.delete(id)
        this.emit('peer-lost', peer)
      }
    }
  }

  private collectSystemSpecs(): SystemSpecs {
    const cpus = os.cpus()
    const totalMemory = os.totalmem()
    
    // Get CPU model (first CPU)
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown'
    
    // Convert memory to GB
    const memoryGB = Math.round(totalMemory / (1024 ** 3))
    
    // VRAM detection - this is a simplified approach
    // On macOS with Apple Silicon, unified memory is shared
    // On other systems, we'll need to estimate or use external tools
    let vramGB = 0
    
    if (process.platform === 'darwin' && process.arch === 'arm64') {
      // Apple Silicon - estimate VRAM as 50% of total memory
      vramGB = Math.round(memoryGB * 0.5)
    } else if (process.platform === 'darwin') {
      // Intel Mac - estimate discrete GPU VRAM (typical 2-8GB)
      vramGB = 4
    } else {
      // Windows/Linux - estimate based on typical configurations
      vramGB = memoryGB >= 16 ? 6 : 4
    }
    
    return {
      cpu: cpuModel,
      memory: memoryGB,
      vram: vramGB,
      platform: process.platform,
      arch: process.arch
    }
  }

  private getLocalAddresses(): string[] {
    const addresses: string[] = []
    const interfaces = os.networkInterfaces()

    for (const name in interfaces) {
      const iface = interfaces[name]
      if (!iface) continue

      for (const details of iface) {
        // Skip internal and non-IPv4 addresses for simplicity
        if (!details.internal && details.family === 'IPv4') {
          addresses.push(details.address)
        }
      }
    }

    return addresses
  }

  getPeers(): Peer[] {
    return Array.from(this.peers.values())
  }

  isDiscovering(): boolean {
    return this.isRunning
  }

  getSystemSpecs(): SystemSpecs {
    return this.systemSpecs
  }
}



