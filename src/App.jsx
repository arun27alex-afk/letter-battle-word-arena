import { useMemo, useState } from 'react'
import './App.css'
import ConnectPanel from './ConnectPanel'

const SIZE = 10
const PLAYER_COLORS = ['#fe5e7f', '#25b9a8']
const COMMON_WORDS = new Set([
  'am','an','as','at','be','by','do','go','he','if','in','is','it','me','my','no','of','oh','ok','on','or','ox','so','to','up','us','we',
  'act','add','age','ago','air','all','and','ant','any','are','arm','art','ask','ate','bad','bag','bat','bed','bee','big','bit','box','boy','bus','but','buy','can','cap','car','cat','cow','cry','cup','cut','day','did','dog','dry','ear','eat','egg','end','eye','far','fat','few','fly','for','fox','fun','get','got','had','has','hat','hen','her','him','his','hot','how','ice','ill','jar','job','joy','key','kid','leg','let','lid','lie','log','lot','low','man','map','may','men','mix','mud','net','new','not','now','off','old','one','out','owl','own','pen','pet','pig','pot','put','ran','rat','red','run','sad','sat','say','sea','see','she','sit','six','sky','son','sun','tea','ten','the','tie','tin','top','toy','try','two','use','van','war','was','way','wet','who','why','win','yes','you','zoo',
  'about','above','after','again','along','below','black','bring','brown','could','every','first','found','green','house','large','learn','light','might','other','place','plant','right','small','sound','still','their','there','these','thing','think','three','under','water','where','which','while','white','world','would','write'
  ,'across','against','among','around','before','behind','beneath','beside','between','beyond','despite','down','during','except','from','inside','into','near','onto','opposite','outside','over','past','through','toward','underneath','until','upon','with','within','without'
])
const ALLOWED_TWO_LETTER_WORDS = new Set(['am','an','as','at','be','by','do','go','he','if','in','is','it','me','my','no','of','oh','ok','on','or','ox','so','to','up','us','we'])
const HARD_MODE_BLOCKED_WORDS = new Set([
  'a','an','the','am','is','are','was','were','be','been','being','do','does','did','have','has','had','can','could','may','might','must','shall','should','will','would',
  'i','me','my','mine','we','us','our','ours','you','your','yours','he','him','his','she','her','hers','it','its','they','them','their','theirs',
  'this','that','these','those','who','whom','whose','which','what','and','but','or','nor','for','yet','so','if','because','although','while','than','then','not','no','yes',
  'about','above','across','after','against','along','among','around','as','at','before','behind','below','beneath','beside','between','beyond','by','despite','down','during','except','from','in','inside','into','near','of','off','on','onto','opposite','out','outside','over','past','through','to','toward','under','underneath','until','up','upon','with','within','without'
])
const makeBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(''))
const cellId = (row, col) => `${row}-${col}`

function Icon({ name, size = 20 }) {
  const paths = {
    crown: <><path d="M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7Z"/><path d="M6 21h12"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    spark: <path d="m12 3-1.8 4.2L6 9l4.2 1.8L12 15l1.8-4.2L18 9l-4.2-1.8L12 3ZM5 16l-.9 2.1L2 19l2.1.9L5 22l.9-2.1L8 19l-2.1-.9L5 16Z"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [board, setBoard] = useState(makeBoard)
  const [turn, setTurn] = useState(0)
  const [scores, setScores] = useState([0, 0])
  const [locked, setLocked] = useState({})
  const [words, setWords] = useState([])
  const [mode, setMode] = useState(() => localStorage.getItem('letter-battle-mode') || 'easy')
  const [playerNames, setPlayerNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('letter-battle-player-names')) || ['Player 1', 'Player 2'] }
    catch { return ['Player 1', 'Player 2'] }
  })
  const [isChecking, setIsChecking] = useState(false)
  const [notice, setNotice] = useState({ type: 'info', text: 'Player 1, place one letter to begin.' })
  const filledCount = useMemo(() => board.flat().filter(Boolean).length, [board])

  const readLine = (nextBoard, row, col, axis) => {
    const [dr, dc] = axis === 'horizontal' ? [0, 1] : [1, 0]
    let startRow = row, startCol = col
    while (startRow - dr >= 0 && startCol - dc >= 0 && nextBoard[startRow - dr][startCol - dc] && locked[cellId(startRow - dr, startCol - dc)] === undefined) { startRow -= dr; startCol -= dc }
    const cells = []; let text = '', r = startRow, c = startCol
    while (r < SIZE && c < SIZE && nextBoard[r][c] && locked[cellId(r, c)] === undefined) { text += nextBoard[r][c]; cells.push(cellId(r, c)); r += dr; c += dc }
    return { text: text.toLowerCase(), cells, axis }
  }

  const checkDictionary = async (word) => {
    if (word.length === 2) return { valid: ALLOWED_TWO_LETTER_WORDS.has(word), definition: 'Common English word' }
    if (COMMON_WORDS.has(word)) return { valid: true, definition: 'Common English word' }
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      if (!response.ok) return { valid: false, definition: '' }
      const entries = await response.json()
      const definition = entries?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || ''
      return { valid: Boolean(definition), definition }
    } catch {
      return { valid: COMMON_WORDS.has(word), definition: 'Common English word' }
    }
  }

  const finishMove = async (nextBoard, row, col, letter) => {
    const candidates = [readLine(nextBoard, row, col, 'horizontal'), readLine(nextBoard, row, col, 'vertical')].filter(item => item.text.length >= 2)
    const uniqueCandidates = candidates.filter((item, index) => candidates.findIndex(other => other.text === item.text) === index && !words.some(word => word.text === item.text))
    setIsChecking(true)
    setNotice({ type: 'ready', text: uniqueCandidates.length ? 'Checking the English dictionary…' : `${letter} saved. Changing player…` })
    const checked = await Promise.all(uniqueCandidates.map(async item => ({ ...item, ...(await checkDictionary(item.text)) })))
    const blockedByMode = checked.some(item => item.valid && mode === 'hard' && HARD_MODE_BLOCKED_WORDS.has(item.text))
    const valid = checked.filter(item => item.valid && !(mode === 'hard' && HARD_MODE_BLOCKED_WORDS.has(item.text)))
    if (valid.length) {
      const nextLocked = { ...locked }; let earned = 0
      valid.forEach(item => { item.cells.forEach(id => { nextLocked[id] = turn }); earned += item.text.length })
      setLocked(nextLocked); setScores(previous => previous.map((score, index) => index === turn ? score + earned : score))
      setWords(previous => [...valid.map(item => ({ ...item, player: turn, points: item.text.length })), ...previous])
      setNotice({ type: 'success', text: `${valid.map(item => item.text.toUpperCase()).join(' + ')} complete! +${earned} points — Player ${turn + 1} plays again.` })
    } else {
      if (blockedByMode) setNotice({ type: 'warning', text: `Hard mode: helper words like IS, WAS and prepositions do not score. Player ${turn === 0 ? 2 : 1}'s turn.` })
      else if (candidates.length) setNotice({ type: 'info', text: `No complete word yet. Player ${turn === 0 ? 2 : 1}'s turn.` })
      else setNotice({ type: 'info', text: `${letter} saved. Player ${turn === 0 ? 2 : 1}'s turn.` })
      setTurn(current => current === 0 ? 1 : 0)
    }
    setIsChecking(false)
  }

  const placeLetter = (row, col, rawValue) => {
    if (isChecking || locked[cellId(row, col)] !== undefined || board[row][col]) return
    const letter = rawValue.replace(/[^a-z]/gi, '').slice(-1).toUpperCase()
    if (!letter) return
    const next = board.map(line => [...line]); next[row][col] = letter
    setBoard(next)
    finishMove(next, row, col, letter)
  }

  const passTurn = () => {
    if (isChecking) return
    setTurn(current => current === 0 ? 1 : 0); setNotice({ type: 'info', text: `Turn passed to Player ${turn === 0 ? 2 : 1}.` })
  }
  const resetGame = () => { setBoard(makeBoard()); setTurn(0); setScores([0, 0]); setLocked({}); setWords([]); setNotice({ type: 'info', text: 'New game ready. Player 1 goes first.' }) }
  const changeMode = nextMode => {
    setMode(nextMode)
    localStorage.setItem('letter-battle-mode', nextMode)
    setBoard(makeBoard()); setTurn(0); setScores([0, 0]); setLocked({}); setWords([])
    setNotice({ type: 'info', text: `${nextMode === 'easy' ? 'Easy' : 'Hard'} mode ready. Player 1 goes first.` })
  }
  const changePlayerName = (player, value) => {
    const nextNames = playerNames.map((currentName, index) => index === player ? value.slice(0, 18) : currentName)
    setPlayerNames(nextNames)
    localStorage.setItem('letter-battle-player-names', JSON.stringify(nextNames))
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span>LB</span></div><div className="brand-copy"><h1>Letter Battle</h1><p>Build words. Win the battle.</p></div>
      <div className="game-meta"><span className="live-pill"><i /> LOCAL MATCH</span><span className="room-code">10 × 10 BOARD</span></div>
    </header>
    <section className="game-layout">
      <aside className="side-panel players-panel">
        <div className="panel-heading"><span className="icon-box"><Icon name="users" /></span><div><span className="eyebrow">MATCH</span><h2>Players</h2></div></div>
        <div className="mode-picker" aria-label="Game difficulty"><span>DIFFICULTY</span><div><button className={mode === 'easy' ? 'selected' : ''} onClick={() => changeMode('easy')}>Easy<small>All words</small></button><button className={mode === 'hard' ? 'selected hard' : ''} onClick={() => changeMode('hard')}>Hard<small>Meaningful only</small></button></div></div>
        {[0, 1].map(player => <article className={`player-card player-${player + 1} ${turn === player ? 'active' : ''}`} key={player}>
          <div className="player-top"><div className="avatar">{(playerNames[player]?.trim()?.[0] || `P${player + 1}`).toUpperCase()}<span className="presence" /></div><div className="player-name"><input value={playerNames[player]} onChange={event => changePlayerName(player, event.target.value)} onBlur={() => { if (!playerNames[player].trim()) changePlayerName(player, `Player ${player + 1}`) }} aria-label={`Edit Player ${player + 1} name`} /><span>{turn === player ? 'Your turn' : 'Waiting'}</span></div>{turn === player && <span className="turn-badge">PLAYING</span>}</div>
          <div className="score-row"><span>SCORE</span><strong>{String(scores[player]).padStart(2, '0')}</strong></div>
        </article>)}
        <div className="turn-card"><span className="turn-kicker">CURRENT TURN · {mode.toUpperCase()}</span><strong><i style={{ background: PLAYER_COLORS[turn] }} />{playerNames[turn] || `Player ${turn + 1}`}</strong><p>{mode === 'easy' ? 'All dictionary words allowed' : 'Helper words do not score'}</p></div>
        <button className="secondary-button" onClick={resetGame}><Icon name="refresh" /> New game</button>
      </aside>
      <section className="board-column">
        <div className={`notice ${notice.type}`} role="status"><span><Icon name={notice.type === 'success' ? 'spark' : 'book'} size={18} /></span>{notice.text}</div>
        <div className="board-frame"><div className="axis top-axis">{Array.from({ length: SIZE }, (_, i) => <span key={i}>{i + 1}</span>)}</div><div className="board-row-wrap">
          <div className="axis side-axis">{Array.from({ length: SIZE }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}</div>
          <div className="board" aria-label="10 by 10 word game board">{board.map((row, r) => row.map((letter, c) => {
            const id = cellId(r, c), owner = locked[id], isLocked = owner !== undefined
            return <input key={id} className={`tile ${isLocked ? `locked owner-${owner + 1}` : ''}`} value={letter} aria-label={`Row ${String.fromCharCode(65 + r)}, column ${c + 1}${isLocked ? ', completed word' : ''}`} maxLength={1} readOnly={isChecking || isLocked || Boolean(letter)}
              onChange={event => placeLetter(r, c, event.target.value)} />
          }))}</div>
        </div></div>
        <div className="board-actions auto-actions"><button className="pass-button" onClick={passTurn}>Pass without a letter</button><span className="auto-pass"><Icon name="arrow" size={17} /> Auto-pass is on</span></div>
        <p className="microcopy"><kbd>A–Z</kbd> Type one letter — the turn changes automatically &nbsp;·&nbsp; Words read left → right or top → bottom</p>
      </section>
      <aside className="side-panel activity-panel">
        <div className="panel-heading"><span className="icon-box warm"><Icon name="crown" /></span><div><span className="eyebrow">THIS MATCH</span><h2>Word history</h2></div></div>
        <div className="word-list">{words.length ? words.map((word, index) => <div className="word-entry" key={`${word.text}-${index}`} title={word.definition}><span className={`word-chip owner-${word.player + 1}`}>{word.text.toUpperCase()}</span><div><strong>+{word.points}</strong><small>Player {word.player + 1}</small></div></div>) : <div className="empty-history"><span><Icon name="spark" /></span><strong>No words yet</strong><p>Your completed words will appear here.</p></div>}</div>
        <div className="rules-card"><h3>{mode === 'easy' ? 'Easy mode rules' : 'Hard mode rules'}</h3><ol><li><span>1</span>Place one letter per turn.</li><li><span>2</span>Build forward in a row or column.</li><li><span>3</span>{mode === 'easy' ? 'All valid words earn points.' : 'No helper words or prepositions.'}</li></ol></div>
        <div className="progress-line"><span>{filledCount}/100 squares used</span><div><i style={{ width: `${filledCount}%` }} /></div></div>
      </aside>
    </section><ConnectPanel />
  </main>
}

export default App
