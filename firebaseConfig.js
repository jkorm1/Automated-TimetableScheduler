import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-QNi7yuxnBLD-1FwpFjF9mJAPYZcQA4M",
  authDomain: "theartisan-5266c.firebaseapp.com",
  projectId: "theartisan-5266c",
  storageBucket: "theartisan-5266c.appspot.com",
  messagingSenderId: "28723580926",
  appId: "1:28723580926:web:19792d70acaaabaef0baaf",
  measurementId: "G-BSE5571SK1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };