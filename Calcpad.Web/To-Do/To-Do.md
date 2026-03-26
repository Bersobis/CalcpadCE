# To-Do

## General

- Make changelog.md that goes through git diffs and makes changes between versions
- Add better documentation for using vs code features

## vscode-calcpad

### Enhancements
- Finish enhanced PDF generation
- Could we have a Vue panel that activates when the cursor is inside a JSON HTML comment? Where you can edit properties and then the line gets updated based on what you put into the UI? This could also work for editing #UI properties
- Add the ability to focus the preview to the line selected in the code. Add a toggle to automatically sync this in the Vue panel.
- Switch Vue tabs from text to icons now that they are getting longer.
- Implement user defined variable, units, function, and macro definitions using html comment before the #def line (e.g. cmt$({"description": "This macro does this.\nparam1 is the thing..."})). Add tooltip for these that uses the description.
- Test linter for advanced issues
- Add quick typing for macros (~1 macro 1, ~2 macro 2, etc.). Add macro mapping to vscode config using json object {macroMapping:{"1": "macroName$", ...}}. Have VS code set cursor position to within () and before first param.
- Package extension for further testing within the company. Publish to Open VSX but not Visual Studio Marketplace unless I need a personal Azure account for other reasons
- Fix line links to use source line mapping - this may be fixed? If I run into it again, give test case
- Add prettify command that does the same thing as eat space and auto-indenting. However, the automatic behavior is not preferred.
- Add intermediate step that changes the display name of a variable by using find and replace on the HTML content. This will need some processing of complex characters, for example _ turns into a subscript in the HTML. Read how Calcpad.Core handles this and reverse-engineer it. This can use a displayName property in an HTML comment above the variable definition line. Alternatively, have a variable mapping object as part of the settings and have it change the variable name at the HTML output step.

### Bugs

### Testing
- Make refresh button check if the server is down and restart it if it crashes. See if it is possible to put the server in a try/catch loop and send the crash message to the client output. Have this on 3 retries before requiring a manual refresh and give the user a pop-up so they know it crashed due to something in their file.
- Give a warning for inserting base64 over a certain filesize. Have the linter truncate base64 before processing.
- Add button that auto-downloads the .NET runtime into the extension folder with slim build options if the user doesn't want to install the .NET runtimes locally
- Make sure long API calls are awaited and do not freeze the UI
- Check if the cache needs cleared on intervals


## Calcpad.Web
- Do a deep investigation on what is needed to avoid DDoS, provide extra security to the backend, and provide file size/rate limits/etc.
- Add exception handling for filesize limits on API endpoints.
- Finish adding CalcpadAuth to Calcpad.Server.
- CalcpadS3 should remain its own project (with a frontend built into vs code). However, make config in Calcpad.Core that allows #include and #read to directly pull files from s3. Example: #include myfile.cpd should check 1. Local files, 2. File cache sent from client. 3. CalcpadS3 if config is available.
- Write/Append should prompt a ZIP download when using Calcpad.Server with the Linux build rather than appending to the local filepath (for Docker, this makes no sense). Make an endpoint to do this and add a button to vscode. Add a setting to Calcpad.Core to control if write/append content is cached for download or directly affecting files.
- Make Docker config that allows using MinIO or external S3 provider. 
- Add password or OAuth to Docker.
- Add cloudflare tunnel config as option in Docker.
- Refactor CalcpadAuth routing to work with <service:endpoint> structure and make router.json config to work with any API calls (such as GET vs POST and auth/content type headers). Body is passed from Calcpad itself.
- Add token management config with auth endpoints for various tokens. MAKE SURE TOKENS ARE ONLY STORED IN SERVER MEMORY AND SELECTED BASED ON CONFIG SETTINGS. Use handlebars {{jwt.calcpad}} syntax to select which token to use in API calls. This is the only time handlebars are needed (anything only in server program memory), as all other params should be passed from Calcpad as JSON in the body of the request.
- Don't add getting JS variables as string, instead, use the authenticated API to do complex intermediate steps with JS or C# via server-based deployments. This is more reliable and secure.

### Bugs
- Modules\Geometry\geometryFunctions.cpd crashes the server, add better error handling/messaging and restart behavior for the server and fix the bug that crashes it.

### Testing

- Test snippet updates
- Add disk based caching above a certain file size to prevent using too much memory.

## Calcpad.Highlighter
- Highlighter is going to have issues with string variables and content resolution. I may need to add some content resolution to Calcpad.Core so I can get a more accurate state of variables and macros. This may also make tokenizing way easier as I don't have to re-parse as much code and can use the existing tokenizer in Core. One downside to this is Core handles ExpressionParser differently than the current tokenizer, which largely ignores it. I may also need a map of #for loops/#if statements, etc. that get run to tie it back to the line in the source code. Being able to define variables in a #for loop with a different name using string manipulation is going to require me to change my approach and either surpress warnings that come from complex cases like this or utilize Core to provide string variable values for linting content.
- Add information check for re-defining a variable as a different type
- Add linting checks for empty parameters, parameters must at least have a space if there is no value
- There is an issue with tokenization of global variables in macro #def statements. You need to get global scopes and properly tokenize them if it gets defined later in the file.
- Go To Definition and Find All References is broken across links
- Add parsing of metadata lines for macro descriptions and parameter descriptions/type hinting. Metadata lines contain inline or multiline JSON that external programs can pull from cpd files but are ignored by the parser. Metadata lines occur when there is JSON in an HTML comment
- Improve HTML/JS/CSS/SVG tokenization to use JS library. Use the node instance in vscode (also this is only needed as a vs code feature).
- Add HTML/JS/CSS/SVG linting using a JS library (also this is only needed as a vs code feature). This is done using the HTML preview, but I need to add a plugin config to make all of these work to the docs.
- Add undefined macro linter check
- Fix tokenization of macro syntax for highlighting/checking potential macros: cmt$('  w_req$:   Output variable name for required weld leg size')
- θ = 0°note$('Load parallel to weld axis'), degree symbol is tokenized as macro instead of unit
- Allow rename of global variables inside macro defs - this may be an undefined variable linter bug? But this should not run at stage 2 anyways.
- Scan for #if/#else mismatches in macro definitions
- Make auto-indenting work inside macro definitions - this works in some cases but not others, prettifier should handle this.

### Bugs
- Fix HTMLComment tokenization
- Fix ' symbol tokenization in JS:
#def drawLine$(x1$; y1$; x2$; y2$)
	'<script type="module">
	'if (window.dxfDrawing) { window.dxfDrawing.drawLine('x1$', 'y1$', 'x2$', 'y2$'); }
	'</script>
#end def

## Calcpad.Core

- Add features in JSUpdates.md
- Add keyword arguments for builtin functions
- Add Unit safety for angles by having arc functions return the unit based on the default setting (instead of a number with no unit)
- Add a way to throw custom errors in command block expressions
- Handle this better so it allows undefined in inline loops. Have the graph either show a vertical asymtote or ignore undefined values:
```
f(x) = $Repeat{1/i @ i = x : 10}
f(0)
```


### Testing
- Catch self-referential includes crashing the program
- Test Excel remote URL reading.
- Make keyword arguments in functions and macros. If a keyword argument is used, have the linter check the macro against the default values for type mismatch errors.
- Add string$() function argument that gives the return mode for the expression in the string. It should allow with or without units
- Add typeOf$() function that returns the type of an expression as a string

## Calcpad Modules

- DXF: Is there a way to get a CDN like import for JS libraries using #include in calcpad? This version has a text fix that is not in the CDN version
- DXF: Add lineweight by using an offset line in the rendered version and rounding the ends by adding the length equal to the offset.
- Geometry: Map RFEM nodes to polylines, map RFEM polylines to surfaces. Use order of lines to determine axis and match RFEM. Use this to get pressures.