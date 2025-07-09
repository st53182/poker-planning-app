<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col justify-center items-center">
    <div class="text-center mb-12">
      <h1 class="text-6xl font-bold text-blue-800 mb-4">Planning Poker</h1>
      <p class="text-gray-600 text-xl mb-8">Collaborative estimation for agile teams</p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link
          to="/create"
          class="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 font-medium transition-colors text-lg"
        >
          🚀 Start New Session
        </router-link>
        
        <div class="flex items-center">
          <input
            v-model="joinRoomId"
            type="text"
            placeholder="Enter room ID..."
            class="border border-gray-300 rounded-l-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
          />
          <button
            @click="joinRoom"
            :disabled="!joinRoomId.trim()"
            class="bg-white text-blue-600 px-6 py-4 rounded-r-lg border-2 border-blue-600 hover:bg-blue-50 font-medium transition-colors text-lg disabled:opacity-50"
          >
            🔗 Join
          </button>
        </div>
      </div>
    </div>
    
    <div class="text-center text-gray-500 text-sm">
      <p>Trusted by teams worldwide for agile estimation</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const joinRoomId = ref('')

function joinRoom() {
  if (joinRoomId.value.trim()) {
    router.push(`/room/${joinRoomId.value.trim()}`)
  }
}
</script>
