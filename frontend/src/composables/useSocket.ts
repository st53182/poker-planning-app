import { io, Socket } from 'socket.io-client'
import { ref, onUnmounted } from 'vue'

export function useSocket() {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  
  const connect = () => {
    if (socket.value?.connected) return
    
    socket.value = io('http://localhost:10000', {
      transports: ['websocket', 'polling']
    })
    
    socket.value.on('connect', () => {
      connected.value = true
    })
    
    socket.value.on('disconnect', () => {
      connected.value = false
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
      socket.value.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit event:', event)
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
