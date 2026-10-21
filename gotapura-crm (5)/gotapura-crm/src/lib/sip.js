// Ligação à central telefónica (SIP sobre WebSocket / WebRTC) com JsSIP.
// Cada utilizador configura a sua extensão em Definições → Telefone.
import JsSIP from 'jssip'

let ua = null
let session = null
const listeners = new Set()
const remoteAudio = typeof Audio !== 'undefined' ? new Audio() : null

function emit(event, data) { listeners.forEach((fn) => fn(event, data)) }

export function onPhoneEvent(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function connectPhone({ wss_url, sip_uri, sip_password, display_name }) {
  disconnectPhone()
  if (!wss_url || !sip_uri || !sip_password) return false
  try {
    const socket = new JsSIP.WebSocketInterface(wss_url)
    ua = new JsSIP.UA({ sockets: [socket], uri: sip_uri, password: sip_password, display_name, register: true })
    ua.on('registered', () => emit('registered'))
    ua.on('unregistered', () => emit('unregistered'))
    ua.on('registrationFailed', (e) => emit('error', e?.cause || 'Registo falhou'))
    ua.on('disconnected', () => emit('disconnected'))
    ua.on('newRTCSession', ({ session: s, originator }) => {
      session = s
      const number = s.remote_identity?.uri?.user || ''
      s.on('accepted', () => emit('accepted', { number }))
      s.on('confirmed', () => emit('confirmed', { number }))
      s.on('ended', (e) => { emit('ended', { number, cause: e?.cause }); session = null })
      s.on('failed', (e) => { emit('failed', { number, cause: e?.cause }); session = null })
      s.on('peerconnection', ({ peerconnection }) => {
        peerconnection.addEventListener('track', (ev) => {
          if (remoteAudio) { remoteAudio.srcObject = ev.streams[0]; remoteAudio.play().catch(() => {}) }
        })
      })
      if (originator === 'remote') emit('incoming', { number })
      else emit('outgoing', { number })
    })
    ua.start()
    return true
  } catch (e) {
    emit('error', String(e))
    return false
  }
}

export function disconnectPhone() {
  try { session?.terminate() } catch {}
  try { ua?.stop() } catch {}
  ua = null; session = null
}

export function isPhoneReady() { return !!ua && ua.isRegistered() }

export function dial(number) {
  if (!ua || !ua.isRegistered()) { emit('error', 'Telefone não registado'); return }
  const clean = String(number).replace(/[^\d+*#]/g, '')
  ua.call(clean, {
    mediaConstraints: { audio: true, video: false },
    pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
  })
}

export function answer() {
  session?.answer({
    mediaConstraints: { audio: true, video: false },
    pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
  })
}

export function hangup() { try { session?.terminate() } catch {} }
export function toggleMute() {
  if (!session) return false
  const m = session.isMuted().audio
  m ? session.unmute({ audio: true }) : session.mute({ audio: true })
  return !m
}
export function sendDTMF(tone) { session?.sendDTMF(tone) }
