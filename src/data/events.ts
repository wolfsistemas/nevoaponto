type Listener = () => void

const listeners = new Set<Listener>()

/** Registra um ouvinte de mudanca de dados. Retorna a funcao de cancelamento. */
export function onDataChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Notifica todos os ouvintes que os dados foram alterados. */
export function emitDataChange(): void {
  for (const listener of Array.from(listeners)) listener()
}
