const cloudinary = require("cloudinary").v2;

// Esta función se ejecutará en el servidor de Netlify, no en el navegador.
exports.handler = async function (event, context) {
  // 1. Configurar Cloudinary con las variables de entorno seguras.
  // Debes configurar estas variables en el dashboard de tu sitio en Netlify.
  cloudinary.config({
    cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // 2. Obtener el public_id de la imagen a borrar desde el cuerpo de la petición.
  const { publicId } = JSON.parse(event.body);

  if (!publicId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "No se proporcionó el public_id de la imagen.",
      }),
    };
  }

  try {
    // 3. Usar la API de Cloudinary para destruir (eliminar) la imagen.
    const result = await cloudinary.uploader.destroy(publicId);

    // Verificar si la eliminación fue exitosa.
    if (result.result !== "ok" && result.result !== "not found") {
      // Si no fue 'ok' o 'not found', algo salió mal.
      throw new Error(result.result);
    }

    // 4. Devolver una respuesta exitosa.
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Imagen ${publicId} eliminada o no encontrada.`,
        result,
      }),
    };
  } catch (error) {
    console.error("Error al eliminar la imagen de Cloudinary:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error interno del servidor al eliminar la imagen.",
        error: error.message,
      }),
    };
  }
};
