<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-blue-50">
    <h1 class="text-3xl font-bold text-purple-700 mb-6">🚀 Создание новой комнаты</h1>
    <form @submit.prevent="createRoom" class="bg-white p-6 rounded-lg shadow-md w-96">
      <div class="mb-4">
        <label class="block mb-2 text-sm font-medium">Название комнаты</label>
        <input
          v-model="roomName"
          type="text"
          placeholder="Введите название..."
          class="w-full border rounded px-3 py-2"
          required
        />
      </div>
      
      <div class="mb-6">
        <label class="block mb-2 text-sm font-medium">Тип оценки</label>
        <select
          v-model="estimationType"
          class="w-full border rounded px-3 py-2"
        >
          <option value="story_points">Story Points</option>
          <option value="hours">Часы</option>
        </select>
      </div>
      
      <button
        type="submit"
        :disabled="!roomName.trim() || creating"
        class="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {{ creating ? '⏳ Создание...' : '✅ Создать' }}
      </button>
    </form>
    
    <router-link
      to="/"
      class="mt-4 text-purple-600 hover:text-purple-800"
    >
      ← Назад на главную
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
