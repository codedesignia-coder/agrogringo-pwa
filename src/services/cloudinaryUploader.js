/**
 * Sube un archivo a Cloudinary usando un preajuste de subida sin firmar.
 * @param {File|Blob} file - El archivo o blob a subir.
 * @returns {Promise<string>} Una promesa que se resuelve con la URL segura de la imagen subida.
 */
export const uploadToCloudinary = async (file) => {
  // ¡IMPORTANTE! Reemplaza estos valores con los de tu cuenta de Cloudinary.
  const CLOUD_NAME = "dctye2tfk"; // Este es tu Cloud Name. ¡Correcto!
  const UPLOAD_PRESET = "agrogringo_unsigned_uploads"; // Este es tu Upload Preset. ¡Correcto!

  // Verificación para ayudar a depurar.
  if (CLOUD_NAME === "tu_cloud_name" || UPLOAD_PRESET === "tu_upload_preset") {
    const errorMessage =
      "Las credenciales de Cloudinary no están configuradas en 'src/services/cloudinaryUploader.js'. Reemplaza 'tu_cloud_name' y 'tu_upload_preset'.";
    console.error(errorMessage);
    // Lanzamos un error que se mostrará en el toast.
    throw new Error("Configuración de Cloudinary incompleta.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || "Error desconocido de Cloudinary");
    }

    return data.secure_url; // Esta es la URL que guardarás en Firestore.
  } catch (error) {
    console.error("Error al subir la imagen a Cloudinary:", error);
    throw new Error(`La subida de la imagen falló: ${error.message}`);
  }
};
