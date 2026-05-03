const CONFIG = {
  supabaseUrl: "https://zhpwfbenzixgaekqkedc.supabase.co",
  supabaseAnonKey: "sb_publishable_k0KQhm5SviDwIQFn3NBlUA_TcDq-EX7",
  publicBaseUrl: "https://mgonzalezimp.com.do/validar_ncf"
};

const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
const $ = (id) => document.getElementById(id);

let exportacionActual = null;

/************************************************************
 * MENSAJES Y ESTADO VISUAL
 ************************************************************/
function mostrarMensaje(texto = "", esError = false) {
  const el = $("mensaje");
  if (!el) return;
  el.textContent = texto;
  el.style.color = esError ? "#991b1b" : "#627080";
}

function cambiarEstado(texto, clase) {
  const el = $("estadoDocumento");
  if (!el) return;
  el.textContent = texto;
  el.className = "estado-box " + (clase || "");
}

/************************************************************
 * PARAMETROS URL
 ************************************************************/
function obtenerParametros() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");

  const segmentos = window.location.pathname.split("/").filter(Boolean);
  const ultimo = segmentos[segmentos.length - 1] || "";

  return {
    token: token || (ultimo && ultimo !== "index.html" ? decodeURIComponent(ultimo) : null)
  };
}

/************************************************************
 * FORMATO Y UTILIDADES
 ************************************************************/
function fechaLocal(valor) {
  if (!valor) return "-";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-DO");
}

function escaparHtml(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizarDatosParaExcel(datos) {
  if (!Array.isArray(datos)) return [];

  return datos.map((r) => ({
    "ID": r.id ?? r.control_gasto_id ?? r.gasto_id ?? "",
    "Fecha": r.fecha ?? r.fecha_documento ?? "",
    "Proveedor": r.proveedor ?? r.nombre_proveedor ?? "",
    "RNC": r.rnc ?? "",
    "NCF": r.ncf ?? "",
    "Concepto NCF": r.concepto_ncf ?? r.concepto_ncf_desc ?? "",
    "Forma pago": r.forma_pago ?? r.forma_pago_desc ?? "",
    "Gastado por": r.gastado_por ?? r.gastado_por_desc ?? "",
    "Tipo solicitud": r.tipo_solicitud ?? r.tipo_solicitud_desc ?? "",
    "Servicios locales": r.servicios_locales ?? "",
    "Bienes locales": r.bienes_locales ?? "",
    "Subtotal bruto": r.subtotal_bruto ?? "",
    "ISC": r.isc ?? "",
    "Otros impuestos/tasas": r.otros_impuestos_tasas ?? r.otros_impuestos ?? "",
    "Propina legal": r.propina_legal ?? "",
    "ITBIS servicios": r.itbis_servicios ?? "",
    "ITBIS bienes": r.itbis_bienes ?? "",
    "ITBIS total": r.itbis_total ?? "",
    "Total factura": r.total_factura ?? r.total ?? "",
    "Estado": r.activo === false ? "Inactivo" : "Activo"
  }));
}

/************************************************************
 * LLENAR PANTALLA
 ************************************************************/
function limpiarPantalla() {
  $("txtArchivo").textContent = "-";
  $("txtRegistros").textContent = "-";
  $("txtGenerado").textContent = "-";
  $("txtExpira").textContent = "-";
  $("btnDescargar").disabled = true;
  exportacionActual = null;
}

function llenarPantalla(data) {
  const cantidad = Array.isArray(data.datos_json) ? data.datos_json.length : 0;

  $("txtArchivo").textContent = data.nombre_archivo || "Control_Gastos_NCF.xlsx";
  $("txtRegistros").textContent = String(cantidad);
  $("txtGenerado").textContent = fechaLocal(data.fecha_generacion);
  $("txtExpira").textContent = fechaLocal(data.fecha_expiracion);
  $("btnDescargar").disabled = cantidad === 0;
}

/************************************************************
 * CONSULTA POR TOKEN
 ************************************************************/
async function cargarPorToken(token) {
  limpiarPantalla();
  cambiarEstado("Validando", "");
  mostrarMensaje("Validando enlace...");

  const { data, error } = await sb.rpc("obtener_control_gastos_exp_ncf", {
    p_token: token.trim()
  });

  if (error) {
    console.error(error);
    cambiarEstado("Error", "estado-error");
    mostrarMensaje("Error técnico al consultar la exportación.", true);
    return;
  }

  const registro = Array.isArray(data) ? data[0] : null;

  if (!registro) {
    cambiarEstado("Expirado", "estado-vencida");
    mostrarMensaje("Este enlace no existe, fue desactivado o ya expiró.", true);
    return;
  }

  exportacionActual = registro;
  llenarPantalla(registro);
  actualizarUrlPublica(token.trim());
  cambiarEstado("Vigente", "estado-vigente");
  mostrarMensaje("Enlace validado correctamente. Puede descargar el archivo.");
}

/************************************************************
 * BUSQUEDA
 ************************************************************/
async function buscarExportacion() {
  const entrada = $("entradaBusqueda").value.trim();

  if (!entrada) {
    mostrarMensaje("Digite el token de descarga.", true);
    return;
  }

  await cargarPorToken(entrada);
}

/************************************************************
 * DESCARGAR EXCEL
 ************************************************************/
function descargarExcel() {
  if (!exportacionActual) {
    mostrarMensaje("No hay información disponible para descargar.", true);
    return;
  }

  const datosExcel = normalizarDatosParaExcel(exportacionActual.datos_json);

  if (!datosExcel.length) {
    mostrarMensaje("El enlace no contiene registros para exportar.", true);
    return;
  }

  const hoja = XLSX.utils.json_to_sheet(datosExcel);
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, hoja, "NCF");

  const nombreArchivo = exportacionActual.nombre_archivo || "Control_Gastos_NCF.xlsx";
  XLSX.writeFile(libro, nombreArchivo);

  mostrarMensaje("Archivo descargado correctamente.");
}

/************************************************************
 * ACTUALIZAR URL
 ************************************************************/
function actualizarUrlPublica(token) {
  const nuevaUrl = `${CONFIG.publicBaseUrl}/?token=${encodeURIComponent(token)}`;
  window.history.replaceState({}, "", nuevaUrl);
}

/************************************************************
 * COPIAR LINK
 ************************************************************/
async function copiarLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    mostrarMensaje("Enlace copiado.");
  } catch (error) {
    console.error(error);
    mostrarMensaje("No fue posible copiar el enlace.", true);
  }
}

/************************************************************
 * CARGA AUTOMATICA
 ************************************************************/
async function cargarAutomatico() {
  const { token } = obtenerParametros();

  if (token) {
    $("entradaBusqueda").value = token;
    await cargarPorToken(token);
  } else {
    limpiarPantalla();
    cambiarEstado("Pendiente", "");
    mostrarMensaje("Digite o pegue el token de descarga.");
  }
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  $("btnBuscar").addEventListener("click", buscarExportacion);
  $("btnDescargar").addEventListener("click", descargarExcel);
  $("btnCopiarLink").addEventListener("click", copiarLink);

  $("entradaBusqueda").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await buscarExportacion();
    }
  });

  await cargarAutomatico();
});
