using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Windows.Forms;

namespace Jianwen {
    // A single UI process owns independent window sessions and one shared settings file.
    internal sealed class Workspace : ApplicationContext {
        public static Workspace Current;
        private readonly List<MainWindow> windows = new List<MainWindow>();
        private readonly Dictionary<string, Transfer> transfers = new Dictionary<string, Transfer>();
        private bool exiting;
        private volatile MainWindow last;
        public MainWindow Last { get { return last; } }
        public Workspace(string[] paths) {
            Current = this;
            var saved=Json.Array(Json.ReadFile(Path.Combine(Program.DataPath,"workspace.json"),null)).Select(Convert.ToString).Where(x=>x=="."||(x.Length==40&&x.StartsWith("Windows/")&&x.Substring(8).All(Uri.IsHexDigit))).Distinct().ToArray();
            if(saved.Length>0){for(int i=0;i<saved.Length;i++)Open(saved[i]=="."?Program.DataPath:Path.Combine(Program.DataPath,saved[i].Replace('/',Path.DirectorySeparatorChar)),i==saved.Length-1?paths:new string[0]);return;}
            Open(Program.DataPath, paths);
            var folder = Path.Combine(Program.DataPath, "Windows");
            if (Directory.Exists(folder)) foreach (var dir in Directory.GetDirectories(folder))
                if (File.Exists(Path.Combine(dir, ".restore"))) Open(dir, new string[0]);
        }
        private MainWindow Open(string data, string[] paths) {
            Directory.CreateDirectory(data);
            var window = new MainWindow(data, paths); windows.Add(window);last=window;window.Activated+=delegate{last=window;};
            SaveWindows(windows.Select(x=>x.SessionPath));
            if (data != Program.DataPath) File.WriteAllText(Path.Combine(data, ".restore"), "open");
            window.FormClosed += delegate {
                windows.Remove(window);
                if(last==window)last=windows.LastOrDefault();
                if(!exiting){SaveWindows(windows.Count==0?new[]{data}:windows.Select(x=>x.SessionPath));if(windows.Count>0&&data!=Program.DataPath){try{File.Delete(Path.Combine(data,".restore"));}catch{}}}
                if (windows.Count == 0) ExitThread();
            };
            window.Show(); return window;
        }
        public object NewWindow(object input=null) { var w=Open(Path.Combine(Program.DataPath,"Windows",Guid.NewGuid().ToString("N")),new string[0]);w.PendingTransfer=Json.Str(input,"transfer");return Json.Obj("windowId",w.SessionPath); }
        public void SettingsChanged(object settings){foreach(var window in windows.ToArray())window.Send("settings:changed",settings);}
        private void SaveWindows(IEnumerable<string> paths){Json.AtomicFile(Path.Combine(Program.DataPath,"workspace.json"),paths.Select(x=>x==Program.DataPath?".":"Windows/"+Path.GetFileName(x)).ToArray());}
        public void ExitAll() { SaveWindows(windows.Select(x=>x.SessionPath));exiting=true; foreach(var w in windows.ToArray()) w.Close(); }
        public void Prepare(MainWindow source, object input) {
            string token=Json.Str(input,"token"); if(token.Length!=36)throw new Exception("标签转移标识无效。");
            foreach(var key in transfers.Where(x=>(DateTime.UtcNow-x.Value.Created).TotalMinutes>5).Select(x=>x.Key).ToArray()){Cleanup(transfers[key]);transfers.Remove(key);}
            var document=Json.Get(input,"doc");string snapshot=null;
            if(Json.Get(document,"large")!=null){string id=Json.Str(Json.Get(document,"large"),"id");if(id.Length!=32||!id.All(Uri.IsHexDigit))throw new Exception("大文件暂存标识无效。");snapshot=Path.Combine(Program.DataPath,"Transfers",Guid.NewGuid().ToString("N"));string destination=Path.Combine(snapshot,"LargeDrafts",id),sourceFolder=Path.Combine(source.SessionPath,"LargeDrafts",id);Directory.CreateDirectory(destination);if(Directory.Exists(sourceFolder))foreach(var file in Directory.GetFiles(sourceFolder))File.Copy(file,Path.Combine(destination,Path.GetFileName(file)));}
            transfers[token]=new Transfer {Source=source,Document=document,Snapshot=snapshot,Created=DateTime.UtcNow};
        }
        public object Peek(string token, MainWindow target) {
            Transfer transfer;if(!transfers.TryGetValue(token,out transfer))throw new Exception("标签尚未准备好或已失效，请重新拖动。");
            if(transfer.Source==target)throw new Exception("标签已在当前窗口。");
            return Json.Obj("doc",transfer.Document,"sourceData",transfer.Snapshot??transfer.Source.SessionPath);
        }
        public void Commit(string token) {
            Transfer transfer;if(!transfers.TryGetValue(token,out transfer))return;
            transfers.Remove(token);Cleanup(transfer);if(!transfer.Source.IsDisposed)transfer.Source.Send("tabs:transferred",Json.Obj("id",Json.Str(transfer.Document,"id"),"token",token));
        }
        private static void Cleanup(Transfer transfer){try{if(transfer.Snapshot!=null)Directory.Delete(transfer.Snapshot,true);}catch{}}
        protected override void Dispose(bool disposing){if(disposing)foreach(var transfer in transfers.Values)Cleanup(transfer);base.Dispose(disposing);}
        private sealed class Transfer { public MainWindow Source;public object Document;public string Snapshot;public DateTime Created; }
    }
}
