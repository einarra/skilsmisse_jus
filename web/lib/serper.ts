
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
        q: `site:jusinfo.no OR site:lovdata.no ${query}`,
        num: 20
    });

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: data
    };

    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`Serper API error: ${response.statusText}`);
        }
        const result = await response.json();
        return result.organic || [];
    } catch (error) {
        console.error("Error searching legal sources:", error);
        return [];
    }
}

export async function searchLegalSources(query: string) {
    const results = await performSearch(query);

    // Format results for the LLM
    if (results.length > 0) {
        return results.map((item: any) => `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`).join('\n\n');
    } else {
        return "No results found on jusinfo.no or lovdata.no for this query.";
    }
}
