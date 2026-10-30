import { useState } from 'react';
import { Transfer } from '../types/financial';
import { formatCurrency, formatDateTime, translateTransferStatus } from '../utils/formatters';

interface TransfersHistoryTableProps {
  transfers: Transfer[];
  onCancelScheduled: (transferId: string) => Promise<void>;
  onLookupById: (transferId: string) => Promise<Transfer | null>;
}

export function TransfersHistoryTable({
  transfers,
  onCancelScheduled,
  onLookupById
}: TransfersHistoryTableProps) {
  const [searchId, setSearchId] = useState('');
  const [inspectedTransfer, setInspectedTransfer] = useState<Transfer | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchId.trim()) return;
    const found = await onLookupById(searchId.trim());
    if (found) {
      setInspectedTransfer(found);
    }
  }

  async function handleCancelClick(transferId: string) {
    setCancellingId(transferId);
    try {
      await onCancelScheduled(transferId);
      if (inspectedTransfer?.id === transferId) {
        const updated = await onLookupById(transferId);
        setInspectedTransfer(updated);
      }
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Histórico, Status e Agendamentos</h2>
          <p className="panel-subtitle">
            Consulte transferências por ID (GET /api/transfers/&#123;id&#125;), acompanhe tentativas rejeitadas e cancele agendamentos pendentes.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="lookup-bar">
          <input
            type="text"
            placeholder="Consultar por ID (GUID)..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Consultar ID
          </button>
        </form>
      </div>

      {inspectedTransfer && (
        <div className="inspector-box">
          <div className="inspector-header">
            <strong>Detalhes da Transferência Consultada: <code>{inspectedTransfer.id}</code></strong>
            <button
              type="button"
              className="btn-link"
              onClick={() => setInspectedTransfer(null)}
            >
              Fechar detalhes
            </button>
          </div>
          <div className="inspector-grid">
            <div>
              <span>Status:</span>{' '}
              <strong>{translateTransferStatus(inspectedTransfer.status)}</strong>
            </div>
            <div>
              <span>Valor:</span>{' '}
              <strong>{formatCurrency(inspectedTransfer.amount)}</strong>
            </div>
            <div>
              <span>Origem:</span>{' '}
              <strong>{inspectedTransfer.sourceAccountHolder ?? inspectedTransfer.sourceAccountId}</strong>
            </div>
            <div>
              <span>Destino:</span>{' '}
              <strong>{inspectedTransfer.destinationAccountHolder ?? inspectedTransfer.destinationAccountId}</strong>
            </div>
            <div>
              <span>Criada em:</span> {formatDateTime(inspectedTransfer.createdAtUtc)}
            </div>
            <div>
              <span>Agendada para:</span> {formatDateTime(inspectedTransfer.scheduledForUtc)}
            </div>
            <div>
              <span>Executada em:</span> {formatDateTime(inspectedTransfer.executedAtUtc)}
            </div>
            <div>
              <span>Chave Idempotência:</span>{' '}
              <code>{inspectedTransfer.idempotencyKey ?? 'Não informada'}</code>
            </div>
          </div>
          {inspectedTransfer.failureReason && (
            <div className="inspector-failure">
              <strong>Motivo da Rejeição:</strong> {inspectedTransfer.failureReason}
            </div>
          )}
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="empty-state">
          Nenhuma transferência registrada até o momento.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID / Tipo</th>
                <th>Origem → Destino</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Datas (Criação / Agendamento / Execução)</th>
                <th>Observação / Motivo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>
                    <div className="mono-id" title={transfer.id}>
                      {transfer.id.slice(0, 8)}...
                    </div>
                    <span className="sub-label">
                      {transfer.isScheduled ? 'Agendada' : 'Imediata'}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong>De:</strong> {transfer.sourceAccountHolder ?? transfer.sourceAccountId.slice(0, 8)}
                    </div>
                    <div>
                      <strong>Para:</strong> {transfer.destinationAccountHolder ?? transfer.destinationAccountId.slice(0, 8)}
                    </div>
                  </td>
                  <td className="amount-cell">{formatCurrency(transfer.amount)}</td>
                  <td>
                    <span className={`status-pill status-transfer-${transfer.status.toLowerCase()}`}>
                      {transfer.status}
                    </span>
                  </td>
                  <td className="dates-cell">
                    <div>Criada: {formatDateTime(transfer.createdAtUtc)}</div>
                    {transfer.scheduledForUtc && (
                      <div>Agendada: {formatDateTime(transfer.scheduledForUtc)}</div>
                    )}
                    {transfer.executedAtUtc && (
                      <div>Processada: {formatDateTime(transfer.executedAtUtc)}</div>
                    )}
                    {transfer.cancelledAtUtc && (
                      <div>Cancelada: {formatDateTime(transfer.cancelledAtUtc)}</div>
                    )}
                  </td>
                  <td className="reason-cell">
                    {transfer.failureReason ? (
                      <span className="text-danger">{transfer.failureReason}</span>
                    ) : transfer.idempotencyKey ? (
                      <span className="sub-label">Idemp: <code>{transfer.idempotencyKey}</code></span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setInspectedTransfer(transfer)}
                      >
                        Ver
                      </button>
                      {transfer.status === 'Scheduled' && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={cancellingId === transfer.id}
                          onClick={() => handleCancelClick(transfer.id)}
                        >
                          {cancellingId === transfer.id ? 'Cancelando...' : 'Cancelar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
