/** Vista previa tipo burbuja de WhatsApp (envío simulado en la demo). */
export function WhatsAppBubble({ mensaje, hora }: { mensaje: string; hora: string }) {
  return (
    <div className="rounded-2xl bg-[#e7ded3] p-3 dark:bg-[#0b141a]">
      <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        <p className="whitespace-pre-wrap break-words">{mensaje}</p>
        <p className="mt-1 text-right text-[11px] opacity-60">{hora}</p>
      </div>
    </div>
  );
}
