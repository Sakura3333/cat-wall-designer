import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EditorPage } from '../editor/EditorPage'
import { ComponentsManagerPage } from '../features/components-manager/ComponentsManagerPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/components_manager" element={<ComponentsManagerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
