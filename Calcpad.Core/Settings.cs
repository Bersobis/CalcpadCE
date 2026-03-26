using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace Calcpad.Core
{
    [Serializable()]
    public class Settings
    {
        public MathSettings Math { get; set; } = new();
        public PlotSettings Plot { get; set; } = new();
        public string Units { get; set; } = "m";

        /// <summary>
        /// Client-side file cache for resolving #include and #read when
        /// the target is not a local filesystem path. The Web layer
        /// pre-populates this with fetched content or error entries.
        /// </summary>
        public ClientFileCache ClientFileCache { get; set; }

        /// <summary>
        /// Full path of the source file being processed. Used to resolve
        /// relative #include and #read paths on the server, where the CWD
        /// differs from the client's working directory.
        /// </summary>
        public string SourceFilePath { get; set; }

        /// <summary>
        /// When true, #UI keywords inject interactive input elements into the HTML output.
        /// </summary>
        public bool EnableUi { get; set; }

        /// <summary>
        /// Maps variable names to override values for UI input fields.
        /// When a #UI-annotated variable has an entry here, the override value
        /// is used instead of the value defined in the source.
        /// </summary>
        public Dictionary<string, string> UiOverrides { get; set; }
    }

    /// <summary>
    /// Cache of file contents using parallel arrays. Index positions match
    /// across Filenames, Contents, Errors, and DiskGuids.
    /// Entries larger than 1 MB are offloaded to disk when DiskCacheFolder is set.
    /// </summary>
    [Serializable()]
    public class ClientFileCache
    {
        private const int DiskThresholdBytes = 1_048_576; // 1 MB
        private const string CacheFileExtension = ".cache";

        public string[] Filenames { get; set; } = Array.Empty<string>();
        public byte[][] Contents { get; set; } = Array.Empty<byte[]>();
        public string[] Errors { get; set; } = Array.Empty<string>();
        public string[] DiskGuids { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Path to the folder where large cache entries are stored on disk.
        /// When null, all entries stay in memory (desktop/CLI behavior).
        /// </summary>
        public string DiskCacheFolder { get; set; }

        /// <summary>
        /// Delegate invoked to re-fetch content when a disk-cached file
        /// has been cleaned up. Set by the server layer.
        /// </summary>
        [field: NonSerialized]
        public Func<string, byte[]> RefetchDelegate { get; set; }

        private int IndexOf(string filename) =>
            Array.FindIndex(Filenames, f => string.Equals(f, filename, StringComparison.OrdinalIgnoreCase));

        public bool TryGetContent(string filename, out string content)
        {
            content = null;
            if (!TryGetBytes(filename, out var bytes))
                return false;
            content = Encoding.UTF8.GetString(bytes);
            return true;
        }

        /// <summary>
        /// Tries <paramref name="primaryKey"/> first, then <paramref name="fallbackKey"/>.
        /// </summary>
        public bool TryGetContentMultiKey(string primaryKey, string fallbackKey, out string content)
        {
            return TryGetContent(primaryKey, out content) ||
                   (fallbackKey != null && TryGetContent(fallbackKey, out content));
        }

        public bool TryGetBytes(string filename, out byte[] bytes)
        {
            bytes = null;
            var idx = IndexOf(filename);
            if (idx < 0)
                return false;

            // In-memory entry
            if (Contents[idx] != null)
            {
                bytes = Contents[idx];
                return true;
            }

            // Disk-backed entry
            if (DiskGuids[idx] != null && DiskCacheFolder != null)
            {
                var path = Path.Combine(DiskCacheFolder, DiskGuids[idx] + CacheFileExtension);
                if (File.Exists(path))
                {
                    bytes = File.ReadAllBytes(path);
                    try { File.SetLastWriteTimeUtc(path, DateTime.UtcNow); } catch (IOException) { } catch (UnauthorizedAccessException) { }
                    return true;
                }

                // File was cleaned up — try to re-fetch
                if (RefetchDelegate != null)
                {
                    try
                    {
                        bytes = RefetchDelegate(filename);
                        if (bytes != null)
                        {
                            WriteToDisk(idx, bytes);
                            return true;
                        }
                    }
                    catch { }
                }
            }

            return false;
        }

        public bool TryGetError(string filename, out string error)
        {
            error = null;
            var idx = IndexOf(filename);
            if (idx < 0)
                return false;
            error = Errors[idx];
            return error != null;
        }

        /// <summary>
        /// Tries <paramref name="primaryKey"/> first, then <paramref name="fallbackKey"/>.
        /// </summary>
        public bool TryGetErrorMultiKey(string primaryKey, string fallbackKey, out string error)
        {
            return TryGetError(primaryKey, out error) ||
                   (fallbackKey != null && TryGetError(fallbackKey, out error));
        }

        /// <summary>
        /// Adds an entry, offloading to disk if content exceeds 1 MB and DiskCacheFolder is set.
        /// </summary>
        public void AddEntry(string filename, byte[] content, string error)
        {
            byte[] contentEntry;
            string guidEntry;

            if (content != null && content.Length > DiskThresholdBytes && DiskCacheFolder != null)
            {
                guidEntry = WriteToDiskNewGuid(content);
                contentEntry = null;
            }
            else
            {
                guidEntry = null;
                contentEntry = content;
            }

            Filenames = [.. Filenames, filename];
            Contents = [.. Contents, contentEntry];
            Errors = [.. Errors, error];
            DiskGuids = [.. DiskGuids, guidEntry];
        }

        private string WriteToDiskNewGuid(byte[] bytes)
        {
            var guid = Guid.NewGuid().ToString("N");
            var path = Path.Combine(DiskCacheFolder, guid + CacheFileExtension);
            Directory.CreateDirectory(DiskCacheFolder);
            File.WriteAllBytes(path, bytes);
            return guid;
        }

        private void WriteToDisk(int index, byte[] bytes)
        {
            DiskGuids[index] = WriteToDiskNewGuid(bytes);
        }
    }

    [Serializable()]
    public class MathSettings
    {
        private int _decimals;
        private int _maxOutputCount;
        public int Decimals
        {
            get => _decimals;
            set
            {
                _decimals = value switch
                {
                    <= 0 => 0,
                    >= 15 => 15,
                    _ => value
                };
            }
        }
        public int Degrees { get; set; }
        public bool IsComplex { get; set; }
        public bool Substitute { get; set; }
        public bool FormatEquations { get; set; }
        public bool ZeroSmallMatrixElements { get; set; }
        public int MaxOutputCount
        {
            get => _maxOutputCount;
            set
            {
                _maxOutputCount = value switch
                {
                    <= 5 => 5,
                    >= 100 => 100,
                    _ => value
                };
            }
        }
        public string FormatString { get; set; }

        public MathSettings()
        {
            Decimals = 2;
            Degrees = 0;
            IsComplex = false;
            Substitute = true;
            FormatEquations = true;
            ZeroSmallMatrixElements = true;
            MaxOutputCount = 20;
        }
    }

    [Serializable()]
    public class PlotSettings
    {
        private bool _shadows;
        public bool IsAdaptive { get; set; }
        public double ScreenScaleFactor { get; set; } = 2.0;
        public string ImagePath { get; set; }
        public string ImageUri { get; set; }
        public bool VectorGraphics { get; set; }
        public ColorScales ColorScale { get; set; }
        public bool SmoothScale { get; set; }
        public bool Shadows
        {
            set => _shadows = value;
            get => _shadows && ColorScale != ColorScales.Gray || ColorScale == ColorScales.None;
        }
        public LightDirections LightDirection { get; set; }

        public enum LightDirections
        {
            North,
            NorthEast,
            East,
            SouthEast,
            South,
            SouthWest,
            West,
            NorthWest
        }

        public enum ColorScales
        {
            None,
            Gray,
            Rainbow,
            Terrain,
            VioletToYellow,
            GreenToYellow,
            Blues,
            BlueToYellow,
            BlueToRed,
            PurpleToYellow,
        }

        public PlotSettings()
        {
            IsAdaptive = true;
            ImagePath = string.Empty;
            ImageUri = string.Empty;
            VectorGraphics = false;
            ColorScale = ColorScales.Rainbow;
            SmoothScale = false;
            Shadows = true;
            LightDirection = LightDirections.NorthWest;
        }
    }
}