import { FormEvent, useState } from 'react';
import { Account } from '../types/financial';
import { formatCurrency } from '../utils/formatters';

interface TransferOperationFormProps {
  accounts: Account[];
  selectedSourceId: string;
  onSourceChange: (accountId: string) => void;
  onSubmitImmediate: (
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    idempotencyKey?: string
  ) => Promise<void>;
  onSubmitScheduled: (
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    scheduledForUtc: string,
    idempotencyKey?: string
  ) => Promise<void>;
}

function getDefaultFutureDateTimeLocal(): string {
  const date = new Date(Date.now() + 2 * 60 * 1000);
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function TransferOperationForm({
  accounts,
  selectedSourceId,
  onSourceChange,
  onSubmitImmediate,
  onSubmitScheduled
}: TransferOperationFormProps) {
  const [operationMode, setOperationMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(getDefaultFutureDateTimeLocal);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const sourceAccount = accounts.find((a) => a.id === selectedSourceId);
  const destinationOptions = accounts.filter((a) => a.id !== selectedSourceId);

  const effectiveDestinationId =
    destinationAccountId && destinationAccountId !== selectedSourceId
      ? destinationAccountId
      : destinationOptions[0]?.id ?? '';

  function generateNewIdempotencyKey() {
    setIdempotencyKey(`idem-${crypto.randomUUID().slice(0, 8)}`);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsedAmount = Number(amountInput);
    if (!selectedSourceId || !effectiveDestinationId || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setSubmitting(true);
    try {
      if (operationMode === 'immediate') {
        await onSubmitImmediate(
          selectedSourceId,
          effectiveDestinationId,
          parsedAmount,
          idempotencyKey || undefined
        );
      } else {
        const scheduledIsoUtc = new Date(scheduledDateTime).toISOString();
        await onSubmitScheduled(
          selectedSourceId,
          effectiveDestinationId,
          parsedAmount,
          scheduledIsoUtc,
          idempotencyKey || undefined
        );
      }
      setAmountInput('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Nova Operação de Transferência</h2>
          <p className="panel-subtitle">
            Execute transferências imediatas (transação atômica) ou agende para processamento futuro via Worker.
          </p>
        </div>
      </div>

      <div className="mode-tabs" role="tablist">
        <button
          type="button"
          className={`mode-tab ${operationMode === 'immediate' ? 'mode-tab-active' : ''}`}
          onClick={() => setOperationMode('immediate')}
        >
          Transferência Imediata
        </button>
        <button
          type="button"
          className={`mode-tab ${operationMode === 'scheduled' ? 'mode-tab-active' : ''}`}
          onClick={() => {
            setOperationMode('scheduled');
            setScheduledDateTime(getDefaultFutureDateTimeLocal());
          }}
        >
          Agendar Transferência Futura
        </button>
      </div>

      <form onSubmit={handleSubmit} className="transfer-form">
        <div className="form-group">
          <label htmlFor="sourceAccount">Conta de Origem (Débito)</label>
          <select
            id="sourceAccount"
            value={selectedSourceId}
            onChange={(e) => onSourceChange(e.target.value)}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.holderName} — Saldo: {formatCurrency(account.balance)} (Disp. Total:{' '}
                {formatCurrency(account.totalAvailableFunds)}) [{account.status}]
              </option>
            ))}
          </select>
          {sourceAccount && (
            <small className="field-hint">
              Saldo atual: <strong>{formatCurrency(sourceAccount.balance)}</strong> | Cheque especial
              disponível: <strong>{formatCurrency(sourceAccount.availableOverdraft)}</strong> | Poder total:{' '}
              <strong>{formatCurrency(sourceAccount.totalAvailableFunds)}</strong>
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="destinationAccount">Conta de Destino (Crédito)</label>
          <select
            id="destinationAccount"
            value={effectiveDestinationId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
            required
          >
            {destinationOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.holderName} — Saldo: {formatCurrency(account.balance)} [{account.status}]
              </option>
            ))}
          </select>
        </div>

        <div className="form-row-two-cols">
          <div className="form-group">
            <label htmlFor="transferAmount">Valor da Transferência (R$)</label>
            <input
              id="transferAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ex: 1000.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
            />
          </div>

          {operationMode === 'scheduled' && (
            <div className="form-group">
              <label htmlFor="scheduledFor">Data e Hora da Execução</label>
              <input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                required
              />
              <small className="field-hint">
                O Background Worker processa agendamentos vencidos a cada 5 segundos.
              </small>
            </div>
          )}
        </div>

        <div className="form-group">
          <div className="label-with-action">
            <label htmlFor="idempotencyKey">Chave de Idempotência (Opcional — Header Idempotency-Key)</label>
            <button
              type="button"
              className="btn-link"
              onClick={generateNewIdempotencyKey}
            >
              Gerar chave única
            </button>
          </div>
          <input
            id="idempotencyKey"
            type="text"
            placeholder="Deixe em branco ou informe uma chave para evitar duplicidade"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || accounts.length < 2}
          >
            {submitting
              ? 'Processando...'
              : operationMode === 'immediate'
                ? 'Confirmar Transferência Imediata'
                : 'Confirmar Agendamento'}
          </button>
        </div>
      </form>
    </section>
  );
}
