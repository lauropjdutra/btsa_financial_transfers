using FinancialTransfers.Application.Common;
using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FinancialTransfers.Infrastructure.Persistence;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<UnitOfWork> _logger;

    public UnitOfWork(AppDbContext dbContext, ILogger<UnitOfWork> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var domainEvents = _dbContext.ChangeTracker
            .Entries<Entity>()
            .SelectMany(entry => entry.Entity.DomainEvents)
            .ToList();

        foreach (var entry in _dbContext.ChangeTracker.Entries<Entity>())
        {
            entry.Entity.ClearDomainEvents();
        }

        try
        {
            var result = await _dbContext.SaveChangesAsync(cancellationToken);

            foreach (var domainEvent in domainEvents)
            {
                _logger.LogInformation(
                    "[DomainEvent Dispatched] {EventType}: {@EventPayload}",
                    domainEvent.GetType().Name,
                    domainEvent);
            }

            return result;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Conflito de concorrência detectado ao atualizar saldo de conta simultaneamente.");
            throw new ConcurrencyConflictException(
                "Operação concorrente detectada na mesma conta bancária. Por segurança financeira, tente novamente.");
        }
    }

    public async Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default)
    {
        if (_dbContext.Database.CurrentTransaction is not null)
        {
            await operation(cancellationToken);
            return;
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await operation(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
