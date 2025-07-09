<template>
  <div class="min-h-screen bg-white">
    <!-- Header -->
    <header class="bg-white border-b border-gray-100 py-4">
      <div class="container mx-auto px-6 flex justify-between items-center">
        <div class="text-2xl font-bold text-blue-600">Planning Poker</div>
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
      <div class="text-center max-w-4xl mx-auto">
        <h1 class="text-5xl font-bold text-gray-800 mb-6">
          Оцените зрелость вашей Agile-команды
        </h1>
        <p class="text-xl text-gray-600 mb-12 leading-relaxed">
          Проведите оценку и получите персонализированные рекомендации по улучшению вашей команды.
        </p>

        <!-- Action Section -->
        <div class="mb-16">
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <label class="text-lg text-gray-700 font-medium">Сфера деятельности:</label>
            <select class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg min-w-48">
              <option>Planning Poker</option>
              <option>Scrum Planning</option>
              <option>Story Points</option>
            </select>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <router-link
              to="/create"
              class="bg-green-500 text-white px-8 py-4 rounded-lg hover:bg-green-600 font-medium transition-colors text-lg inline-flex items-center justify-center"
            >
              🚀 Создать новую сессию
            </router-link>
            
            <div class="flex items-center">
              <input
                v-model="joinRoomId"
                type="text"
                placeholder="Введите ID комнаты..."
                class="border border-gray-300 rounded-l-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
              />
              <button
                @click="joinRoom"
                :disabled="!joinRoomId.trim()"
                class="bg-blue-600 text-white px-6 py-4 rounded-r-lg hover:bg-blue-700 font-medium transition-colors text-lg disabled:opacity-50"
              >
                🔗 Присоединиться
              </button>
            </div>
          </div>
        </div>

        <!-- Features Grid -->
        <div class="grid md:grid-cols-3 gap-8 mb-16">
          <div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-blue-600 mb-4">Анализ уровня зрелости команды</h3>
            <p class="text-gray-600 leading-relaxed">
              Оцените текущее состояние командной динамики, ролей и процессов с помощью ИИ-анализа. Отслеживайте прогресс во времени и формируйте основанные цели для роста команды используя нашу платформу.
            </p>
          </div>

          <div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
            <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-blue-600 mb-4">Мотивация по DISC</h3>
            <p class="text-gray-600 leading-relaxed">
              Planning Poker поможет вам понять, что действительно мотивирует ваших сотрудников. Получайте персонализированные рекомендации и краткие профили на каждого члена команды — всё внутри одной платформы.
            </p>
          </div>

          <div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
            <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-blue-600 mb-4">Разрешение конфликтов</h3>
            <p class="text-gray-600 leading-relaxed">
              Выявляйте конфликты в команде и получайте рекомендации от AI по их разрешению. Право на приобретение — на основе поведенческих паттернов поведения сотрудников.
            </p>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-50 py-8 text-center text-gray-500 text-sm">
      <p>© 2025 Planning Poker. Все права защищены.</p>
    </footer>
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
