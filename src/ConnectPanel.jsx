import { useEffect, useRef, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const rtcConfig = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] }

export default function ConnectPanel({ room }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState(auth.currentUser?.displayName || '')
  const [voiceStatus, setVoiceStatus] = useState('Not connected')
  const [inVoice, setInVoice] = useState(false)
  const [muted, setMuted] = useState(false)
  const pcRef = useRef(null)
  const streamRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!auth.currentUser || !room) return undefined
    const messagesQuery = query(collection(db, 'rooms', room, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(messagesQuery, snapshot => setMessages(snapshot.docs.slice(-50).map(item => ({ id: item.id, ...item.data() }))), () => setMessages([]))
  }, [room])

  const sendMessage = async event => {
    event.preventDefault()
    if (!message.trim() || !room) return
    await addDoc(collection(db, 'rooms', room, 'messages'), { text: message.trim().slice(0, 300), uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp() })
    setMessage('')
  }

  const saveName = async () => {
    if (name.trim().length < 2) return
    await updateProfile(auth.currentUser, { displayName: name.trim().slice(0, 20) })
    setName(auth.currentUser.displayName)
  }

  const startVoice = async () => {
    try {
      setVoiceStatus('Requesting microphone…')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      setInVoice(true)
      streamRef.current = stream
      const pc = new RTCPeerConnection(rtcConfig); pcRef.current = pc
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      pc.ontrack = event => { audioRef.current.srcObject = event.streams[0]; setVoiceStatus('Voice connected') }
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') setVoiceStatus('Voice connected') }
      const callRef = doc(db, 'rooms', room, 'voice', 'call')
      const callSnapshot = await getDoc(callRef)
      if (!callSnapshot.exists() || !callSnapshot.data().offer) {
        const offerCandidates = collection(callRef, 'offerCandidates')
        pc.onicecandidate = event => event.candidate && addDoc(offerCandidates, event.candidate.toJSON())
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer)
        await setDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp }, createdBy: auth.currentUser.uid, updatedAt: serverTimestamp() })
        onSnapshot(callRef, snapshot => { const answer = snapshot.data()?.answer; if (answer && !pc.currentRemoteDescription) pc.setRemoteDescription(answer) })
        onSnapshot(collection(callRef, 'answerCandidates'), snapshot => snapshot.docChanges().forEach(change => { if (change.type === 'added') pc.addIceCandidate(change.doc.data()) }))
        setVoiceStatus('Waiting for opponent…')
      } else {
        const answerCandidates = collection(callRef, 'answerCandidates')
        pc.onicecandidate = event => event.candidate && addDoc(answerCandidates, event.candidate.toJSON())
        await pc.setRemoteDescription(callSnapshot.data().offer)
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer)
        await setDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, answeredBy: auth.currentUser.uid, updatedAt: serverTimestamp() }, { merge: true })
        onSnapshot(collection(callRef, 'offerCandidates'), snapshot => snapshot.docChanges().forEach(change => { if (change.type === 'added') pc.addIceCandidate(change.doc.data()) }))
        setVoiceStatus('Connecting…')
      }
    } catch { setInVoice(false); setVoiceStatus('Microphone/Firestore permission needed') }
  }

  const endVoice = () => { streamRef.current?.getTracks().forEach(track => track.stop()); pcRef.current?.close(); streamRef.current = null; pcRef.current = null; setMuted(false); setInVoice(false); setVoiceStatus('Not connected') }
  const toggleMute = () => { const next = !muted; streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next }); setMuted(next) }

  return <><button className="connect-fab" onClick={() => setOpen(value => !value)}>{open ? '×' : 'Chat & Voice'}</button>{open && <section className="connect-panel">
    <header><div><small>ONLINE ROOM</small><strong>{room || 'NO ROOM'}</strong></div><span>{auth.currentUser?.displayName}</span></header>
    <div className="room-field"><label>PRIVATE BATTLE ROOM</label><input value={room} readOnly /></div>
    <nav><button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Text chat</button><button className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}>Voice</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button></nav>
    {tab === 'chat' && <><div className="messages">{messages.length ? messages.map(item => <div className={item.uid === auth.currentUser.uid ? 'mine' : ''} key={item.id}><b>{item.name}</b><p>{item.text}</p></div>) : <p className="chat-empty">No messages in this battle yet.</p>}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Type a message…" /><button>Send</button></form></>}
    {tab === 'voice' && <div className="voice-box"><span className={voiceStatus === 'Voice connected' ? 'connected' : ''}>●</span><h3>{voiceStatus}</h3><p>Both players must join voice from the same battle room.</p>{!inVoice ? <button onClick={startVoice}>Join voice</button> : <div><button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button><button className="danger" onClick={endVoice}>Leave</button></div>}<audio ref={audioRef} autoPlay /></div>}
    {tab === 'profile' && <div className="profile-box"><label>PLAYER NAME</label><input value={name} onChange={event => setName(event.target.value.slice(0, 20))} /><button onClick={saveName}>Save name</button><small>{auth.currentUser?.phoneNumber}</small></div>}
  </section>}</>
}
