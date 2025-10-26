import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Wifi, 
  Smartphone, 
  Laptop, 
  Monitor, 
  Users, 
  WifiOff,
  Zap
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Switch } from '../ui/switch'

interface Device {
  id: string
  name: string
  type: string
  host: string
  port: number
  distance: 'local' | 'nearby' | 'far'
  userName?: string
}

interface Connection {
  deviceId: string
  deviceName: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

interface SimpleAirDropUIProps {
  devices: Device[]
  connections: Connection[]
  isDiscovering: boolean
  onToggleDiscovery: () => void
  onConnectDevice: (deviceId: string) => void
  onDisconnectDevice: (deviceId: string) => void
}

const deviceIcons = {
  latentra: Laptop,
  desktop: Monitor,
  laptop: Laptop,
  mobile: Smartphone,
  default: Laptop
}

const getDeviceIcon = (type: string) => {
  return deviceIcons[type as keyof typeof deviceIcons] || deviceIcons.default
}

const getDeviceColor = (deviceId: string) => {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600'
  ]
  const hash = deviceId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function SimpleAirDropUI({
  devices,
  connections,
  isDiscovering,
  onToggleDiscovery,
  onConnectDevice,
  onDisconnectDevice
}: SimpleAirDropUIProps) {
  const getDeviceStatus = (deviceId: string) => {
    const connection = connections.find(c => c.deviceId === deviceId)
    return connection?.status || 'disconnected'
  }

  const connectedCount = connections.filter(c => c.status === 'connected').length

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header - Simple AirDrop style */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <Users className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold">Share AI Power</h1>
        </div>
        
        <div className="flex items-center justify-center space-x-4">
          <span className="text-gray-600">Discovery</span>
          <Switch
            checked={isDiscovering}
            onCheckedChange={onToggleDiscovery}
          />
          {isDiscovering && (
            <div className="flex items-center space-x-2 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Looking for devices...</span>
            </div>
          )}
        </div>

        {connectedCount > 0 && (
          <div className="flex items-center justify-center space-x-2 text-green-600">
            <Zap className="w-4 h-4" />
            <span className="text-sm">{connectedCount} device{connectedCount > 1 ? 's' : ''} connected</span>
          </div>
        )}
      </div>

      {/* Device Grid - AirDrop style */}
      <AnimatePresence mode="popLayout">
        {isDiscovering ? (
          devices.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {devices.map(device => {
                const DeviceIcon = getDeviceIcon(device.type)
                const status = getDeviceStatus(device.id)
                const deviceColor = getDeviceColor(device.id)
                const isConnected = status === 'connected'
                const isConnecting = status === 'connecting'

                return (
                  <motion.div
                    key={device.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Card 
                      className={`cursor-pointer transition-all duration-300 ${
                        isConnected 
                          ? 'ring-2 ring-green-400 bg-green-50' 
                          : isConnecting
                          ? 'ring-2 ring-yellow-400 bg-yellow-50'
                          : 'hover:shadow-lg'
                      }`}
                      onClick={() => {
                        if (isConnected) {
                          onDisconnectDevice(device.id)
                        } else if (!isConnecting) {
                          onConnectDevice(device.id)
                        }
                      }}
                    >
                      <CardContent className="p-6 text-center space-y-4">
                        {/* Device Avatar - AirDrop style */}
                        <div className="relative mx-auto">
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${deviceColor} p-4 shadow-lg mx-auto`}>
                            <DeviceIcon className="w-full h-full text-white" />
                          </div>
                          
                          {/* Status indicator */}
                          {isConnected && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                          {isConnecting && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full border-2 border-white animate-pulse" />
                          )}
                        </div>

                        {/* Device info */}
                        <div className="space-y-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {device.name}
                          </h3>
                          {device.userName && (
                            <p className="text-sm text-gray-500">
                              {device.userName}
                            </p>
                          )}
                        </div>

                        {/* Action button */}
                        <div className="pt-2">
                          {isConnected ? (
                            <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700">
                              Disconnect
                            </Button>
                          ) : isConnecting ? (
                            <Button size="sm" disabled className="w-full">
                              Connecting...
                            </Button>
                          ) : (
                            <Button size="sm" className="w-full">
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="relative inline-block mb-6">
                <Wifi className="w-20 h-20 text-blue-500 mx-auto animate-pulse" />
                <div className="absolute -inset-6 rounded-full border-2 border-blue-200 animate-ping" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Looking for devices...
              </h3>
              <p className="text-gray-500">
                Make sure other devices have discovery enabled
              </p>
            </motion.div>
          )
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <WifiOff className="w-20 h-20 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Discovery is off
            </h3>
            <p className="text-gray-500 mb-6">
              Turn on discovery to find nearby devices and share AI processing power
            </p>
            <Button onClick={onToggleDiscovery} className="mx-auto">
              Start Discovery
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}