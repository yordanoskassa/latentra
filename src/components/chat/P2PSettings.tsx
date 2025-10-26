import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Switch } from '../ui/switch'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Network, Wifi, WifiOff, Settings2 } from 'lucide-react'

export function P2PSettings() {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [localAIStatus, setLocalAIStatus] = useState({
    isRunning: false,
    binaryAvailable: false
  })
  const [deviceName, setDeviceName] = useState('')
  const [connectedPeers, setConnectedPeers] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [localAIResult, peersResult] = await Promise.all([
        window.electronAPI.distributed.getLocalAIStatus(),
        window.electronAPI.distributed.getPeers()
      ])

      // LocalAI status contains info about if it's running
      if (localAIResult.success) {
        setLocalAIStatus(localAIResult.status || localAIStatus)
        setIsDiscovering(localAIResult.status?.isRunning || false)
      }

      // Get connected peers
      if (peersResult.success) {
        const peers = peersResult.peers || []
        setConnectedPeers(peers.filter((p: any) => p.status === 'connected').length)
      }

      // Get device name from hostname
      setDeviceName(navigator.platform || 'This Device')

    } catch (error) {
      console.error('Error loading P2P settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStopLocalAI = async () => {
    try {
      await window.electronAPI.distributed.stopLocalAI()
      // Immediately update UI state
      setIsDiscovering(false)
      // Then reload full status after a delay
      setTimeout(() => loadSettings(), 1500)
    } catch (error) {
      console.error('Error stopping LocalAI:', error)
    }
  }

  const handleStartLocalAI = async () => {
    try {
      await window.electronAPI.distributed.startLocalAI()
      // Immediately update UI state
      setIsDiscovering(true)
      // Then reload full status after a delay
      setTimeout(() => loadSettings(), 2000)
    } catch (error) {
      console.error('Error starting LocalAI:', error)
    }
  }

  if (loading) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="p-6">
          <div className="animate-pulse">Loading P2P settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="lowercase flex items-center">
          <Network className="w-5 h-5 mr-2" />
          p2p sharing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* P2P Status - Always Active */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {isDiscovering ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <div className="font-medium lowercase">peer discovery</div>
                <div className="text-sm text-muted-foreground lowercase">
                  {isDiscovering ? 'discovering nearby devices...' : 'discovery paused'}
                </div>
              </div>
            </div>
            <Badge variant={isDiscovering ? 'default' : 'secondary'} className="lowercase">
              {isDiscovering ? 'active' : 'paused'}
            </Badge>
          </div>

          {/* Device Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground lowercase mb-1">this device</p>
              <p className="text-sm font-medium lowercase truncate">{deviceName}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground lowercase mb-1">connected peers</p>
              <p className="text-sm font-medium">{connectedPeers}</p>
            </div>
          </div>

          {/* Quick Actions */}
          {!localAIStatus.isRunning && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium lowercase text-green-900">start compute sharing</h4>
                  <p className="text-sm text-green-700 lowercase">
                    share your device's ai power with peers
                    {!localAIStatus.binaryAvailable && ' (will use wsl on windows)'}
                  </p>
                </div>
                <Button size="sm" onClick={handleStartLocalAI} className="lowercase bg-green-600 hover:bg-green-700">
                  start
                </Button>
              </div>
            </div>
          )}

          {localAIStatus.isRunning && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-900 lowercase">
                    compute sharing active
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleStopLocalAI}
                  className="lowercase"
                >
                  stop
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}