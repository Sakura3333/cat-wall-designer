import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EditorPage } from '../editor/EditorPage'
import { ConstructionDrawingsPage } from '../features/construction-drawings/ConstructionDrawingsPage'
import { ComponentsManagerPage } from '../features/components-manager/ComponentsManagerPage'
import { AiCadCalibrationPage } from '../features/ai-cad-agent/AiCadCalibrationPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/components_manager" element={<ComponentsManagerPage />} />
        <Route path="/components_manager/ai-cad" element={<AiCadCalibrationPage />} />
        <Route path="/construction_drawings" element={<ConstructionDrawingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
