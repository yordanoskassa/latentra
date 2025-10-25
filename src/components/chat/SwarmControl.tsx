import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Network, Copy, CheckCircle, Users, Key, Plus, Info } from 'lucide-react'

interface SwarmInfo {
  token?: string
  peers?: any[]
  nodeId?: string
}

export function SwarmControl() {
  const [swarmInfo, setSwarmInfo] = useState<SwarmInfo | null>(null)
  const [joinToken, setJoinToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'worker' | 'federated'>('worker')

  useEffect(() => {
    loadSwarmInfo()
    const interval = setInterval(loadSwarmInfo, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadSwarmInfo = async () => {
    try {
      const result = await window.electronAPI.distributed.getSwarmInfo()
      if (result.success && result.info) {
        setSwarmInfo(result.info as any)
      }
    } catch (error) {
      console.error('Failed to load swarm info:', error)
    }
  }

  const copyToken = () => {
    if (swarmInfo?.token) {
      navigator.clipboard.writeText(swarmInfo.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleModeChange = async (newMode: 'worker' | 'federated') => {
    setMode(newMode)
    try {
      await window.electronAPI.distributed.updateLocalAIConfig({ mode: newMode })
      // Restart to apply changes
      await window.electronAPI.distributed.restartLocalAI()
    } catch (error) {
      console.error('Failed to update mode:', error)
    }
  }

  const handleJoinSwarm = async () => {
    if (!joinToken.trim()) return
    
    try {
      await window.electronAPI.distributed.updateLocalAIConfig({ 
        mode,
        token: joinToken.trim()
      })
      await window.electronAPI.distributed.restartLocalAI()
      setJoinToken('')
    } catch (error) {
      console.error('Failed to join swarm:', error)
    }
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          <CardTitle className="text-lg">p2p swarm</CardTitle>
        </div>
        <CardDescription>
          create or join a distributed inference network
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">create network</TabsTrigger>
            <TabsTrigger value="join">join network</TabsTrigger>
          </TabsList>

          {/* Create Network Tab */}
          <TabsContent value="create" className="space-y-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">inference mode</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={mode === 'worker' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('worker')}
                  className="rounded-xl justify-start h-auto p-4"
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">worker mode</p>
                    <p className="text-xs opacity-70 mt-1">
                      split model weights
                    </p>
                  </div>
                </Button>
                <Button
                  variant={mode === 'federated' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('federated')}
                  className="rounded-xl justify-start h-auto p-4"
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">federated</p>
                    <p className="text-xs opacity-70 mt-1">
                      load balance requests
                    </p>
                  </div>
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900">
                  {mode === 'worker' ? (
                    <>
                      <strong>Worker Mode:</strong> Splits model layers across devices. Best for running larger models. All workers contribute to each inference.
                    </>
                  ) : (
                    <>
                      <strong>Federated Mode:</strong> Each device has the full model. Requests are load-balanced. Best for high throughput.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Token Display */}
            {swarmInfo?.token ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    your connection token
                  </label>
                  <Badge variant="secondary" className="rounded-full">
                    {swarmInfo.peers?.length || 0} peers
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={swarmInfo.token}
                    readOnly
                    className="rounded-xl font-mono text-xs"
                  />
                  <Button
                    onClick={copyToken}
                    variant="outline"
                    size="icon"
                    className="rounded-xl shrink-0"
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  share this token with other devices to join your network
                </p>
              </motion.div>
            ) : (
              <div className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                start the server to generate a connection token
              </div>
            )}
          </TabsContent>

          {/* Join Network Tab */}
          <TabsContent value="join" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">connection token</label>
              <Input
                placeholder="paste token from another device..."
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                className="rounded-xl font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">join as</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={mode === 'worker' ? 'default' : 'outline'}
                  onClick={() => setMode('worker')}
                  className="rounded-xl"
                >
                  worker
                </Button>
                <Button
                  variant={mode === 'federated' ? 'default' : 'outline'}
                  onClick={() => setMode('federated')}
                  className="rounded-xl"
                >
                  peer
                </Button>
              </div>
            </div>

            <Button
              onClick={handleJoinSwarm}
              disabled={!joinToken.trim()}
              className="w-full rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              join network
            </Button>

            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">how to use:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>get token from the device creating the network</li>
                <li>paste it above and select your role</li>
                <li>click join network</li>
                <li>server will restart and connect automatically</li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}


