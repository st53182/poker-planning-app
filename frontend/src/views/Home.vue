<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
    <div class="text-center">
      <h1 class="text-5xl font-bold mb-4 drop-shadow-lg">
        🎯 Planning Poker
      </h1>
      <p class="text-lg mb-8">
        Оценивайте задачи вместе с командой легко и быстро
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <!-- Создать комнату -->
        <button
          @click="createRoom"
          class="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg text-lg font-medium shadow-lg transition"
        >
          🚀 Создать комнату
        </button>

        <!-- Присоединиться к комнате -->
        <div class="flex gap-2">
          <input
            v-model="roomCode"
            type="text"
            placeholder="Введите код комнаты"
            class="px-4 py-2 rounded-lg text-gray-800 w-60 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            @click="joinRoom"
            class="bg-white text-purple-700 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium transition"
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const roomCode = ref('')

// Генерация новой комнаты
function createRoom() {
  const newRoomId = Math.random().toString(36).substring(2, 8) // 6-символьный код
  router.push(`/room/${newRoomId}`)
}

// Присоединение к существующей комнате
function joinRoom() {
  if (roomCode.value.trim()) {
    router.push(`/room/${roomCode.value.trim()}`)
  } else {
    alert('Введите код комнаты')
  }
}
</script>
