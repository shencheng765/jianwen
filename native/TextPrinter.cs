using System;
using System.Drawing;
using System.Drawing.Printing;
using System.Windows.Forms;
using System.IO;
using System.Text.RegularExpressions;
using System.Text;

namespace Jianwen {
    internal sealed class TextPrinter : IDisposable {
        private readonly PrintDocument document = new PrintDocument();
        private readonly string text;
        private readonly Func<TextReader> open;
        private TextReader reader;
        private string buffered="";
        private readonly Font font;
        private int offset;
        private int page;
        public string Header="",Footer="";
        public PageSettings Settings { get { return document.DefaultPageSettings; } }
        public TextPrinter(string content, string name, string family, float size) {
            text = content; document.DocumentName = name;
            try { font = new Font(family, Math.Max(8, Math.Min(72, size))); }
            catch { font = new Font(FontFamily.GenericMonospace, 10); }
            document.BeginPrint += delegate { offset = 0;page=0;buffered="";if(reader!=null){reader.Dispose();reader=null;} };
            document.PrintPage += Page;
        }
        public TextPrinter(Func<TextReader> source,string name,string family,float size):this("",name,family,size){open=source;}
        private string Expand(string value){return Regex.Replace(value,@"&[fpdt&]",m=>{switch(m.Value.ToLowerInvariant()){case "&f":return document.DocumentName;case "&p":return page.ToString();case "&d":return DateTime.Now.ToShortDateString();case "&t":return DateTime.Now.ToShortTimeString();default:return "&";}},RegexOptions.IgnoreCase);}
        private void DrawLabel(Graphics graphics,string value,Rectangle bounds,float top){
            var sections=new[]{new StringBuilder(),new StringBuilder(),new StringBuilder()};int alignment=1;
            for(int i=0;i<value.Length;i++){if(value[i]=='&'&&i+1<value.Length){char next=Char.ToLowerInvariant(value[i+1]);if(next=='l'||next=='c'||next=='r'){alignment=next=='l'?0:next=='c'?1:2;i++;continue;}if(next=='&'){sections[alignment].Append("&&");i++;continue;}}sections[alignment].Append(value[i]);}
            for(int i=0;i<3;i++)if(sections[i].Length>0)using(var format=new StringFormat{Alignment=(StringAlignment)i})graphics.DrawString(Expand(sections[i].ToString()),font,Brushes.Black,new RectangleF(bounds.Left,top,bounds.Width,font.GetHeight(graphics)*1.6f),format);
        }
        private void Page(object sender, PrintPageEventArgs e) {
            var bounds = e.MarginBounds;
            page++;
            if(Header.Length>0)DrawLabel(e.Graphics,Header,bounds,Math.Max(0,bounds.Top-font.GetHeight(e.Graphics)-8));
            if(Footer.Length>0)DrawLabel(e.Graphics,Footer,bounds,bounds.Bottom+8);
            using (var format = new StringFormat(StringFormat.GenericTypographic)) {
                format.FormatFlags |= StringFormatFlags.LineLimit;
                // GDI+ can fail on very long unbroken strings; bound each layout batch.
                if(reader==null)reader=open==null?new StringReader(text):open();
                if(buffered.Length<4098){var chunk=new char[4098-buffered.Length];int total=0,n;while(total<chunk.Length&&(n=reader.Read(chunk,total,chunk.Length-total))>0)total+=n;buffered+=new string(chunk,0,total);}
                string remaining=buffered.Substring(0,Math.Min(buffered.Length,4096));
                int chars, lines;
                e.Graphics.MeasureString(remaining, font, bounds.Size, format, out chars, out lines);
                if (chars == 0 && remaining.Length > 0) throw new InvalidOperationException("纸张可打印区域过小，请调整页边距。");
                if (chars > 0 && chars < buffered.Length && Char.IsHighSurrogate(buffered[chars - 1])) chars--;
                if (chars > 0 && chars < buffered.Length && buffered[chars - 1] == '\r' && buffered[chars] == '\n') chars--;
                if (chars == 0 && remaining.Length > 0) throw new InvalidOperationException("纸张可打印区域无法容纳字符，请调整页边距。");
                e.Graphics.DrawString(remaining.Substring(0, chars), font, Brushes.Black, bounds, format);
                offset += chars;buffered=buffered.Substring(chars); e.HasMorePages = buffered.Length>0 || reader.Peek()>=0;
            }
        }
        public void Show(IWin32Window owner) {
            using (var dialog = new PrintDialog { Document = document, UseEXDialog = true, AllowSomePages = false }) {
                if (dialog.ShowDialog(owner) == DialogResult.OK) document.Print();
            }
        }
        public bool Setup(IWin32Window owner){using(var dialog=new PageSetupDialog{Document=document,EnableMetric=true})return dialog.ShowDialog(owner)==DialogResult.OK;}
        public void Dispose() { if(reader!=null)reader.Dispose();document.Dispose(); font.Dispose(); }
    }
}
