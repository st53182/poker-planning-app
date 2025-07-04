<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="max-w-md w-full bg-white p-8 rounded-lg shadow">
      <h1 class="text-3xl font-bold text-center text-blue-600 mb-6">Planning Poker</h1>

      <div class="space-y-4">
        <router-link
          to="/create"
          class="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded"
        >
          🚀 Создать новую комнату
        </router-link>

        <router-link
          to="/join"
          class="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded"
        >
          ✅ Присоединиться к комнате
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style>
/* Здесь можно оставить Tailwind, кастомные стили пока не нужны */
</style>
