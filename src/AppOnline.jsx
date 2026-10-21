import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { auth, db } from './firebase'
import BattleLobby from './BattleLobby'
import ConnectPanel from './ConnectPanel'
import './App.css'

const SIZE = 10
const COMMON_WORDS = new Set([
  'am','an','as','at','be','by','do','go','he','if','in','is','it','me','my','no','of','oh','ok','on','or','ox','so','to','up','us','we',
  'act','add','age','ago','air','all','and','ant','any','are','arm','art','ask','ate','bad','bag','bat','bed','bee','big','bit','box','boy','bus','but','buy','can','cap','car','cat','cow','cry','cup','cut','day','did','dog','dry','ear','eat','egg','end','eye','far','fat','few','fly','for','fox','fun','get','got','had','has','hat','hen','her','him','his','hot','how','ice','ill','jar','job','joy','key','kid','leg','let','lid','lie','log','lot','low','man','map','may','men','mix','mud','net','new','not','now','off','old','one','out','owl','own','pen','pet','pig','pot','put','ran','rat','red','run','sad','sat','say','sea','see','she','sit','six','sky','son','sun','tea','ten','the','tie','tin','top','toy','try','two','use','van','war','was','way','wet','who','why','win','yes','you','zoo',
  'about','above','after','again','along','below','black','bring','brown','could','every','first','found','green','house','large','learn','light','might','other','place','plant','right','small','sound','still','their','there','these','thing','think','three','under','water','where','which','while','white','world','would','write',
  'across','against','among','around','before','behind','beneath','beside','between','beyond','despite','down','during','except','from','inside','into','near','onto','opposite','outside','over','past','through','toward','underneath','until','upon','with','within','without'
])
const TWO_LETTER_WORDS = new Set(['am','an','as','at','be','by','do','go','he','if','in','is','it','me','my','no','of','oh','ok','on','or','ox','so','to','up','us','we'])
const HARD_BLOCKED = new Set(['a','an','the','am','is','are','was','were','be','been','being','do','does','did','have','has','had','can','could','may','might','must','shall','should','will','would','i','me','my','mine','we','us','our','ours','you','your','yours','he','him','his','she','her','hers','it','its','they','them','their','theirs','this','that','these','those','who','whom','whose','which','what','and','but','or','nor','for','yet','so','if','because','although','while','than','then','not','no','yes','about','above','across','after','against','along','among','around','as','at','before','behind','below','beneath','beside','between','beyond','by','despite','down','during','except','from','in','inside','into','near','of','off','on','onto','opposite','out','outside','over','past','through','to','toward','under','underneath','until','up','upon','with','within','without'])
const cellId = (row, col) => `${row}-${col}`
const wordFromCommittedCells = (board, cells) => cells.map(id => {
  const [row, col] = id.split('-').map(Number)
  return board[row * SIZE + col]
}).join('').toLowerCase()

function Icon({ name, size = 20 }) {
  const paths = { users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>, refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></>, book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>, spark: <path d="m12 3-1.8 4.2L6 9l4.2 1.8L12 15l1.8-4.2L18 9l-4.2-1.8L12 3Z"/>, arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></> }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const boardToRows = board => Array.from({ length: SIZE }, (_, row) => board.slice(row * SIZE, row * SIZE + SIZE))

export default function AppOnline() {
  const [roomCode, setRoomCode] = useState(() => {
    const invitedRoom = new URLSearchParams(location.search).get('room')?.trim().toUpperCase()
    const savedRoom = localStorage.getItem('letter-battle-active-room') || ''
    // An invite for a different room must open the join screen instead of a
    // previously saved battle where this browser may be Player 1.
    return invitedRoom && invitedRoom !== savedRoom ? '' : savedRoom
  })
  const [room, setRoom] = useState(null)
  const [notice, setNotice] = useState({ type: 'info', text: 'Connecting to battle…' })
  const [checking, setChecking] = useState(false)
  const [nameDrafts, setNameDrafts] = useState(['', ''])

  useEffect(() => {
    if (!roomCode) return undefined
    const roomRef = doc(db, 'rooms', roomCode)
    return onSnapshot(roomRef, snapshot => {
      if (!snapshot.exists()) { localStorage.removeItem('letter-battle-active-room'); setRoomCode(''); setRoom(null); return }
      const data = snapshot.data(); setRoom(data)
      setNameDrafts(data.players.map(player => player.name))
      if (data.status === 'waiting') setNotice({ type: 'info', text: 'Waiting for Player 2 to join…' })
      else if (data.turnUid === auth.currentUser.uid) setNotice(current => current.type === 'success' ? current : { type: 'ready', text: 'Your turn — place one letter.' })
      else setNotice(current => current.type === 'success' ? current : { type: 'info', text: `${data.players.find(player => player.uid === data.turnUid)?.name || 'Opponent'} is playing.` })
    }, () => setNotice({ type: 'warning', text: 'Room access denied. Check Firestore rules.' }))
  }, [roomCode])

  const enterRoom = code => {
    localStorage.setItem('letter-battle-active-room', code)
    history.replaceState(null, '', `${location.pathname}?room=${code}`)
    setRoomCode(code)
  }
  const leaveRoom = () => { localStorage.removeItem('letter-battle-active-room'); history.replaceState(null, '', location.pathname); setRoomCode(''); setRoom(null) }
  const rows = useMemo(() => room ? boardToRows(room.board || Array(100).fill('')) : [], [room])
  const myIndex = room?.players?.findIndex(player => player.uid === auth.currentUser.uid) ?? -1
  const isMyTurn = room?.status === 'active' && room.turnUid === auth.currentUser.uid
  const filledCount = room?.board?.filter(Boolean).length || 0

  const readLine = (board, locked, row, col, axis) => {
    const [dr, dc] = axis === 'horizontal' ? [0, 1] : [1, 0]
    let sr = row, sc = col
    const value = (r, c) => board[r * SIZE + c]
    while (sr - dr >= 0 && sc - dc >= 0 && value(sr - dr, sc - dc) && locked[cellId(sr - dr, sc - dc)] === undefined) { sr -= dr; sc -= dc }
    const cells = []; let text = '', r = sr, c = sc
    while (r < SIZE && c < SIZE && value(r, c) && locked[cellId(r, c)] === undefined) { text += value(r, c); cells.push(cellId(r, c)); r += dr; c += dc }
    return { text: text.toLowerCase(), cells, axis }
  }

  const makeCandidates = (board, locked, row, col) => {
    const horizontal = readLine(board, locked, row, col, 'horizontal')
    const vertical = readLine(board, locked, row, col, 'vertical')
    const candidates = []
    if (horizontal.text.length >= 2) candidates.push({ ...horizontal, lineKey: horizontal.cells.join('|') })
    if (vertical.text.length >= 2) {
      const lineKey = vertical.cells.join('|')
      candidates.push({ ...vertical, lineKey })
      candidates.push({
        text: [...vertical.text].reverse().join(''),
        cells: [...vertical.cells].reverse(),
        axis: 'vertical-reverse',
        lineKey,
      })
    }
    return candidates
  }

  const checkWord = async word => {
    if (word.length === 2) return TWO_LETTER_WORDS.has(word)
    if (COMMON_WORDS.has(word)) return true
    try { const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`); return response.ok }
    catch { return false }
  }

  const placeLetter = async (row, col, raw) => {
    if (!isMyTurn || checking || room.locked?.[cellId(row, col)] !== undefined || room.board[row * SIZE + col]) return
    const letter = raw.replace(/[^a-z]/gi, '').slice(-1).toUpperCase(); if (!letter) return
    setChecking(true); setNotice({ type: 'ready', text: 'Checking the move…' })
    const proposedBoard = [...room.board]; proposedBoard[row * SIZE + col] = letter
    const candidates = makeCandidates(proposedBoard, room.locked || {}, row, col)
    const unique = candidates.filter((item, index) => candidates.findIndex(other => other.text === item.text) === index && !(room.words || []).some(word => word.text === item.text))
    const checked = await Promise.all(unique.map(async item => ({ ...item, valid: await checkWord(item.text) })))
    const blocked = checked.some(item => item.valid && room.mode === 'hard' && HARD_BLOCKED.has(item.text))
    const eligible = checked.filter(item => item.valid && !(room.mode === 'hard' && HARD_BLOCKED.has(item.text)))
    // A vertical line can be valid in both directions (for example NO / ON).
    // Score only the first valid direction for the same physical cells.
    const valid = eligible.filter((item, index) => eligible.findIndex(other => other.lineKey === item.lineKey) === index)
    try {
      await runTransaction(db, async transaction => {
        const roomRef = doc(db, 'rooms', roomCode); const snapshot = await transaction.get(roomRef); const latest = snapshot.data()
        if (!snapshot.exists() || latest.status !== 'active' || latest.turnUid !== auth.currentUser.uid || latest.revision !== room.revision || latest.board[row * SIZE + col]) throw new Error('STALE_MOVE')
        const nextBoard = [...latest.board]; nextBoard[row * SIZE + col] = letter
        const nextLocked = { ...(latest.locked || {}) }; let earned = 0
        valid.forEach(word => { word.cells.forEach(id => { nextLocked[id] = auth.currentUser.uid }); earned += word.text.length })
        const opponent = latest.players.find(player => player.uid !== auth.currentUser.uid)
        transaction.update(roomRef, {
          board: nextBoard,
          locked: nextLocked,
          scores: { ...latest.scores, [auth.currentUser.uid]: (latest.scores?.[auth.currentUser.uid] || 0) + earned },
          words: [...valid.map(word => {
            const committedText = wordFromCommittedCells(nextBoard, word.cells)
            return { text: committedText, cells: word.cells, axis: word.axis, playerUid: auth.currentUser.uid, points: committedText.length }
          }), ...(latest.words || [])].slice(0, 100),
          turnUid: valid.length ? auth.currentUser.uid : opponent.uid,
          revision: latest.revision + 1,
          updatedAt: serverTimestamp(),
        })
      })
      if (valid.length) setNotice({ type: 'success', text: `${valid.map(word => word.text.toUpperCase()).join(' + ')}! +${valid.reduce((sum, word) => sum + word.text.length, 0)} points — you play again.` })
      else if (blocked) setNotice({ type: 'warning', text: 'Hard mode: helper words do not score. Turn passed.' })
      else setNotice({ type: 'info', text: 'Letter saved. Turn passed to your opponent.' })
    } catch { setNotice({ type: 'warning', text: 'The board changed. Please try your move again.' }) }
    finally { setChecking(false) }
  }

  const passTurn = async () => {
    if (!isMyTurn || checking) return
    await runTransaction(db, async transaction => {
      const roomRef = doc(db, 'rooms', roomCode); const snapshot = await transaction.get(roomRef); const latest = snapshot.data()
      if (latest.turnUid !== auth.currentUser.uid) return
      transaction.update(roomRef, { turnUid: latest.players.find(player => player.uid !== auth.currentUser.uid).uid, revision: latest.revision + 1, updatedAt: serverTimestamp() })
    })
  }

  const resetGame = async () => {
    if (myIndex !== 0) return setNotice({ type: 'warning', text: 'Only Player 1 can start a new game.' })
    await runTransaction(db, async transaction => {
      const roomRef = doc(db, 'rooms', roomCode); const snapshot = await transaction.get(roomRef); const latest = snapshot.data()
      transaction.update(roomRef, { board: Array(100).fill(''), locked: {}, words: [], scores: Object.fromEntries(latest.players.map(player => [player.uid, 0])), turnUid: latest.players[0].uid, revision: latest.revision + 1, updatedAt: serverTimestamp() })
    })
  }

  const saveMyName = async () => {
    const value = nameDrafts[myIndex]?.trim().slice(0, 18); if (!value) return
    await updateProfile(auth.currentUser, { displayName: value })
    await runTransaction(db, async transaction => { const ref = doc(db, 'rooms', roomCode); const snapshot = await transaction.get(ref); const latest = snapshot.data(); transaction.update(ref, { players: latest.players.map(player => player.uid === auth.currentUser.uid ? { ...player, name: value } : player), updatedAt: serverTimestamp() }) })
  }

  const shareRoom = async () => { const link = `${location.origin}${location.pathname}?room=${roomCode}`; await navigator.clipboard.writeText(link); setNotice({ type: 'success', text: 'Invite link copied. Send it to Player 2.' }) }

  if (!roomCode) return <BattleLobby onEnter={enterRoom} />
  if (!room) return <div className="auth-loading">Opening battle {roomCode}…</div>
  const names = [room.players?.[0]?.name || 'Player 1', room.players?.[1]?.name || 'Waiting…']
  const turnIndex = room.players.findIndex(player => player.uid === room.turnUid)

  return <main className="app-shell"><header className="topbar"><img className="header-game-logo" src="/letter-battle-logo.png" alt="Letter Battle" /><div className="brand-copy"><h1 className="sr-only">Letter Battle</h1><p>BUILD WORDS. WIN THE BATTLE.</p></div><div className="game-meta"><button className="live-pill share-room" onClick={shareRoom}><i /> ROOM {roomCode}</button><button className="room-code leave-room" onClick={leaveRoom}>Leave</button></div></header>
    <section className="game-layout"><aside className="side-panel players-panel"><div className="panel-heading"><span className="icon-box"><Icon name="users" /></span><div><span className="eyebrow">ONLINE · {room.mode?.toUpperCase()}</span><h2>Players</h2></div></div>
      {room.players.map((player, index) => <article className={`player-card player-${index + 1} ${room.turnUid === player.uid ? 'active' : ''}`} key={player.uid}><div className="player-top"><div className="avatar">{player.name[0]?.toUpperCase()}<span className="presence" /></div><div className="player-name">{player.uid === auth.currentUser.uid ? <input value={nameDrafts[index] ?? player.name} onChange={event => setNameDrafts(current => current.map((name, i) => i === index ? event.target.value.slice(0,18) : name))} onBlur={saveMyName} /> : <strong>{player.name}</strong>}<span>{player.uid === auth.currentUser.uid ? 'You' : 'Opponent'}</span></div>{room.turnUid === player.uid && <span className="turn-badge">PLAYING</span>}</div><div className="score-row"><span>SCORE</span><strong>{String(room.scores?.[player.uid] || 0).padStart(2,'0')}</strong></div></article>)}
      {room.status === 'waiting' && <article className="player-card waiting-player"><div className="waiting-pulse"/><b>Waiting for Player 2</b><button onClick={shareRoom}>Copy invite link</button></article>}
      <div className="turn-card"><span className="turn-kicker">CURRENT TURN</span><strong><i style={{background:turnIndex === 1 ? '#25b9a8' : '#fe5e7f'}}/>{names[Math.max(turnIndex,0)]}</strong><p>{isMyTurn ? 'Your move' : room.status === 'waiting' ? 'Share the room code' : 'Opponent is thinking'}</p></div><button className="secondary-button" onClick={resetGame} disabled={myIndex !== 0}><Icon name="refresh"/> New game</button>
    </aside><section className="board-column"><div className={`notice ${notice.type}`} role="status"><span><Icon name={notice.type === 'success' ? 'spark' : 'book'} size={18}/></span>{notice.text}</div><div className="board-frame"><div className="axis top-axis">{Array.from({length:SIZE},(_,i)=><span key={i}>{i+1}</span>)}</div><div className="board-row-wrap"><div className="axis side-axis">{Array.from({length:SIZE},(_,i)=><span key={i}>{String.fromCharCode(65+i)}</span>)}</div><div className={`board ${!isMyTurn ? 'board-disabled' : ''}`}>{rows.map((row,r)=>row.map((letter,c)=>{const id=cellId(r,c),owner=room.locked?.[id],ownerIndex=room.players.findIndex(player=>player.uid===owner);return <input key={id} className={`tile ${owner ? `locked owner-${ownerIndex+1}`:''}`} value={letter} readOnly={!isMyTurn||checking||Boolean(letter)||Boolean(owner)} onChange={event=>placeLetter(r,c,event.target.value)} aria-label={`Row ${String.fromCharCode(65+r)}, column ${c+1}`}/> }))}</div></div></div><div className="board-actions auto-actions"><button className="pass-button" onClick={passTurn} disabled={!isMyTurn}>Pass turn</button><span className={`auto-pass ${isMyTurn?'':'waiting'}`}><Icon name="arrow" size={17}/>{isMyTurn?'Your board is active':'Waiting for opponent'}</span></div><p className="microcopy">Only the active player can place a letter · Changes sync live</p></section>
      <aside className="side-panel activity-panel"><div className="panel-heading"><span className="icon-box warm"><Icon name="spark"/></span><div><span className="eyebrow">ROOM {roomCode}</span><h2>Word history</h2></div></div><div className="word-list">{room.words?.length ? room.words.map((word,index)=>{const owner=room.players.findIndex(player=>player.uid===word.playerUid);return <div className="word-entry" key={`${word.text}-${index}`}><span className={`word-chip owner-${owner+1}`}>{word.text.toUpperCase()}</span><div><strong>+{word.points}</strong><small>{room.players[owner]?.name}</small></div></div>}) : <div className="empty-history"><span><Icon name="spark"/></span><strong>No words yet</strong><p>Completed words appear here.</p></div>}</div><div className="rules-card"><h3>{room.mode==='hard'?'Hard mode':'Easy mode'}</h3><ol><li><span>1</span>One authenticated player per slot.</li><li><span>2</span>Turns sync between both devices.</li><li><span>3</span>{room.mode==='hard'?'Helper words do not score.':'All valid words score.'}</li></ol></div><div className="progress-line"><span>{filledCount}/100 squares used</span><div><i style={{width:`${filledCount}%`}}/></div></div></aside>
    </section>{room.status === 'active' && <ConnectPanel room={roomCode}/>}</main>
}
