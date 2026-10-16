import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDozpCr2mbwQLcact-1ND--xdc3ZGLx43A',
  authDomain: 'letter-battle-word-arena.firebaseapp.com',
  projectId: 'letter-battle-word-arena',
  storageBucket: 'letter-battle-word-arena.firebasestorage.app',
  messagingSenderId: '1089077734515',
  appId: '1:1089077734515:web:e3dac69e886b1c862ece06',
}

const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
