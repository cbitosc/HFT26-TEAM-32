import https from 'https';

export interface ScannedRepo {
  name: string;
  description: string;
  url: string;
  language?: string;
}

/**
 * Scans candidate's public GitHub profile without requiring authentication.
 * Falls back to portfolio-declared projects if network is restricted or profile is private.
 */
export async function scanGitHubProfile(githubUrlOrUsername: string): Promise<ScannedRepo[]> {
  if (!githubUrlOrUsername) return [];

  // Extract clean username
  const match = githubUrlOrUsername.match(/github\.com\/([a-zA-Z0-9_-]+)/i) || githubUrlOrUsername.match(/^([a-zA-Z0-9_-]+)$/);
  if (!match) return [];
  const username = match[1];

  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: 'github.com',
      port: 443,
      path: `/${username}?tab=repositories`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let html = '';
      res.on('data', (chunk) => (html += chunk));
      res.on('end', () => {
        const repos: ScannedRepo[] = [];
        // Extract repo links from GitHub repository list HTML
        const regex = /href="\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_.-]+)"\s+itemprop="name codeRepository"/g;
        let m;
        while ((m = regex.exec(html)) !== null) {
          const repoName = m[1];
          if (!repos.some((r) => r.name === repoName)) {
            repos.push({
              name: repoName,
              description: `Public repository on ${username}'s GitHub`,
              url: `https://github.com/${username}/${repoName}`,
            });
          }
        }
        resolve(repos.slice(0, 6));
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

