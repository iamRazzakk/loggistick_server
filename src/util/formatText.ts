export const displayName = (
  person?: { firstName?: string; lastName?: string } | null,
) => [person?.firstName, person?.lastName].filter(Boolean).join(" ");

export const joinList = (values?: readonly unknown[] | null) =>
  (values ?? [])
    .filter((value) => value !== undefined && value !== null && `${value}` !== "")
    .join(", ");
