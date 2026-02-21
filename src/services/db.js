import { db } from '../firebase/config';
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';

export const dbService = {
    // Obtener datos del local (nombre, PIN, colores...)
    async getVenue(venueId) {
        const docRef = doc(db, 'venues', venueId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null; // No crear automáticamente por seguridad
        }
    },

    // Suscribirse a los datos del local en TIEMPO REAL
    subscribeToVenue(venueId, callback) {
        const docRef = doc(db, 'venues', venueId);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data());
            } else {
                callback(null);
            }
        });
    },

    // Suscribirse a peticiones en TIEMPO REAL (Solo las pendientes)
    subscribeToRequests(venueId, callback) {
        const q = query(
            collection(db, 'venues', venueId, 'requests'),
            // where('status', '==', 'pending'), // Desactivado temporalmente para evitar error de índice
            orderBy('requestedAt', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs
                .map(doc => ({
                    requestId: doc.id,
                    ...doc.data()
                }))
                .filter(req => req.status === 'pending'); // Filtramos en cliente para que funcione ya
            callback(requests);
        });
    },

    // Añadir una nueva petición
    async addRequest(venueId, requestData) {
        const requestsRef = collection(db, 'venues', venueId, 'requests');
        await addDoc(requestsRef, {
            ...requestData,
            status: 'pending', // Added status
            requestedAt: serverTimestamp()
        });
    },

    // Marcar como puesta (Ahora guarda en historial)
    async markAsPlayed(venueId, requestId) {
        const docRef = doc(db, 'venues', venueId, 'requests', requestId);
        await updateDoc(docRef, { // Changed from deleteDoc to updateDoc
            status: 'played',
            playedAt: serverTimestamp()
        });
    },

    // Actualizar ajustes del local
    async updateVenueSettings(venueId, settings) {
        const docRef = doc(db, 'venues', venueId);
        await setDoc(docRef, settings, { merge: true });
    }
};
