using System;
using System.IO;
using System.Text;
using System.Linq;

namespace Jianwen {
    internal static class LogDecodeTests {
        private static int passed;
        private static void Assert(bool ok, string name) {
            if (!ok) throw new Exception(name);
            passed++;
        }
        private static void RoundTrip(byte[] bytes, string expected, string name) {
            var result = Core.Decode(bytes);
            Assert(Json.Str(result,"encoding") == expected, name + " encoding");
            Assert(Core.Encode(Json.Str(result,"text"),expected,Json.Bool(result,"bom")).SequenceEqual(bytes), name + " byte preservation");
        }
        private static void Reject(byte[] bytes, string name) {
            bool rejected = false;
            try { Core.Decode(bytes); } catch { rejected = true; }
            Assert(rejected, name);
        }
        public static int Main(string[] args) {
            string folder = Path.Combine(Path.GetTempPath(),"JianwenLogTests-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            try {
                RoundTrip(new byte[0],"utf8","empty");
                RoundTrip(Encoding.UTF8.GetBytes("中文日志\r\n正常内容\r\n"),"utf8","UTF8");
                RoundTrip(Encoding.UTF8.GetBytes(new string('x',1000)+"\0\0\r\n"),"utf8","sparse NUL");
                RoundTrip(Core.GetEncoding("gb18030").GetBytes(new string('x',1000)+"中文\0\r\n"),"gb18030","GB18030");
                foreach (string enc in new[]{"utf16-le","utf16-be"})
                    RoundTrip(Core.Encode("中文日志\r\n",enc,true),enc,enc);
                var malformed = Encoding.ASCII.GetBytes(new string('x',1000)).Concat(new byte[]{0,0xff,0xff,13,10}).ToArray();
                RoundTrip(malformed,"latin1","mixed bytes");
                RoundTrip(new byte[]{239,187,191}.Concat(malformed).ToArray(),"latin1","malformed BOM");
                Reject(new byte[100],"dense NUL");
                Reject(new byte[]{137,80,78,71,13,10,26,10},"PNG");
                Reject(new byte[]{127,69,76,70,1,2,3,4},"ELF");
                Reject(new byte[]{80,75,3,4,65,66,67,68},"ZIP");
                Reject(new byte[]{31,139,8,0,65,66,67,68},"gzip");
                bool refused=false;
                try { Core.Encode("中文","latin1",false); } catch { refused=true; }
                Assert(refused,"Latin1 refuses character loss");
                foreach (bool mixed in new[]{false,true}) {
                    var block=Encoding.ASCII.GetBytes(new string('a',65536));
                    block[50]=0;
                    if(mixed){block[80]=255;block[81]=255;}
                    var source=Enumerable.Range(0,130).SelectMany(i=>block).ToArray();
                    string path=Path.Combine(folder,mixed?"mixed.log":"utf8.log");
                    File.WriteAllBytes(path,source);
                    var large=new LargeText(path,folder,null);
                    Assert(large.EncodingName==(mixed?"latin1":"utf8"),"large log encoding");
                    Assert(Json.Str(large.Page(0),"text").Contains("\0"),"large sparse NUL readable");
                    Assert(Json.Str(large.Page(large.Count-1),"text").Length>0,"large final segment");
                    string copy=Path.Combine(folder,mixed?"mixed-copy.log":"utf8-copy.log");
                    large.Save(copy,0,true);
                    Assert(File.ReadAllBytes(copy).SequenceEqual(source),"large untouched export preserves bytes");
                    var page=large.Page(0);
                    large.Stage(0,Json.Str(page,"text")+"!");
                    string edited=Path.Combine(folder,mixed?"mixed-edited.log":"utf8-edited.log");
                    large.Save(edited,0,true);
                    Assert(File.ReadAllBytes(edited).SequenceEqual(source.Take(65536).Concat(new byte[]{33}).Concat(source.Skip(65536))),"large edited export");
                }
                if(args.Length>0) {
                    var original=File.ReadAllBytes(args[0]);
                    RoundTrip(original,"latin1","provided log");
                    var result=Core.Decode(original);
                    string copy=Path.Combine(folder,"provided-copy.log");
                    Core.AtomicBytes(copy,Core.Encode(Json.Str(result,"text"),Json.Str(result,"encoding"),false));
                    Assert(File.ReadAllBytes(copy).SequenceEqual(original),"provided log save-copy exact");
                    Assert(File.ReadAllBytes(args[0]).SequenceEqual(original),"provided log source unchanged");
                    Console.WriteLine("Provided log: "+original.Length+" bytes, exact roundtrip verified.");
                }
                Console.WriteLine("PASS "+passed+" assertions");
                return 0;
            } catch(Exception e) { Console.Error.WriteLine(e.Message); return 1; }
            finally { Directory.Delete(folder,true); }
        }
    }
}
