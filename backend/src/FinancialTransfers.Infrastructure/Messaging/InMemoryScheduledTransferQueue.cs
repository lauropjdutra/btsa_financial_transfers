using System.Collections.Concurrent;
using System.Threading.Channels;
using FinancialTransfers.Application.Interfaces;

namespace FinancialTransfers.Infrastructure.Messaging;

public class InMemoryScheduledTransferQueue : IScheduledTransferQueue
{
    private readonly Channel<ScheduledTransferMessage> _channel;
    private readonly ConcurrentDictionary<Guid, byte> _inFlightTransfers = new();

    public InMemoryScheduledTransferQueue()
    {
        var options = new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        };

        _channel = Channel.CreateBounded<ScheduledTransferMessage>(options);
    }

    public async ValueTask PublishAsync(ScheduledTransferMessage message, CancellationToken cancellationToken = default)
    {
        if (!_inFlightTransfers.TryAdd(message.TransferId, 0))
            return;

        await _channel.Writer.WriteAsync(message, cancellationToken);
    }

    public async IAsyncEnumerable<ScheduledTransferMessage> ReadAllAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var message in _channel.Reader.ReadAllAsync(cancellationToken))
        {
            try
            {
                yield return message;
            }
            finally
            {
                _inFlightTransfers.TryRemove(message.TransferId, out _);
            }
        }
    }
}
