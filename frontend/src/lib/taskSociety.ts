// Which society a new task is created under (Tasks page only).
//
// Backend policy (POST /tasks): an administrator may create a task under any
// existing society; everyone else only under their own society; a caller with no
// society cannot create tasks. This module mirrors that on the client so the page
// never sends a society the server would refuse, and never picks one by accident.
//
// Deliberately independent of the shared society store/switcher, which other
// screens (channels, boards) use for browsing. No imports: it is plain logic that
// can be tested without React.

export interface TaskSocietyUser {
  /** "ADMIN" or "OFFICE_BEARER", as returned by the login API. */
  role?: string | null;
  /** The user's own society id, as returned by the login API. */
  societyId?: string | null;
}

export type TaskSocietyContext =
  | { status: "ready"; societyId: string; canChoose: boolean }
  | { status: "loading" }
  | { status: "missing"; reason: "signed-out" | "no-society" | "none-selected" };

export interface ResolveTaskSocietyInput {
  user: TaskSocietyUser | null | undefined;
  /** The society selected in the shared switcher (used for administrators only). */
  activeSocietyId: string | null | undefined;
  /** The societies the switcher offers; empty until they have loaded. */
  societies: ReadonlyArray<{ id: string }>;
}

export function resolveTaskSociety(input: ResolveTaskSocietyInput): TaskSocietyContext {
  const { user, activeSocietyId, societies } = input;
  if (!user) return { status: "missing", reason: "signed-out" };

  // Everyone except an administrator: their own society, whatever the shared
  // switcher currently shows. No society means no tasks - never a default.
  if (user.role !== "ADMIN") {
    return user.societyId
      ? { status: "ready", societyId: user.societyId, canChoose: false }
      : { status: "missing", reason: "no-society" };
  }

  // Administrator: the society they selected, and only if it is a real one from
  // the loaded list. Never the first society of the list.
  if (societies.length === 0) return { status: "loading" };
  if (activeSocietyId && societies.some((society) => society.id === activeSocietyId)) {
    return { status: "ready", societyId: activeSocietyId, canChoose: true };
  }
  return { status: "missing", reason: "none-selected" };
}

/** A short note for the page, or null when nothing needs saying. */
export function taskSocietyNotice(
  context: TaskSocietyContext,
  activeSocietyId: string | null | undefined,
): string | null {
  if (context.status === "ready") {
    return !context.canChoose && activeSocietyId && activeSocietyId !== context.societyId
      ? "Tasks are always created in your own society."
      : null;
  }
  if (context.status === "loading") return null;
  switch (context.reason) {
    case "signed-out":
      return "Sign in to create tasks.";
    case "no-society":
      return "Your account is not linked to a society, so tasks cannot be created.";
    default:
      return "Select a society in the header to create tasks.";
  }
}
