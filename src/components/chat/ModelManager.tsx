import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Download, CheckCircle, Loader2, HardDrive, Search } from 'lucide-react'

interface Model {
  id: string
  name: string
  author: string
  size: string
  description: string
  url: string
  filename: string
  recommended?: boolean
}

const FEATURED_MODELS: Model[] = [
  {
    id: "llama3.2-3b",
    name: "llama 3.2 3b instruct",
    author: "meta",
    size: "~2.0gb",
    description: "latest llama model from meta. excellent conversational abilities.",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    filename: "llama-3.2-3b-instruct-q4.gguf",
    recommended: true,
  },
  {
    id: "tinyllama-1.1b",
    name: "tinyllama 1.1b chat",
    author: "tinyllama",
    size: "~700mb",
    description: "small, fast model for testing. best for quick responses.",
    url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    filename: "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
  },
  {
    id: "phi3-mini",
    name: "phi-3 mini 3.8b",
    author: "microsoft",
    size: "~2.4gb", 
    description: "efficient model with great balance of quality and speed.",
    url: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf",
    filename: "phi-3-mini-4k-instruct-q4.gguf",
  },
  {
    id: "llama3.2-1b",
    name: "llama 3.2 1b instruct",
    author: "meta",
    size: "~1.2gb",
    description: "compact llama model with good instruction following.",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    filename: "llama-3.2-1b-instruct-q4.gguf",
  },
  {
    id: "qwen2.5-0.5b",
    name: "qwen2.5 0.5b instruct",
    author: "alibaba",
    size: "~400mb",
    description: "ultra-small model perfect for quick testing.",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-0.5b-instruct-q4.gguf",
  },
  {
    id: "codellama-7b",
    name: "code llama 7b instruct",
    author: "meta",
    size: "~4.1gb",
    description: "specialized for code generation and programming tasks.",
    url: "https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf",
    filename: "codellama-7b-instruct.Q4_K_M.gguf",
  },
  {
    id: "mistral-7b",
    name: "mistral 7b instruct v0.2",
    author: "mistral ai",
    size: "~4.1gb",
    description: "high-quality general purpose model with excellent reasoning.",
    url: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
    filename: "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
  }
]

export function ModelManager() {
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ 
    [key: string]: { 
      progress: number; 
      downloadedSize?: number; 
      totalSize?: number 
    } 
  }>({})
  const [installedModels, setInstalledModels] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadInstalledModels()
  }, [])

  const loadInstalledModels = async () => {
    try {
      const response = await window.electronAPI.llm.getAvailableModels()
      if (response.success && response.models) {
        const installedIds = FEATURED_MODELS
          .filter(model => response.models!.includes(model.filename))
          .map(model => model.id)
        setInstalledModels(installedIds)
      }
    } catch (error) {
      console.error('Failed to load installed models:', error)
    }
  }

  const filteredModels = FEATURED_MODELS.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.author.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const downloadModel = async (model: Model) => {
    setDownloadingModel(model.id)
    setDownloadProgress(prev => ({ ...prev, [model.id]: { progress: 0 } }))

    // Set up progress listener
    window.electronAPI.model.onDownloadProgress((data) => {
      if (data.filename === model.filename) {
        setDownloadProgress(prev => ({ 
          ...prev, 
          [model.id]: {
            progress: data.progress,
            downloadedSize: data.downloadedSize,
            totalSize: data.totalSize
          }
        }))
      }
    })

    try {
      console.log(`Downloading ${model.name} by ${model.author} from ${model.url}`)
      
      const result = await window.electronAPI.model.download(model.url, model.filename)
      
      if (result.success) {
        setInstalledModels(prev => [...prev, model.id])
        await loadInstalledModels() // Refresh the installed models list
        console.log(`${model.name} downloaded successfully!`)
      } else {
        console.error('Download failed:', result.error)
        alert(`Download failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Download failed:', error)
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloadingModel(null)
      window.electronAPI.model.removeDownloadProgressListener()
    }
  }

  const openModelDirectory = async () => {
    try {
      await window.electronAPI.model.openDirectory()
    } catch (error) {
      console.error('Failed to open directory:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 lowercase"
          />
        </div>
        <Button variant="outline" onClick={openModelDirectory} className="rounded-xl">
          <HardDrive className="mr-2 h-4 w-4" />
          <span className="lowercase">open folder</span>
        </Button>
      </div>

      {/* Installed Models Section */}
      {installedModels.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="lowercase flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              installed models ({installedModels.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {installedModels.map((modelId) => {
                const model = FEATURED_MODELS.find(m => m.id === modelId)
                if (!model) return null
                
                return (
                  <div key={modelId} className="flex items-center justify-between p-4 border rounded-xl bg-muted/50">
                    <div>
                      <h4 className="font-medium lowercase">{model.name}</h4>
                      <p className="text-sm text-muted-foreground lowercase">{model.author} • {model.size}</p>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm lowercase">ready</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Models to Download */}
      <Card>
        <CardHeader>
          <CardTitle className="lowercase">available models</CardTitle>
          <CardDescription className="lowercase">
            download models from hugging face
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {filteredModels.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2 lowercase">no models found</h3>
                <p className="text-muted-foreground lowercase">try a different search</p>
              </div>
            ) : (
              filteredModels.map((model) => {
                const isDownloading = downloadingModel === model.id
                const isInstalled = installedModels.includes(model.id)
                const progressData = downloadProgress[model.id]
                const progress = progressData?.progress || 0

                return (
                  <div
                    key={model.id}
                    className="flex items-start justify-between p-5 border rounded-xl hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg lowercase">{model.name}</h4>
                        {model.recommended && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full lowercase">
                            recommended
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mb-2 text-sm text-muted-foreground lowercase">
                        <span>{model.author}</span>
                        <span>•</span>
                        <span>{model.size}</span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 lowercase">{model.description}</p>
                      
                      {isDownloading && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="flex items-center gap-2 lowercase">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              downloading...
                            </span>
                            <span className="font-mono text-xs">{progress}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-6">
                      {isInstalled ? (
                        <div className="flex flex-col items-center gap-1 text-green-600">
                          <CheckCircle className="h-6 w-6" />
                          <span className="text-xs lowercase">installed</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => downloadModel(model)}
                          disabled={isDownloading}
                          className="min-w-[110px] rounded-xl"
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              <span className="lowercase">downloading</span>
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              <span className="lowercase">download</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
