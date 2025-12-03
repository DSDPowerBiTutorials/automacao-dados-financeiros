"use client"

import { useState } from "react"
import { Pencil, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface EditableSubtitleProps {
  initialText: string
  onSave?: (value: string) => void
}

export function EditableSubtitle({ initialText, onSave }: EditableSubtitleProps) {
  const [text, setText] = useState(initialText)
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = () => {
    setIsEditing(false)
    onSave?.(text)
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input value={text} onChange={(event) => setText(event.target.value)} className="h-8 w-72" />
          <Button variant="secondary" size="sm" onClick={handleSave}>
            <Save className="mr-1 h-4 w-4" />
            Salvar
          </Button>
        </div>
      ) : (
        <>
          <span>{text}</span>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-1 h-3 w-3" />
            Editar
          </Button>
        </>
      )}
    </div>
  )
}
