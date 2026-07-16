import { EditorPage } from '../editor/EditorPage'
import { ConstructionDrawingsPage } from '../features/construction-drawings/ConstructionDrawingsPage'
import { ComponentsManagerPage } from '../features/components-manager/ComponentsManagerPage'
import { AiCadCalibrationPage } from '../features/ai-cad-agent/AiCadCalibrationPage'

export const routes = [
  {
    path: '/',
    element: <EditorPage />,
  },
  {
    path: '/components_manager',
    element: <ComponentsManagerPage />,
  },
  {
    path: '/components_manager/ai-cad',
    element: <AiCadCalibrationPage />,
  },
  {
    path: '/construction_drawings',
    element: <ConstructionDrawingsPage />,
  },
]
