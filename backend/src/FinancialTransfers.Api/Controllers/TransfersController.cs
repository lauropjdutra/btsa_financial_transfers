using FinancialTransfers.Application.DTOs;
using FinancialTransfers.Application.Services;
using FinancialTransfers.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace FinancialTransfers.Api.Controllers;

[ApiController]
[Route("api/transfers")]
public class TransfersController : ControllerBase
{
    private readonly ITransferService _transferService;

    public TransfersController(ITransferService transferService)
    {
        _transferService = transferService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TransferResponseDto>>> GetAll(
        [FromQuery] Guid? accountId,
        CancellationToken cancellationToken)
    {
        var transfers = await _transferService.GetAllAsync(accountId, cancellationToken);
        return Ok(transfers);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TransferResponseDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var transfer = await _transferService.GetByIdAsync(id, cancellationToken);
        return Ok(transfer);
    }

    [HttpPost]
    public async Task<ActionResult<TransferResponseDto>> CreateImmediate(
        [FromBody] CreateImmediateTransferRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await _transferService.CreateImmediateTransferAsync(request, idempotencyKey, cancellationToken);

        if (result.Status == TransferStatus.Failed.ToString())
        {
            return UnprocessableEntity(result);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("scheduled")]
    public async Task<ActionResult<TransferResponseDto>> Schedule(
        [FromBody] CreateScheduledTransferRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await _transferService.ScheduleTransferAsync(request, idempotencyKey, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<TransferResponseDto>> CancelScheduled(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _transferService.CancelScheduledTransferAsync(id, cancellationToken);
        return Ok(result);
    }
}
