# Especificaciones del proyecto — Sistema de gestión de mantenimiento de válvulas (Oil & Gas)

> Transcripto y resumido a partir de 6 notas de voz de WhatsApp enviadas el 22/10/2026 (19:07 a 19:14) por el cliente, que trabaja en la industria del petróleo (oil & gas).

## 1. Contexto del dominio

- El cliente trabaja en la industria petrolera.
- Cada **pozo de petróleo** tiene **válvulas** que requieren mantenimiento periódico.
  - Ejemplo dado: un pozo puede tener 9 válvulas (4 en posición vertical, 5 en posición horizontal), aunque la cantidad de válvulas varía por pozo (otro ejemplo mencionado: un pozo "B9" con 8 válvulas).
  - El sistema debe soportar una cantidad **variable** de válvulas por pozo, no un número fijo.

## 2. Flujo de mantenimiento por válvula

Para cada válvula se realizan dos tareas secuenciales:

1. **Mantenimiento**: engrase de la válvula.
2. **Prueba de hermeticidad**: verifica que la válvula empaquete/hermetice bien. El resultado es binario:
   - **Positivo (OK)** → no se requiere acción adicional. La válvula debe volver a probarse recién **dentro de 1 año**.
   - **Negativo** → la válvula requiere una acción correctiva, por ejemplo:
     - Lavado.
     - Intervención con bomba.
     - Otras acciones posibles (a definir/ampliar).

## 3. Visualización por pozo

- Para cada pozo, se necesita un **gráfico interactivo** que muestre el estado de cada una de sus válvulas.
- Al interactuar con el gráfico (ej. click/tap sobre una válvula) se debe poder ver el detalle: si tiene el mantenimiento al día, si la prueba de hermeticidad dio bien, etc.
- El gráfico debe **adaptarse dinámicamente** a la cantidad real de válvulas de cada pozo (ej.: si el pozo tiene 8 válvulas, el gráfico debe mostrar 8; no un número fijo/hardcodeado).

## 4. Carga de datos

- **Etapa inicial (MVP)**: la carga de datos se hace a partir de un **Excel** que el cliente ya tiene armado (importación de datos existentes).
- **Etapa futura**: que la persona que realiza el mantenimiento en campo pueda registrar los datos directamente, válvula por válvula:
  - Toca/selecciona la válvula.
  - Completa los datos de mantenimiento y de la prueba de hermeticidad.
  - Pasa a la siguiente válvula y repite el proceso.
  - Esto sugiere una interfaz pensada también para uso en campo (posiblemente mobile/tablet).

## 5. Gestión de acciones correctivas (válvulas con resultado negativo)

- Para cada válvula con prueba **negativa**, el sistema debe permitir marcar/asignar la **acción a realizar** (lavado, intervención con bomba, etc.).
- El sistema debe poder **agrupar** las válvulas/pozos según la acción requerida. Ejemplo: "todos estos pozos necesitan lavado" → listado agrupado por tipo de acción, mostrando el nombre de la válvula.

## 6. Planificación inteligente de tareas

- Además de agrupar por tipo de acción, se pide agrupar/organizar el trabajo según la **ubicación geográfica** de cada pozo (algún tipo de lógica/inteligencia de agrupamiento por cercanía).
- Objetivo: poder definir **planes de trabajo semanales**, por ejemplo:
  - "Estos pozos se hacen esta semana."
  - "Estos otros, la semana siguiente."
- El sistema debería poder **notificar/avisar al equipo de campo** qué pozos/válvulas se van a atender en una semana determinada.

## 7. Estado actual del desarrollo

- El cliente ya armó algo (un prototipo o avance inicial), pero no llegó muy lejos ("no he llegado mucho, estoy medio trabado").
- Busca sumar a alguien con más conocimiento del tema para avanzar.

## 8. Resumen funcional (features a construir)

1. Modelo de datos: Pozo → N Válvulas (cantidad variable) → Historial de mantenimiento/pruebas.
2. Importador de Excel para carga inicial de pozos/válvulas/datos históricos.
3. Registro de mantenimiento y prueba de hermeticidad por válvula (resultado OK/Negativo).
4. Regla de negocio: próxima prueba a 1 año desde la última prueba positiva.
5. Catálogo de acciones correctivas disponibles (lavado, bombeo, etc.) para resultado negativo.
6. Gráfico interactivo por pozo, con estado visual por válvula (cantidad dinámica).
7. Vista/listado de válvulas agrupadas por acción correctiva pendiente.
8. Agrupamiento/planificación por ubicación geográfica de los pozos.
9. Planificador semanal de tareas de mantenimiento + aviso al equipo de campo.
10. (Futuro) App/interfaz de campo para que el técnico registre mantenimiento válvula por válvula in situ.

## 9. Puntos a confirmar con el cliente (no quedaron 100% claros en los audios)

- Catálogo completo de posibles acciones correctivas (solo se mencionaron "lavado" y "bomba" como ejemplos, dijo "etcétera, etcétera").
- Criterio exacto de agrupamiento geográfico (¿por zona/yacimiento, por distancia entre pozos, por cuadrantes?).
- Mecanismo de aviso al equipo de campo (¿notificación en la app, email, WhatsApp, otro?).
- Formato y estructura exacta del Excel existente (columnas, nombres de pozos/válvulas).
- Si existe un límite máximo de válvulas por pozo o es completamente abierto.
- Público objetivo de la app de campo (futuro): ¿mobile nativo, web responsive, tablet?

## 10. Consideraciones adicionales antes de diseñar (checklist pre-diseño)

Definidas el stack (React + Three.js/R3F + MapLibre GL + PostgreSQL/PostGIS), estos puntos quedan abiertos y condicionan el diseño de las pantallas:

### Datos reales y escala
- Cantidad total de pozos y válvulas que maneja hoy el cliente (define si el mapa necesita clustering agresivo o algo simple).
- Si existen coordenadas lat/long reales por pozo, o solo una zona/yacimiento sin punto exacto (sin coordenadas reales no se puede construir el mapa ni el agrupamiento geográfico).
- Si las "zonas" tienen un polígono geográfico real (límite de yacimiento) o son agrupaciones lógicas sin forma definida.

### Modelos 3D
- Si existen planos/CAD reales de las válvulas, o se diseña con geometría genérica (cápsulas/cilindros coloreados por estado) para el MVP.

### Usuarios, roles y permisos
- Perfiles de usuario identificados en los audios: supervisor (planifica, ve todo) y técnico de campo (registra mantenimiento). Falta definir qué puede ver/editar cada rol.
- Si la app es para una sola empresa o debe soportar multi-tenant (varias operadoras).

### Conectividad en campo
- Los pozos suelen estar en zonas con mala señal. Aunque el registro de campo es una fase futura, conviene definir ahora si va a necesitar modo offline con sincronización posterior, porque eso impacta la arquitectura, no solo el diseño visual.

### Compliance / auditoría
- La prueba de hermeticidad es un dato de seguridad (riesgo de fuga/presión). Confirmar si existen requisitos regulatorios de trazabilidad: quién hizo la prueba, imposibilidad de borrar/editar un registro histórico, firma del responsable. Si existen, el diseño necesita un log de auditoría visible, no solo un historial editable.

### Integraciones existentes
- Si el cliente ya usa algún sistema de GIS, ERP o SCADA que esta app debería leer o alimentar, para integrarse en vez de duplicar la fuente de verdad de ubicación de pozos.

### Marca/identidad
- Logo y colores corporativos del cliente, para aplicar sobre la base industrial/dark mode ya definida.

**Bloqueantes principales** (sin esto no se puede maquetar bien): coordenadas reales de los pozos, definición de roles de usuario, y si existe requisito de auditoría/trazabilidad.
