using FinancialTransfers.Domain.Entities;

namespace FinancialTransfers.Application.DTOs;

public record CreateImmediateTransferRequestDto(
    Guid SourceAccountId,
    Guid DestinationAccountId,
    decimal Amount);

public record CreateScheduledTransferRequestDto(
    Guid SourceAccountId,
    Guid DestinationAccountId,
    decimal Amount,
    DateTime ScheduledForUtc);

public record TransferResponseDto(
    Guid Id,
    Guid SourceAccountId,
    string? SourceAccountHolder,
    Guid DestinationAccountId,
    string? DestinationAccountHolder,
    decimal Amount,
    string Status,
    bool IsScheduled,
    DateTime? ScheduledForUtc,
    DateTime CreatedAtUtc,
    DateTime? ExecutedAtUtc,
    DateTime? CancelledAtUtc,
    string? FailureReason,
    string? IdempotencyKey)
{
    public static TransferResponseDto FromEntity(Transfer transfer) => new(
        transfer.Id,
        transfer.SourceAccountId,
        transfer.SourceAccount?.HolderName,
        transfer.DestinationAccountId,
        transfer.DestinationAccount?.HolderName,
        transfer.Amount,
        transfer.Status.ToString(),
        transfer.IsScheduled,
        transfer.ScheduledForUtc,
        transfer.CreatedAtUtc,
        transfer.ExecutedAtUtc,
        transfer.CancelledAtUtc,
        transfer.FailureReason,
        transfer.IdempotencyKey);
}
