import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCqny_T6aLyYHkME9CA1YOYQTAvZLZFWp0",
  authDomain: "timetablescheduler-28fc8.firebaseapp.com",
  projectId: "timetablescheduler-28fc8",
  storageBucket: "timetablescheduler-28fc8.firebasestorage.app",
  messagingSenderId: "801787141460",
  appId: "1:801787141460:web:8330b6f945ae35eea07cc1",
  measurementId: "G-PQF7KG6MJ3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };