using FinancialTransfers.Domain.Common;

namespace FinancialTransfers.Domain.Events;

public record TransferScheduledDomainEvent(
    Guid TransferId,
    Guid SourceAccountId,
    Guid DestinationAccountId,
    decimal Amount,
    DateTime ScheduledForUtc,
    DateTime OccurredOnUtc) : IDomainEvent;

public record TransferCompletedDomainEvent(
    Guid TransferId,
    Guid SourceAccountId,
    Guid DestinationAccountId,
    decimal Amount,
    DateTime OccurredOnUtc) : IDomainEvent;

public record TransferFailedDomainEvent(
    Guid TransferId,
    Guid SourceAccountId,
    Guid DestinationAccountId,
    decimal Amount,
    string Reason,
    DateTime OccurredOnUtc) : IDomainEvent;

public record TransferCancelledDomainEvent(
    Guid TransferId,
    DateTime OccurredOnUtc) : IDomainEvent;
