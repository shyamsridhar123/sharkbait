/**
 * Fetch Tools - Web page fetching and content extraction
 */

import type { Tool } from "./registry";

/**
 * Extract readable content from HTML
 * Simple extraction - strips scripts, styles, and extracts text
 */
function extractContent(html: string): string {
  // Remove scripts and styles
  let content = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

  // Extract title
  const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1]?.trim() : "";

  // Extract meta description
  const descMatch = content.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1]?.trim() : "";

  // Extract main content areas (article, main, or body)
  let mainContent = "";
  const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  
  if (articleMatch) {
    mainContent = articleMatch[1] || "";
  } else if (mainMatch) {
    mainContent = mainMatch[1] || "";
  } else {
    // Fall back to body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    mainContent = bodyMatch ? bodyMatch[1] || "" : content;
  }

  // Strip remaining HTML tags
  mainContent = mainContent
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // Build result
  let result = "";
  if (title) {
    result += `# ${title}\n\n`;
  }
  if (description) {
    result += `> ${description}\n\n`;
  }
  result += mainContent;

  // Truncate if too long (keep first 50KB)
  if (result.length > 50000) {
    result = result.substring(0, 50000) + "\n\n[Content truncated...]";
  }

  return result;
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): Array<{ text: string; href: string }> {
  const links: Array<{ text: string; href: string }> = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] || "";
    const text = match[2]?.trim() || "";
    
    if (text && href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      try {
        const fullUrl = new URL(href, baseUrl).href;
        links.push({ text, href: fullUrl });
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return links.slice(0, 50); // Limit to 50 links
}

export const fetchTools: Tool[] = [
  {
    name: "fetch_webpage",
    description: "Fetch and extract readable content from a web page URL. Returns the main text content with title and description.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the web page to fetch" },
        includeLinks: { type: "boolean", description: "Also extract links from the page" },
        raw: { type: "boolean", description: "Return raw HTML instead of extracted content" },
      },
      required: ["url"],
    },
    async execute({ url, includeLinks, raw }) {
      const targetUrl = url as string;

      // Validate URL
      try {
        new URL(targetUrl);
      } catch {
        throw new Error(`Invalid URL: ${targetUrl}`);
      }

      try {
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Sharkbait/1.0; +https://github.com/sharkbait)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";
        
        // Handle non-HTML content
        if (!contentType.includes("html")) {
          const text = await response.text();
          return {
            url: targetUrl,
            contentType,
            content: text.substring(0, 50000),
            isHtml: false,
          };
        }

        const html = await response.text();

        if (raw) {
          return {
            url: targetUrl,
            contentType,
            content: html.substring(0, 100000),
            isHtml: true,
          };
        }

        const content = extractContent(html);
        const result: Record<string, unknown> = {
          url: targetUrl,
          content,
          isHtml: true,
        };

        if (includeLinks) {
          result["links"] = extractLinks(html, targetUrl);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch ${targetUrl}: ${message}`);
      }
    },
  },

  {
    name: "fetch_json",
    description: "Fetch JSON from a URL (API endpoint)",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch JSON from" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method" },
        body: { type: "string", description: "Request body (for POST/PUT)" },
        headers: { type: "object", description: "Additional headers" },
      },
      required: ["url"],
    },
    async execute({ url, method, body, headers }) {
      const targetUrl = url as string;
      const httpMethod = (method as string) || "GET";

      try {
        new URL(targetUrl);
      } catch {
        throw new Error(`Invalid URL: ${targetUrl}`);
      }

      const requestHeaders: Record<string, string> = {
        "Accept": "application/json",
        "User-Agent": "Sharkbait/1.0",
        ...(headers as Record<string, string> || {}),
      };

      if (body && (httpMethod === "POST" || httpMethod === "PUT")) {
        requestHeaders["Content-Type"] = "application/json";
      }

      try {
        const response = await fetch(targetUrl, {
          method: httpMethod,
          headers: requestHeaders,
          body: body ? (body as string) : undefined,
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 500)}`);
        }

        try {
          return JSON.parse(responseText);
        } catch {
          return { raw: responseText };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch ${targetUrl}: ${message}`);
      }
    },
  },

  {
    name: "web_search",
    description: "Search the web using DuckDuckGo (no API key required). Returns search results.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Maximum results to return (default: 10)" },
      },
      required: ["query"],
    },
    async execute({ query, maxResults }) {
      const searchQuery = query as string;
      const limit = (maxResults as number) || 10;

      // Use DuckDuckGo HTML search (no API key needed)
      const encodedQuery = encodeURIComponent(searchQuery);
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

      try {
        const response = await fetch(ddgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          throw new Error(`Search failed: HTTP ${response.status}`);
        }

        const html = await response.text();

        // Parse DuckDuckGo HTML results
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi;
        
        let match;
        while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
          const url = match[1] || "";
          const title = match[2]?.trim() || "";
          const snippet = (match[3] || "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (url && title && !url.includes("duckduckgo.com")) {
            // DuckDuckGo wraps URLs - extract actual URL
            const actualUrl = decodeURIComponent(url.replace(/^.*uddg=/, "").split("&")[0] || url);
            results.push({ title, url: actualUrl, snippet });
          }
        }

        // Fallback regex for different DDG format
        if (results.length === 0) {
          const altRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
          while ((match = altRegex.exec(html)) !== null && results.length < limit) {
            const url = match[1] || "";
            const title = match[2]?.trim() || "";
            if (url && title && !url.includes("duckduckgo.com")) {
              results.push({ title, url, snippet: "" });
            }
          }
        }

        return {
          query: searchQuery,
          resultCount: results.length,
          results,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Web search failed: ${message}`);
      }
    },
  },
];
