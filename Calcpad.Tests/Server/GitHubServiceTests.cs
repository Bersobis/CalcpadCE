#nullable enable
using System.Net;
using System.Text;
using Calcpad.Server.Services;

namespace Calcpad.Tests;

public class GitHubServiceTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastBody { get; private set; }
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        public string JsonBody { get; set; } = "{}";

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(Status)
            {
                Content = new StringContent(JsonBody, Encoding.UTF8, "application/json"),
            };
        }
    }

    private static (GitHubService Service, FakeHandler Handler) Create(string? token = "test-token")
    {
        var handler = new FakeHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.github.com/") };
        return (new GitHubService(http, token), handler);
    }

    [Fact]
    public async Task NoToken_ReportsUnconfigured_AndFailsWith503()
    {
        var (service, _) = Create(token: null);
        Assert.False(service.IsConfigured);

        var result = await service.GetFileAsync("o", "r", "a.cpd");
        Assert.False(result.Success);
        Assert.Equal(503, result.StatusCode);
        Assert.Contains("GITHUB_TOKEN", result.Error);
    }

    [Fact]
    public async Task GetFile_SendsBearerAuth_AndDecodesBase64Content()
    {
        var (service, handler) = Create();
        var plain = "# Title\na = 1\n";
        handler.JsonBody =
            $"{{\"name\":\"a.cpd\",\"path\":\"inc/a.cpd\",\"sha\":\"abc123\",\"size\":{plain.Length}," +
            $"\"encoding\":\"base64\",\"content\":\"{Convert.ToBase64String(Encoding.UTF8.GetBytes(plain))}\"}}";

        var result = await service.GetFileAsync("imartincei", "CalcpadCE", "inc/a.cpd", "main");

        Assert.True(result.Success);
        Assert.Equal(plain, result.Value!.Content);
        Assert.Equal("abc123", result.Value.Sha);

        var auth = handler.LastRequest!.Headers.Authorization;
        Assert.Equal("Bearer", auth!.Scheme);
        Assert.Equal("test-token", auth.Parameter);
        Assert.Equal("CalcpadCE", handler.LastRequest.Headers.UserAgent.ToString());
        Assert.Equal(
            "/repos/imartincei/CalcpadCE/contents/inc/a.cpd?ref=main",
            handler.LastRequest.RequestUri!.PathAndQuery);
    }

    [Fact]
    public async Task ListDirectory_ParsesEntries()
    {
        var (service, handler) = Create();
        handler.JsonBody = "[{\"name\":\"Examples\",\"path\":\"Examples\",\"type\":\"dir\",\"size\":0,\"sha\":\"d1\"}," +
                           "{\"name\":\"x.cpd\",\"path\":\"x.cpd\",\"type\":\"file\",\"size\":9,\"sha\":\"f1\"}]";

        var result = await service.ListDirectoryAsync("o", "r", "");

        Assert.True(result.Success);
        Assert.Equal(2, result.Value!.Count);
        Assert.Equal("dir", result.Value[0].Type);
        Assert.Equal("file", result.Value[1].Type);
    }

    [Fact]
    public async Task GetIssues_FiltersOutPullRequests()
    {
        var (service, handler) = Create();
        handler.JsonBody = "[" +
            "{\"number\":1,\"title\":\"Real issue\",\"state\":\"open\",\"html_url\":\"u1\"," +
            "\"created_at\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-02T00:00:00Z\",\"labels\":[{\"name\":\"bug\"}]}," +
            "{\"number\":2,\"title\":\"A PR\",\"state\":\"open\",\"html_url\":\"u2\"," +
            "\"created_at\":\"2026-01-01T00:00:00Z\",\"updated_at\":\"2026-01-02T00:00:00Z\",\"labels\":[]," +
            "\"pull_request\":{\"url\":\"pr\"}}]";

        var result = await service.GetIssuesAsync("o", "r");

        Assert.True(result.Success);
        var issue = Assert.Single(result.Value!);
        Assert.Equal(1, issue.Number);
        Assert.Equal("bug", Assert.Single(issue.Labels));
        Assert.Contains("state=open", handler.LastRequest!.RequestUri!.Query);
    }

    [Fact]
    public async Task CommitFile_SendsBase64Body_WithShaAndBranch()
    {
        var (service, handler) = Create();
        handler.JsonBody = "{\"content\":{\"sha\":\"new-blob\"},\"commit\":{\"sha\":\"deadbeef\",\"html_url\":\"https://c\"}}";

        var result = await service.CommitFileAsync("o", "r", "dir/a.cpd", "Update", "x = 2", "old-sha", "main");

        Assert.True(result.Success);
        Assert.Equal("new-blob", result.Value!.ContentSha);
        Assert.Equal("deadbeef", result.Value.CommitSha);

        Assert.Equal(HttpMethod.Put, handler.LastRequest!.Method);
        Assert.Equal("/repos/o/r/contents/dir/a.cpd", handler.LastRequest.RequestUri!.AbsolutePath);
        Assert.Contains("\"sha\":\"old-sha\"", handler.LastBody);
        Assert.Contains("\"branch\":\"main\"", handler.LastBody);
        var expected = Convert.ToBase64String(Encoding.UTF8.GetBytes("x = 2"));
        Assert.Contains($"\"content\":\"{expected}\"", handler.LastBody);
    }

    [Fact]
    public async Task GitHubError_PassesUpStatusAndMessage()
    {
        var (service, handler) = Create();
        handler.Status = HttpStatusCode.NotFound;
        handler.JsonBody = "{\"message\":\"Not Found\"}";

        var result = await service.GetFileAsync("o", "missing", "a.cpd");

        Assert.False(result.Success);
        Assert.Equal(404, result.StatusCode);
        Assert.Equal("Not Found", result.Error);
    }

    [Fact]
    public async Task UnexpectedPayload_Reports422()
    {
        var (service, handler) = Create();
        handler.JsonBody = "{\"name\":\"a.cpd\",\"encoding\":\"none\",\"content\":\"\"}";

        var result = await service.GetFileAsync("o", "r", "a.cpd");

        Assert.False(result.Success);
        Assert.Equal(422, result.StatusCode);
    }
}
