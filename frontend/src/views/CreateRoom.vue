<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col justify-center items-center">
    <div class="text-center mb-8">
      <h1 class="text-5xl font-bold text-blue-800 mb-2">Planning Poker</h1>
      <p class="text-gray-600 text-lg">Collaborative estimation made simple</p>
    </div>
    
    <form @submit.prevent="createRoom" class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-96">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6 text-center">Create New Room</h2>
      
      <div class="mb-6">
        <label class="block mb-2 text-sm font-medium text-gray-700">Room Name</label>
        <input
          v-model="roomName"
          type="text"
          placeholder="Enter room name..."
          class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          required
        />
      </div>
      
      <div class="mb-8">
        <label class="block mb-2 text-sm font-medium text-gray-700">Estimation Type</label>
        <select
          v-model="estimationType"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <option value="story_points">Story Points</option>
          <option value="hours">Hours</option>
        </select>
      </div>
      
      <button
        type="submit"
        :disabled="!roomName.trim() || creating"
        class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors duration-200 flex items-center justify-center"
      >
        <span v-if="creating" class="mr-2">⏳</span>
        {{ creating ? 'Creating...' : '✅ Create Room' }}
      </button>
    </form>
    
    <router-link
      to="/"
      class="mt-6 text-blue-600 hover:text-blue-800 font-medium transition-colors"
    >
      ← Back to Home
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const roomName = ref('')
const estimationType = ref<'story_points' | 'hours'>('story_points')
const creating = ref(false)
const router = useRouter()
const { connect, emit, on, disconnect, connected } = useSocket()

function createRoom() {
  if (!roomName.value.trim() || creating.value) return
  
  creating.value = true
  connect()
  
  on('room_created', (data: { room_id: string, name: string }) => {
    creating.value = false
    disconnect()
    router.push(`/room/${data.room_id}`)
  })
  
  on('error', (error: { message: string }) => {
    creating.value = false
    alert(`Ошибка: ${error.message}`)
  })
  
  // Wait for connection before emitting
  const checkConnection = () => {
    if (connected.value) {
      emit('create_room', {
        name: roomName.value.trim(),
        estimation_type: estimationType.value
      })
    } else {
      setTimeout(checkConnection, 100)
    }
  }
  checkConnection()
}
</script>
