import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, CheckCircle, Cpu, Layers, Clock, RefreshCw } from 'lucide-react'

interface Profile {
  name: string
  description: string
}

interface Config {
  gpuLayers: number
  threads: number
  batchSize: number
  contextSize: number
  profile: string
}

export function PerformanceSettings() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<string>('auto')
  const [config, setConfig] = useState<Config | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    loadPerformanceSettings()
  }, [])

  const loadPerformanceSettings = async () => {
    try {
      const response = await window.electronAPI.llm.getPerformanceProfiles()
      if (response.success) {
        setProfiles(response.profiles || [])
        setCurrentProfile(response.current || 'auto')
        setConfig(response.config || null)
      }
    } catch (error) {
      console.error('Failed to load performance settings:', error)
    }
  }

  const handleProfileChange = async (profile: string) => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await window.electronAPI.llm.setPerformanceProfile(profile)
      if (response.success) {
        setCurrentProfile(profile)
        setMessage('settings updated! restart app to apply changes.')
        // Reload to get new config
        await loadPerformanceSettings()
      } else {
        setMessage(`error: ${response.error}`)
      }
    } catch (error) {
      setMessage(`failed to update: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getProfileBadgeColor = (profileName: string) => {
    switch (profileName) {
      case 'maximum':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'performance':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'balanced':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'cpu-only':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="lowercase flex items-center gap-2">
          <Zap className="h-5 w-5" />
          performance
        </CardTitle>
        <CardDescription className="lowercase">
          optimize model inference for your hardware
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Configuration */}
        {config && (
          <div className="p-4 bg-muted rounded-xl space-y-3">
            <h4 className="font-medium text-sm lowercase mb-3">current configuration:</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground lowercase">gpu layers:</span>
                <span className="font-medium">{config.gpuLayers}</span>
                {config.gpuLayers > 0 && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full lowercase">
                    gpu enabled
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground lowercase">threads:</span>
                <span className="font-medium">{config.threads}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground lowercase">batch size:</span>
                <span className="font-medium">{config.batchSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground lowercase">context:</span>
                <span className="font-medium">{config.contextSize} tokens</span>
              </div>
            </div>
          </div>
        )}

        {/* Profile Selection */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm lowercase">select performance profile:</h4>
          <div className="grid gap-3">
            {profiles.map((profile) => {
              const isSelected = currentProfile === profile.name
              
              return (
                <button
                  key={profile.name}
                  onClick={() => handleProfileChange(profile.name)}
                  disabled={isLoading}
                  className={`p-4 border rounded-xl text-left transition-all lowercase ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{profile.name}</span>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profile.description}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs border ${getProfileBadgeColor(profile.name)}`}>
                      {profile.name}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-3 rounded-xl text-sm lowercase ${
            message.includes('error') || message.includes('failed')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground lowercase space-y-1">
          <p>• <strong>auto:</strong> detects best settings for your hardware</p>
          <p>• <strong>maximum:</strong> best for apple silicon with 16gb+ ram</p>
          <p>• <strong>performance:</strong> recommended for apple silicon</p>
          <p>• <strong>balanced:</strong> good for most systems</p>
          <p>• <strong>cpu-only:</strong> compatible with all systems</p>
        </div>

        {/* Restart Button */}
        {message.includes('restart') && (
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full rounded-xl"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            <span className="lowercase">reload app</span>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}




