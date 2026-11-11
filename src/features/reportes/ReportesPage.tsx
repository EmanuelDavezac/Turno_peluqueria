import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo } from 'react';
import { Pantalla } from '@/components/EstadoCarga';
import { useHoy } from '@/data/local/store';
import { useReportes, type ReportesVista } from '@/data/useReportes';
import { facturacionPorDia, porProfesional, serviciosMasPedidos } from '@/domain/reportes';
import { formatARS } from '@/lib/format';
import { sumarDias } from '@/lib/horas';
import { BarrasRanking, ColumnasPorDia } from './Graficos';

const DIAS = 7;

function Tarjeta({ titulo, valor, detalle, className = '' }: { titulo: string; valor: string; detalle?: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <p className="text-sm text-mute">{titulo}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-mute">{detalle}</p>}
    </div>
  );
}

export function ReportesPage() {
  const hoy = useHoy();
  const desde = sumarDias(hoy, -(DIAS - 1));
  const reportes = useReportes(desde, hoy);
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-mute">
          Últimos 7 días: {format(parseISO(desde), 'd MMM', { locale: es })} al {format(parseISO(hoy), 'd MMM', { locale: es })}
        </p>
      </header>
      <Pantalla recurso={reportes} texto="Cargando los reportes…">
        {(r) => <ReportesContenido r={r} hoy={hoy} desde={desde} />}
      </Pantalla>
    </div>
  );
}

function ReportesContenido({ r, hoy, desde }: { r: ReportesVista; hoy: string; desde: string }) {
  const { cobros, profesionales, servicios } = r;

  const porDia = useMemo(() => facturacionPorDia(cobros, hoy, DIAS), [cobros, hoy]);
  const profs = useMemo(() => porProfesional(cobros, profesionales, desde, hoy), [cobros, profesionales, desde, hoy]);
  const servs = useMemo(() => serviciosMasPedidos(cobros, servicios, desde, hoy), [cobros, servicios, desde, hoy]);

  const total = porDia.reduce((a, d) => a + d.total, 0);
  const cantidad = profs.reduce((a, p) => a + p.cantidad, 0);
  const totalComision = profs.reduce((a, p) => a + p.comision, 0);

  return (
    <div className="space-y-10">
      {cantidad === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-mute">No hay cobros en los últimos 7 días.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="col-span-2 rounded-xl bg-brand p-4 text-brand-ink md:col-span-1">
              <p className="text-sm opacity-80">Facturación</p>
              <p className="mt-1 font-display text-4xl font-bold leading-none">{formatARS(total)}</p>
            </div>
            <Tarjeta titulo="Cobros" valor={String(cantidad)} />
            <Tarjeta titulo="Ticket promedio" valor={formatARS(Math.round(total / cantidad))} />
          </div>

          <section aria-labelledby="r-dia" className="space-y-3">
            <h2 id="r-dia" className="text-xl font-bold">Facturación por día</h2>
            <ColumnasPorDia datos={porDia} />
          </section>

          <div className="grid gap-10 md:grid-cols-2">
            <section aria-labelledby="r-prof" className="space-y-3">
              <h2 id="r-prof" className="text-xl font-bold">Por profesional</h2>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <BarrasRanking
                  titulo="Facturación por profesional"
                  items={profs.map((p) => ({
                    id: p.profesionalId,
                    nombre: p.nombre,
                    valor: p.facturado,
                    etiqueta: formatARS(p.facturado),
                    punto: profesionales.find((x) => x.id === p.profesionalId)?.color,
                  }))}
                />
              </div>
            </section>

            <section aria-labelledby="r-serv" className="space-y-3">
              <h2 id="r-serv" className="text-xl font-bold">Servicios más pedidos</h2>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <BarrasRanking
                  titulo="Servicios más pedidos"
                  items={servs.map((s) => ({ id: s.servicioId, nombre: s.nombre, valor: s.cantidad, etiqueta: `${s.cantidad}` }))}
                />
              </div>
            </section>
          </div>

          <section aria-labelledby="r-com" className="space-y-3">
            <h2 id="r-com" className="text-xl font-bold">Comisiones</h2>
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
                  <tr>
                    <th className="px-4 py-2">Profesional</th>
                    <th className="px-4 py-2 text-right">Cobros</th>
                    <th className="px-4 py-2 text-right">Facturado</th>
                    <th className="px-4 py-2 text-right">Comisión</th>
                    <th className="px-4 py-2 text-right">A pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {profs.map((p) => (
                    <tr key={p.profesionalId}>
                      <td className="px-4 py-2 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2 text-right">{p.cantidad}</td>
                      <td className="px-4 py-2 text-right">{formatARS(p.facturado)}</td>
                      <td className="px-4 py-2 text-right">{p.comisionPct}%</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatARS(p.comision)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-sunken font-bold tabular-nums">
                  <tr>
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{cantidad}</td>
                    <td className="px-4 py-2 text-right">{formatARS(total)}</td>
                    <td />
                    <td className="px-4 py-2 text-right">{formatARS(totalComision)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
