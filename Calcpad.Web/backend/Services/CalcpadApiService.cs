using System.Text;
using Calcpad.Server.Data;
using Calcpad.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Calcpad.Server.Services
{
    /// <summary>
    /// Shared service for configuring and running the Calcpad API server
    /// </summary>
    public static class CalcpadApiService
    {
        private static bool _authEnabled;

        /// <summary>
        /// Configure the web application builder with all necessary services
        /// </summary>
        public static WebApplicationBuilder ConfigureBuilder(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container
            builder.Services.AddControllers()
                .AddApplicationPart(typeof(CalcpadApiService).Assembly);
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddScoped<CalcpadService>();

            // PDF generation service (singleton for browser reuse)
            builder.Services.AddSingleton<PdfGeneratorService>();

            // Disk cache cleanup (removes .cache files older than 24 hours)
            builder.Services.AddHostedService<DiskCacheCleanupService>();

            // Auth subsystem (optional — enable with Auth:Enabled=true)
            _authEnabled = string.Equals(
                builder.Configuration["Auth:Enabled"], "true",
                StringComparison.OrdinalIgnoreCase);

            if (_authEnabled)
            {
                var dbPath = builder.Configuration["Auth:DatabasePath"] ?? "data/users.db";
                builder.Services.AddDbContext<CalcpadAuthDbContext>(options =>
                    options.UseSqlite($"Data Source={dbPath}"));

                builder.Services.AddScoped<AuthService>();

                var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "default-secret-key-minimum-32-characters";
                builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                    .AddJwtBearer(options =>
                    {
                        options.TokenValidationParameters = new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidateAudience = true,
                            ValidateLifetime = true,
                            ValidateIssuerSigningKey = true,
                            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "CalcpadAuth",
                            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "CalcpadAuthClient",
                            IssuerSigningKey = new SymmetricSecurityKey(
                                Encoding.UTF8.GetBytes(jwtSecret))
                        };
                    });

                builder.Services.AddAuthorization(options =>
                {
                    options.AddPolicy("AdminOnly", policy =>
                        policy.RequireClaim("role", "3"));
                    options.AddPolicy("ContributorOrAbove", policy =>
                        policy.RequireClaim("role", "2", "3"));
                });

                FileLogger.LogInfo("Auth subsystem enabled");
            }
            else
            {
                FileLogger.LogInfo("Auth subsystem disabled (set Auth:Enabled=true to enable)");
            }

            // Add CORS policy
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                });
            });

            return builder;
        }

        /// <summary>
        /// Configure the web application pipeline
        /// </summary>
        public static WebApplication ConfigureApp(WebApplication app)
        {
            // Add global exception handler
            app.Use(async (context, next) =>
            {
                try
                {
                    await next();
                }
                catch (Exception ex)
                {
                    FileLogger.LogError($"Unhandled exception in request: {context.Request.Method} {context.Request.Path}", ex);
                    context.Response.StatusCode = 500;
                    await context.Response.WriteAsync("Internal Server Error");
                }
            });

            // Configure the HTTP request pipeline
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseCors("AllowAll");

            if (_authEnabled)
            {
                app.UseAuthentication();
                app.UseAuthorization();
            }

            app.MapControllers();

            if (_authEnabled)
            {
                // Ensure auth database exists
                using (var scope = app.Services.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<CalcpadAuthDbContext>();
                    db.Database.EnsureCreated();
                }
            }

            return app;
        }

        /// <summary>
        /// Get the server URL from environment variables
        /// </summary>
        public static string GetServerUrl()
        {
            var port = Environment.GetEnvironmentVariable("CALCPAD_PORT") ?? "9420";
            var host = Environment.GetEnvironmentVariable("CALCPAD_HOST") ?? "localhost";
            var protocol = Environment.GetEnvironmentVariable("CALCPAD_ENABLE_HTTPS")?.ToLower() == "true" ? "https" : "http";

            // Handle Docker scenario where host might be *
            if (host == "*")
            {
                host = "0.0.0.0"; // Bind to all interfaces in Docker
            }

            return $"{protocol}://{host}:{port}";
        }

        /// <summary>
        /// Test if the server is responding at the given URL
        /// </summary>
        public static async Task<bool> TestServerAsync(string serverUrl, int timeoutSeconds = 3)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
                var response = await httpClient.GetAsync($"{serverUrl}/api/calcpad/sample");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Create a configured web application ready to run
        /// </summary>
        public static (WebApplication app, string serverUrl) CreateConfiguredApp(string[] args)
        {
            var builder = ConfigureBuilder(args);

            // Check if --urls was passed on the command line (used by bundled server manager)
            string? cliUrls = null;
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--urls")
                {
                    cliUrls = args[i + 1];
                    break;
                }
            }

            var serverUrl = cliUrls ?? GetServerUrl();

            FileLogger.LogInfo("Configuring server URLs", serverUrl);
            builder.WebHost.UseUrls(serverUrl);

            FileLogger.LogInfo("Building application");
            var app = builder.Build();

            ConfigureApp(app);

            return (app, serverUrl);
        }
    }
}
