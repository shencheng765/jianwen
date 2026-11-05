using System;
using System.IO;
using System.IO.Compression;
using System.IO.Pipes;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Windows.Forms;

[assembly: AssemblyTitle("简文")]
[assembly: AssemblyDescription("简文：轻量中文文本与命令编辑器")]
[assembly: AssemblyProduct("简文")]
[assembly: AssemblyCompany("Local")]
[assembly: AssemblyVersion("1.5.8.0")]
[assembly: AssemblyFileVersion("1.5.8.0")]

namespace Jianwen {
    internal static class Program {
        public const string Version = "1.5.8";
        public static bool IsTest { get { return Environment.GetEnvironmentVariable("JIANWEN_TEST") == "1"; } }
        public static string CachePath;
        public static string DataPath;
        public static readonly bool TraceStartup = Environment.GetEnvironmentVariable("JIANWEN_STARTUP_TRACE") == "1";
        public static void StartupMark(string phase) {
            if (!TraceStartup || String.IsNullOrEmpty(DataPath)) return;
            try { File.AppendAllText(Path.Combine(DataPath, "startup-trace.jsonl"), Json.Write(Json.Obj("phase", phase, "ms", (DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalMilliseconds)) + "\n"); } catch { }
        }
        private static Mutex instance;
        private static string pipeName;
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe, out uint processId);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool AllowSetForegroundWindow(uint processId);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool SetDllDirectory(string path);
        [STAThread]
        public static void Main(string[] args) {
            try {
                // Installation may prepare immutable resources without opening
                // a window, starting a browser, or touching a user's profile.
                if (args.Contains("--prepare-runtime")) { ExtractBundle(); return; }
                DataPath = Path.GetFullPath(Environment.GetEnvironmentVariable("JIANWEN_USER_DATA") ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "JianwenData"));
                Directory.CreateDirectory(DataPath);
                StartupMark("main");
                if (args.Contains("--import-electron-key")) { ImportKey(); return; }
                string identity = Core.Digest(Encoding.UTF8.GetBytes(WindowsIdentity.GetCurrent().User.Value + DataPath.ToLowerInvariant())).Substring(0, 24);
                pipeName = "Jianwen-" + identity;
                bool created; instance = new Mutex(true, "Local\\" + pipeName, out created);
                var paths = args.Where(x => !x.StartsWith("-") && !x.Contains("://")).Select(Path.GetFullPath).ToArray();
                if (!created) {
                    using (var client = new NamedPipeClientStream(".", pipeName, PipeDirection.Out)) {
                        client.Connect(5000);
                        uint serverProcessId;
                        if (GetNamedPipeServerProcessId(client.SafePipeHandle, out serverProcessId)) AllowSetForegroundWindow(serverProcessId);
                        using (var writer = new StreamWriter(client, new UTF8Encoding(false))) writer.Write(Json.Write(Json.Obj("paths",paths,"newWindow",args.Contains("--new-window"))));
                    }
                    instance.Dispose(); return;
                }
                ExtractBundle();
                StartupMark("bundle");
                AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs eventArgs) {
                    var name = new AssemblyName(eventArgs.Name).Name;
                    if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
                    return Assembly.LoadFrom(Path.Combine(CachePath, name + ".dll"));
                };
                SetDllDirectory(CachePath);
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                Run(paths);
            } catch (Exception error) {
                if (args.Contains("--import-electron-key") || args.Contains("--prepare-runtime")) { Console.Error.WriteLine(Core.Error(error)); Environment.ExitCode = 1; }
                else MessageBox.Show("简文启动失败：" + Core.Error(error), "简文", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally { if (instance != null) { try { instance.ReleaseMutex(); } catch { } instance.Dispose(); } }
        }
        private static void ImportKey() {
            object input;
            using (var reader = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false, true))) input = Json.Read(reader.ReadToEnd());
            var key = Json.Str(input, "apiKey"); if (String.IsNullOrWhiteSpace(key)) throw new Exception("没有可导入的密钥。");
            var config = Json.Obj("baseUrl", Json.Str(input, "baseUrl"), "model", Json.Str(input, "model"), "assistantName", Core.Assistant(Json.Str(input, "assistantName")),
                "reasoningEffort", Core.Effort(Json.Str(input, "reasoningEffort")), "autoReview", Json.Bool(input, "autoReview"), "protectedKey", Core.Protect(key));
            Core.Endpoint(Json.Str(config, "baseUrl"));
            Json.AtomicFile(Path.Combine(DataPath, "settings-lite.json"), config);
        }
        private static void ExtractBundle() {
            // The module id changes with each compiled binary. Check its cache
            // before allocating or hashing the compressed embedded resources.
            string hash = Assembly.GetExecutingAssembly().ManifestModule.ModuleVersionId.ToString("N");
            CachePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Jianwen", "Runtime", Version + "-" + hash);
            if (File.Exists(Path.Combine(CachePath, ".complete"))) return;
            using (var mutex = new Mutex(false, "Local\\JianwenBundle-" + hash)) {
                try { mutex.WaitOne(); } catch (AbandonedMutexException) { }
                try {
                    if (File.Exists(Path.Combine(CachePath, ".complete"))) return;
                    UnpackBundle(hash);
                } finally { mutex.ReleaseMutex(); }
            }
        }
        // Keep ZIP/stream JIT work off the common cached startup path.
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void UnpackBundle(string hash) {
            Directory.CreateDirectory(CachePath); var root = Path.GetFullPath(CachePath) + Path.DirectorySeparatorChar;
            byte[] bytes;
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Jianwen.Bundle")) using (var buffer = new MemoryStream()) { stream.CopyTo(buffer); bytes = buffer.ToArray(); }
            using (var memory = new MemoryStream(bytes)) using (var zip = new ZipArchive(memory, ZipArchiveMode.Read)) {
                foreach (var entry in zip.Entries) {
                    var dest = Path.GetFullPath(Path.Combine(CachePath, entry.FullName));
                    if (!dest.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("程序资源路径无效。");
                    if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(dest); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(dest));
                    using (var input = entry.Open()) using (var output = File.Create(dest)) input.CopyTo(output);
                }
            }
            File.WriteAllText(Path.Combine(CachePath, ".complete"), hash);
        }
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Run(string[] paths) {
            using (var workspace = new Workspace(paths)) {
                Task.Run(() => Listen(workspace));
                Application.Run(workspace);
            }
        }
        private static void Listen(Workspace workspace) {
            var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
            while (workspace.Last != null) {
                try {
                    using (var pipe = new NamedPipeServerStream(pipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 4096, 4096, security)) {
                        pipe.WaitForConnection(); string text;
                        using (var reader = new StreamReader(pipe, Encoding.UTF8)) { var chars = new char[65536]; int n = reader.ReadBlock(chars, 0, chars.Length); text = new string(chars, 0, n); }
                        var message=Json.Read(text);var files=Json.Array(Json.Get(message,"paths")??message).Select(Convert.ToString).Take(100).ToArray();
                        var window=workspace.Last;
                        if (window!=null && !window.IsDisposed && window.IsHandleCreated) window.BeginInvoke(new Action(() => {if(Json.Bool(message,"newWindow"))workspace.NewWindow();workspace.Last.ReceiveFiles(files);}));
                    }
                } catch { if (workspace.Last == null) return; }
            }
        }
    }
}
