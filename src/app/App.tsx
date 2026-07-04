import { EditorPage } from '../editor/EditorPage'
import { ComponentsManagerPage } from '../features/components-manager/ComponentsManagerPage'

export function App() {
  if (window.location.pathname === '/components_manager') {
    return <ComponentsManagerPage />
  }

  return <EditorPage />
}
