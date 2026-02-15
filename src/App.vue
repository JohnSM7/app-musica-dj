<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { 
  Search, 
  Music, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  LayoutDashboard, 
  Users,
  Play,
  QrCode,
  ShieldCheck,
  TrendingUp,
  X,
  Zap,
  Clock,
  ChevronRight,
  ChevronDown
} from 'lucide-vue-next';
import debounce from 'lodash.debounce';
import confetti from 'canvas-confetti';
import { spotifyService } from './services/spotify';

// --- Types & Constants ---
const ADMIN_PIN = '1234';
const hasSpotifyConfig = computed(() => {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  return !!id && id !== 'TU_CLIENT_ID_AQUÍ' && String(id).trim() !== '';
});

// --- Navigation & Auth ---
const currentView = ref('assistant'); // 'assistant', 'dj', 'shared-qr'
const isAuthenticated = ref(false);
const showAuthModal = ref(false);
const pinBuffer = ref('');

// --- Music State ---
const searchQuery = ref('');
const isSearching = ref(false);
const searchResults = ref([]);
const requestedSongs = ref([]);
const showRequestModal = ref(false);
const selectedSongForRequest = ref(null);

// --- Mock Data ---
const mockSpotifyDB = [
  { id: '1', title: 'Starboy', artist: 'The Weeknd', albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop', spotifyUrl: '#' },
  { id: '2', title: 'Blinding Lights', artist: 'The Weeknd', albumArt: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop', spotifyUrl: '#' },
  { id: '3', title: 'Cruel Summer', artist: 'Taylor Swift', albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop', spotifyUrl: '#' },
  { id: '4', title: 'Flowers', artist: 'Miley Cyrus', albumArt: 'https://images.unsplash.com/photo-1514525253361-bee87184919a?w=300&h=300&fit=crop', spotifyUrl: '#' },
];

const recommendations = ref([]);
const isRecommendationsLoading = ref(false);
const currentGenre = ref('pop');
const genres = [
  { id: 'latino', label: 'Latino', query: 'genre:latin year:2025-2026' },
  { id: 'pop', label: 'Pop', query: 'genre:pop year:2025-2026' },
  { id: 'dance', label: 'Dance', query: 'genre:dance year:2025-2026' },
  { id: 'rock', label: 'Rock', query: 'genre:rock year:2025-2026' },
  { id: 'urban', label: 'Urbano', query: 'reggaeton year:2025-2026' }
];

const safetyList = [
  { id: 'h1', title: 'Top Hits 2026', artist: 'Varios Artistas', albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop', spotifyUrl: '#' },
  { id: 'h2', title: 'Party Mix', artist: 'DJ Selection', albumArt: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop', spotifyUrl: '#' },
  { id: 'h3', title: 'Dance Floor', artist: 'Club Classics', albumArt: 'https://images.unsplash.com/photo-1514525253361-bee87184919a?w=300&h=300&fit=crop', spotifyUrl: '#' }
];

const fetchRecommendations = async (genreId = currentGenre.value) => {
  if (!hasSpotifyConfig.value) return;
  
  isRecommendationsLoading.value = true;
  const genre = genres.find(g => g.id === genreId);
  currentGenre.value = genreId;

  try {
    const data = await spotifyService.getRecommendations(genre.query);
    if (data && data.length > 0) {
      recommendations.value = data;
    } else {
      console.warn('Spotify no devolvió datos, usando lista de seguridad');
      recommendations.value = safetyList;
    }
  } catch (e) {
    console.error('Error fetching recommendations:', e);
    recommendations.value = safetyList;
  } finally {
    isRecommendationsLoading.value = false;
  }
};

// --- Lifecycle & Persistence ---
onMounted(async () => {
  console.log('--- DJ Request App Initializing ---');
  const saved = localStorage.getItem('dj_requests');
  if (saved) {
    requestedSongs.value = JSON.parse(saved);
    console.log('Peticiones cargadas de LocalStorage:', requestedSongs.value.length);
  }
  
  const auth = sessionStorage.getItem('dj_auth');
  if (auth === 'true') {
    isAuthenticated.value = true;
    console.log('Sesión de DJ detectada');
  }

  if (hasSpotifyConfig.value) {
    fetchRecommendations();
  } else {
    recommendations.value = []; 
  }
});

watch(requestedSongs, (newList) => {
  localStorage.setItem('dj_requests', JSON.stringify(newList));
}, { deep: true });

// --- Admin Security ---
const logoClickCount = ref(0);
const handleLogoClick = () => {
  logoClickCount.value++;
  if (logoClickCount.value >= 5) {
    if (isAuthenticated.value) {
      currentView.value = 'dj';
    } else {
      showAuthModal.value = true;
    }
    logoClickCount.value = 0;
  }
  setTimeout(() => logoClickCount.value = 0, 2000);
};

const checkPin = () => {
  if (pinBuffer.value === ADMIN_PIN) {
    isAuthenticated.value = true;
    sessionStorage.setItem('dj_auth', 'true');
    showAuthModal.value = false;
    currentView.value = 'dj';
    pinBuffer.value = '';
  } else {
    alert('PIN Incorrecto');
    pinBuffer.value = '';
  }
};

const logout = () => {
  isAuthenticated.value = false;
  sessionStorage.removeItem('dj_auth');
  currentView.value = 'assistant';
};

// --- Music Logic ---
const openRequestDialog = (song) => {
  selectedSongForRequest.value = song;
  showRequestModal.value = true;
};

const confirmRequest = (isVIP = false) => {
  const newRequest = {
    ...selectedSongForRequest.value,
    requestId: Date.now().toString(),
    requestedAt: new Date().toISOString(),
    isVIP: isVIP
  };
  
  requestedSongs.value.push(newRequest);
  
  confetti({
    particleCount: isVIP ? 200 : 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: isVIP ? ['#ffd700', '#9146ff', '#ffffff'] : ['#1ed760', '#ffffff']
  });
  
  showRequestModal.value = false;
  selectedSongForRequest.value = null;
  searchQuery.value = '';
  searchResults.value = [];
};

const performSearch = debounce(async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }
  
  if (!hasSpotifyConfig.value) {
    console.warn('Spotify Client ID no configurado. Usando mock data.');
    // Fallback a mock data para que no rompa si el usuario no ha puesto las keys
    searchResults.value = [
      { id: 'm1', title: 'Configura el .env', artist: 'Faltan credenciales de Spotify', albumArt: 'https://i.scdn.co/image/ab67616d0000b273b4e36509f6e3c0b0a88062a4', spotifyUrl: '#' }
    ];
    return;
  }

  isSearching.value = true;
  try {
    searchResults.value = await spotifyService.searchTracks(searchQuery.value);
  } catch (error) {
    console.error(error);
  } finally {
    isSearching.value = false;
  }
}, 500); // Un poco más de debounce para no malgastar tokens

watch(searchQuery, performSearch);

const formatTime = (isoString) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Queue sorting: VIPs first, then by time ---
const orderedRequests = computed(() => {
  return [...requestedSongs.value].sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    return new Date(a.requestedAt) - new Date(b.requestedAt);
  });
});

const vipCount = computed(() => requestedSongs.value.filter(s => s.isVIP).length);
const freeCount = computed(() => requestedSongs.value.length - vipCount.value);

// --- DJ Actions ---
const markAsPlayed = (requestId) => {
  requestedSongs.value = requestedSongs.value.filter(s => s.requestId !== requestId);
};
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4 max-w-lg mx-auto pb-20 text-white font-sans selection:bg-primary/30">
    
    <!-- Header -->
    <header class="w-full flex justify-between items-center py-6 mb-4 relative z-10">
      <div @click="handleLogoClick" class="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform">
        <div class="p-2 bg-primary rounded-xl shadow-[0_0_20px_rgba(30,215,96,0.3)]">
          <Music class="w-6 h-6 text-black" />
        </div>
        <h1 class="text-2xl font-black tracking-tighter uppercase">
          DJ<span class="text-primary italic">Request</span>
        </h1>
      </div>

      <nav v-if="isAuthenticated" class="flex gap-2">
        <button @click="currentView = 'dj'" class="p-2.5 rounded-full transition-all" :class="currentView === 'dj' ? 'bg-secondary text-white ring-4 ring-secondary/20' : 'glass text-gray-500'">
          <LayoutDashboard class="w-5 h-5" />
        </button>
        <button @click="currentView = 'shared-qr'" class="p-2.5 rounded-full transition-all" :class="currentView === 'shared-qr' ? 'bg-primary text-black ring-4 ring-primary/20' : 'glass text-gray-500'">
          <QrCode class="w-5 h-5" />
        </button>
        <button @click="logout" class="p-2.5 glass text-red-400 rounded-full"><X class="w-5 h-5" /></button>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="w-full space-y-8">
      
      <!-- 1. ASSISTANT VIEW (Public) -->
      <section v-if="currentView === 'assistant'" class="space-y-8 animate-in mt-4">
        
        <!-- Search -->
        <div class="space-y-4">
          <div class="relative group">
            <div class="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search class="w-5 h-5 text-gray-600 group-focus-within:text-primary transition-colors" />
            </div>
            <input 
              v-model="searchQuery"
              placeholder="¿Qué quieres escuchar hoy?"
              class="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-lg placeholder:text-gray-600 shadow-2xl"
            />
          </div>

          <!-- Recommendations -->
          <div v-if="!searchQuery && (recommendations.length > 0 || isRecommendationsLoading)" class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <TrendingUp class="w-4 h-4 text-primary" />
                <h3 class="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Sugerencias del DJ</h3>
              </div>
              <div v-if="isRecommendationsLoading" class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>

            <!-- Genre Selector -->
            <div class="flex gap-2 overflow-x-auto pt-4 pb-3 no-scrollbar px-1">
              <button 
                v-for="genre in genres" :key="genre.id"
                @click="fetchRecommendations(genre.id)"
                class="flex-shrink-0 px-5 py-2 rounded-full text-[12px] font-black tracking-wide transition-all border-2"
                :class="currentGenre === genre.id 
                  ? 'bg-primary/20 border-primary text-white shadow-[0_0_20px_rgba(30,215,96,0.3)] scale-105' 
                  : 'bg-white/5 text-gray-500 border-transparent hover:border-white/10 hover:bg-white/10'"
              >
                {{ genre.label }}
              </button>
            </div>

            <div class="flex gap-3 overflow-x-auto pb-4 no-scrollbar min-h-[140px]" :class="{ 'opacity-50 pointer-events-none': isRecommendationsLoading }">
              <div 
                v-for="song in recommendations" :key="song.id"
                @click="openRequestDialog(song)"
                class="flex-shrink-0 w-32 glass p-2 rounded-2xl active:scale-95 transition-all text-center space-y-2 animate-in"
              >
                <img :src="song.albumArt" class="w-full aspect-square rounded-xl object-cover" />
                <div class="px-1">
                  <p class="text-[11px] font-bold truncate">{{ song.title }}</p>
                  <p class="text-[9px] text-gray-500 truncate">{{ song.artist }}</p>
                </div>
                <button 
                  @click.stop="openRequestDialog(song)"
                  class="w-full bg-white text-black py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-md active:scale-95 transition-all hover:bg-gray-200 mt-1"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

          <!-- Search Results -->
          <div v-if="searchQuery" class="space-y-3">
            <div 
              v-for="song in searchResults" :key="song.id"
              class="glass glass-hover p-4 rounded-3xl flex items-center gap-4 transition-all animate-in"
            >
              <img :src="song.albumArt" class="w-16 h-16 rounded-2xl object-cover shadow-lg" />
              <div class="flex-1 min-w-0">
                <h3 class="font-black text-white truncate">{{ song.title }}</h3>
                <p class="text-gray-400 text-xs truncate">{{ song.artist }}</p>
              </div>
              <button 
                @click="openRequestDialog(song)"
                class="bg-white text-black px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight shadow-md active:scale-95 transition-all hover:bg-gray-200"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        <!-- PUBLIC QUEUE VISUALIZER -->
        <div class="space-y-4">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <Clock class="w-4 h-4 text-secondary" />
              <h3 class="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Cola de Peticiones</h3>
            </div>
            <span class="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400">{{ requestedSongs.length }} en lista</span>
          </div>

          <div v-if="requestedSongs.length === 0" class="text-center py-10 glass rounded-[2.5rem] border-dashed border-white/10 opacity-60">
            <p class="text-xs text-gray-500">Aún no hay peticiones. ¡Sé el primero!</p>
          </div>

          <div class="space-y-2">
            <div 
              v-for="req in orderedRequests" :key="req.requestId"
              class="glass p-3 rounded-2xl flex items-center gap-3 transition-all relative overflow-hidden"
              :class="req.isVIP ? 'border-l-4 border-secondary shadow-[0_0_15px_rgba(145,70,255,0.1)]' : 'border-l-4 border-gray-700'"
            >
              <div v-if="req.isVIP" class="absolute top-0 right-0 p-1">
                <Zap class="w-3 h-3 text-secondary fill-secondary" />
              </div>
              <img :src="req.albumArt" class="w-10 h-10 rounded-lg object-cover grayscale-[0.5]" />
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold truncate" :class="req.isVIP ? 'text-secondary' : 'text-gray-300'">{{ req.title }}</h4>
                <p class="text-[10px] text-gray-500 truncate">{{ req.artist }}</p>
              </div>
              <span class="text-[9px] font-black text-gray-600">{{ formatTime(req.requestedAt) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. DJ PANEL VIEW -->
      <section v-else-if="currentView === 'dj'" class="space-y-6 animate-in">
        <div class="flex justify-between items-center">
          <h2 class="text-3xl font-black">Tu <span class="text-secondary">Cabina</span></h2>
          <div class="flex gap-2">
            <div class="flex items-center gap-1 bg-secondary/20 text-secondary text-[10px] px-2 py-1 rounded-lg font-black">
              <Zap class="w-3 h-3" /> {{ vipCount }}
            </div>
            <div class="flex items-center gap-1 bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded-lg font-black">
              <Music class="w-3 h-3" /> {{ freeCount }}
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div 
            v-for="request in orderedRequests" :key="request.requestId"
            class="glass p-4 rounded-3xl flex items-center gap-4 group transition-all"
            :class="request.isVIP ? 'bg-secondary/5 border-secondary/30 ring-1 ring-secondary/20' : 'border-white/5'"
          >
            <div class="relative">
              <img :src="request.albumArt" class="w-14 h-14 rounded-2xl object-cover shadow-2xl" />
              <div v-if="request.isVIP" class="absolute -top-2 -left-2 bg-secondary p-1 rounded-full shadow-lg">
                <Zap class="w-3 h-3 text-white fill-white" />
              </div>
            </div>
            
            <div class="flex-1 min-w-0">
              <h3 class="font-black text-sm truncate" :class="request.isVIP ? 'text-secondary' : 'text-white'">{{ request.title }}</h3>
              <p class="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{{ request.artist }}</p>
              <p class="text-[9px] text-gray-600 mt-1 uppercase">{{ formatTime(request.requestedAt) }}</p>
            </div>

            <div class="flex gap-2">
              <a :href="request.spotifyUrl" target="_blank" class="p-2.5 glass text-primary rounded-xl active:scale-90 transition-transform">
                <ExternalLink class="w-5 h-5" />
              </a>
              <button @click="markAsPlayed(request.requestId)" class="p-2.5 glass text-red-500 rounded-xl active:scale-90 transition-transform">
                <CheckCircle2 class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. SHARED QR VIEW -->
      <section v-else-if="currentView === 'shared-qr'" class="flex flex-col items-center justify-center space-y-10 py-12 animate-in">
        <div class="text-center space-y-2">
          <h2 class="text-4xl font-black italic tracking-tighter text-primary">DJ REQUEST</h2>
          <p class="text-gray-500 uppercase text-xs tracking-[0.3em] font-bold">Pide tu música aquí</p>
        </div>
        
        <div class="relative">
          <!-- Decorative elements for QR -->
          <div class="absolute -inset-4 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
          <div class="relative p-10 bg-white rounded-[3rem] shadow-2xl">
            <div class="w-56 h-56 bg-white flex items-center justify-center">
               <div class="relative w-48 h-48 grid grid-cols-4 grid-rows-4 gap-2 opacity-90">
                  <div v-for="i in 16" :key="i" class="bg-black rounded-sm" :class="Math.random() > 0.4 ? 'opacity-100' : 'opacity-10'"></div>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="bg-white p-3 rounded-2xl shadow-2xl">
                      <Music class="w-10 h-10 text-primary" />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <button @click="currentView = 'assistant'" class="flex items-center gap-2 text-gray-500 text-[10px] uppercase font-black tracking-widest hover:text-primary transition-colors">
          <X class="w-4 h-4" /> Cerrar Pantalla
        </button>
      </section>
    </main>

    <!-- REQUEST MODAL (Free vs VIP) -->
    <div v-if="showRequestModal" class="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
      <div class="glass w-full max-w-sm p-8 rounded-[3rem] space-y-8 animate-in border-white/5 relative">
        <button @click="showRequestModal = false" class="absolute top-6 right-6 text-gray-500"><X class="w-6 h-6" /></button>
        
        <div class="text-center space-y-4">
          <img :src="selectedSongForRequest.albumArt" class="w-32 h-32 mx-auto rounded-3xl shadow-2xl" />
          <div>
            <h3 class="text-xl font-black text-white">{{ selectedSongForRequest.title }}</h3>
            <p class="text-gray-500">{{ selectedSongForRequest.artist }}</p>
          </div>
        </div>

        <div class="space-y-3">
          <!-- FREE -->
          <button 
            @click="confirmRequest(false)"
            class="w-full flex items-center justify-between p-5 rounded-3xl glass glass-hover group"
          >
            <div class="flex items-center gap-4">
              <div class="p-2 bg-gray-800 rounded-xl group-hover:bg-primary transition-colors">
                <Music class="w-5 h-5 text-gray-400 group-hover:text-black" />
              </div>
              <div class="text-left">
                <p class="font-black text-sm">Cola Gratuita</p>
                <p class="text-[10px] text-gray-500">Orden normal por llegada</p>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-gray-600" />
          </button>

          <!-- VIP -->
          <button 
            @click="confirmRequest(true)"
            class="w-full flex items-center justify-between p-5 rounded-3xl bg-secondary/10 border border-secondary/30 hover:bg-secondary/20 transition-all group"
          >
            <div class="flex items-center gap-4">
              <div class="p-2 bg-secondary rounded-xl shadow-[0_0_15px_rgba(145,70,255,0.4)]">
                <Zap class="w-5 h-5 text-white fill-white" />
              </div>
              <div class="text-left">
                <p class="font-black text-sm text-secondary">Cola VIP / Prioridad</p>
                <p class="text-[10px] text-gray-400">Pasa al inicio de la lista</p>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-secondary" />
          </button>
        </div>
      </div>
    </div>

    <!-- ADMIN AUTH MODAL -->
    <div v-if="showAuthModal" class="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[70] flex items-center justify-center p-6">
      <div class="glass w-full max-w-sm p-10 rounded-[3rem] border-white/5 space-y-8">
        <div class="text-center space-y-2">
          <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 class="text-2xl font-black">Admin Access</h3>
          <p class="text-gray-500 text-xs uppercase tracking-widest font-bold">Introduce el PIN maestro</p>
        </div>
        
        <input 
          v-model="pinBuffer" type="password" placeholder="••••" maxlength="4"
          @keyup.enter="checkPin"
          class="w-full bg-white/5 border border-white/10 rounded-2xl py-5 text-center text-4xl font-bold tracking-[0.5em] focus:outline-none focus:border-primary text-white"
        />
        
        <div class="grid grid-cols-2 gap-4">
          <button @click="showAuthModal = false" class="py-4 rounded-2xl glass font-black text-gray-400">Cerrar</button>
          <button 
            @click="checkPin" 
            class="py-4 rounded-2xl font-black transition-all"
            :class="pinBuffer.length === 4 ? 'bg-primary text-black' : 'bg-gray-800 text-gray-600 cursor-not-allowed'"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="mt-auto py-10 opacity-30 text-[9px] uppercase font-black tracking-[0.5em]">
      Powered by Tane Solutions
    </footer>
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.animate-in {
  animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.glass {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.glass-hover:hover {
  background: rgba(255, 255, 255, 0.05);
}
</style>
