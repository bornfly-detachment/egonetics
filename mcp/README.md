# Notion MCP Server for Egonetics

MCP (Model Context Protocol) server that enables Claude to read your Notion pages and import them directly into Egonetics.

## Features
- 🔍 **List Notion Pages**: Search and browse all pages shared with your integration
- 📝 **Get Page Content**: Extract full page content in clean Markdown format
- 🚀 **Import to Egonetics**: One-click import of Notion pages directly into your Egonetics knowledge base
- 🔒 **Secure**: Credentials are never stored, requested interactively when needed

## Setup Instructions

### 1. Create Notion Integration
1. Go to [Notion Developers](https://www.notion.so/my-integrations)
2. Create a new integration:
   - Name: "Egonetics MCP"
   - Associated workspace: Select your workspace
   - Capabilities: Check "Read content" (no edit permissions needed)
3. Copy your Internal Integration Token (starts with `secret_`)

### 2. Share Pages with Integration
For every page/database you want to access:
1. Open the page in Notion
2. Click "Share" in the top right
3. Click "Invite" and select your "Egonetics MCP" integration
4. Click "Invite" to grant access

### 3. Install Dependencies
```bash
cd mcp
pip install -r requirements.txt
```

### 4. Configure Claude Code to Use the MCP Server
Add this to your Claude Code settings (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "notion": {
      "command": "python",
      "args": ["/path/to/egonetics/mcp/notion_mcp.py"]
    }
  }
}
```
Replace `/path/to/egonetics/` with the actual path to your Egonetics repository.

### 5. Restart Claude Code
Restart Claude Code for the MCP server to be loaded.

## Usage Examples

### List all your Notion pages
```
List all my Notion pages
```

### Get content of a specific page
```
Get the content of Notion page abc123def456ghi789jkl012mnop345qrs
```

### Import a page to Egonetics
```
Import Notion page abc123def456ghi789jkl012mnop345qrs to Egonetics
```

### Import a page and associate it with a task
```
Import Notion page abc123def456ghi789jkl012mnop345qrs to task task-123
```

## Available Tools

### `notion_list_pages`
List all pages available to the integration.
- **Parameters**:
  - `query` (optional): Search query to filter pages
  - `limit` (optional): Max results (1-100, default: 20)
  - `response_format`: `markdown` or `json`

### `notion_get_page`
Get full content of a Notion page in Markdown format.
- **Parameters**:
  - `page_id`: Notion page ID (32 characters, dashes optional)
  - `response_format`: `markdown` or `json`

### `notion_import_page_to_egonetics`
Import a Notion page directly into Egonetics.
- **Parameters**:
  - `page_id`: Notion page ID to import
  - `egonetics_task_id` (optional): Associate the page with a specific task
  - `parent_page_id` (optional): Import under a specific parent page

## Troubleshooting
- **No pages found**: Make sure you've shared the page with your Notion integration
- **Permission denied**: Double-check that the integration has access to the page
- **Invalid API key**: Verify your Notion integration token is correct
- **Egonetics import failed**: Make sure your Egonetics server is running on localhost:3000 and you provide a valid auth token
