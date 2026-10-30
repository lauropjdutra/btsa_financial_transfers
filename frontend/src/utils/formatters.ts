const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium'
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDateTime(isoUtcString: string | null): string {
  if (!isoUtcString) return '—';
  const date = new Date(isoUtcString);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
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
      return 'Agendada (Scheduled)';
    case 'Processing':
      return 'Em Processamento (Processing)';
    case 'Completed':
      return 'Concluída (Completed)';
    case 'Failed':
      return 'Rejeitada / Falhou (Failed)';
    case 'Cancelled':
      return 'Cancelada (Cancelled)';
    default:
      return status;
  }
}
