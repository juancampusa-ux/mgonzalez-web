const CONFIG = {
  supabaseUrl: "https://zhpwfbenzixgaekqkedc.supabase.co",
  supabaseAnonKey: "sb_publishable_k0KQhm5SviDwIQFn3NBlUA_TcDq-EX7",
  publicBaseUrl: "https://mgonzalezimp.com.do/validar"
};

const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

const $ = (id) => document.getElementById(id);

/************************************************************
 * MENSAJES
 ************************************************************/
function mostrarMensaje(texto = "", esError = false) {
  const el = $("mensaje");
  if (!el) return;
  el.textContent = texto;
  el.style.color = esError ? "#991b1b" : "#627080";
}

/************************************************************
 * PARAMETROS URL
 ************************************************************/
function obtenerParametros() {
  const url = new URL(window.location.href);

  return {
    token: url.searchParams.get("token")
  };
}

/************************************************************
 * LLENAR PANTALLA
 ************************************************************/
function llenarPantalla(data) {
  // Cambiamos data.numero_cotizacion por data.Codigo_Cotizacion
 $("txtNumero").textContent = data.codigo_cotizacion || "-";
  $("txtComentario").textContent = data.comentario_validacion || "-";
  
  // OPCIONAL: Si quieres mostrar el Hash en tu HTML
  if ($("txtHash")) {
    $("txtHash").textContent = data.codigo_hash || "-";
  }
}

/************************************************************
 * CONSULTA POR TOKEN
 * Ajusta esta parte según uses VISTA o RPC
 ************************************************************/
async function cargarPorToken(token) {
  mostrarMensaje("Consultando documento...");

  const { data, error } = await sb
    .from("vw_cotizacion_validacion_publica") 
.select("codigo_cotizacion, comentario_validacion, codigo_hash, total") // Verifica que estos nombres coincidan con la vista
    .eq("qr_token", token.trim()) 
    .maybeSingle(); // Cambiado a maybeSingle para mejor manejo de errores

  if (error) {
    console.error(error);
    mostrarMensaje("Error técnico al consultar la base de datos.", true);
    return;
  }

  if (!data) {
    mostrarMensaje("El código no coincide con un documento oficializado.", true);
    // Limpiamos pantalla
    llenarPantalla({}); 
    return;
  }

  llenarPantalla(data);
  actualizarUrlPublica(token.trim());
  mostrarMensaje("Documento validado correctamente.");
}
/************************************************************
 * BUSQUEDA
 ************************************************************/
async function buscarCotizacion() {
  const entrada = $("entradaBusqueda").value.trim();

  if (!entrada) {
    mostrarMensaje("Digite el token de verificación.", true);
    return;
  }

  await cargarPorToken(entrada);
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
  }
}

/************************************************************
 * INIT
 ************************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  $("btnBuscar").addEventListener("click", buscarCotizacion);
  $("btnCopiarLink").addEventListener("click", copiarLink);

  $("entradaBusqueda").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await buscarCotizacion();
    }
  });

  await cargarAutomatico();
});
