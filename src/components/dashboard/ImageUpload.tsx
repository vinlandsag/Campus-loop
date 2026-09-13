'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null, file: File | null) => void
  disabled?: boolean
  className?: string
}

export function ImageUpload({ value, onChange, disabled, className }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    onChange(previewUrl, file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value)
    }
    onChange(null, null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        disabled={disabled}
      />
      
      {value ? (
        <div className="relative group aspect-video w-full overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-muted]">
          <Image
            src={value}
            alt="Event banner preview"
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              Remove Image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={disabled}
          className={cn(
            'flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors',
            isDragging
              ? 'border-[--accent-400] bg-[--accent-50]'
              : 'border-[--border-default] bg-[--bg-surface] hover:border-[--border-strong] hover:bg-[--bg-muted]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--bg-muted] text-[--text-secondary]">
            <ImagePlus className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[--text-primary]">
              Click to upload or drag and drop
            </p>
            <p className="mt-1 text-xs text-[--text-muted]">
              SVG, PNG, JPG or GIF (max. 5MB)
            </p>
          </div>
        </button>
      )}
    </div>
  )
}
