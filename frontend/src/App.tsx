import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { SupplierDetailPage } from '@/pages/SupplierDetailPage'
import { RiskEventsPage } from '@/pages/RiskEventsPage'
import { NetworkPage } from '@/pages/NetworkPage'
import { PrioritizationPage } from '@/pages/PrioritizationPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Dashboard routes */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Supplier Network */}
          <Route path="/network" element={<NetworkPage />} />

          {/* Suppliers directory & detail */}
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetailPage />} />

          {/* Risk signals feed */}
          <Route path="/risk-events" element={<RiskEventsPage />} />

          {/* Mitigation Prioritization engine */}
          <Route path="/prioritization" element={<PrioritizationPage />} />

          {/* 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
