import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu, Activity, Zap, Server, Clock } from 'lucide-react'

interface PeerMetrics {
  peerId: string
  peerName: string
  percentage: number
  tokensProcessed: number
  avgLatency: number
}

interface ComputeDistribution {
  totalCompute: number
  distribution: PeerMetrics[]
}

interface ComputeVisualizationProps {
  className?: string
}

export function ComputeVisualization({ className }: ComputeVisualizationProps) {
  const [distribution, setDistribution] = useState<ComputeDistribution | null>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    loadDistribution()
    const interval = setInterval(loadDistribution, 2000)
    return () => clearInterval(interval)
  }, [])

  const loadDistribution = async () => {
    try {
      const result = await window.electronAPI.distributed.getComputeDistribution()
      if (result.success && result.distribution) {
        setDistribution(result.distribution)
        setIsActive(result.distribution.totalCompute > 0)
      }
    } catch (error) {
      console.error('Failed to load compute distribution:', error)
    }
  }

  if (!distribution || distribution.distribution.length === 0) {
    return (
      <Card className={`rounded-xl ${className}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">compute distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              no distributed activity yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              start chatting to see compute distribution
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`rounded-xl ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-lg">compute distribution</CardTitle>
          </div>
          {isActive && (
            <Badge variant="default" className="rounded-full animate-pulse">
              <Zap className="h-3 w-3 mr-1" />
              active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              total tokens
            </p>
            <p className="text-2xl font-semibold">
              {distribution.totalCompute.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              active peers
            </p>
            <p className="text-2xl font-semibold">
              {distribution.distribution.length}
            </p>
          </div>
        </div>

        {/* Distribution Bars */}
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            workload distribution
          </p>
          <AnimatePresence mode="popLayout">
            {distribution.distribution.map((peer, index) => (
              <motion.div
                key={peer.peerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        backgroundColor: getColorForIndex(index)
                      }}
                    />
                    <span className="font-medium">{peer.peerName}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {peer.percentage.toFixed(1)}%
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${peer.percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ 
                      backgroundColor: getColorForIndex(index)
                    }}
                  />
                </div>

                {/* Peer Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    {peer.tokensProcessed.toLocaleString()} tokens
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {peer.avgLatency.toFixed(0)}ms avg
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Live Activity Indicator */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-primary/5 border border-primary/20 p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">processing</span>
              </div>
              <span className="text-muted-foreground">
                work distributed across {distribution.distribution.length} peer{distribution.distribution.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

function getColorForIndex(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // orange
    '#10b981', // green
    '#06b6d4', // cyan
  ]
  return colors[index % colors.length]
}


