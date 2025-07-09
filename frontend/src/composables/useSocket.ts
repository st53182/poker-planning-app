import { io, Socket } from 'socket.io-client'
import { ref, onUnmounted } from 'vue'

export function useSocket() {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  
  const connect = () => {
    if (socket.value?.connected) return
    
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:10000' 
      : window.location.origin
    
    console.log('🔌 Attempting SocketIO connection to:', socketUrl)
    
    socket.value = io(socketUrl, {
      transports: ['websocket', 'polling']
    })
    
    socket.value.on('connect', () => {
      console.log('✅ SocketIO connected successfully')
      connected.value = true
    })
    
    socket.value.on('disconnect', () => {
      console.log('❌ SocketIO disconnected')
      connected.value = false
    })
    
    socket.value.on('connect_error', (error) => {
      console.error('🚫 SocketIO connection error:', error)
    })
  }
  
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      connected.value = false
    }
  }
  
  const emit = (event: string, data?: any) => {
    if (socket.value?.connected) {
      console.log('📤 Emitting event:', event, 'with data:', data)
      socket.value.emit(event, data)
    } else {
      console.warn('🚫 Socket not connected, cannot emit event:', event)
    }
  }
  
  const on = (event: string, callback: (...args: any[]) => void) => {
    socket.value?.on(event, callback)
  }
  
  const off = (event: string, callback?: (...args: any[]) => void) => {
    socket.value?.off(event, callback)
  }
  
  onUnmounted(() => {
    disconnect()
  })
  
  return { 
    socket, 
    connected, 
    connect, 
    disconnect, 
    emit, 
    on, 
    off 
  }
}
