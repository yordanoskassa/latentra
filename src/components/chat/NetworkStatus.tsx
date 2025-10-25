import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Wifi, WifiOff, Users, Zap, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NetworkStatusProps {
  className?: string
}

interface PeerDevice {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'busy'
  contribution: number
}

interface DistributedStatus {
  mode: 'local' | 'distributed' | 'hybrid'
  localAIAvailable: boolean
  peersConnected: number
  userProfile: {
    displayName: string
    color: string
  }
}

export function NetworkStatus({ className }: NetworkStatusProps) {
  const [status, setStatus] = useState<DistributedStatus | null>(null)
  const [peers, setPeers] = useState<PeerDevice[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      // This will be implemented when we add IPC handlers
      // For now, show mock data in development
      if (process.env.NODE_ENV === 'development') {
        setStatus({
          mode: 'local',
          localAIAvailable: false,
          peersConnected: 0,
          userProfile: {
            displayName: 'You',
            color: '#3b82f6'
          }
        })
      }
    } catch (error) {
      console.error('Failed to load network status:', error)
    }
  }

  if (!status) return null

  const isDistributed = status.mode === 'distributed' || status.mode === 'hybrid'
  const hasNetwork = status.localAIAvailable && status.peersConnected > 0

  return (
    <TooltipProvider>
      <motion.div
        className={`flex items-center gap-2 ${className}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {/* Mode Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="cursor-pointer"
            >
              <Badge 
                variant={hasNetwork ? "default" : "secondary"}
                className="rounded-full px-3 py-1 text-xs font-medium gap-1.5"
              >
                {hasNetwork ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    distributed
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" />
                    local
                  </>
                )}
              </Badge>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent className="rounded-xl">
            <div className="space-y-1">
              <p className="font-medium text-xs">
                {hasNetwork ? 'distributed inference active' : 'running locally'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasNetwork 
                  ? `${status.peersConnected} peer${status.peersConnected !== 1 ? 's' : ''} connected`
                  : 'no network peers available'
                }
              </p>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Peer Count */}
        {isDistributed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">
                  {status.peersConnected}
                </span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent className="rounded-xl">
              <p className="text-xs">connected devices</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* LocalAI Status */}
        {status.localAIAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center"
              >
                <Server className="h-3.5 w-3.5 text-green-500" />
              </motion.div>
            </TooltipTrigger>
            <TooltipContent className="rounded-xl">
              <p className="text-xs">localai server connected</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Peer Details Popover */}
        <AnimatePresence>
          {isExpanded && peers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 bg-background border rounded-xl shadow-lg p-4 min-w-[250px] z-50"
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                connected peers
              </p>
              <div className="space-y-2">
                {peers.map((peer) => (
                  <div key={peer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        peer.status === 'connected' ? 'bg-green-500' : 
                        peer.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm">{peer.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {peer.contribution}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  )
}




