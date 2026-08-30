HACS - VALIDACION PUBLICA DE COTIZACION

1) Subir la carpeta hacs a la raiz del repositorio de GitHub conectado a Netlify.
2) En app.js, validar estos campos:
   - supabaseUrl
   - supabaseAnonKey
   - tableOrView
   - publicBaseUrl
3) Crear en Supabase una vista publica recomendada: vw_cotizacion_publica.
4) La vista debe exponer solo campos seguros.
5) El QR debe apuntar a:
   https://mgonzalezimp.com.do/hacs/?token=TU_TOKEN

CAMPOS RECOMENDADOS EN LA VISTA:
- cotizacion_id
- numero_cotizacion (opcional)
- fecha_cotizacion
- nombre_cliente
- titulo_cotizacion
- descripcion_trabajo
- total
- estado_documento
- codigo_verificacion
- pdf_url (opcional)
- fecha_creacion o fecha_ultima_actualizacion
