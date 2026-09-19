import type { Database } from './types'
import { criarSeed } from './seed'

const KEY = 'pontoflow.db.v1'

type Listener = () => void

let db: Database | null = null
const listeners = new Set<Listener>()

function read(): Database {
  if (db) return db
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      db = JSON.parse(raw) as Database
      return db
    }
  } catch {
    // ignora storage indisponivel/corrompido e recria
  }
  db = criarSeed()
  persist()
  return db
}

function persist(): void {
  if (!db) return
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // storage cheio/indisponivel: mantem em memoria
  }
}

export const localStore = {
  get(): Database {
    return read()
  },
  mutate(fn: (database: Database) => void): Database {
    const database = read()
    fn(database)
    persist()
    listeners.forEach((l) => l())
    return database
  },
  reset(): Database {
    db = criarSeed()
    persist()
    listeners.forEach((l) => l())
    return db
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function novoId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`
}
