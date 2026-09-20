/************************************************************
 * VALIDACIÓN PÚBLICA DE CARTAS DE GARANTÍA — HACS
 *
 * Consulta la función fn_validar_garantia del proyecto público
 * HACS_Publico, separado del sistema interno. Esta página nunca
 * toca la base de operaciones de la empresa.
 *
 * Esa función exige el token: sin token, o con uno inexistente,
 * no devuelve nada. La página nunca lee tablas directamente.
 *
 * Hay dos clases de documento:
 *
 *   · Los emitidos por el sistema, que llevan código QR impreso y
 *     sello digital verificable.
 *   · Los anteriores al sistema, capturados a mano. Tienen token
 *     interno, pero no figura en el papel ni llevan sello: el
 *     cliente los localiza por la fecha y el teléfono de la carta.
 *
 * El monto ya no se publica: esta consulta sirve para verificar la
 * cobertura, no para conocer precios.
 ************************************************************/

const CONFIG = {
  supabaseUrl:     "https://ivhugxvnyzbxysrpfizw.supabase.co",
  supabaseAnonKey: "sb_publishable_zae_6aYstZhuhsAMwd_31w_sqhmctUy",
  publicBaseUrl:   "https://mgonzalezimp.com.do/hacs/garantia/",
  rpc:             "fn_validar_garantia"
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
 * SELLO DIGITAL
 *
 * Las cartas anteriores al sistema no tienen sello: el campo llega
 * con un marcador en vez de un hash. No se muestra como si fuera una
 * verificación, porque no lo es.
 ************************************************************/
function tieneSelloDigital(registro) {
  const hash = String(registro?.codigo_hash || "");
  return hash !== "" && !hash.startsWith("SIN-SELLO-");
}

/************************************************************
 * PINTAR RESULTADO
 ************************************************************/
function llenarPantalla(data) {
  $("txtNumero").textContent     = data.codigo_garantia || "-";
  $("txtFecha").textContent      = formatearFecha(data.fecha_emision);
  $("txtInicio").textContent     = formatearFecha(data.inicio_garantia);
  $("txtComentario").textContent = data.comentario_validacion || "-";

  const conSello = tieneSelloDigital(data);

  $("bloqueSello").style.display = conSello ? "" : "none";
  $("txtHash").textContent = conSello ? data.codigo_hash : "-";

  /* El aviso explica por qué este documento no trae sello, en vez de
     dejar un espacio vacío que haga dudar al cliente. */
  $("avisoManual").classList.toggle("visible", !conSello);

  pintarPeriodos(data.periodos);
}

/************************************************************
 * PERÍODOS DE GARANTÍA
 * Se listan por línea, sin describir el artículo.
 ************************************************************/
function pintarPeriodos(periodos) {
  const cont = $("listaPeriodos");
  if (!cont) return;

  let lista = periodos;
  if (typeof lista === "string") {
    try { lista = JSON.parse(lista); } catch (e) { lista = []; }
  }

  if (!Array.isArray(lista) || !lista.length) {
    cont.textContent = "Este documento no registra períodos de garantía.";
    return;
  }

  cont.innerHTML = lista
    .map(p => `<div style="padding:6px 0;border-bottom:1px solid #eef2f7;">${p.texto || ""}</div>`)
    .join("");
}

function limpiarPantalla() {
  ["txtNumero","txtFecha","txtInicio","txtComentario","txtHash","listaPeriodos"]
    .forEach(id => { if ($(id)) $(id).textContent = "-"; });
  $("avisoManual").classList.remove("visible");
  $("bloqueSello").style.display = "";
  mostrarResultado(false);
}

/************************************************************
 * CONSULTA POR TOKEN
 ************************************************************/
async function cargarPorToken(token) {
  mostrarMensaje("Consultando documento...");
  fijarEstado("Consultando", "");

  const { data, error } = await sb.rpc(CONFIG.rpc, { p_token: token });

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

  /* Sin sello no hay nada que contrastar: el documento se confirma por
     su registro en los archivos de la empresa, no por criptografía. */
  if (!tieneSelloDigital(registro)) {
    fijarEstado("Garantía registrada", "estado-vigente");
    mostrarMensaje("Documento localizado en nuestros archivos. La cobertura indicada es válida.");
    return;
  }

  /* El sello se recalcula sobre el documento completo: cabecera y detalle. */
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
async function buscarGarantia() {
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
  $("btnBuscar").addEventListener("click", buscarGarantia);
  $("btnCopiarLink").addEventListener("click", copiarLink);

  $("entradaBusqueda").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await buscarGarantia();
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
