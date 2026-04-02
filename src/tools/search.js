export async function web_search({ query, num_results = 5 }) {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodedQuery}`);
  const html = await response.text();

  const results = [];
  const regex = /<a class="result-link" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<td class="result-snippet">([\s\S]*?)<\/td>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null && results.length < num_results) {
    results.push({
      url: match[1],
      title: match[2].trim(),
      snippet: match[3].replace(/<[^>]+>/g, '').trim()
    });
  }

  return results;
}
