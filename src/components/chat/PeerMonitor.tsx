import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Monitor, Wifi, WifiOff, Loader2, CheckCircle } from 'lucide-react'

interface PeerDevice {
  id: string
  name: string
  address: string
  status: 'connected' | 'disconnected' | 'busy'
  specs: {
    cpu?: string
    memory?: number
    gpuLayers?: number
  }
  contribution: number
  lastSeen: Date
}

interface PeerMonitorProps {
  className?: string
}

export function PeerMonitor({ className }: PeerMonitorProps) {
  const [peers, setPeers] = useState<PeerDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPeers()
    const interval = setInterval(loadPeers, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadPeers = async () => {
    try {
      const result = await window.electronAPI.distributed.getPeers()
      if (result.success && result.peers) {
        setPeers(result.peers as any)
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load peers:', error)
      setIsLoading(false)
    }
  }

  return (
    <Card className={`rounded-xl ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <CardTitle className="text-lg">network peers</CardTitle>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {peers.length} connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : peers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              no peers connected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              start localai with p2p mode to connect
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {peers.map((peer, index) => (
              <motion.div
                key={peer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border bg-card p-4 space-y-3"
              >
                {/* Peer Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      peer.status === 'connected' ? 'bg-green-500/10' :
                      peer.status === 'busy' ? 'bg-yellow-500/10' : 'bg-gray-500/10'
                    }`}>
                      {peer.status === 'connected' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {peer.status === 'busy' && <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />}
                      {peer.status === 'disconnected' && <WifiOff className="h-5 w-5 text-gray-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{peer.name}</p>
                      <p className="text-xs text-muted-foreground">{peer.address}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={peer.status === 'connected' ? 'default' : 'secondary'}
                    className="rounded-full text-xs"
                  >
                    {peer.status}
                  </Badge>
                </div>

                {/* Peer Stats */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-muted-foreground">contribution</p>
                    <p className="font-semibold mt-1">{peer.contribution}%</p>
                  </div>
                  {peer.specs.memory && (
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-muted-foreground">memory</p>
                      <p className="font-semibold mt-1">{peer.specs.memory}GB</p>
                    </div>
                  )}
                  {peer.specs.gpuLayers && (
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-muted-foreground">gpu layers</p>
                      <p className="font-semibold mt-1">{peer.specs.gpuLayers}</p>
                    </div>
                  )}
                </div>

                {/* Last Seen */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wifi className="h-3 w-3" />
                  last seen {getTimeAgo(new Date(peer.lastSeen))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}


