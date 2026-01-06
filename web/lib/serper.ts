
export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

export async function performSearch(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn("SERPER_API_KEY is not set.");
        return [];
    }

    const url = 'https://google.serper.dev/search';
    const data = JSON.stringify({
        q: `site:lovdata.no OR site:SNL.no OR site:jusinfo.no ${query}`,
        num: 15
    });

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: data
    };

    const response = await fetch(url, requestOptions);
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Serper API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const result = await response.json();
    return result.organic || [];
}

export async function searchLegalSources(query: string) {
    const results = await performSearch(query);

    // Format results for the LLM
    if (results.length > 0) {
        return results.map((item: SearchResult) => `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`).join('\n\n');
    } else {
        return "No results found on lovdata.no or SNL.no or wikipedia.org for this query.";
    }
}
