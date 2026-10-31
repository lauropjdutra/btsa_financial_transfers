import { Fragment, useState } from 'react';
import { Transfer } from '../types/financial';
import {
  formatCurrency,
  formatDateTime,
  formatScheduledDateTime,
  formatShortDateTime,
  translateTransferStatus
} from '../utils/formatters';

interface TransfersHistoryTableProps {
  transfers: Transfer[];
  transferNotes: Record<string, string>;
  onCancelScheduled: (transferId: string) => Promise<void>;
  onLookupById: (transferId: string) => Promise<Transfer | null>;
  onClose: () => void;
}

function sanitizeHistoryText(text: string): string {
  return text
    .replace(/A conta de (origem|destino)\s*\([^)]+\)/gi, 'A conta de $1')
    .replace(/\bBlocked\b/gi, 'bloqueada')
    .replace(/\bInactive\b/gi, 'inativa')
    .replace(/\bActive\b/gi, 'ativa');
}

export function TransfersHistoryTable({
  transfers,
  transferNotes,
  onCancelScheduled,
  onLookupById,
  onClose
}: TransfersHistoryTableProps) {
  const [searchId, setSearchId] = useState('');
  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchId.trim();
    if (!trimmed) return;

    const existing = transfers.find((t) => t.id.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setExpandedTransferId(existing.id);
      return;
    }

    const found = await onLookupById(trimmed);
    if (found) {
      setExpandedTransferId(found.id);
    }
  }

  async function handleCancelClick(e: React.MouseEvent, transferId: string) {
    e.stopPropagation();
    setCancellingId(transferId);
    try {
      await onCancelScheduled(transferId);
    } finally {
      setCancellingId(null);
    }
  }

  function toggleRowExpansion(transferId: string) {
    setExpandedTransferId((current) => (current === transferId ? null : transferId));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <div className="panel-title-group">
            <h2 className="panel-title">Histórico de Transferências</h2>
            <span className="badge badge-neutral">{transfers.length} registros</span>
          </div>

          <div className="modal-header-actions">
            <form onSubmit={handleSearchSubmit} className="search-inline">
              <input
                type="text"
                placeholder="Buscar transferência por ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                Buscar
              </button>
            </form>
            <button
              type="button"
              className="modal-close-icon-btn"
              onClick={onClose}
              aria-label="Fechar modal"
              title="Fechar"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body-scroll">
          {transfers.length === 0 ? (
            <div className="empty-state">
              Nenhuma transferência registrada até o momento.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Modalidade</th>
                    <th>Origem / Destino</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Data e hora</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => {
                    const userNote = transferNotes[transfer.id];
                    const isExpanded = expandedTransferId === transfer.id;
                    const primaryDateUtc =
                      transfer.executedAtUtc ??
                      transfer.cancelledAtUtc ??
                      transfer.scheduledForUtc ??
                      transfer.createdAtUtc;

                    return (
                      <Fragment key={transfer.id}>
                        <tr
                          className={`history-row ${isExpanded ? 'history-row-expanded' : ''}`}
                          onClick={() => toggleRowExpansion(transfer.id)}
                          title="Clique para expandir detalhes da transferência"
                        >
                          <td className="id-full-cell">
                            <code className="mono-id-full">{transfer.id}</code>
                          </td>
                          <td>
                            <span className="modality-badge">
                              {transfer.isScheduled ? 'Agendada' : 'Imediata'}
                            </span>
                          </td>
                          <td className="participants-cell">
                            <div className="participant-line">
                              <strong>De:</strong> {transfer.sourceAccountHolder ?? transfer.sourceAccountId}
                            </div>
                            <div className="participant-line">
                              <strong>Para:</strong> {transfer.destinationAccountHolder ?? transfer.destinationAccountId}
                            </div>
                          </td>
                          <td className="amount-cell">{formatCurrency(transfer.amount)}</td>
                          <td>
                            <span className={`status-pill status-transfer-${transfer.status.toLowerCase()}`}>
                              {translateTransferStatus(transfer.status)}
                            </span>
                          </td>
                          <td className="dates-cell">
                            {formatShortDateTime(primaryDateUtc)}
                          </td>
                          <td className="reason-cell">
                            <div className="reason-text-clamp">
                              {transfer.failureReason ? (
                                <span className="text-danger">{sanitizeHistoryText(transfer.failureReason)}</span>
                              ) : userNote ? (
                                <span>{userNote}</span>
                              ) : (
                                '—'
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="history-detail-row">
                            <td colSpan={7}>
                              <div className="testimonial-detail-card">
                                <div className="testimonial-detail-grid">
                                  <div>
                                    <span>Identificador Único (GUID)</span>
                                    <strong><code>{transfer.id}</code></strong>
                                  </div>
                                  <div>
                                    <span>Conta de Origem (Débito)</span>
                                    <strong>{transfer.sourceAccountHolder ?? transfer.sourceAccountId}</strong>
                                  </div>
                                  <div>
                                    <span>Conta de Destino (Crédito)</span>
                                    <strong>{transfer.destinationAccountHolder ?? transfer.destinationAccountId}</strong>
                                  </div>
                                  <div>
                                    <span>Status</span>
                                    <strong>{translateTransferStatus(transfer.status)}</strong>
                                  </div>
                                  <div>
                                    <span>Valor da Operação</span>
                                    <strong>{formatCurrency(transfer.amount)}</strong>
                                  </div>
                                  <div>
                                    <span>Modalidade da Transferência</span>
                                    <strong>{transfer.isScheduled ? 'Agendada' : 'Imediata'}</strong>
                                  </div>
                                  <div>
                                    <span>Descrição Informada</span>
                                    <strong>{userNote ?? 'Nenhuma descrição informada'}</strong>
                                  </div>
                                  <div>
                                    <span>Eventos</span>
                                    <strong className="detail-events-list">
                                      <span>Criada {formatDateTime(transfer.createdAtUtc)}</span>
                                      {transfer.scheduledForUtc && !transfer.executedAtUtc && (
                                        <span>Agendada {formatScheduledDateTime(transfer.scheduledForUtc)}</span>
                                      )}
                                      {transfer.executedAtUtc && (
                                        <span>Processada {formatDateTime(transfer.executedAtUtc)}</span>
                                      )}
                                      {transfer.cancelledAtUtc && (
                                        <span>Cancelada {formatDateTime(transfer.cancelledAtUtc)}</span>
                                      )}
                                    </strong>
                                  </div>
                                </div>

                                {transfer.failureReason && (
                                  <div className="inspector-failure">
                                    <strong>Motivo da Rejeição:</strong> {sanitizeHistoryText(transfer.failureReason)}
                                  </div>
                                )}

                                {transfer.status === 'Scheduled' && (
                                  <div className="testimonial-detail-actions">
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      disabled={cancellingId === transfer.id}
                                      onClick={(e) => handleCancelClick(e, transfer.id)}
                                    >
                                      {cancellingId === transfer.id ? 'Cancelando...' : 'Cancelar agendamento'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
