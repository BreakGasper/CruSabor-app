// toolsUtils.ts
export function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export function obtenerGenero(genero: string): string {
  let gender = "Otro";

  switch (genero) {
    case "M":
      gender = "Masculino";
      break;
    case "F":
      gender = "Femenino";
      break;
    case "O":
      gender = "Otro";
      break;
  }

  return gender;
}
