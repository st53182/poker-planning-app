<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col justify-center items-center">
    <h1 class="text-5xl font-bold text-purple-700 mb-10">🃏 Planning Poker</h1>
    <div class="flex flex-col space-y-4">
      <router-link
        to="/create"
        class="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition"
      >
        🚀 Создать новую комнату
      </router-link>
      <router-link
        to="/join"
        class="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition"
      >
        ✅ Присоединиться к комнате
      </router-link>
    </div>
  </div>
</template>
