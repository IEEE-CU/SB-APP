import { useSocietyStore } from "@/store/societyStore";

// Translates the web forms' field names into the shapes the REST API validates.

/** Society chosen in the header switcher; admins have no society of their own. */
export const activeSocietyId = (): string | undefined =>
  useSocietyStore.getState().activeSocietyId ||
  localStorage.getItem("activeSocietyId") ||
  undefined;

const PROJECT_STATUS: Record<string, string> = {
  planning: "PROPOSED",
  active: "ONGOING",
  completed: "COMPLETED",
  on_hold: "PROPOSED",
};

const EVENT_TYPES = [
  "Workshop",
  "Seminar",
  "Conference",
  "Competition",
  "Field Trip",
  "Outreach",
  "Social Event",
  "Other",
];

type Anything = Record<string, any>;

export function toProjectPayload(data: Anything) {
  const out: Anything = {
    title: data.title,
    description: data.description || data.title,
    societyId: data.societyId || activeSocietyId(),
    category: data.category || "TECHNICAL_PROJECT",
    sanctioningBody: data.sanctioningBody || "IEEE Student Branch",
    amountSanctioned: Number(data.amountSanctioned) || 0,
    startDate: data.startDate || new Date().toISOString(),
  };
  if (data.status) out.status = PROJECT_STATUS[data.status] ?? data.status;
  return out;
}

/** Edit payloads carry only the fields present, so stored values are never reset to a default. */
export function toProjectPatch(data: Anything) {
  const out: Anything = {};
  if (data.title !== undefined) out.title = data.title;
  if (data.description) out.description = data.description;
  if (data.status) out.status = PROJECT_STATUS[data.status] ?? data.status;
  return out;
}

export function toEventPatch(data: Anything) {
  const {
    societyId: _societyId,
    status: _status,
    ...rest
  } = toEventPayload(data);
  if (!data.date) delete rest.date;
  if (!data.capacity && data.capacity !== 0) delete rest.participants;
  return rest;
}

export function toEventPayload(data: Anything) {
  const speakers = Array.isArray(data.speakers)
    ? data.speakers.map((s: Anything) => ({
        name: s.name,
        designation: s.role || "Speaker",
        organization: s.organization || "IEEE",
        presentationTitle: s.presentationTitle || data.title,
      }))
    : undefined;
  const out: Anything = {
    title: data.title,
    description: data.description || data.title,
    societyId: data.societyId || activeSocietyId(),
    date: data.date || new Date().toISOString(),
    time: data.time,
    venue: data.location,
    eventType: EVENT_TYPES.includes(data.category) ? data.category : "Other",
    participants: Number(data.capacity) || 0,
  };
  if (speakers) out.speakers = speakers;
  return out;
}

export function toReportPayload(data: Anything) {
  return {
    title: data.title,
    description: data.content || data.title,
    type: data.type,
    societyId: data.societyId || activeSocietyId(),
  };
}
