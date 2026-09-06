/************************************************************
 * VALIDACIÓN PÚBLICA DE CARTAS DE GARANTÍA — HACS
 *
 * Consulta la función fn_validar_garantia del esquema dev_v2.
 * Esa función exige el token: sin token, o con uno inexistente,
 * no devuelve nada. La página nunca lee tablas directamente.
 ************************************************************/

const CONFIG = {
  supabaseUrl:     "https://zhpwfbenzixgaekqkedc.supabase.co",
  supabaseAnonKey: "sb_publishable_k0KQhm5SviDwIQFn3NBlUA_TcDq-EX7",
  publicBaseUrl:   "https://mgonzalezimp.com.do/hacs/garantia/",
  esquema:         "dev_v2",
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
  $("txtNumero").textContent     = data.codigo_garantia  || "-";
  $("txtFecha").textContent      = formatearFecha(data.fecha_emision);
  $("txtTotal").textContent      = formatearMonto(data.total);
  $("txtComentario").textContent = data.comentario_validacion || "-";
  $("txtHash").textContent       = data.codigo_hash           || "-";
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
  ["txtNumero","txtFecha","txtTotal","txtComentario","txtHash","listaPeriodos"]
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
    .schema(CONFIG.esquema)
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
