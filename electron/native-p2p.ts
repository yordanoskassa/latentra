import multicastDns from 'multicast-dns'
import os from 'os'
import { EventEmitter } from 'events'

export interface Peer {
  id: string
  name: string
  address: string
  port: number
  userAgent: string
  lastSeen: number
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

  constructor(deviceId: string, deviceName: string, apiPort: number = 3000) {
    super()
    this.deviceId = deviceId
    this.deviceName = deviceName
    this.apiPort = apiPort
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

    // Announce ourselves periodically
    this.announceService()
    setInterval(() => this.announceService(), 30000) // Every 30 seconds

    // Query for peers periodically
    this.queryPeers()
    setInterval(() => this.queryPeers(), 10000) // Every 10 seconds

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
            `platform=${process.platform}`,
            `arch=${process.arch}`
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
      // Parse PTR, SRV, TXT, and A/AAAA records
      const ptrRecords = response.answers.filter((a: any) => a.type === 'PTR')
      const srvRecords = response.answers.filter((a: any) => a.type === 'SRV')
      const txtRecords = response.answers.filter((a: any) => a.type === 'TXT')
      const aRecords = response.answers.filter((a: any) => a.type === 'A' || a.type === 'AAAA')

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
          lastSeen: Date.now()
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
}



