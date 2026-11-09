import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '@/data/local/store';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { ClientesPage } from '@/features/clientes/ClientesPage';
import { ConfigPage } from '@/features/config/ConfigPage';
import { RecordatoriosPage } from '@/features/recordatorios/RecordatoriosPage';
import { ReportesPage } from '@/features/reportes/ReportesPage';
import { CajaPage } from '@/features/caja/CajaPage';
import { HorariosPage } from '@/features/horarios/HorariosPage';
import { ReservasPage } from '@/features/reservas/ReservasPage';
import { PanelLayout } from '@/layouts/PanelLayout';
import { PinGate } from '@/layouts/PinGate';

export default function App() {
  const tema = useStore((s) => s.tema);
  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'oscuro' ? 'dark' : 'light';
  }, [tema]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/panel/horarios" replace />} />
      <Route path="/panel" element={<PinGate><PanelLayout /></PinGate>}>
        <Route index element={<Navigate to="horarios" replace />} />
        <Route path="horarios" element={<HorariosPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="recordatorios" element={<RecordatoriosPage />} />
        <Route path="config" element={<ConfigPage />} />
      </Route>
      <Route path="/reservas" element={<ReservasPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
