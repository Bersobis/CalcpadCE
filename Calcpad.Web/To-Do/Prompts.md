Generate string variables that act during ExpressionParser using #string s$ = '123' for a definition

Strings act as macros that replace s$ with '123' and should be fully resolved before it is passed to MathParser. However, MacroParser needs to be fully resolved before strings are substituted. This is why they need to run at ExpressionParser, and they need to work within #for, #if, etc. statements.

Feature Summary:

Current strings in Calcpad are immutable. The goal of this feature is to allow dynamic strings that work with functions, conditional checks, and loops.
Implementation Details:

Definition:

#string s$ = 'text content'
#table t$ = table$(2;3) -> makes new table and fills with empty strings
#table t$ = ['text11'; 'text12'; 'text13' | 'text21'; 'text22'; 'text23']
Changing values (should be possible for strings):

s$ = 'new text content'
t$(1; 1) = 'text11'
t$(1; 2) = 'text12'
t$(i; j) = 'text'i','j
...
Generation of input forms:

#string s$ = ? {'default content'} - generates a single text input field.
#table(2; 3) t$ = ? {['text11'; 'text12'; 'text13' | 'text21'; 'text22'; 'text23']} - generates an editable Html table to enter values in cells.
Output:
string$ - directly inserts the content of the string
table$ - directly inserts the content of the table as formatted bordered html table (class="bordered").

String Functions:

'Conversion Functions
'NOTE: how units are handled within these functions needs to be discussed. Ideally, a parameter or different function should define how units are handled during conversions.
scalar = val$(string$) -> gets scalar value from string
matrix = val$(table$) -> gets matrix value from string table
string$ = string$(scalar) -> gets string from scalar value
matrix$ = string$(matrix) -> gets table from matrix value

'Identity and substring functions
length = len$(string$) -> returns length of string as a scalar
pos = instr$(startPos; base_string$; search_string$) -> returns first position of substring in a string, 0 if not found
l$ = left$(s$; count) -> returns left 'count' chars from a string
r$ = right$(s$; count) -> returns right 'count' chars from a string
m$ = mid$(s$; start; count) -> returns  'count' chars from a string using 'start' as a position
string$ = trim$(string$) -> remove spaces from left and right sides of a string
string$ = ltrim$(string$) -> remove spaces from left side of a string
string$ = rtrim$(string$) -> remove spaces from right side of a string
string$ = space$(count) -> returns 'count' number of spaces
index = find$('ab'; 'abcab') -> [1;4] (finds all indexes of a substring in a string)

'Manipulation functions
new_string$ = replace$('old_string string'; 'old_string'; 'new_string') -> 'new_string string' (replaces all matches)

'String array functions
string$ = concat$(s1$; s2$; 'some literal') -> s1$s2$'some literal'
string$ = join$(table$; row_delimiter$; col_delimiter$) -> join table into a single string using a row and/or column delimiter. Using an empty string as the col_delimiter will return a flattened array.
table$ = split$(string$; row_delimiter$; col_delimiter$) -> split string into a table using a row and column delimiter. Using an empty string as the delimiter will return just a row or column table.

'Case functions
upper_case_string$ = ucase$(string$) -> converts string to UPPERCASE
lower_case_string$ = lcase$(string$) -> converts string to lowercase

'Comparison function
result = compare$(string1$; string2$) -> -1, 0 or 1
Results:
-1	string1$ comes before string2$	'Apple' vs 'Banana'
0	Both strings are identical	'Apple' vs 'Apple'
1	string1$ comes after string2$	'Banana' vs 'Apple'

'Data functions

'JSON parsing -> if a string or object is returned, set it as a string.
#string json$ = {"key":"value", "nested":{"key":["item1"]}}
value$ = parsejson$(json$; "key") -> 'value'
nestedValue$ = parsejson$(json$; "nested["key"][0]") -> 'item1'
objectReturn$ = parsejson$(json$; "nested") -> '{"key":["item1"]}'
Additional classes may be required to handle the behavior of the new types: String.cs, Table.cs, StringFunctions.cs, etc.

Start by implementing strings and basic string functions, then we will get to tables, json function, and split (which returns a table)