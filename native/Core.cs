using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace Jianwen {
    internal static class Json {
        private static JavaScriptSerializer Serializer() { return new JavaScriptSerializer { MaxJsonLength = 80 * 1024 * 1024, RecursionLimit = 100 }; }
        public static string Write(object value) { return Serializer().Serialize(value); }
        public static object Read(string value) { return Serializer().DeserializeObject(value); }
        public static Dictionary<string, object> Map(object value) { return value as Dictionary<string, object> ?? new Dictionary<string, object>(); }
        public static object Get(object value, string key, object fallback = null) { object result; return Map(value).TryGetValue(key, out result) ? result : fallback; }
        public static string Str(object value, string key, string fallback = "") { return Convert.ToString(Get(value, key, fallback)) ?? fallback; }
        public static bool Bool(object value, string key, bool fallback = false) { object x = Get(value, key); return x is bool ? (bool)x : fallback; }
        public static double Number(object value, string key, double fallback = 0) { double n; return Double.TryParse(Str(value, key), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out n) && !Double.IsNaN(n) && !Double.IsInfinity(n) ? n : fallback; }
        public static object[] Array(object value) { var items = value as object[]; return items ?? new object[0]; }
        public static Dictionary<string, object> Obj(params object[] pairs) { var d = new Dictionary<string, object>(); for (int i = 0; i < pairs.Length; i += 2) d[(string)pairs[i]] = pairs[i + 1]; return d; }
        public static object ReadFile(string path, object fallback) { try { return Read(File.ReadAllText(path, Encoding.UTF8)); } catch { return fallback; } }
        public static void AtomicFile(string path, object value) { Core.AtomicBytes(path, new UTF8Encoding(false).GetBytes(Write(value))); }
    }

    internal static class Core {
        public static string Clip(string text, int max) { return text.Length > max ? text.Substring(0, max) : text; }
        public static string Error(Exception error) { return Clip(Regex.Replace(error.Message, @"sk-[\w.\-]+", "[密钥已隐藏]"), 400); }
        public static string Digest(byte[] bytes) { using (var sha = SHA256.Create()) return String.Concat(sha.ComputeHash(bytes).Select(b => b.ToString("x2"))); }
        public static string FileKey(string path) { return Path.GetFullPath(path).ToLowerInvariant(); }
        public static bool LooksBinary(byte[] bytes) {
            // Logs may contain sparse NULs and terminal control bytes. A single
            // control byte is not evidence that the whole document is binary.
            if (bytes.Length == 0) return false;
            if (bytes.Length >= 4 && (
                (bytes[0] == 0x7f && bytes[1] == 69 && bytes[2] == 76 && bytes[3] == 70) ||
                (bytes[0] == 0x89 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71) ||
                (bytes[0] == 80 && bytes[1] == 75 && bytes[2] == 3 && bytes[3] == 4) ||
                (bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff) ||
                (bytes[0] == 0x1f && bytes[1] == 0x8b))) return true;
            int controls = 0;
            foreach (byte value in bytes)
                if ((value < 32 && value != 8 && value != 9 && value != 10 &&
                    value != 12 && value != 13 && value != 27) || value == 127) controls++;
            return (long)controls * 10 > bytes.Length;
        }
        public static Dictionary<string, object> Decode(byte[] bytes) {
            string encoding = "utf8"; bool bom = false; int skip = 0;
            bool le = bytes.Length >= 2 && bytes[0] == 255 && bytes[1] == 254;
            bool be = bytes.Length >= 2 && bytes[0] == 254 && bytes[1] == 255;
            if (!le && !be && LooksBinary(bytes)) throw new Exception("这是二进制文件，简文只打开文本文件。");
            if (le || be) { encoding = le ? "utf16-le" : "utf16-be"; bom = true; skip = 2; }
            else if (bytes.Length >= 3 && bytes[0] == 239 && bytes[1] == 187 && bytes[2] == 191) { bom = true; skip = 3; }
            string text;
            try { text = GetEncoding(encoding).GetString(bytes, skip, bytes.Length - skip); }
            catch (DecoderFallbackException) {
                if (encoding != "utf8") throw new Exception("文件中的文字编码不完整，请检查文件。");
                encoding = "gb18030";
                try {
                    if (skip > 0) throw new DecoderFallbackException();
                    text = GetEncoding(encoding).GetString(bytes, skip, bytes.Length - skip);
                }
                catch (DecoderFallbackException) {
                    // ISO-8859-1 maps every byte reversibly, unlike replacement
                    // decoding. Preserve even a malformed UTF-8 BOM as bytes.
                    encoding = "latin1"; skip = 0;
                    text = GetEncoding(encoding).GetString(bytes);
                }
                bom = false;
            }
            return Json.Obj("text", text, "encoding", encoding, "bom", bom);
        }
        public static Encoding GetEncoding(string encoding) {
            if (encoding == "utf8") return new UTF8Encoding(false, true);
            if (encoding == "utf16-le") return new UnicodeEncoding(false, false, true);
            if (encoding == "utf16-be") return new UnicodeEncoding(true, false, true);
            if (encoding == "gb18030") return Encoding.GetEncoding(54936, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            if (encoding == "latin1") return Encoding.GetEncoding(28591, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            throw new Exception("不支持的文本编码。");
        }
        public static byte[] Encode(string text, string encoding, bool bom) {
            var codec = GetEncoding(encoding); byte[] bytes;
            try { bytes = codec.GetBytes(text); }
            catch (EncoderFallbackException) { throw new Exception("当前编码无法保存这些字符，请选择“另存为”以 UTF-8 保存。"); }
            if (codec.GetString(bytes) != text) throw new Exception("当前编码无法保存这些字符，请选择“另存为”以 UTF-8 保存。");
            byte[] prefix = !bom ? new byte[0] : encoding == "utf8" ? new byte[] { 239, 187, 191 } : encoding == "utf16-le" ? new byte[] { 255, 254 } : encoding == "utf16-be" ? new byte[] { 254, 255 } : new byte[0];
            return prefix.Concat(bytes).ToArray();
        }
        public static void AtomicBytes(string path, byte[] bytes) {
            var full = Path.GetFullPath(path); Directory.CreateDirectory(Path.GetDirectoryName(full));
            string temp = Path.Combine(Path.GetDirectoryName(full), "." + Path.GetFileName(full) + "." + Guid.NewGuid().ToString("N") + ".tmp");
            try {
                using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (File.Exists(full)) File.Replace(temp, full, null); else File.Move(temp, full);
            } finally { if (File.Exists(temp)) File.Delete(temp); }
        }
        public static string Endpoint(string value) {
            Uri uri;
            if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out uri) || (uri.Scheme != "http" && uri.Scheme != "https") || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0) throw new Exception("请输入 http 或 https 接口地址，地址中不要包含密钥。");
            var builder = new UriBuilder(uri);
            builder.Path = Regex.Replace(uri.AbsolutePath.TrimEnd('/'), @"/(?:chat/completions|responses)$", "", RegexOptions.IgnoreCase) + "/responses";
            return builder.Uri.AbsoluteUri;
        }
        public static string Effort(string value) {
            var effort = value.Trim();
            if (!new[] { "", "none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra" }.Contains(effort)) throw new Exception("请选择有效的思考强度。");
            return effort;
        }
        public static string Assistant(string value) { var s = Clip(Regex.Replace(value, @"[\r\n\t]", " ").Trim(), 40); return s.Length == 0 ? "AI 助手" : s; }
        public static string Content(object data) {
            var status = Json.Str(data, "status");
            if (status == "incomplete") throw new Exception("模型输出未完成，未写入文本。请缩小生成范围后重试。");
            if (status == "failed" || status == "cancelled" || status == "queued" || status == "in_progress") throw new Exception("接口未完成回复（" + status + "），请稍后重试。");
            var parts = Json.Array(Json.Get(data, "output")).Where(x => Json.Str(x, "type") == "message" && Json.Str(x, "role") == "assistant").ToArray();
            if (parts.Any(x => Json.Str(x, "status") == "incomplete")) throw new Exception("模型输出未完成，未写入文本。请缩小生成范围后重试。");
            var content = parts.SelectMany(x => Json.Array(Json.Get(x, "content"))).ToArray();
            if (content.Any(x => Json.Str(x, "type") == "refusal")) throw new Exception("模型拒绝了这次请求，请调整需求后重试。");
            var text = String.Concat(content.Where(x => Json.Str(x, "type") == "output_text").Select(x => Json.Str(x, "text")));
            if (String.IsNullOrWhiteSpace(text)) throw new Exception("Responses 接口没有返回文本，请检查模型名称和接口兼容性。");
            return text;
        }
        public static object Review(string value, int lineCount) {
            var clean = Regex.Replace(Regex.Replace(value.Trim(), @"^```(?:json)?\s*", "", RegexOptions.IgnoreCase), @"\s*```$", ""); object parsed;
            try { parsed = Json.Read(clean); }
            catch { int a = clean.IndexOf('{'), b = clean.LastIndexOf('}'); if (a < 0 || b <= a) throw new Exception("AI 没有返回有效的检查结果，请重试。"); parsed = Json.Read(clean.Substring(a, b - a + 1)); }
            if (!(Json.Get(parsed, "summary") is string) || !(Json.Get(parsed, "issues") is object[])) throw new Exception("AI 的检查结果缺少必要字段，请重试。");
            var issues = Json.Array(Json.Get(parsed, "issues")).Where(x => x is Dictionary<string, object>).Take(12).Select(x => Json.Obj(
                "line", Math.Min(lineCount, Math.Max(1, (int)Math.Truncate(Json.Number(x, "line", 1)))),
                "severity", Json.Str(x, "severity") == "error" ? "error" : Json.Str(x, "severity") == "info" ? "info" : "warning",
                "title", Clip(Json.Str(x, "title", "检查建议"), 160), "message", Clip(Json.Str(x, "message"), 2400),
                "original", Clip(Json.Str(x, "original"), 6000), "replacement", Json.Get(x, "replacement") is string ? Clip(Json.Str(x, "replacement"), 6000) : null)).ToArray();
            return Json.Obj("summary", Clip(Json.Str(parsed, "summary"), 1000), "issues", issues);
        }
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Jianwen.WebView2.Key.v1");
        public static string Protect(string value) { return Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(value), Entropy, DataProtectionScope.CurrentUser)); }
        public static string Unprotect(string value) { try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(value), Entropy, DataProtectionScope.CurrentUser)); } catch { throw new Exception("密钥无法解锁，请在 AI 设置中重新填写。"); } }
    }
}
