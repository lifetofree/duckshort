# Project Agents & Specifications: Minimal Edge URL Shortener

This document outlines the architecture, specifications, and implementation steps for the personal URL shortener.

## Overview
A high-performance, personal URL shortener built on **Cloudflare Workers** and **Cloudflare D1**. It focuses on simplicity, scalability, and click tracking without a member system.

## Specifications

### Core Components
- **Platform**: Cloudflare Workers (Globally distributed edge execution).
- **Database**: Cloudflare D1 (Serverless SQL).
- **Security**: Simple token-based authentication (`X-Auth-Token`) for shortening links.

### Data Model (`links` table)
- `id`: `TEXT PRIMARY KEY` (Short code).
- `url`: `TEXT NOT NULL` (Original destination).
- `clicks`: `INTEGER DEFAULT 0` (Redirection counter).
- `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`.

### API Endpoints
- `GET /:id`: Redirects to the target URL and increments the click counter.
- `POST /shorten`: Creates a new short link (requires `X-Auth-Token`).
- `GET /stats/:id`: Returns click statistics for a specific link.

---

## Implementation Plan

### 1. Database Schema (`schema.sql`)
```sql
DROP TABLE IF EXISTS links;
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Core Worker Logic (`src/index.js`)
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // 1. Redirection Handler
    if (request.method === 'GET' && path && !path.startsWith('stats') && !path.startsWith('shorten')) {
      const { results } = await env.DB.prepare('SELECT url FROM links WHERE id = ?').bind(path).all();
      if (results.length > 0) {
        // Increment clicks asynchronously
        await env.DB.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').bind(path).run();
        return Response.redirect(results[0].url, 302);
      }
      return new Response('Link not found', { status: 404 });
    }

    // 2. Shorten Handler
    if (request.method === 'POST' && path === 'shorten') {
      const authHeader = request.headers.get('X-Auth-Token');
      if (authHeader !== env.AUTH_TOKEN) return new Response('Unauthorized', { status: 401 });

      try {
        const { longUrl, customId } = await request.json();
        const shortId = customId || Math.random().toString(36).substring(2, 8);

        await env.DB.prepare('INSERT INTO links (id, url) VALUES (?, ?)').bind(shortId, longUrl).run();
        return Response.json({ 
          success: true, 
          shortUrl: `${url.origin}/${shortId}`, 
          id: shortId 
        });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    // 3. Stats Handler
    if (request.method === 'GET' && path.startsWith('stats/')) {
      const id = path.split('/')[1];
      const stats = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first();
      return stats ? Response.json(stats) : new Response('Not found', { status: 404 });
    }

    return new Response('URL Shortener Edge is running.', { status: 200 });
  }
};
```

### 3. Configuration (`wrangler.toml`)
```toml
name = "url-shortener-edge"
main = "src/index.js"
compatibility_date = "2024-04-01"

[[d1_databases]]
binding = "DB"
database_name = "url-shortener-db"
database_id = "YOUR_D1_DATABASE_ID"

[vars]
AUTH_TOKEN = "your-secret-token"
```

### 4. Setup Instructions
1. **Initialize**: `mkdir url-shortener-edge && cd url-shortener-edge && npx wrangler init . -y`
2. **Database**: `npx wrangler d1 create url-shortener-db` (Copy ID to `wrangler.toml`)
3. **Execute Schema**: `npx wrangler d1 execute url-shortener-db --file=./schema.sql`
4. **Deploy**: `npx wrangler deploy`
