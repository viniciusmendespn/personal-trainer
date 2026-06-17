import { createContext, useCallback, useContext, useState } from 'react'

interface ChatContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  alunoId: string | null
  setAlunoId: (id: string | null) => void
  openChat: (alunoId: string) => void
}

const ChatContext = createContext<ChatContextValue>({
  open: false,
  setOpen: () => {},
  alunoId: null,
  setAlunoId: () => {},
  openChat: () => {},
})

export function ChatContextProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [alunoId, setAlunoId] = useState<string | null>(null)

  const openChat = useCallback((id: string) => {
    setAlunoId(id)
    setOpen(true)
  }, [])

  return (
    <ChatContext.Provider value={{ open, setOpen, alunoId, setAlunoId, openChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatContext)
}
