import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Server, Wifi, User, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { UserProfileDialog } from './UserProfileDialog'
import { ComputeVisualization } from './ComputeVisualization'
import { PeerMonitor } from './PeerMonitor'
import { SocialNetworkInference } from './SocialNetworkInference'

interface UserProfile {
  id: string
  displayName: string
  deviceName: string
  color: string
}

export function DistributedSettings() {
  const [localAIEndpoint, setLocalAIEndpoint] = useState('http://localhost:8080')
  const [p2pEnabled, setP2pEnabled] = useState(false)
  const [mode, setMode] = useState<'local' | 'distributed' | 'hybrid'>('local')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string>()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showProfileDialog, setShowProfileDialog] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const result = await window.electronAPI.distributed.getConfig()
      if (result.success && result.config) {
        setLocalAIEndpoint(result.config.localAIEndpoint || 'http://localhost:8080')
        setP2pEnabled(result.config.enableP2P)
        setMode(result.config.mode)
        setUserProfile(result.config.userProfile)
      }
    } catch (error) {
      console.error('Failed to load distributed config:', error)
    }
  }

  const testLocalAI = async () => {
    setTestStatus('testing')
    setTestError(undefined)

    try {
      const result = await window.electronAPI.distributed.testLocalAI()
      
      if (result.success) {
        setTestStatus('success')
        setTimeout(() => setTestStatus('idle'), 3000)
      } else {
        setTestStatus('error')
        setTestError(result.error || 'Connection failed')
      }
    } catch (error) {
      setTestStatus('error')
      setTestError(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  const saveConfig = async () => {
    try {
      const result = await window.electronAPI.distributed.updateConfig({
        mode,
        localAIEndpoint,
        enableP2P: p2pEnabled,
      })
      
      if (result.success) {
        console.log('Config saved successfully')
        // Show success message
      } else {
        console.error('Failed to save config:', result.error)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const handleProfileUpdate = async (profile?: UserProfile) => {
    if (profile) {
      setUserProfile(profile)
      try {
        await window.electronAPI.distributed.updateUserProfile(profile)
        console.log('Profile updated successfully')
      } catch (error) {
        console.error('Failed to update profile:', error)
      }
    }
    setShowProfileDialog(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">distributed inference</h2>
        <p className="text-sm text-muted-foreground mt-1">
          collaborate with other devices to run larger models
        </p>
      </div>

      {/* Social Network Interface */}
      <SocialNetworkInference />

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComputeVisualization />
        <PeerMonitor />
      </div>

      {/* User Profile Card */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle className="text-lg">your identity</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowProfileDialog(true)}
              className="rounded-xl"
            >
              {userProfile ? 'edit' : 'setup'}
            </Button>
          </div>
          <CardDescription>
            identify yourself in collaborative sessions
          </CardDescription>
        </CardHeader>
        {userProfile && (
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: userProfile.color }}
              >
                {userProfile.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">{userProfile.displayName}</p>
                <p className="text-xs text-muted-foreground">{userProfile.deviceName}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Inference Mode */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            <CardTitle className="text-lg">inference mode</CardTitle>
          </div>
          <CardDescription>
            choose how to process your requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['local', 'distributed', 'hybrid'] as const).map((modeOption) => (
            <motion.button
              key={modeOption}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setMode(modeOption)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                mode === modeOption
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm capitalize">{modeOption}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modeOption === 'local' && 'use only your device'}
                    {modeOption === 'distributed' && 'always use network peers'}
                    {modeOption === 'hybrid' && 'automatically choose best option'}
                  </p>
                </div>
                {mode === modeOption && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </motion.button>
          ))}
        </CardContent>
      </Card>

      {/* LocalAI Configuration */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle className="text-lg">localai server</CardTitle>
          </div>
          <CardDescription>
            connect to localai for distributed inference
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">endpoint url</label>
            <div className="flex gap-2">
              <Input
                value={localAIEndpoint}
                onChange={(e) => setLocalAIEndpoint(e.target.value)}
                placeholder="http://localhost:8080"
                className="rounded-xl"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={testLocalAI}
                disabled={testStatus === 'testing'}
                className="rounded-xl shrink-0"
              >
                {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {testStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                {testStatus === 'idle' && <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {testError && (
              <p className="text-xs text-red-500">{testError}</p>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium">enable p2p discovery</p>
              <p className="text-xs text-muted-foreground">
                automatically discover nearby devices
              </p>
            </div>
            <Switch
              checked={p2pEnabled}
              onCheckedChange={setP2pEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Setup Guide */}
      <Card className="rounded-xl border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">quick setup</CardTitle>
          <CardDescription>
            get started with distributed inference
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Badge variant="secondary" className="rounded-full shrink-0">1</Badge>
            <p>install localai: <code className="text-xs bg-muted px-2 py-1 rounded">curl https://localai.io/install.sh | sh</code></p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="rounded-full shrink-0">2</Badge>
            <p>start server: <code className="text-xs bg-muted px-2 py-1 rounded">local-ai --models-path ./models --p2p</code></p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="rounded-full shrink-0">3</Badge>
            <p>test connection above and enable distributed mode</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={loadConfig} className="rounded-xl">
          reset
        </Button>
        <Button onClick={saveConfig} className="rounded-xl">
          save changes
        </Button>
      </div>

      {/* Profile Dialog */}
      <UserProfileDialog
        open={showProfileDialog}
        onClose={handleProfileUpdate}
        initialProfile={userProfile || undefined}
      />
    </div>
  )
}



