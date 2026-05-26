/**
 * Chrome profil aniqlash API.
 */
import { listChromeProfiles, chromeRootDir } from '../services/chrome-finder.js';

export default async function chromeRoutes(fastify) {
  // GET /api/chrome/profiles
  fastify.get('/profiles', async () => {
    const profiles = listChromeProfiles();
    return {
      root: chromeRootDir(),
      profiles: profiles.map(p => ({
        name: p.name,
        displayName: p.displayName,
        path: p.path,
        lastUsed: p.lastUsed ? new Date(p.lastUsed / 1000 - 11644473600000).toISOString() : null,
      })),
    };
  });
}
