/************************************************************
 * RECLAMACIÓN DE GARANTÍA — HACS
 *
 * Consulta el proyecto público HACS_Publico, separado del sistema
 * interno. Esta página nunca toca la base de operaciones.
 *
 * El trabajo se identifica de dos formas:
 *   · con el token del código QR, en los documentos actuales
 *   · con la fecha y el teléfono, en los documentos anteriores
 *
 * En el segundo caso el servidor no devuelve teléfonos ni direcciones
 * completas: solo un fragmento, para que el cliente reconozca el suyo.
 ************************************************************/

const CONFIG = {
  supabaseUrl:     "https://ivhugxvnyzbxysrpfizw.supabase.co",
  supabaseAnonKey: "sb_publishable_zae_6aYstZhuhsAMwd_31w_sqhmctUy",
  maxImagenes:     4,
  maxPesoImagen:   3 * 1024 * 1024,   // 3 MB por imagen
};

const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
const $  = (id) => document.getElementById(id);

const Estado = {
  via:          null,   // 'codigo' | 'datos'
  token:        null,
  historicoId:  null,
  descripcion:  null,
  imagenes:     [],
};

/************************************************************
 * AVISOS
 ************************************************************/
function avisar(id, texto, tipo = "info") {
  const el = $(id);
  if (!el) return;
  el.textContent = texto;
  el.className = "aviso " + tipo;
  el.style.display = texto ? "block" : "none";
}

function fijarEstado(texto, clase) {
  const el = $("estadoDoc");
  if (!el) return;
  el.textContent = texto;
  el.className = "estado-box" + (clase ? " " + clase : "");
}

/************************************************************
 * MÁSCARA DE TELÉFONO
 *
 * El campo muestra siempre (   )    -     y el usuario solo escribe
 * dígitos. Los paréntesis y el guion permanecen, para que se entienda
 * qué se espera sin tener que explicarlo.
 ************************************************************/
const PLANTILLA = "(   )    -    ";

function formatearTelefono(digitos) {
  const d = digitos.padEnd(10, " ").slice(0, 10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

function soloDigitos(texto) {
  return (texto || "").replace(/\D/g, "").slice(0, 10);
}

function activarMascara(id) {
  const el = $(id);
  if (!el) return;

  const pintar = () => {
    const d = soloDigitos(el.value);
    el.value = formatearTelefono(d);
    // El cursor va justo después del último dígito escrito
    const pos = d.length === 0  ? 1
              : d.length <= 3   ? 1 + d.length
              : d.length <= 6   ? 6 + (d.length - 3)
              :                   10 + (d.length - 6);
    el.setSelectionRange(pos, pos);
  };

  el.addEventListener("input", pintar);
  el.addEventListener("focus", pintar);
  el.addEventListener("click", pintar);
  el.addEventListener("blur", () => {
    if (soloDigitos(el.value).length === 0) el.value = PLANTILLA;
  });
}

/************************************************************
 * MENSAJES DE ERROR
 *
 * El cliente nunca debe ver un mensaje técnico. Los errores del
 * servidor que sí le hablan a él (fechas, teléfonos, reclamación
 * duplicada) se muestran tal cual; todo lo demás se traduce a un
 * aviso comprensible y el detalle queda en la consola.
 ************************************************************/
function mensajeParaElCliente(error, respaldo) {
  console.error("Detalle técnico:", error);

  const texto = String(error?.message || "");

  // Señales de un problema de configuración o de red
  const esTecnico =
    /schema cache|function|relation|column|permission denied|JWT|fetch|network|401|403|404|500|PGRST/i
      .test(texto);

  if (!texto || esTecnico) return respaldo;

  // Los mensajes que la base escribió pensando en el cliente
  return texto;
}

/************************************************************
 * VÍA DE IDENTIFICACIÓN
 ************************************************************/
function elegirVia(via) {
  Estado.via = via;

  $("viaCodigo").classList.toggle("activa", via === "codigo");
  $("viaDatos").classList.toggle("activa",  via === "datos");

  $("bloqueCodigo").classList.toggle("visible", via === "codigo");
  $("bloqueDatos").classList.toggle("visible",  via === "datos");

  ocultarSelectorDireccion();
  avisar("avisoPaso1", "");
}

/************************************************************
 * BÚSQUEDA POR TOKEN
 ************************************************************/
async function buscarPorToken(tokenExterno) {
  const token = (tokenExterno ?? $("txtToken").value).trim();

  if (!token) {
    avisar("avisoPaso1", "Escriba el número de garantía que aparece en su documento.", "error");
    return;
  }

  avisar("avisoPaso1", "Buscando su garantía...", "info");

  const { data, error } = await sb.rpc("fn_validar_garantia", { p_token: token });

  if (error) {
    avisar("avisoPaso1", mensajeParaElCliente(error,
      "No pudimos completar la consulta en este momento. Intente de nuevo en unos minutos " +
      "o llame al 809-564-0510."), "error");
    fijarEstado("No disponible", "estado-anulada");
    return;
  }

  const registro = Array.isArray(data) ? data[0] : data;

  if (!registro) {
    avisar("avisoPaso1",
      "No encontramos una garantía vigente con ese código. Revise el número o use la otra opción.",
      "error");
    fijarEstado("No encontrado", "estado-anulada");
    return;
  }

  Estado.token       = token;
  Estado.historicoId = null;

  fijarEstado("Garantía " + registro.codigo_garantia, "estado-vigente");
  avisar("avisoPaso1",
    `Garantía ${registro.codigo_garantia}, emitida el ${formatearFecha(registro.fecha_emision)}.`,
    "ok");

  abrirPaso2();
}

/************************************************************
 * BÚSQUEDA POR FECHA Y TELÉFONO
 ************************************************************/
async function buscarPorDatos() {
  const fecha    = $("txtFecha").value;
  const telefono = soloDigitos($("txtTelefono").value);

  if (!fecha) {
    avisar("avisoPaso1", "Indique la fecha que aparece en su documento.", "error");
    return;
  }
  if (telefono.length < 10) {
    avisar("avisoPaso1", "Escriba el teléfono completo, con el código de área.", "error");
    return;
  }

  avisar("avisoPaso1", "Buscando su trabajo...", "info");
  ocultarSelectorDireccion();

  const { data, error } = await sb.rpc("fn_buscar_historico", {
    p_telefono: telefono,
    p_fecha:    fecha,
  });

  if (error) {
    avisar("avisoPaso1", mensajeParaElCliente(error,
      "No pudimos completar la búsqueda en este momento. Intente de nuevo en unos minutos " +
      "o llame al 809-564-0510."), "error");
    fijarEstado("No disponible", "estado-anulada");
    return;
  }

  if (!data || data.length === 0) {
    avisar("avisoPaso1",
      "No encontramos un trabajo con esa fecha y ese teléfono. Verifique ambos datos en su documento; " +
      "la fecha debe ser la misma que aparece impresa.",
      "error");
    fijarEstado("No encontrado", "estado-anulada");
    return;
  }

  avisar("avisoPaso1",
    data.length === 1
      ? "Encontramos su trabajo. Confirme la dirección para continuar."
      : `Encontramos ${data.length} direcciones. Elija la que corresponde.`,
    "ok");

  llenarSelectorDireccion(data);
}

/* La dirección funciona como validación final: solo quien conoce
   su propio domicilio reconoce el fragmento correcto. */
function llenarSelectorDireccion(lista) {
  const sel = $("selDireccion");
  sel.innerHTML = '<option value="">— Seleccione la suya —</option>';

  lista.forEach((d) => {
    const opcion = document.createElement("option");
    opcion.value = d.historico_id;
    opcion.textContent = d.direccion_prefijo + "…";
    sel.appendChild(opcion);
  });

  $("bloqueDireccion").style.display = "block";

  // Con una sola coincidencia igual se pide confirmar
  sel.onchange = () => {
    const id = sel.value;

    if (!id) {
      Estado.historicoId = null;
      $("tarjetaReclamo").style.display = "none";
      fijarEstado("Sin identificar", "");
      return;
    }

    Estado.historicoId = Number(id);
    Estado.token = null;
    fijarEstado("Trabajo identificado", "estado-vigente");
    abrirPaso2();
  };
}

function ocultarSelectorDireccion() {
  const bloque = $("bloqueDireccion");
  if (!bloque) return;
  bloque.style.display = "none";
  $("selDireccion").innerHTML = '<option value="">— Seleccione la suya —</option>';
  Estado.historicoId = null;
}

/************************************************************
 * IMÁGENES
 ************************************************************/
function activarAdjuntos() {
  const zona    = $("zonaAdjuntar");
  const entrada = $("archivoImagenes");

  zona.addEventListener("click", () => entrada.click());

  entrada.addEventListener("change", async () => {
    for (const archivo of Array.from(entrada.files)) {
      if (Estado.imagenes.length >= CONFIG.maxImagenes) {
        avisar("avisoPaso2", `Puede adjuntar hasta ${CONFIG.maxImagenes} imágenes.`, "error");
        break;
      }
      if (archivo.size > CONFIG.maxPesoImagen) {
        avisar("avisoPaso2", `"${archivo.name}" pesa demasiado. Máximo 3 MB por imagen.`, "error");
        continue;
      }

      const datos = await leerComoTexto(archivo);
      Estado.imagenes.push({ nombre: archivo.name, tipo: archivo.type, datos });
    }

    entrada.value = "";
    pintarMiniaturas();
  });
}

function leerComoTexto(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload  = () => resolver(lector.result);
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(archivo);
  });
}

function pintarMiniaturas() {
  const cont = $("miniaturas");
  cont.innerHTML = "";

  Estado.imagenes.forEach((img, i) => {
    const caja = document.createElement("div");
    caja.className = "miniatura";
    caja.innerHTML = `<img src="${img.datos}" alt="${img.nombre}" />`;

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.textContent = "×";
    quitar.title = "Quitar";
    quitar.addEventListener("click", () => {
      Estado.imagenes.splice(i, 1);
      pintarMiniaturas();
    });

    caja.appendChild(quitar);
    cont.appendChild(caja);
  });
}

/************************************************************
 * ENVÍO
 ************************************************************/
async function enviarReclamacion() {
  const situacion = $("txtSituacion").value.trim();
  const nombre    = $("txtNombre").value.trim();
  const contacto  = soloDigitos($("txtContacto").value);
  const correo    = $("txtCorreo").value.trim();
  const otra      = $("txtOtra").value.trim();

  if (situacion.length < 20) {
    avisar("avisoPaso2", "Describa la situación observada con un poco más de detalle.", "error");
    return;
  }
  if (!nombre) {
    avisar("avisoPaso2", "Indique el nombre de quien reporta.", "error");
    return;
  }
  if (contacto.length < 10) {
    avisar("avisoPaso2", "Indique un número de contacto completo.", "error");
    return;
  }

  $("btnEnviar").disabled = true;
  avisar("avisoPaso2", "Enviando su reclamación...", "info");

  const { data, error } = await sb.rpc("fn_registrar_reclamacion", {
    p_nombre:            nombre,
    p_telefono:          formatearTelefono(contacto),
    p_descripcion_falla: situacion,
    p_token:             Estado.token,
    p_historico_id:      Estado.historicoId,
    p_correo:            correo || null,
    p_otra_informacion:  otra || null,
    p_imagenes:          Estado.imagenes.map(i => ({ nombre: i.nombre, tipo: i.tipo })),
    p_user_agent:        navigator.userAgent || null,
  });

  $("btnEnviar").disabled = false;

  if (error) {
    avisar("avisoPaso2", mensajeParaElCliente(error,
      "No pudimos registrar su reclamación en este momento. Intente de nuevo en unos minutos, " +
      "o llámenos al 809-564-0510 y la tomamos por teléfono."), "error");
    return;
  }

  const resultado = Array.isArray(data) ? data[0] : data;

  $("txtNumeroReclamo").textContent = resultado?.o_numero_reclamacion || "—";
  $("tarjetaIdentificar").style.display = "none";
  $("tarjetaReclamo").style.display     = "none";
  $("tarjetaFinal").style.display       = "block";
  fijarEstado("Reclamación enviada", "estado-vigente");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/************************************************************
 * UTILIDADES
 ************************************************************/
function formatearFecha(valor) {
  if (!valor) return "-";
  const [a, m, d] = String(valor).split("-");
  if (!a || !m || !d) return valor;
  const meses = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
}

function abrirPaso2() {
  $("tarjetaReclamo").style.display = "block";
  $("tarjetaReclamo").scrollIntoView({ behavior: "smooth", block: "start" });
}

function comenzarDeNuevo() {
  Estado.via = null;
  Estado.token = null;
  Estado.historicoId = null;
  Estado.imagenes = [];

  ["txtToken","txtFecha","txtSituacion","txtNombre","txtCorreo","txtOtra"]
    .forEach(id => { if ($(id)) $(id).value = ""; });
  ["txtTelefono","txtContacto"]
    .forEach(id => { if ($(id)) $(id).value = PLANTILLA; });

  ocultarSelectorDireccion();
  $("miniaturas").innerHTML = "";
  $("tarjetaReclamo").style.display = "none";
  $("tarjetaFinal").style.display   = "none";
  $("tarjetaIdentificar").style.display = "block";

  $("viaCodigo").classList.remove("activa");
  $("viaDatos").classList.remove("activa");
  $("bloqueCodigo").classList.remove("visible");
  $("bloqueDatos").classList.remove("visible");

  avisar("avisoPaso1", "");
  avisar("avisoPaso2", "");
  fijarEstado("Sin identificar", "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/************************************************************
 * INICIO
 ************************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  activarMascara("txtTelefono");
  activarMascara("txtContacto");
  activarAdjuntos();

  $("btnBuscarToken").addEventListener("click", () => buscarPorToken());
  $("btnBuscarDatos").addEventListener("click", buscarPorDatos);
  $("btnEnviar").addEventListener("click", enviarReclamacion);
  $("btnCancelar").addEventListener("click", comenzarDeNuevo);

  $("txtToken").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); buscarPorToken(); }
  });

  // La fecha no puede ser futura
  $("txtFecha").max = new Date().toISOString().slice(0, 10);

  // Si vino del código QR, se identifica solo
  const token = new URL(window.location.href).searchParams.get("token");

  if (token) {
    elegirVia("codigo");
    $("txtToken").value = token.trim();
    await buscarPorToken(token.trim());
  }
});
