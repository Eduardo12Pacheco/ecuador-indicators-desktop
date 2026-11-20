/**
 * Spanish UI dictionary (S9). Same keys and interpolation parameters as
 * `en.ts`; `i18n.parity.test.ts` enforces both.
 */

import type { Messages } from "./en";

export const es: Messages = {
  "app.name": "Ecuador Indicators",

  "common.cancel": "Cancelar",
  "common.close": "Cerrar",
  "common.confirm": "Confirmar",
  "common.details": "Detalles técnicos",
  "common.dismiss": "Descartar",
  "common.loading": "Cargando…",
  "common.reset": "Restablecer",
  "common.retry": "Reintentar",
  "common.save": "Guardar",
  "common.search": "Buscar",

  "shell.skipToContent": "Saltar al contenido principal",
  "shell.primaryNavigation": "Navegación principal",
  "shell.collapseSidebar": "Contraer la barra lateral",
  "shell.expandSidebar": "Expandir la barra lateral",
  "shell.theme": "Tema",
  "shell.themeSystem": "Sistema",
  "shell.themeLight": "Claro",
  "shell.themeDark": "Oscuro",
  "shell.language": "Idioma",
  "shell.langSystem": "Sistema",
  "shell.langEnglish": "English",
  "shell.langSpanish": "Español",
  "shell.toggleTheme": "Alternar tema claro y oscuro",
  "shell.switchLanguage": "Cambiar idioma",

  "nav.explore": "Explorar",
  "nav.compare": "Comparar",
  "nav.views": "Vistas guardadas",
  "nav.settings": "Ajustes",
  "nav.about": "Datos y acerca de",
  "nav.design": "Sistema de diseño",

  "status.dataset": "Conjunto de datos",
  "status.version": "Versión",
  "status.loadingDataset": "Cargando el conjunto de datos…",
  "status.bundled": "Instantánea incluida",

  "page.explore.title": "Explorar un indicador",
  "page.explore.description":
    "Consulta un indicador del Banco Mundial a lo largo del tiempo, con comparaciones y transformaciones opcionales.",
  "page.compare.title": "Comparar",
  "page.compare.description":
    "Indexa trayectorias a un año base o clasifica todas las geografías para un año.",
  "page.views.title": "Vistas guardadas",
  "page.views.description": "Vuelve a abrir una vista de Explorar, Trayectorias o Ranking.",
  "page.settings.title": "Ajustes",
  "page.settings.description": "Apariencia, actualizaciones, conjunto de datos y almacenamiento.",
  "page.about.title": "Datos y acerca de",
  "page.about.description": "Procedencia, licencias y cómo está construida la aplicación.",
  "page.design.title": "Sistema de diseño",
  "page.design.description": "Tokens y componentes en ambos temas.",
  "page.design.gallery.description":
    "Esta galería solo está disponible en compilaciones de desarrollo y de pruebas.",
  "state.loading": "Cargando datos…",
  "state.empty.title": "Todavía no hay nada aquí",
  "state.empty.defaultDescription": "Ajusta los filtros o elige otro indicador.",
  "state.error.title": "Algo salió mal",
  "state.error.defaultDescription": "No se pudo leer el conjunto de datos. Inténtalo de nuevo.",

  "primitive.dialog.close": "Cerrar el diálogo",
  "primitive.toast.region": "Notificaciones",
  "primitive.toast.dismiss": "Descartar la notificación",
  "primitive.switch": "Alternar {label}",
  "primitive.slider": "Rango de {label}",
  "primitive.sliderMin": "Mínimo de {label}",
  "primitive.sliderMax": "Máximo de {label}",
  "primitive.chip.remove": "Quitar {label}",
  "primitive.tabs": "Pestañas",
  "primitive.tooltip": "Más información",
  "primitive.spinner": "Cargando",
  "primitive.liveRegion": "Actualizaciones de estado",
  "primitive.visuallyHidden": "Información adicional",
  "primitive.iconButton.missingLabel": "Los botones con icono necesitan una etiqueta accesible",

  "items.count_one": "{count} elemento",
  "items.count_other": "{count} elementos",
  "views.count_one": "{count} vista guardada",
  "views.count_other": "{count} vistas guardadas",
};
