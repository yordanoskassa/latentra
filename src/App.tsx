import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ModelManager } from '@/components/chat/ModelManager'
import { ModernChatInterface } from '@/components/chat/ModernChatInterface'
import { PerformanceSettings } from '@/components/chat/PerformanceSettings'
import { DistributedSettings } from '@/components/chat/DistributedSettings'
import { Settings, HardDrive, Brain, Search, MessageSquare, Network } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  const [activeTab, setActiveTab] = useState('chat')

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border h-screen">
          <div className="p-6">
            <div className="mb-2 animate-fade-in">
              <h1 className="text-2xl font-semibold text-foreground lowercase tracking-tight">latentra</h1>
            </div>
            <p className="text-sm text-muted-foreground lowercase">local llm studio</p>
          </div>
          <nav className="px-4 space-y-1.5">
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              className="w-full justify-start h-10 rounded-xl transition-all duration-200"
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="lowercase">chat</span>
            </Button>
            <Button
              variant={activeTab === 'models' ? 'default' : 'ghost'}
              className="w-full justify-start h-10 rounded-xl transition-all duration-200"
              onClick={() => setActiveTab('models')}
            >
              <HardDrive className="mr-2 h-4 w-4" />
              <span className="lowercase">models</span>
            </Button>
            <Button
              variant={activeTab === 'network' ? 'default' : 'ghost'}
              className="w-full justify-start h-10 rounded-xl transition-all duration-200"
              onClick={() => setActiveTab('network')}
            >
              <Network className="mr-2 h-4 w-4" />
              <span className="lowercase">network</span>
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              className="w-full justify-start h-10 rounded-xl transition-all duration-200"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span className="lowercase">settings</span>
            </Button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between animate-fade-in">
              <div>
                <h2 className="text-3xl font-semibold text-foreground lowercase tracking-tight">
                  {activeTab}
                </h2>
                <p className="text-muted-foreground lowercase">
                  {activeTab === 'chat' && 'chat with your local ai models'}
                  {activeTab === 'models' && 'browse, download, and manage ai models'}
                  {activeTab === 'network' && 'collaborate with other devices'}
                  {activeTab === 'settings' && 'configure your llm preferences'}
                </p>
              </div>
              {activeTab === 'models' && (
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search models..." className="pl-8 w-64" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-12rem)]">
              <TooltipProvider>
                <ModernChatInterface />
              </TooltipProvider>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="h-[calc(100vh-12rem)] overflow-y-auto">
              <ModelManager />
            </div>
          )}

          {activeTab === 'network' && (
            <div className="max-w-3xl space-y-6">
              <DistributedSettings />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <PerformanceSettings />
              
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="lowercase">about</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm lowercase">
                    <div className="flex justify-between">
                      <span>latentra</span>
                      <span className="text-muted-foreground">v1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>electron</span>
                      <span className="text-muted-foreground">v28.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>node-llama-cpp</span>
                      <span className="text-muted-foreground">v3.0.0</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
