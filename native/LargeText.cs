using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;

namespace Jianwen {
    // Only one bounded segment is sent across the WebView bridge. Unchanged
    // source bytes are copied verbatim on save; changed segments live on disk.
    internal sealed class LargeText {
        public const long MaximumBytes = 1024L * 1024 * 1024;
        public const int SegmentBytes = 64 * 1024;
        public const int ThresholdBytes = 8 * 1024 * 1024;
        private readonly object gate = new object();
        private readonly string folder;
        private readonly SortedDictionary<int, long> boundaries = new SortedDictionary<int, long>();
        private readonly HashSet<int> edits = new HashSet<int>();
        private long length, writeTicks;
        private int skip;
        public string Id { get; private set; }
        public string PathName { get; private set; }
        public string EncodingName { get; private set; }
        public bool Bom { get { return skip > 0; } }
        public int Count { get { return Math.Max(1, (int)((length - skip + SegmentBytes - 1) / SegmentBytes)); } }
        public bool Dirty { get { return edits.Count > 0; } }
        public LargeText(string path, string data, string restoreId) {
            PathName = Path.GetFullPath(path);
            var stat = new FileInfo(PathName); length = stat.Length; writeTicks = stat.LastWriteTimeUtc.Ticks;
            if (length > MaximumBytes) throw new Exception("文件超过 1 GiB（1024 MiB），暂不支持打开。");
            Id = Guid.NewGuid().ToString("N");
            if (!String.IsNullOrEmpty(restoreId) && restoreId.Length == 32 && restoreId.All(Uri.IsHexDigit)) Id = restoreId;
            folder = Path.Combine(data, "LargeDrafts", Id);
            var meta = Json.ReadFile(Path.Combine(folder, "source.json"), null);
            if (meta != null) {
                if (Core.FileKey(Json.Str(meta, "path")) != Core.FileKey(PathName) || Json.Str(meta, "length") != length.ToString() || Json.Str(meta, "writeTicks") != writeTicks.ToString())
                    throw new Exception("大文件在外部发生变化，暂存修改仍保留在 LargeDrafts 中，未覆盖原文件。请先保留原文件与暂存目录。");
                if (Json.Number(meta, "segmentBytes", SegmentBytes) != SegmentBytes) throw new Exception("暂存片段格式不兼容，请保留 LargeDrafts 目录并使用创建暂存的版本恢复。原文件未改动。");
                EncodingName = Json.Str(meta, "encoding"); skip = (int)Json.Number(meta, "skip");
                Core.GetEncoding(EncodingName);
                foreach (var item in Json.Array(Json.Get(meta, "edits"))) { int index; if (Int32.TryParse(Convert.ToString(item), out index) && index >= 0 && index < Count && File.Exists(EditPath(index))) edits.Add(index); }
            } else Detect();
            boundaries[0] = skip;
        }
        private string EditPath(int index) { return Path.Combine(folder, "part-" + index + ".txt"); }
        public void CheckSource() {
            var stat = new FileInfo(PathName);
            if (!stat.Exists || stat.Length != length || stat.LastWriteTimeUtc.Ticks != writeTicks) throw new Exception("大文件在外部发生变化，已停止读取或保存，未覆盖磁盘文件。暂存修改仍保留，请先保留原文件与 LargeDrafts 目录。");
        }
        private FileStream Source() { CheckSource(); return new FileStream(PathName, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, FileOptions.RandomAccess); }
        private static byte[] Read(FileStream stream, long start, int count) {
            stream.Position = start; var bytes = new byte[count]; int total = 0, n;
            while (total < count && (n = stream.Read(bytes, total, count - total)) > 0) total += n;
            if (total != count) Array.Resize(ref bytes, total);
            return bytes;
        }
        private void Detect() {
            using (var source = Source()) {
                var sample = Read(source, 0, (int)Math.Min(SegmentBytes + 4, length));
                if (sample.Length >= 2 && sample[0] == 255 && sample[1] == 254) { EncodingName = "utf16-le"; skip = 2; return; }
                if (sample.Length >= 2 && sample[0] == 254 && sample[1] == 255) { EncodingName = "utf16-be"; skip = 2; return; }
                if (Core.LooksBinary(sample)) throw new Exception("这是二进制文件，简文只打开文本文件。");
                skip = sample.Length >= 3 && sample[0] == 239 && sample[1] == 187 && sample[2] == 191 ? 3 : 0;
                EncodingName = "utf8";
                for (int trim = 0; trim < (length > sample.Length ? 4 : 1) && sample.Length - skip >= trim; trim++) {
                    try { Core.GetEncoding("utf8").GetString(sample, skip, sample.Length - skip - trim); return; } catch (DecoderFallbackException) { }
                }
                EncodingName = "gb18030";
                for (int trim = 0; skip == 0 && trim < (length > sample.Length ? 4 : 1) && sample.Length >= trim; trim++) {
                    try { Core.GetEncoding(EncodingName).GetString(sample, skip, sample.Length - skip - trim); skip = 0; return; } catch (DecoderFallbackException) { }
                }
                EncodingName = "latin1"; skip = 0;
            }
        }
        private long Boundary(FileStream source, int index) {
            if (index <= 0) return skip;
            if (index >= Count) return length;
            long found; if (boundaries.TryGetValue(index, out found)) return found;
            long at = Math.Min(length, skip + (long)index * SegmentBytes);
            if (EncodingName == "utf8") {
                source.Position = at;
                for (int i = 0; i < 4 && at < length; i++) { int value = source.ReadByte(); if (value < 0 || (value & 0xC0) != 0x80) break; at++; }
                source.Position = Math.Max(skip, at - 1); int before = source.ReadByte(), next = source.ReadByte();
                if (before == 13 && next == 10) at++;
            } else if (EncodingName.StartsWith("utf16")) {
                at -= (at - skip) % 2;
                var probe = Read(source, Math.Max(skip, at - 2), (int)Math.Min(6, length - Math.Max(skip, at - 2)));
                int offset = at > skip ? 2 : 0;
                if (probe.Length >= offset + 2) {
                    int value = EncodingName == "utf16-le" ? probe[offset] | probe[offset + 1] << 8 : probe[offset] << 8 | probe[offset + 1];
                    if (value >= 0xDC00 && value <= 0xDFFF) at += 2;
                    else if (offset == 2) {
                        int previous = EncodingName == "utf16-le" ? probe[0] | probe[1] << 8 : probe[0] << 8 | probe[1];
                        if (previous == 13 && value == 10) at += 2;
                    }
                }
            } else if (EncodingName == "latin1") {
                // One character per byte; no multibyte boundary adjustment.
                source.Position = at - 1;
                if (source.ReadByte() == 13 && source.ReadByte() == 10) at++;
            } else {
                // GB18030 has ambiguous random byte boundaries. Build only as
                // much of its exact boundary index as the requested jump needs.
                int previous = boundaries.Keys.Where(x => x < index).Max(); long start = boundaries[previous];
                for (int segment = previous + 1; segment <= index; segment++) {
                    int count = (int)Math.Min(length - start, skip + (long)segment * SegmentBytes - start);
                    var bytes = Read(source, start, count); int trim = 0;
                    for (; trim < 4; trim++) { try { Core.GetEncoding(EncodingName).GetString(bytes, 0, bytes.Length - trim); break; } catch (DecoderFallbackException) { } }
                    if (trim == 4) throw new Exception("文件编码与当前选择不符，请切换大文件编码后重试。");
                    at = start + count - trim;
                    source.Position = Math.Max(skip, at - 1); if (source.ReadByte() == 13 && source.ReadByte() == 10) at++;
                    boundaries[segment] = at; start = at;
                }
            }
            boundaries[index] = at; return at;
        }
        private string Original(FileStream source, int index) {
            long start = Boundary(source, index), end = Boundary(source, index + 1);
            var bytes = Read(source, start, (int)(end - start));
            if (!EncodingName.StartsWith("utf16") && Core.LooksBinary(bytes)) throw new Exception("当前片段包含大量二进制数据，已停止读取。");
            try { return Core.GetEncoding(EncodingName).GetString(bytes); }
            catch (DecoderFallbackException) { throw new Exception("当前片段编码与自动识别结果不符，请切换大文件编码后重试。"); }
        }
        public object Page(int index) {
            lock (gate) {
                if (index < 0 || index >= Count) throw new Exception("片段序号超出范围。");
                using (var source = Source()) {
                    long start = Boundary(source, index), end = Boundary(source, index + 1);
                    string text = edits.Contains(index) ? File.ReadAllText(EditPath(index), new UTF8Encoding(false, true)) : Original(source, index);
                    return Json.Obj("text", text, "large", Json.Obj("id", Id, "index", index, "count", Count, "bytes", length, "start", start, "end", end, "dirty", Dirty),
                        "path", PathName, "name", Path.GetFileName(PathName), "encoding", EncodingName, "bom", Bom, "fingerprint", "large:" + length + ":" + writeTicks);
                }
            }
        }
        private void WriteMetadata() {
            Directory.CreateDirectory(folder);
            Json.AtomicFile(Path.Combine(folder, "source.json"), Json.Obj("format", 1, "segmentBytes", SegmentBytes, "path", PathName, "length", length.ToString(), "writeTicks", writeTicks.ToString(), "encoding", EncodingName, "skip", skip, "edits", edits.OrderBy(x => x).ToArray()));
        }
        public object Stage(int index, string text) {
            lock (gate) {
                if (index < 0 || index >= Count) throw new Exception("片段序号超出范围。");
                if (text.Length > 4 * 1024 * 1024) throw new Exception("当前片段修改过大，请分次编辑（单片段最多 4 百万字符）。");
                // Validate encodability before storing a draft. Never replace
                // characters with '?' for legacy encodings.
                Core.GetEncoding(EncodingName).GetByteCount(text);
                using (var source = Source()) {
                    if (text == Original(source, index)) {
                        edits.Remove(index);
                        // Metadata first: interruption may leave an unused draft,
                        // but cannot make a referenced draft disappear.
                        WriteMetadata(); if (File.Exists(EditPath(index))) File.Delete(EditPath(index));
                    } else {
                        Directory.CreateDirectory(folder); Core.AtomicBytes(EditPath(index), new UTF8Encoding(false).GetBytes(text)); edits.Add(index); WriteMetadata();
                    }
                }
                return Json.Obj("dirty", Dirty);
            }
        }
        public object ChangeEncoding(string encoding, int index) {
            lock (gate) {
                if (Dirty) throw new Exception("请先保存修改，再切换大文件编码。");
                Core.GetEncoding(encoding);
                if (skip > 0 && encoding != EncodingName) throw new Exception("此文件带 BOM，不能直接切换为其他编码。");
                if (encoding.StartsWith("utf16") && (length - skip) % 2 != 0) throw new Exception("文件长度不符合 UTF-16 编码。");
                var previous = EncodingName; EncodingName = encoding; boundaries.Clear(); boundaries[0] = skip;
                try { var page = Page(index); WriteMetadata(); return page; }
                catch { EncodingName = previous; boundaries.Clear(); boundaries[0] = skip; throw; }
            }
        }
        public object Save(string destination, int index, bool exportOnly = false) {
            lock (gate) {
                destination = Path.GetFullPath(destination); Directory.CreateDirectory(Path.GetDirectoryName(destination));
                string temporary = Path.Combine(Path.GetDirectoryName(destination), "." + Path.GetFileName(destination) + "." + Guid.NewGuid().ToString("N") + ".tmp");
                try {
                    using (var source = Source()) using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1024 * 1024, FileOptions.SequentialScan)) {
                        var buffer = new byte[1024 * 1024]; long cursor = 0;
                        foreach (int segment in edits.OrderBy(x => x)) {
                            long start = Boundary(source, segment), end = Boundary(source, segment + 1);
                            Copy(source, output, cursor, start - cursor, buffer);
                            var text = File.ReadAllText(EditPath(segment), new UTF8Encoding(false, true));
                            var bytes = Core.GetEncoding(EncodingName).GetBytes(text); output.Write(bytes, 0, bytes.Length); cursor = end;
                        }
                        Copy(source, output, cursor, length - cursor, buffer);
                        if (output.Length > MaximumBytes) throw new Exception("保存后的文件超过 1 GiB，请减少内容后重试；原文件未改动。");
                        output.Flush(true);
                    }
                    CheckSource();
                    if (File.Exists(destination)) File.Replace(temporary, destination, null); else File.Move(temporary, destination);
                    if (exportOnly) return Json.Obj("exported",true);
                    PathName = destination; var stat = new FileInfo(destination); length = stat.Length; writeTicks = stat.LastWriteTimeUtc.Ticks;
                    // Commit the new source identity before forgetting staged edits.
                    var obsolete = edits.ToArray(); edits.Clear(); boundaries.Clear(); boundaries[0] = skip;
                    string warning = null;
                    try { WriteMetadata(); }
                    catch { warning = "文件已保存，但暂存恢复记录更新失败；请重新打开已保存文件后继续编辑。"; }
                    if (warning == null) foreach (int part in obsolete) { try { File.Delete(EditPath(part)); } catch { } }
                    Dictionary<string, object> result;
                    try { result = Json.Map(Page(Math.Min(index, Count - 1))); }
                    catch { result = Json.Map(Page(0)); }
                    if (warning != null) result["warning"] = warning;
                    return result;
                } finally { if (File.Exists(temporary)) File.Delete(temporary); }
            }
        }
        private static void Copy(FileStream source, FileStream destination, long offset, long count, byte[] buffer) {
            source.Position = offset;
            while (count > 0) { int n = source.Read(buffer, 0, (int)Math.Min(buffer.Length, count)); if (n <= 0) throw new EndOfStreamException("原文件在读取时变短，未保存。"); destination.Write(buffer, 0, n); count -= n; }
        }
        public void Discard() { lock (gate) { var old = edits.ToArray(); edits.Clear(); WriteMetadata(); foreach (int index in old) { try { File.Delete(EditPath(index)); } catch { } } } }
    }
}
