# 🎧 DJ Request App

Una Single Page Application (SPA) moderna y elegante diseñada para que los asistentes a un evento puedan solicitar canciones directamente al DJ en tiempo real. Inspirada en la estética de Spotify y diseñada con un enfoque **Mobile-First**.

![Vue 3](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Spotify API](https://img.shields.io/badge/Spotify_API-1DB954?style=for-the-badge&logo=spotify&logoColor=white)

## ✨ Características Principalas

- **🔍 Búsqueda en Tiempo Real:** Integración directa con la API de Spotify para buscar canciones por título o artista.
- **🔥 Sugerencias Inteligentes:** Carrusel de recomendaciones dinámicas por géneros (Latino, Pop, Dance, Urbano) usando éxitos actuales de 2024-2026.
- **👑 Doble Cola de Peticiones:** Sistema de peticiones Gratuitas y peticiones VIP con efectos visuales diferenciados (confeti dorado para VIP).
- **🎧 Panel del DJ Protegido:** Vista administrativa oculta (acceso mediante 5 clics en el logo + PIN) para gestionar la cola, eliminar canciones o abrirlas directamente en Spotify.
- **📱 QR Compartible:** Generación de un enlace rápido y vista de QR para que el DJ pueda mostrarlo en su cabina.
- **🌙 Diseño Premium:** Estética dark mode con efectos de glassmorphism, acentos neón y animaciones fluidas.

## 🛠️ Stack Técnico

- **Framework:** Vue 3 (Composition API, `<script setup>`)
- **Estilos:** Tailwind CSS v4 (Configuración nativa con `@theme`)
- **Iconos:** Lucide-Vue-Next
- **Efectos:** Canvas-confetti
- **API:** Spotify Web API (Client Credentials Flow)
- **Persistencia:** LocalStorage (para las peticiones) y SessionStorage (para la sesión del DJ).

## 🚀 Instalación y Configuración

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/JohnSM7/app-musica-dj.git
   cd app-musica-dj
   ```

2. **Instalar dependencias:**

   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto y añade tus credenciales de Spotify (puedes obtenerlas en [Spotify for Developers](https://developer.spotify.com/dashboard)):

   ```env
   VITE_SPOTIFY_CLIENT_ID=tu_client_id_aqui
   VITE_SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui
   ```

4. **Ejecutar en desarrollo:**

   ```bash
   npm run dev
   ```

## 🎮 Cómo usar

### 🤵 Vista del Asistente (Pública)

Es la vista principal. Permite buscar canciones, ver sugerencias y realizar peticiones. Al solicitar una canción, el usuario recibe una animación de confirmación.

### 🎧 Vista del DJ (Privada)

1. Haz **5 clics rápidos** sobre el logo de "DJ Request" en el header.
2. Introduce el PIN por defecto: `1234`.
3. Gestiona la lista: marca canciones como sonadas o ábrelas en Spotify para reproducirlas.
4. Genera el **Enlace Compartible** para que los asistentes entren fácilmente.

## 📦 Despliegue en Vercel

Este proyecto está listo para ser desplegado en Vercel. Asegúrate de añadir las variables `VITE_SPOTIFY_CLIENT_ID` y `VITE_SPOTIFY_CLIENT_SECRET` en la configuración del proyecto en el panel de Vercel antes de desplegar.

---
Generado con ❤️ para DJs que quieren llevar su interacción al siguiente nivel. 🚀
