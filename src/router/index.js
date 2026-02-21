import { createRouter, createWebHistory } from 'vue-router';
import App from '../App.vue';

// Por ahora, como el App.vue contiene toda la lógica, lo usaremos como componente principal
// Más adelante podemos separar en vistas si el proyecto crece mucho.
const routes = [
    {
        path: '/:venueId',
        name: 'Venue',
        component: App
    },
    {
        path: '/',
        redirect: '/DiscotecaBahia' // Redirección por defecto para pruebas
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
