import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Reemplaza esto con tus cerdenciales de la consola de Firebase
// Configuración > General > Tus apps > Apps web
const firebaseConfig = {
    apiKey: "AIzaSyBlYgr6TGXChPC-F2g6r5D4iqzgGHPumpA",
    authDomain: "tanesolutions-d86dc.firebaseapp.com",
    projectId: "tanesolutions-d86dc",
    storageBucket: "tanesolutions-d86dc.firebasestorage.app",
    messagingSenderId: "643156601354",
    appId: "1:643156601354:web:c53b73dbf3e9d9982a8df3",
    measurementId: "G-23BEVHNZR4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
