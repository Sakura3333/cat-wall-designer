import { EditorPage } from '../editor/EditorPage'
import { ComponentsManagerPage } from '../features/components-manager/ComponentsManagerPage'

export const routes = [
  {
    path: '/',
    element: <EditorPage />,
  },
  {
    path: '/components_manager',
    element: <ComponentsManagerPage />,
  },
]
