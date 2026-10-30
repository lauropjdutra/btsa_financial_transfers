using FinancialTransfers.Domain.Common;
using FinancialTransfers.Domain.Enums;
using FinancialTransfers.Domain.Events;

namespace FinancialTransfers.Domain.Entities;

public class Transfer : Entity
{
    public Guid SourceAccountId { get; private set; }
    public Guid DestinationAccountId { get; private set; }
    public decimal Amount { get; private set; }
    public TransferStatus Status { get; private set; }
    public bool IsScheduled { get; private set; }
    public DateTime? ScheduledForUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ExecutedAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public string? FailureReason { get; private set; }
    public string? IdempotencyKey { get; private set; }

    public Account? SourceAccount { get; private set; }
    public Account? DestinationAccount { get; private set; }

    protected Transfer()
    {
    }

    private Transfer(
        Guid sourceAccountId,
        Guid destinationAccountId,
        decimal amount,
        bool isScheduled,
        DateTime? scheduledForUtc,
        DateTime createdAtUtc,
        string? idempotencyKey)
    {
        if (sourceAccountId == Guid.Empty)
            throw new DomainException("A conta de origem é obrigatória.");

        if (destinationAccountId == Guid.Empty)
            throw new DomainException("A conta de destino é obrigatória.");

        if (sourceAccountId == destinationAccountId)
            throw new DomainException("A conta de origem e a conta de destino devem ser diferentes.");

        if (amount <= 0)
            throw new DomainException("O valor da transferência deve ser maior que zero.");

        SourceAccountId = sourceAccountId;
        DestinationAccountId = destinationAccountId;
        Amount = amount;
        IsScheduled = isScheduled;
        ScheduledForUtc = scheduledForUtc;
        CreatedAtUtc = createdAtUtc;
        IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey.Trim();
    }

    public static Transfer CreateImmediate(
        Guid sourceAccountId,
        Guid destinationAccountId,
        decimal amount,
        DateTime nowUtc,
        string? idempotencyKey = null)
    {
        var transfer = new Transfer(
            sourceAccountId,
            destinationAccountId,
            amount,
            isScheduled: false,
            scheduledForUtc: null,
            createdAtUtc: nowUtc,
            idempotencyKey: idempotencyKey)
        {
            Status = TransferStatus.Processing
        };

        return transfer;
    }

    public static Transfer CreateScheduled(
        Guid sourceAccountId,
        Guid destinationAccountId,
        decimal amount,
        DateTime scheduledForUtc,
        DateTime nowUtc,
        string? idempotencyKey = null)
    {
        if (scheduledForUtc <= nowUtc)
            throw new DomainException("A data de agendamento deve ser futura.");

        var transfer = new Transfer(
            sourceAccountId,
            destinationAccountId,
            amount,
            isScheduled: true,
            scheduledForUtc: scheduledForUtc,
            createdAtUtc: nowUtc,
            idempotencyKey: idempotencyKey)
        {
            Status = TransferStatus.Scheduled
        };

        transfer.RaiseDomainEvent(new TransferScheduledDomainEvent(
            transfer.Id,
            transfer.SourceAccountId,
            transfer.DestinationAccountId,
            transfer.Amount,
            scheduledForUtc,
            nowUtc));

        return transfer;
    }

    public void StartProcessing()
    {
        if (Status != TransferStatus.Scheduled)
            throw new DomainException($"Apenas transferências agendadas podem iniciar processamento. Status atual: {Status}.");

        Status = TransferStatus.Processing;
    }

    public void MarkAsCompleted(DateTime executedAtUtc)
    {
        if (Status != TransferStatus.Processing)
            throw new DomainException($"A transferência precisa estar em processamento para ser concluída. Status atual: {Status}.");

        Status = TransferStatus.Completed;
        ExecutedAtUtc = executedAtUtc;
        FailureReason = null;

        RaiseDomainEvent(new TransferCompletedDomainEvent(
            Id,
            SourceAccountId,
            DestinationAccountId,
            Amount,
            executedAtUtc));
    }

    public void MarkAsFailed(string reason, DateTime evaluatedAtUtc)
    {
        if (Status == TransferStatus.Completed || Status == TransferStatus.Cancelled)
            throw new DomainException($"Não é possível marcar como falha uma transferência no estado {Status}.");

        Status = TransferStatus.Failed;
        FailureReason = reason;
        ExecutedAtUtc = evaluatedAtUtc;

        RaiseDomainEvent(new TransferFailedDomainEvent(
            Id,
            SourceAccountId,
            DestinationAccountId,
            Amount,
            reason,
            evaluatedAtUtc));
    }

    public void Cancel(DateTime cancelledAtUtc)
    {
        if (Status != TransferStatus.Scheduled)
            throw new DomainException("Apenas transferências agendadas podem ser canceladas.");

        Status = TransferStatus.Cancelled;
        CancelledAtUtc = cancelledAtUtc;

        RaiseDomainEvent(new TransferCancelledDomainEvent(Id, cancelledAtUtc));
    }
}
