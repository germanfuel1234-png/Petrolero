/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Muestra los banners de supuestos en pantalla. Ver apps/web/.env */
  readonly VITE_MOSTRAR_SUPUESTOS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
