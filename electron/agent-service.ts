import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

export interface Agent {
  id: string
  name: string
  role: string
  goal: string
  backstory: string
  tools: string[] // Array of toolkit IDs
  knowledgeBase?: {
    files: string[] // File paths
    chromaCollectionId?: string
  }
  modelConfig?: {
    model: string
    temperature: number
    maxTokens: number
  }
  createdAt: string
  updatedAt: string
}

export interface AgentFile {
  id: string
  agentId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

export class AgentDatabaseService {
  private db: Database.Database

  constructor(dbPath?: string) {
    const userDataPath = app.getPath('userData')
    const defaultDbPath = path.join(userDataPath, 'agents.db')
    this.db = new Database(dbPath || defaultDbPath)
    this.initDatabase()
  }

  private initDatabase() {
    // Create agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        goal TEXT NOT NULL,
        backstory TEXT NOT NULL,
        tools TEXT NOT NULL,
        knowledge_base TEXT,
        model_config TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Create agent_files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_files (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_files_agent_id ON agent_files(agent_id);
    `)
  }

  // Create a new agent
  createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const id = uuidv4()
    const now = new Date().toISOString()
    
    const newAgent: Agent = {
      ...agent,
      id,
      createdAt: now,
      updatedAt: now
    }

    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, role, goal, backstory, tools, knowledge_base, model_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      newAgent.id,
      newAgent.name,
      newAgent.role,
      newAgent.goal,
      newAgent.backstory,
      JSON.stringify(newAgent.tools),
      newAgent.knowledgeBase ? JSON.stringify(newAgent.knowledgeBase) : null,
      newAgent.modelConfig ? JSON.stringify(newAgent.modelConfig) : null,
      newAgent.createdAt,
      newAgent.updatedAt
    )

    return newAgent
  }

  // Get all agents
  getAllAgents(): Agent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agents ORDER BY created_at DESC
    `)
    
    const rows = stmt.all() as any[]
    return rows.map(row => this.rowToAgent(row))
  }

  // Get agent by ID
  getAgentById(id: string): Agent | null {
    const stmt = this.db.prepare(`
      SELECT * FROM agents WHERE id = ?
    `)
    
    const row = stmt.get(id) as any
    return row ? this.rowToAgent(row) : null
  }

  // Update agent
  updateAgent(id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>): Agent | null {
    const existing = this.getAgentById(id)
    if (!existing) return null

    const updatedAgent: Agent = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    const stmt = this.db.prepare(`
      UPDATE agents
      SET name = ?, role = ?, goal = ?, backstory = ?, tools = ?, 
          knowledge_base = ?, model_config = ?, updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      updatedAgent.name,
      updatedAgent.role,
      updatedAgent.goal,
      updatedAgent.backstory,
      JSON.stringify(updatedAgent.tools),
      updatedAgent.knowledgeBase ? JSON.stringify(updatedAgent.knowledgeBase) : null,
      updatedAgent.modelConfig ? JSON.stringify(updatedAgent.modelConfig) : null,
      updatedAgent.updatedAt,
      id
    )

    return updatedAgent
  }

  // Delete agent
  deleteAgent(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM agents WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }

  // Add file to agent's knowledge base
  addAgentFile(agentId: string, file: Omit<AgentFile, 'id' | 'agentId' | 'uploadedAt'>): AgentFile | null {
    const agent = this.getAgentById(agentId)
    if (!agent) return null

    const id = uuidv4()
    const uploadedAt = new Date().toISOString()

    const agentFile: AgentFile = {
      ...file,
      id,
      agentId,
      uploadedAt
    }

    const stmt = this.db.prepare(`
      INSERT INTO agent_files (id, agent_id, file_name, file_path, file_size, mime_type, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      agentFile.id,
      agentFile.agentId,
      agentFile.fileName,
      agentFile.filePath,
      agentFile.fileSize,
      agentFile.mimeType,
      agentFile.uploadedAt
    )

    // Update agent's knowledge base
    const files = this.getAgentFiles(agentId).map(f => f.filePath)
    this.updateAgent(agentId, {
      knowledgeBase: {
        ...agent.knowledgeBase,
        files
      }
    })

    return agentFile
  }

  // Get files for an agent
  getAgentFiles(agentId: string): AgentFile[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_files WHERE agent_id = ? ORDER BY uploaded_at DESC
    `)
    
    return stmt.all(agentId) as AgentFile[]
  }

  // Delete file from agent's knowledge base
  deleteAgentFile(fileId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM agent_files WHERE id = ?`)
    const result = stmt.run(fileId)
    return result.changes > 0
  }

  private rowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      goal: row.goal,
      backstory: row.backstory,
      tools: JSON.parse(row.tools),
      knowledgeBase: row.knowledge_base ? JSON.parse(row.knowledge_base) : undefined,
      modelConfig: row.model_config ? JSON.parse(row.model_config) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  close() {
    this.db.close()
  }
}


