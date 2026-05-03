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

function cambiarEstado(texto, clase = "") {
  const el = $("estadoDocumento");
  if (!el) return;

  el.textContent = texto;
  el.className = "estado-box " + clase;
}

/************************************************************
 * PARÁMETROS URL
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

function numeroSeguro(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarDatosParaExcel(datos) {
  if (!Array.isArray(datos)) return [];

  return datos.map((r) => ({
    "ID": r.id_registro ?? r.id ?? r.control_gasto_id ?? r.gasto_id ?? "",
    "Fecha": r.fecha ?? r.fecha_documento ?? "",
    "Proveedor": r.proveedor ?? r.nombre_proveedor ?? "",
    "RNC": r.rnc ?? "",
    "NCF": r.ncf ?? "",
    "Concepto NCF": r.concepto_ncf ?? r.concepto_ncf_desc ?? "",
    "Forma pago": r.forma_pago ?? r.forma_pago_desc ?? "",
    "Gastado por": r.gastado_por ?? r.gastado_por_desc ?? "",
    "Tipo solicitud": r.tipo_solicitud ?? r.tipo_solicitud_desc ?? "",

    "Servicios locales": numeroSeguro(
      r.servicios_locales ?? r.subtotal_servicios_locales
    ),

    "Bienes locales": numeroSeguro(
      r.bienes_locales ?? r.subtotal_bienes_locales
    ),

    "Subtotal bruto": numeroSeguro(
      r.subtotal_bruto ?? r.subtotal_bruto_factura
    ),

    "ISC": numeroSeguro(
      r.isc ?? r.impuesto_selectivo_consumo
    ),

    "Otros impuestos/tasas": numeroSeguro(
      r.otros_impuestos ?? r.otros_impuestos_tasas
    ),

    "Propina legal": numeroSeguro(
      r.propina_legal ?? r.monto_propina_legal
    ),

    "ITBIS servicios": numeroSeguro(
      r.itbis_servicios ?? r.itbis_servicios_locales
    ),

    "ITBIS bienes": numeroSeguro(
      r.itbis_bienes ?? r.itbis_bienes_locales
    ),

    "ITBIS total": numeroSeguro(r.itbis_total),

    "Total factura": numeroSeguro(
      r.total_factura ?? r.total
    ),

    "Estado": r.estado ?? (r.activo === false ? "Inactivo" : "Activo")
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
  const cantidad = Array.isArray(data.datos_json)
    ? data.datos_json.length
    : 0;

  $("txtArchivo").textContent =
    data.nombre_archivo || "Control_Gastos_NCF.xlsx";

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

  const tokenLimpio = (token || "").trim();

  if (!tokenLimpio) {
    cambiarEstado("Error", "estado-error");
    mostrarMensaje("Token no válido.", true);
    return;
  }

  const { data, error } = await sb.rpc(
    "obtener_control_gastos_exp_ncf",
    { p_token: tokenLimpio }
  );

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

  if (!Array.isArray(registro.datos_json)) {
    registro.datos_json = [];
  }

  exportacionActual = registro;

  llenarPantalla(registro);
  actualizarUrlPublica(tokenLimpio);

  if (registro.datos_json.length === 0) {
    cambiarEstado("Sin datos", "estado-error");
    mostrarMensaje(
      "El enlace existe, pero no contiene líneas para exportar. Revise que la función SQL esté devolviendo los detalles.",
      true
    );
    return;
  }

  cambiarEstado("Vigente", "estado-vigente");
  mostrarMensaje("Enlace validado correctamente. Puede descargar el archivo.");
}

/************************************************************
 * BÚSQUEDA
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
async function descargarExcel() {
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

  const nombreArchivo =
    exportacionActual.nombre_archivo || "Control_Gastos_NCF.xlsx";

  try {
    const { token } = obtenerParametros();

    if (token) {
      const { error: errorDescarga } = await sb.rpc(
        "registrar_descarga_control_gastos_exp_ncf",
        {
          p_token: token,
          p_user_agent: navigator.userAgent
        }
      );

      if (errorDescarga) {
        console.warn("No se pudo registrar la descarga:", errorDescarga);
      }
    }
  } catch (error) {
    console.warn("Error registrando descarga:", error);
  }

  XLSX.writeFile(libro, nombreArchivo);

  mostrarMensaje("Archivo descargado correctamente.");
}

/************************************************************
 * ACTUALIZAR URL
 ************************************************************/
function actualizarUrlPublica(token) {
  const nuevaUrl =
    `${CONFIG.publicBaseUrl}/?token=${encodeURIComponent(token)}`;

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
 * CARGA AUTOMÁTICA
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
