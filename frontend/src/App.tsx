import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from '@/landing/LandingPage'
import { AppShell } from '@/app/AppShell'
import { OverviewPage } from '@/app/pages/Overview'
import { NetworkPage } from '@/app/pages/Network'
import { SuppliersPage } from '@/app/pages/Suppliers'
import { SupplierDetailPage } from '@/app/pages/SupplierDetail'
import { SignalsPage } from '@/app/pages/Signals'
import { OptimizerPage } from '@/app/pages/Optimizer'
import { ValidationPage } from '@/app/pages/Validation'
import { NotFoundPage } from '@/app/pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="signals" element={<SignalsPage />} />
          <Route path="optimizer" element={<OptimizerPage />} />
          <Route path="validation" element={<ValidationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {/* Old addresses from the previous UI */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/risk-events" element={<Navigate to="/app/signals" replace />} />
        <Route path="/prioritization" element={<Navigate to="/app/optimizer" replace />} />
        <Route path="*" element={<AppShell />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <div id="wipe" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </BrowserRouter>
  )
}
