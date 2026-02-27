export interface ProjectMeta {
  id: string
  title: string
  status: 'created' | 'processing' | 'ready' | 'error'
  createdAt: number
  updatedAt: number
}

export interface ProjectIndex {
  projects: ProjectMeta[]
}

export interface TranscriptWord {
  start_ms: number
  end_ms: number
  word: string
  speaker: string
  confidence: number
}

export interface Transcript {
  words: TranscriptWord[]
}

export interface Segment {
  id: string
  start_ms: number
  end_ms: number
  speaker: string
  text: string
  emotion_score: number
  story_score: number
  clarity_score: number
}

export interface StoryBeat {
  name: 'Hook' | 'Build' | 'Peak' | 'Resolve'
  segment_ids: string[]
}

export interface Story {
  beats: StoryBeat[]
}
