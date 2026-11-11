import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { WhatsAppBubble } from '@/components/WhatsAppBubble';
import { AvisoGuardado, Pantalla } from '@/components/EstadoCarga';
import { BACKEND } from '@/data/backend';
import { useNegocio, type NegocioVista } from '@/data/useNegocio';
import { PLANTILLA_DEFAULT, VARIABLES, armarMensaje, variablesDesconocidas } from '@/domain/recordatorio';

export function RecordatoriosPage() {
  const negocio = useNegocio();
  return (
    <Pantalla recurso={negocio} texto="Cargando los recordatorios…">
      {(n) => <RecordatoriosContenido n={n} />}
    </Pantalla>
  );
}

function RecordatoriosContenido({ n }: { n: NegocioVista }) {
  const { recordatorios, local, setRecordatorios } = n;
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const ejemplo = armarMensaje(recordatorios.plantilla, {
    nombre: 'Martín', local: local.nombre, dia: 'viernes 13 de noviembre', hora: '10:30',
    profesional: n.profesionalEjemplo,
  });
  const desconocidas = variablesDesconocidas(recordatorios.plantilla);

  /** Inserta la variable donde está el cursor. */
  const insertar = (v: string) => {
    const el = areaRef.current;
    const txt = `{${v}}`;
    if (!el) return setRecordatorios({ plantilla: recordatorios.plantilla + txt });
    const { selectionStart: a, selectionEnd: b } = el;
    const nueva = recordatorios.plantilla.slice(0, a) + txt + recordatorios.plantilla.slice(b);
    setRecordatorios({ plantilla: nueva });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + txt.length, a + txt.length);
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Recordatorios por WhatsApp</h1>
        <p className="mt-1 max-w-2xl text-mute">
          {BACKEND === 'supabase'
            ? 'Todavía no se envían mensajes automáticos: acá definís el texto y ves cómo le llegaría al cliente.'
            : 'En la demo el envío es simulado: se muestra cómo le llegaría el mensaje al cliente.'}
        </p>
      </header>

      <section aria-labelledby="avisos" className="space-y-1">
        <h2 id="avisos" className="text-xl font-bold">
          Cuándo avisar
        </h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          <Toggle label="24 horas antes" descripcion="Recordatorio el día anterior al turno." checked={recordatorios.h24} onChange={(v) => setRecordatorios({ h24: v })} />
          <Toggle label="2 horas antes" descripcion="Aviso corto el mismo día." checked={recordatorios.h2} onChange={(v) => setRecordatorios({ h2: v })} />
        </div>
      </section>

      <section aria-labelledby="plantilla" className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 id="plantilla" className="text-xl font-bold">
            Plantilla del recordatorio
          </h2>
          <label className="block text-sm font-medium">
            <span className="sr-only">Texto del mensaje</span>
            <textarea
              ref={areaRef}
              rows={6}
              maxLength={600}
              value={recordatorios.plantilla}
              onChange={(e) => setRecordatorios({ plantilla: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface p-3 text-base"
            />
          </label>
          <div>
            <p className="mb-1 text-sm text-mute">Tocá una variable para insertarla:</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertar(v)} className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-sm hover:bg-sunken">
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
          {desconocidas.length > 0 && (
            <p role="alert" className="text-sm font-medium text-red-600">
              Variable desconocida: {desconocidas.map((v) => `{${v}}`).join(', ')}. Se va a enviar tal cual.
            </p>
          )}
          <Button variante="ghost" onClick={() => setRecordatorios({ plantilla: PLANTILLA_DEFAULT })} disabled={recordatorios.plantilla === PLANTILLA_DEFAULT}>
            Volver a la plantilla original
          </Button>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold">Así lo recibe el cliente</h2>
          <WhatsAppBubble mensaje={ejemplo} hora="10:30" />
          <p className="text-xs text-mute">Datos de ejemplo: Martín, viernes 13 de noviembre a las 10:30.</p>
        </div>
      </section>

      <AvisoGuardado guardado={n.guardado} onReintentar={n.reintentarGuardado} />
    </div>
  );
}
