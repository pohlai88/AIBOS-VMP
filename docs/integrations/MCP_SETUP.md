# Vercel MCP Setup

This project includes a minimal MCP configuration in `mcp.config.json`:

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com"
    }
  }
}
```

## Install / Download

- Clone the official MCP repository if you plan to run servers locally:

```powershell
git clone https://github.com/vercel/mcp.git
cd mcp
npm install
npm run build
```

- Alternatively, integrate MCP clients via the Vercel AI SDK or an MCP client:

```powershell
cd D:\AIBOS-VMP
npm install ai
```

Refer to the SDK docs to configure your client to read `mcp.config.json` and connect to the `vercel` MCP server.

## Usage Notes

- The `url` endpoint (`https://mcp.vercel.com`) is the remote MCP server; depending on the client, you may need API keys or auth configuration.
- Keep `mcp.config.json` in the project root so your MCP-aware tools or SDK can discover it.
- If you use a different MCP client, map the configuration accordingly (some clients expect `mcp.json` or a framework-specific config file).

## Next Steps

- Wire a small client script in your app that loads `mcp.config.json` and initializes the MCP connection using your chosen SDK.
- Add required credentials (if any) to your environment or client configuration.
- Commit and push, then verify MCP connectivity in your deployment or local dev.
