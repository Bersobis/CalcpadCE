## Reporting

All calculations are automatically collected into a professionally formatted calculation report.
You can print it or open it with MS Word for editing.
Besides math expressions, you can add headings, comments, tables and images.

### Headings

A heading is a text, enclosed in double quotes (**"**). It is bold and larger than the main text.

### Text/comments

Comments are enclosed in single quotes (**'**). You can skip the closing quote, if it is the last symbol in the line.
Headings and comments can contain any symbols without restrictions.
Everything outside them is assumed to be math expressions.
However, if you put any formulas inside comments, they will not be calculated or formatted.
Since the final output is rendered to an Html document, you can use Html and CSS in comments to provide your calculation report with additional formatting.

### Units in comments

Alternatively, to native units, you can enter all values to be unitless and then put the units in the comments.
In this case, you will have to include all unit conversion factors in the equations.
Also, there is an option to generate a selection box for length units - **m**, **cm** and **mm**. You only need to insert **%u** in comments wherever you want the units to appear.
When the program generates the input form (see further) it checks whether **%u** exists somewhere in the code.
If so, it automatically adds a unit selection combo box, at the top-right corner.
When you change the units from the combo, they will be filled in all occurrences of **%u** in the code.
You can try it below:

<table style="width:80%;">
<colgroup>
<col style="width: 44%" />
<col style="width: 35%" />
</colgroup>
<thead>
<tr>
<th style="text-align: left;">Code</th>
<th style="text-align: left;">Output</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;">"Units in comments<br />
'Length -'l = ?{1}'%u<br />
'Area -'l = ?{1}'%u&lt;sup&gt;2&lt;/sup&gt;<br />
'Volume -'l = ?{1}'%u&lt;sup&gt;3&lt;/sup&gt;<br />
'Scale factor -'Units</td>
<td style="text-align: left;"><img src="./media/image31.png" style="width:2.19009in;height:1.39208in" /></td>
</tr>
</tbody>
</table>

When you run the calculations, the "Units" combo will disappear from the output.
Only the units will remain as filled.
The program will also create a variable *Units*, which will contain the conversion factor from the selected units to meters.
Its value is 1, 100 and 1000 for m, mm and cm, respectively.
You can use it for units conversion inside the calculations.
For example, you can create a conditional block for displaying the selected units in the report:

  #if *Units* ≡ 1  
    'The selected units are meters  
  #else if *Units* ≡ 100  
    'The selected units are centimeters  
  #else if *Units* ≡ 1000  
    'The selected units are millimeters  
  #end if

### Formatting with Html and CSS

Calcpad can be used as a development platform for professional engineering programs.
If you are not going to do that, you can skip this chapter.

**Html** (Hyper Text Markup Language) is a markup language which is created for formatting web pages.
You can change the font type, size and weight, the color of the text and to insert tables, images, etc.
This is performed by adding special elements called "tags". Each tag is enclosed in angular brackets: "\<tag\>". Some tags are used in pairs - opening "\<tag\>" and closing "\</tag\>". The contents is going in between.
For example, if you want to make some text bold, you can use the following tags: \<b\>**Bold text**\</b\>. Even if you are not a professional programmer, you can easily learn some basic Html, to use with Calcpad:

<table style="width:62%;">
<colgroup>
<col style="width: 41%" />
<col style="width: 20%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Html code</strong></th>
<th style="text-align: center;"><strong>Output</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;"><strong>&lt;h3&gt;</strong>Heading 3<strong>&lt;/h3&gt;</strong></td>
<td>Heading 3</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;h4&gt;</strong>Heading 4<strong>&lt;/h4&gt;</strong></td>
<td>Heading 4</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;h5&gt;</strong>Heading 5<strong>&lt;/h5&gt;</strong></td>
<td>Heading 5</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;h6&gt;</strong>Heading 6<strong>&lt;/h6&gt;</strong></td>
<td>Heading 6</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;hr/&gt;</strong> (horizontal line)</td>
<td style="text-align: center;"><strong>————————</strong></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;p&gt;</strong>Paragraph<strong>&lt;/p&gt;</strong></td>
<td>Paragraph</td>
</tr>
<tr>
<td style="text-align: left;">Line<strong>&lt;br/&gt;</strong>break</td>
<td>Line<br />
break</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;b&gt;</strong>Bold<strong>&lt;/b&gt;</strong></td>
<td><strong>Bold</strong></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;i&gt;</strong>Italic<strong>&lt;/i&gt;</strong></td>
<td><em>Italic</em></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;u&gt;</strong>Underlined<strong>&lt;/u&gt;</strong></td>
<td><u>Underlined</u></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;s&gt;</strong>Struck through<strong>&lt;/s&gt;</strong></td>
<td><del>Struck through</del></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;span style="color:red;"&gt;</strong>Red<strong>&lt;/span&gt;</strong></td>
<td>Red</td>
</tr>
<tr>
<td style="text-align: left;">x<strong>&lt;sup&gt;</strong>superscript<strong>&lt;/sup&gt;</strong></td>
<td>xsuperscript</td>
</tr>
<tr>
<td style="text-align: left;">x<strong>&lt;sub&gt;</strong>subscript<strong>&lt;/sub&gt;</strong></td>
<td>xsubscript</td>
</tr>
<tr>
<td style="text-align: left;"><strong>&lt;span style="font:14pt Times;"&gt;</strong><br />
Times, 14pt<br />
<strong>&lt;/span&gt;</strong></td>
<td>Times, 14pt</td>
</tr>
</tbody>
</table>

You can put Html tags only in comments, but you can also make them affect expressions.
For example:

'\<span style="color:red;"\> as simple as ' 2 + 2 '\</span\>'

will give the following output:

as simple as 2 + 2 = 4

We simply enclosed the expression with two comments.
The first comment contains the opening tag '\<span style="color:red;"\>' and the second - the closing tag '\</span\>'. Everything between the two tags is colored in red.
Make sure not to forget the quotes.
Otherwise, the program will try to parse the Html code as math expression and will return an error.
The following code: style="color:red" is called "inline CSS" (Cascading Style Sheets). It is used to format the look of Html documents.
You can learn more about Html and CSS from the following links:

<http://www.w3schools.com/html/>

<http://www.w3schools.com/CSS/>

You can also use some of the many free WYSIWYG Html editors available on the Internet.

#### Predefined classes

Some formatting that is commonly used in engineering design worksheets is predefined as CSS classes and can be inserted by simply assigning the respective class to Html elements.

**err** - adds red color to text:

> '\<span class="err"\> The check is not satisfied ✖'\</span\>'  
> The check is not satisfied ✖

**ok** - adds green color to text:

> '\<span class="ok"\> The check is satisfied ✔'\</span\>'  
> The check is satisfied ✔

**ref** - (right aligned) it is used for references to design codes and equation numbering:

> '\<span class="ref"\> \[EN 1992-1-1, §9.2.2\]'\</span\>'\[EN 1992-1-1, §9.2.2\]

**bordered** - adds border to tables:

> '\<table class="bordered"\>'...\</table\>'

**data** - makes the first column left aligned and the others - right aligned:

> '\<table class="data"\>'...\</table\>'

#### Content folding

If you have some long and detailed calculations, you can fold them optionally in the output.
They will be hidden by default, except for the first line, which can be used for the section heading.
All you need to do is to enclose the folding section into a Html "**div**" element with class "**fold**", as follows:

> '\<div class="fold"\>  
> '\<b\>Heading\</b\> (click to unfold)  
> 'Content to be folded  
> '\</div\>

The result will look as follows:

> **Heading** (click to unfold) … ▼
>
> Content to be folded

#### Images

Before inserting an image into Calcpad document, you need to have it already as a file.
You can create it by some image editing software and save it to a \*.png, \*.gif or \*.jpg file.
You can use some freeware programs like Paint, Gimp, InkScape, DraftSight or others.
Then you can insert it using Html.
All you need to do is to put the following text at the required place, inside a comment:

> '\<img style="float:right" src="c:/Users/Me/Pictures/Picture1.png" alt="Picture1.png"\>

Of course, instead of "**c:/Users/Me/Pictures/Picture1.png**" you must specify the actual path to your image.
The file can be local, network or on the Internet.
Always use forward slashes "**/**", even if the file is local.
If the image is located in the same folder as the current worksheet, you can specify a relative path as follows: "**./Picture1.png**". The text **style="float:right;"** aligns the image to the right allowing the text to float at left.
Otherwise, the image will become part of the text flow and will make it split.
Alternatively, to **style="float:right"**, you can use **class="side"** for the same purpose.

You can also insert an image using the <img src="./media/image32.png" alt="" height="20"> button from the toolbar.
You will be prompted to select a file.
When you click "**Open**", the required record will be inserted at the beginning of the code.
When you run the calculations, the picture will appear in the output window.

### Formatting with Markdown

[Markdown](https://www.markdownguide.org/) is a simple and lightweight markup language for text formatting.
Unlike Html, it uses individual symbols or short sequences of symbols for tagging.
In Calcpad, you can use Markdown in comments optionally, instead of Html.
Since it requires an additional parsing step, you can switch it on and off by using the following keywords inside your worksheet:

  #md on - switches Markdown mode on;  
  #md off - switches Markdown mode off.

During parsing, the marked text is converted to Html and then passed for further processing.
Since this is performed line-by-line, block level formatting like lists, tables, etc.
are not fully supported.
You can use the following syntax elements:

<table>
<colgroup>
<col style="width: 34%" />
<col style="width: 46%" />
<col style="width: 18%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Markdown code</strong></th>
<th style="text-align: center;"><strong>Html code</strong></th>
<th style="text-align: center;"><strong>Output</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;"><strong>###</strong> Heading 3</td>
<td style="text-align: left;">&lt;h3&gt;Heading 3&lt;/h3&gt;</td>
<td>Heading 3</td>
</tr>
<tr>
<td style="text-align: left;"><strong>####</strong> Heading 4</td>
<td style="text-align: left;">&lt;h4&gt;Heading 4&lt;/h4&gt;</td>
<td>Heading 4</td>
</tr>
<tr>
<td style="text-align: left;"><strong>#####</strong> Heading 5</td>
<td style="text-align: left;">&lt;h5&gt;Heading 5&lt;/h5&gt;</td>
<td>Heading 5</td>
</tr>
<tr>
<td style="text-align: left;"><strong>######</strong> Heading 6</td>
<td style="text-align: left;">&lt;h6&gt;Heading 6&lt;/h6&gt;</td>
<td>Heading 6</td>
</tr>
<tr>
<td style="text-align: left;">--- (horizontal line)</td>
<td style="text-align: left;">&lt;hr/&gt;</td>
<td><strong>———————</strong></td>
</tr>
<tr>
<td style="text-align: left;"><strong>**</strong>Bold<strong>**</strong></td>
<td style="text-align: left;">&lt;strong&gt;Bold&lt;/strong&gt;</td>
<td><strong>Bold</strong></td>
</tr>
<tr>
<td style="text-align: left;"><strong>*</strong>Italic<strong>*</strong></td>
<td style="text-align: left;">&lt;em&gt;Italic&lt;/em&gt;</td>
<td><em>Italic</em></td>
</tr>
<tr>
<td style="text-align: left;"><strong>***</strong>Bold Italic<strong>***</strong></td>
<td style="text-align: left;">&lt;em&gt;&lt;strong&gt;Bold Italic&lt;/strong&gt;&lt;/em&gt;</td>
<td><em><strong>Bold Italic</strong></em></td>
</tr>
<tr>
<td style="text-align: left;"><strong>++</strong>Underlined<strong>++</strong></td>
<td style="text-align: left;">&lt;ins&gt;Underlined&lt;/ins&gt;</td>
<td><u>Underlined</u></td>
</tr>
<tr>
<td style="text-align: left;"><strong>~~</strong>Struck through<strong>~~</strong></td>
<td style="text-align: left;">&lt;del&gt;Struck through&lt;/del&gt;</td>
<td><del>Struck through</del></td>
</tr>
<tr>
<td style="text-align: left;"><strong>==</strong>Highlighted<strong>==</strong></td>
<td style="text-align: left;">&lt;mark&gt;Highlighted&lt;/mark&gt;</td>
<td>Highlighted</td>
</tr>
<tr>
<td style="text-align: left;">x<strong>^</strong>superscript<strong>^</strong></td>
<td style="text-align: left;">x&lt;sup&gt;superscript&lt;/sup&gt;</td>
<td style="text-align: left;">x<sup>superscript</sup></td>
</tr>
<tr>
<td style="text-align: left;">x<strong>~</strong>subscript<strong>~</strong></td>
<td style="text-align: left;">x&lt;sub&gt;subscript&lt;/sub&gt;</td>
<td style="text-align: left;">x<sub>subscript</sub></td>
</tr>
<tr>
<td style="text-align: left;"><strong>`</strong>Code<strong>`</strong></td>
<td style="text-align: left;">&lt;code&gt;Code&lt;/code&gt;</td>
<td>Code</td>
</tr>
<tr>
<td style="text-align: left;"><strong>[Link](</strong>https://mywebsite.com<strong>)</strong></td>
<td style="text-align: left;">&lt;a href="https://mywebsite.com"&gt;Link&lt;/a&gt;</td>
<td><a href="https://mywebsite.com">Link</a></td>
</tr>
<tr>
<td style="text-align: left;"><strong>![Image](</strong>image.jpg<strong>)</strong></td>
<td style="text-align: left;">&lt;img src="image.jpg" alt="Image" /&gt;</td>
<td></td>
</tr>
<tr>
<td style="text-align: left;"><strong>&gt;</strong> Blockquote 1<br />
<strong>&gt;&gt;</strong> Blockquote 2</td>
<td style="text-align: left;">&lt;blockquote&gt;Blockquote 1<br />
&lt;blockquote&gt;Blockquote 2<br />
&lt;/blockquote&gt;&lt;/blockquote&gt;</td>
<td><blockquote>
<p>Blockquote 1</p>
<p>Blockquote 2</p>
</blockquote></td>
</tr>
</tbody>
</table>

### 

### Formatting Toolbar

The formatting toolbar is located just above the code editing box.
It allows fast insertion of formatting markup in comments.
It supports both Html or Markdown, depending on your choice.
To enable Markdown, switch the **M⭣** button on.
Also, do not forget to add "#md on" on top of your worksheet.

<img src="./media/image33.png" style="width:6.69306in;height:0.31528in" />

The formatting toolbar includes the following commands:

  H3 - Heading 3 (Ctrl+3), Html: \<h3\>...\</h3\>, Markdown: ###...

  H4 - Heading 4 (Ctrl+4), Html: \<h4\>...\</h4\>, Markdown: ####...

  H5 - Heading 5 (Ctrl+5), Html: \<h5\>...\</h5\>, Markdown: #####...

  H6 - Heading 6 (Ctrl+6), Html: \<h6\>...\</h6\>, Markdown: ######...

   p - Paragraph (Ctrl+L), Html: \<p\>...\</p\>, Markdown: not supported

   br - Line Break (Ctrl+R), Html: ...\<br/\>..., Markdown: not supported

   **B** - Bold (Ctrl+B), Html: \<strong\>...\</strong\>, Markdown: \*\*...\*\*

   *I*  - Italic (Ctrl+I), Html: \<em\>...\</em\>, Markdown: \*...\*

   <u>U</u>  - Underline (Ctrl+U), Html: \<ins\>...\</ins\>, Markdown: ++...++

   ~~S~~  - Strikethrough (no shortcut), Html: \<del\>...\</del\>, Markdown: \~~...\~~

   x<sub>2</sub> - Subscript (Ctrl+"+"), Html: \<sub\>...\</sub\>, Markdown: ~...~

   x<sup>2</sup> - Superscript (Ctrl+Shift+"+"), Html: \<sup\>...\</sup\>, Markdown: ^...^

   R - Red Color (no shortcut), Html: \<span class="err"\>...\</span\>,  
Markdown: not supported

   G - Green Color (no shortcut), Html: \<span class="ok"\>...\</span\>,  
Markdown: not supported

   ‹/› - Span (no shortcut), Html: \<span\>...\</span\>, Markdown: not supported

  div - Div (no shortcut), Html: \<div\>...\</div\>, Markdown: not supported

   ▼ - Folded Div (no shortcut), Html: \<div class="fold"\>...\</div\>,  
Markdown: not supported

  ⋮☰ - Bulleted List (Ctrl+Shift+L),  
Html: \<ul\>\<li\>...\</li\>\<li\>...\</li\>\<li\>...\</li\>\</ul\>,  
Markdown: not supported

1.➖

2.➖

   🖼 - Image (no shortcut),  
 Html: \<img style="height:...; width:..." src="..." alt="..."\>,  
 Markdown: not supported

   ▦ - Table (no shortcut), Html:  
\<table class="bordered"\>  
\<thead\>\<tr\>\<th\>...\</th\>\<th\>...\</th\>\</tr\>\</thead\>  
\<tbody\>  
\<tr\>\<td\>...\</td\>\<td\>...\</td\>\</tr\>  
\<tr\>\<td\>...\</td\>\<td\>...\</td\>\</tr\>  
\</tbody\>  
\</table\>,  
Markdown: not supported

   — - Horizontal line (no shortcut), Html: \<hr/\>, Markdown: ---

To apply a formatting tag to a certain part of the text, select the part first and then press the respective button.
If you press it once again, you will remove the existing formatting of the same type.
Calcpad supports word autoselection.
If you click inside a word and press a formatting button, it is applied for the whole word.
