export async function web_search({ query, num_results = 5 }) {
  const q = encodeURIComponent(query);
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${q}`);
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const html = await response.text();

  const results = [];
  const rowRegex = /<a rel="nofollow" class="result-link" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>([\s\S]*?)<\/td>/g;

  let match;
  while ((match = rowRegex.exec(html)) && results.length < num_results) {
    results.push({
      url: match[1],
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      snippet: match[3].replace(/<[^>]+>/g, '').trim()
    });
  }

  return results;
}
