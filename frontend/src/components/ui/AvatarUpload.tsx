import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Avatar } from './Avatar'
import axios from 'axios'
import { prepareMediaForUpload } from '../../utils/media'

interface AvatarUploadProps {
  name: string
  currentUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  getUploadUrl: (filename: string, contentType: string) => Promise<{ upload_url: string; s3_key: string }>
  onSuccess: (s3Key: string) => void
  onError?: (err: unknown) => void
}

export function AvatarUpload({ name, currentUrl, size = 'lg', getUploadUrl, onSuccess, onError }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)
    try {
      const prepared = await prepareMediaForUpload(file)
      const { upload_url, s3_key } = await getUploadUrl(prepared.name, prepared.type)
      await axios.put(upload_url, prepared, { headers: { 'Content-Type': prepared.type } })
      onSuccess(s3_key)
    } catch (err) {
      setPreview(null)
      onError?.(err)
    } finally {
      setUploading(false)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  const displayUrl = preview ?? currentUrl

  return (
    <div className="relative inline-block cursor-pointer" onClick={() => !uploading && inputRef.current?.click()}>
      <Avatar name={name} imageUrl={displayUrl} size={size} />
      <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
        {uploading
          ? <Loader2 size={16} className="text-white animate-spin" />
          : <Camera size={16} className="text-white" />}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
        disabled={uploading}
      />
    </div>
  )
}
