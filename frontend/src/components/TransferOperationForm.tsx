import { FormEvent, useState } from 'react';
import { Account } from '../types/financial';
import { formatCurrency, formatCurrencyInput } from '../utils/formatters';
import { AccountSelect } from './AccountSelect';

interface TransferOperationFormProps {
  accounts: Account[];
  selectedSourceId: string;
  isLoading?: boolean;
  onSourceChange: (accountId: string) => void;
  onSubmitImmediate: (
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    description?: string
  ) => Promise<void>;
  onSubmitScheduled: (
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    scheduledForUtc: string,
    description?: string
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
  isLoading = false,
  onSourceChange,
  onSubmitImmediate,
  onSubmitScheduled
}: TransferOperationFormProps) {
  const [operationMode, setOperationMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [amountDisplay, setAmountDisplay] = useState<string>('');
  const [amountNumeric, setAmountNumeric] = useState<number>(0);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(getDefaultFutureDateTimeLocal);
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const sourceAccount = accounts.find((a) => a.id === selectedSourceId);
  const destinationOptions = accounts.filter((a) => a.id !== selectedSourceId);

  const effectiveDestinationId =
    destinationAccountId && destinationAccountId !== selectedSourceId
      ? destinationAccountId
      : destinationOptions[0]?.id ?? '';

  const destinationAccount = accounts.find((a) => a.id === effectiveDestinationId);

  function handleAmountInputChange(rawValue: string) {
    const { display, numeric } = formatCurrencyInput(rawValue.replace('-', ''));
    setAmountDisplay(display);
    setAmountNumeric(numeric);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedSourceId || !effectiveDestinationId || amountNumeric <= 0) {
      return;
    }

    setSubmitting(true);
    try {
      const cleanDescription = descriptionInput.trim() || undefined;

      if (operationMode === 'immediate') {
        await onSubmitImmediate(
          selectedSourceId,
          effectiveDestinationId,
          amountNumeric,
          cleanDescription
        );
      } else {
        const scheduledIsoUtc = new Date(scheduledDateTime).toISOString();
        await onSubmitScheduled(
          selectedSourceId,
          effectiveDestinationId,
          amountNumeric,
          scheduledIsoUtc,
          cleanDescription
        );
      }
      setAmountDisplay('');
      setAmountNumeric(0);
      setDescriptionInput('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel panel-transfer">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Realizar Transferência</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="panel-loading-state">
          <span className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">Carregando</p>
        </div>
      ) : (
        <>
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
              Agendar Transferência
            </button>
          </div>

          <form onSubmit={handleSubmit} className="transfer-form">
            <div className="form-group">
              <label htmlFor="sourceAccount">Conta de Origem</label>
              <AccountSelect
                id="sourceAccount"
                accounts={accounts}
                selectedId={selectedSourceId}
                onChange={onSourceChange}
              />

              {sourceAccount && (
                <div className="source-summary-strip">
                  <div>
                    <span>Saldo</span>
                    <strong>{formatCurrency(sourceAccount.balance)}</strong>
                  </div>
                  <div>
                    <span>Cheque Especial Disp.</span>
                    <strong>{formatCurrency(sourceAccount.availableOverdraft)}</strong>
                  </div>
                  <div>
                    <span>Total Disponível</span>
                    <strong className="text-positive">{formatCurrency(sourceAccount.totalAvailableFunds)}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="destinationAccount">Conta de Destino</label>
              <AccountSelect
                id="destinationAccount"
                accounts={destinationOptions}
                selectedId={effectiveDestinationId}
                onChange={setDestinationAccountId}
              />
            </div>

            <div className={operationMode === 'scheduled' ? 'form-row-two-cols' : 'form-row-one-col'}>
              <div className="form-group">
                <label htmlFor="transferAmount">Valor (R$)</label>
                <input
                  id="transferAmount"
                  className="fixed-height-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={amountDisplay}
                  onChange={(e) => handleAmountInputChange(e.target.value)}
                  required
                />
              </div>

              {operationMode === 'scheduled' && (
                <div className="form-group">
                  <label htmlFor="scheduledFor">Data e Hora</label>
                  <input
                    id="scheduledFor"
                    className="fixed-height-input"
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="transferDescription">Descrição (Opcional)</label>
              <input
                id="transferDescription"
                className="fixed-height-input"
                type="text"
                maxLength={120}
                placeholder="Ex: Pagamento de fornecedor, aporte, reembolso"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Resumo da Operação</label>
              <div className="operation-summary-list">
                <div className="summary-list-row">
                  <span>Modalidade</span>
                  <strong>
                    {operationMode === 'immediate' ? 'Transferência Imediata' : 'Agendar Transferência'}
                  </strong>
                </div>
                <div className="summary-list-row">
                  <span>Favorecido</span>
                  <strong>{destinationAccount?.holderName ?? '—'}</strong>
                </div>
                <div className="summary-list-row">
                  <span>Valor a ser transferido</span>
                  <strong className="text-positive">{formatCurrency(amountNumeric)}</strong>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submitting || accounts.length < 2 || amountNumeric <= 0}
              >
                {submitting
                  ? 'Processando...'
                  : operationMode === 'immediate'
                    ? 'Transferir Agora'
                    : 'Confirmar Agendamento'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
