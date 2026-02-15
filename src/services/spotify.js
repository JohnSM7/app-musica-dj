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
                    type: 'track'
                }
            });

            return response.data.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
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
            console.log('Token obtenido para recomendaciones:', token ? 'OK' : 'FAIL');

            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: customQuery,
                    type: 'track'
                }
            });

            if (response.data.tracks && response.data.tracks.items) {
                return response.data.tracks.items.map(track => ({
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    albumArt: track.album.images[0]?.url || '',
                    spotifyUrl: track.external_urls.spotify
                }));
            }
            return [];
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            console.error('Error final de Spotify:', msg);
            return [];
        }
    }
};
