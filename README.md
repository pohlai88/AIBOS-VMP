# Nexus VMP Canon

A Node.js Express server application implementing the Vendor Management Platform (VMP) with Supabase integration, HTMX-powered partials, and Nunjucks templating.

## Features

- Express.js web server with HTMX integration
- Supabase adapter layer (`vmpAdapter`) for database operations
- Nunjucks templating engine with partial views
- Cookie-based session management
- Mock authentication for Phase 0 development
- Case inbox and detail views

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm package manager
- Supabase project with VMP schema (vmp_* tables)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your configuration:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DEMO_VENDOR_ID=your_vendor_id_from_seed_data
SESSION_SECRET=your-secret-key-change-in-production
PORT=3000
```

3. **Important**: After running your Supabase seed SQL, get the vendor ID:
   - Run `SELECT id FROM vmp_vendors WHERE name = 'Acme Global Supplies';` in Supabase SQL Editor
   - Copy the ID and set it as `DEMO_VENDOR_ID` in your `.env` file

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3000`.

## Project Structure

```
.
├── server.js                    # Main server file with routes and middleware
├── src/
│   ├── adapters/
│   │   └── supabase.js          # VMP adapter layer (vmpAdapter)
│   └── views/
│       ├── pages/
│       │   └── home.html        # Main shell page
│       └── partials/
│           ├── case_inbox.html  # HTMX partial for case list
│           └── case_detail.html # HTMX partial for case details
├── public/                      # Static assets
├── .env                         # Environment variables (gitignored)
└── package.json                 # Project dependencies
```

## Architecture

### Adapter Layer (`src/adapters/supabase.js`)
The `vmpAdapter` provides methods for:
- **Phase 1**: `getVendorContext(userId)` - Load vendor context for a user
- **Phase 2**: `getInbox(vendorId)` - Fetch cases for vendor inbox
- **Phase 2**: `getCaseDetail(caseId, vendorId)` - Fetch case details with security check

### Routes
- `GET /` - Redirects to `/home`
- `GET /home` - Main shell page with case inbox
- `GET /partials/case-inbox` - HTMX endpoint for case list
- `GET /partials/case-detail` - HTMX endpoint for case details

### Mock Authentication (Phase 0)
The server includes mock authentication middleware that auto-logs in as "Acme Admin" for development. This will be replaced with real session lookup in Phase 1.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key) | Yes |
| `DEMO_VENDOR_ID` | Vendor ID from seed data for demo | Yes (Phase 0) |
| `SESSION_SECRET` | Secret key for session encryption | Yes |
| `PORT` | Server port (default: 3000) | No |

## Dependencies

- **express**: Web framework
- **@supabase/supabase-js**: Supabase client library
- **nunjucks**: Templating engine
- **cookie-session**: Session management
- **dotenv**: Environment variable management
- **nodemon**: Development server auto-reload

## Development Phases

- **Phase 0**: Mock auth, hardcoded vendor ID, basic inbox view
- **Phase 1**: Real session lookup, vendor context loading
- **Phase 2**: Case detail with thread and checklist

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Design System](./docs/design-system/)** - Component patterns, utilities, and design specifications
- **[Integrations](./docs/integrations/)** - Figma MCP, Vercel MCP, and other integration guides
- **[Development](./docs/development/)** - IDE setup, code generation, and development workflows
- **[Documentation Standards](./docs/DOCUMENTATION_STANDARDS.md)** - Rules and guidelines for documentation

See [docs/README.md](./docs/README.md) for a complete documentation index.

## License

MIT
