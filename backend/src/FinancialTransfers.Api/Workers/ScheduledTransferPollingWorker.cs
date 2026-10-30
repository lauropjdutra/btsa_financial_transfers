using FinancialTransfers.Application.Interfaces;

namespace FinancialTransfers.Api.Workers;

public class ScheduledTransferPollingWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IScheduledTransferQueue _queue;
    private readonly ILogger<ScheduledTransferPollingWorker> _logger;

    public ScheduledTransferPollingWorker(
        IServiceProvider serviceProvider,
        IScheduledTransferQueue queue,
        ILogger<ScheduledTransferPollingWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Worker de varredura de transferências agendadas iniciado.");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var transferRepository = scope.ServiceProvider.GetRequiredService<ITransferRepository>();
                var dateTimeProvider = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();

                var dueTransfers = await transferRepository.GetDueScheduledTransfersAsync(
                    dateTimeProvider.UtcNow,
                    stoppingToken);

                foreach (var transfer in dueTransfers)
                {
                    await _queue.PublishAsync(
                        new ScheduledTransferMessage(transfer.Id, dateTimeProvider.UtcNow),
                        stoppingToken);

                    _logger.LogInformation(
                        "Transferência agendada {TransferId} enviada para a fila de mensageria.",
                        transfer.Id);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Não foi possível consultar agendamentos pendentes. Verifique se o banco e as migrations já foram aplicados.");
            }
        }
    }
}
