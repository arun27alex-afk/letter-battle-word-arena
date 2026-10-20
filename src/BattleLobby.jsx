import { useState } from 'react'
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const emptyBoard = () => Array(100).fill('')
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

async function createBattle(mode) {
  let code = makeCode()
  while ((await getDoc(doc(db, 'rooms', code))).exists()) code = makeCode()
  const user = auth.currentUser
  await setDoc(doc(db, 'rooms', code), {
    code,
    status: 'waiting',
    mode,
    players: [{ uid: user.uid, name: user.displayName || 'Player 1', slot: 0 }],
    playerUids: [user.uid],
    board: emptyBoard(),
    locked: {},
    scores: { [user.uid]: 0 },
    words: [],
    turnUid: user.uid,
    revision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return code
}

async function joinBattle(rawCode) {
  const code = rawCode.trim().toUpperCase()
  const user = auth.currentUser
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'rooms', code)
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND')
    const room = snapshot.data()
    if (room.players.some(player => player.uid === user.uid)) throw new Error('ALREADY_MEMBER')
    if (room.players.length >= 2) throw new Error('ROOM_FULL')
    transaction.update(roomRef, {
      players: [...room.players, { uid: user.uid, name: user.displayName || 'Player 2', slot: 1 }],
      playerUids: [...room.playerUids, user.uid],
      scores: { ...room.scores, [user.uid]: 0 },
      status: 'active',
      updatedAt: serverTimestamp(),
    })
  })
  return code
}

export default function BattleLobby({ onEnter }) {
  const [mode, setMode] = useState('easy')
  const [joinCode, setJoinCode] = useState(new URLSearchParams(location.search).get('room') || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setBusy(true); setError('')
    try { onEnter(await createBattle(mode)) }
    catch (err) {
      console.error('Create battle failed:', err)
      const messages = {
        'permission-denied': 'Permission denied. Create the Firestore database and publish the included security rules.',
        'failed-precondition': 'Cloud Firestore is not ready. Create a Firestore database in Firebase Console first.',
        unavailable: 'Firebase is temporarily unavailable. Check your connection and try again.',
        unauthenticated: 'Your login session has expired. Sign out and sign in again.',
      }
      setError(`${messages[err.code] || 'Unable to create the battle.'} (${err.code || 'unknown-error'})`)
    }
    finally { setBusy(false) }
  }

  const join = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { onEnter(await joinBattle(joinCode)) }
    catch (err) {
      setError(err.message === 'ROOM_FULL' ? 'This battle already has two players.' : err.message === 'ROOM_NOT_FOUND' ? 'No battle was found with that room code.' : err.message === 'ALREADY_MEMBER' ? 'This Google account is already Player 1 in this battle. Sign out and use Player 2\'s Gmail account.' : `Unable to join the battle. (${err.code || 'unknown-error'})`)
    } finally { setBusy(false) }
  }

  return <main className="lobby-page"><header className="lobby-brand"><img src="/letter-battle-logo.png" alt="Letter Battle" /><div><h1 className="sr-only">Letter Battle</h1><p>CHOOSE YOUR ARENA</p></div></header><section className="lobby-grid">
    <article className="lobby-card featured"><span className="lobby-step">START A NEW MATCH</span><h2>Create Battle</h2><p>Create a private room and send the invite code to your opponent.</p><div className="lobby-mode"><button className={mode === 'easy' ? 'active' : ''} onClick={() => setMode('easy')}><b>Easy</b><small>All valid words</small></button><button className={mode === 'hard' ? 'active hard' : ''} onClick={() => setMode('hard')}><b>Hard</b><small>Meaningful words only</small></button></div><button className="lobby-primary" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create online battle'}</button></article>
    <article className="lobby-card"><span className="lobby-step">HAVE A CODE?</span><h2>Join Battle</h2><p>Enter the 6-character room code sent by Player 1.</p><form onSubmit={join}><label>ROOM CODE</label><input value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" maxLength={6} /><button className="lobby-primary secondary" disabled={busy || joinCode.length !== 6}>{busy ? 'Joining…' : 'Join as Player 2'}</button></form></article>
  </section>{error && <div className="lobby-error">{error}</div>}<p className="lobby-user">Signed in as <b>{auth.currentUser?.displayName}</b> ({auth.currentUser?.email})</p></main>
}
