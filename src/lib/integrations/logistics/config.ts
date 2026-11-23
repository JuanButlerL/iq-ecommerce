// Credenciales de las logísticas. Se leen solo en el servidor y nunca se loguean ni se guardan en la base.
// Viven en .env.production del servidor (o .env.local en una máquina de desarrollo).

function read(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}

export function getAndreaniConfig() {
  const environment = read("ANDREANI_ENV") === "qa" ? "qa" : "prod";
  return {
    environment,
    baseUrl: read("ANDREANI_BASE_URL") || (environment === "qa" ? "https://apisqa.andreani.com" : "https://apis.andreani.com"),
    user: read("ANDREANI_USER"),
    password: read("ANDREANI_PASSWORD"),
    clientNumber: read("ANDREANI_CLIENT_NUMBER"),
    contractHome: read("ANDREANI_CONTRACT_DOMICILIO"),
    contractBranch: read("ANDREANI_CONTRACT_SUCURSAL"),
    // Sucursal de origen para cotizar (código de 3 letras), si el contrato la pide.
    originBranch: read("ANDREANI_ORIGIN_BRANCH"),
  };
}

export function getCorreoConfig() {
  const environment = read("CORREO_AR_ENV") === "test" ? "test" : "prod";
  return {
    environment,
    baseUrl:
      read("CORREO_AR_BASE_URL") ||
      (environment === "test" ? "https://apitest.correoargentino.com.ar/micorreo/v1" : "https://api.correoargentino.com.ar/micorreo/v1"),
    user: read("CORREO_AR_USER"),
    password: read("CORREO_AR_PASSWORD"),
    customerId: read("CORREO_AR_CUSTOMER_ID"),
    // Cuenta de MiCorreo: solo hace falta si no se tiene el customerId (se obtiene con /users/validate).
    accountEmail: read("CORREO_AR_ACCOUNT_EMAIL"),
    accountPassword: read("CORREO_AR_ACCOUNT_PASSWORD"),
  };
}
