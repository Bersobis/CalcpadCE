using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Calcpad.Server.Services
{
    /// <summary>
    /// Server-side proxy for the GitHub REST API. <c>GITHUB_TOKEN</c> is read here and never
    /// sent to clients — the frontend only ever calls <c>/api/github/*</c> on this server.
    /// </summary>
    public class GitHubService
    {
        public const string TokenEnvVar = "GITHUB_TOKEN";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        };

        private readonly HttpClient _http;
        private readonly string? _token;

        public GitHubService()
            : this(CreateHttpClient(), Environment.GetEnvironmentVariable(TokenEnvVar))
        {
        }

        /// <summary>Test seam: inject the transport and token directly.</summary>
        public GitHubService(HttpClient http, string? token)
        {
            _http = http;
            _token = string.IsNullOrWhiteSpace(token) ? null : token.Trim();
        }

        public bool IsConfigured => _token != null;

        private static HttpClient CreateHttpClient() => new()
        {
            BaseAddress = new Uri("https://api.github.com/"),
            Timeout = TimeSpan.FromSeconds(30),
        };

        public async Task<GitHubResult<GitHubFile>> GetFileAsync(
            string owner, string repo, string path, string? gitRef = null, CancellationToken ct = default)
        {
            if (!IsConfigured) return NotConfigured<GitHubFile>();
            using var request = Request(HttpMethod.Get, ContentsUrl(owner, repo, path, gitRef));
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return await Fail<GitHubFile>(response);

            var dto = await ReadAs<GitHubContentDto>(response, ct);
            if (dto is null)
                return GitHubResult<GitHubFile>.Fail(422, "GitHub returned an unexpected file payload.");
            if (!string.Equals(dto.Encoding, "base64", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(dto.Content))
                return GitHubResult<GitHubFile>.Fail(422, "File is empty or too large for the GitHub contents API (1 MB limit).");

            return GitHubResult<GitHubFile>.Ok(new GitHubFile
            {
                Name = dto.Name ?? path,
                Path = dto.Path ?? path,
                Sha = dto.Sha ?? "",
                Size = dto.Size,
                Content = Encoding.UTF8.GetString(Convert.FromBase64String(dto.Content)),
            });
        }

        public async Task<GitHubResult<IReadOnlyList<GitHubDirectoryEntry>>> ListDirectoryAsync(
            string owner, string repo, string path, string? gitRef = null, CancellationToken ct = default)
        {
            if (!IsConfigured) return NotConfigured<IReadOnlyList<GitHubDirectoryEntry>>();
            using var request = Request(HttpMethod.Get, ContentsUrl(owner, repo, path, gitRef));
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return await Fail<IReadOnlyList<GitHubDirectoryEntry>>(response);

            var json = await response.Content.ReadAsStringAsync(ct);
            List<GitHubContentDto>? entries;
            try
            {
                entries = JsonSerializer.Deserialize<List<GitHubContentDto>>(json, JsonOptions);
            }
            catch (JsonException)
            {
                return GitHubResult<IReadOnlyList<GitHubDirectoryEntry>>.Fail(422, "Path is not a directory.");
            }
            if (entries is null)
                return GitHubResult<IReadOnlyList<GitHubDirectoryEntry>>.Fail(422, "GitHub returned an unexpected listing.");

            return GitHubResult<IReadOnlyList<GitHubDirectoryEntry>>.Ok(entries.Select(e => new GitHubDirectoryEntry
            {
                Name = e.Name ?? "",
                Path = e.Path ?? "",
                Type = e.Type ?? "file",
                Size = e.Size,
                Sha = e.Sha ?? "",
            }).ToList());
        }

        public async Task<GitHubResult<IReadOnlyList<GitHubIssue>>> GetIssuesAsync(
            string owner, string repo, string state = "open", CancellationToken ct = default)
        {
            if (!IsConfigured) return NotConfigured<IReadOnlyList<GitHubIssue>>();
            using var request = Request(HttpMethod.Get, $"repos/{Escape(owner)}/issues?state={Escape(state)}&per_page=50");
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return await Fail<IReadOnlyList<GitHubIssue>>(response);

            var dtos = await ReadAs<List<GitHubIssueDto>>(response, ct);
            if (dtos is null)
                return GitHubResult<IReadOnlyList<GitHubIssue>>.Fail(422, "GitHub returned an unexpected issue list.");

            // The issues API also returns pull requests; they carry a pull_request property.
            var issues = dtos.Where(i => i.PullRequest is null).Select(i => new GitHubIssue
            {
                Number = i.Number,
                Title = i.Title,
                State = i.State,
                HtmlUrl = i.HtmlUrl,
                CreatedAt = i.CreatedAt,
                UpdatedAt = i.UpdatedAt,
                Labels = i.Labels?.Select(l => l.Name).ToList() ?? [],
            }).ToList();
            return GitHubResult<IReadOnlyList<GitHubIssue>>.Ok(issues);
        }

        public async Task<GitHubResult<GitHubCommit>> CommitFileAsync(
            string owner, string repo, string path, string message, string content, string? sha = null,
            string? branch = null, CancellationToken ct = default)
        {
            if (!IsConfigured) return NotConfigured<GitHubCommit>();
            var payload = new Dictionary<string, string>
            {
                ["message"] = message,
                ["content"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(content)),
            };
            if (!string.IsNullOrEmpty(sha)) payload["sha"] = sha;
            if (!string.IsNullOrEmpty(branch)) payload["branch"] = branch;

            using var request = Request(HttpMethod.Put, $"repos/{Escape(owner)}/{Escape(repo)}/contents/{PathSegments(path)}");
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return await Fail<GitHubCommit>(response);

            var dto = await ReadAs<GitHubCommitResponseDto>(response, ct);
            if (dto?.Content is null || dto.Commit is null)
                return GitHubResult<GitHubCommit>.Fail(422, "GitHub returned an unexpected commit payload.");

            return GitHubResult<GitHubCommit>.Ok(new GitHubCommit
            {
                ContentSha = dto.Content.Sha,
                CommitSha = dto.Commit.Sha,
                HtmlUrl = dto.Commit.HtmlUrl ?? "",
            });
        }

        private HttpRequestMessage Request(HttpMethod method, string url)
        {
            var request = new HttpRequestMessage(method, url);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            request.Headers.UserAgent.ParseAdd("CalcpadCE");
            request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
            if (_token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
            return request;
        }

        private string ContentsUrl(string owner, string repo, string path, string? gitRef)
        {
            var url = $"repos/{Escape(owner)}/{Escape(repo)}/contents/{PathSegments(path)}";
            return string.IsNullOrEmpty(gitRef) ? url : $"{url}?ref={Escape(gitRef)}";
        }

        private static string PathSegments(string path) =>
            string.Join('/', path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));

        private static string Escape(string value) => Uri.EscapeDataString(value);

        private static GitHubResult<T> NotConfigured<T>() => GitHubResult<T>.Fail(
            503, $"{TokenEnvVar} is not set on the Calcpad server — GitHub integration is disabled.");

        private static async Task<GitHubResult<T>> Fail<T>(HttpResponseMessage response)
        {
            string? message = null;
            try
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (doc.RootElement.TryGetProperty("message", out var m)) message = m.GetString();
            }
            catch (JsonException) { /* body was not JSON; status alone will do */ }
            return GitHubResult<T>.Fail(
                (int)response.StatusCode, message ?? $"GitHub returned {(int)response.StatusCode}.");
        }

        private static async Task<T?> ReadAs<T>(HttpResponseMessage response, CancellationToken ct) where T : class
        {
            try
            {
                return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
            }
            catch (JsonException)
            {
                return null;
            }
        }
    }

    public sealed class GitHubResult<T>
    {
        public T? Value { get; init; }
        public int StatusCode { get; init; } = 200;
        public string? Error { get; init; }
        public bool Success => Error is null;

        public static GitHubResult<T> Ok(T value) => new() { Value = value };
        public static GitHubResult<T> Fail(int statusCode, string error) => new()
        {
            StatusCode = statusCode,
            Error = error,
        };
    }

    public class GitHubFile
    {
        public string Name { get; init; } = "";
        public string Path { get; init; } = "";
        public string Sha { get; init; } = "";
        public long Size { get; init; }
        public string Content { get; init; } = "";
    }

    public class GitHubDirectoryEntry
    {
        public string Name { get; init; } = "";
        public string Path { get; init; } = "";
        public string Type { get; init; } = "file";
        public long Size { get; init; }
        public string Sha { get; init; } = "";
    }

    public class GitHubIssue
    {
        public int Number { get; init; }
        public string Title { get; init; } = "";
        public string State { get; init; } = "";
        public string HtmlUrl { get; init; } = "";
        public DateTimeOffset CreatedAt { get; init; }
        public DateTimeOffset UpdatedAt { get; init; }
        public List<string> Labels { get; init; } = [];
    }

    public class GitHubCommit
    {
        public string ContentSha { get; init; } = "";
        public string CommitSha { get; init; } = "";
        public string HtmlUrl { get; init; } = "";
    }

    internal sealed class GitHubContentDto
    {
        public string? Name { get; set; }
        public string? Path { get; set; }
        public string? Sha { get; set; }
        public long Size { get; set; }
        public string? Type { get; set; }
        public string? Encoding { get; set; }
        public string? Content { get; set; }
    }

    internal sealed class GitHubIssueDto
    {
        public int Number { get; set; }
        public string Title { get; set; } = "";
        public string State { get; set; } = "";
        public string HtmlUrl { get; set; } = "";
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public List<GitHubLabelDto>? Labels { get; set; }
        public JsonElement? PullRequest { get; set; }
    }

    internal sealed class GitHubLabelDto
    {
        public string Name { get; set; } = "";
    }

    internal sealed class GitHubCommitResponseDto
    {
        public GitHubShaDto? Content { get; set; }
        public GitHubShaDto? Commit { get; set; }
    }

    internal sealed class GitHubShaDto
    {
        public string Sha { get; set; } = "";
        public string? HtmlUrl { get; set; }
    }
}
