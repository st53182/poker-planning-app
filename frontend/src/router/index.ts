import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import CreateRoom from '../views/CreateRoom.vue'
import JoinRoom from '../views/JoinRoom.vue'
import Room from '../views/Room.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/create', component: CreateRoom },
  { path: '/join', component: JoinRoom },
  { path: '/room/:id', component: Room },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router