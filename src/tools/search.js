export async function web_search({ query, num_results = 5 }) {
  const q = encodeURIComponent(query);
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${q}`);
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const html = await response.text();

  const results = [];
  // DuckDuckGo Lite has no official API; this parser depends on current markup.
  const rowRegex = /<a rel="nofollow" class="result-link" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>([\s\S]*?)<\/td>/g;
  const sanitize = (text) => text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;')
    .trim();

  let match;
  while ((match = rowRegex.exec(html)) && results.length < num_results) {
    results.push({
      url: match[1],
      title: sanitize(match[2]),
      snippet: sanitize(match[3])
    });
  }

  return results;
}
