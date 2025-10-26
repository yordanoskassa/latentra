import { useState, useEffect } from 'react'
import { SimpleAirDropUI } from './SimpleAirDropUI'

interface Device {
  id: string
  name: string
  type: string
  host: string
  port: number
  distance: 'local' | 'nearby' | 'far'
  userName?: string
  specs?: {
    cpu?: string
    memory?: number
    vram?: number
    platform?: string
    arch?: string
  }
}

interface Connection {
  deviceId: string
  deviceName: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export function SimpleP2PPage() {
  const [isP2PEnabled, setIsP2PEnabled] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [autoSimulation, setAutoSimulation] = useState(false)

  // Load initial data
  useEffect(() => {
    loadP2PData()
  }, [])

  // Poll for updates when discovering
  useEffect(() => {
    if (!isDiscovering) return

    const interval = setInterval(() => {
      loadP2PData()
    }, 2000) // Update every 2 seconds when discovering

    return () => clearInterval(interval)
  }, [isDiscovering])

  // Auto simulation effect
  useEffect(() => {
    if (!autoSimulation || !isDiscovering) return

    const simulateDevices = () => {
      const mockDevices: Device[] = [
        {
          id: 'lenovo-1',
          name: 'Lenovo',
          type: 'laptop',
          host: '192.168.1.101',
          port: 8080,
          distance: 'nearby',
          userName: 'User-1',
          specs: {
            cpu: 'Intel Core i7-12700H',
            memory: 16,
            vram: 26, // Combined VRAM from all devices
            platform: 'win32',
            arch: 'x64'
          }
        }
      ]

      const mockConnections: Connection[] = mockDevices.map(device => ({
        deviceId: device.id,
        deviceName: device.name,
        status: 'connected'
      }))

      setDevices(mockDevices)
      setConnections(mockConnections)
    }

    // Start simulation after a short delay
    const timeout = setTimeout(simulateDevices, 1000)
    return () => clearTimeout(timeout)
  }, [autoSimulation, isDiscovering])

  // Auto-start simulation when discovery starts
  useEffect(() => {
    if (isDiscovering && !autoSimulation) {
      setAutoSimulation(true)
    }
  }, [isDiscovering, autoSimulation])

  const loadP2PData = async () => {
    try {
      // Check if P2P is enabled via config
      const configResult = await window.electronAPI.distributed.getConfig()
      if (configResult.success && configResult.config) {
        setIsP2PEnabled(configResult.config.enableP2P || false)
      }

      if (!configResult.success || !configResult.config?.enableP2P) {
        setLoading(false)
        return
      }

      // Skip loading real data if auto simulation is running
      if (autoSimulation) {
        setLoading(false)
        return
      }

      // Load P2P data
      const [
        localAIResult,
        peersResult
      ] = await Promise.all([
        window.electronAPI.distributed.getLocalAIStatus(),
        window.electronAPI.distributed.getPeers()
      ])

      if (localAIResult.success) {
        setIsDiscovering(localAIResult.status?.isRunning || false)
      }

      if (peersResult.success) {
        const peers = peersResult.peers || []
        // Convert peers to device format
        setDevices(peers.map((peer: any) => ({
          id: peer.id,
          name: peer.name,
          type: 'latentra',
          host: peer.address,
          port: peer.port,
          distance: 'nearby',
          userName: peer.name,
          specs: peer.specs || {
            cpu: 'Unknown',
            memory: 0,
            vram: 4, // Default VRAM for simulation
            platform: 'unknown',
            arch: 'unknown'
          }
        })))
        setConnections(peers.filter((p: any) => p.status === 'connected').map((p: any) => ({
          deviceId: p.id,
          deviceName: p.name,
          status: 'connected' as const
        })))
      }

    } catch (error) {
      console.error('Error loading P2P data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleDiscovery = async () => {
    try {
      if (isDiscovering) {
        setIsDiscovering(false) // Immediate UI feedback
        await window.electronAPI.distributed.stopLocalAI()
      } else {
        setIsDiscovering(true) // Immediate UI feedback
        await window.electronAPI.distributed.startLocalAI()
      }
      // Refresh full status after operation
      setTimeout(() => loadP2PData(), 1000)
    } catch (error) {
      console.error('Error toggling discovery:', error)
      // Revert state on error
      loadP2PData()
    }
  }

  const handleConnectDevice = async (deviceId: string) => {
    try {
      // Update config to enable P2P with this device
      console.log('Connecting to device:', deviceId)
      // Refresh immediately
      await loadP2PData()
    } catch (error) {
      console.error('Error connecting device:', error)
    }
  }

  const handleDisconnectDevice = async (deviceId: string) => {
    try {
      console.log('Disconnecting from device:', deviceId)
      // Refresh immediately
      await loadP2PData()
    } catch (error) {
      console.error('Error disconnecting device:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isP2PEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="py-16">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-500 text-2xl">📱</span>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            P2P Not Available
          </h3>
          <p className="text-gray-500">
            P2P networking requires LocalAI to be configured. 
            Please check your settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SimpleAirDropUI
      devices={devices}
      connections={connections}
      isDiscovering={isDiscovering}
      onToggleDiscovery={handleToggleDiscovery}
      onConnectDevice={handleConnectDevice}
      onDisconnectDevice={handleDisconnectDevice}
    />
  )
}