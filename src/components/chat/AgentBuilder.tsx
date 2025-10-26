import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Bot, Plus, Save, Trash2, Edit2, Mail, MessageSquare, Calendar, FileText, Database, Clock, Users, DollarSign, BarChart, CheckSquare, Upload, X } from 'lucide-react'
import { ToolRouterManager } from './ToolRouterManager'
import { Agent, AgentFile } from '../types/electron'

const AVAILABLE_TOOLS = [
  { 
    id: 'gmail', 
    name: 'Gmail', 
    icon: Mail, 
    color: '#EA4335',
    logo: 'https://logos.composio.dev/api/gmail'
  },
  { 
    id: 'slack', 
    name: 'Slack', 
    icon: MessageSquare, 
    color: '#4A154B',
    logo: 'https://logos.composio.dev/api/slack'
  },
  { 
    id: 'googlecalendar', 
    name: 'Google Calendar', 
    icon: Calendar, 
    color: '#4285F4',
    logo: 'https://logos.composio.dev/api/googlecalendar'
  },
  { 
    id: 'googledocs', 
    name: 'Google Docs', 
    icon: FileText, 
    color: '#4285F4',
    logo: 'https://logos.composio.dev/api/googledocs'
  },
  { 
    id: 'googlesheets', 
    name: 'Google Sheets', 
    icon: BarChart, 
    color: '#0F9D58',
    logo: 'https://logos.composio.dev/api/googlesheets'
  },
  { 
    id: 'notion', 
    name: 'Notion', 
    icon: Database, 
    color: '#000000',
    logo: 'https://logos.composio.dev/api/notion'
  },
  { 
    id: 'asana', 
    name: 'Asana', 
    icon: CheckSquare, 
    color: '#F06A6A',
    logo: 'https://logos.composio.dev/api/asana'
  },
  { 
    id: 'trello', 
    name: 'Trello', 
    icon: CheckSquare, 
    color: '#0079BF',
    logo: 'https://logos.composio.dev/api/trello'
  },
  { 
    id: 'linear', 
    name: 'Linear', 
    icon: CheckSquare, 
    color: '#5E6AD2',
    logo: 'https://logos.composio.dev/api/linear'
  },
  { 
    id: 'github', 
    name: 'GitHub', 
    icon: CheckSquare, 
    color: '#181717',
    logo: 'https://logos.composio.dev/api/github'
  },
]

export function AgentBuilder() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [composioApiKey, setComposioApiKey] = useState('')
  const [agentFiles, setAgentFiles] = useState<AgentFile[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [goal, setGoal] = useState('')
  const [backstory, setBackstory] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  useEffect(() => {
    loadAgents()
    checkComposioApiKey()
  }, [])

  const checkComposioApiKey = async () => {
    try {
      // Try to get API key from Electron environment
      const apiKey = await window.electron?.getEnv?.('COMPOSIO_API_KEY')
      if (apiKey) {
        setComposioApiKey(apiKey)
      }
    } catch (error) {
      console.error('Failed to get Composio API key:', error)
    }
  }

  const loadAgents = async () => {
    try {
      const result = await window.electron?.agent?.getAll()
      if (result?.success && result.data) {
        setAgents(result.data)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadAgentFiles = async (agentId: string) => {
    try {
      const result = await window.electron?.agent?.getFiles(agentId)
      if (result?.success && result.data) {
        setAgentFiles(result.data)
      }
    } catch (error) {
      console.error('Failed to load agent files:', error)
    }
  }

  const resetForm = () => {
    setName('')
    setRole('')
    setGoal('')
    setBackstory('')
    setSelectedTools([])
    setAgentFiles([])
    setCurrentStep(1)
    setEditingAgent(null)
  }

  const handleSaveAgent = async () => {
    if (!name || !role || !goal) {
      alert('Please fill in agent name, role, and goal')
      return
    }

    try {
      if (editingAgent) {
        // Update existing agent
        const result = await window.electron?.agent?.update(editingAgent.id, {
          name,
          role,
          goal,
          backstory,
          tools: selectedTools
        })
        if (result?.success) {
          await loadAgents()
          resetForm()
          setShowBuilder(false)
        } else {
          alert('Failed to update agent: ' + result?.error)
        }
      } else {
        // Create new agent
        const result = await window.electron?.agent?.create({
          name,
          role,
          goal,
          backstory,
          tools: selectedTools,
          knowledgeBase: agentFiles.length > 0 ? {
            files: agentFiles.map(f => f.filePath)
          } : undefined
        })
        if (result?.success) {
          await loadAgents()
          resetForm()
          setShowBuilder(false)
        } else {
          alert('Failed to create agent: ' + result?.error)
        }
      }
    } catch (error) {
      console.error('Error saving agent:', error)
      alert('Failed to save agent')
    }
  }

  const handleEditAgent = async (agent: Agent) => {
    setEditingAgent(agent)
    setName(agent.name)
    setRole(agent.role)
    setGoal(agent.goal)
    setBackstory(agent.backstory)
    setSelectedTools(agent.tools)
    setShowBuilder(true)
    setCurrentStep(1)
    // Load agent's files
    await loadAgentFiles(agent.id)
  }

  const handleDeleteAgent = async (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        const result = await window.electron?.agent?.delete(id)
        if (result?.success) {
          await loadAgents()
        } else {
          alert('Failed to delete agent: ' + result?.error)
        }
      } catch (error) {
        console.error('Error deleting agent:', error)
        alert('Failed to delete agent')
      }
    }
  }

  const handleUploadFiles = async () => {
    if (!editingAgent && !name) {
      alert('Please save the agent first before uploading files')
      return
    }

    setIsUploadingFile(true)
    try {
      // If editing an existing agent, use its ID
      // If creating a new agent, we need to save it first
      let agentId = editingAgent?.id

      if (!agentId) {
        // Create agent first
        const result = await window.electron?.agent?.create({
          name,
          role,
          goal,
          backstory,
          tools: selectedTools
        })
        if (result?.success && result.data) {
          agentId = result.data.id
          setEditingAgent(result.data)
        } else {
          alert('Failed to create agent')
          return
        }
      }

      // Now upload files
      const result = await window.electron?.agent?.uploadFile(agentId!)
      if (result?.success && result.data) {
        setAgentFiles(prev => [...prev, ...result.data!])
      } else if (result?.error && !result.error.includes('No files selected')) {
        alert('Failed to upload files: ' + result?.error)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      const result = await window.electron?.agent?.deleteFile(fileId)
      if (result?.success) {
        setAgentFiles(prev => prev.filter(f => f.id !== fileId))
      } else {
        alert('Failed to delete file: ' + result?.error)
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file')
    }
  }

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    )
  }

  if (showBuilder) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold lowercase">
              {editingAgent ? 'edit agent' : 'create new agent'}
            </h2>
            <p className="text-muted-foreground lowercase">
              step {currentStep} of 3
            </p>
          </div>
          <Button variant="ghost" onClick={() => { resetForm(); setShowBuilder(false) }}>
            cancel
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {[1, 2, 3].map(step => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full ${
                step <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Basic Info & Agent Configuration */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium lowercase">agent name</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sales Assistant, Code Reviewer..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium lowercase">role</label>
                  <Input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Senior Sales Representative, Technical Writer..."
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1 lowercase">
                    define what the agent does
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium lowercase">goal</label>
                  <Textarea
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="Your goal is to help users with..."
                    className="mt-1 min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1 lowercase">
                    what should this agent achieve?
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium lowercase">backstory (optional)</label>
                  <Textarea
                    value={backstory}
                    onChange={e => setBackstory(e.target.value)}
                    placeholder="You have 10 years of experience in..."
                    className="mt-1 min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1 lowercase">
                    provide context and personality for the agent
                  </p>
                </div>

                <Button onClick={() => setCurrentStep(2)} className="w-full lowercase">
                  next: configure knowledge base
                </Button>
              </div>
            )}

            {/* Step 2: Knowledge Base & File Upload */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5" />
                    <h3 className="font-medium lowercase">knowledge base (rag)</h3>
                  </div>
                  <p className="text-sm text-muted-foreground lowercase">
                    upload documents for the agent to reference when answering questions
                  </p>
                </div>

                {/* File Upload Area */}
                <div className="border-2 border-dashed rounded-lg p-6">
                  <div className="text-center mb-4">
                    <Database className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground lowercase">
                      upload documents for context-aware responses
                    </p>
                    <p className="text-xs text-muted-foreground lowercase mt-1">
                      supports pdf, txt, md, doc, docx files
                    </p>
                  </div>
                  <Button 
                    onClick={handleUploadFiles} 
                    disabled={isUploadingFile}
                    className="w-full lowercase"
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingFile ? 'uploading...' : 'select files to upload'}
                  </Button>
                </div>

                {/* Uploaded Files List */}
                {agentFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium lowercase">uploaded files ({agentFiles.length})</h4>
                    <div className="space-y-2">
                      {agentFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <div>
                              <p className="text-sm font-medium">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.fileSize / 1024).toFixed(2)} KB • {file.mimeType}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1 lowercase">
                    back
                  </Button>
                  <Button onClick={() => setCurrentStep(3)} className="flex-1 lowercase">
                    next: select tools
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Tool Selection with Tool Router */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <ToolRouterManager
                  selectedTools={selectedTools}
                  onToolsChange={setSelectedTools}
                  composioApiKey={composioApiKey}
                />

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1 lowercase">
                    back
                  </Button>
                  <Button onClick={handleSaveAgent} className="flex-1 lowercase">
                    <Save className="w-4 h-4 mr-2" />
                    save agent ({selectedTools.length} tools)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold lowercase">ai agents</h2>
          <p className="text-muted-foreground lowercase">
            create and manage custom ai assistants for specific tasks
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)} className="lowercase">
          <Plus className="w-4 h-4 mr-2" />
          create agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-medium mb-2 lowercase">no agents yet</h3>
            <p className="text-muted-foreground mb-4 lowercase">
              create your first ai agent to get started
            </p>
            <Button onClick={() => setShowBuilder(true)} className="lowercase">
              <Plus className="w-4 h-4 mr-2" />
              create your first agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="lowercase flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      {agent.name}
                    </CardTitle>
                    {agent.description && (
                      <CardDescription className="lowercase mt-1">
                        {agent.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground lowercase mb-2">
                      system prompt:
                    </p>
                    <p className="text-sm line-clamp-3">
                      {agent.systemPrompt}
                    </p>
                  </div>

                  {agent.tools.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground lowercase mb-2">
                        tools ({agent.tools.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {agent.tools.slice(0, 5).map(toolId => {
                          const tool = AVAILABLE_TOOLS.find(t => t.id === toolId)
                          return (
                            <div
                              key={toolId}
                              className="p-1.5 rounded bg-muted"
                              title={tool?.name}
                            >
                              {tool ? (
                                <img 
                                  src={tool.logo} 
                                  alt={tool.name}
                                  className="w-4 h-4"
                                />
                              ) : (
                                <Bot className="w-4 h-4" />
                              )}
                            </div>
                          )
                        })}
                        {agent.tools.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.tools.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditAgent(agent)}
                      className="flex-1 lowercase"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="lowercase"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

