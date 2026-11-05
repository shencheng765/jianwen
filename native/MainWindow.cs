using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Drawing;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Jianwen {
    internal sealed class MainWindow : Form {
        private WebView2 view;
        private readonly Task<CoreWebView2Environment> environmentTask;
        private readonly Backend backend;
        private bool allowClose, ready;
        private Form blurWindow;
        private readonly List<string> waitingFiles = new List<string>();
        private readonly string data;
        public string SessionPath { get { return data; } }
        public string PendingTransfer;
        public bool IsDark { get; private set; }
        private bool mica, settingsSurface;
        private string resizeEdge;
        private float resizeScale;
        private Rectangle resizeBounds;
        private FormWindowState lastVisibleState = FormWindowState.Normal;
        private readonly Timer placementTimer = new Timer { Interval = 400 };
        private bool trackPlacement;
        private Rectangle normalWindowBounds;
        private FormWindowState observedState = FormWindowState.Normal;
        private bool correctingBounds;
        public string Material { get { return mica ? "mica" : "none"; } }
        // Keep the bundled page on a loopback-only origin. With .example, WebView2
        // waited about two seconds before requesting the first script on this PC.
        private const string Origin = "https://jianwen.localhost";
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref MARGINS margins);
        [DllImport("uxtheme.dll")] private static extern int SetWindowThemeAttribute(IntPtr hwnd, int attribute, ref WTA_OPTIONS options, int size);
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern uint GetDpiForSystem();
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(Point point, uint flags);
        [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint x, out uint y);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        public bool IsForeground { get { return GetForegroundWindow() == Handle; } }
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct MARGINS { public int Left, Right, Top, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct WTA_OPTIONS { public uint Flags, Mask; }
        [StructLayout(LayoutKind.Sequential)] private struct MINMAXINFO { public Point reserved, maxSize, maxPosition, minTrackSize, maxTrackSize; }
        public MainWindow(string dataPath, string[] paths) {
            data = dataPath; Text = "简文"; StartPosition = FormStartPosition.Manual;
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.None;
            MinimumSize = new Size(720, 500);
            var scale = CurrentScale(); var work = Screen.FromPoint(Cursor.Position).WorkingArea;
            // Match the local Notepad normal window, measured in logical pixels.
            Size = new Size(Math.Min((int)(1232 * scale), work.Width), Math.Min((int)(867 * scale), work.Height));
            Location = new Point(work.Left + (work.Width - Width) / 2, work.Top + (work.Height - Height) / 2);
            normalWindowBounds = Bounds;
            RestorePlacement();
            Padding = Padding.Empty;
            BackColor = Color.White;
            Icon = new Icon(Path.Combine(Program.CachePath, "icon.ico"));
            // Start browser environment preparation while reading the local session.
            environmentTask = CreateEnvironment();
            backend = new Backend(this, data, paths);
            Program.StartupMark("backend");
            var session = backend.InitialSession;
            SetTheme(Json.Str(Json.Get(session, "appearance"), "theme") == "dark");
            Load += async delegate { await Initialize(); };
            FormClosing += delegate(object sender, FormClosingEventArgs e) {
                if (allowClose || view == null || view.CoreWebView2 == null) return;
                e.Cancel = true;
                if (ready) Send("window:request-close", null);
            };
            Shown += delegate { observedState = WindowState; trackPlacement = true; RememberPlacement(); };
            placementTimer.Tick += delegate { placementTimer.Stop(); SavePlacement(); };
            FormClosing += delegate(object sender, FormClosingEventArgs e) { SavePlacement(); };
            FormClosed += delegate { placementTimer.Dispose(); backend.Dispose(); if (blurWindow != null) blurWindow.Dispose(); if (view != null) view.Dispose(); };
            Resize += delegate { RememberPlacement(); if (ready) Send("window:state", Json.Obj("maximized", WindowState == FormWindowState.Maximized)); };
            LocationChanged += delegate { RememberPlacement(); };
        }
        private void RestorePlacement() {
            var saved = Json.ReadFile(Path.Combine(data, "window-placement.json"), null);
            if (saved == null) return;
            var screen = Screen.AllScreens.FirstOrDefault(candidate => candidate.DeviceName == Json.Str(saved, "screen")) ?? Screen.FromPoint(Cursor.Position);
            var work = screen.WorkingArea;
            uint dx, dy; var monitor = MonitorFromPoint(new Point(work.Left + work.Width / 2, work.Top + work.Height / 2), 2);
            double scale = Math.Max(96, GetDpiForMonitor(monitor, 0, out dx, out dy) == 0 ? dx : GetDpiForSystem()) / 96.0;
            int width = (int)Math.Round(Math.Max(720, Math.Min(16000, Json.Number(saved, "width", 1232))) * scale);
            int height = (int)Math.Round(Math.Max(500, Math.Min(16000, Json.Number(saved, "height", 867))) * scale);
            width = Math.Min(width, work.Width); height = Math.Min(height, work.Height);
            int x = work.Left + (int)Math.Round(Math.Max(-16000, Math.Min(16000, Json.Number(saved, "left"))) * scale);
            int y = work.Top + (int)Math.Round(Math.Max(-16000, Math.Min(16000, Json.Number(saved, "top"))) * scale);
            Bounds = new Rectangle(Math.Max(work.Left, Math.Min(x, work.Right - width)), Math.Max(work.Top, Math.Min(y, work.Bottom - height)), width, height);
            normalWindowBounds = Bounds;
            lastVisibleState = Json.Bool(saved, "maximized") ? FormWindowState.Maximized : FormWindowState.Normal;
            WindowState = lastVisibleState;
        }
        private void RememberPlacement() {
            if (!trackPlacement || correctingBounds) return;
            var previous = observedState; observedState = WindowState;
            if (WindowState == FormWindowState.Minimized) return;
            if (WindowState == FormWindowState.Normal && previous != FormWindowState.Normal) {
                // WS_THICKFRAME + custom non-client sizing makes WinForms add
                // frame pixels to RestoreBounds. Apply the actual saved outer
                // rectangle after native restore/maximize messages have finished.
                correctingBounds = true;
                BeginInvoke(new Action(() => {
                    try { if (!IsDisposed && WindowState == FormWindowState.Normal) Bounds = normalWindowBounds; }
                    finally { correctingBounds = false; if (!IsDisposed) RememberPlacement(); }
                }));
                return;
            }
            if (WindowState == FormWindowState.Normal) normalWindowBounds = Bounds;
            lastVisibleState = WindowState;
            placementTimer.Stop(); placementTimer.Start();
        }
        private void SavePlacement() {
            if (!trackPlacement || IsDisposed) return;
            var bounds = normalWindowBounds;
            if (bounds.Width <= 0 || bounds.Height <= 0) return;
            var screen = Screen.FromRectangle(bounds); var work = screen.WorkingArea; var scale = CurrentScale();
            try {
                Json.AtomicFile(Path.Combine(data, "window-placement.json"), Json.Obj("width", bounds.Width / scale, "height", bounds.Height / scale,
                    "left", (bounds.Left - work.Left) / scale, "top", (bounds.Top - work.Top) / scale, "screen", screen.DeviceName,
                    "maximized", lastVisibleState == FormWindowState.Maximized));
            } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
        protected override CreateParams CreateParams {
            get { var cp = base.CreateParams; cp.Style = (cp.Style & ~0x00c00000) | 0x00040000 | 0x00080000 | 0x00010000 | 0x00020000; return cp; }
        }
        private float CurrentScale() {
            if (IsHandleCreated) return Math.Max(96, GetDpiForWindow(Handle)) / 96f;
            uint x, y;
            return Math.Max(96, GetDpiForMonitor(MonitorFromPoint(Cursor.Position, 2), 0, out x, out y) == 0 ? x : GetDpiForSystem()) / 96f;
        }
        protected override void OnHandleCreated(EventArgs e) {
            base.OnHandleCreated(e);
            // HTML owns the caption. Do not paint a second title or icon under its transparent surface.
            var caption = new WTA_OPTIONS { Flags = 3, Mask = 3 };
            SetWindowThemeAttribute(Handle, 1, ref caption, Marshal.SizeOf(typeof(WTA_OPTIONS)));
            ApplyBackdrop(); SetTheme(IsDark);
        }
        private void ApplyBackdrop() {
            if (!IsHandleCreated || Environment.OSVersion.Version.Build < 22621) return;
            int kind = settingsSurface ? 2 : 4;
            var margins = new MARGINS { Left = -1, Right = -1, Top = -1, Bottom = -1 };
            mica = DwmSetWindowAttribute(Handle, 38, ref kind, sizeof(int)) == 0 && DwmExtendFrameIntoClientArea(Handle, ref margins) == 0;
        }
        public void SetSurface(string surface) { settingsSurface = surface == "settings"; ApplyBackdrop(); }
        private Task<CoreWebView2Environment> CreateEnvironment() {
            string browserData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Jianwen", "WebView", Core.Digest(Encoding.UTF8.GetBytes(Program.DataPath.ToLowerInvariant())).Substring(0, 16));
            var options = new CoreWebView2EnvironmentOptions { Language = "zh-CN" };
            options.AdditionalBrowserArguments = "--disk-cache-size=33554432 --media-cache-size=1048576";
            if (Program.IsTest) {
                int port; if (Int32.TryParse(Environment.GetEnvironmentVariable("JIANWEN_DEBUG_PORT"), out port) && port > 0) options.AdditionalBrowserArguments += " --remote-debugging-port=" + port + " --remote-debugging-address=127.0.0.1";
            }
            return CoreWebView2Environment.CreateAsync(null, browserData, options);
        }
        private async Task Initialize() {
            try {
                Program.StartupMark("initialize");
                view = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = mica ? Color.Transparent : IsDark ? Color.FromArgb(32, 32, 32) : Color.White, AllowExternalDrop = true };
                Controls.Add(view);
                var environment = await environmentTask;
                Program.StartupMark("environment");
                await view.EnsureCoreWebView2Async(environment);
                Program.StartupMark("controller");
                var core = view.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false; core.Settings.AreDevToolsEnabled = Program.IsTest;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false; core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false; core.Settings.IsPinchZoomEnabled = false; core.Settings.IsPasswordAutosaveEnabled = false; core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsNonClientRegionSupportEnabled = true;
                core.Profile.PreferredColorScheme = IsDark ? CoreWebView2PreferredColorScheme.Dark : CoreWebView2PreferredColorScheme.Light;
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) { if (e.Uri != Origin + "/index.html") e.Cancel = true; else ready = false; if (Program.IsTest) File.AppendAllText(Path.Combine(data, "navigation.log"), "top " + e.Uri + " cancel=" + e.Cancel + "\n"); };
                core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) { if (Program.IsTest) File.AppendAllText(Path.Combine(data, "navigation.log"), "done " + e.IsSuccess + " " + e.WebErrorStatus + "\n"); };
                core.FrameNavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) { e.Cancel = true; };
                core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e) { e.Cancel = true; };
                core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) { e.State = e.Uri.StartsWith(Origin + "/", StringComparison.Ordinal) && e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny; };
                core.DocumentTitleChanged += delegate { Text = core.DocumentTitle; };
                core.WebMessageReceived += Message;
                core.ProcessFailed += delegate { if (!allowClose) MessageBox.Show(this, "编辑窗口意外退出。请重新打开简文，已记录的草稿会自动恢复。", "简文", MessageBoxButtons.OK, MessageBoxIcon.Information); };
                // Virtual-host mapping needs a mapped host before navigation on
                // this runtime. Trying navigation first and retrying after a failed
                // one adds a blank-page delay to every launch. Keep the in-process
                // response path as a fallback for machines that reject file mapping.
                var uiRoot = Path.Combine(Program.CachePath, "ui");
                bool hostResources = false;
                Action serveFromHost = delegate {
                    if (hostResources) return; hostResources = true;
                    var resources = Directory.GetFiles(uiRoot, "*", SearchOption.AllDirectories).ToDictionary(file => "/" + file.Substring(uiRoot.Length + 1).Replace('\\', '/'), file => file, StringComparer.Ordinal);
                    core.AddWebResourceRequestedFilter(Origin + "/*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
                    core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
                        var path = new Uri(e.Request.Uri).AbsolutePath; string file;
                        if (!resources.TryGetValue(path, out file)) { e.Response = environment.CreateWebResourceResponse(new MemoryStream(), 404, "Not Found", "Content-Type: text/plain\r\n"); return; }
                        var ext = Path.GetExtension(path).ToLowerInvariant();
                        var type = ext == ".html" ? "text/html; charset=utf-8" : ext == ".js" ? "application/javascript; charset=utf-8" : ext == ".css" ? "text/css; charset=utf-8" : ext == ".ttf" ? "font/ttf" : ext == ".png" ? "image/png" : "application/octet-stream";
                        var cache = path.StartsWith("/assets/", StringComparison.Ordinal) ? "public, max-age=31536000, immutable" : "no-store";
                        e.Response = environment.CreateWebResourceResponse(new MemoryStream(File.ReadAllBytes(file), false), 200, "OK", "Content-Type: " + type + "\r\nCache-Control: " + cache + "\r\nX-Content-Type-Options: nosniff\r\n");
                    };
                };
                bool mapped = Environment.GetEnvironmentVariable("JIANWEN_HOST_RESOURCES") != "1";
                if (mapped) {
                    try { core.SetVirtualHostNameToFolderMapping("jianwen.localhost", uiRoot, CoreWebView2HostResourceAccessKind.DenyCors); }
                    catch { mapped = false; serveFromHost(); }
                } else serveFromHost();
                if (mapped) core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) {
                    if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled) {
                        core.ClearVirtualHostNameToFolderMapping("jianwen.localhost"); serveFromHost();
                        Program.StartupMark("resource-fallback"); core.Navigate(Origin + "/index.html");
                    }
                };
                await core.AddScriptToExecuteOnDocumentCreatedAsync(File.ReadAllText(Path.Combine(Program.CachePath, "bridge.js"), Encoding.UTF8));
                if (Program.TraceStartup) await core.AddScriptToExecuteOnDocumentCreatedAsync("Object.defineProperty(window,'__jianwenTrace',{value:true});");
                Program.StartupMark("navigate");
                core.Navigate(Origin + "/index.html");
                int corner = 2; DwmSetWindowAttribute(Handle, 33, ref corner, sizeof(int));
            } catch (WebView2RuntimeNotFoundException) {
                MessageBox.Show(this, "需要 Microsoft Edge WebView2 运行库。Windows 11 通常已自带；请安装运行库后重新打开。", "简文", MessageBoxButtons.OK, MessageBoxIcon.Information); allowClose = true; Close();
            } catch (Exception error) { MessageBox.Show(this, "启动失败：" + Core.Error(error), "简文", MessageBoxButtons.OK, MessageBoxIcon.Error); allowClose = true; Close(); }
        }
        private async void Message(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
            if (e.Source != Origin + "/index.html") return;
            object id = null;
            try {
                var request = Json.Read(e.WebMessageAsJson); id = Json.Get(request, "id");
                var command = Json.Str(request, "command");
                if (command == "startup:mark") { Program.StartupMark(Core.Clip(Json.Str(Json.Array(Json.Get(request, "args")).FirstOrDefault(), "phase"), 40)); Reply(id, null); return; }
                if (command == "boot") Program.StartupMark("boot-request");
                var dropped = e.AdditionalObjects == null ? new string[0] : e.AdditionalObjects.OfType<CoreWebView2File>().Select(f => f.Path).ToArray();
                var result = await backend.Handle(command, Json.Array(Json.Get(request, "args")), dropped);
                Reply(id, result);
                if (command == "window:ready") {
                    ready = true;
                    if(!String.IsNullOrEmpty(PendingTransfer)){Send("tabs:import",Json.Obj("token",PendingTransfer));PendingTransfer=null;}
                    if (Environment.GetEnvironmentVariable("JIANWEN_MEASURE_READY") == "1") File.WriteAllText(Path.Combine(data, "editor-ready"), "ready");
                    if (waitingFiles.Count > 0) { var paths = waitingFiles.ToArray(); waitingFiles.Clear(); BeginInvoke(new Action(() => ReceiveFiles(paths))); }
                }
            } catch (Exception error) { Reply(id, Json.Obj("error", Core.Error(error))); }
        }
        private void Reply(object id, object value) { if (!IsDisposed && view != null && view.CoreWebView2 != null) view.CoreWebView2.PostWebMessageAsJson(Json.Write(Json.Obj("id", id, "value", value))); }
        public void Send(string name, object value) { if (!IsDisposed && view != null && view.CoreWebView2 != null) view.CoreWebView2.PostWebMessageAsJson(Json.Write(Json.Obj("event", name, "value", value))); }
        public void ReceiveFiles(string[] paths) {
            if (WindowState == FormWindowState.Minimized) WindowState = lastVisibleState;
            Show(); BringToFront(); Activate(); SetForegroundWindow(Handle);
            if (view != null) view.Focus();
            if (!ready) waitingFiles.AddRange(paths); else Send("files:opened", backend.ReadDocuments(paths));
        }
        public void SetTheme(bool dark) {
            IsDark = dark; BackColor = mica ? Color.Black : dark ? Color.FromArgb(32, 32, 32) : Color.White;
            if (view != null) { view.DefaultBackgroundColor = mica ? Color.Transparent : BackColor; if (view.CoreWebView2 != null) view.CoreWebView2.Profile.PreferredColorScheme = dark ? CoreWebView2PreferredColorScheme.Dark : CoreWebView2PreferredColorScheme.Light; }
            if (IsHandleCreated) { int flag = dark ? 1 : 0; DwmSetWindowAttribute(Handle, 20, ref flag, sizeof(int)); ApplyBackdrop(); }
        }
        public void Action(string action) {
            if (action == "close") Close();
            else if (action == "minimize") WindowState = FormWindowState.Minimized;
            else if (action == "maximize") WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
        }
        public void ResizeFromWeb(string phase, string edge, double deltaX, double deltaY) {
            if (phase == "end") { resizeEdge = null; return; }
            if (WindowState != FormWindowState.Normal) return;
            if (phase == "start") {
                var edges = new[] { "left", "right", "top", "top-left", "top-right", "bottom", "bottom-left", "bottom-right" };
                if (Array.IndexOf(edges, edge) >= 0) { resizeEdge = edge; resizeBounds = Bounds; resizeScale = CurrentScale(); }
            }
            else if (phase == "move" && resizeEdge != null) {
                int dx = (int)Math.Round(deltaX * resizeScale), dy = (int)Math.Round(deltaY * resizeScale);
                int left = resizeBounds.Left, right = resizeBounds.Right, top = resizeBounds.Top, bottom = resizeBounds.Bottom;
                bool moveLeft = resizeEdge.Contains("left"), moveRight = resizeEdge.Contains("right"), moveTop = resizeEdge.Contains("top"), moveBottom = resizeEdge.Contains("bottom");
                if (moveLeft) left += dx; if (moveRight) right += dx; if (moveTop) top += dy; if (moveBottom) bottom += dy;
                var scale = CurrentScale(); int minWidth = (int)(720 * scale), minHeight = (int)(500 * scale);
                if (right - left < minWidth) { if (moveLeft) left = right - minWidth; else right = left + minWidth; }
                if (bottom - top < minHeight) { if (moveTop) top = bottom - minHeight; else bottom = top + minHeight; }
                Bounds = Rectangle.FromLTRB(left, top, right, bottom);
            }
        }
        public void AllowClose() { allowClose = true; BeginInvoke(new Action(Close)); }
        public void ResizeContent(int width, int height) {
            var scale = CurrentScale(); WindowState = FormWindowState.Normal;
            var work = Screen.FromHandle(Handle).WorkingArea;
            Size = new Size(Math.Min((int)Math.Round(width * scale), work.Width), Math.Min((int)Math.Round(height * scale), work.Height));
            Location = new Point(Math.Max(work.Left, Math.Min(Left, work.Right - Width)), Math.Max(work.Top, Math.Min(Top, work.Bottom - Height)));
        }
        public void BlurForTest() {
            if (blurWindow == null) blurWindow = new Form { Text = "简文测试辅助窗口", Size = new Size(120, 70), StartPosition = FormStartPosition.Manual, Location = new Point(Right + 5, Top), ShowInTaskbar = false };
            blurWindow.Show(); blurWindow.Activate();
        }
        protected override void WndProc(ref Message m) {
            // These theme messages otherwise repaint the native caption after title/focus changes.
            if (m.Msg == 0x00ae || m.Msg == 0x00af) { m.Result = IntPtr.Zero; return; }
            if (m.Msg == 0x0086) { m.LParam = new IntPtr(-1); base.WndProc(ref m); return; }
            if (m.Msg == 0x0083) { m.Result = IntPtr.Zero; return; }
            if (m.Msg == 0x0084) {
                var point = PointToClient(new Point((short)((long)m.LParam & 0xffff), (short)(((long)m.LParam >> 16) & 0xffff)));
                int edge = Math.Max(3, (int)(5 * CurrentScale())); bool left = point.X < edge, right = point.X >= ClientSize.Width - edge, top = point.Y < edge, bottom = point.Y >= ClientSize.Height - edge;
                if (WindowState != FormWindowState.Maximized && (left || right || top || bottom)) { m.Result = new IntPtr(top ? (left ? 13 : right ? 14 : 12) : bottom ? (left ? 16 : right ? 17 : 15) : left ? 10 : 11); return; }
            }
            if (m.Msg == 0x0024) {
                var info = (MINMAXINFO)Marshal.PtrToStructure(m.LParam, typeof(MINMAXINFO)); var screen = Screen.FromHandle(Handle); var work = screen.WorkingArea; var bounds = screen.Bounds;
                info.maxPosition = new Point(work.Left - bounds.Left, work.Top - bounds.Top); info.maxSize = new Point(work.Width, work.Height);
                var scale = Math.Max(96, GetDpiForWindow(m.HWnd)) / 96f; info.minTrackSize = new Point((int)(720 * scale), (int)(500 * scale));
                Marshal.StructureToPtr(info, m.LParam, false); m.Result = IntPtr.Zero; return;
            }
            base.WndProc(ref m);
        }
    }
}
