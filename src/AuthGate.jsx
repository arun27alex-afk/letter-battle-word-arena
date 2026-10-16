import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, updateProfile } from 'firebase/auth'
import { auth } from './firebase'

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const signInWithGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
    } catch (err) {
      const messages = {
        'auth/operation-not-allowed': 'Enable Google sign-in in Firebase Console.',
        'auth/popup-blocked': 'Allow pop-ups for this website and try again.',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled. Please try again.',
        'auth/unauthorized-domain': 'Add this website to Firebase Authentication authorized domains.',
      }
      setError(`${messages[err.code] || 'Unable to sign in with Google.'} (${err.code || 'unknown-error'})`)
    } finally {
      setBusy(false)
    }
  }

  const saveName = async () => {
    if (name.trim().length < 2) return setError('Enter a player name with at least 2 characters.')
    await updateProfile(auth.currentUser, { displayName: name.trim() })
    setUser({ ...auth.currentUser })
  }

  if (user === undefined) return <div className="auth-loading">Letter Battle loading...</div>
  if (!user) return <main className="auth-page"><section className="auth-card">
    <img className="auth-game-logo" src="/letter-battle-logo.png" alt="Letter Battle" />
    <h1 className="sr-only">Letter Battle</h1>
    <p>Sign in with your Google account and challenge a friend online.</p>
    <button className="google-signin-button" onClick={signInWithGoogle} disabled={busy}>
      <span aria-hidden="true">G</span>{busy ? 'Signing in...' : 'Continue with Google'}
    </button>
    {error && <div className="auth-error">{error}</div>}
    <small>Your account is securely authenticated by Google Firebase.</small>
  </section></main>
  if (!user.displayName) return <main className="auth-page"><section className="auth-card">
    <img className="auth-game-logo compact" src="/letter-battle-logo.png" alt="Letter Battle" />
    <h1>Choose your player name</h1>
    <p>This name will be shown to your opponent and in the battle chat.</p>
    <label>PLAYER NAME</label>
    <input value={name} onChange={event => setName(event.target.value.slice(0, 20))} placeholder="Your name" autoFocus />
    <button onClick={saveName}>Continue</button>
    {error && <div className="auth-error">{error}</div>}
  </section></main>
  return <>{children}<button className="signout-chip" onClick={() => signOut(auth)}>Sign out</button></>
}
