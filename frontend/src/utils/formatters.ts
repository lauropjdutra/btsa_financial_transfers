const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const shortTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit'
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumberPtBr(value: number): string {
  return numberFormatter.format(value);
}

export function formatCurrencyInput(rawValue: string): { display: string; numeric: number } {
  const isNegative = rawValue.trim().startsWith('-');
  const digits = rawValue.replace(/\D/g, '');

  if (!digits) {
    return { display: '', numeric: 0 };
  }

  const cents = parseInt(digits, 10);
  if (Number.isNaN(cents)) {
    return { display: '', numeric: 0 };
  }

  const unsignedValue = cents / 100;
  const numeric = isNegative ? -unsignedValue : unsignedValue;
  const formatted = numberFormatter.format(unsignedValue);

  return {
    display: isNegative ? `-${formatted}` : formatted,
    numeric
  };
}

export function formatDocumentPtBr(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function isValidDocumentPtBr(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

export function formatDateTime(isoUtcString: string | null): string {
  if (!isoUtcString) return '—';
  const date = new Date(isoUtcString);
  if (Number.isNaN(date.getTime())) return '—';
  return `em ${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

export function formatScheduledDateTime(isoUtcString: string | null): string {
  if (!isoUtcString) return '—';
  const date = new Date(isoUtcString);
  if (Number.isNaN(date.getTime())) return '—';
  return `para ${dateFormatter.format(date)} às ${shortTimeFormatter.format(date)}`;
}

export function formatShortDateTime(isoUtcString: string | null): string {
  if (!isoUtcString) return '—';
  const date = new Date(isoUtcString);
  if (Number.isNaN(date.getTime())) return '—';
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

export function translateAccountStatus(status: string): string {
  switch (status) {
    case 'Active':
      return 'Ativa';
    case 'Blocked':
      return 'Bloqueada';
    case 'Inactive':
      return 'Inativa';
    default:
      return status;
  }
}

export function translateTransferStatus(status: string): string {
  switch (status) {
    case 'Scheduled':
      return 'Agendada';
    case 'Processing':
      return 'Processando';
    case 'Completed':
      return 'Concluída';
    case 'Failed':
      return 'Falhou';
    case 'Cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}
