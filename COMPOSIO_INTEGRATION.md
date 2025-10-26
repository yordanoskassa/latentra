# Composio Tool Router Integration

This document explains how to use the Composio Tool Router integration in Latentra.

## Overview

The Composio Tool Router provides access to 500+ tool integrations with automatic authentication, tool discovery, and execution. This integration allows your AI agents to interact with external services like Gmail, Slack, GitHub, Google Calendar, and many more.

## Features

✅ **Automatic Tool Discovery** - Browse and search through 500+ available integrations  
✅ **Authentication Management** - Handle OAuth2, OAuth1, API Keys, and Bearer Tokens  
✅ **Connection Status** - Track which tools are connected and ready to use  
✅ **Visual Tool Selection** - Easy-to-use interface for selecting tools for your agents  
✅ **Local Storage** - Connections and API keys stored securely in localStorage  

## Getting Started

### 1. Get Your Composio API Key

1. Visit [Composio](https://app.composio.dev/signup) and create a free account
2. Navigate to [Settings](https://app.composio.dev/settings)
3. Copy your API key

### 2. Configure Composio API Key

Set the `COMPOSIO_API_KEY` environment variable before starting Latentra:

**macOS/Linux:**
```bash
export COMPOSIO_API_KEY="your-api-key-here"
./latentra
```

**Windows:**
```cmd
set COMPOSIO_API_KEY=your-api-key-here
latentra.exe
```

**Or add it to your shell profile:**
```bash
# Add to ~/.zshrc or ~/.bashrc
export COMPOSIO_API_KEY="your-api-key-here"
```

### 3. Verify Configuration

1. Open Latentra
2. Navigate to **Composio** in the sidebar
3. Check that the API key status shows as configured

### 4. Create an Agent with Tools

1. Navigate to **Agents** in the sidebar
2. Click **Create Agent**
3. Fill in the agent details (Step 1):
   - Agent name
   - Description (optional)
   - System prompt
4. Configure data sources (Step 2) - Coming soon
5. Select tools (Step 3):
   - Browse available tools
   - Search for specific integrations
   - Connect tools that require authentication
   - Select tools to add to your agent
6. Click **Save Agent**

### 5. Using the Tool Router Manager

The Tool Router Manager in Step 3 of the agent builder provides:

#### Search & Filter
- **Search**: Find tools by name or description
- **Filters**:
  - `all` - Show all available tools
  - `connected` - Show only connected tools
  - `selected` - Show only tools selected for this agent

#### Tool Cards
Each tool card shows:
- Tool logo
- Tool name and description
- Authentication type badge (OAuth2, OAuth1, API Key, Bearer Token)
- Connection status indicator
- Action buttons (Connect/Select)

#### Connecting Tools

1. Click **Connect** on a tool card
2. A dialog will open with an authentication URL
3. Click **Open Auth Page** to authorize in your browser
4. Complete the OAuth flow or enter credentials
5. Return to Latentra and click **I've completed authentication**
6. The tool will now show as connected with a green checkmark

#### Managing Connections

View and manage all your tool connections in the **Composio** → **Connections** tab:
- See all connected tools
- View connection status
- Disconnect tools you no longer need
- See when tools were last used

## Available Tools

The integration includes 500+ tools across categories:

### Communication
- Gmail, Outlook, Slack, Discord, Twitter

### Productivity  
- Google Calendar, Google Docs, Google Sheets, Google Drive, Notion, Asana, Trello, Linear

### Development
- GitHub, GitLab, Sentry

### CRM & Marketing
- HubSpot, Salesforce

### File Storage
- Google Drive, OneDrive, Dropbox

### And many more...

## Architecture

### Components

1. **ToolRouterManager** (`src/components/chat/ToolRouterManager.tsx`)
   - Main component for tool discovery and selection
   - Handles tool authentication flow
   - Manages tool selection state

2. **ComposioSettings** (`src/components/chat/ComposioSettings.tsx`)
   - API key configuration
   - Connection management
   - Settings and preferences

3. **AgentBuilder** (Updated)
   - Integrated ToolRouterManager in Step 3
   - Stores selected tools with agent configuration

### Data Storage

Data is stored as follows:

- `COMPOSIO_API_KEY` - Environment variable for your Composio API key
- `composio-connections` - localStorage for connected tool information  
- `ai-agents` - localStorage for agent configurations including selected tools

## Production Integration

For production use, you would integrate with the actual Composio API:

```typescript
import { Composio } from '@composio/core'

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY
})

// Create a Tool Router session
const session = await composio.experimental.tool_router.create_session({
  user_id: "user@example.com",
  toolkits: ["gmail", "github", "slack"]
})

// Use the session URL with your AI agent
console.log(session.url)
```

## Security Considerations

1. **API Keys**: Store Composio API keys in environment variables, never commit them to version control
2. **Sessions**: Generate new session URLs for each conversation
3. **Permissions**: Only grant necessary tool permissions
4. **Token Storage**: Never expose session URLs or tokens to the client
5. **User Auth**: Implement proper user authentication in production
6. **Environment Files**: Add `.env` files to `.gitignore`

## Troubleshooting

### API Key Not Configured
- Verify the COMPOSIO_API_KEY environment variable is set
- Restart Latentra after setting the environment variable
- Check that you copied the full key without spaces
- Ensure your Composio account is active

### Tool Connection Failed
- Check your internet connection
- Ensure you completed the OAuth flow
- Try disconnecting and reconnecting
- Verify the tool service is not experiencing downtime

### Tools Not Appearing
- Verify your API key is configured
- Check the search filters
- Refresh the page

## Resources

- [Composio Documentation](https://docs.composio.dev/)
- [Composio Dashboard](https://app.composio.dev/)
- [Tool Router Quick Start](https://docs.composio.dev/tool-router)
- [Available Integrations](https://docs.composio.dev/integrations)

## Support

For issues related to:
- **Latentra**: Open an issue in the Latentra repository
- **Composio**: Visit [Composio Support](https://docs.composio.dev/support)

## Future Enhancements

- [ ] Real-time tool execution
- [ ] Tool usage analytics
- [ ] Custom tool creation
- [ ] Workflow automation
- [ ] Multi-agent tool sharing
- [ ] Tool permission management

