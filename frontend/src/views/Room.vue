<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center py-10">
    <h1 class="text-3xl font-bold text-gray-800 mb-4">🃏 Комната: {{ roomId }}</h1>
    <p class="text-gray-600">Здесь будет интерфейс голосования и список участников.</p>
    <router-link
      to="/"
      class="mt-6 inline-block bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
    >
      ⬅️ На главную
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const roomId = route.params.id
</script>
