import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CheckCircle2, AlertCircle, ExternalLink, Trash2, Link as LinkIcon } from 'lucide-react'

interface Connection {
  id: string
  toolkit: string
  toolkitLogo: string
  userId: string
  status: 'active' | 'expired' | 'error'
  createdAt: string
  lastUsed?: string
}

export function ComposioSettings() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)

  useEffect(() => {
    // Check if API key is configured via environment variable
    checkApiKeyConfiguration()
    
    // Load connections
    loadConnections()
  }, [])

  const checkApiKeyConfiguration = async () => {
    try {
      // Check if COMPOSIO_API_KEY is available via Electron IPC
      const hasApiKey = await window.electron?.getEnv?.('COMPOSIO_API_KEY')
      setApiKeyConfigured(!!hasApiKey)
    } catch (error) {
      console.error('Failed to check API key configuration:', error)
      setApiKeyConfigured(false)
    }
  }

  const loadConnections = () => {
    const savedConnections = localStorage.getItem('composio-connections')
    if (savedConnections) {
      const connectionsData = JSON.parse(savedConnections)
      const connectionsList: Connection[] = Object.entries(connectionsData).map(([toolkit, data]: [string, any]) => ({
        id: data.connectionId || `conn_${toolkit}`,
        toolkit,
        toolkitLogo: `https://logos.composio.dev/api/${toolkit}`,
        userId: 'current-user',
        status: 'active',
        createdAt: data.lastUpdated || new Date().toISOString(),
        lastUsed: data.lastUpdated
      }))
      setConnections(connectionsList)
    }
  }


  const handleDisconnect = (connectionId: string) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      const savedConnections = localStorage.getItem('composio-connections')
      if (savedConnections) {
        const connectionsData = JSON.parse(savedConnections)
        const connection = connections.find(c => c.id === connectionId)
        if (connection) {
          delete connectionsData[connection.toolkit]
          localStorage.setItem('composio-connections', JSON.stringify(connectionsData))
          loadConnections()
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold lowercase flex items-center gap-2">
          <LinkIcon className="w-6 h-6" />
          composio integration
        </h2>
        <p className="text-muted-foreground lowercase">
          manage your composio api key and connected tools
        </p>
      </div>

      {/* API Key Status */}
      <Card>
        <CardHeader>
          <CardTitle className="lowercase">api key configuration</CardTitle>
          <CardDescription className="lowercase">
            composio api key is configured via environment variables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeyConfigured ? (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium lowercase">composio_api_key is configured</span>
              </div>
              <p className="text-xs text-muted-foreground lowercase mt-1">
                tool router is ready to use in agent builder
              </p>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium lowercase">composio_api_key not found</span>
              </div>
              <p className="text-xs text-muted-foreground lowercase mt-1">
                set the COMPOSIO_API_KEY environment variable to enable tool router
              </p>
            </div>
          )}

          <div className="pt-4 space-y-3 border-t">
            <h4 className="font-medium text-sm lowercase">how to configure</h4>
            <div className="space-y-2 text-sm text-muted-foreground lowercase">
              <p>1. get your api key from{' '}
                <a 
                  href="https://app.composio.dev/settings" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  composio settings
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <p>2. set the environment variable:</p>
              <div className="p-2 bg-muted rounded font-mono text-xs">
                export COMPOSIO_API_KEY="your-api-key"
              </div>
              <p>3. restart latentra to apply changes</p>
            </div>
          </div>

          <div className="pt-4 space-y-3 border-t">
            <h4 className="font-medium text-sm lowercase">what is composio?</h4>
            <p className="text-sm text-muted-foreground lowercase">
              composio provides access to 500+ tool integrations with automatic authentication,
              tool discovery, and execution. use it to build powerful ai agents that can interact
              with external services like gmail, slack, github, and more.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://docs.composio.dev/', '_blank')}
                className="lowercase"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                documentation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://app.composio.dev/signup', '_blank')}
                className="lowercase"
              >
                sign up for free
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connections */}
      <div className="space-y-4">
        {connections.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="lowercase">active connections</CardTitle>
              <CardDescription className="lowercase">
                tools you've connected through composio
              </CardDescription>
            </CardHeader>
            <CardContent className="py-16 text-center">
              <LinkIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2 lowercase">no connections yet</h3>
              <p className="text-muted-foreground mb-4 lowercase">
                connect tools in the agent builder to see them here
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="lowercase">
                active connections
                <Badge variant="secondary" className="ml-2">{connections.length}</Badge>
              </CardTitle>
              <CardDescription className="lowercase">
                tools you've connected through composio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {connections.map(connection => (
                <div key={connection.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <img
                      src={connection.toolkitLogo}
                      alt={connection.toolkit}
                      className="w-10 h-10 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40'
                      }}
                    />
                    <div>
                      <p className="font-medium lowercase">{connection.toolkit}</p>
                      <p className="text-xs text-muted-foreground lowercase">
                        connected {formatDate(connection.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={connection.status === 'active' ? 'default' : 'secondary'}
                      className="lowercase"
                    >
                      {connection.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(connection.id)}
                      className="lowercase"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground lowercase">
              💡 tip: you can manage all your connections at{' '}
              <a 
                href="https://app.composio.dev/connections" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                composio dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

