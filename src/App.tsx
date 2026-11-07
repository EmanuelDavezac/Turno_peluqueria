import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '@/data/local/store';
import { HorariosPage } from '@/features/horarios/HorariosPage';
import { PanelLayout } from '@/layouts/PanelLayout';

function Proximamente({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="mt-2 text-mute">Se construye en los próximos pasos.</p>
    </div>
  );
}

export default function App() {
  const tema = useStore((s) => s.tema);
  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'oscuro' ? 'dark' : 'light';
  }, [tema]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/panel/horarios" replace />} />
      <Route path="/panel" element={<PanelLayout />}>
        <Route index element={<Navigate to="horarios" replace />} />
        <Route path="horarios" element={<HorariosPage />} />
        <Route path="agenda" element={<Proximamente titulo="Agenda del día" />} />
        <Route path="caja" element={<Proximamente titulo="Caja" />} />
        <Route path="clientes" element={<Proximamente titulo="Clientes" />} />
        <Route path="reportes" element={<Proximamente titulo="Reportes" />} />
        <Route path="recordatorios" element={<Proximamente titulo="Recordatorios" />} />
        <Route path="config" element={<Proximamente titulo="Configuración" />} />
      </Route>
      <Route path="/reservas" element={<Proximamente titulo="Reservas" />} />
      <Route path="/tv" element={<Proximamente titulo="Pantalla de la fila" />} />
    </Routes>
  );
}
