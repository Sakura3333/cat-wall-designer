import { useEffect } from 'react'
import { useEditorStore } from '../../editor/editorStore'

export function ShortcutBar() {
  const transformMode = useEditorStore((state) => state.transformMode)

  return (
    <footer className="floating-panel shortcut-panel" aria-label="快捷键提示">
      <span className={transformMode === 'select' ? 'shortcut active' : 'shortcut'}>
        <b>Q</b>
        选择
      </span>
      <span className={transformMode === 'translate' ? 'shortcut active' : 'shortcut'}>
        <b>W</b>
        移动
      </span>
      <span className={transformMode === 'rotate' ? 'shortcut active' : 'shortcut'}>
        <b>E</b>
        旋转
      </span>
      <span className="shortcut">
        <b>D</b>
        删除
      </span>
      <span className="shortcut">
        <b>Esc</b>
        退出
      </span>
      <span className="shortcut">
        <b>Ctrl+Z</b>
        撤销
      </span>
      <span className="shortcut">
        <b>Ctrl+Y</b>
        重做
      </span>
    </footer>
  )
}

export function useShortcutKeys() {
  const setTransformMode = useEditorStore((state) => state.setTransformMode)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const selectSceneObject = useEditorStore((state) => state.selectSceneObject)
  const deleteSelectedSceneObject = useEditorStore((state) => state.deleteSelectedSceneObject)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        Boolean(target?.isContentEditable)

      if (isTypingTarget && !(event.ctrlKey || event.metaKey)) return

      if (event.key === 'Escape') {
        selectSceneObject(null)
        setTransformMode('select')
        return
      }

      if (!event.ctrlKey && !event.metaKey) {
        if (event.key === 'q' || event.key === 'Q') {
          setTransformMode('select')
        }
        if (event.key === 'w' || event.key === 'W') {
          setTransformMode('translate')
        }
        if (event.key === 'e' || event.key === 'E') {
          setTransformMode('rotate')
        }
        if (event.key === 'd' || event.key === 'D') {
          deleteSelectedSceneObject()
        }
        return
      }

      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault()
        undo()
      }

      if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedSceneObject, redo, selectSceneObject, setTransformMode, undo])
}
