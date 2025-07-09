<template>
  <div class="min-h-screen bg-white">
    <!-- Header -->
    <header class="bg-white border-b border-gray-100 py-4">
      <div class="container mx-auto px-6 flex justify-between items-center">
        <router-link to="/" class="text-2xl font-bold text-blue-600">Planning Poker</router-link>
        <div class="flex gap-3">
          <button class="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            Войти
          </button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Регистрация
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-16">
      <div class="max-w-2xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-gray-800 mb-4">Создать новую сессию</h1>
          <p class="text-xl text-gray-600">Настройте параметры для оценки задач вашей команды</p>
        </div>
        
        <form @submit.prevent="createRoom" class="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div class="mb-8">
            <label class="block mb-3 text-lg font-medium text-gray-700">Название комнаты</label>
            <input
              v-model="roomName"
              type="text"
              placeholder="Введите название комнаты..."
              class="w-full border border-gray-300 rounded-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
              required
            />
          </div>
          
          <div class="mb-10">
            <label class="block mb-3 text-lg font-medium text-gray-700">Тип оценки</label>
            <select
              v-model="estimationType"
              class="w-full border border-gray-300 rounded-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
            >
              <option value="story_points">Story Points</option>
              <option value="hours">Часы</option>
            </select>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              :disabled="!roomName.trim() || creating"
              class="flex-1 bg-green-500 text-white py-4 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors duration-200 flex items-center justify-center text-lg"
            >
              <span v-if="creating" class="mr-2">⏳</span>
              {{ creating ? 'Создание...' : '🚀 Создать комнату' }}
            </button>
            
            <router-link
              to="/"
              class="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-lg hover:bg-gray-200 font-medium transition-colors text-lg text-center"
            >
              ← Назад
            </router-link>
          </div>
        </form>

        <!-- Info Cards -->
        <div class="grid md:grid-cols-2 gap-6 mt-12">
          <div class="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <div class="flex items-center mb-4">
              <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-blue-800">Story Points</h3>
            </div>
            <p class="text-blue-700">Используйте относительную оценку сложности задач по шкале Фибоначчи</p>
          </div>

          <div class="bg-green-50 p-6 rounded-xl border border-green-100">
            <div class="flex items-center mb-4">
              <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-green-800">Часы</h3>
            </div>
            <p class="text-green-700">Оценивайте задачи в часах для более точного планирования времени</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-50 py-8 text-center text-gray-500 text-sm mt-16">
      <p>© 2025 Planning Poker. Все права защищены.</p>
    </footer>
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
