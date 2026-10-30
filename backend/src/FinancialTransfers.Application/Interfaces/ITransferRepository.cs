using FinancialTransfers.Domain.Entities;

namespace FinancialTransfers.Application.Interfaces;

public interface ITransferRepository
{
    Task<Transfer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Transfer?> GetByIdempotencyKeyAsync(string idempotencyKey, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Transfer>> GetAllAsync(Guid? accountId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Transfer>> GetDueScheduledTransfersAsync(DateTime nowUtc, CancellationToken cancellationToken = default);
    Task<int> GetAttemptsInLastHourAsync(Guid sourceAccountId, DateTime oneHourAgoUtc, CancellationToken cancellationToken = default);
    Task<decimal> GetCompletedAmountInLastHourAsync(Guid sourceAccountId, DateTime oneHourAgoUtc, CancellationToken cancellationToken = default);
    Task AddAsync(Transfer transfer, CancellationToken cancellationToken = default);
    void Update(Transfer transfer);
}
