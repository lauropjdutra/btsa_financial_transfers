using FinancialTransfers.Application.Common;
using FinancialTransfers.Application.DTOs;
using FinancialTransfers.Application.Interfaces;
using FinancialTransfers.Application.Services;
using FinancialTransfers.Domain.Common;
using FinancialTransfers.Domain.Entities;
using FinancialTransfers.Domain.Enums;
using FinancialTransfers.Infrastructure.Persistence;
using FinancialTransfers.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace FinancialTransfers.Tests;

public class FakeDateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow { get; set; } = new(2026, 10, 30, 15, 0, 0, DateTimeKind.Utc);
    public bool ForceNightPeriod { get; set; }

    public bool IsNightPeriod(DateTime utcDateTime) => ForceNightPeriod;
}

public class TransferScenariosIntegrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _dbContext;
    private readonly FakeDateTimeProvider _dateTimeProvider;
    private readonly AccountRepository _accountRepository;
    private readonly TransferRepository _transferRepository;
    private readonly UnitOfWork _unitOfWork;
    private readonly TransferService _transferService;

    public TransferScenariosIntegrationTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _dbContext = new AppDbContext(options);
        _dbContext.Database.EnsureCreated();

        _dateTimeProvider = new FakeDateTimeProvider();
        _accountRepository = new AccountRepository(_dbContext);
        _transferRepository = new TransferRepository(_dbContext);
        _unitOfWork = new UnitOfWork(_dbContext, NullLogger<UnitOfWork>.Instance);
        _transferService = new TransferService(
            _accountRepository,
            _transferRepository,
            _unitOfWork,
            _dateTimeProvider);
    }

    [Fact]
    public async Task Cenario1_TransferenciaComSaldoSuficiente_DeveConcluirEDebitarSaldo()
    {
        var origem = new Account("Origem", "111", initialBalance: 1000m, overdraftLimit: 500m);
        var destino = new Account("Destino", "222", initialBalance: 200m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var response = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 400m));

        Assert.Equal("Completed", response.Status);
        Assert.Equal(600m, (await _accountRepository.GetByIdAsync(origem.Id))!.Balance);
        Assert.Equal(600m, (await _accountRepository.GetByIdAsync(destino.Id))!.Balance);
    }

    [Fact]
    public async Task Cenario2_TransferenciaUtilizandoChequeEspecial_DeveFicarComSaldoNegativoRespeitandoLimite()
    {
        var origem = new Account("Origem", "111", initialBalance: 500m, overdraftLimit: 1000m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var response = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 1000m));

        var origemAtualizada = (await _accountRepository.GetByIdAsync(origem.Id))!;
        Assert.Equal("Completed", response.Status);
        Assert.Equal(-500m, origemAtualizada.Balance);
        Assert.Equal(500m, origemAtualizada.UsedOverdraft);
        Assert.Equal(500m, origemAtualizada.AvailableOverdraft);
    }

    [Fact]
    public async Task Cenario3_TransferenciaQueUltrapassaChequeEspecial_DeveFalharEContarComoTentativa()
    {
        var origem = new Account("Origem", "111", initialBalance: 500m, overdraftLimit: 1000m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var response = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 1600m));

        Assert.Equal("Failed", response.Status);
        Assert.Contains("Saldo insuficiente", response.FailureReason);
        Assert.Equal(500m, (await _accountRepository.GetByIdAsync(origem.Id))!.Balance);

        var tentativas = await _transferRepository.GetAttemptsInLastHourAsync(
            origem.Id,
            _dateTimeProvider.UtcNow.AddHours(-1));
        Assert.Equal(1, tentativas);
    }

    [Fact]
    public async Task Cenario4_RecebimentoEnquantoUtilizaChequeEspecial_DeveCobrirChequeEspecialPrimeiro()
    {
        var pagador = new Account("Pagador", "111", initialBalance: 2000m, overdraftLimit: 0m);
        var recebedor = new Account("Recebedor", "222", initialBalance: -800m, overdraftLimit: 1000m);
        await _accountRepository.AddAsync(pagador);
        await _accountRepository.AddAsync(recebedor);
        await _unitOfWork.SaveChangesAsync();

        var response = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(pagador.Id, recebedor.Id, 1000m));

        var recebedorAtualizado = (await _accountRepository.GetByIdAsync(recebedor.Id))!;
        Assert.Equal("Completed", response.Status);
        Assert.Equal(200m, recebedorAtualizado.Balance);
        Assert.Equal(0m, recebedorAtualizado.UsedOverdraft);
        Assert.Equal(1000m, recebedorAtualizado.AvailableOverdraft);
    }

    [Fact]
    public async Task Cenario5_TransferenciaAcimaDoLimiteDaHoraDiurno_DeveFalhar()
    {
        var origem = new Account("Origem", "111", initialBalance: 10000m, overdraftLimit: 0m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var t1 = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 4000m));
        Assert.Equal("Completed", t1.Status);

        var t2 = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 1500m));

        Assert.Equal("Failed", t2.Status);
        Assert.Contains("Limite de valor por hora excedido", t2.FailureReason);
    }

    [Fact]
    public async Task Cenario6_ExcessoDeTentativasDentroDaHoraContandoRejeitadas_DeveBloquearNaSextaTentativa()
    {
        var origem = new Account("Origem", "111", initialBalance: 100m, overdraftLimit: 0m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        // Realiza 5 tentativas rejeitadas (sem saldo) no período diurno (limite: 5 tentativas/h)
        for (int i = 0; i < 5; i++)
        {
            var tentativaRejeitada = await _transferService.CreateImmediateTransferAsync(
                new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 500m));
            Assert.Equal("Failed", tentativaRejeitada.Status);
            Assert.Contains("Saldo insuficiente", tentativaRejeitada.FailureReason);
        }

        // A 6ª tentativa (mesmo com valor que teria saldo, ex: R$ 50) deve ser bloqueada por excesso de tentativas
        var sextaTentativa = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 50m));

        Assert.Equal("Failed", sextaTentativa.Status);
        Assert.Contains("Limite de tentativas por hora excedido", sextaTentativa.FailureReason);
    }

    [Fact]
    public async Task Cenario7_TransferenciaDurantePeriodoNoturno_DeveAplicarLimiteDeMilReaisETresTentativas()
    {
        _dateTimeProvider.ForceNightPeriod = true;

        var origem = new Account("Origem", "111", initialBalance: 5000m, overdraftLimit: 0m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var acimaDeMilNoturno = await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 1200m));

        Assert.Equal("Failed", acimaDeMilNoturno.Status);
        Assert.Contains("período noturno", acimaDeMilNoturno.FailureReason);
    }

    [Fact]
    public async Task Cenario8_TransferenciaAgendadaSemSaldoNoMomentoDaExecucao_DeveFalharQuandoProcessada()
    {
        var origem = new Account("Origem", "111", initialBalance: 1000m, overdraftLimit: 0m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var agendamento = await _transferService.ScheduleTransferAsync(
            new CreateScheduledTransferRequestDto(
                origem.Id,
                destino.Id,
                800m,
                _dateTimeProvider.UtcNow.AddHours(2)));

        Assert.Equal("Scheduled", agendamento.Status);

        // Gastou o saldo antes do horário agendado
        await _transferService.CreateImmediateTransferAsync(
            new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 700m));

        // Avança o relógio para a hora do agendamento e executa via Worker
        _dateTimeProvider.UtcNow = _dateTimeProvider.UtcNow.AddHours(2).AddMinutes(1);
        var processada = await _transferService.ProcessScheduledTransferAsync(agendamento.Id);

        Assert.Equal("Failed", processada.Status);
        Assert.Contains("Saldo insuficiente", processada.FailureReason);
    }

    [Fact]
    public async Task Cenario9_IdempotenciaECancelamentoDeAgendamento_DevemFuncionarCorretamente()
    {
        var origem = new Account("Origem", "111", initialBalance: 1000m, overdraftLimit: 0m);
        var destino = new Account("Destino", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var req = new CreateImmediateTransferRequestDto(origem.Id, destino.Id, 300m);
        var primeira = await _transferService.CreateImmediateTransferAsync(req, idempotencyKey: "chave-unica-123");
        var duplicada = await _transferService.CreateImmediateTransferAsync(req, idempotencyKey: "chave-unica-123");

        Assert.Equal(primeira.Id, duplicada.Id);
        Assert.Equal(700m, (await _accountRepository.GetByIdAsync(origem.Id))!.Balance);

        var agendada = await _transferService.ScheduleTransferAsync(
            new CreateScheduledTransferRequestDto(origem.Id, destino.Id, 200m, _dateTimeProvider.UtcNow.AddHours(5)));

        var cancelada = await _transferService.CancelScheduledTransferAsync(agendada.Id);
        Assert.Equal("Cancelled", cancelada.Status);

        await Assert.ThrowsAsync<DomainException>(() =>
            _transferService.CancelScheduledTransferAsync(agendada.Id));
    }

    [Fact]
    public async Task Cenario10_DuasTransferenciasSimultaneasUtilizandoMesmoSaldo_DeveImpedirGastoDuploViaConcurrencyToken()
    {
        var origem = new Account("Origem Concorrente", "111", initialBalance: 1000m, overdraftLimit: 0m);
        var destino = new Account("Destino Concorrente", "222", initialBalance: 0m, overdraftLimit: 0m);
        await _accountRepository.AddAsync(origem);
        await _accountRepository.AddAsync(destino);
        await _unitOfWork.SaveChangesAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        await using var context1 = new AppDbContext(options);
        await using var context2 = new AppDbContext(options);

        // Duas requisições simultâneas carregam a mesma conta ao mesmo tempo
        var contaReq1 = (await context1.Accounts.FirstAsync(a => a.Id == origem.Id));
        var contaReq2 = (await context2.Accounts.FirstAsync(a => a.Id == origem.Id));

        // Req 1 debita R$ 1.000 e salva primeiro
        contaReq1.Debit(1000m);
        var uow1 = new UnitOfWork(context1, NullLogger<UnitOfWork>.Instance);
        await uow1.SaveChangesAsync();

        // Req 2 tenta debitar os mesmos R$ 1.000 com o ConcurrencyToken antigo -> deve lançar ConcurrencyConflictException
        contaReq2.Debit(1000m);
        var uow2 = new UnitOfWork(context2, NullLogger<UnitOfWork>.Instance);

        await Assert.ThrowsAsync<ConcurrencyConflictException>(() => uow2.SaveChangesAsync());
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }
}
