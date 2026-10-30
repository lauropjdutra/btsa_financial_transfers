using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Domain.Entities;
using FinancialTransfers.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FinancialTransfers.Infrastructure.Persistence.Repositories;

public class TransferRepository : ITransferRepository
{
    private readonly AppDbContext _dbContext;

    public TransferRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Transfer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transfers
            .Include(t => t.SourceAccount)
            .Include(t => t.DestinationAccount)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
    }

    public async Task<Transfer?> GetByIdempotencyKeyAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transfers
            .AsNoTracking()
            .Include(t => t.SourceAccount)
            .Include(t => t.DestinationAccount)
            .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey, cancellationToken);
    }

    public async Task<IReadOnlyList<Transfer>> GetAllAsync(Guid? accountId = null, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Transfers
            .AsNoTracking()
            .Include(t => t.SourceAccount)
            .Include(t => t.DestinationAccount)
            .AsQueryable();

        if (accountId.HasValue && accountId.Value != Guid.Empty)
        {
            query = query.Where(t => t.SourceAccountId == accountId.Value || t.DestinationAccountId == accountId.Value);
        }

        return await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Transfer>> GetDueScheduledTransfersAsync(DateTime nowUtc, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transfers
            .AsNoTracking()
            .Where(t => t.Status == TransferStatus.Scheduled && t.ScheduledForUtc <= nowUtc)
            .OrderBy(t => t.ScheduledForUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetAttemptsInLastHourAsync(Guid sourceAccountId, DateTime oneHourAgoUtc, CancellationToken cancellationToken = default)
    {
        // Contabiliza todas as transferências efetivamente tentadas/avaliadas na última hora (Completed ou Failed)
        return await _dbContext.Transfers
            .AsNoTracking()
            .Where(t => t.SourceAccountId == sourceAccountId
                        && (t.Status == TransferStatus.Completed || t.Status == TransferStatus.Failed)
                        && t.ExecutedAtUtc >= oneHourAgoUtc)
            .CountAsync(cancellationToken);
    }

    public async Task<decimal> GetCompletedAmountInLastHourAsync(Guid sourceAccountId, DateTime oneHourAgoUtc, CancellationToken cancellationToken = default)
    {
        var amounts = await _dbContext.Transfers
            .AsNoTracking()
            .Where(t => t.SourceAccountId == sourceAccountId
                        && t.Status == TransferStatus.Completed
                        && t.ExecutedAtUtc >= oneHourAgoUtc)
            .Select(t => t.Amount)
            .ToListAsync(cancellationToken);

        return amounts.Sum();
    }

    public async Task AddAsync(Transfer transfer, CancellationToken cancellationToken = default)
    {
        await _dbContext.Transfers.AddAsync(transfer, cancellationToken);
    }

    public void Update(Transfer transfer)
    {
        _dbContext.Transfers.Update(transfer);
    }
}
