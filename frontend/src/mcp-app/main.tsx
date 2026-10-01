import { createRoot } from 'react-dom/client'
import { Workspace } from './Workspace'
import { McpHost } from './host'
import './styles.css'

createRoot(document.getElementById('root')!).render(<Workspace host={new McpHost()} />)
