#!/usr/bin/env python3
'''
MCP Server for Notion integration with Egonetics.

This server provides tools to read Notion pages and databases,
and import content directly into the Egonetics system.
'''

from typing import Optional, List, Dict, Any
from enum import Enum
import httpx
import json
from pydantic import BaseModel, Field, field_validator, ConfigDict
from mcp.server.fastmcp import FastMCP, Context

# Initialize the MCP server
mcp = FastMCP("notion_mcp")

# Constants
NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"
EGONETICS_API_BASE = "http://localhost:3000/api"

# Enums
class ResponseFormat(str, Enum):
    '''Output format for tool responses.'''
    MARKDOWN = "markdown"
    JSON = "json"

class ImportTarget(str, Enum):
    '''Target system to import content into.'''
    EGONETICS = "egonetics"

# Pydantic Models for Input Validation
class NotionListPagesInput(BaseModel):
    '''Input model for listing Notion pages.'''
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    query: Optional[str] = Field(default=None, description="Search query to filter pages (optional)")
    limit: Optional[int] = Field(default=20, description="Maximum results to return", ge=1, le=100)
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for human-readable or 'json' for machine-readable"
    )

    @field_validator('query')
    @classmethod
    def validate_query(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Query cannot be empty or whitespace only")
        return v.strip() if v else None

class NotionGetPageInput(BaseModel):
    '''Input model for getting Notion page content.'''
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    page_id: str = Field(..., description="Notion page ID (32-character string, can include dashes)")
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for human-readable or 'json' for machine-readable"
    )

    @field_validator('page_id')
    @classmethod
    def validate_page_id(cls, v: str) -> str:
        # Remove dashes if present
        cleaned = v.replace('-', '')
        if len(cleaned) != 32:
            raise ValueError("Page ID must be 32 characters long (without dashes)")
        return cleaned

class NotionImportPageInput(BaseModel):
    '''Input model for importing Notion page to Egonetics.'''
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid'
    )

    page_id: str = Field(..., description="Notion page ID to import")
    egonetics_task_id: Optional[str] = Field(default=None, description="Optional Egonetics task ID to associate the page with")
    parent_page_id: Optional[str] = Field(default=None, description="Optional parent page ID in Egonetics to import under")

    @field_validator('page_id')
    @classmethod
    def validate_page_id(cls, v: str) -> str:
        cleaned = v.replace('-', '')
        if len(cleaned) != 32:
            raise ValueError("Page ID must be 32 characters long (without dashes)")
        return cleaned

# Shared utility functions
async def _make_notion_request(
    endpoint: str,
    notion_api_key: str,
    method: str = "GET",
    **kwargs
) -> dict:
    '''Reusable function for all Notion API calls.'''
    headers = {
        "Authorization": f"Bearer {notion_api_key}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            f"{NOTION_API_BASE}/{endpoint}",
            headers=headers,
            timeout=30.0,
            **kwargs
        )
        response.raise_for_status()
        return response.json()

async def _make_egonetics_request(
    endpoint: str,
    egonetics_token: str,
    method: str = "GET",
    **kwargs
) -> dict:
    '''Reusable function for all Egonetics API calls.'''
    headers = {
        "Authorization": f"Bearer {egonetics_token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            f"{EGONETICS_API_BASE}/{endpoint}",
            headers=headers,
            timeout=30.0,
            **kwargs
        )
        response.raise_for_status()
        return response.json()

def _handle_api_error(e: Exception) -> str:
    '''Consistent error formatting across all tools.'''
    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code == 404:
            return "Error: Resource not found. Please check the ID is correct."
        elif e.response.status_code == 403:
            return "Error: Permission denied. Make sure your API key has access to this resource and the integration is added to the page/database."
        elif e.response.status_code == 429:
            return "Error: Rate limit exceeded. Please wait before making more requests."
        elif e.response.status_code == 401:
            return "Error: Invalid API key. Please check your Notion API key."
        return f"Error: API request failed with status {e.response.status_code}: {e.response.text}"
    elif isinstance(e, httpx.TimeoutException):
        return "Error: Request timed out. Please try again."
    return f"Error: Unexpected error occurred: {type(e).__name__}: {str(e)}"

def _convert_notion_block_to_markdown(block: Dict[str, Any]) -> str:
    '''Convert a Notion block object to Markdown format.'''
    block_type = block['type']
    block_data = block[block_type]

    if block_type == 'paragraph':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        return f"{text}\n\n"

    elif block_type.startswith('heading_'):
        level = block_type.split('_')[1]
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        return f"{'#' * int(level)} {text}\n\n"

    elif block_type == 'bulleted_list_item':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        return f"- {text}\n"

    elif block_type == 'numbered_list_item':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        return f"1. {text}\n"

    elif block_type == 'to_do':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        checked = block_data['checked']
        return f"- [{'x' if checked else ' '}] {text}\n"

    elif block_type == 'quote':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        return f"> {text}\n\n"

    elif block_type == 'code':
        text = ''.join([t['plain_text'] for t in block_data['rich_text']])
        language = block_data.get('language', '')
        return f"```{language}\n{text}\n```\n\n"

    elif block_type == 'divider':
        return "---\n\n"

    elif block_type == 'image':
        image_type = block_data['type']
        url = block_data[image_type]['url']
        caption = ''.join([t['plain_text'] for t in block_data.get('caption', [])])
        return f"![{caption}]({url})\n\n"

    # Fallback for unsupported block types
    return f"<!-- Unsupported block type: {block_type} -->\n\n"

async def _get_notion_page_content(page_id: str, notion_api_key: str) -> str:
    '''Recursively get all page content and convert to Markdown.'''
    # Get page metadata first
    page = await _make_notion_request(f"pages/{page_id}", notion_api_key=notion_api_key)

    # Get page title
    title = ''
    if 'title' in page['properties']:
        title = ''.join([t['plain_text'] for t in page['properties']['title']['title']])
    elif 'Name' in page['properties']:
        title = ''.join([t['plain_text'] for t in page['properties']['Name']['title']])

    # Get page blocks
    blocks = []
    has_more = True
    next_cursor = None

    while has_more:
        params = {}
        if next_cursor:
            params['start_cursor'] = next_cursor

        blocks_response = await _make_notion_request(
            f"blocks/{page_id}/children",
            notion_api_key=notion_api_key,
            params=params
        )

        blocks.extend(blocks_response['results'])
        has_more = blocks_response['has_more']
        next_cursor = blocks_response['next_cursor']

    # Convert blocks to Markdown
    markdown = f"# {title}\n\n"
    for block in blocks:
        markdown += _convert_notion_block_to_markdown(block)

        # Handle children blocks (nested content)
        if block['has_children']:
            # TODO: Handle nested blocks (indentation)
            child_blocks = []
            child_has_more = True
            child_cursor = None

            while child_has_more:
                child_params = {}
                if child_cursor:
                    child_params['start_cursor'] = child_cursor

                child_response = await _make_notion_request(
                    f"blocks/{block['id']}/children",
                    notion_api_key=notion_api_key,
                    params=child_params
                )

                child_blocks.extend(child_response['results'])
                child_has_more = child_response['has_more']
                child_cursor = child_response['next_cursor']

            for child in child_blocks:
                markdown += "  " + _convert_notion_block_to_markdown(child)

    return markdown

# Tool definitions
@mcp.tool(
    name="notion_list_pages",
    annotations={
        "title": "List Notion Pages",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def notion_list_pages(params: NotionListPagesInput, ctx: Context) -> str:
    '''List all pages available to the Notion integration.

    This tool searches across all pages and databases that the Notion integration
    has been granted access to. You can filter results with a search query.

    Args:
        params (NotionListPagesInput): Validated input parameters containing:
            - query (Optional[str]): Search string to filter pages
            - limit (Optional[int]): Maximum results to return (1-100, default: 20)
            - response_format (ResponseFormat): Output format

    Returns:
        str: List of pages with titles, IDs, and last edited times.

    Examples:
        - Use when: "Show me all my Notion pages" -> default params
        - Use when: "Find pages about 'project management'" -> query="project management"

    Notes:
        - You must add the Notion integration to each page you want to access
        - Pages not shared with the integration will not appear in results
    '''
    try:
        # Elicit Notion API key from user
        notion_api_key = await ctx.elicit(
            prompt="Please enter your Notion API key:",
            input_type="password"
        )

        # Prepare search request
        body = {
            "query": params.query or "",
            "filter": {
                "value": "page",
                "property": "object"
            },
            "page_size": params.limit
        }

        data = await _make_notion_request(
            "search",
            method="POST",
            notion_api_key=notion_api_key,
            json=body
        )

        pages = []
        for result in data.get('results', []):
            # Extract page title
            title = ''
            if 'properties' in result and 'title' in result['properties']:
                title = ''.join([t['plain_text'] for t in result['properties']['title']['title']])
            elif 'properties' in result and 'Name' in result['properties']:
                title = ''.join([t['plain_text'] for t in result['properties']['Name']['title']])

            pages.append({
                "id": result['id'],
                "title": title or "Untitled Page",
                "url": result['url'],
                "last_edited_time": result['last_edited_time'],
                "created_time": result['created_time']
            })

        if not pages:
            return "No pages found. Make sure you've added the Notion integration to your pages."

        # Format response based on requested format
        if params.response_format == ResponseFormat.MARKDOWN:
            lines = [f"# Notion Pages (found {len(pages)})", ""]
            for page in pages:
                lines.append(f"## {page['title']}")
                lines.append(f"- **ID**: `{page['id']}`")
                lines.append(f"- **URL**: {page['url']}")
                lines.append(f"- **Last edited**: {page['last_edited_time'][:10]}")
                lines.append("")

            return "\n".join(lines)

        else:
            # Machine-readable JSON format
            return json.dumps({
                "total": len(pages),
                "pages": pages
            }, indent=2, ensure_ascii=False)

    except Exception as e:
        return _handle_api_error(e)

@mcp.tool(
    name="notion_get_page",
    annotations={
        "title": "Get Notion Page Content",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def notion_get_page(params: NotionGetPageInput, ctx: Context) -> str:
    '''Get the full content of a Notion page in Markdown format.

    This tool retrieves all blocks from a Notion page and converts them to
    clean Markdown format, including headings, lists, code blocks, images, etc.

    Args:
        params (NotionGetPageInput): Validated input parameters containing:
            - page_id (str): Notion page ID (32 characters, dashes optional)
            - response_format (ResponseFormat): Output format

    Returns:
        str: Full page content in the requested format.

    Examples:
        - Use when: "Show me the content of page abc123" -> page_id="abc123"
        - Use when: "Extract the content of this Notion page" -> provide page ID

    Notes:
        - The integration must have access to the page
        - Large pages may take a few seconds to process
    '''
    try:
        # Elicit Notion API key from user
        notion_api_key = await ctx.elicit(
            prompt="Please enter your Notion API key:",
            input_type="password"
        )

        markdown_content = await _get_notion_page_content(params.page_id, notion_api_key)

        if params.response_format == ResponseFormat.MARKDOWN:
            return markdown_content
        else:
            return json.dumps({
                "page_id": params.page_id,
                "content": markdown_content
            }, indent=2, ensure_ascii=False)

    except Exception as e:
        return _handle_api_error(e)

@mcp.tool(
    name="notion_import_page_to_egonetics",
    annotations={
        "title": "Import Notion Page to Egonetics",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def notion_import_page_to_egonetics(params: NotionImportPageInput, ctx: Context) -> str:
    '''Import a Notion page directly into the Egonetics system.

    This tool converts a Notion page to Markdown and creates a new page in
    Egonetics with the same content. You can optionally associate it with
    a task or parent page.

    Args:
        params (NotionImportPageInput): Validated input parameters containing:
            - page_id (str): Notion page ID to import
            - egonetics_task_id (Optional[str]): Task ID to associate with
            - parent_page_id (Optional[str]): Parent page ID in Egonetics

    Returns:
        str: Confirmation message with the new Egonetics page ID.

    Examples:
        - Use when: "Import page abc123 to Egonetics" -> page_id="abc123"
        - Use when: "Import this page to task task-123" -> page_id="abc123", egonetics_task_id="task-123"

    Notes:
        - Requires both Notion API key and Egonetics auth token
        - Page structure and formatting are preserved in Markdown
    '''
    try:
        # Get required credentials
        notion_api_key = await ctx.elicit(
            prompt="Please enter your Notion API key:",
            input_type="password"
        )

        egonetics_token = await ctx.elicit(
            prompt="Please enter your Egonetics auth token:",
            input_type="password"
        )

        # Get Notion page content
        page_content = await _get_notion_page_content(params.page_id, notion_api_key)

        # Extract title from content (first line)
        title = "Imported from Notion"
        if page_content.startswith('# '):
            title = page_content.split('\n')[0][2:].strip()
            # Remove title from content
            page_content = '\n'.join(page_content.split('\n')[2:])

        # Create page in Egonetics
        page_data = {
            "title": title,
            "icon": "📄",
            "type": "task" if params.egonetics_task_id else "page",
            "refId": params.egonetics_task_id,
            "parentId": params.parent_page_id
        }

        new_page = await _make_egonetics_request(
            "pages",
            method="POST",
            egonetics_token=egonetics_token,
            json=page_data
        )

        # Save blocks to the new page
        # Convert Markdown to blocks (simplified for now, just one text block)
        blocks = [{
            "id": "block-1",
            "type": "paragraph",
            "parentId": None,
            "position": 1,
            "content": {
                "rich_text": [{"text": page_content}]
            }
        }]

        await _make_egonetics_request(
            f"pages/{new_page['id']}/blocks",
            method="PUT",
            egonetics_token=egonetics_token,
            json=blocks
        )

        return f"""✅ Page imported successfully!
- **New Page ID**: `{new_page['id']}`
- **Title**: {new_page['title']}
- **URL**: http://localhost:3000/theory#{new_page['id']}
"""

    except Exception as e:
        return _handle_api_error(e)

if __name__ == "__main__":
    mcp.run()
