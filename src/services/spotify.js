import axios from 'axios';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.replace(/['"]/g, '').trim();
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET?.replace(/['"]/g, '').trim();

let accessToken = '';
let tokenExpiry = 0;

/**
 * Obtiene un token de acceso usando el Client Credentials Flow.
 * Nota: En producción, esto debería hacerse desde un backend para no exponer el CLIENT_SECRET.
 */
async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
            }
        });

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        return accessToken;
    } catch (error) {
        console.error('Error obteniendo el token de Spotify:', error);
        throw error;
    }
}

export const spotifyService = {
    async searchTracks(query) {
        if (!query) return [];

        try {
            const token = await getAccessToken();
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    q: query,
                    type: 'track',
                    limit: 10
                }
            });

            return response.data.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                artistId: track.artists[0]?.id, // Guardamos el ID del primer artista
                albumArt: track.album.images[0]?.url || '',
                spotifyUrl: track.external_urls.spotify
            }));
        } catch (error) {
            console.error('Error buscando tracks en Spotify:', error);
            return [];
        }
    },

    async getRecommendations(customQuery = 'tag:new genre:pop') {
        try {
            const token = await getAccessToken();
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: customQuery,
                    type: 'track',
                    limit: 10
                }
            });

            if (response.data.tracks && response.data.tracks.items) {
                return response.data.tracks.items.map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    artistId: track.artists[0]?.id,
                    albumArt: track.album.images[0]?.url || '',
                    spotifyUrl: track.external_urls.spotify
                }));
            }
            return [];
        } catch (error) {
            console.error('Error final de Spotify:', error);
            return [];
        }
    },

    async getRecommendationsByTrack(track) {
        if (!track || !track.id) return [];
        if (String(track.id).startsWith('m') || String(track.id).startsWith('h')) return [];

        try {
            const token = await getAccessToken();
            const mainArtist = (track.artist || '').split(',')[0].trim();
            const trackTitle = (track.title || '').trim();

            // --- PASO 1: Descubrimiento de Géneros (Opcional) ---
            let query = mainArtist; // Por defecto buscamos por artista
            try {
                // Buscamos al artista para ver sus géneros
                const artistSearch = await axios.get('https://api.spotify.com/v1/search', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: { q: mainArtist, type: 'artist', limit: 1 }
                });

                const artistId = artistSearch.data.artists.items[0]?.id;
                if (artistId) {
                    const artistInfo = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (artistInfo.data.genres?.length > 0) {
                        query = artistInfo.data.genres[0]; // Si tiene género, lo usamos para variar!
                    }
                }
            } catch (e) {
                console.warn('IA: Falló descubrimiento de género, usando artista.');
            }

            // --- PASO 2: Limpieza de la consulta ---
            const cleanQuery = query
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9 ]/g, "")
                .toLowerCase()
                .trim();

            console.log(`IA: >>> PROBANDO BÚSQUEDA: "${cleanQuery}"`);

            // --- PASO 3: Búsqueda Principal de Canciones ---
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: cleanQuery,
                    type: 'track',
                    limit: 10
                }
            });

            if (response.data.tracks && response.data.tracks.items) {
                const tracks = response.data.tracks.items;

                // Filtramos para no repetir la que ya suena
                const filtered = tracks.filter(t => {
                    const isSameArt = t.artists.some(a => a.name.toLowerCase().includes(mainArtist.toLowerCase()));
                    const isSameTit = t.name.toLowerCase().includes(trackTitle.toLowerCase());
                    return !isSameArt && !isSameTit;
                });

                const finalResults = (filtered.length > 0 ? filtered : tracks).slice(0, 10);

                return finalResults.map(t => ({
                    id: t.id,
                    title: t.name,
                    artist: t.artists.map(a => a.name).join(', '),
                    albumArt: t.album.images[0]?.url || '',
                    spotifyUrl: t.external_urls.spotify
                }));
            }
            return [];

        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            console.error('ERROR EN BÚSQUEDA PRINCIPAL:', msg);
            return [];
        }
    }
};

// IA Update: Fix Limit Syntax and Clean Cache v2
