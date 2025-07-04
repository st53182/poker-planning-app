<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-blue-50">
    <h1 class="text-3xl font-bold text-purple-700 mb-6">🚀 Создание новой комнаты</h1>
    <form @submit.prevent="createRoom" class="bg-white p-6 rounded-lg shadow-md w-80">
      <label class="block mb-2 text-sm font-medium">Название комнаты</label>
      <input
        v-model="roomName"
        type="text"
        placeholder="Введите название..."
        class="w-full border rounded px-3 py-2 mb-4"
      />
      <button
        type="submit"
        class="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
      >
        ✅ Создать
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const roomName = ref('')
const router = useRouter()

function createRoom() {
  if (roomName.value.trim()) {
    console.log('Создана комната:', roomName.value)
    router.push(`/room/${roomName.value}`)
  }
}
</script>
