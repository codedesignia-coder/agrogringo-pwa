/**
 * Extrae el publicId de una URL segura de Cloudinary.
 * @param {string} secureUrl - La URL segura de Cloudinary (ej. https://res.cloudinary.com/cloud_name/image/upload/v12345/public_id.jpg)
 * @returns {string|null} El publicId de la imagen o null si no se puede extraer.
 */
const extractPublicIdFromCloudinaryUrl = (secureUrl) => {
  if (!secureUrl || typeof secureUrl !== "string") {
    return null;
  }
  // Expresión regular para capturar el publicId después de '/upload/' y antes de la extensión o el final de la URL
  const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w{3,4})?$/);
  return match ? match[1] : null;
};

/**
 * Llama a la función de Netlify para eliminar una imagen de Cloudinary.
 * @param {string} imageUrl - La URL completa de la imagen en Cloudinary.
 * @returns {Promise<object>} Una promesa que se resuelve con la respuesta de la función de Netlify.
 */
export const deleteCloudinaryImage = async (imageUrl) => {
  const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);

  if (!publicId) {
    throw new Error("No se pudo extraer el publicId de la URL de la imagen.");
  }

  try {
    const response = await fetch(
      "/.netlify/functions/delete-cloudinary-image",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.message || "Error al eliminar la imagen de Cloudinary."
      );
    }
    return data;
  } catch (error) {
    console.error(
      "Error al llamar a la función de eliminación de Cloudinary:",
      error
    );
    throw error;
  }
};
