using FinancialTransfers.Application.DTOs;
using FinancialTransfers.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace FinancialTransfers.Api.Controllers;

[ApiController]
[Route("api/accounts")]
public class AccountsController : ControllerBase
{
    private readonly IAccountService _accountService;

    public AccountsController(IAccountService accountService)
    {
        _accountService = accountService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var accounts = await _accountService.GetAllAsync(cancellationToken);
        return Ok(accounts);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AccountResponseDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var account = await _accountService.GetByIdAsync(id, cancellationToken);
        return Ok(account);
    }

    [HttpPost]
    public async Task<ActionResult<AccountResponseDto>> Create(
        [FromBody] CreateAccountRequestDto request,
        CancellationToken cancellationToken)
    {
        var created = await _accountService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPatch("{id:guid}/configuration")]
    public async Task<ActionResult<AccountResponseDto>> UpdateConfiguration(
        Guid id,
        [FromBody] UpdateAccountConfigRequestDto request,
        CancellationToken cancellationToken)
    {
        var updated = await _accountService.UpdateConfigurationAsync(id, request, cancellationToken);
        return Ok(updated);
    }
}
