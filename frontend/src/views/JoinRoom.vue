<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-green-50">
    <h1 class="text-3xl font-bold text-green-700 mb-6">✅ Присоединение к комнате</h1>
    <form @submit.prevent="joinRoom" class="bg-white p-6 rounded-lg shadow-md w-96">
      <div class="mb-4">
        <label class="block mb-2 text-sm font-medium">ID комнаты</label>
        <input
          v-model="roomId"
          type="text"
          placeholder="Введите ID комнаты..."
          class="w-full border rounded px-3 py-2"
          required
        />
      </div>
      
      <div class="mb-4">
        <label class="block mb-2 text-sm font-medium">Ваше имя</label>
        <input
          v-model="participantName"
          type="text"
          placeholder="Введите ваше имя..."
          class="w-full border rounded px-3 py-2"
          required
        />
      </div>
      
      <div class="mb-6">
        <label class="block mb-2 text-sm font-medium">Ваша компетенция</label>
        <select
          v-model="competence"
          class="w-full border rounded px-3 py-2"
          required
        >
          <option value="">Выберите компетенцию</option>
          <option v-for="comp in COMPETENCIES" :key="comp" :value="comp">
            {{ comp }}
          </option>
        </select>
      </div>
      
      <button
        type="submit"
        :disabled="!roomId.trim() || !participantName.trim() || !competence || joining"
        class="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {{ joining ? '⏳ Подключение...' : '🔗 Присоединиться' }}
      </button>
    </form>
    
    <router-link
      to="/"
      class="mt-4 text-green-600 hover:text-green-800"
    >
      ← Назад на главную
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { COMPETENCIES } from '../types'

const roomId = ref('')
const participantName = ref('')
const competence = ref('')
const joining = ref(false)
const router = useRouter()

function joinRoom() {
  if (!roomId.value.trim() || !participantName.value.trim() || !competence.value || joining.value) return
  
  joining.value = true
  
  const joinData = {
    roomId: roomId.value.trim(),
    name: participantName.value.trim(),
    competence: competence.value
  }
  
  localStorage.setItem('joinData', JSON.stringify(joinData))
  router.push(`/room/${roomId.value.trim()}`)
}
</script>
