export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export const PRIORITIES = ["baja", "media", "alta", "critica"] as const;
export const STATUSES = ["abierto", "en_progreso", "resuelto", "cerrado"] as const;

export type Status = (typeof STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  abierto: ["en_progreso", "resuelto", "cerrado"],
  en_progreso: ["resuelto", "cerrado"],
  resuelto: ["en_progreso", "cerrado"],
  cerrado: [],
};

