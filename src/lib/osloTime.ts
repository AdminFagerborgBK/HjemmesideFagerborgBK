const OSLO_TIME_ZONE = 'Europe/Oslo' as const;

type FormatOptions = Intl.DateTimeFormatOptions & {
  locale?: string;
};

function formatOslo(dateInput: string | Date, options: FormatOptions) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const { locale = 'nb-NO', ...intlOptions } = options;

  return new Intl.DateTimeFormat(locale, {
    timeZone: OSLO_TIME_ZONE,
    ...intlOptions,
  }).format(date);
}

export function formatOsloTime(dateStr: string) {
  return formatOslo(dateStr, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatOsloDateUpper(dateStr: string) {
  return formatOslo(dateStr, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

export function formatOsloDateLong(dateStr: string) {
  return formatOslo(dateStr, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatOsloDateShort(dateStr: string) {
  return formatOslo(dateStr, {
    day: 'numeric',
    month: 'short',
  });
}
