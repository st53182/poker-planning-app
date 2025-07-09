export interface Participant {
  id: number
  name: string
  competence: string
  is_admin: boolean
}

export interface Story {
  id: number
  title: string
  description: string
  voting_state: 'closed' | 'open' | 'completed'
  final_estimate: number | null
}

export interface Vote {
  participant_name: string
  competence: string
  points: number
}

export interface Room {
  id: string
  name: string
  estimation_type: 'story_points' | 'hours'
  current_story: number | null
}

export interface SimilarTask {
  title: string
  points: number
  created_at: string
}

export const COMPETENCIES = ['BE', 'FE', 'DB', 'Analyst', 'FullStack', 'QA', 'Architect']
export const ESTIMATION_TYPES = ['story_points', 'hours']
export const STORY_POINTS = [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
export const HOURS = [1, 2, 4, 8, 16, 24, 32, 40, 48, 56, 64]
