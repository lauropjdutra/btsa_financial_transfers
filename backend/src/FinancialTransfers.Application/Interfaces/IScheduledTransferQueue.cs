namespace FinancialTransfers.Application.Interfaces;

public record ScheduledTransferMessage(Guid TransferId, DateTime EnqueuedAtUtc);

public interface IScheduledTransferQueue
{
    ValueTask PublishAsync(ScheduledTransferMessage message, CancellationToken cancellationToken = default);
    IAsyncEnumerable<ScheduledTransferMessage> ReadAllAsync(CancellationToken cancellationToken = default);
}
