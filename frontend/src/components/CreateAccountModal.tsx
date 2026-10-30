import { FormEvent, useState } from 'react';
import { CreateAccountRequest } from '../types/financial';

interface CreateAccountModalProps {
  onClose: () => void;
  onCreate: (payload: CreateAccountRequest) => Promise<void>;
}

export function CreateAccountModal({ onClose, onCreate }: CreateAccountModalProps) {
  const [holderName, setHolderName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('1000');
  const [overdraftLimit, setOverdraftLimit] = useState('500');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        holderName,
        documentNumber,
        initialBalance: Number(initialBalance),
        overdraftLimit: Number(overdraftLimit)
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="panel-header">
          <h3 className="panel-title">Cadastrar Nova Conta Bancária</h3>
        </div>
        <form onSubmit={handleSubmit} className="transfer-form">
          <div className="form-group">
            <label htmlFor="holderName">Nome do Titular / Razão Social</label>
            <input
              id="holderName"
              type="text"
              required
              placeholder="Ex: João Oliveira"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="documentNumber">CPF ou CNPJ (Apenas números)</label>
            <input
              id="documentNumber"
              type="text"
              required
              placeholder="Ex: 11122233344"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>
          <div className="form-row-two-cols">
            <div className="form-group">
              <label htmlFor="initialBalance">Saldo Inicial (R$)</label>
              <input
                id="initialBalance"
                type="number"
                step="0.01"
                required
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="overdraftLimit">Limite Cheque Especial (R$)</label>
              <input
                id="overdraftLimit"
                type="number"
                step="0.01"
                min="0"
                required
                value={overdraftLimit}
                onChange={(e) => setOverdraftLimit(e.target.value)}
              />
            </div>
          </div>
          <div className="account-card-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar Conta'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
