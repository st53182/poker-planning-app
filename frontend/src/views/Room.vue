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

    <main v-if="!joined" class="container mx-auto px-6 py-16">
      <div class="max-w-2xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-gray-800 mb-4">Присоединиться к сессии</h1>
          <p class="text-xl text-gray-600">Введите ваши данные для участия в оценке</p>
        </div>
        
        <form @submit.prevent="joinRoom" class="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div class="mb-8">
            <label class="block mb-3 text-lg font-medium text-gray-700">Ваше имя</label>
            <input
              v-model="participantName"
              type="text"
              placeholder="Введите ваше имя..."
              class="w-full border border-gray-300 rounded-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
              required
            />
          </div>
          
          <div class="mb-10">
            <label class="block mb-3 text-lg font-medium text-gray-700">Ваша компетенция</label>
            <select
              v-model="competence"
              class="w-full border border-gray-300 rounded-lg px-4 py-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
              required
            >
              <option value="">Выберите компетенцию</option>
              <option v-for="comp in COMPETENCIES" :key="comp" :value="comp">
                {{ comp }}
              </option>
            </select>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              :disabled="!participantName.trim() || !competence || joining"
              class="flex-1 bg-green-500 text-white py-4 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors duration-200 flex items-center justify-center text-lg"
            >
              <span v-if="joining" class="mr-2">⏳</span>
              {{ joining ? 'Подключение...' : '🔗 Присоединиться' }}
            </button>
            
            <router-link
              to="/"
              class="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-lg hover:bg-gray-200 font-medium transition-colors text-lg text-center"
            >
              ← Назад
            </router-link>
          </div>
        </form>
      </div>
    </main>

    <div v-else class="bg-white">
      <main class="container mx-auto px-6 py-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
          <div class="flex justify-between items-center mb-8">
            <div>
              <h1 class="text-4xl font-bold text-gray-800 mb-2">🃏 {{ room?.name }}</h1>
              <p class="text-xl text-gray-600">Оценка в {{ room?.estimation_type === 'story_points' ? 'Story Points' : 'часах' }}</p>
            </div>
            <router-link
              to="/"
              class="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              ← Главная
            </router-link>
          </div>
        
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2">
              <div class="mb-8">
                <div class="flex justify-between items-center mb-6">
                  <h2 class="text-2xl font-semibold text-gray-800">Истории</h2>
                  <button
                    v-if="currentParticipant?.is_admin"
                    @click="showCreateStory = true"
                    class="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium transition-colors"
                  >
                    ➕ Добавить историю
                  </button>
                </div>
                
                <div v-if="stories.length === 0" class="text-gray-500 text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
                  <p class="text-lg">Пока нет историй для оценки</p>
                  <p class="text-sm mt-2">Администратор может добавить первую историю</p>
                </div>
              
                <div v-else class="space-y-4">
                  <div
                    v-for="story in stories"
                    :key="story.id"
                    :class="[
                      'bg-white border rounded-xl p-6 cursor-pointer transition-all shadow-sm hover:shadow-md',
                      currentStoryId === story.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'
                    ]"
                    @click="setCurrentStory(story.id)"
                  >
                    <div class="flex justify-between items-start">
                      <div class="flex-1">
                        <h3 class="font-semibold text-lg text-gray-800">{{ story.title }}</h3>
                        <p v-if="story.description" class="text-gray-600 mt-2">{{ story.description }}</p>
                        <div class="flex items-center mt-4 space-x-4">
                          <span :class="[
                            'px-3 py-1 rounded-full text-sm font-medium',
                            story.voting_state === 'closed' ? 'bg-yellow-100 text-yellow-800' :
                            story.voting_state === 'open' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          ]">
                            {{ story.voting_state === 'closed' ? 'Ожидает голосования' : 
                               story.voting_state === 'open' ? 'Показать результаты' : 'Завершено' }}
                          </span>
                          <span v-if="story.final_estimate" class="text-sm text-gray-600 font-medium">
                            Итоговая оценка: {{ story.final_estimate }} {{ room?.estimation_type === 'story_points' ? 'SP' : 'ч' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            
              <div v-if="currentStoryId" class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div class="flex justify-between items-center mb-6">
                  <h3 class="text-xl font-semibold text-gray-800">Текущая история</h3>
                  <div v-if="currentParticipant?.is_admin" class="space-x-3">
                    <button
                      v-if="currentStory?.voting_state === 'completed'"
                      @click="startVoting"
                      class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      🔄 Переголосовать
                    </button>
                    <button
                      v-else-if="currentStory && currentStory.voting_state === 'closed'"
                      @click="startVoting"
                      class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 font-medium transition-colors"
                    >
                      ▶️ Начать голосование
                    </button>
                    <button
                      v-else-if="currentStory && currentStory.voting_state === 'open'"
                      @click="revealVotes"
                      class="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 font-medium transition-colors"
                    >
                      👁️ Показать результаты
                    </button>
                  </div>
                </div>
                
                <div v-if="currentStory?.voting_state === 'closed'" class="mb-6">
                  <h4 class="font-medium mb-4 text-lg text-gray-800">Выберите вашу оценку:</h4>
                  <div class="grid grid-cols-6 gap-3">
                    <button
                      v-for="value in estimationValues"
                      :key="value"
                      :class="[
                        'aspect-square rounded-xl border-2 font-bold text-lg transition-all shadow-sm hover:shadow-md',
                        selectedVote === value 
                          ? 'border-blue-500 bg-blue-100 text-blue-700 shadow-md' 
                          : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
                      ]"
                      @click="submitVote(value)"
                      @mouseenter="showSimilarTasks(value)"
                      @mouseleave="hideSimilarTasks"
                    >
                      {{ value }}
                    </button>
                  </div>
                  
                  <div v-if="similarTasks.length > 0" class="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h5 class="font-medium text-sm mb-3 text-yellow-800">Похожие задачи ({{ hoveredValue }}):</h5>
                    <div class="space-y-2">
                      <div v-for="task in similarTasks" :key="task.title" class="text-sm text-yellow-700 bg-white p-2 rounded border border-yellow-100">
                        {{ task.title }} - {{ task.points }} {{ room?.estimation_type === 'story_points' ? 'SP' : 'ч' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div v-if="currentStory?.voting_state === 'open'" class="mb-6">
                  <h4 class="font-medium mb-4 text-lg text-gray-800">Результаты голосования:</h4>
                  <div class="space-y-3">
                    <div
                      v-for="vote in currentVotes"
                      :key="vote.participant_name"
                      class="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div>
                        <span class="font-medium text-gray-800">{{ vote.participant_name }}</span>
                        <span class="text-sm text-gray-600 ml-2">({{ vote.competence }})</span>
                      </div>
                      <span class="font-bold text-xl text-blue-600">{{ vote.points }}</span>
                    </div>
                  </div>
                  
                  <div v-if="currentParticipant?.is_admin" class="mt-6 flex items-center space-x-3">
                    <input
                      v-model="finalEstimate"
                      type="number"
                      step="0.5"
                      placeholder="Финальная оценка"
                      class="border border-gray-300 rounded-lg px-4 py-3 w-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      @click="finalizeEstimate"
                      :disabled="!finalEstimate"
                      class="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors"
                    >
                      ✅ Зафиксировать
                    </button>
                  </div>
                </div>
                
                <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  Проголосовало: <span class="font-medium">{{ voteCount }}</span> из <span class="font-medium">{{ participants.length }}</span>
                </div>
              </div>
            </div>
            
            <div class="lg:col-span-1">
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 class="text-2xl font-semibold text-gray-800 mb-6">Участники</h2>
                <div class="space-y-3">
                  <div v-for="participant in participants" :key="participant.id" 
                       class="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <span class="font-medium text-gray-800">{{ participant.name }}</span>
                      <span class="text-sm text-gray-500 block">{{ participant.competence }}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span v-if="participant.is_admin" 
                            class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                        Админ
                      </span>
                      <button
                        v-if="currentParticipant?.is_admin && !participant.is_admin"
                        @click="makeAdmin(participant.id)"
                        class="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                      >
                        Сделать админом
                      </button>
                      <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="bg-gray-50 py-8 text-center text-gray-500 text-sm">
        <p>© 2025 Planning Poker. Все права защищены.</p>
      </footer>
    </div>

    <!-- Create Story Modal -->
    <div v-if="showCreateStory" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-lg p-8 w-96 max-w-md mx-4">
        <h3 class="text-2xl font-semibold mb-6 text-gray-800">Создать новую историю</h3>
        <div class="mb-6">
          <label class="block mb-3 text-lg font-medium text-gray-700">Название</label>
          <input
            v-model="newStoryTitle"
            type="text"
            placeholder="Введите название истории..."
            class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
          />
        </div>
        <div class="mb-8">
          <label class="block mb-3 text-lg font-medium text-gray-700">Описание (опционально)</label>
          <textarea
            v-model="newStoryDescription"
            placeholder="Введите описание..."
            class="w-full border border-gray-300 rounded-lg px-4 py-3 h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          ></textarea>
        </div>
        <div class="flex space-x-3">
          <button
            @click="createStory"
            :disabled="!newStoryTitle.trim()"
            class="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors"
          >
            ✅ Создать
          </button>
          <button
            @click="cancelCreateStory"
            class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            ❌ Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSocket } from '../composables/useSocket'
import { COMPETENCIES, STORY_POINTS, HOURS } from '../types'
import type { Participant, Story, Vote, Room, SimilarTask } from '../types'

const route = useRoute()
const roomId = route.params.id as string

const { connect, disconnect, emit, on } = useSocket()

const joined = ref(false)
const joining = ref(false)
const participantName = ref('')
const competence = ref('')

const room = ref<Room | null>(null)
const currentParticipant = ref<Participant | null>(null)
const participants = ref<Participant[]>([])
const stories = ref<Story[]>([])
const currentStoryId = ref<number | null>(null)
const currentVotes = ref<Vote[]>([])
const voteCount = ref(0)
const selectedVote = ref<number | null>(null)
const finalEstimate = ref('')

const showCreateStory = ref(false)
const newStoryTitle = ref('')
const newStoryDescription = ref('')

const similarTasks = ref<SimilarTask[]>([])
const hoveredValue = ref<number | null>(null)

const currentStory = computed(() => {
  return stories.value.find(s => s.id === currentStoryId.value)
})

const estimationValues = computed(() => {
  return room.value?.estimation_type === 'story_points' ? STORY_POINTS : HOURS
})

onMounted(() => {
  const savedJoinData = localStorage.getItem('joinData')
  if (savedJoinData) {
    const data = JSON.parse(savedJoinData)
    if (data.roomId === roomId) {
      participantName.value = data.name
      competence.value = data.competence
      localStorage.removeItem('joinData')
    }
  }
  
  connect()
  setupSocketListeners()
})

onUnmounted(() => {
  disconnect()
})

function setupSocketListeners() {
  on('room_joined', (data: any) => {
    joined.value = true
    joining.value = false
    room.value = {
      id: data.room,
      name: data.room_name,
      estimation_type: data.estimation_type,
      current_story: data.current_story
    }
    currentParticipant.value = data.participant
    participants.value = data.participants
    stories.value = data.stories
    currentStoryId.value = data.current_story
  })

  on('user_joined', (data: any) => {
    participants.value.push(data.participant)
  })

  on('story_created', (data: any) => {
    stories.value.push(data.story)
  })

  on('current_story_changed', (data: any) => {
    currentStoryId.value = data.story_id
  })

  on('voting_started', (data: any) => {
    const story = stories.value.find(s => s.id === data.story_id)
    if (story) {
      story.voting_state = 'closed'
      story.final_estimate = null
    }
    currentVotes.value = []
    voteCount.value = 0
    selectedVote.value = null
  })

  on('vote_submitted', (data: any) => {
    voteCount.value = data.vote_count
  })

  on('votes_revealed', (data: any) => {
    const story = stories.value.find(s => s.id === data.story_id)
    if (story) {
      story.voting_state = 'open'
    }
    currentVotes.value = data.votes
  })

  on('estimate_finalized', (data: any) => {
    const story = stories.value.find(s => s.id === data.story_id)
    if (story) {
      story.voting_state = 'completed'
      story.final_estimate = data.final_estimate
    }
  })

  on('similar_tasks', (data: any) => {
    if (data.vote_value === hoveredValue.value) {
      similarTasks.value = data.tasks
    }
  })

  on('admin_added', (data: any) => {
    const participant = participants.value.find(p => p.id === data.participant.id)
    if (participant) {
      participant.is_admin = true
    }
  })

  on('error', (error: any) => {
    alert(`Ошибка: ${error.message}`)
    if (!joined.value) {
      joining.value = false
    }
  })
}

function joinRoom() {
  if (!participantName.value.trim() || !competence.value || joining.value) return
  
  joining.value = true
  
  emit('join_room', {
    room: roomId,
    name: participantName.value.trim(),
    competence: competence.value,
    session_id: Math.random().toString(36).substring(7)
  })
}

function setCurrentStory(storyId: number) {
  if (!currentParticipant.value?.is_admin) return
  
  emit('set_current_story', {
    room: roomId,
    story_id: storyId,
    participant_id: currentParticipant.value.id
  })
}

function startVoting() {
  if (!currentParticipant.value?.is_admin || !currentStoryId.value) return
  
  emit('start_voting', {
    room: roomId,
    story_id: currentStoryId.value,
    participant_id: currentParticipant.value.id
  })
}

function submitVote(points: number) {
  if (!currentParticipant.value || !currentStoryId.value) return
  
  selectedVote.value = points
  
  emit('submit_vote', {
    room: roomId,
    story_id: currentStoryId.value,
    points: points,
    participant_id: currentParticipant.value.id
  })
}

function revealVotes() {
  if (!currentParticipant.value?.is_admin || !currentStoryId.value) return
  
  emit('reveal_votes', {
    room: roomId,
    story_id: currentStoryId.value,
    participant_id: currentParticipant.value.id
  })
}

function finalizeEstimate() {
  if (!currentParticipant.value?.is_admin || !currentStoryId.value || !finalEstimate.value) return
  
  emit('finalize_estimate', {
    room: roomId,
    story_id: currentStoryId.value,
    final_estimate: parseFloat(finalEstimate.value),
    participant_id: currentParticipant.value.id
  })
  
  finalEstimate.value = ''
}

function createStory() {
  if (!currentParticipant.value || !newStoryTitle.value.trim()) return
  
  emit('create_story', {
    room: roomId,
    title: newStoryTitle.value.trim(),
    description: newStoryDescription.value.trim(),
    participant_id: currentParticipant.value.id
  })
  
  cancelCreateStory()
}

function cancelCreateStory() {
  showCreateStory.value = false
  newStoryTitle.value = ''
  newStoryDescription.value = ''
}

function showSimilarTasks(value: number) {
  if (!currentParticipant.value) return
  
  hoveredValue.value = value
  
  emit('get_similar_tasks', {
    room: roomId,
    vote_value: value,
    competence: currentParticipant.value.competence
  })
}

function hideSimilarTasks() {
  hoveredValue.value = null
  similarTasks.value = []
}

function makeAdmin(participantId: number) {
  if (!currentParticipant.value?.is_admin) return
  
  emit('make_admin', {
    room: roomId,
    target_participant_id: participantId,
    participant_id: currentParticipant.value.id
  })
}
</script>
