<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-white">
    <div v-if="!joined" class="min-h-screen flex flex-col justify-center items-center">
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold text-blue-800 mb-2">Planning Poker</h1>
        <p class="text-gray-600 text-lg">Join the estimation session</p>
      </div>
      
      <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-96">
        <h2 class="text-2xl font-semibold text-gray-800 mb-6 text-center">Join Room</h2>
        
        <div class="mb-6">
          <label class="block mb-2 text-sm font-medium text-gray-700">Your Name</label>
          <input
            v-model="participantName"
            type="text"
            placeholder="Enter your name..."
            class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
          />
        </div>
        
        <div class="mb-8">
          <label class="block mb-2 text-sm font-medium text-gray-700">Your Competency</label>
          <select
            v-model="competence"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
          >
            <option value="">Select competency</option>
            <option v-for="comp in COMPETENCIES" :key="comp" :value="comp">
              {{ comp }}
            </option>
          </select>
        </div>
        
        <button
          @click="joinRoom"
          :disabled="!participantName.trim() || !competence || joining"
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors duration-200 flex items-center justify-center"
        >
          <span v-if="joining" class="mr-2">⏳</span>
          {{ joining ? 'Connecting...' : '🔗 Join Room' }}
        </button>
      </div>
      
      <router-link
        to="/"
        class="mt-6 text-blue-600 hover:text-blue-800 font-medium transition-colors"
      >
        ← Back to Home
      </router-link>
    </div>

    <div v-else>
      <div class="container mx-auto px-4 py-6">
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h1 class="text-4xl font-bold text-blue-800 mb-2">🃏 {{ room?.name }}</h1>
              <p class="text-gray-600 text-lg">Estimation in {{ room?.estimation_type === 'story_points' ? 'Story Points' : 'Hours' }}</p>
            </div>
            <router-link
              to="/"
              class="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 font-medium transition-colors"
            >
              ⬅️ Home
            </router-link>
          </div>
        
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2">
              <div class="mb-8">
                <div class="flex justify-between items-center mb-6">
                  <h2 class="text-2xl font-semibold text-gray-800">Stories</h2>
                  <button
                    v-if="currentParticipant?.is_admin"
                    @click="showCreateStory = true"
                    class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium transition-colors"
                  >
                    ➕ Add Story
                  </button>
                </div>
                
                <div v-if="stories.length === 0" class="text-gray-500 text-center py-12 bg-gray-50 rounded-lg">
                  <p class="text-lg">No stories to estimate yet</p>
                </div>
              
              <div v-else class="space-y-3">
                <div
                  v-for="story in stories"
                  :key="story.id"
                  :class="[
                    'border rounded-lg p-4 cursor-pointer transition-colors',
                    currentStoryId === story.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  ]"
                  @click="setCurrentStory(story.id)"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <h3 class="font-semibold">{{ story.title }}</h3>
                      <p v-if="story.description" class="text-gray-600 text-sm mt-1">{{ story.description }}</p>
                      <div class="flex items-center mt-2 space-x-4">
                        <span :class="[
                          'px-2 py-1 rounded text-xs font-medium',
                          story.voting_state === 'closed' ? 'bg-yellow-100 text-yellow-800' :
                          story.voting_state === 'open' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        ]">
                          {{ story.voting_state === 'closed' ? 'Голосование' : 
                             story.voting_state === 'open' ? 'Результаты' : 'Завершено' }}
                        </span>
                        <span v-if="story.final_estimate" class="text-sm text-gray-600">
                          Оценка: {{ story.final_estimate }} {{ room?.estimation_type === 'story_points' ? 'SP' : 'ч' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="currentStoryId" class="bg-gray-100 rounded-lg p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Текущая история</h3>
                <div v-if="currentParticipant?.is_admin" class="space-x-2">
                  <button
                    v-if="currentStory?.voting_state === 'completed'"
                    @click="startVoting"
                    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    🔄 Переголосовать
                  </button>
                  <button
                    v-else-if="currentStory && currentStory.voting_state === 'closed'"
                    @click="startVoting"
                    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    ▶️ Начать голосование
                  </button>
                  <button
                    v-else-if="currentStory && currentStory.voting_state === 'closed'"
                    @click="revealVotes"
                    class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                  >
                    👁️ Показать результаты
                  </button>
                </div>
              </div>
              
              <div v-if="currentStory?.voting_state === 'closed'" class="mb-6">
                <h4 class="font-medium mb-3">Выберите вашу оценку:</h4>
                <div class="grid grid-cols-6 gap-2">
                  <button
                    v-for="value in estimationValues"
                    :key="value"
                    :class="[
                      'aspect-square rounded-lg border-2 font-bold text-lg transition-all',
                      selectedVote === value 
                        ? 'border-blue-500 bg-blue-100 text-blue-700' 
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    ]"
                    @click="submitVote(value)"
                    @mouseenter="showSimilarTasks(value)"
                    @mouseleave="hideSimilarTasks"
                  >
                    {{ value }}
                  </button>
                </div>
                
                <div v-if="similarTasks.length > 0" class="mt-4 p-3 bg-yellow-50 rounded border">
                  <h5 class="font-medium text-sm mb-2">Похожие задачи ({{ hoveredValue }}):</h5>
                  <div class="space-y-1">
                    <div v-for="task in similarTasks" :key="task.title" class="text-xs text-gray-600">
                      {{ task.title }} - {{ task.points }} {{ room?.estimation_type === 'story_points' ? 'SP' : 'ч' }}
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-if="currentStory?.voting_state === 'open'" class="mb-6">
                <h4 class="font-medium mb-3">Результаты голосования:</h4>
                <div class="space-y-2">
                  <div
                    v-for="vote in currentVotes"
                    :key="vote.participant_name"
                    class="flex justify-between items-center p-3 bg-white rounded border"
                  >
                    <div>
                      <span class="font-medium">{{ vote.participant_name }}</span>
                      <span class="text-sm text-gray-600 ml-2">({{ vote.competence }})</span>
                    </div>
                    <span class="font-bold text-lg">{{ vote.points }}</span>
                  </div>
                </div>
                
                <div v-if="currentParticipant?.is_admin" class="mt-4 flex items-center space-x-2">
                  <input
                    v-model="finalEstimate"
                    type="number"
                    step="0.5"
                    placeholder="Финальная оценка"
                    class="border rounded px-3 py-2 w-32"
                  />
                  <button
                    @click="finalizeEstimate"
                    :disabled="!finalEstimate"
                    class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    ✅ Зафиксировать
                  </button>
                </div>
              </div>
              
              <div class="text-sm text-gray-600">
                Проголосовало: {{ voteCount }} из {{ participants.length }}
              </div>
            </div>
          </div>
          
            <div class="lg:col-span-1">
              <div class="bg-gray-50 rounded-lg p-6">
                <h2 class="text-2xl font-semibold text-gray-800 mb-6">Participants</h2>
                <div class="space-y-3">
                  <div v-for="participant in participants" :key="participant.id" 
                       class="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                    <div>
                      <span class="font-medium text-gray-800">{{ participant.name }}</span>
                      <span class="text-sm text-gray-500 block">{{ participant.competence }}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span v-if="participant.is_admin" 
                            class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                        Admin
                      </span>
                      <button
                        v-if="currentParticipant?.is_admin && !participant.is_admin"
                        @click="makeAdmin(participant.id)"
                        class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                      >
                        Make Admin
                      </button>
                      <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>

    <div v-if="showCreateStory" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">Создать новую историю</h3>
        <div class="mb-4">
          <label class="block mb-2 text-sm font-medium">Название</label>
          <input
            v-model="newStoryTitle"
            type="text"
            placeholder="Введите название истории..."
            class="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div class="mb-6">
          <label class="block mb-2 text-sm font-medium">Описание (опционально)</label>
          <textarea
            v-model="newStoryDescription"
            placeholder="Введите описание..."
            class="w-full border rounded px-3 py-2 h-20 resize-none"
          ></textarea>
        </div>
        <div class="flex space-x-2">
          <button
            @click="createStory"
            :disabled="!newStoryTitle.trim()"
            class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            ✅ Создать
          </button>
          <button
            @click="cancelCreateStory"
            class="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
          >
            ❌ Отмена
          </button>
        </div>
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
