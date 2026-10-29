import { obtenerSupuesto } from '@petrolero/shared';

/**
 * Banner amarillo que marca en pantalla un dato inventado por falta de definición del cliente.
 *
 * Se apaga poniendo VITE_MOSTRAR_SUPUESTOS=false en apps/web/.env — hacelo antes de
 * mostrarle la app al cliente, y volvé a activarlo mientras desarrollás.
 *
 * El texto no se escribe acá: sale de packages/shared/src/supuestos.ts, que es la misma
 * fuente que usa el reporte PENDIENTES-CLIENTE.md. Así nunca quedan desfasados.
 */
export function BannerSupuesto({ id }: { id: string }): JSX.Element | null {
  const mostrar = import.meta.env.VITE_MOSTRAR_SUPUESTOS !== 'false';
  if (!mostrar) return null;

  // Si el supuesto ya fue marcado como resuelto, el banner desaparece solo.
  const supuesto = obtenerSupuesto(id);
  if (!supuesto) return null;

  return (
    <div className="banner-supuesto" role="note">
      <span aria-hidden="true">⚠</span>
      <span>
        <strong>Dato a confirmar con el cliente</strong>
        {supuesto.asumido}
        <span className="pedido">Falta: {supuesto.necesitoDelCliente}</span>
      </span>
    </div>
  );
}
