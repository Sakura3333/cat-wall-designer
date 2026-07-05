import { UploadCloud } from 'lucide-react'
import { useRef } from 'react'
import { useEditorStore } from '../../editor/editorStore'
import { saveBlob, sourceImageBlobKey } from '../../persistence/indexedDb'

type ImageUploadButtonProps = {
  label?: string
  className?: string
}

export function ImageUploadButton({ label = '上传室内图', className = 'pill-button' }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setSourceImage = useEditorStore((state) => state.setSourceImage)
  const projectId = useEditorStore((state) => state.project.id)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    await saveBlob(sourceImageBlobKey(projectId), file)
    await saveBlob('latest-source-image', file)
    const image = new Image()
    image.onload = () => {
      setSourceImage({
        url,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.src = url
  }

  return (
    <>
      <button className={className} type="button" onClick={() => inputRef.current?.click()}>
        <UploadCloud size={18} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}
