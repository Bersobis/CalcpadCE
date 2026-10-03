using Calcpad.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Calcpad.Server.Controllers
{
    /// <summary>
    /// Local proxy to the GitHub REST API so <c>GITHUB_TOKEN</c> never reaches the browser.
    /// Returns the upstream status code for GitHub failures, with GitHub's message in
    /// <c>error</c>.
    /// </summary>
    [ApiController]
    [Route("api/github")]
    public class GitHubController : ControllerBase
    {
        private readonly GitHubService _gitHubService;

        public GitHubController(GitHubService gitHubService)
        {
            _gitHubService = gitHubService;
        }

        /// <summary>Whether the server has a token; clients hide GitHub UI when false.</summary>
        [HttpGet("status")]
        public IActionResult Status() => Ok(new { configured = _gitHubService.IsConfigured });

        /// <summary>File content plus its blob <c>sha</c>, needed to commit an update.</summary>
        [HttpGet("file")]
        public async Task<IActionResult> GetFile(
            [FromQuery] string owner, [FromQuery] string repo, [FromQuery] string path,
            [FromQuery(Name = "ref")] string? gitRef, CancellationToken cancellationToken)
        {
            var result = await _gitHubService.GetFileAsync(owner, repo, path, gitRef, cancellationToken);
            return ToActionResult(result);
        }

        /// <summary>Directory listing for browsing a repository from the Files tab.</summary>
        [HttpGet("contents")]
        public async Task<IActionResult> GetContents(
            [FromQuery] string owner, [FromQuery] string repo, [FromQuery] string path,
            [FromQuery(Name = "ref")] string? gitRef, CancellationToken cancellationToken)
        {
            var result = await _gitHubService.ListDirectoryAsync(owner, repo, path, gitRef, cancellationToken);
            return ToActionResult(result);
        }

        [HttpGet("issues")]
        public async Task<IActionResult> GetIssues(
            [FromQuery] string owner, [FromQuery] string repo,
            [FromQuery] string state = "open", CancellationToken cancellationToken = default)
        {
            var result = await _gitHubService.GetIssuesAsync(owner, repo, state, cancellationToken);
            return ToActionResult(result);
        }

        /// <summary>Creates or updates a file through the contents API.</summary>
        [HttpPost("commit")]
        public async Task<IActionResult> Commit(
            [FromBody] GitHubCommitRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Owner) || string.IsNullOrWhiteSpace(request.Repo)
                || string.IsNullOrWhiteSpace(request.Path) || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "owner, repo, path and message are required." });
            }

            var result = await _gitHubService.CommitFileAsync(
                request.Owner, request.Repo, request.Path, request.Message, request.Content ?? "",
                request.Sha, request.Branch, cancellationToken);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult<T>(GitHubResult<T> result) =>
            result.Success ? Ok(result.Value) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    public class GitHubCommitRequest
    {
        public string Owner { get; set; } = "";
        public string Repo { get; set; } = "";
        public string Path { get; set; } = "";
        public string Message { get; set; } = "";
        public string? Content { get; set; }
        /// <summary>Blob sha of the version being replaced; omit to create the file.</summary>
        public string? Sha { get; set; }
        public string? Branch { get; set; }
    }
}
