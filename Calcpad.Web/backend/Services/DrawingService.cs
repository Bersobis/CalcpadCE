using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Calcpad.Core;

namespace Calcpad.Server.Services
{
    /// <summary>
    /// Failure that carries the HTTP status the endpoint should answer with, so the
    /// controller can pass user mistakes through without guessing.
    /// </summary>
    internal sealed class DrawingServiceException : Exception
    {
        internal int Status { get; }

        internal DrawingServiceException(string message, int status = 400) : base(message) => Status = status;
    }

    /// <summary>
    /// Drawing sidecar (.cdrw) operations behind the editor endpoints: evaluate to SVG,
    /// persist canvas drags, and convert to and from DXF.
    /// </summary>
    internal static class DrawingService
    {
        internal sealed record NodePoint(double X, double Y);

        internal sealed record NodeState(double X, double Y, bool Driven);

        internal sealed record ParseResult(
            string Name,
            string Svg,
            IReadOnlyDictionary<string, NodeState> Nodes,
            IReadOnlyList<string> Warnings);

        internal sealed record ImportResult(string Cdrw, IReadOnlyList<string> Warnings);

        internal sealed record SaveResult(string Path, int Updated);

        private const string SidecarExtension = ".cdrw";

        internal static ParseResult Parse(string? documentPath, string drawingPath)
        {
            var path = Resolve(documentPath, drawingPath);
            var model = Load(path, out var errors);
            var evaluated = DrawingEvaluator.Evaluate(model, Bindings(), isUs: false);

            var nodes = new Dictionary<string, NodeState>(StringComparer.Ordinal);
            foreach (var node in model.Nodes)
            {
                if (!evaluated.Nodes.TryGetValue(node.Id, out var point))
                    continue;
                var driven = !DrawingSvgWriter.IsLiteral(node.XRaw) || !DrawingSvgWriter.IsLiteral(node.YRaw);
                nodes[node.Id] = new NodeState(point.X, point.Y, driven);
            }

            return new ParseResult(
                model.Name,
                DrawingSvgWriter.Write(model, evaluated, drawingPath),
                nodes,
                errors);
        }

        internal static SaveResult Save(
            string? documentPath,
            string drawingPath,
            IReadOnlyDictionary<string, NodePoint> nodes)
        {
            var path = Resolve(documentPath, drawingPath);
            var model = Load(path, out _);

            var known = new HashSet<string>(StringComparer.Ordinal);
            foreach (var node in model.Nodes)
                known.Add(node.Id);

            var updated = new List<DrawingNode>();
            var unknown = new List<string>();
            foreach (var node in model.Nodes)
            {
                if (!nodes.TryGetValue(node.Id, out var point))
                {
                    updated.Add(node);
                    continue;
                }
                updated.Add(new DrawingNode(node.Id, Literal(point.X), Literal(point.Y)));
            }

            foreach (var id in nodes.Keys)
                if (!known.Contains(id))
                    unknown.Add(id);

            if (unknown.Count > 0)
                throw new DrawingServiceException(
                    $"Unknown drawing node(s): {string.Join(", ", unknown)}.", 404);

            var next = model with { Nodes = updated };
            File.WriteAllText(path, DrawingWriter.Write(next));
            return new SaveResult(path, nodes.Count);
        }

        internal static byte[] ExportDxf(string? documentPath, string drawingPath)
        {
            var path = Resolve(documentPath, drawingPath);
            var model = Load(path, out _);
            var evaluated = DrawingEvaluator.Evaluate(model, Bindings(), isUs: false);
            return DrawingDxfWriter.Write(model, evaluated);
        }

        internal static ImportResult ImportDxf(Stream dxf)
        {
            var (model, warnings) = DrawingDxfReader.Read(dxf);
            return new ImportResult(DrawingWriter.Write(model), warnings);
        }

        /// <summary>
        /// Resolves the worksheet-relative sidecar reference and refuses anything that is
        /// not a .cdrw inside the document's directory.
        /// </summary>
        internal static string Resolve(string? documentPath, string drawingPath)
        {
            if (string.IsNullOrWhiteSpace(drawingPath))
                throw new DrawingServiceException("A drawing path is required.");

            drawingPath = drawingPath.Trim().Trim('"');
            if (!drawingPath.EndsWith(SidecarExtension, StringComparison.OrdinalIgnoreCase))
                throw new DrawingServiceException("A drawing must be a .cdrw sidecar.");

            var baseDirectory = string.IsNullOrEmpty(documentPath)
                ? null
                : Path.GetDirectoryName(Path.GetFullPath(documentPath));

            if (Path.IsPathRooted(drawingPath) || baseDirectory is null)
                return Path.GetFullPath(drawingPath);

            var full = Path.GetFullPath(Path.Combine(baseDirectory, drawingPath));
            var relative = Path.GetRelativePath(baseDirectory, full);
            if (Path.IsPathRooted(relative) || relative.StartsWith("..", StringComparison.Ordinal))
                throw new DrawingServiceException("The drawing path must stay inside the worksheet's directory.", 403);

            return full;
        }

        private static DrawingModel Load(string path, out IReadOnlyList<string> errors)
        {
            if (!File.Exists(path))
                throw new DrawingServiceException($"Drawing sidecar '{Path.GetFileName(path)}' not found.", 404);

            var model = DrawingReader.Parse(File.ReadAllText(path), out errors);
            if (errors.Count > 0)
                throw new DrawingServiceException(
                    $"Drawing sidecar '{Path.GetFileName(path)}' has {errors.Count} error(s): {errors[0]}");
            return model;
        }

        private static Dictionary<string, (double Value, Unit Units)> Bindings() => new(StringComparer.Ordinal);

        private static string Literal(double value) =>
            value.ToString("0.###", CultureInfo.InvariantCulture);
    }
}
