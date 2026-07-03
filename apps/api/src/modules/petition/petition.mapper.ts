import type { Petition } from "@hu/types";

export function mapPetitionResponse(petition: Petition): Petition {
  return structuredClone(petition);
}

export function mapPetitionListResponse(petitions: Petition[]): Petition[] {
  return petitions.map((petition) => mapPetitionResponse(petition));
}
