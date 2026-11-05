using System;
using System.Linq;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace Jianwen {
    internal static class Spelling {
        [ComImport,Guid("8E018A9D-2415-4677-BF08-794EA61F94BB"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFactory {
            void Languages(out IEnumString languages);
            void Supported([MarshalAs(UnmanagedType.LPWStr)] string tag,[MarshalAs(UnmanagedType.Bool)] out bool supported);
            void Create([MarshalAs(UnmanagedType.LPWStr)] string tag,out IChecker checker);
        }
        [ComImport,Guid("B6FD0B71-E2BC-4653-8D05-F197E412770B"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IChecker {
            void Language([MarshalAs(UnmanagedType.LPWStr)] out string tag);
            void Check([MarshalAs(UnmanagedType.LPWStr)] string text,out IErrors errors);
            void Suggest([MarshalAs(UnmanagedType.LPWStr)] string word,out IEnumString suggestions);
            void Add([MarshalAs(UnmanagedType.LPWStr)] string word);
            void Ignore([MarshalAs(UnmanagedType.LPWStr)] string word);
            void AutoCorrect([MarshalAs(UnmanagedType.LPWStr)] string from,[MarshalAs(UnmanagedType.LPWStr)] string to);
        }
        [ComImport,Guid("803E3BD4-2828-4410-8290-418D1D73C762"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IErrors { [PreserveSig] int Next(out IError error); }
        [ComImport,Guid("B7C82D61-FBE8-4B47-9B27-6C0D2E0DE0A3"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IError { void Start(out uint start);void Length(out uint length);void Action(out int action);void Replacement([MarshalAs(UnmanagedType.LPWStr)] out string replacement); }
        private static void Release(object value){if(value!=null && Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
        private static string[] Strings(IEnumString values,int max) {
            var result=new List<string>();var one=new string[1];IntPtr fetched=Marshal.AllocCoTaskMem(4);
            try{while(result.Count<max && values.Next(1,one,fetched)==0)result.Add(one[0]);}finally{Marshal.FreeCoTaskMem(fetched);Release(values);}return result.ToArray();
        }
        private static IFactory Factory(){return (IFactory)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("7AB36653-1796-484B-BDFA-E74F1DB7C1DC")));}
        public static object Languages(){IFactory factory=null;try{factory=Factory();IEnumString list;factory.Languages(out list);return Json.Obj("languages",Strings(list,100));}catch(Exception e){return Json.Obj("languages",new string[0],"unavailable",Core.Error(e));}finally{Release(factory);}}
        public static object Check(string text,string tag){
            if(text.Length>24000)throw new Exception("拼写检查每次仅处理可见文本。");
            IFactory factory=null;IChecker checker=null;IErrors errors=null;
            try{
                factory=Factory();bool supported;factory.Supported(tag,out supported);if(!supported)throw new Exception("Windows 未安装该语言的拼写词典，请在系统语言设置中安装。");
                factory.Create(tag,out checker);checker.Check(text,out errors);var result=new List<object>();IError error;
                while(result.Count<100 && errors.Next(out error)==0 && error!=null){
                    try{uint start,length;int action;string replacement;error.Start(out start);error.Length(out length);error.Action(out action);error.Replacement(out replacement);
                        if(start+length>text.Length||length==0)continue;
                        IEnumString suggestions;checker.Suggest(text.Substring((int)start,(int)length),out suggestions);
                        result.Add(Json.Obj("start",start,"length",length,"action",action,"replacement",replacement,"suggestions",Strings(suggestions,5)));
                    }finally{Release(error);}
                }return Json.Obj("issues",result);
            }finally{Release(errors);Release(checker);Release(factory);}
        }
    }
}
