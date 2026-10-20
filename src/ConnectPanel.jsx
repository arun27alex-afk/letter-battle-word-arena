import { useEffect, useRef, useState } from 'react'
import { updateProfile } from 'firebase/auth'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

const MAX_RECORDING_SECONDS = 15
const MAX_AUDIO_BYTES = 600 * 1024

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(blob)
})

export default function ConnectPanel({ room }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState(auth.currentUser?.displayName || '')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceStatus, setVoiceStatus] = useState('Tap record to send a voice message.')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recordingSecondsRef = useRef(0)

  useEffect(() => {
    if (!auth.currentUser || !room) return undefined
    const messagesQuery = query(collection(db, 'rooms', room, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(messagesQuery, snapshot => setMessages(snapshot.docs.slice(-50).map(item => ({ id: item.id, ...item.data() }))), () => setMessages([]))
  }, [room])

  useEffect(() => () => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  const sendMessage = async event => {
    event.preventDefault()
    if (!message.trim() || !room) return
    await addDoc(collection(db, 'rooms', room, 'messages'), {
      type: 'text', text: message.trim().slice(0, 300), uid: auth.currentUser.uid,
      name: auth.currentUser.displayName, createdAt: serverTimestamp(),
    })
    setMessage('')
  }

  const saveName = async () => {
    if (name.trim().length < 2) return
    await updateProfile(auth.currentUser, { displayName: name.trim().slice(0, 20) })
    setName(auth.currentUser.displayName)
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus('Voice recording is not supported by this browser.')
      return
    }
    try {
      setVoiceStatus('Requesting microphone permission...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      chunksRef.current = []
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType, audioBitsPerSecond: 24000 } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = async () => {
        clearInterval(timerRef.current)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) return setVoiceStatus('No audio was recorded. Please try again.')
        if (blob.size > MAX_AUDIO_BYTES) return setVoiceStatus('Recording is too large. Please record a shorter message.')
        try {
          setVoiceStatus('Sending voice message...')
          const audioData = await blobToDataUrl(blob)
          await addDoc(collection(db, 'rooms', room, 'messages'), {
            type: 'audio', audioData, audioMime: blob.type, duration: recordingSecondsRef.current,
            uid: auth.currentUser.uid, name: auth.currentUser.displayName, createdAt: serverTimestamp(),
          })
          setVoiceStatus('Voice message sent.')
          setTab('chat')
        } catch {
          setVoiceStatus('Unable to send the voice message. Please try again.')
        }
      }
      setRecordingSeconds(0)
      recordingSecondsRef.current = 0
      setRecording(true)
      setVoiceStatus('Recording... tap Stop & Send when finished.')
      recorder.start(500)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(seconds => {
          const next = Math.min(seconds + 1, MAX_RECORDING_SECONDS)
          recordingSecondsRef.current = next
          if (next >= MAX_RECORDING_SECONDS) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      setRecording(false)
      setVoiceStatus('Microphone permission is required to record voice messages.')
    }
  }

  return <><button className="connect-fab" onClick={() => setOpen(value => !value)}>{open ? '×' : 'Chat & Voice'}</button>{open && <section className="connect-panel">
    <header><div><small>ONLINE ROOM</small><strong>{room || 'NO ROOM'}</strong></div><span>{auth.currentUser?.displayName}</span></header>
    <div className="room-field"><label>PRIVATE BATTLE ROOM</label><input value={room} readOnly /></div>
    <nav><button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Text chat</button><button className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}>Voice note</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button></nav>
    {tab === 'chat' && <><div className="messages">{messages.length ? messages.map(item => <div className={item.uid === auth.currentUser.uid ? 'mine' : ''} key={item.id}><b>{item.name}</b>{item.type === 'audio' ? <div className="voice-message"><span>Voice message</span><audio controls preload="metadata" src={item.audioData} /></div> : <p>{item.text}</p>}</div>) : <p className="chat-empty">No messages in this battle yet.</p>}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={event => setMessage(event.target.value)} placeholder="Type a message..." /><button>Send</button></form></>}
    {tab === 'voice' && <div className="voice-box"><span className={recording ? 'recording-dot' : ''}>●</span><h3>{recording ? `${recordingSeconds}s / ${MAX_RECORDING_SECONDS}s` : 'Voice message'}</h3><p>{voiceStatus}</p>{recording ? <button className="danger" onClick={stopRecording}>Stop & Send</button> : <button onClick={startRecording}>Record voice</button>}</div>}
    {tab === 'profile' && <div className="profile-box"><label>PLAYER NAME</label><input value={name} onChange={event => setName(event.target.value.slice(0, 20))} /><button onClick={saveName}>Save name</button><small>{auth.currentUser?.email}</small></div>}
  </section>}</>
}
