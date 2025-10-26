import { useState, useEffect } from 'react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Search, CheckCircle2, ExternalLink, Loader2, Link as LinkIcon } from 'lucide-react'

interface ToolKit {
  id: string
  name: string
  description: string
  logo: string
  authType: string
  isConnected: boolean
  connectionId?: string
  authConfigId?: string
  lastUpdated?: string
}

interface ToolRouterManagerProps {
  selectedTools: string[]
  onToolsChange: (tools: string[]) => void
  composioApiKey?: string
}

// Simulated toolkits data - In production, this would come from Composio API
const INITIAL_TOOLKITS: ToolKit[] = [
  { id: 'gmail', name: 'Gmail', description: 'Send and manage emails', logo: 'https://logos.composio.dev/api/gmail', authType: 'OAUTH2', isConnected: false },
  { id: 'slack', name: 'Slack', description: 'Team communication and messaging', logo: 'https://logos.composio.dev/api/slack', authType: 'OAUTH2', isConnected: false },
  { id: 'googlecalendar', name: 'Google Calendar', description: 'Schedule and manage events', logo: 'https://logos.composio.dev/api/googlecalendar', authType: 'OAUTH2', isConnected: false },
  { id: 'googledocs', name: 'Google Docs', description: 'Create and edit documents', logo: 'https://logos.composio.dev/api/googledocs', authType: 'OAUTH2', isConnected: false },
  { id: 'googlesheets', name: 'Google Sheets', description: 'Create and manage spreadsheets', logo: 'https://logos.composio.dev/api/googlesheets', authType: 'OAUTH2', isConnected: false },
  { id: 'googledrive', name: 'Google Drive', description: 'File storage and sharing', logo: 'https://logos.composio.dev/api/googledrive', authType: 'OAUTH2', isConnected: false },
  { id: 'notion', name: 'Notion', description: 'Notes and knowledge management', logo: 'https://logos.composio.dev/api/notion', authType: 'OAUTH2', isConnected: false },
  { id: 'asana', name: 'Asana', description: 'Project management', logo: 'https://logos.composio.dev/api/asana', authType: 'OAUTH2', isConnected: false },
  { id: 'trello', name: 'Trello', description: 'Visual project boards', logo: 'https://logos.composio.dev/api/trello', authType: 'OAUTH1', isConnected: false },
  { id: 'linear', name: 'Linear', description: 'Issue tracking for software teams', logo: 'https://logos.composio.dev/api/linear', authType: 'OAUTH2', isConnected: false },
  { id: 'github', name: 'GitHub', description: 'Code hosting and collaboration', logo: 'https://logos.composio.dev/api/github', authType: 'OAUTH2', isConnected: false },
  { id: 'discord', name: 'Discord', description: 'Community chat platform', logo: 'https://logos.composio.dev/api/discord', authType: 'OAUTH2', isConnected: false },
  { id: 'twitter', name: 'Twitter', description: 'Social media platform', logo: 'https://logos.composio.dev/api/twitter', authType: 'OAUTH2', isConnected: false },
  { id: 'hubspot', name: 'HubSpot', description: 'CRM and marketing automation', logo: 'https://logos.composio.dev/api/hubspot', authType: 'OAUTH2', isConnected: false },
  { id: 'airtable', name: 'Airtable', description: 'Collaborative database', logo: 'https://logos.composio.dev/api/airtable', authType: 'OAUTH2', isConnected: false },
  { id: 'youtube', name: 'YouTube', description: 'Video hosting and streaming', logo: 'https://logos.composio.dev/api/youtube', authType: 'OAUTH2', isConnected: false },
  { id: 'outlook', name: 'Outlook', description: 'Email and calendar', logo: 'https://logos.composio.dev/api/outlook', authType: 'OAUTH2', isConnected: false },
  { id: 'one_drive', name: 'OneDrive', description: 'Cloud storage', logo: 'https://logos.composio.dev/api/one_drive', authType: 'OAUTH2', isConnected: false },
  { id: 'google_maps', name: 'Google Maps', description: 'Location and navigation', logo: 'https://logos.composio.dev/api/google_maps', authType: 'OAUTH2', isConnected: false },
  { id: 'firecrawl', name: 'Firecrawl', description: 'Web scraping and crawling', logo: 'https://logos.composio.dev/api/firecrawl', authType: 'API_KEY', isConnected: false },
  { id: 'sentry', name: 'Sentry', description: 'Error tracking and monitoring', logo: 'https://logos.composio.dev/api/sentry', authType: 'BEARER_TOKEN', isConnected: false },
  { id: 'supabase', name: 'Supabase', description: 'Backend as a service', logo: 'https://logos.composio.dev/api/supabase', authType: 'OAUTH2', isConnected: false },
  { id: 'wrike', name: 'Wrike', description: 'Work management platform', logo: 'https://logos.composio.dev/api/wrike', authType: 'OAUTH2', isConnected: false },
  { id: 'perplexityai', name: 'Perplexity AI', description: 'AI-powered search', logo: 'https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master//perplexity.jpeg', authType: 'API_KEY', isConnected: false },
]

export function ToolRouterManager({ selectedTools, onToolsChange, composioApiKey }: ToolRouterManagerProps) {
  // Hardcoded auth config mapping from user's Composio dashboard
  const AUTH_CONFIG_MAP: Record<string, string> = {
    'gmail': 'ac_3AbKQzDnObAB',
    'slack': 'ac_Uu7fj8CNXKke',
    'github': 'ac_lH3zLQsaIhqm',
    'linear': 'ac_6EqFn1YtcK7U',
    'trello': 'ac_sP0cSOvyrRHl',
    'sentry': 'ac_2sPioUCmu9Rx',
    'googledocs': 'ac_hv34DYfoAaPd',
    'one_drive': 'ac_i4NXSjeUgZTl',
    'google_maps': 'ac_0wfcReIjcNO7',
    'wrike': 'ac_Ieuet043lN4x',
    'googlecalendar': 'ac_XACSLqxHK1EO',
    'supabase': 'ac_ChN2pd4VqYb0',
    'firecrawl': 'ac_jlnpNsCmHkhs',
    'discord': 'ac_dKRLea4dm9ac',
    'googlesheets': 'ac_Xc4N9e2AeSEb',
    'hubspot': 'ac_ayDvUOuU5qFz',
    'youtube': 'ac_9IjXzDq8s0pi',
    'outlook': 'ac_BsffyRcoE7Ph',
    'twitter': 'ac_mhBfl8WvQGdQ',
    'airtable': 'ac_-wwVU-6s9yGb',
    'slackbot': 'ac_lb2NkmTrNoVq',
    'perplexityai': 'ac_1oLOA-n5lZf9',
    'googledrive': 'ac_4-R_AHa_qrIh',
    'notion': 'ac_Y6HSvJFvhkQ5',
  }

  const [toolkits, setToolkits] = useState<ToolKit[]>(
    INITIAL_TOOLKITS.map(tk => ({
      ...tk,
      authConfigId: AUTH_CONFIG_MAP[tk.id] || undefined
    }))
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedToolkit, setSelectedToolkit] = useState<ToolKit | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [authUrl, setAuthUrl] = useState<string>('')
  const [filter, setFilter] = useState<'all' | 'connected' | 'selected'>('all')

  // Load connection status from localStorage
  useEffect(() => {
    // Skip fetching auth configs - using hardcoded AUTH_CONFIG_MAP instead
    loadLocalConnections()
  }, [composioApiKey])


  const loadLocalConnections = () => {
    const savedConnections = localStorage.getItem('composio-connections')
    if (savedConnections) {
      const connections = JSON.parse(savedConnections)
      setToolkits(prev => prev.map(tk => ({
        ...tk,
        isConnected: tk.isConnected || connections[tk.id]?.isConnected || false,
        connectionId: tk.connectionId || connections[tk.id]?.connectionId,
        lastUpdated: connections[tk.id]?.lastUpdated
      })))
    }
  }

  // Filter toolkits based on search and filter
  const filteredToolkits = toolkits.filter(tk => {
    const matchesSearch = tk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tk.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filter === 'connected') return matchesSearch && tk.isConnected
    if (filter === 'selected') return matchesSearch && selectedTools.includes(tk.id)
    return matchesSearch
  })

  const handleToggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter(id => id !== toolId))
    } else {
      onToolsChange([...selectedTools, toolId])
    }
  }

  const handleConnectTool = async (toolkit: ToolKit) => {
    setSelectedToolkit(toolkit)
    setShowAuthDialog(true)
    setIsConnecting(true)

    try {
      if (composioApiKey) {
        console.log(`[ToolRouterManager] Connecting ${toolkit.id} with authConfigId: ${toolkit.authConfigId}`)
        
        // If no auth config ID, try to create one first
        if (!toolkit.authConfigId) {
          console.log(`[ToolRouterManager] No auth config found for ${toolkit.id}, attempting to create one`)
          
          const createResult = await window.electron?.composio?.createAuthConfig({
            toolkit: toolkit.id,
            authScheme: toolkit.authType,
            scopes: toolkit.authType === 'OAUTH2' ? ['read', 'write'] : undefined
          })
          
          if (createResult?.success && createResult.data) {
            console.log('Created auth config:', createResult.data)
            const authConfigId = createResult.data.id
            
            // Update the toolkit with the new auth config ID
            setToolkits(prev => prev.map(tk => 
              tk.id === toolkit.id 
                ? { ...tk, authConfigId }
                : tk
            ))
            
            // Update the toolkit object for the connection attempt
            toolkit.authConfigId = authConfigId
          } else {
            throw new Error(`Failed to create auth config: ${createResult?.error}`)
          }
        }
        
        // Initiate connection via Electron IPC (avoids CORS)
        // Use auth config ID if available
        const result = await window.electron?.composio?.initiateConnection({
          integrationId: toolkit.id,
          authConfigId: toolkit.authConfigId || undefined,
          userId: 'default-user'
        })
        
        if (result?.success && result.data) {
          console.log('Composio initiate connection success:', result.data)
          
          // v3 API returns redirectUri, redirect_url, or redirectUrl - check all variants
          const redirectUrl = result.data.redirectUri || result.data.redirect_url || result.data.redirectUrl
          
          if (redirectUrl) {
            setAuthUrl(redirectUrl)
            // Store the connection request ID for later verification
            // The API might return different ID field names
            const connectionId = result.data.id || result.data.connection_id || result.data.connectionId
            localStorage.setItem(`composio-pending-${toolkit.id}`, JSON.stringify({
              connectionId,
              toolkit: toolkit.id,
              timestamp: Date.now()
            }))
          } else {
            console.error('No redirect URL in response:', result.data)
            throw new Error('No redirect URL in response')
          }
        } else {
          console.error('Composio API error:', result?.error, result?.statusCode, result?.details)
          const errorMessage = result?.error || 'Failed to initiate connection'
          
          // Provide more specific error messages
          if (errorMessage.includes('Missing authConfigId')) {
            throw new Error(`Configuration error: No auth config found for ${toolkit.name}. Please check your Composio dashboard.`)
          } else if (errorMessage.includes('deployment is currently unavailable')) {
            throw new Error('Composio service is temporarily unavailable. Please try again later.')
          } else {
            throw new Error(errorMessage)
          }
        }
      } else {
        throw new Error('No API key configured')
      }
    } catch (error) {
      console.error('Failed to initiate auth:', error)
      alert(`Failed to connect to ${toolkit.name}. Check console for details.`)
      setShowAuthDialog(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleAuthComplete = async () => {
    if (selectedToolkit) {
      // Get the pending connection info
      const pendingData = localStorage.getItem(`composio-pending-${selectedToolkit.id}`)
      
      if (pendingData) {
        const { connectionId } = JSON.parse(pendingData)
        
        // Verify the connection via Electron IPC (avoids CORS)
        try {
          const result = await window.electron?.composio?.verifyConnection(connectionId)

          if (result?.success && result.data) {
            console.log('Connection verified:', result.data)

            // Update connection status
            const updatedToolkits = toolkits.map(tk => 
              tk.id === selectedToolkit.id 
                ? { 
                    ...tk, 
                    isConnected: true, 
                    connectionId: connectionId,
                    lastUpdated: new Date().toISOString() 
                  }
                : tk
            )
            setToolkits(updatedToolkits)

            // Save to localStorage
            const connections = updatedToolkits.reduce((acc, tk) => {
              if (tk.isConnected) {
                acc[tk.id] = {
                  isConnected: tk.isConnected,
                  connectionId: tk.connectionId,
                  lastUpdated: tk.lastUpdated
                }
              }
              return acc
            }, {} as Record<string, any>)
            localStorage.setItem('composio-connections', JSON.stringify(connections))

            // Clean up pending data
            localStorage.removeItem(`composio-pending-${selectedToolkit.id}`)

            // Auto-select the tool
            if (!selectedTools.includes(selectedToolkit.id)) {
              onToolsChange([...selectedTools, selectedToolkit.id])
            }

            alert(`✅ ${selectedToolkit.name} connected successfully!`)
          } else {
            throw new Error('Connection verification failed')
          }
        } catch (error) {
          console.error('Failed to verify connection:', error)
          alert('Failed to verify connection. Please try again.')
        }
      }
    }
    
    setShowAuthDialog(false)
    setSelectedToolkit(null)
    setAuthUrl('')
  }

  const getAuthBadgeVariant = (authType: string) => {
    switch (authType) {
      case 'OAUTH2': return 'default'
      case 'OAUTH1': return 'secondary'
      case 'API_KEY': return 'outline'
      case 'BEARER_TOKEN': return 'outline'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-medium mb-2 lowercase flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          composio tool router
        </h3>
        <p className="text-sm text-muted-foreground lowercase">
          automatically discover, authenticate, and execute tools from 500+ integrations
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="lowercase h-8 px-3"
          >
            all
          </Button>
          <Button
            variant={filter === 'connected' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('connected')}
            className="lowercase h-8 px-3"
          >
            connected
          </Button>
          <Button
            variant={filter === 'selected' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('selected')}
            className="lowercase h-8 px-3"
          >
            selected
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground lowercase">selected:</span>{' '}
          <span className="font-medium">{selectedTools.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground lowercase">connected:</span>{' '}
          <span className="font-medium">{toolkits.filter(tk => tk.isConnected).length}</span>
        </div>
        <div>
          <span className="text-muted-foreground lowercase">available:</span>{' '}
          <span className="font-medium">{toolkits.length}</span>
        </div>
      </div>

      {/* Toolkits Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
        {filteredToolkits.map(toolkit => {
          const isSelected = selectedTools.includes(toolkit.id)
          
          return (
            <Card
              key={toolkit.id}
              className={`relative transition-all cursor-pointer hover:shadow-md ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  {/* Logo */}
                  <div className="relative">
                    <img
                      src={toolkit.logo}
                      alt={toolkit.name}
                      className="w-12 h-12 rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48'
                      }}
                    />
                    {toolkit.isConnected && (
                      <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-green-500 bg-background rounded-full" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="w-full">
                    <p className="font-medium text-sm lowercase truncate">{toolkit.name}</p>
                    <p className="text-xs text-muted-foreground lowercase line-clamp-2 mt-1">
                      {toolkit.description}
                    </p>
                  </div>

                  {/* Auth Badge */}
                  <Badge variant={getAuthBadgeVariant(toolkit.authType)} className="text-xs lowercase">
                    {toolkit.authType.toLowerCase().replace('_', ' ')}
                  </Badge>

                  {/* Actions */}
                  <div className="flex gap-2 w-full pt-2">
                    {toolkit.isConnected ? (
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => handleToggleTool(toolkit.id)}
                        className="flex-1 lowercase h-8"
                      >
                        {isSelected ? 'selected' : 'select'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConnectTool(toolkit)}
                        className="flex-1 lowercase h-8"
                      >
                        connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredToolkits.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground lowercase">no tools found</p>
        </div>
      )}

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="lowercase flex items-center gap-2">
              {selectedToolkit && (
                <>
                  <img src={selectedToolkit.logo} alt={selectedToolkit.name} className="w-6 h-6 rounded" />
                  connect to {selectedToolkit.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="lowercase">
              authorize latentra to access your {selectedToolkit?.name} account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isConnecting ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground lowercase">connecting to composio...</p>
              </div>
            ) : authUrl ? (
              <>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium lowercase mb-2">ready to connect</p>
                    <p className="text-xs text-muted-foreground lowercase">
                      click the button below to open the authorization page in a new window
                    </p>
                  </div>

                  <Button 
                    size="lg"
                    className="w-full lowercase" 
                    onClick={() => {
                      window.open(authUrl, '_blank', 'width=600,height=700')
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    authorize {selectedToolkit?.name}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">after authorizing</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full lowercase"
                    onClick={handleAuthComplete}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    i've completed authorization
                  </Button>

                  <p className="text-xs text-muted-foreground lowercase text-center">
                    💡 tip: you can also manage connections at{' '}
                    <a 
                      href="https://app.composio.dev/connections" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      composio dashboard
                    </a>
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

