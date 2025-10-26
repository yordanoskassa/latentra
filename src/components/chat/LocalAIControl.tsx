import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Server, Play, Square, RotateCw, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface LocalAIStatus {
  isRunning: boolean
  binaryAvailable: boolean
  binaryPath: string
  config: {
    port: number
    p2pPort: number
    modelsPath: string
  }
  usingWSL?: boolean
}

export function LocalAIControl() {
  const [status, setStatus] = useState<LocalAIStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [action, setAction] = useState<'start' | 'stop' | 'restart' | null>(null)

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI.distributed.getLocalAIStatus()
      if (result.success && result.status) {
        setStatus(result.status as any)
      }
    } catch (error) {
      console.error('Failed to load LocalAI status:', error)
    }
  }

  const handleStart = async () => {
    setIsLoading(true)
    setAction('start')
    try {
      const result = await window.electronAPI.distributed.startLocalAI()
      if (result.success) {
        await loadStatus()
      }
    } catch (error) {
      console.error('Failed to start LocalAI:', error)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    setAction('stop')
    try {
      const result = await window.electronAPI.distributed.stopLocalAI()
      if (result.success) {
        await loadStatus()
      }
    } catch (error) {
      console.error('Failed to stop LocalAI:', error)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const handleRestart = async () => {
    setIsLoading(true)
    setAction('restart')
    try {
      const result = await window.electronAPI.distributed.restartLocalAI()
      if (result.success) {
        await loadStatus()
      }
    } catch (error) {
      console.error('Failed to restart LocalAI:', error)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  if (!status) {
    return (
      <Card className="rounded-xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle className="text-lg">localai server</CardTitle>
          </div>
          <Badge 
            variant={status.isRunning ? 'default' : 'secondary'}
            className="rounded-full"
          >
            {status.isRunning ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> running</>
            ) : (
              <><Square className="h-3 w-3 mr-1" /> stopped</>
            )}
          </Badge>
        </div>
        <CardDescription>
          manage the bundled localai instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Check */}
        {!status.binaryAvailable && !status.usingWSL && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-yellow-50 border border-yellow-200 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  localai binary not found
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  on windows, wsl will be used automatically if available
                </p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* WSL Status */}
        {status.usingWSL && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-blue-50 border border-blue-200 p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  running via wsl
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  using linux subsystem for windows compatibility
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Server Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              api port
            </p>
            <p className="text-sm font-medium">{status.config.port}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              p2p port
            </p>
            <p className="text-sm font-medium">{status.config.p2pPort}</p>
          </div>
        </div>

        {/* Models Path */}
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            models directory
          </p>
          <p className="text-xs font-mono break-all">{status.config.modelsPath}</p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <AnimatePresence mode="wait">
            {!status.isRunning ? (
              <motion.div
                key="start"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1"
              >
                <Button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full rounded-xl"
                >
                  {isLoading && action === 'start' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      start server
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="controls"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex gap-2 flex-1"
              >
                <Button
                  onClick={handleRestart}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  {isLoading && action === 'restart' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={isLoading}
                  variant="destructive"
                  className="flex-1 rounded-xl"
                >
                  {isLoading && action === 'stop' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      stopping...
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      stop server
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Message */}
        {status.isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-green-50 border border-green-200 p-3 text-center"
          >
            <p className="text-xs text-green-800">
              server is running and ready for p2p connections
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}


