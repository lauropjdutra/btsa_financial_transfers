using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Application.Services;

namespace FinancialTransfers.Api.Workers;

public class ScheduledTransferConsumerWorker : BackgroundService
{
    private readonly IScheduledTransferQueue _queue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScheduledTransferConsumerWorker> _logger;

    public ScheduledTransferConsumerWorker(
        IScheduledTransferQueue queue,
        IServiceProvider serviceProvider,
        ILogger<ScheduledTransferConsumerWorker> logger)
    {
        _queue = queue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Consumer de mensageria de transferências agendadas iniciado.");

        await foreach (var message in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var transferService = scope.ServiceProvider.GetRequiredService<ITransferService>();

                var result = await transferService.ProcessScheduledTransferAsync(message.TransferId, stoppingToken);

                _logger.LogInformation(
                    "Agendamento {TransferId} processado via mensageria com status final: {Status}.",
                    result.Id,
                    result.Status);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Erro ao processar mensagem do agendamento {TransferId}.", message.TransferId);
            }
        }
    }
}
