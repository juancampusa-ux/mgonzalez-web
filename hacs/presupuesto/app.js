/************************************************************
 * VALIDACIÓN PÚBLICA DE PRESUPUESTOS — HACS
 *
 * Consulta la función fn_validar_presupuesto del proyecto público
 * HACS_Publico, separado del sistema interno. Esta página nunca
 * toca la base de operaciones de la empresa.
 * Esa función exige el token: sin token, o con uno inexistente,
 * no devuelve nada. La página nunca lee tablas directamente.
 ************************************************************/

const CONFIG = {
  supabaseUrl:     "https://ivhugxvnyzbxysrpfizw.supabase.co",
  supabaseAnonKey: "sb_publishable_zae_6aYstZhuhsAMwd_31w_sqhmctUy",
  publicBaseUrl:   "https://mgonzalezimp.com.do/hacs/presupuesto/",
  rpc:             "fn_validar_presupuesto"
};

const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

const $ = (id) => document.getElementById(id);

/************************************************************
 * MENSAJES Y ESTADO
 ************************************************************/
function mostrarMensaje(texto = "", esError = false) {
  const el = $("mensaje");
  if (!el) return;
  el.textContent = texto;
  el.style.color = esError ? "#991b1b" : "#627080";
}

function fijarEstado(texto, clase) {
  const el = $("estadoDocumento");
  if (!el) return;
  el.textContent = texto;
  el.className = "estado-box" + (clase ? " " + clase : "");
}

function mostrarResultado(visible) {
  const el = $("bloqueResultado");
  if (el) el.classList.toggle("oculto", !visible);
}

/************************************************************
 * FORMATO
 ************************************************************/
function formatearMonto(valor) {
  const n = Number(valor);
  if (!isFinite(n)) return "-";
  return "RD$ " + n.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatearFecha(valor) {
  if (!valor) return "-";
  const [a, m, d] = String(valor).split("-");
  if (!a || !m || !d) return valor;
  const meses = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
}

/************************************************************
 * PARÁMETROS DE LA URL
 ************************************************************/
function obtenerToken() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  return token ? token.trim() : null;
}

/************************************************************
 * PINTAR RESULTADO
 ************************************************************/
function llenarPantalla(data) {
  $("txtNumero").textContent     = data.codigo_presupuesto    || "-";
  $("txtFecha").textContent      = formatearFecha(data.fecha_presupuesto);
  $("txtTotal").textContent      = formatearMonto(data.total);
  $("txtComentario").textContent = data.comentario_validacion || "-";
  $("txtHash").textContent       = data.codigo_hash           || "-";
}

function limpiarPantalla() {
  ["txtNumero","txtFecha","txtTotal","txtComentario","txtHash"]
    .forEach(id => { if ($(id)) $(id).textContent = "-"; });
  mostrarResultado(false);
}

/************************************************************
 * CONSULTA POR TOKEN
 ************************************************************/
async function cargarPorToken(token) {
  mostrarMensaje("Consultando documento...");
  fijarEstado("Consultando", "");

  const { data, error } = await sb
    .rpc(CONFIG.rpc, { p_token: token });

  if (error) {
    console.error(error);
    mostrarMensaje("No fue posible consultar el documento en este momento.", true);
    fijarEstado("No disponible", "estado-anulada");
    limpiarPantalla();
    return;
  }

  const registro = Array.isArray(data) ? data[0] : data;

  if (!registro) {
    mostrarMensaje("El token no corresponde a ningún documento vigente emitido por la empresa.", true);
    fijarEstado("No encontrado", "estado-anulada");
    limpiarPantalla();
    return;
  }

  llenarPantalla(registro);
  mostrarResultado(true);
  actualizarUrlPublica(token);

  // El sello se recalcula sobre el documento completo: cabecera y detalle.
  if (registro.integro === false) {
    fijarEstado("Sello no coincide", "estado-anulada");
    mostrarMensaje(
      "El documento existe, pero su sello digital no coincide con el contenido registrado. " +
      "Comuníquese con la empresa antes de darlo por válido.", true);
    return;
  }

  fijarEstado("Documento válido", "estado-vigente");
  mostrarMensaje("Documento verificado correctamente.");
}

/************************************************************
 * BÚSQUEDA MANUAL
 ************************************************************/
async function buscarPresupuesto() {
  const entrada = $("entradaBusqueda").value.trim();

  if (!entrada) {
    mostrarMensaje("Digite el token de verificación que aparece en su documento.", true);
    return;
  }

  await cargarPorToken(entrada);
}

/************************************************************
 * URL PÚBLICA
 ************************************************************/
function actualizarUrlPublica(token) {
  const nuevaUrl = `${CONFIG.publicBaseUrl}?token=${encodeURIComponent(token)}`;
  window.history.replaceState({}, "", nuevaUrl);
}

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
 * INICIO
 ************************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  $("btnBuscar").addEventListener("click", buscarPresupuesto);
  $("btnCopiarLink").addEventListener("click", copiarLink);

  $("entradaBusqueda").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await buscarPresupuesto();
    }
  });

  const token = obtenerToken();

  if (token) {
    $("entradaBusqueda").value = token;
    await cargarPorToken(token);
  } else {
    fijarEstado("Esperando token", "");
    mostrarMensaje("Escriba el token de su documento para verificarlo.");
  }
});
