<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { dbService } from './services/db';
import { auth } from './firebase/config';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

const route = useRoute();
const venueId = computed(() => route.params.venueId || 'DiscotecaBahia');
const venueData = ref({ name: 'Cargando...', pin: '1234' });
const venueNotFound = ref(false);
const isVenueLoading = ref(true);
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
  ChevronDown,
  Download,
  Share2
} from 'lucide-vue-next';
import QrcodeVue from 'qrcode.vue';
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
const djSubView = ref('queue'); // 'queue', 'settings', 'history'
const isAuthenticated = ref(false);
const userRole = ref(null); // 'dj' o 'admin'
const showAuthModal = ref(false);
const pinBuffer = ref('');

// --- Music State ---
const searchQuery = ref('');
const isSearching = ref(false);
const searchResults = ref([]);
const requestedSongs = ref([]);
const historyRequests = ref([]);
const djRecommendations = ref([]);
const isDjRecommendationsLoading = ref(false);
const showRequestModal = ref(false);
const selectedSongForRequest = ref(null);

// --- Customer Auth State ---
const customerUser = ref(null);
const showPhoneModal = ref(false);
const phoneNumber = ref('');
const otpCode = ref('');
const verificationId = ref(null);
const isOtpSent = ref(false);
const isVerifying = ref(false);
const hasPrivacyConsent = ref(false);
let recaptchaVerifier = null;

// --- Venue Settings State ---
const isSavingSettings = ref(false);
const editVenueData = reactive({
  name: '',
  pin: '',
  adminPin: '0000',
  vipPrice: 2,
  openTime: '23:00',
  closeTime: '06:00',
  isPaused: false,
  isFreeQueueEnabled: true
});

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

const fetchDjRecommendations = async (track) => {
  if (!hasSpotifyConfig.value || !track || !track.id) {
    djRecommendations.value = [];
    return;
  }
  
  isDjRecommendationsLoading.value = true;
  try {
    const data = await spotifyService.getRecommendationsByTrack(track);
    djRecommendations.value = data;
  } catch (e) {
    console.error('Error fetching DJ recommendations:', e);
  } finally {
    isDjRecommendationsLoading.value = false;
  }
};

// --- Lifecycle & Reactive Loading ---
let unsubscribeRequests = null;
let unsubscribeVenue = null;
window.unsubscribeHistory = null;

const loadVenue = async (newId) => {
  console.log(`--- Cargando Local: ${newId} ---`);
  
  // 1. Limpiar suscripciones anteriores
  if (unsubscribeRequests) {
    unsubscribeRequests();
    unsubscribeRequests = null;
  }
  if (unsubscribeVenue) {
    unsubscribeVenue();
    unsubscribeVenue = null;
  }
  if (window.unsubscribeHistory) {
    window.unsubscribeHistory();
    window.unsubscribeHistory = null;
  }

  // 2. Obtener datos del local y suscribirse
  isVenueLoading.value = true;
  venueNotFound.value = false;
  try {
    // Suscripción al local en tiempo real
    unsubscribeVenue = dbService.subscribeToVenue(newId, (data) => {
      isVenueLoading.value = false; // Parar loading en el primer dato
      if (data) {
        venueData.value = data;
        Object.assign(editVenueData, data);
        console.log('Datos del local actualizados (Real-time):', data.name);
      } else {
        venueNotFound.value = true;
      }
    });

    // 3. Suscribirse a peticiones en TIEMPO REAL
    unsubscribeRequests = dbService.subscribeToRequests(newId, (requests) => {
      requestedSongs.value = requests.filter(r => r.status === 'pending');
    });

    // 4. Suscribirse al Historial
    window.unsubscribeHistory = dbService.subscribeToRequests(newId, (requests) => {
      historyRequests.value = requests.filter(r => r.status === 'played');
    });
  } catch (e) {
    console.error('Error al cargar datos del local:', e);
    venueNotFound.value = true;
  } finally {
    isVenueLoading.value = false;
  }
};

// Vigilamos la URL para recargar todo si el local cambia
watch(venueId, (newId) => {
  if (newId) loadVenue(newId);
}, { immediate: true });

onMounted(() => {
  if (hasSpotifyConfig.value) {
    fetchRecommendations();
  }

  // Detectar usuario autenticado (Cliente)
  onAuthStateChanged(auth, (user) => {
    customerUser.value = user;
    if (user) {
      console.log('Cliente autenticado:', user.phoneNumber);
      showPhoneModal.value = false;
    }
  });
});

// --- History Logic ---
const sortedHistory = computed(() => {
  return [...historyRequests.value].sort((a, b) => {
    const timeA = a.playedAt?.toDate ? a.playedAt.toDate() : new Date(a.playedAt);
    const timeB = b.playedAt?.toDate ? b.playedAt.toDate() : new Date(b.playedAt);
    return timeB - timeA; // Más recientes arriba
  });
});

const totalRevenue = computed(() => {
  return historyRequests.value
    .filter(r => r.isVIP)
    .reduce((acc, curr) => acc + (venueData.value.vipPrice || 2), 0);
});

// Eliminamos el watch de localStorage ya que ahora usamos Firestore

// --- Queue sorting: VIPs first, then by time ---
const orderedRequests = computed(() => {
  return [...requestedSongs.value].sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    
    const timeA = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt);
    const timeB = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt);
    return timeA - timeB;
  });
});

const vipCount = computed(() => requestedSongs.value.filter(s => s.isVIP).length);
const freeCount = computed(() => requestedSongs.value.length - vipCount.value);

const nextUpTrack = computed(() => orderedRequests.value[0]);

watch(nextUpTrack, (newTrack) => {
  if (newTrack && newTrack.id) {
    fetchDjRecommendations(newTrack);
  } else {
    djRecommendations.value = [];
  }
}, { immediate: true });

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
  const adminPin = venueData.value.adminPin || '0000';
  if (pinBuffer.value === adminPin) {
    userRole.value = 'admin';
    isAuthenticated.value = true;
    sessionStorage.setItem(`dj_auth_${venueId.value}`, 'admin');
    showAuthModal.value = false;
    currentView.value = 'dj';
    pinBuffer.value = '';
  } else if (pinBuffer.value === venueData.value.pin) {
    userRole.value = 'dj';
    isAuthenticated.value = true;
    sessionStorage.setItem(`dj_auth_${venueId.value}`, 'dj');
    showAuthModal.value = false;
    currentView.value = 'dj';
    pinBuffer.value = '';
    djSubView.value = 'queue';
  } else {
    alert('PIN Incorrecto');
    pinBuffer.value = '';
  }
};

const logout = () => {
  isAuthenticated.value = false;
  userRole.value = null;
  sessionStorage.removeItem(`dj_auth_${venueId.value}`);
  currentView.value = 'assistant';
};

// --- Music Logic ---
const openRequestDialog = (song) => {
  selectedSongForRequest.value = song;
  showRequestModal.value = true;
};

const confirmRequest = async (isVIP = false) => {
  if (!isVenueOpen.value) {
    alert('Lo sentimos, la sala está cerrada y no acepta peticiones ahora.');
    return;
  }

  // Si no está autenticado como cliente, pedir teléfono
  if (!customerUser.value) {
    showPhoneModal.value = true;
    return;
  }

  const newRequest = {
    ...selectedSongForRequest.value,
    isVIP: isVIP,
    userPhone: customerUser.value.phoneNumber
  };
  
  try {
    await dbService.addRequest(venueId.value, newRequest);
    
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
  } catch (e) {
    alert('Error al enviar petición. Inténtalo de nuevo.');
  }
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

const formatTime = (date) => {
  if (!date) return '...';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '...';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Phone Auth Logic ---
const setupRecaptcha = () => {
  if (recaptchaVerifier) return;
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible'
  });
};

const sendOtp = async () => {
  if (!phoneNumber.value || !hasPrivacyConsent.value) {
    alert('Debes introducir un teléfono y aceptar la política de privacidad.');
    return;
  }

  isVerifying.value = true;
  setupRecaptcha();

  try {
    const formattedPhone = phoneNumber.value.startsWith('+') ? phoneNumber.value : `+34${phoneNumber.value}`;
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
    verificationId.value = confirmationResult;
    isOtpSent.value = true;
    alert('Código enviado. Revisa tu SMS.');
  } catch (error) {
    console.error('FIREBASE AUTH ERROR:', error);
    const errorMsg = error.code === 'auth/unauthorized-domain' 
      ? 'Dominio no autorizado. Añade dj.tanesolutions.com en Firebase > Auth > Settings.' 
      : error.message;
    alert(`Error: ${errorMsg}`);
  } finally {
    isVerifying.value = false;
  }
};

const verifyOtp = async () => {
  if (!otpCode.value) return;
  isVerifying.value = true;
  
  try {
    await verificationId.value.confirm(otpCode.value);
    // onAuthStateChanged se encargará del resto
  } catch (error) {
    alert('Código incorrecto. Inténtalo de nuevo.');
  } finally {
    isVerifying.value = false;
  }
};

const logoutCustomer = async () => {
  await signOut(auth);
  customerUser.value = null;
};
const markAsPlayed = async (requestId) => {
  await dbService.markAsPlayed(venueId.value, requestId);
};

const togglePause = async () => {
  editVenueData.isPaused = !editVenueData.isPaused;
  try {
    await dbService.updateVenueSettings(venueId.value, { isPaused: editVenueData.isPaused });
    venueData.value.isPaused = editVenueData.isPaused;
  } catch (e) {
    alert('Error al cambiar el estado de la sala.');
    editVenueData.isPaused = !editVenueData.isPaused; // Revertir
  }
};

const saveVenueSettings = async () => {
  isSavingSettings.value = true;
  try {
    await dbService.updateVenueSettings(venueId.value, { ...editVenueData });
    venueData.value = { ...editVenueData };
    alert('¡Ajustes actualizados con éxito!');
  } catch (e) {
    alert('Error al guardar ajustes.');
  } finally {
    isSavingSettings.value = false;
  }
};

// --- QR & Sharing ---
const fullVenueUrl = computed(() => {
  // En producción usará el dominio real, en dev el actual
  const base = window.location.origin;
  return `${base}/${venueId.value}`;
});

const downloadQRCode = () => {
  const canvas = document.querySelector('#qr-container canvas');
  if (!canvas) return;
  
  const link = document.createElement('a');
  link.download = `QR-${venueId.value}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

const copyToClipboard = () => {
  navigator.clipboard.writeText(fullVenueUrl.value);
  alert('¡URL copiada al portapapeles!');
};

// --- Time Check Helpers ---
const isWithinHours = computed(() => {
  const now = new Date();
  const time = now.getHours() * 100 + now.getMinutes();
  
  const start = parseInt(editVenueData.openTime.replace(':', ''));
  const end = parseInt(editVenueData.closeTime.replace(':', ''));
  
  if (start < end) {
    return time >= start && time <= end;
  } else {
    // Horario nocturno (ej: 23:00 a 06:00)
    return time >= start || time <= end;
  }
});

const isVenueOpen = computed(() => {
  return !editVenueData.isPaused && isWithinHours.value;
});
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4 max-w-lg mx-auto pb-20 text-white font-sans selection:bg-primary/30">
    
    <!-- Header -->
    <header class="w-full flex justify-between items-center py-6 mb-4 relative z-10">
      <div @click="handleLogoClick" class="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform">
        <div class="p-2 bg-primary rounded-xl shadow-[0_0_20px_rgba(30,215,96,0.3)]">
          <Music class="w-6 h-6 text-black" />
        </div>
        <h1 class="text-2xl font-black tracking-tighter uppercase flex items-baseline gap-2">
          <span>{{ venueData.name.split(' ')[0] }}</span>
          <span v-if="venueData.name.split(' ').length > 1" class="text-primary italic">
            {{ venueData.name.split(' ').slice(1).join(' ') }}
          </span>
          <span v-else class="text-primary italic">DJ</span>
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
      
      <!-- LOADING STATE -->
      <div v-if="isVenueLoading" class="flex flex-col items-center justify-center py-20 animate-pulse">
        <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-xs uppercase font-black tracking-widest text-gray-500">Conectando...</p>
      </div>

      <!-- NOT FOUND STATE -->
      <div v-else-if="venueNotFound" class="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in">
        <div class="p-6 bg-red-500/10 rounded-full border border-red-500/20">
          <ShieldCheck class="w-12 h-12 text-red-500" />
        </div>
        <div class="space-y-2">
          <h2 class="text-2xl font-black uppercase tracking-tight text-white">Local no registrado</h2>
          <p class="text-sm text-gray-500 max-w-xs mx-auto">Lo sentimos, esta sala de DJ aún no está activada en Tane Solutions.</p>
        </div>
        <a href="https://www.tanesolutions.com" class="bg-white text-black px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all">
          Información
        </a>
      </div>

      <!-- 1. ASSISTANT VIEW (Public) -->
      <section v-else-if="currentView === 'assistant'" class="space-y-8 animate-in mt-4">
        
        <!-- Closed/Paused Alert -->
        <div v-if="!isVenueOpen" class="bg-red-500/10 border border-red-500/20 p-6 rounded-4xl text-center space-y-3 animate-in">
          <Clock v-if="!editVenueData.isPaused" class="w-8 h-8 text-red-500 mx-auto" />
          <Zap v-else class="w-8 h-8 text-primary mx-auto animate-pulse" />
          
          <h3 class="font-black uppercase text-sm tracking-widest text-white">
            {{ editVenueData.isPaused ? 'Servicio en Pausa' : 'Sala Cerrada' }}
          </h3>
          
          <p class="text-[10px] text-gray-500 uppercase tracking-tight leading-relaxed">
            <template v-if="editVenueData.isPaused">
              El DJ ha pausado las peticiones un momento.<br>
              <span class="text-primary">Reanudaremos en breve. ¡Prepara tu canción!</span>
            </template>
            <template v-else>
              Fuera de horario de peticiones.<br>
              Horario: {{ editVenueData.openTime }} - {{ editVenueData.closeTime }}
            </template>
          </p>
        </div>

        <!-- Search -->
        <div v-if="isVenueOpen" class="space-y-4">
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
                class="shrink-0 px-5 py-2 rounded-full text-[12px] font-black tracking-wide transition-all border-2"
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
                class="shrink-0 w-32 glass p-2 rounded-2xl active:scale-95 transition-all text-center space-y-2 animate-in"
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
      <section v-else-if="currentView === 'dj'" class="space-y-6 animate-in pb-10">
        <div class="flex justify-between items-center">
          <h2 class="text-3xl font-black">Tu <span class="text-secondary">Cabina</span></h2>
        </div>

        <!-- Tab Selector -->
        <div class="flex p-1 bg-white/5 rounded-2xl">
          <button 
            @click="djSubView = 'queue'"
            class="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            :class="djSubView === 'queue' ? 'bg-secondary text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'"
          >
            Peticiones
          </button>
          
          <button 
            @click="djSubView = 'history'"
            class="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            :class="djSubView === 'history' ? 'bg-secondary text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'"
          >
            Historial
          </button>

          <button 
            v-if="userRole === 'admin'"
            @click="djSubView = 'settings'"
            class="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            :class="djSubView === 'settings' ? 'bg-secondary text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'"
          >
            Ajustes
          </button>
        </div>

        <!-- DJ QUEUE SUBVIEW -->
        <div v-if="djSubView === 'queue'" class="space-y-6">
          <!-- Control de Pausa Rápido -->
          <div class="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5 mx-1">
            <div class="flex items-center gap-3">
              <div :class="editVenueData.isPaused ? 'bg-red-500' : 'bg-primary'" class="w-3 h-3 rounded-full animate-pulse"></div>
              <div>
                <p class="text-[10px] font-black uppercase tracking-tight text-white">{{ editVenueData.isPaused ? 'Recepción Pausada' : 'Recibiendo Peticiones' }}</p>
                <p class="text-[8px] text-gray-500 uppercase font-bold">{{ editVenueData.isPaused ? 'Nadie puede pedir música' : 'La sala está abierta' }}</p>
              </div>
            </div>
            <button 
              @click="togglePause"
              class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border shadow-lg active:scale-95"
              :class="editVenueData.isPaused ? 'bg-primary text-black border-primary' : 'bg-red-500/10 text-red-500 border-red-500/30'"
            >
              {{ editVenueData.isPaused ? 'Reanudar' : 'Pausar' }}
            </button>
          </div>

          <div class="flex justify-center gap-4">
            <div class="flex items-center gap-1 bg-secondary/20 text-secondary text-[10px] px-3 py-1.5 rounded-lg font-black border border-secondary/20">
              <Zap class="w-3 h-3" /> {{ vipCount }} VIP
            </div>
            <div class="flex items-center gap-1 bg-gray-800 text-gray-400 text-[10px] px-3 py-1.5 rounded-lg font-black">
              <Music class="w-3 h-3" /> {{ freeCount }} Gratis
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

          <!-- AI Recommendations for DJ -->
          <div v-if="nextUpTrack" class="space-y-4 pt-6">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <Zap class="w-4 h-4 text-primary" v-if="!isDjRecommendationsLoading" />
                <div v-else class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <h3 class="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">
                  {{ isDjRecommendationsLoading ? 'Buscando sugerencias...' : 'IA: Siguientes recomendadas' }}
                </h3>
              </div>
            </div>

            <div v-if="djRecommendations.length > 0" class="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
              <div 
                v-for="song in djRecommendations" :key="song.id"
                class="shrink-0 w-28 glass p-2 rounded-2xl text-center space-y-2 animate-in"
              >
                <img :src="song.albumArt" class="w-full aspect-square rounded-xl object-cover" />
                <div class="px-1">
                  <p class="text-[10px] font-bold truncate">{{ song.title }}</p>
                  <p class="text-[8px] text-gray-500 truncate">{{ song.artist }}</p>
                </div>
                <button 
                  class="block w-full bg-primary/10 text-primary py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight hover:bg-primary/20 transition-all border border-primary/20"
                >
                  Oír
                </button>
              </div>
            </div>
          </div>

          <div v-if="orderedRequests.length === 0" class="text-center py-20 opacity-30">
            <Music class="w-12 h-12 mx-auto mb-4" />
            <p class="text-sm font-bold uppercase tracking-widest">No hay peticiones pendientes</p>
          </div>
        </div>

        <!-- DJ HISTORY SUBVIEW -->
        <div v-if="djSubView === 'history'" class="space-y-6 animate-in">
          <!-- Summary Card (Solo Admin) -->
          <div v-if="userRole === 'admin'" class="grid grid-cols-2 gap-4">
            <div class="glass p-5 rounded-4xl text-center space-y-1">
              <p class="text-[10px] uppercase font-black text-gray-500">Recaudación</p>
              <p class="text-2xl font-black text-primary">{{ totalRevenue }}€</p>
            </div>
            <div class="glass p-5 rounded-4xl text-center space-y-1">
              <p class="text-[10px] uppercase font-black text-gray-500">Completadas</p>
              <p class="text-2xl font-black text-white">{{ historyRequests.length }}</p>
            </div>
          </div>
          
          <div v-else class="glass p-5 rounded-4xl text-center">
            <p class="text-[10px] uppercase font-black text-gray-500">Canciones Sonadas Hoy</p>
            <p class="text-2xl font-black text-white">{{ historyRequests.length }}</p>
          </div>

          <div class="space-y-3">
            <div 
              v-for="request in sortedHistory" :key="request.requestId"
              class="glass p-3 rounded-2xl flex items-center gap-3 opacity-80"
            >
              <img :src="request.albumArt" class="w-10 h-10 rounded-lg object-cover grayscale" />
              <div class="flex-1 min-w-0">
                <h4 class="text-[11px] font-bold truncate text-gray-300">{{ request.title }}</h4>
                <div class="flex items-center gap-2">
                  <span class="text-[8px] font-black uppercase p-1 rounded bg-white/5 text-gray-500">{{ request.userPhone?.slice(-4) || '???' }}</span>
                  <span v-if="request.isVIP" class="text-[8px] font-black text-primary uppercase">VIP • {{ venueData.vipPrice }}€</span>
                  <span v-else class="text-[8px] font-black text-gray-600 uppercase">Gratis</span>
                </div>
              </div>
              <div class="text-right">
                <p class="text-[9px] font-black text-gray-500">{{ formatTime(request.playedAt) }}</p>
              </div>
            </div>
          </div>

          <div v-if="historyRequests.length === 0" class="text-center py-20 opacity-30">
            <Clock class="w-12 h-12 mx-auto mb-4" />
            <p class="text-sm font-bold uppercase tracking-widest">No hay historial todavía</p>
          </div>
        </div>

        <!-- DJ SETTINGS SUBVIEW -->
        <div v-if="djSubView === 'settings'" class="space-y-8 animate-in">
          <div class="glass p-6 rounded-[2.5rem] space-y-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Nombre del Local</label>
                <input v-model="editVenueData.name" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
              </div>
              
              <div class="space-y-2">
                <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">PIN de Acceso DJ</label>
                <input v-model="editVenueData.pin" maxlength="4" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">PIN de Acceso Admin</label>
                <input v-model="editVenueData.adminPin" maxlength="4" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Abre</label>
                  <input type="time" v-model="editVenueData.openTime" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Cierra</label>
                  <input type="time" v-model="editVenueData.closeTime" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Precio VIP (€)</label>
                <input type="number" v-model="editVenueData.vipPrice" class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary outline-none transition-all text-sm font-bold" />
              </div>

              <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 mt-4">
                <div class="flex items-center gap-3">
                  <div :class="editVenueData.isFreeQueueEnabled ? 'bg-primary' : 'bg-gray-600'" class="w-2 h-2 rounded-full"></div>
                  <span class="text-[10px] font-black uppercase tracking-tight text-gray-300">Permitir Peticiones Gratuitas</span>
                </div>
                <button 
                  @click="editVenueData.isFreeQueueEnabled = !editVenueData.isFreeQueueEnabled"
                  class="w-12 h-6 rounded-full transition-all relative border border-white/10"
                  :class="editVenueData.isFreeQueueEnabled ? 'bg-primary' : 'bg-gray-800'"
                >
                  <div 
                    class="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                    :class="editVenueData.isFreeQueueEnabled ? 'right-1' : 'left-1'"
                  ></div>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div class="flex items-center gap-3">
                  <div :class="editVenueData.isPaused ? 'bg-red-500' : 'bg-primary'" class="w-3 h-3 rounded-full animate-pulse"></div>
                  <span class="text-xs font-black uppercase tracking-tight">{{ editVenueData.isPaused ? 'Peticiones Pausadas' : 'Servicio Activo' }}</span>
                </div>
                <button 
                  @click="togglePause"
                  class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all"
                  :class="editVenueData.isPaused ? 'bg-primary text-black' : 'bg-red-500/20 text-red-500 border border-red-500/30'"
                >
                  {{ editVenueData.isPaused ? 'Reanudar' : 'Pausar' }}
                </button>
              </div>
            </div>

            <button 
              @click="saveVenueSettings"
              class="w-full bg-secondary text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
              :disabled="isSavingSettings"
            >
              <div v-if="isSavingSettings" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {{ isSavingSettings ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 3. SHARED QR VIEW -->
      <section v-else-if="currentView === 'shared-qr'" class="flex flex-col items-center justify-center space-y-8 py-10 animate-in">
        <div class="text-center space-y-2">
          <h2 class="text-4xl font-black italic tracking-tighter text-primary">{{ venueData.name.toUpperCase() }}</h2>
          <p class="text-gray-500 uppercase text-[10px] tracking-[0.3em] font-bold">Escanea y pide tu canción</p>
        </div>
        
        <div class="relative group">
          <!-- Decorative elements for QR -->
          <div class="absolute -inset-6 bg-primary/20 blur-3xl rounded-full animate-pulse group-hover:bg-primary/30 transition-all"></div>
          
          <div id="qr-container" class="relative p-8 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <qrcode-vue 
              :value="fullVenueUrl" 
              :size="220" 
              level="H" 
              render-as="canvas"
              :background="'#ffffff'"
              :foreground="'#000000'"
            />
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="bg-white p-2 rounded-xl shadow-lg border-4 border-white">
                <Music class="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
        </div>

        <div class="w-full grid grid-cols-2 gap-3 max-w-[280px]">
          <button @click="downloadQRCode" class="flex flex-col items-center gap-2 p-4 glass rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-primary">
            <Download class="w-6 h-6" />
            <span class="text-[9px] font-black uppercase tracking-widest">Descargar</span>
          </button>
          <button @click="copyToClipboard" class="flex flex-col items-center gap-2 p-4 glass rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-white">
            <Share2 class="w-6 h-6" />
            <span class="text-[9px] font-black uppercase tracking-widest">URL</span>
          </button>
        </div>

        <button @click="currentView = 'dj'" class="flex items-center gap-2 text-gray-600 text-[10px] uppercase font-black tracking-widest hover:text-primary transition-colors pt-4">
          <ChevronDown class="w-4 h-4" /> Volver al Panel
        </button>
      </section>
    </main>

    <!-- REQUEST MODAL (Free vs VIP) -->
    <div v-if="showRequestModal" class="fixed inset-0 bg-black/90 backdrop-blur-xl z-60 flex items-center justify-center p-6">
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
          <!-- FREE (Condicional) -->
          <button 
            v-if="venueData.isFreeQueueEnabled"
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
    <div v-if="showAuthModal" class="fixed inset-0 bg-black/95 backdrop-blur-2xl z-70 flex items-center justify-center p-6">
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

    <!-- PHONE AUTH MODAL -->
    <div v-if="showPhoneModal" class="fixed inset-0 bg-black/95 backdrop-blur-2xl z-80 flex items-center justify-center p-6">
      <div class="glass w-full max-w-sm p-8 rounded-[3rem] border-white/5 space-y-8 animate-in relative">
        <button @click="showPhoneModal = false" class="absolute top-6 right-6 text-gray-500"><X class="w-6 h-6" /></button>
        
        <div class="text-center space-y-4">
          <div class="p-4 bg-primary/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
            <ShieldCheck class="w-10 h-10 text-primary" />
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-black">Verifica tu Móvil</h3>
            <p class="text-gray-500 text-xs">Para evitar spam y gestionar tus peticiones de forma segura.</p>
          </div>
        </div>

        <div v-if="!isOtpSent" class="space-y-6">
          <div class="space-y-2">
            <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Teléfono (con +34)</label>
            <input 
              v-model="phoneNumber" type="tel" placeholder="+34 600 000 000"
              class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-primary outline-none transition-all text-center text-xl font-bold"
            />
          </div>

          <div class="flex items-start gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer" @click="hasPrivacyConsent = !hasPrivacyConsent">
            <div 
              class="w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center"
              :class="hasPrivacyConsent ? 'bg-primary border-primary' : 'border-gray-600'"
            >
              <CheckCircle2 v-if="hasPrivacyConsent" class="w-3 h-3 text-black" />
            </div>
            <p class="text-[10px] text-gray-400 leading-relaxed font-medium">
              Acepto que mis datos sean tratados por <span class="text-primary">Tane Solutions</span> y el local para la gestión del servicio y comunicaciones comerciales.
            </p>
          </div>

          <button 
            @click="sendOtp" 
            class="w-full bg-primary text-black py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            :disabled="isVerifying || !hasPrivacyConsent"
          >
            <div v-if="isVerifying" class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            Enviar Código SMS
          </button>
        </div>

        <div v-else class="space-y-6">
          <div class="space-y-2">
            <label class="text-[10px] uppercase font-black text-gray-500 ml-2 tracking-widest">Código SMS</label>
            <input 
              v-model="otpCode" type="text" placeholder="······" maxlength="6"
              class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:border-primary outline-none transition-all text-center text-3xl font-bold tracking-[0.5em]"
            />
          </div>

          <button 
            @click="verifyOtp" 
            class="w-full bg-secondary text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            :disabled="isVerifying"
          >
            <div v-if="isVerifying" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Verificar y Pagar
          </button>
          
          <button @click="isOtpSent = false" class="w-full text-[10px] text-gray-500 uppercase font-black tracking-widest hover:text-white transition-colors">
            Cambiar número
          </button>
        </div>

        <div id="recaptcha-container"></div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="mt-auto py-10 opacity-50 text-[9px] uppercase font-black tracking-[0.5em] flex items-center gap-1">
      <span>Powered by</span>
      <a href="https://www.tanesolutions.com" target="_blank" class="text-primary hover:underline transition-all">Tane Solutions</a>
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
