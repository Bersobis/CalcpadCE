using System;
using System.Collections.Generic;

namespace Calcpad.Core
{
    internal sealed record DrawingInput(string Name, string DefaultRaw, string UnitText, string? Comment);
    internal sealed record DrawingNode(string Id, string XRaw, string YRaw);
    internal sealed record DrawingMember(string Id, string NodeA, string NodeB, string Group);
    internal sealed record DrawingCallout(string Group, string Label, string State);
    internal sealed record DrawingDimension(string NodeA, string NodeB, string Align, string TextPattern);
    internal sealed record DrawingStyle(string Name, string Stroke, double Width);
    internal sealed record DrawingView(string? Title, string? Subtitle, string? Units, IReadOnlyList<string>? Supports);

    internal sealed record DrawingModel(
        string Name,
        IReadOnlyList<DrawingInput> Inputs,
        IReadOnlyList<DrawingNode> Nodes,
        IReadOnlyList<DrawingMember> Members,
        IReadOnlyList<DrawingCallout> Annotations,
        IReadOnlyList<DrawingDimension> Dimensions,
        IReadOnlyList<DrawingStyle> Styles,
        DrawingView View);
}
