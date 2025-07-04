<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-green-50">
    <h1 class="text-3xl font-bold text-green-700 mb-6">✅ Присоединение к комнате</h1>
    <form @submit.prevent="joinRoom" class="bg-white p-6 rounded-lg shadow-md w-80">
      <label class="block mb-2 text-sm font-medium">ID комнаты</label>
      <input
        v-model="roomId"
        type="text"
        placeholder="Введите ID комнаты..."
        class="w-full border rounded px-3 py-2 mb-4"
      />
      <button
        type="submit"
        class="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        🔗 Присоединиться
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const roomId = ref('')
const router = useRouter()

function joinRoom() {
  if (roomId.value.trim()) {
    console.log('Присоединение к комнате:', roomId.value)
    router.push(`/room/${roomId.value}`)
  }
}
</script>
