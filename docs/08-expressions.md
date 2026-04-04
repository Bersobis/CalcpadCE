## Expressions

The main purpose of Calcpad is to perform calculations.
That is why, everything inside the input window is assumed to be mathematical expressions, unless it is enclosed in quotes.
Then it is treated as comments.
By default, each expression has to be in a separate line, e.g.:

> 2 + 3
>
> 5\*(3+1)
>
> 15/2

You must not add "=" at the end of each expression.
This is the assignment operator.
It is used to assign values to variables, e.g. "*a* = 2". Press the <img src="./media/image6.png" alt="" height="20"> button, to see the results in the output window:

> 2 + 3 = 5
>
> 5∙(3 + 1) = 20
>
> 15/2 = 7.5

Alternatively, you can have several expressions in a single line, but they must be separated by comments, e.g.:

'Length -'*a* = 3m', Width -'*b* = 2\**a*', Height -'*c* = 5m

On the other hand, if an expression is too long and complex, you can split it into several lines by adding line continuation operator " \_" at the end of each line.
You can split a line without adding " \_" always when it ends with an opening bracket: "{", "(", "\[" or delimiter: ";", "\|", "&", "@", ":" that is not inside a comment.

Each expression can include constants (numbers), variables, operators, functions and brackets.
They must be arranged properly in order to represent a valid expression.
The commonly accepted mathematical notation and operator precedence is used as it is taught in school.
Detailed description of the expression components is provided below.

You can calculate separate unrelated expressions like with simple calculator or write a complete program that solves a specific problem.
You can define variables and assign values to them.
Further, you can use them to define other variables and so on until you reach the final result.
You can also add text, Html and images to create detailed and professional-looking calculation report.
You can save it to a file and use it multiple times to solve similar problems.
Below, you can see a sample program for solving a quadratic equation:

<img src="./media/image19.png" style="width:6.69375in;height:2.89236in" alt="Sample1" />

### Constants

#### Real

Real constants can be positive and negative integer and decimal numbers.
They can include digits "**0**" - "**9**" and decimal point "**.**". You can also enter numbers as fractions like "**3/4**". However, the program will treat them as expressions (division of two numbers). You cannot define numbers in floating point format: "**3.4e+6**". You have to use an expression like "**3.4\*10^6**" instead.

All constants and variables are internally stored as "double-precision floating point" numbers.
Their values are ranged from **-1.7976931348623157E+308** to **1.7976931348623157E+308**. If a result is out of the above interval, the program returns "-∞" or "+∞, respectively". Division by zero gives the same result, but "**0/0**" = "Undefined". The smallest positive number is **4.94065645841247E-324**. Smaller values are rounded exactly to 0.

#### Complex

If you select "**Complex**" mode, you can use complex numbers in calculations.
Otherwise, only real arithmetic is applied.
Each complex number is represented by the ordered couple (**a**; **b**), where "**a**" is real number, and "**b** = \|**b**\|·***i***" is called "imaginary". It can be written in so called algebraic form: ±**a** ± **b*i*** (e.g. "2 + 3*i*"). You can also use other forms, such as polar or exponential form, by entering the respective expressions.
In Calcpad, the imaginary unit can be entered either as "*i*" or as "1*i*" in case you have a variable named "*i*". It is a special number that satisfies the expression *i*2 = -1.

##### Custom

You can declare any variable or function as constant (readonly) by adding "#const" before its definition.
For example:

> \#const γ = 0.57721566490153286
>
> \#const f(x) = x^2

After that, any attempt to assign a new value to the variable or new expression to the function throws an error message.

### Variables

A variable is defined by its name and value using expressions like "*a* = 4". The "**=**" symbol is the assignment operator.
On the left side, only a single variable name is allowed.
On the right side, you can have any valid mathematical expression, e.g. "*b* = *a* + 4". A variable "lives" from the place of its definition to the end of the program.
That is why you cannot use a variable before it is defined.
This will raise an error.
If you redefine an existing variable with a new value, it will replace the old one and the new value will be used further on.

Variable names can include small or capital Unicode letters and digits.
Names are case sensitive.
For example, "*a*" and "*A*" are different variables.
A name must start with a letter or ∡. superscripts: " **⁰** " - " **⁹** ", " **ⁿ** ", " **⁺** ", " **⁻** ", subscripts: subscripts: " **₀ **" - " **₉ **", " **₊** ", " **₋** ", " **₌** ", " **₍** ", " **₎** " ; and other symbols: " **′** ", " **″** ", " **‴** ", " **⁗** ", " **ø** ", "**Ø**", " **°** ", "**∡**". The first occurrence of an underscore in a name starts a subscript.
For example, "a_1_1" will be formatted as "*a*1_1". Variables can store either real or complex numbers (in "Complex" mode).

### Operators

The following operators are supported by the Calcpad language:

- Arithmetic:

> "**!**" - factorial;
>
> "**^**" - exponentiation;
>
> "**/**" - floating point division;
>
> "**\\**" - integer division;
>
> "**÷**" - force division bar in inline mode and slash in pro mode (//);"⦼" - modulo (%%, remainder);
>
> "**\***" - multiplication;
>
> "**-**" - subtraction;
>
> "**+**" - addition;

- Relational (comparison):

> "≡" - equal to (==);
>
> "≠" - unequal to (!=);
>
> "**\<**" - less then;
>
> "**\>**" - greater than;
>
> "≤" - less or equal (\<=);
>
> "≥" - greater or equal (\>=);

- Logical:

> "∧" - logical "AND" (&&);
>
> "∨" - logical "OR" (\|\|);
>
> "⊕" - logical “XOR” (^^);

- Complex:

> "**∠**" - phasor A∠φ (\<\<);

- <span id="_Toc198414438" class="anchor"></span>Assignment:

> "**=**" - assignment or definition of a variable, function or macro;
>
> "**←**" - assignment to an outer level or global variable in block (\<\*).

#### Operator shortcuts

Instead of "≡", "≠", "≤"- and "≥", you can use the respective C-style equivalent operators, as follows: "==", "!=", "\<=" and "\>=". They will be automatically replaced by the corresponding Calcpad operators.
The shortcut “%%” will be converted to the modulo operator “⦼”. This is necessary because “%” is reserved for the percent units.
Since this symbol is not very common, it is rendered as “mod” in the output, e.g. “7 mod 5 = 2”, instead of “7 ⦼ 5 = 2”.  in a similar way, double slash "//" is a shortcut for division bar "÷" operator.
Boolean operators also have shortcuts for easier typing: "&&" for "∧" (AND), "\|\|" for "∨" (OR) and "^^" for "⊕" (XOR).

#### Operator precedence and associativity

The above operators are listed in the order of their precedence.
This is the order they will be evaluated in an expression.
When you have different types of operators in a single expression, exponentiation will be evaluated first, then division and multiplication, subtraction and addition and comparison will be the last.
When we have a unary minus and exponentiation, the exponentiation is evaluated first.
For example: "-2^2 = -(2^2) = -4" All relational operators are of equal precedence.
If you need to change the order of evaluation, you can use brackets.
For example, "5 + 2∙3" makes "11". If the addition has to be first, write "(5 + 2)∙3". You will get "7∙3 = 21". Operators with equal precedence are evaluated from left to right.
This is called operator associativity.
For example, "3 - 2 + 1" makes "(3 - 2) + 1 = 2" and not "3 - (2 + 1) = 0". Another good example is "2∙3 / 2∙3", which makes "9" and not "1".

All operators in Calcpad are left-associative (calculations are performed from left to right). The only exception is exponentiation, which is right-associative.
It is performed from right to left, which means that *x*^*a*^*b* will be evaluated as *x*ab.
However, many hand calculators and spreadsheet software like Excel use left associativity for exponentiation.
In this case *x*^*a*^*b* will be evaluated as *x*a·b. If you need to have *x*ab, you will have to add brackets: *x*^(*a*^*b*).

#### Relational expressions

Relational operators can return only two values: "**1**" for "**true**" and "**0**" for "**false**". You can use them in expressions along with arithmetic operators.
For example, you can get the greater of two numbers *a* and *b* by the expression: "*a*\*(*a* ≥ *b*) + *b*\*(*a* \< *b*)". But you need to be careful.
If you use "≤" instead of "**\<**", for the case of *a* equal to *b*, you will get *a* + *b*, which may be not exactly what you want.
For that special purpose, it is better to use the built-in function **max**(*a*; *b*), logical operators or conditional execution (look further in this manual). Arithmetic operators are of higher precedence than relational, and both are evaluated before logical ones.

#### Logical expressions

Calcpad operates only with numerical data and does not have special types for boolean data.
Like relational ones, logical operators also use "**1**" for "**true**" and "**0**" for "**false**". Any input value, different than 0, is also assumed to be "**true**". You can build logical expressions by using logical operators and/or logical functions (see further in this manual). They work as follows:

> "**∧**" (and) returns 1 if both operands are 1 and 0 otherwise;
>
> "**∨**" (or) returns 1 if any of the operands is 1 and 0 if both are 0;
>
> "**⊕**" (xor) returns 1 if just one of the operands is 1 and 0 otherwise.

The results from the above operators are presented in the following tables:

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 32%" />
<col style="width: 33%" />
</colgroup>
<tbody>
<tr>
<td><p><strong>And</strong></p>
<table style="width:20%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 6%" />
<col style="width: 7%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>x∧y</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
</tbody>
</table></td>
<td><p><strong>Or</strong></p>
<table style="width:20%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 5%" />
<col style="width: 7%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>x∧y</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
</tbody>
</table></td>
<td><p><strong>Xor</strong></p>
<table style="width:20%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 6%" />
<col style="width: 7%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>x∧y</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
</tr>
</tbody>
</table></td>
</tr>
</tbody>
</table>

#### Complex arithmetic

All operators support complex numbers except for factorial "**!**", integer division "**\\**", remainder "⦼" and comparison: "**\<**", "**≤**", "**\>**", "**≥**". The evaluation of a complex expression is a little bit more difficult than real.
The rules for the basic complex operations are given below:

- Addition: (a + b*i*) + (c + d*i*) = (a + c) + (b + d)*i*;

- Subtraction: (a + b*i*) − (c + d*i*) = (a − c) + (b − d)*i*;

- Multiplication: (a + b*i*)·(c + d*i*) = (ac − bd) + (bc + ad)*i*;

- Division: (a + b*i*)/(c + d*i*) = (ac + bd)/(c2 + d2) + (bc − ad)/(c2 + d2)*i*;

### Brackets

Brackets are used in two cases: to change the order of calculations and to enclose arguments of functions.
Only round brackets are allowed: "**(**" and "**)**". The software checks if the following rules are satisfied for each expression:

- The first bracket in an expression must be a left one;

- The count of left and right brackets must be equal;

- Only operator or function identifier are allowed before a left bracket;

- Right bracket is not allowed after operator or function identifier;

- A function identifier always must be followed by a left bracket.

Calcpad uses "smart" bracket insertion while rendering the output.
It means that brackets, which are duplicate or do not affect the order of calculations, are omitted from the output.
On the other hand, there are places where brackets are added for clarity, although not required in the input.
It happens mostly when negative or complex variables are substituted.
For example:

- If *a* = -2, then *a*2 = (-2)2 = 4, and not *a*2 = -22. The second case is ambiguous, and the sign can be applied after the exponentiation which will evaluate to -4. Also, brackets are added to exponentiation of a complex variable;

- If *a* = -2, then *b* = -*a* = -(-2) = 2, and not *b* = -*a* = --2 = 2;

- Brackets are also added in the case of multiplication and division to a negative variable: *a*·*b* = -2·(-3) = 6;

- Brackets are required almost every time we have to substitute complex variables: *a*·*b* = (2 + 3*i*)·(3 - 2*i*) = 12 + 5*i*.

### Functions

#### Library (built-in) functions

Calcpad includes a library with common math functions, ready to use:

- Trigonometric:

> **sin**(*x*) - sine;  
> **cos**(*x*) - cosine;  
> **tan**(*x*) - tangent = **sin**(*x*)/**cos**(*x*), for each *x* ≠ kπ, k=1, 2, 3…;  
> **csc**(*x*) - cosecant = 1/**sin**(*x*), for each *x* ≠ kπ, k=1, 2, 3…;  
> **sec**(*x*) - secant = 1/**cos**(*x*), for each *x* ≠ π/2 + kπ, k=1, 2, 3…;  
> **cot**(*x*) - cotangent = **cos**(*x*)/**sin**(*x*), for each *x* ≠ π/2 + kπ, k=1, 2, 3…;

- Hyperbolic:

> **sinh**(*x*) - hyperbolic sine = (e*x* - e-*x*)/2;  
> **cosh**(*x*) - hyperbolic cosine = (e*x* + e-*x*)/2;  
> **tanh**(*x*) - hyperbolic tangent = (e*x* - e-*x*)/(e*x* + e-*x*);
>
> **csch**(*x*) - hyperbolic cosecant = 1/**sinh**(*x*);  
> **sech**(*x*) - hyperbolic secant = 1/**cosh**(*x*);  
> **coth**(*x*) - hyperbolic cotangent = (e*x* + e-*x*)/(e*x* - e-*x*), for *x* ≠ 0;

- Inverse trigonometric:

> **asin**(*x*) - inverse sine, defined for -1 ≤ *x* ≤ 1;  
> **acos**(*x*) - inverse cosine, defined for -1 ≤ *x* ≤ 1;  
> **atan**(*x*) - inverse tangent;  
> **atan2**(*x*; *y*) - the angle whose tangent is the quotient of *y* and *x*;  
> **acsc**(*x*) - inverse cosecant = **asin**(1/*x*);  
> **asec**(*x*) - inverse secant = **acos**(1/*x*);  
> **acot**(*x*) - inverse cotangent;

- Inverse hyperbolic:

> **asinh**(*x*) - inverse hyperbolic sine = **ln**(*x* + √(*x*2 + 1)), defined for -∞ ≤ *x* ≤ +∞;  
> **acosh**(*x*) - inverse hyperbolic cosine = **ln**(*x* + √(*x* + 1)·√(*x* – 1)), defined for *x* ≥ 1;  
> **atanh**(*x*) - inverse hyperbolic tangent = 1/2·**ln**\[(1 + *x*)/(1 - *x*)\], for -1 \< *x* \< 1;  
> **acsch**(*x*) - inverse hyperbolic cosecant = **atanh**(1/*x*);  
> **asech**(*x*) - inverse hyperbolic secant = **acosh**(1/*x*);  
> **acoth**(*x*) - inverse hyperbolic cotangent = 1/2·**ln**\[(*x* + 1)/(*x* - 1)\], for \|*x*\| \> 1;

- Logarithmic, exponential and roots:

> **log**(*x*) - decimal logarithm (with base 10), for each *x* \> 0;  
> **ln**(*x*) - natural logarithm (with base *e* ≈ 2.7183), for each *x* \> 0;  
> **log_2**(*x*) - binary logarithm (with base 2), for each *x* \> 0;
>
> **exp**(*x*) - exponential function = e*x*;
>
> **sqr**(*x*) or **sqrt**(*x*) - square root (√‾*x*), defined for each *x* ≥ 0;  
> **cbrt**(*x*) - cubic root (3√‾*x*);  
> **root**(*x*; *n*) - n-th root (n√‾*x*);

- Rounding:

> **round**(*x*) - rounds to the nearest integer;  
> **floor**(*x*) - rounds to the smaller integer (towards -∞);  
> **ceiling**(*x*) - rounds to the greater integer (towards +∞);  
> **trunc**(*x*) - rounds to the smaller integer (towards zero);

- Integer:  
  **mod**(*x*; *y*) - the remainder of an integer division;  
  **gcd**(*x*; *y*; *z*…) - the greatest common divisor of several integers;  
  **lcm**(*x*; *y*; *z*…) - the least common multiple of several integers;

- Complex:  
  **re**(a + b*i*) - returns the real part only, **re**(a + b*i*) = a;  
  **im**(a + b*i*) - returns the imaginary part as a real number, **im**(a + b*i*) = b;  
  **abs**(a + b*i*) - complex modulus = **sqrt**(a2 + b2);  
  **phase**(a + b*i*) - complex number phase (argument) = **atan2**(a; b);  
  **conj**(a + b*i*) - complex number conjugate = a - bi.

- Aggregate and interpolation:

> **min**(*A*; $\vec{b}$; *c*…) - the smallest of multiple values;  
> **max**(*A*; $\vec{b}$; *c*…) - the greatest of multiple values;  
> **sum**(*A*; $\vec{b}$; *c*…) - sum of multiple values;  
> **sumsq**(*A*; $\vec{b}$; *c*…) - sum of squares;  
> **srss**(*A*; $\vec{b}$; *c*…) - square root of sum of squares;  
> **average**(*A*; $\vec{b}$; *c*…) - average of multiple values;  
> **product**(*A*; $\vec{b}$; *c*…) - product of multiple values;  
> **mean**(*A*; $\vec{b}$; *c*…) - geometric mean;  
> **take**(*n*; *A*; $\vec{b}$; *c*…) - returns the n-th element from the list;  
> **line**(*x*; *A*; $\vec{b}$; *c*…) - performs linear interpolation among the specified values for *x*;  
> **spline**(*x*; *A*; $\vec{b}$; *c*…) - performs Hermite spline interpolation;

- Conditional and logical:

> **if**(\<*cond*\>; \<*value-if-true*\>; \<*value-if-false*\>) - if the condition *cond* is satisfied, the function returns the first value, otherwise it returns the second value.
The condition is satisfied when it evaluates to any non-zero number;  
> **switch**(\<*cond1*\>; \<*value1*\>; \<*cond2*\>; \<*value2*\>;…; \<*default-value*\>) - returns the value for which the respective condition is satisfied.
Conditions are checked from left to right.
If none is satisfied, it returns the default value in the end;  
> **not**(*x*) - logical "not";  
> **and**(*x*; *y*; *z*…) - logical "and";  
> **or**(*x*; *y*; *z*…) - logical "or";  
> **xor**(*x*; *y*; *z*…) - logical "xor";

- Other:  
  **abs**(*x*) - absolute value (modulus) of a real number \| *x* \|;  
  **sign**(*x*) - sign of a number = -1 if *x* \< 0; 1 if *x* \> 0; 0 if *x* = 0;  
  **random**(*x*) - a random number between 0 and *x*;  
  **getunits**(*x*) - gets the units of x without the value.
Returns 1 if *x* is unitless;  
  **setunits**(*x*; *u*) - sets the units *u* to *x*, where *x* can be scalar, vector or matrix;  
  **clrunits**(*x*) - clears the units from a scalar, vector or matrix *x*;  
  **hp**(*x*) - converts x to its high-performance (hp) equivalent type;  
  **ishp**(*x*) - checks if the type of x is a high-performance (hp) vector or matrix;

- Vector:

  - Creational**:  
    vector**(*n*) - creates an empty vector with length *n*;  
    **vector_hp**(*n*) - creates an empty high performance (hp) vector with length *n*;

> **range**(*x*1; *x*n; *s*) - creates a vector with values spanning from *x*1 to *x*n with step *s*;  
> **range_hp**(*x*1; *x*n; *s*) - creates a high performance (hp) vector from a range of values;

- Structural:

> **len**($\vec{v}$) - returns the length of vector $\vec{v}$;  
> **size**($\vec{v}$) - the actual size of vector $\vec{v}$ (the index of the last non-zero element);  
> **resize**($\vec{v}$; *n*) - sets a new length *n* of vector $\vec{v}$;  
> **fill**($\vec{v}$; *x*) - fills vector $\vec{v}$ with value *x*;  
> **join**(*A*; $\vec{b}$; *c*…) - creates a vector by joining the arguments: matrices, vectors and scalars;  
> **slice**($\vec{v}$; *i*1; *i*2) - returns the part of vector $\vec{v}$, bounded by indexes *i*1 and *i*2, inclusively;  
> **first**($\vec{v}$; *n*) - the first *n* elements of vector $\vec{v}$;  
> **last**($\vec{v}$; *n*) - the last *n* elements of vector $\vec{v}$;  
> **extract**($\vec{v}$; $\vec{i}$) - extracts the elements from $\vec{v}$ which indexes are contained in $\vec{i}$;

- Data:

> **sort**($\vec{v}$) - sorts the elements of vector $\vec{v}$ in ascending order;  
> **rsort**($\vec{v}$) - sorts the elements of vector $\vec{v}$ in descending order;  
> **order**($\vec{v}$) - the indexes of vector $\vec{v}$ by ascending order of its elements;  
> **revorder**($\vec{v}$) - the indexes of vector $\vec{v}$ by descending order of its elements;  
> **reverse**($\vec{v}$) - a vector containing the elements of $\vec{v}$ in reverse order;  
> **count**($\vec{v}$; *x*; *i*) - number of elements of vector $\vec{v}$, after the *i*-th one, that are equal to *x*;  
> **search**($\vec{v}$; *x*; *i*) - the index of the first element in $\vec{v}$, after the *i*-th one, that is equal to *x*;  
> **find**($\vec{v}$; *x*; *i*) or  
> **find_eq**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are = *x*;  
> **find_ne**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are ≠ *x*;  
> **find_lt**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are \< *x*;  
> **find_le**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are ≤ *x*;  
> **find_gt**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are \> *x*;  
> **find_ge**($\vec{v}$; *x*; *i*) - the indexes of all elements in $\vec{v}$, after the *i*-th one that are ≥ *x*;
>
> **lookup**($\vec{a}$; $\vec{b}$; *x*) or  
> **lookup_eq**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are = *x*;  
> **lookup_ne**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are ≠ *x*;  
> **lookup_lt**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are \< *x*;  
> **lookup_le**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are ≤ *x*;  
> **lookup_gt**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are \> *x*;  
> **lookup_ge**($\vec{a}$; $\vec{b}$; *x*) - all elements in $\vec{a}$ for which the respective elements in $\vec{b}$ are ≥ *x*;

- Math:  
  **norm_1**($\vec{v}$) - L1 (Manhattan) norm of vector $\vec{v}$;  
  **norm**($\vec{v}$) or **norm_2**($\vec{v}$) or **norm_e**($\vec{v}$) - L2 (Euclidean) norm of vector $\vec{v}$;  
  **norm_p**($\vec{v}$; *p*) - Lp norm of vector $\vec{v}$;  
  **norm_i**($\vec{v}$) - L∞ (infinity) norm of vector *⃗v*;

> **unit**($\vec{v}$) - the normalized vector $\vec{v}$ (with L2 norm = 1);
>
> **dot**($\vec{a}$; $\vec{b}$) - scalar product of two vectors $\vec{a}$ and $\vec{b}$;
>
> **cross**($\vec{a}$; $\vec{b}$) - cross product of two vectors $\vec{a}$ and $\vec{b}$ (with length 2 or 3);

- Matrix:

  - Creational**:  
    matrix**(*m*; *n*) - creates an empty matrix with dimensions *m*⨯*n*;  
    **identity**(*n*) - creates an identity matrix with dimensions *n*⨯*n*;  
    **diagonal**(*n*; *d*) - creates a diagonal *n*⨯*n* matrix and fills the diagonal with value *d*;  
    **column**(*m*; *c*) - creates a column matrix with dimensions *m*⨯1, filled with value *c*;  
    **utriang**(*n*) - creates an upper triangular matrix with dimensions *n*⨯*n*;  
    **ltriang**(*n*) - creates a lower triangular matrix with dimensions *n*⨯*n*;  
    **symmetric**(*n*) - creates a symmetric matrix with dimensions *n*⨯*n*;  
    **matrix_hp**(*m*; *n*) - creates a high-performance empty matrix with dimensions *m*⨯*n*;  
    **identity_hp**(*n*) - creates a high-performance identity matrix with dimensions *n*⨯*n*;  
    **diagonal_hp**(*n*; *d*) - creates a *n*⨯*n* high-performance diagonal matrix filled with value *d*;  
    **column_hp**(*m*; *c*) - creates a *m*⨯1 high-performance column matrix filled with value *c*;  
    **utriang_hp**(*n*) - creates a *n*⨯*n* high-performance upper triangular matrix;  
    **ltriang_hp**(*n*) - creates a *n*⨯*n* high-performance lower triangular matrix;  
    **symmetric_hp**(*n*) - creates a *n*⨯*n* high-performance symmetric matrix;

> **vec2diag**($\vec{v}$) - creates a diagonal matrix from the elements of vector $\vec{v}$;  
> **vec2row**($\vec{v}$) - creates a row matrix from the elements of vector $\vec{v}$;  
> **vec2col**($\vec{v}$) - creates a column matrix from the elements of vector $\vec{v}$;  
> **join_cols**($\vec{c}_{1}$; $\vec{c}_{2}$; $\vec{c}_{3}$ ...) - creates a new matrix by joining column vectors;  
> **join_rows**($\vec{r}_{1}$; $\vec{r}_{2}$; $\vec{r}_{3}$ ...) - creates a new matrix by joining row vectors;
>
> **augment**(*A*; *B*; *C* ...) - creates a new matrix by appending matrices *A*; *B*; *C* side by side;  
> **stack**(*A*; *B*; *C* ...) - creates a new matrix by stacking matrices *A*; *B*; *C* one below the other;

- Structural**:  
  n_rows**(*M*) - number of rows in matrix *M*;  
  **n_cols**(*M*) - number of columns in matrix *M*;  
  **mresize**(*M*; *m*; *n*) - sets new dimensions *m* and *n* for matrix *M*;  
  **mfill**(*M*; *x*) - fills matrix *M* with value *x*;  
  **fill_row**(*M*; *i*; *x*) - fills the *i*-th row of matrix *M* with value *x*;  
  **fill_col**(*M*; *j*; *x*) - fills the *j*-th column of matrix *M* with value *x*;  
  **copy**(*A*; *B*; *i*; *j*) - copies all elements from *A* to *B*, starting from indexes *i* and *j* of *B*;  
  **add**(*A*; *B*; *i*; *j*) - adds all elements from *A* to *B*, starting from indexes *i* and *j* of *B*;  
  **row**(*M*; *i*) - extracts the *i*-th row of matrix *M* as a vector;  
  **col**(*M*; *j*) - extracts the *j*-th column of matrix *M* as a vector;  
  **extract_rows**(*M*; *i*) - extracts the rows from matrix *M* whose indexes  
  are contained in vector *i*;  
  **extract_cols**(*M*; *j*) - extracts the columns from matrix *M* whose indexes  
  are contained in vector *j*;  
  **diag2vec**($\vec{v}$) - extracts the diagonal elements of matrix *M* to a vector;

> **submatrix**(*M*; *i*1; *i*2; *j*1; *j*2) - extracts a submatrix of *M*, bounded by  
> rows *i*1 and *i*2 and columns *j*1 and *j*2, incl.;

- Data**:**

> **sort_cols**(*M*; *i*) - sorts the columns of *M* based on the values in row *i*  
> in ascending order;  
> **rsort_cols**(*M*; *i*) - sorts the columns of *M* based on the values in row *i*  
> in descending order;  
> **sort_rows**(*M*; *j*) - sorts the rows of *M* based on the values in column *j*  
> in ascending order;  
> **rsort_rows**(*M*; *j*) - sorts the rows of *M* based on the values in column *j*  
> in descending order;  
> **order_cols**(*M*; *i*) - the indexes of the columns of *M* based on the ordering  
> of the values from row *i* in ascending order;  
> **revorder_cols**(*M*; *i*) - the indexes of the columns of *M* based on the ordering  
> of the values from row *i* in descending order;  
> **order_rows**(*M*; *j*) - the indexes of the rows of *M* based on the ordering  
> of the values in column *j* in ascending order;  
> **revorder_rows**(*M*; *j*) - the indexes of the rows of *M* based on the ordering  
> of the values in column *j* in descending order;  
> **mcount**(*M*; *x*) - number of occurrences of value *x* in matrix *M*;  
> **msearch**(*M*; *x*; *i*; *j*) - vector with the two indexes of the first occurrence  
> of *x* in matrix *M*, starting from indexes *i* and *j*;  
> **mfind**(*M*; *x*) or  
> **mfind_eq**(*M*; *x*) - the indexes of all elements in *M* equal to *x*;  
> **mfind_ne**(*M*; *x*) - the indexes of all elements in *M* not equal to *x*;  
> **mfind_lt**(*M*; *x*) - the indexes of all elements in *M* less than *x*;  
> **mfind_le**(*M*; *x*) - the indexes of all elements in *M* less than or equal to *x*;  
> **mfind_gt**(*M*; *x*) - the indexes of all elements in *M* greater than *x*;  
> **mfind_ge**(*M*; *x*) - the indexes of all elements in *M* greater than or equal to *x*;
>
> **hlookup**(*M*; *x*; *i*1; *i*2) or  
> **hlookup_eq**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are equal to *x*;  
> **hlookup_ne**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are not equal to *x*;  
> **hlookup_lt**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are less than *x*;  
> **hlookup_le**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are less than or equal to *x*;  
> **hlookup_gt**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are greater than *x*;  
> **hlookup_ge**(*M*; *x*; *i*1; *i*2) - the values from row *i*2 of *M*, for which the elements in  
> row *i*1 are greater than or equal to *x*;  
> **vlookup**(*M*; *x*; *j*1; *j*2) or  
> **vlookup_eq**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are equal to *x*;  
> **vlookup_ne**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are not equal to *x*;  
> **vlookup_lt**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are less than *x*;  
> **vlookup_le**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are less than or equal to *x*;  
> **vlookup_gt**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are greater than *x*;  
> **vlookup_ge**(*M*; *x*; *j*1; *j*2) - the values from column *j*2 of *M*, for which the elements in column *j*1 are greater than or equal to *x*;

- Math**:**

> **hprod**(*A*; *B*) - Hadamard product of matrices *A* and *B*;  
> **fprod**(*A*; *B*) - Frobenius product of matrices *A* and *B*;  
> **kprod**(*A*; *B*) - Kronecker product of matrices *A* and *B*;  
> **mnorm_1**(*M*) - L<sub>1</sub> norm of matrix *M*;  
> **mnorm**(*M*) or **mnorm_2**(*M*) - L<sub>2</sub> norm of matrix *M*;  
> **mnorm_e**(*M*) - Frobenius norm of matrix *M*;  
> **mnorm_i**(*M*) - L<sub>∞</sub> norm of matrix *M*;  
> **cond_1**(*M*) - condition number of *M* based on the L<sub>1</sub> norm;  
> **cond**(*M*) or **cond_2**(*M*) - condition number of *M* based on the L<sub>2</sub> norm;  
> **cond_e**(*M*) - condition number of *M* based on the Frobenius norm;  
> **cond_i**(*M*) - condition number of *M* based on the L∞ norm;  
> **det**(*M*) - determinant of matrix *M*;  
> **rank**(*M*) - rank of matrix *M*;  
> **trace**(*M*) - trace of matrix *M*;  
> **transp**(*M*) - transpose of matrix *M*;  
> **adj**(*M*) - adjugate of matrix *M*;  
> **cofactor**(*M*) - cofactor matrix of *M*;  
> **eigenvals**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvalues of matrix *M* (or all if omitted);  
> **eigenvecs**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvectors of matrix *M* (or all if omitted);  
> **eigen**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvalues and eigenvectors of matrix *M* (or all if omitted) ;  
> **cholesky**(*M*) - Cholesky decomposition of a symmetric, positive-definite matrix *M*;  
> **lu**(*M*) - LU decomposition of matrix *M*;  
> **qr**(*M*) - QR decomposition of matrix *M*;  
> **svd**(*M*) - singular value decomposition of *M*;  
> **inverse**(*M*) - inverse of matrix *M*;
>
> **lsolve**(*A*; *b⃗* ) - solves the system of linear equations *Ax* ⃗ = *b⃗* using LDL<sup>T</sup> decomposition for symmetric matrices, and LU for non-symmetric;  
> **clsolve**(*A*; *b⃗* ) - solves the linear matrix equation *Ax* ⃗ = *b⃗* with symmetric, positive-definite coefficient matrix *A* using Cholesky decomposition;  
> **slsolve**(*A*; *b⃗* ) - solves the linear matrix equation *Ax* ⃗ = *b⃗* with high-performance symmetric, positive-definite matrix *A* using preconditioned conjugate gradient (PCG) method;
>
> **msolve**(*A*; *B*) - solves the generalized matrix equation *AX* = *B* using LDL<sup>T</sup> decomposition for symmetric matrices, and LU for non-symmetric;  
> **cmsolve**(*A*; *B*) - solves the generalized matrix equation *AX* = *B* with symmetric, positive-definite coefficient matrix *A* using Cholesky decomposition;  
> **smsolve**(*A*; *B*) - solves the generalized matrix equation *AX* = *B* with high-performance symmetric, positive-definite matrix *A* using preconditioned conjugate gradient (PCG) method;  
> **matmul**(*A*; *B*) - fast multiplication of square hp matrices using parallel Winograd  
> algorithm.
The multiplication operator *A*\**B* uses it internally for all  
> square hp matrices of size 10 and larger;  
> **fft**(*M*) - performs fast Fourier transform of row-major matrix *M*. It must have one row for real data and two rows for complex;  
> **ift**(*M*) - performs inverse Fourier transform of row-major matrix *M*.  
> It must have one row for real data and two rows for complex;

- Double interpolation**:**

> **take**(*x*; *y*; *M*) - returns the element of matrix *M* at indexes *x* and *y*;  
> **line**(*x*; *y*; *M*) - double linear interpolation from the elements of matrix *M* based on the values of *x* and *y*;  
> **spline**(*x*; *y*; *M*) - double Hermite spline interpolation from the elements of matrix *M* based on the values of *x* and *y*.

Arguments must be enclosed by round brackets.
They can be constants, variables or any valid expression.
Multiple arguments must be separated by semicolons ";". When arguments are out of range, the function returns "Undefined". Exceptions from this rule are "**cot**(0)" and "**coth**(0)", which return "+∞".

Arguments of trigonometric functions can be in **degrees**, **radians** or **grades**. The units for angles can be specified in three different ways:

> 1\. By the radio buttons above the output window (🔘**D**, 🔘**R**, 🔘**G**).
>
> 2\. By compiler switches inside the code.
You have to insert a separate line containing: \#deg for degrees, \#rad for radians or \#gra for grades.
This will affect all expressions after the current line to the end or until an alternative directive is found.
>
> 3\. By attaching native units to the value itself: *deg*, *°*, ′, ″, *rad*, *grad*, *rev* (see the “Units” section, further in this manual).

Native units are of highest priority, followed by compiler switches in source code.
Both override radio buttons settings, which are of lowest priority.

All functions are also defined in the complex domain, except for **mod**(*x*; *y*), **gcd**(*x*; *y*), **lcm**(*x*; *y*), **min**(*x*; *y*) and **max**(*x*; *y*).

Logical functions accept numerical values and return “**0**” for “**false**” and “**1**” for “**true**”. The results for two arguments (one for “**not**”) are presented in the following tables:

<table style="width:97%;">
<colgroup>
<col style="width: 18%" />
<col style="width: 27%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<tbody>
<tr>
<td><table style="width:15%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 8%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>not(x)</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
</tr>
</tbody>
</table></td>
<td><table style="width:23%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 5%" />
<col style="width: 11%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>and(x; y)</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
</tbody>
</table></td>
<td><table style="width:22%;">
<colgroup>
<col style="width: 6%" />
<col style="width: 5%" />
<col style="width: 9%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>or(x; y)</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
</tbody>
</table></td>
<td><table style="width:23%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 5%" />
<col style="width: 11%" />
</colgroup>
<tbody>
<tr>
<td>x</td>
<td>y</td>
<td>xor(x; y)</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">0</td>
</tr>
<tr>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
<td style="text-align: center;">1</td>
</tr>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: center;">1</td>
<td style="text-align: center;">0</td>
</tr>
</tbody>
</table></td>
</tr>
</tbody>
</table>

Any numerical value, different from 0, is treated as 1 (true). Multiple arguments are evaluated sequentially from left to right, according to the above tables.
We start with the first and the second.
Then, the obtained result and the next value are evaluated in turn, and so on.

Rounding of midpoint values with **round**() evaluates to the nearest integer away from zero.
The **floor**() function rounds to the smaller value (towards -∞). The **ceiling**() function rounds in the opposite direction to the larger value (towards +∞). Unlike **floor**(), **trunc**() rounds towards zero, which is equivalent to simply truncating the fractional part.
Some examples for rounding of negative and positive numbers are provided in the table below:

<table style="width:70%;">
<colgroup>
<col style="width: 37%" />
<col style="width: 33%" />
</colgroup>
<tbody>
<tr>
<td><p><strong>Positive</strong></p>
<table style="width:33%;">
<colgroup>
<col style="width: 12%" />
<col style="width: 10%" />
<col style="width: 9%" />
</colgroup>
<tbody>
<tr>
<td>Function</td>
<td>x</td>
<td>Result</td>
</tr>
<tr>
<td>round(x)</td>
<td style="text-align: right;">4.5</td>
<td style="text-align: right;">5</td>
</tr>
<tr>
<td>floor(x)</td>
<td style="text-align: right;">4.8</td>
<td style="text-align: right;">4</td>
</tr>
<tr>
<td>ceiling(x)</td>
<td style="text-align: right;">4.2</td>
<td style="text-align: right;">5</td>
</tr>
<tr>
<td>trunc(x)</td>
<td style="text-align: right;">4.8</td>
<td style="text-align: right;">4</td>
</tr>
</tbody>
</table></td>
<td><p><strong>Negative</strong></p>
<table style="width:32%;">
<colgroup>
<col style="width: 11%" />
<col style="width: 10%" />
<col style="width: 10%" />
</colgroup>
<tbody>
<tr>
<td>Function</td>
<td>x</td>
<td>Result</td>
</tr>
<tr>
<td>round(x)</td>
<td style="text-align: right;">-4.5</td>
<td style="text-align: right;">-5</td>
</tr>
<tr>
<td>floor(x)</td>
<td style="text-align: right;">-4.8</td>
<td style="text-align: right;">-5</td>
</tr>
<tr>
<td>ceiling(x)</td>
<td style="text-align: right;">-4.2</td>
<td style="text-align: right;">-4</td>
</tr>
<tr>
<td>trunc(x)</td>
<td style="text-align: right;">-4.8</td>
<td style="text-align: right;">-4</td>
</tr>
</tbody>
</table></td>
</tr>
</tbody>
</table>

Rounding of complex numbers affects both real and imaginary parts.

#### Custom (user defined) functions

You can define your own functions and use them further in the calculations.
Custom functions can have unlimited number of parameters.
They are specified after the function name, enclosed in brackets "(" … ")" and separated by semicolons ";". Each function is defined, using the following format: "**f** ( *x*; *y*; *z*; … ) = **expression**", where "**f**" is the function name and "**x**", "**y**" and "**z**" are function parameters.
On the right side you can have any valid expression including constants, operators, variables and even other functions, e.g.:

> **f**(*x*) = *x*^2 + 2\*x\***sin**(*x*)  
> **g**(*x*; *y*) = **f**(*x*)/(*y* - 4)

Once defined, you can use a function in any expression by inserting a function call.
Just write the function name and then specify the arguments in brackets, e. g. *b* = **g**(*a* + 2; 3) + 3. Function names must conform to the same rules as variable names.
Arguments can be any valid expressions.
You have to provide as many arguments as the number of function parameters.
The life cycle of a function is from the place of definition to the end of the code.
If you define a new function with the same name, the old one will be replaced.
You cannot redefine a library function.
For example, **sin**(*x*) = *x*^2 will return an error.

It is not necessary to pre-define the variables that are used for parameters.
However, if other variables are used inside the function body, they must be defined before the first call to the function.
Parameters work as local level variables inside the function body.
If a variable with the same name exists outside the function, a call to that function will not rewrite the value of the global variable.
For example:

> If you have a variable "*x* = 4" and a function "**f**(*x*) = *x*2".
>
> When you call "**f**(2)", it will evaluate to *x*2 = 22 = 4, because local *x* = 2
>
> If you call "*x*2" after that, it will return *x*2 = 42 = 16, because global *x* remains 4.

User defined functions support both real and complex numbers.

### Plotting

Besides functions, Calcpad provides special commands for advanced operations.
They accept functions and expressions as arguments and perform plotting, iterative solutions and numerical methods.
Their names start with "\$" to be distinguished from normal functions.
Their parameters must be enclosed in curly brackets: "{" and "}". Such is the plotting command \$Plot.
It can plot a function of one variable in the specified interval.
It has the following format:

\$Plot{**y**(*x*) @ *x* = *a* : *b*} , where:

> **y**(*x*) - the function to be plotted.
Instead of **y**(*x*) you can put any valid expression.
It will be used to calculate the ordinate values;
>
> *x* - the name of the variable along the abscissa.
You can put here only a single name.
It is not required to define the variable preliminary;
>
> *a* and *b* are the limits of the interval for the *x* variable.
Instead of *a* and *b* you can put numbers, variables or any valid expressions.

For example, if you enter: \$Plot{*x*^2 - 5\**x* + 3 @ x = -1:6}, you will get the following result:

<img src="./media/image20.png" style="width:4.01795in;height:2.81417in" alt="Картина, която съдържа диаграма, заговорнича, линия Описанието е генерирано автоматично" />

The above command plots only one function of one variable at a time.
There are also other formats that you can use:

> \$Plot{**x**(*t*)\|**y**(*t*) @ *t* = *a*:*b*} - parametric plot: both coordinates are functions of a parameter;  
> \$Plot{**y**1(*x*) & **y**2(*x*) & … @ *x* = *a*:*b*} - multiple: plots several functions on a single graph;  
> \$Plot{**x**1(*t*)\|**y**1(*t*) & **x**2(*t*)\|**y**2(*t*) & … @ *t* = *a*:*b*} - multiple parametric;  
> \$Map{**f**(*x*; *y*) @ *x* = *a*:*b* & *y* = *c*:*d*} - draws a 2D color map of a 3D surface, defined by **f**(*x*; *y*).

The \$Plot function must be the first thing on a line.
You can have only spaces and tabs before, not even comments.
Otherwise, the program will return an error.
Any text after the closing bracket "}" will be ignored.
Plotting supports only real numbers.
You can use it in complex mode, only if *x* and *y* are real and the function returns real result along the plotting interval.

You can specify the size of the plot area by defining two variables: *PlotWidth* and *PlotHeight* in pixels.
The default values are *PlotWidth* = 400 and *PlotHeight* = 250. Plots can be in either in raster (PNG) or vector (SVG) format.
The vector format is usually smaller and faster than the raster one.
However, you may have problems with export to older version of Word or other software that does not support SVG.
You can turn this option on and off by setting the *PlotSVG* variable to 1 and 0, respectively.
Any nonzero value is equivalent to setting it to one.

Plotting a function requires multiple evaluations.
This is performed at uniformly spaced points of a dense mesh so that to catch any variations of function values.
However, if evaluations are computationally expensive, this approach can be very time-consuming.
In such cases, you can use adaptive plotting.
It starts with a coarse mesh and condenses it adaptively to the curvature.
Where the function is smoother, the mesh remains coarser, so that the total number of points is optimal and much less than for uniform mesh.
You can switch adaptive plotting on and off by clicking the "**Adaptive**" checkbox or setting the *PlotAdaptive* variable to 1 and 0, respectively.
Adaptive potting will work for relatively smooth plots with limited number of breaks and jumps.
If you have rapidly oscillating functions, it is possible to miss some peaks, so it is recommended to turn it off.

The \$Map function can work with different color palettes.
Select the preferred one from the "**Palette**" combo box on the bottom of the program window.
If you check the "**Smooth**" checkbox, the coloring will be displayed as a smooth gradient.
Otherwise, the program will display strips.
You can also add 3D effects to the graph by selecting the "**Shadows**" checkbox.
You can also specify light direction by the respective combo.
Besides UI controls, you can specify these options by using variables at worksheet level, as follows:

> *PlotShadows *- draw surface plots with shadows;
>
> *PlotLightDir* - direction to light source (0-7) clockwise:  
>   0 - North  
>   1 - NorthEast  
>   2 - East  
>   3 - SouthEast  
>   4 - South  
>   5 - SouthWest  
>   6 - West  
>   7 – NorthWest
>
> *PlotPalette *- the number of color palette to be used for surface plots (0-9);

| 0 -  | **None** |
|:-----|:---------|
| 1 -  |          |
| 2 -  |          |
| 3 -  |          |
| 4 -  |          |
| 5 -  |          |
| 6 -  |          |
| 7 -  |          |
| 8 -  |          |
| 9 -  |          |

*PlotSmooth* - smooth transition of colors (= 1) or isobands (= 0) for surface plots.  
Examples of different plotting methods are provided below:

<table>
<colgroup>
<col style="width: 49%" />
<col style="width: 50%" />
</colgroup>
<tbody>
<tr>
<td style="text-align: left;"><strong>Parametric</strong><br />
Equation: <strong>r</strong>(<em>θ</em>) = <strong>cos</strong>(5/2*<em>θ</em>)<br />
$Plot{<strong>r</strong>(<em>θ</em>)*<strong>cos</strong>(<em>θ</em>)|<strong>r</strong>(<em>θ</em>)*<strong>sin</strong>(<em>θ</em>)<br />
@ <em>θ</em> = 0:6*π}</td>
<td style="text-align: left;"><strong>Multiple</strong><br />
Equation: <strong>y</strong>1(<em>θ</em>) = <strong>cos</strong>(<em>θ</em>) - <strong>sin</strong>(<em>θ</em>)<br />
<strong>y</strong>2(<em>θ</em>) = <strong>cos</strong>(<em>θ</em>) + <strong>sin</strong>(<em>θ</em>)<br />
$Plot{<strong>cos</strong>(<em>θ</em>) &amp; <strong>y</strong>1(<em>θ</em>) &amp; <strong>y</strong>2(<em>θ</em>) @ <em>θ</em> = 0:<em>π</em>}</td>
</tr>
<tr>
<td style="text-align: left;">Result: "rose" curve<br />
<img src="./media/image21.png" style="width:2.91319in;height:2.83472in" /></td>
<td style="text-align: left;">Result: leaf by three trigonometric functions<br />
<img src="./media/image22.png" style="width:2.91319in;height:2.83472in" /></td>
</tr>
<tr>
<td style="text-align: left;"><strong>Multiple parametric</strong><br />
Equation: <strong>x</strong>(<em>θ</em>) = <strong>sqr</strong>(<em>θ</em>)*<strong>cos</strong>(<em>θ</em>)<br />
<strong>y</strong>(<em>θ</em>) = <strong>sqr</strong>(<em>θ</em>)*<strong>sin</strong>(<em>θ</em>)<br />
$Plot{<strong>x</strong>(<em>θ</em>)|<strong>y</strong>(<em>θ</em>) &amp; -<strong>x</strong>(<em>θ</em>)|-<strong>y</strong>(<em>θ</em>) @ <em>θ</em> = 0:3*<em>π</em>}</td>
<td style="text-align: left;"><strong>Color map</strong><br />
Equation:<br />
<strong>f</strong>(<em>x</em>; <em>y</em>) = <strong>cos</strong>(<em>x</em>/3) + <strong>sin</strong>(<em>y</em>) -<strong>sin</strong>(<em>x</em>)*<strong>cos</strong>(<em>y</em>/4)<br />
$Map{<strong>f</strong>(<em>x</em>; <em>y</em>) @ <em>x</em> = -15:15 &amp; <em>y</em> = -15:15}</td>
</tr>
<tr>
<td style="text-align: left;">Result: double Fermat spiral<br />
<img src="./media/image23.png" style="width:2.91736in;height:2.83472in" /></td>
<td style="text-align: left;">Result: 2D waves<br />
<img src="./media/image24.png" style="width:3.48403in;height:2.83472in" /></td>
</tr>
</tbody>
</table>

### Numerical methods

Calcpad has a built in "**Solver**" module, which can solve more difficult problems using numerical methods.
It can work only with real numbers but not complex.
It includes the following functions:

#### Root finding

> \$Root{**f**(*x*) = const @ *x* = *a* : *b*}  
> \$Root{**f**(*x*) @ *x* = *a* : *b*}

It finds a single root for an equation of type " **f**(*x*) = const" within the interval \[*a*, *b*\]. If "const" is zero, you can omit "= const". The program uses a [hybrid bracketing method](https://iopscience.iop.org/article/10.1088/1757-899X/1276/1/012010), which is a combination of Bisection and Anderson-Bjork's method.
It subsequently narrows the interval around the root, until it gets smaller than the specified precision.
It is required that the function "**f**(*x*) - const" has opposite signs at the ends of the interval.
According to Boltzano’s theorem, if the function is continuous within the interval, at least one root exists.
The bracketing algorithm will find an approximation after a finite number of iterations.

<img src="./media/image25.png" style="width:2.5893in;height:1.90964in" alt="Картина, която съдържа текст, линия, диаграма, заговорнича Описанието е генерирано автоматично" />

With this method, you can find only roots where the function crosses the line at "*y* = const". When " **f**(*x*) - const" is entirely positive or negative and only "touches" the line from one side, you cannot find the root by any bracketing method.

If no roots exist inside the initial interval, the program returns an error.
If there are several roots, it will find only one of them.
In such case, it is better to plot the function first.
Then, you can see the approximate location of roots and divide the interval into several parts - one for each root.
Finally, you can call the function several times to find all the roots.
In some cases, it is possible to develop an automated procedure for interval splitting.

#### Minimum

\$Inf{**f**(*x*) @ *x* = *a* : *b*}

It finds the smallest value for a function f(*x*) within the specified interval \[*a*, *b*\]. The golden section search method is applied for that purpose.
If the function contains a local minimum within the interval, it will be returned as a result.
Otherwise, the function will return the smaller of the values at the ends of the interval: f(*a*) or f(*b*). If there are several local minimums, the program will return only one of them, but not necessarily the smallest one.
In such cases, it is better to split the interval.
The value of *x* where the minimum is found is stored into a variable *x*inf.
If you use different name for the argument, instead of *x*, it will add "\_inf" at the end of that name.

#### Maximum

\$Sup{**f**(*x*) @ *x* = *a* : *b*}

It works like the minimum finding function, but it finds the greatest value instead.
The value of *x* where the maximum is located is stored in a variable named *x*sup.

#### Numerical integration

\$Area{**f**(*x*) @ *x* = *a* : *b*}

It calculates the value of the definite integral of a function f(*x*) within the specified interval \[*a*, *b*\]. Adaptive Gauss-Lobbato quadrature with Kronrod extension is applied for that purpose ([Gander & Gautschi](https://www.researchgate.net/publication/226706221_Adaptive_Quadrature-Revisited), 2000).

\$Integral{**f**(*x*) @ *x* = *a* : *b*}

This command is similar to the above, but it uses the Tanh-Sinh quadrature ([Takahasi & Mori](https://ems.press/content/serial-article-files/41766), 1974) which has been additionally improved by [Michashki & Mosig](https://www.tandfonline.com/doi/epdf/10.1080/09205071.2015.1129915?needAccess=true) (2016) and [Van Engelen](https://www.genivia.com/files/qthsh.pdf) (2022). Further improvements have been made in Calcpad by precomputing and caching the abscissas and weights.
This algorithm significantly outperforms \$Area for **continuous** and **smooth** functions.
However, if the function does not satisfy these requirements, you **should not** use the \$Integral method.
Then, you have two options:

1.  Divide the interval \[*a*, *b*\] into smaller parts by using the points of discontinuities, apply the method for each part separately, and sum up the results;

2.  If you are not sure where the discontinuities are, use the \$Area method instead.

#### Numerical differentiation

<span id="_Toc198414454" class="anchor"></span>It finds the value of the first derivative of a real function f(*x*) at the specified point *x* = *a*. The geometric representation of derivative is the slope of the tangent to the function at point *a*. There are two methods that you can use in Calcpad for that purpose:

> \$Slope{**f**(*x*) @ *x* = *a*} - uses symmetric two-point finite difference with [Richardson extrapolation](https://royalsocietypublishing.org/doi/pdf/10.1098/rsta.1911.0009). It evaluates the derivative within the specified *Precision*. The function must be locally continuous, smooth and differentiable in the neighborhood of *a*. It can also contain other numerical methods.
In general, finite differences are susceptible to floating point round-off errors due to the subtraction of close values.
Although Richardson extrapolation can improve this significantly, the accuracy for poorly behaved functions may be limited.
>
> \$Derivative{**f**(*x*) @ *x* = *a*} - uses complex step method ([Lyness and Moler](https://epubs.siam.org/doi/abs/10.1137/0704019)). It evaluates the derivative with nearly machine precision (10<sup> -15</sup> to 10<sup> -16 </sup>) by using the equation:
>
> *f* ′(*a*) = **Im**( *f* (*a* + *ih*))/*h*, where *i* is the imaginary unit and *h* = 10<sup>-20</sup>. The function must be holomorphic in the complex plane - infinitely differentiable and locally equal to its Taylor expansion.
Unlike \$Slope, it cannot contain other numerical methods and should be defined only by analytic expressions.
This limits the applicability of this method but, when possible, you can use it instead of \$Slope to achieve higher accuracy, if needed.

#### General considerations

Unlike the plotting command, you can include numerical methods in expressions.
They return values which can be used for further calculations.
For example, you can store the result into a variable:

*y*min = \$Inf{**f**(*x*) @ *x* = *a* : *b*}

Similarly to standard functions, "*x*" is local for all numerical methods and its global value is not modified after the method is called.

### Iterative procedures

There are some other commands that allow you to calculate the result iteratively.
Unlike numerical methods, they can work with complex numbers.

#### Sum

\$Sum{**f**(*k*) @ *k* = *a* : *b*}

It sums the values of f(*k*) for all integer *k* between *a* and *b*. The values of *k* can only grow, so it should be satisfied that *a* \< *b*. Instead of f(*k*) you can put any valid expression that includes *k*. Otherwise, it will simply sum the same value *k* times.
For example, you can use series to calculate constants.
Such is the Leibniz formula for calculation of π:

4\*\$Sum{(-1)*k*+1/(2\**k* - 1) @ *k* = 1:1000}= 3.1406

You can also use series to define functions.
Of course, they cannot be infinite.
The number of iterations should be sufficient to provide the required precision of the result.
The following pattern can be applied to approximate a function with Fourier series:

> **f**(*x*) = *a*0/2 + \$Sum{**a**(*k*)\***cos**(*k*\**x*\*π/*l*) @ *k*=1:*n*} + \$Sum{**b**(*k*)\***sin**(*k*\**x*\*π/*l*) @ *k*=1:*n*}

As an example, we can take a straight line within the interval (0; 2\**l*), withs equation: f(*x*) = *x*/(2\**l*). The integration constants are *a*(*k*) = 0 and *b*(*k*) = -1/(*k*\*π). If we plot the Fourier approximation for *n* = 5, we will get the following result:

<img src="./media/image26.png" style="width:4.33057in;height:2.80665in" alt="Fourier" />

#### Product

\$Product{**f**(*k*) @ *k* = *a* : *b*}

It works like "**Sum**", but it multiplies the terms instead of adding them.
For example, you can define your own factorial function:

**F**(*n*) = \$Product{*k* @ *k* = 1 : *n*}

You can use it further to calculate binomial coefficients by the well-known formula: C(*n*; *k*) = F(*n*)/(F (*k*)\*F(*n* - *k*)). However, it is much more efficient to define a special procedure that computes the coefficient directly without using factorials:

\$Product{(*i* + *n* - *k*)/*i* @ *i* = *1*:*k*}

Also, the latter will not overflow together with the factorials for greater values of *n*.

#### Repeat

\$Repeat{**f**(*k*) @ *k* = *a* : *b*}

This is a general inline iterative procedure that repeatedly calculates **f**(*k*). It can be used for sums and products instead of the respective procedures, but it is not so efficient.
However, there are expressions that can be calculated only by the "**Repeat**" command.
Normally, such expressions will make sense if you assign the result to a variable to be used in the next iteration.
So, the following pattern is more likely to be applied in practice:

\$Repeat{*x* = **f**(*x*; *k*) @ *k* = *a* : *b*}

For example, you can use this command to define the Mandelbrot set in a single line:

**f**(*z*; *c*) = \$Repeat{*z* = *z*^2 + *c* @ *i* = 1:100}

You should not forget to switch to "Complex" mode.
Then you can plot the result:

\$Map{**abs**(**f**(0; *x* + 1i\**y*)) @ *x* = -1.5:0.5 & *y* = -1:1}

<img src="./media/image27.png" style="width:4.81217in;height:4.37051in" alt="Mandelbrot" />

#### Expression blocks

An expression block encloses a list of expressions, divided by semicolons.
All expressions can assign to local variables.
You can use expression blocks to embed short algorithmic procedures into function definitions, inline loops or any other expressions and expression blocks.
There are two types of expression blocks that differ only in the way they are rendered in the output:

> \$Block{*expr1*; *expr2*; *expr3*; ...} - multiline block of expressions;
>
> \$Inline{*expr1*; *expr2*; *expr3*; ...} - inline block of expressions.

As the respective names imply, \$Block is rendered on multiple lines, one for each expression, and for \$Inline all expressions are rendered on a single line sequentially from left to right.

You can use expression blocks to create multiline functions when a single expression is not sufficient to evaluate the result.
Such is the *quadRoots* function in the example below that find the roots of a quadratic equation by given coefficients *a*, *b*, *c* and returns them as a vector of two elements \[*x*<sub>1</sub>; *x*<sub>2</sub>\].

<table style="width:91%;">
<colgroup>
<col style="width: 44%" />
<col style="width: 47%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Code</strong></th>
<th style="text-align: center;"><strong>Output</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;">quadRoots(a; b; c) = _<br />
$block{<br />
    D = b^2 - 4*a*c;<br />
    x_1 = (-b - <strong>sqrt</strong>(D))/(2*a);<br />
    x_2 = (-b + <strong>sqrt</strong>(D))/(2*a);<br />
    [x_1; x_2];<br />
}<br />
quadRoots(2; 3; -5)</td>
<td><img src="./media/image28.png" style="width:2.97085in;height:1.7867in" /></td>
</tr>
</tbody>
</table>

When you have a \$Repeat inline loop you can nest multiple expressions directly inside without enclosing them with a \$block/\$inline element.
Alternatively, you can use a conditional “while“ loop:

> \$While{*condition*; *expr1*; *expr2*; ...} - iterative expression block with condition.

All expressions inside a block or inline loop are compiled, so that they are executed very fast.
They are evaluated sequentially from left to right and only the last result is returned at the end.
However, unlike the standard expressions you cannot see intermediate results and substituted variables.
This reduces readability and verifiability of calculations.
So, expression blocks should be used only where they are actually needed.

Each variable created by the "**=**" operator inside a code block of type \$block, \$inline, \$while  
and \$repeat is local for this block and the nested ones, even if it already exists outside.
In this case, the existing variable will not be overwritten and will preserve its original value after the execution of the block.
All global and outer scope variables and functions are visible inside the current and inner blocks and accessible for reading.

In general, this is considered a good language design because there are no unpredictable side effects like accidentally changing some global variables just because the names are coincident.
However, in certain scenarios, we may need to update global variables deliberately, mostly inside loops.
For that purpose, you have to use a special operator "**←**". Unlike "**=**", it does not create a local variable.
Instead, it searches for the innermost existing variable in the current or outer scopes and updates its value.
If the variable does not exist, an error is reported.

### Units

Calcpad provides comprehensive support for physical units of measurement.
The current version supports metric (SI and compatible), US and Imperial units.
There are seven basic units that correspond to the seven physical dimensions:

- mass - kilogram (kg)

- length - meter (m)

- time - second (s)

- electric current - ampere (A)

- temperature - degree Celsius (°C)

- amount of substance - mole (mol)

- luminous intensity - candela (cd)

All other units are derivative and they are obtained by the respective laws of physics.
For example, force = mass·acceleration, so Newton is obtained by N = kg·m/s2. Multiples of units are also supported by including the respective prefixes before their names.
For example, kN = 103 N, MN = 106 N and so on.
Additionally, there are some "dimensionless" units like percents, permilles and angles (degrees, radians, etc.) that do not include physical dimensions.
However, angles exist in a special 8-th non-physical dimension, in order not to cancel with or convert to percents when mixed (which would be weird).

You can attach units to numbers by typing the unit’s name after the value, e.g. 15 kg.
Then, you can use them in expressions, just like any other values.
Unit cancellation and conversion is performed automatically during calculations.
For example, the following expression will be evaluated as:

1.23 m + 35 cm + 12 mm = 1.59 m (and not: 1.23 + 35 + 12 = 48.23)

The result is usually obtained into the first unit in the expression.
If you want to use particular units, write a vertical bar "\|" followed by the target units at the end:

1.23 m + 35 cm + 12 mm \| cm

The above expression will be evaluated to 159.2 *cm*. If you simply want to convert units, just write the source and the target units, separated by a vertical bar, like: mm \| cm or 10 m/s \| km/h.

Unit consistency is also verified automatically.
For example, you cannot add *m* and *s* (e.g. 6 m + 2 s), but you can multiply and divide them: 6 m/2 s = 3 m/s.

Arguments for trigonometric, hyperbolic, logarithmic and exponential functions are unitless by definition.
However, you can use units in any custom defined functions, if this makes sense.
You can also attach units to variables.
If you specify target units in a variable definition, they will be stored permanently inside the variable.
They will be used further in the calculations together with the respective value.
In the next example, speed is calculated in m/s, but is converted and stored as km/h:

<table style="width:99%;">
<colgroup>
<col style="width: 59%" />
<col style="width: 39%" />
</colgroup>
<thead>
<tr>
<th style="text-align: left;">Code</th>
<th style="text-align: left;">Output</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: left;">'Distance -'<em>s</em>_1 = 50m<br />
'Time -'<em>t</em>_1 = 2s<br />
'Speed -'<em>V</em> = <em>s</em>_1/<em>t</em>_1|km/h<br />
'What distance you will travel for'<em>t</em>_2 = 5s'?<br />
<em>s</em>_2 = <em>V</em>*<em>t</em>_2|m</td>
<td style="text-align: left;">Distance - <em>s</em>1 = 50 <em>m</em><br />
Time - <em>t</em>1 = 2 <em>s</em><br />
Speed - <em>V</em> = <em>s</em>1/<em>t</em>1 = 50 <em>m</em>/2 <em>s</em> = 90 km/h<br />
What distance you will travel for <em>t</em>2 = 5 <em>s</em>?<br />
<em>s</em>2 = <em>V</em>·<em>t</em>2 = 90 <em>km</em>/<em>h</em>·5 <em>s</em> = 125 <em>m</em></td>
</tr>
</tbody>
</table>

#### Predefined units

Calcpad includes a large collection of predefined units as follows:

Dimensionless:

- Parts: %, ‰, ‱, pcm, ppm, ppb, ppt, ppq;

- Angles: °, ′, ″, deg, rad, grad, rev;

Metric units (SI and compatible):

- Mass: g, hg, kg, t, kt, Mt, Gt, dg, cg, mg, μg, ng, pg, Da (or u);

- Length: m, km, dm, cm, mm, μm, nm, pm, AU, ly;

- Time: s, ms, μs, ns, ps, min, h, d, w, y;

- Frequency: Hz, kHz, MHz, GHz, THz, mHz, μHz, nHz, pHz, rpm;

- Speed: kmh;

- Electric current: A, kA, MA, GA, TA, mA, μA, nA, pA;

- Temperature: °C, Δ°C, K;

- Amount of substance: mol;

- Luminous intensity: cd;

- Area: a, daa, ha;

- Volume: L, daL, hL, dL, cL, mL, μL, nL, pL;

- Force: N, daN, hN, kN, MN, GN, TN, gf, kgf, tf, dyn;

- Moment: Nm, kNm;

- Pressure: Pa, daPa, hPa, kPa, MPa, GPa, TPa, dPa, cPa, mPa, μPa, nPa, pPa,  
      bar, mbar, μbar, atm, at, Torr, mmHg;

- Viscosity: P, cP, St, cSt;

- Energy work: J, kJ, MJ, GJ, TJ, mJ, μJ, nJ, pJ,  
         Wh, kWh, MWh, GWh, TWh, mWh, μWh, nWh, pWh,  
         eV, keV, MeV, GeV, TeV, PeV, EeV, cal, kcal, erg;

- Power: W, kW, MW, GW, TW, mW, μW, nW, pW, hpM, ks,  
     VA, kVA, MVA, GVA, TVA, mVA, μVA, nVA, pVA,  
     VAR, kVAR, MVAR, GVAR, TVAR, mVAR, μVAR, nVAR, pVAR;

- Electric charge: C, kC, MC, GC, TC, mC, μC, nC, pC, Ah, mAh;

- Potential: V, kV, MV, GV, TV, mV, μV, nV, pV;

- Capacitance: F, kF, MF, GF, TF, mF, μF, nF, pF;

- Resistance: Ω, kΩ, MΩ, GΩ, TΩ, mΩ, μΩ, nΩ, pΩ;

- Conductance: S, kS, MS, GS, TS, mS, μS, nS, pS, ℧, k℧, M℧, G℧, T℧, m℧, μ℧, n℧, p℧;

- Magnetic flux: Wb , kWb, MWb, GWb, TWb, mWb, μWb, nWb, pWb;

- Magnetic flux density: T, kT, MT, GT, TT, mT, μT, nT, pT;

- Inductance: H, kH, MH, GH, TH, mH, μH, nH, pH;

- Luminous flux: lm;

- Illuminance: lx;

- Radioactivity: Bq, kBq, MBq, GBq, TBq, mBq, μBq, nBq, pBq, Ci, Rd;

- Absorbed dose: Gy, kGy, MGy, GGy, TGy, mGy, μGy, nGy, pGy;

- Equivalent dose: Sv, kSv, MSv, GSv, TSv, mSv, μSv, nSv, pSv;

- Catalytic activity: kat;

> Non-metric units (Imperial/US):

- Mass: gr, dr, oz, lb (or lbm, lb<sub>\_m</sub>), kipm (or kip<sub>\_m</sub>), st, qr,  
     cwt (or cwt<sub>\_UK</sub>, cwt<sub>\_US</sub>), ton (or ton<sub>\_UK</sub>, ton<sub>\_US</sub>), slug;

- Length: th, in, ft, yd, ch, fur, mi, ftm (or ftm<sub>\_UK</sub>, ftm<sub>\_US</sub>),  
       cable (or cable<sub>\_UK</sub>, cable<sub>\_US</sub>), nmi, li, rod, pole, perch, lea;

- Speed: mph, knot;

- Temperature: °F, Δ°F, °R;

- Area: rood, ac;

- Volume, fluid: fl_oz, gi, pt, qt, gal, bbl, or:  
        fl_oz<sub>\_UK</sub>, gi<sub>\_UK</sub>, pt<sub>\_UK</sub>, qt<sub>\_UK</sub>, gal<sub>\_UK</sub>, bbl<sub>\_UK</sub>,  
        fl_oz<sub>\_US</sub>, gi<sub>\_US</sub>, pt<sub>\_US</sub>, qt<sub>\_US</sub>, gal<sub>\_US</sub>, bbl<sub>\_US</sub>;

- Volume, dry: (US) pt<sub>\_dry</sub>, (US) qt<sub>\_dry</sub>, (US) gal<sub>\_dry</sub>, (US) bbl<sub>\_dry</sub>,  
          pk (or pk<sub>\_UK</sub>, pk<sub>\_US</sub>), bu (or bu<sub>\_UK</sub>, bu<sub>\_US</sub>);

- Force: ozf (or oz<sub>\_f</sub>), lbf (or lb<sub>\_f</sub>), kip (or kipf, kip<sub>\_f</sub>), tonf (or ton<sub>\_f</sub>), pdl;

- Pressure: osi, osf, psi, psf, ksi, ksf, tsi, tsf, inHg;

- Energy/work: BTU, therm (or therm<sub>\_UK</sub>, therm<sub>\_US</sub>), quad;

- Power: hp, hpE, hpS.

Angle units are accepted by trigonometric functions, and they override all other settings.
Inverse trigonometric functions return unitless values by default.
If you want them to return the result in the current units, you have to define a variable: *ReturnAngleUnits* = 1.

Literals that follow numbers immediately are parsed as units, e.g. "2 m". Standalone literals can be either units or variables, e.g. "N\*m". The rules for parsing are as follows: If a literal has not been defined as a variable, it is parsed as a unit.
Otherwise, it is parsed as a variable, even if a unit with the same name exists.
If you put a dot before the literal, you will force it to be parsed as a unit, even if a variable with the same name exists, e.g. ".N\*.m".

#### Custom units

You can define your own "custom" units and use them like any others in your code.
Defining a unit is similar to defining a variable, but the name must be prefixed with a dot ".":

  .*Name* = expression

Names can include some currency symbols like: €, £, ₤, ¥, ¢, ₽, ₹, ₩, ₪. If you need to create a unit, that derive from others, you can write an expression with numbers and units on the right side.
You can also define dimensionless units, like currency (USD, EUR, €, ₤) or information (bit, byte, KiB, etc), by specifying "= 1" for the first unit and setting the others as multiples.
For example:

  .*bit* = 1  
  .*byte* = 8\**bit*  
  .*KiB* = 1024\**byte*  
  ...

Custom dimensionless units exist in a special (ninth) non-physical dimension.
That is how they do not cancel or convert to other dimensionless units, like percents or angles, when mixed.
However, if you have two types of dimensionless units in a single file, they will exist in the same dimension, so you should avoid mixing them.

### Vectors

#### Internal implementation and types of vectors

There are two types of vectors in Calcpad: regular (small) and large.
Vectors can contain only real numbers with units.
Complex vectors are not supported in this version.
A single vector can contain different types of units, even if not consistent.
However, some vector functions or operators may fail due to units’ inconsistency between separate elements.

Vectors with length that is greater than 100 are created as "large". Externally they behave just as regular vectors, so the user cannot make any difference.
But internally, they operate quite differently.
The structure of a large vector is displayed on the figure below:

<img src="./media/image29.png" style="width:5.36042in;height:1.08819in" alt="Картина, която съдържа текст, екранна снимка, линия, Шрифт Описанието е генерирано автоматично" />

A vector is defined with its full "mathematical" length, but no memory is initially reserved for it.
This length can be obtained by the **len**($\vec{v}$) function.
The greatest index of a non-zero element defines the internal size of a vector.
It is returned by the **size**($\vec{v}$) function.
The rest of the elements are known to be zero, so Calcpad does not need to store them in memory.
Instead, it returns directly zero, if such an element is accessed.

This allows the software to work efficiently with vectors that are not entirely filled.
Such vectors are very common in engineering as is the load vector in finite element analyses.
However, Calcpad reserves a little bit more memory above the size, that is called "capacity". This is because resizing a vector is computationally expensive.
Since we normally assign elements in a loop, in this way we avoid resizing the vector on each iteration.

#### Definition

Vectors can be defined by using the following syntax:

   $\vec{a}$ = \[ *a*1; *a*2; *a*3; ... ; *a*i; ... ; *a*n \]

The values of the separate elements can be specified by expressions that include variables, operators, functions, etc.
For example:

  *a* = \[**cos**(0); 2; 3; 2\*2; 6 - 1\]' = \[1 2 3 4 5\].

You can also include other vectors in the list.
Their elements will be included in the sequence at place, as follows:

  *b* = \[0; *a*; 6; 7; 8\]' = \[0 1 2 3 4 5 6 7 8\].

If you include matrices, they will be linearized to vectors by augmenting all rows one after the other.
Vectors can be also defined as functions that will create them dynamically, depending on certain input parameters.
For example:

  *a*(*x*) = \[1; *x*; *x*^2; *x*^3; *x*^4\]  
  *a*(2)' = \[1 2 4 8 16\]

Besides square brackets, you can also define vectors by using creational functions, as follows:

  *a* = **vector**(5)' = \[0 0 0 0 0\] - creates an empty vector with 5 elements;  
  **fill**(*a*; 5)' = \[5 5 5 5 5\] - fills the vector with a value of 5;  
  *a* = **range**(0; 10; 2)' = \[0 2 4 6 8 10\] - creates a vector from a range of values starting from 0 to 10 with step 2.

#### Indexing

You can access individual elements of a vector for reading and writing by using indexes.
You have to specify the vector name, followed by a dot "." and the index after that.
The first element has an index of one.
The index can be a number, a single variable or expression.
In the last case, the expression must be enclosed by brackets.
For example:

  *a* = \[2; 4; 6; 8; 10\]  
  *a*.2' = 4  
  *k* = 3', '*a*.*k*' = $\vec{a}_{3}$ = 6  
  *a*.(2\**k* - 1)' = $\vec{a}_{5}$ = 10

If an index value is less than 1 or greater than the vector length **len**($\vec{a}$), the program will return an error: Index out of range.
You can use indexing to initialize vectors inside loops (block or inline). For that purpose, you must include the loop counter into the index.
For example:

  *a* = **vector**(6)','*b* = **vector**(6)  
  'Block loop  
  #for *k* = 1 : **len**(*a*)  
    *a*.*k* = *k*^2  
  #loop  
  'Inline loop  
  \$Repeat{*b*.*k* = *a*.(*k* - 1) @ *k* = 2 : **len**(*b*)}

The above code will produce the following two vectors:

> $\vec{a}$ = \[1 4 9 16 25 36\] and  
> $\vec{b}$ = \[0 1 4 9 16 25\].

#### Structural functions

This includes all functions that read or modify the structure of the vector.
It means that the result does not depend on the content, i.e. the values of elements.
The following functions are available in Calcpad:

  **len**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.

    *Return value*: (scalar) the length of vector $\vec{a}$.  
    *Notes*:     Represents the full length of the vector (in respect to element count).  
    *Example*:   **len**(\[1; 0; 2; 3\])' = 4

  **size**($\vec{a}$)

    *Parameters*: $\vec{a}$ - vector.  
    *Return value*: (scalar) the internal size of vector $\vec{a}$.

    *Notes*: If $\vec{a}$ is a large vector, returns the index of the last non-zero element, else -  
returns the vector length.  
    *Example*: *a* = **vector**(200)  
*a*.35 = 1  
**len**(*a*)' = 200  
**size**(*a*)' = 35  
**size**(\[1; 2; 3; 0; 0\])' = 5

  **resize**($\vec{a}$; *n*)

    *Parameters*: $\vec{a}$ - vector;  
*n* - (positive integer) the new length of vector $\vec{a}$.  
    *Return value*: the resized vector $\vec{a}$.

    *Notes*: Sets a new length *n* of vector $\vec{a}$ by modifying the vector in place and  
returns a reference to the same vector as a result.

    *Example*: *a* = \[1; 2; 3; 4; 5\]  
*b* = **resize**(*a*; 3)' = \[1 2 3\]  
*a*' = \[1 2 3\]

  **join**(*A*; $\vec{b}$; *c*…)

    *Parameters*: a list of matrices, vectors and scalars.  
    *Return value*: a new vector, obtained by joining the arguments in the list.  
    *Notes*: The list can include unlimited number of items of different types, mixed  
arbitrarily.
Matrices are first linearized by rows and their elements are  
included into the common sequence, as well as the vectors, each at its  
place.  
    *Example*: *A* = \[1; 2\|3; 4\]  
*b* = \[7; 8; 9\]  
*c* = **join**(0; *A*; 5; 6; *b*)' = \[0 1 2 3 4 5 6 7 8 9\]

  **slice**($\vec{a}$; *i*1; *i*2)

    *Parameters*: $\vec{a}$ - vector;

*i*1 - (positive integer) starting index;

*i*2 - (positive integer) ending index.

    *Return value*: a new vector, containing the part of vector $\vec{a}$ bounded by indexes *i*1 and *i*2, inclusively.

    *Notes*:     It is not required that *i*1 ≤ *i*2. If an index is greater than the vector length, then all remaining elements are returned to the end.  
    *Example*: **slice**(\[1; 2; 3; 4; 5; 6; 7; 8\]; 3; 7)' = \[3 4 5 6 7\]  
**slice**(\[1; 2; 3; 4; 5; 6; 7; 8\]; 6; 10)' = \[6 7 8\]

  **first**($\vec{a}$; *n*)

    *Parameters*: $\vec{a}$ - vector;  
*n* - (positive integer) the number of elements to return.  
    *Return value*: a vector containing the first *n* elements of $\vec{a}$.  
    *Notes*: If *n* is greater than the length of ⃗ *a*, then all elements are returned.  
Unlike **resize** the original vector is not modified.  
    *Example*: **first**(\[0; 1; 2; 3; 4; 5\]; 3)' = \[0 1 2\]  
**first**(\[0; 1; 2; 3; 4; 5\]; 10)' = \[0 1 2 3 4 5\]

  **last**($\vec{a}$; *n*)

    *Parameters*:  $\vec{a}$ - vector;  
*n* - (positive integer) the number of elements to return.  
    *Return value*: a vector containing the last *n* elements of $\vec{a}$.  
    *Notes*: If *n* is greater than the length of $\vec{a}$, then all elements are returned.  
    *Example*: **last**(\[0; 1; 2; 3; 4; 5\]; 3)' = \[3 4 5\]  
**last**(\[0; 1; 2; 3; 4; 5\]; 10)' = \[0 1 2 3 4 5\]

  **extract**($\vec{a}$; $\vec{i}$)

    *Parameters*:  $\vec{a}$ - a vector containing the elements to be extracted;  
$\vec{i}$ - a vector with the indexes of the elements to be extracted from $\vec{a}$.  
    *Return value*: a vector with the extracted elements from $\vec{a}$ which indexes are provided in $\vec{i}$.  
    *Notes*:     All indexes in $\vec{i}$ must be positive integers.
If an index is greater than the  
length of vector $\vec{a}$, an "Index out of range" error is returned.  
    *Example*: *a* = \[0; 1; 2; 3; 4; 5; 6\]  
**extract**(a; \[2; 4; 6\])' = \[1 3 5\]

#### Data functions

This kind of functions treat the vector contents as numerical data.
They are related mainly to sorting, ordering, searching and counting.
Unlike structural functions, the result depends on the element values.
You can use the following functions:

  **sort**($\vec{a}$)

    *Parameters*: $\vec{a}$ - input vector.  
    *Return value*: a vector containing the elements of $\vec{a}$, sorted in ascending order.  
    *Notes*: The original content of $\vec{a}$ is not modified.  
    *Example*: *a* = \[4; 0; 2; 3; -1; 1\]  
*b* = **sort**(*a*)' = \[-1 0 1 2 3 4\]  
*a*' = \[4 0 2 3 -1 1\]

  **rsort**($\vec{a}$)

    *Parameters*: $\vec{a}$ - input vector.

    *Return value*: a vector containing the elements of $\vec{a}$, sorted in descending order.  
    *Notes*: Similar to **sort**, the original content of *⃗a* remains unchanged.  
    *Example*: **rsort**(\[4; 0; 2; 3; -1; 1\])' = 4 3 2 1 0 -1\]

  **order**($\vec{a}$)

    *Parameters*: $\vec{a}$ - input vector.  
    *Return value*: a vector with indexes, ordered by the elements of $\vec{a}$, ascendingly.  
    *Notes*: Each index in the output vector $\vec{i}$ shows which element in $\vec{a}$ should be placed at the current position to obtain a sorted sequence.  
You can do that by calling **extract**($\vec{a}$; $\vec{i}$).  
    *Example*: *a* = \[4; 0; 2; 3; -1; 1\]  
*i* = **order**(*a*)' = \[5 2 6 3 4 1\]  
*b* = **extract**(*a*; *i*)' = \[-1 0 1 2 3 4\]

  **revorder**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - input vector.  
    *Return value*: a vector with indexes, ordered by the elements of $\vec{a}$, descending.  
    *Notes*:     The same considerations as for the **order** function apply.  
    *Example*:   **revorder**(\[4; 0; 2; 3; -1; 1\])' = \[1 4 3 6 2 5\]

  **reverse**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - input vector.  
    *Return value*: a vector containing the elements of $\vec{a}$ in reverse order.  
    *Notes*:     The original content of $\vec{a}$ remains unchanged.  
    *Example*:   **reverse**(\[1; 2; 3; 4; 5\])' = \[5 4 3 2 1\]

  **count**($\vec{a}$; *x*; *i*)

    *Parameters*:  $\vec{a}$ - vector;  
*x* - (scalar) the value to count;  
*i* - (positive integer) the index to start with.  
    *Return value*: (scalar) the number of elements in $\vec{a}$, after the i-th one, that are equal to *x*.  
    *Notes*:     If *i* is greater than the length of $\vec{a}$, then zero is returned.  
    *Example*:   **count**(\[0; 1; 2; 1; 4; 1\]; 1; 4)' = 2

  **search**($\vec{a}$; *x*; *i*)

    *Parameters*:  $\vec{a}$ - vector;  
*x* - (scalar) the value to search for;  
*i* - (positive integer) the index to start with.  
    *Return value*: (scalar) the index of the first element in $\vec{a}$, after the i-th, that is equal to *x*.  
    *Notes*: If *i* is greater than the length of $\vec{a}$ or the value is not found, zero is returned.  
    *Example*: **search**(\[0; 1; 2; 1; 4; 1\]; 1; 3)' = 4  
**search**(\[0; 1; 2; 1; 4; 1\]; 1; 7)' = 0

  **find**($\vec{a}$; *x*; *i*)

    *Parameters*:  $\vec{a}$ - vector;  
*x* - (scalar) the value to search for;  
*i* - (positive integer) the index to start with.  
    *Return value*: a vector with the indexes of all elements in $\vec{a}$, after the i-th, that are equal to *x*.  
    *Notes*: If *i* is greater than the length of $\vec{a}$ or the value is not found, an empty vector is returned (with zero length).  
    *Example*: **find**(\[0; 1; 2; 1; 4; 1\]; 1; 2)' = \[2 4 6\]  
**find**(\[0; 1; 2; 1; 4; 1\]; 3; 2)' = \[\]

  **lookup**($\vec{a}$; $\vec{b}$; *x*)

    *Parameters*:  $\vec{a}$ - vector with reference values;

*b* - vector with return values;  
*x* - (scalar) the value to look for.  
    *Return value*: a vector with all elements in $\vec{b}$, for which the corresponding elements  
in $\vec{a}$ are equal to *x*.  
    *Notes*:     if the value is not found, an empty vector is returned (with zero length)  
    *Example*: *a* = \[0; 1; 0; 0; 1; 1\]  
*b* = \[1; 2; 3; 4; 5; 6\]  
**lookup**(*a*; *b*; 0)' = \[1 3 4\]  
**lookup**(*a*; *b*; 2)' = \[\]

The **find** and **lookup** functions have variations with suffixes.
Different suffixes refer to different comparison operators.
They replace the equality in the original functions while the other behavior remains unchanged.
The possible suffixes are given in the table below:

|  |  |  |  |
|----|----|----|----|
| suffix | find | lookup | comparison operator |
| \_eq | **find_eq**($\vec{a}$; *x*; *i*) | **lookup_eq**($\vec{a}$; $\vec{b}$; *x*) | = - equal |
| \_ne | **find_ne**($\vec{a}$; *x*; *i*) | **lookup_ne**($\vec{a}$; $\vec{b}$; *x*) | ≠ - not equal |
| \_lt | **find_lt**($\vec{a}$; *x*; *i*) | **lookup_lt**($\vec{a}$; $\vec{b}$; *x*) | \< - less than |
| \_le | **find_le**($\vec{a}$; *x*; *i*) | **lookup_le**($\vec{a}$; $\vec{b}$; *x*) | ≤ - less than or equal |
| \_gt | **find_gt**($\vec{a}$; *x*; *i*) | **lookup_gt**($\vec{a}$; $\vec{b}$; *x*) | \> - greater than |
| \_ge | **find_ge**($\vec{a}$; *x*; *i*) | **lookup_ge**($\vec{a}$; $\vec{b}$; *x*) | ≥ - greater than or equal |

#### Math functions

All standard scalar math functions accept vector arguments as well.
The function is applied separately to each of the elements in the input vector and the results are returned in a corresponding output vector.
For example:

  **sin**(\[0; 30; 45; 90\])' = \[0 0.5 0.707 1\]

Calcpad also includes several math functions that are specific for vectors:

  **norm_p**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.  
    *Return value*: scalar representing the Lp norm of vector $\vec{a}$.  
    *Notes*:    The Lp norm is obtained by the formula: $`\left\| \overrightarrow{a} \right\|_{p} = \left( \sum_{i = 1}^{n}\left| a_{i} \right|^{p} \right)^{\frac{1}{p}}`$.  
    *Example*:   **norm_p**(\[1; 2; 3\]; 3)' = 3.3019

  **norm_1**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.  
    *Return value*: scalar representing the L1 norm of vector $\vec{a}$.

    *Notes*:     The L1 norm is obtained by the formula: $`\left\| \overrightarrow{a} \right\|_{1} = \sum_{i = 1}^{n}{a_{i} \vee}`$.

    *Example*:   **norm_1**(\[-1; 2; 3\])' = 6

  **norm**($\vec{a}$) or **norm_2**($\vec{a}$) or **norm_e**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.  
    *Return value*: scalar representing the L2 (Euclidian) norm of vector $\vec{a}$.  
    *Notes*:     The L2 norm is obtained by the formula: $`\left\| \overrightarrow{a} \right\|_{2} = \sqrt{\sum_{i = 1}^{n}a_{i}^{2}}`$.  
    *Example*:   **norm_2**(\[1; 2; 3\])' = 3.7417

  **norm_i**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.  
    *Return value*: scalar representing the L∞ (infinity) norm of vector $\vec{a}$.  
    *Notes*:     The L∞ norm is obtained by the formula: \|\| $\vec{a}$ \|\|∞ = **max** \| *a*i \|.

    *Example*:   **norm_i**(\[1; 2; 3\]; 3)' = 3

  **unit**($\vec{a}$)

    *Parameters*:  $\vec{a}$ - vector.  
    *Return value*: the normalized vector $\vec{a}$ (with L2 norm \|\| $\vec{a}$ \|\|2 = 1).  
    *Notes*:     The elements of the normalized vector $\vec{a}$ are evaluated by the expression: *ui* = *ai* / \|\|*a*\|\|2

    *Example*:   **unit**(\[1; 2; 3\])' = \[0.26726 0.53452 0.80178\]

  **dot**($\vec{a}$; $\vec{b}$)

    *Parameters*:  $\vec{a}$, $\vec{b}$ - vectors.  
    *Return value*: scalar representing the dot product of both vectors $\vec{a}$ · $\vec{b}$;  
    *Notes*: The dot product is obtained by the expression: $\vec{a}$ · $\vec{b}$ $`\sum_{i = 1}^{n}{a_{i}{\bullet b}_{i}}`$

    *Example*: *a* = \[1; 2; 4\]  
*b* = \[5; 3; 1\]  
**dot**(*a*; *b*)' = 15

  **cross**($\vec{a}$; $\vec{b}$)

    *Parameters*:  $\vec{a}$, $\vec{b}$ - vectors.  
    *Return value*: vector representing the cross product $\vec{c}$ = $\vec{a}$ × $\vec{b}$.

    *Notes*:     This function is defined only for vectors with lengths 2 or 3.The elements of the resulting vector $\vec{c}$ are calculated as follows:

*c*1 = *a*2 *b*3 − *a*3 *b*2; *c*2 = *a*3 *b*1 − *a*1 *b*3; *c*3 = *a*1 *b*2 − *a*2 *b*1  
    *Example*: *a* = \[1; 2; 4\]  
*b* = \[5; 3; 1\]  
**cross**(*a*; *b*)' = \[-10 19 -7\]

#### Aggregate and interpolation functions

All aggregate functions can work with vectors.
Since they are multivariate, each of them can accept a single vector, but also a list of scalars, vectors and matrices, mixed in arbitrary order.
In this case, all arguments are merged into a single array of scalars, consecutively from left to right.
For example:

  *a* = \[0; 2; 6\]  
  *b* = \[5; 3; 1\]  
  **sum**(10; *a*; *b*; 11)' = 38

Interpolation functions behave similarly, but the first argument must be scalar, that represents the interpolation variable.
For example:

  **take**(3; *a*)' = 6  
  **line**(1.5; *a*)' = 1  
  **spline**(1.5; *a*)' = 0.8125

Like aggregate functions, interpolation functions also accept mixed lists of arguments, as follows:

  *a* = \[1; 2; 3\]  
  *b* = \[5; 6; 7; 8\]  
  **take**(7; *a*; 4; *b*; 9; 10)' = 7

The returned value is actually the third element in vector $\vec{b}$, but it has an index 7 in the final sequence.
A full list of the available aggregate and interpolation functions is provided earlier in this manual (see "Expressions/Functions" above).

#### Operators

All operators can work with vector operands.
Operations are performed element-by-element and the results are returned in an output vector.
This applies also for the multiplication operator.
For example:

  \[2; 4; 5\]\*\[2; 3; 4\]' = \[4 12 20\]

If the lengths of both vectors are different, the shorter vector is padded with zeros to the length of the longer one.
Dot and cross products in Calcpad are implemented as functions (see above). All binary operators are supported for vector-scalar and scalar-vector operands in a similar way.
For example:

  \[2; 4; 5\]\*2' = \[4 8 10\]

### Matrices

#### Internal implementation and types of matrices

Calcpad includes different types of matrices: general (rectangular) and special (column, symmetric, diagonal.
upper/lower triangular). Internally, each type is implemented in a different way that benefits from the specific structure for better efficiency.
Externally, all of them behave in a similar way, except for a few cases.

Each matrix type is implemented as an array of vectors, as displayed on the figure below.
Vectors normally represent matrix rows, except for diagonal and column matrices.

<img src="./media/image30.png" style="width:6.71339in;height:4.4143in" alt="Картина, която съдържа текст, диаграма, линия, Паралелен Описанието е генерирано автоматично" />

Calcpad uses large vectors to contain the values.
So, it does not store the extra zero elements for partially filled (banded) matrices.
The indexing operator for each type is internally redefined in order to return directly zero when we try to read a value outside the matrix structure or bandwidth.

|  |  |
|----|----|
| a\) diagonal matrix - | *M*\[*i*, *j*\] = *d*\[*i*\], if *i* = *j* and 0, if *i* ≠ *j*; |
| b\) column matrix - | *M*\[*i*, *j*\] = *c*\[*i*\], if *j* = 1, otherwise – error; |
| c\) upper triangular matrix - | *M*\[*i*, *j*\] = *r*i\[*j* – *i* + 1\], if *j* ≥ *i*, otherwise – 0; |
| d\) lower triangular matrix - | *M*\[*i*, *j*\] = *r*i\[*j*\], if *j* ≤ *i*, otherwise – 0; |
| e\) row matrix - | *M*\[*i*, *j*\] = *r*\[*j*\], if *i* = 1, otherwise – error; |
| f\) symmetric matrix - | *M*\[*i*, *j*\] = *r*i\[*j* – *i* + 1\], if *i* ≥ *j*, otherwise = *r*i \[*i* – *j* + 1\]; |
| g\) rectangular matrix - | *M*\[*i*, *j*\] = *r*i\[*j*\]; |

If we try to write a non-zero value outside the matrix structure, we will get an "Index out of range" error.
For example, you cannot assign a non-zero value to an element outside the main diagonal of a diagonal type of matrix.

#### Definition

Similar to vectors, you can define matrices by using the "square brackets" syntax, but the rows must be separated by vertical bars " \| ", as follows:

*A*m⨯n = \[*a*11; *a*12; ... ; *a*1n \| *a*21; *a*22; ... ; *a*2n \| ... \| *a*m1; *a*m2; ... ; *a*mn\]

In this way, you can create only general (rectangular) types of matrices.
For special types of matrices, you have to use the respective creational functions as described further in this manual.
If you have rows with different lengths, the number of columns *n* is assumed to be the maximum number of elements in a row.
The missing elements in other rows are assumed to be zero.
For example:

  *A* = \[1\|2; 3\|4; 5; 6\|7; 8\]' = $`\begin{bmatrix}
1 & 0 & 0 \\
2 & 3 & 0 \\
4 & 5 & 6 \\
7 & 8 & 0
\end{bmatrix}`$

You can use expressions for matrix elements that contain variables, operators, functions, vectors, other matrices, etc.
For example, the following code will create a matrix of three rows by applying a different expression for each row on a single vector:

  *a* = \[1; 2; 4\]  
  *A* = \[*a*\|2\**a* + 1\|3\**a* + 2\]' = $`\begin{bmatrix}
1 & 2 & 4 \\
5 & 5 & 9 \\
8 & 8 & 14
\end{bmatrix}`$

Just like vectors, matrices can also be defined as functions to create them dynamically on demand.
The following function generates a 4×4 Vandermonde matrix from a vector containing the elements for the first column:

  *A*(*x*) = **transp**(\[*x*^0\|*x*\|*x*^2\|*x*^3\|*x*^4\])  
  *x* = \[1; 2; 3; 4\]  
  *A* = *A*(*x*)' = $`\begin{bmatrix}
1 & 1 & 1 & 1 & 1 \\
1 & 2 & 4 & 8 & 16 \\
1 & 3 & 9 & 27 & 81 \\
1 & 4 & 16 & 64 & 256
\end{bmatrix}`$

#### Indexing

You can use indexing to access individual matrix elements for reading and writing their values.
Similar to vectors, this is performed by the dot operator, but you have to specify two indexes, as follows:

  *A*.(*i*; *j*), where:  
    *i* - the index of the row where the element is located,  
    *j* - the index of the column.

Indexes must be enclosed in brackets and divided by a semicolon.
Row and column numbering start from one.
For the Vandermonde matrix from the above example:

  *A*.(3; 2)' = 3.

You can have expressions inside the brackets to calculate the indexes in place:

  *i* = 2', '*j* = 3  
  *A*.(2\**i* - 1; *j* + 1)' *A*3, 4 = 27.

In this way, you can iterate through matrix elements in a loop and include the loop counters in the respective indexes.
You can use both inline and block loops for that purpose.
The code below creates a Vandermonde matrix from vector $\vec{x}$ with the specified number of columns (6):

  *x* = \[1; 2; 3; 4\]  
  *A* = **matrix**(len(*x*); 7)  
  #hide  
  #for *i* = 1 : **n_rows**(*A*)  
    #for *j* = 1 : **n_cols**(*A*)  
      *A*.(*i*; *j*) = *x*.*i*^(*j* - 1)  
    #loop  
  #loop  
  #show  
  *A*' = $`\begin{bmatrix}
1 & 1 & 1 & 1 & 1 & 1 & 1 \\
1 & 2 & 4 & 8 & 16 & 32 & 64 \\
1 & 3 & 9 & 27 & 81 & 243 & 729 \\
1 & 4 & 16 & 64 & 256 & 1024 & 4096
\end{bmatrix}`$

The inline equivalent of the above loop is the following:

  \$Repeat{\$Repeat{*A*.(*i*; *j*) = *x*.*i*^(*j* - 1) @ *j* = 1 : **n_cols**(*A*)} @ *i* = 1 : **n_rows**(*A*)}

#### Creational functions

The "square brackets" syntax is very powerful and flexible for creating small matrices with predefined sizes.
However, it also has a lot of limitations.
For example, it cannot create special types of matrices and cannot specify the matrix dimensions.
That is why, Calcpad also includes various functions for creating matrices, as follows:

  **matrix**(*m*; *n*)

    *Parameters*: *m* - (positive integer) number of rows;  
*n* - (positive integer) number of columns.  
    *Return value*: an empty rectangular matrix with dimensions m⨯n.  
    *Notes*: *m* and *n* must be between 1 and 1 000 000. This also applies to all other kinds of matrices below.  
    *Example*: **matrix**(3; 4)' = $`\begin{bmatrix}
0 & 0 & 0 & 0 \\
0 & 0 & 0 & 0 \\
0 & 0 & 0 & 0
\end{bmatrix}`$

  **identity**(*n*)

    *Parameters*: *n* - number of rows/columns.  
    *Return value*: an identity matrix with dimensions n⨯n.  
    *Notes*: Represents is a diagonal matrix, filled with one along the main diagonal.  
This function is equivalent to **diagonal**(*n* ; 1).  
    *Example*: **identity**(3)' = $`\begin{bmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 1
\end{bmatrix}`$

  **diagonal**(*n*; *d*)

    *Parameters*: *n* - number of rows/columns;  
*d* - the value along the main diagonal  
    *Return value*: an n⨯n diagonal matrix, filled with value *d* along the main diagonal.

    *Notes*: It is internally different and more efficient than an n⨯n symmetric matrix.  
    *Example*: **diagonal**(3; 2)' = $`\begin{bmatrix}
2 & 0 & 0 \\
0 & 2 & 0 \\
0 & 0 & 2
\end{bmatrix}`$

  **column**(*m*; *c*)

    *Parameters*: *m* - number of rows;  
*c* - a value to fill the matrix with.  
    *Return value*: an m⨯1 column matrix, filled with value *c*.  
    *Notes*: It is internally different and more efficient than an mx1 rectangular matrix.  
    *Example*: **column**(3; 2)' = $`\begin{bmatrix}
2 \\
2 \\
2
\end{bmatrix}`$

  **utriang**(*n*)

    *Parameters*: *n* - number of rows/columns.  
    *Return value*: an empty upper triangular matrix with dimensions n⨯n.  
    *Notes*: It is internally different and more efficient than a general n⨯n matrix.  
    *Example*: *U* = **utriang**(3)  
**mfill**(*U*; 1)' = $`\begin{bmatrix}
1 & 1 & 1 \\
0 & 1 & 1 \\
0 & 0 & 1
\end{bmatrix}`$

  **ltriang**(*n*)

    *Parameters*: *n* - number of rows/columns.  
    *Return value*: an empty lower triangular matrix with dimensions n⨯n.  
    *Notes*: It is internally different and more efficient than general n⨯n matrix.  
    *Example*: *L* = **ltriang**(3)  
**mfill**(*L*; 1)' = $`\begin{bmatrix}
1 & 0 & 0 \\
1 & 1 & 0 \\
1 & 1 & 1
\end{bmatrix}`$

  **symmetric**(*n*)

    *Parameters*: *n* - number of rows/columns.  
    *Return value*: an empty n⨯n symmetric matrix.  
    *Notes*: It is internally different and more efficient than general n⨯n matrix.
Only the filled side of the upper-right half of the matrix is stored, forming a skyline structure.
If you change a value on either of both sides also changes the respective value on the other side, keeping the matrix always symmetric.  
    *Example*: *A* = **symmetric**(4)  
*A*.(1; 1) = 5', '*A*.(1; 2) = 4  
*A*.(2; 2) = 3', '*A*.(2; 3) = 2  
*A*.(4; 2) = 1', '*A*.(4; 4) = 1  
*A*' = $`\begin{bmatrix}
5 & 4 & 0 & 0 \\
4 & 3 & 2 & 1 \\
0 & 2 & 0 & 0 \\
0 & 1 & 0 & 1
\end{bmatrix}`$

  **vec2diag**($\vec{v}$)

    *Parameters*: $\vec{v}$ - a vector containing the diagonal elements.  
    *Return value*: a diagonal matrix from the elements of vector $\vec{v}$.  
    *Notes*:     The size of the matrix is equal to the number of elements in $\vec{v}$.  
    *Example*:   **vec2diag**(\[1; 2; 3\]' = $`\begin{bmatrix}
1 & 0 & 0 \\
0 & 2 & 0 \\
0 & 0 & 3
\end{bmatrix}`$

**vec2row**($\vec{v}$)

    *Parameters*: $\vec{v}$ - a vector containing the elements of the row matrix.  
    *Return value*: a row matrix from the elements of vector $\vec{v}$.  
    *Notes*: The number of columns of the matrix is equal to the size of $\vec{v}$.  
    *Example*: **vec2row**(\[1; 2; 3\]' = $`\begin{bmatrix}
1 & 2 & 3
\end{bmatrix}`$

**vec2col**($\vec{v}$)

    *Parameters*: $\vec{v}$ - a vector containing the elements of the column matrix.  
    *Return value*: a column matrix from the elements of vector $\vec{v}$.  
    *Notes*: The number of rows of the matrix is equal to the size of $\vec{v}$.  
    *Example*: **vec2col**(\[1; 2; 3\]' = $`\begin{bmatrix}
1 \\
2 \\
3
\end{bmatrix}`$

  **join_cols**($\vec{c}_{1}$; $\vec{c}_{2}$; $\vec{c}_{3}$ ...)

    *Parameters*: $\vec{c}_{1}$, $\vec{c}_{2}$, $\vec{c}_{3}$ ... - vectors.  
    *Return value*: a new rectangular matrix, obtained by joining the column vectors.  
    *Notes*: You can specify arbitrary number of input vectors with different lengths.
The number of rows is equal to the maximum vector length and the other columns are filled down with zeros to the end.
The vectors are joined sequentially from left to right.  
    *Example*: **join_cols**(\[1\]; \[4; 5; 6\]; \[7; 8\]; \[10; 11; 12\]' = $`\begin{bmatrix}
1 & 4 & 7 & 10 \\
0 & 5 & 8 & 11 \\
0 & 6 & 0 & 12
\end{bmatrix}`$

  **join_rows**($\vec{r}_{1}$; $\vec{r}_{2}$; $\vec{r}_{3}$ ...)

    *Parameters*: $\vec{r}_{1}$, $\vec{r}_{2}$, $\vec{r}_{3}$... - vectors.  
    *Return value*: a new rectangular matrix, which rows are the specified vector arguments.  
    *Notes*: You can have an arbitrary number of input vectors with different lengths.
The number of columns is equal to the maximum vector length.
The other rows are filled up with zeros to the end.
The vectors are collected from left to right and arranged into rows from top to bottom.  
    *Example*: **join_rows**(\[1; 2; 3; 4\]; \[6; 7; 8; 9; 10\]' = $`\begin{bmatrix}
1 & 2 & 3 & 4 & 0 \\
6 & 7 & 8 & 9 & 10
\end{bmatrix}`$

  **augment**(*A*; *B*; *C* ...)

    *Parameters*: *A*, *B*, *C* ... - matrices.  
    *Return value*: a rectangular matrix obtained by joining the input matrices side to side.  
    *Notes*: You can specify arbitrary number of input matrices with different number of rows.
The largest number is relevant, and smaller matrices are filled down with zeros to the end.
Matrices are joined sequentially from left to right.
If the arguments contain vectors, they are treated as columns.  
    *Example*: *A* = \[1; 2\|3; 4\]  
*B* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]  
*c* = \[10; 11; 12; 13\]  
*D* = **augment**(*A*; *B*; *c*)' = $`\begin{bmatrix}
1 & 2 & 1 & 2 & 3 & 10 \\
3 & 4 & 4 & 5 & 6 & 11 \\
0 & 0 & 7 & 8 & 9 & 12 \\
0 & 0 & 0 & 0 & 0 & 13
\end{bmatrix}`$

**stack**(*A*; *B*; *C* ...)

    *Parameters*: *A*, *B*, *C* ... - matrices.  
    *Return value*: a rectang.
matrix, obtained by stacking the input matrices one below the other.  
    *Notes*: You can specify an arbitrary number of input matrices with different row lengths.
The largest number is relevant, and smaller matrices are filled up with zeros to the end.
Matrices are joined sequentially from top to bottom.
If the arguments contain vectors, they are treated as columns.  
    *Example*: *A* = \[1; 2\|3; 4\]  
*B* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]  
*c* = \[10; 11\]  
*D* = **stack**(*A*; *B*; *c*)' = $`\begin{bmatrix}
1 & 2 & 0 \\
3 & 4 & 0 \\
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9 \\
10 & 0 & 0 \\
11 & 0 & 0
\end{bmatrix}`$

#### Structural functions

Structural functions are related only to the matrix structure.
Unlike data and math functions, the result does not depend much on the values of the elements.

  **n_rows**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: the number of rows in matrix *M*.  
    *Example*: **n_rows**(\[1; 2\|3; 4\|5; 6\])' = 3

  **n_cols**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: the number of columns in matrix *M*.  
    *Example*: **n_cols**(\[1\|2; 3\|4; 5; 6\])' = 3

  **mresize**(*M*; *m*; *n*)

    *Parameters*: *M* - the matrix to be resized;  
    *m* - the new number of rows;  
  *n* - the new number of columns.  
    *Return value*: the matrix *M* resized to *m* rows and *n* columns.  
    *Notes*: If the new dimensions are larger, the added elements are initialized with zeroes.
If smaller, the matrix is truncated.
If the new dimensions are compatible to the matrix type, then the original matrix is resized in place and a reference to it is returned.
Otherwise, a new rectangular type of matrix is returned with the specified dimensions and the original matrix remains unchanged.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$ - general type.  
*B* = **mresize**(*A*; 2; 4)' = $`\begin{bmatrix}
1 & 2 & 3 & 0 \\
4 & 5 & 6 & 0
\end{bmatrix}`$ - also a general type.  
*A*' = $`\begin{bmatrix}
1 & 2 & 3 & 0 \\
4 & 5 & 6 & 0
\end{bmatrix}`$ - the original matrix was changed.  
*A* = **diagonal**(3; 5)' = $`\begin{bmatrix}
5 & 0 & 0 \\
0 & 5 & 0 \\
0 & 0 & 5
\end{bmatrix}`$ - diagonal type.  
*B* = **mresize**(*A*; 2; 4)' = $`\begin{bmatrix}
5 & 0 & 0 & 0 \\
0 & 5 & 0 & 0
\end{bmatrix}`$ - general type.  
*A*' = $`\begin{bmatrix}
5 & 0 & 0 \\
0 & 5 & 0 \\
0 & 0 & 5
\end{bmatrix}`$ - the original matrix remains unchanged.

  **mfill**(*M*; *x*)

    *Parameters*: *M* - the matrix to be filled;  
*x* - the value to fill the matrix with.  
    *Return value*: the matrix *M* filled with value *x*.  
    *Notes*: The matrix *M* is modified in place and a reference to it is returned.
This function is structurally compliant.
Special matrices are filled only in the designated area, preserving the type.  
    *Example*: *A* = **matrix**(2; 3)' = $`\begin{bmatrix}
0 & 0 & 0 \\
0 & 0 & 0
\end{bmatrix}`$  
*B* = **mfill**(*A*; 1)' = $`\begin{bmatrix}
1 & 1 & 1 \\
1 & 1 & 1
\end{bmatrix}`$  
*A*' = $`\begin{bmatrix}
1 & 1 & 1 \\
1 & 1 & 1
\end{bmatrix}`$  
*L* = **mfill**(**ltriang**(4); 2)' = $`\begin{bmatrix}
2 & 0 & 0 & 0 \\
2 & 2 & 0 & 0 \\
2 & 2 & 2 & 0 \\
2 & 2 & 2 & 2
\end{bmatrix}`$

  **fill_row**(*M*; *i*; *x*)

    *Parameters*: *M* - the matrix which row is to be filled;  
*i* - the index of the row to be filled;  
*x* - the value to fill the row with.  
    *Return value*: the matrix *M* with the *i*-th row filled with value *x*.  
    *Notes*: The matrix *M* is modified in place and a reference to it is returned.
This function is structurally compliant.
Special matrices are filled only inside the designated area, preserving the type.  
    *Example*: *A* = **matrix**(3; 4)  
**fill_row**(*A*; 2; 1)' = $`\begin{bmatrix}
0 & 0 & 0 & 0 \\
1 & 1 & 1 & 1 \\
0 & 0 & 0 & 0
\end{bmatrix}`$  
*L* = **utriang**(4)’ - upper triangular matrix;  
\$Repeat{**fill_row**(*L*; *k*; *k*) @ *k* = 1 : **n_rows**(*L*)}  
*L*' = $`\begin{bmatrix}
1 & 1 & 1 & 1 \\
0 & 2 & 2 & 2 \\
0 & 0 & 3 & 3 \\
0 & 0 & 0 & 4
\end{bmatrix}`$ - the lower triangle remains unchanged.

   **fill_col**(*M*; *j*; *x*)

    *Parameters*: *M* - the matrix which column is to be filled;  
*j* - the index of the column to be filled;  
*x* - the value to fill the column with.  
    *Return value*: the matrix *M* with the *j*-th column filled with value *x*.  
    *Notes*: The matrix *M* is modified in place and a reference to it is returned.
This function is structurally compliant.
Special matrices are filled only inside the designated area, preserving the type.  
    *Example*: *A* = **matrix**(3; 4)  
**fill_col**(*A*; 2; 1)' = $`\begin{bmatrix}
0 & 1 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 1 & 0 & 0
\end{bmatrix}`$  
*B* = **symmetric**(4)' - symmetric matrix.  
**fill_col**(*B*; 2; 1)' = $`\begin{bmatrix}
0 & 0 & 0 & 0 \\
0 & 1 & 1 & 1 \\
0 & 1 & 0 & 0 \\
0 & 1 & 0 & 0
\end{bmatrix}`$ - the symmetry was preserved.

  **copy**(*A*; *B*; *i*; *j*)

    *Parameters*: *A* - source matrix;  
*B* - destination matrix where the elements will be copied;  
*i* - starting row index in matrix *B*;  
*j* - starting column index in matrix *B*.  
    *Return value*: the matrix *B*, after the elements from *A* are copied, starting at indexes *i* and *j* in *B*.  
    *Notes*: Copying the elements from *A* to *B* modifies the matrix *B* in place.
The existing elements in *B* are replaced by the respective elements from *A*. A reference to *B* is returned as result.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\]  
*B* = **mfill**(**matrix**(3; 4); -1)' = $`\begin{bmatrix}
 -1 & -1 & -1 & -1 \\
 -1 & -1 & -1 & -1 \\
 -1 & -1 & -1 & -1
\end{bmatrix}`$  
**copy**(*A*; *B*; 1; 1)  
**copy**(*A*; *B*; 2; 2)  
*B*' = $`\begin{bmatrix}
1 & 2 & 3 & -1 \\
4 & 1 & 2 & 3 \\
 -1 & 4 & 5 & 6
\end{bmatrix}`$

  **add**(*A*; *B*; *i*; *j*)

    *Parameters*: *A* - source matrix;  
*B* - destination matrix where the elements will be added;  
*i* - starting row index in matrix *B*;  
*j* - starting column index in matrix *B*;  
    *Return value*: the matrix *B* with the added elements from *A* to the respective elements in *B* starting at indexes *i* and *j* in *B*.  
    *Notes*:    Adding the elements from *A* to *B* modifies the matrix *B* in place.
A reference to *B* is returned as result.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\]  
*B* = **mfill**(**matrix**(3; 4); -1)' = $`\begin{bmatrix}
 -1 & -1 & -1 & -1 \\
 -1 & -1 & -1 & -1 \\
 -1 & -1 & -1 & -1
\end{bmatrix}`$  
**add**(*A*; *B*; 1; 1)  
**add**(*A*; *B*; 2; 2)  
*B*' = $`\begin{bmatrix}
0 & 1 & 2 & -1 \\
3 & 5 & 7 & 2 \\
 -1 & 3 & 4 & 5
\end{bmatrix}`$

  **row**(*M*; *i*)

    *Parameters*: *M* - matrix;  
*i* - the index of the row to be extracted.  
    *Return value*: the *i*-th row of matrix *M* as a vector.  
    *Notes*: The full width row is returned, even for special matrices.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**row**(*A*; 3)' = \[7 8 9\]

  **col**(*M*; *j*)

    *Parameters*: *M* - matrix;  
*j* - the index of the column to be extracted.  
    *Return value*: the *j*-th column of matrix *M* as a vector.  
    *Notes*: The full height column is returned, even for special matrices.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**col**(*A*; 2)' = \[2 5 8\]

  **extract_rows**(*M*; $\vec{i}$ )

    *Parameters*: *M* - matrix;  
$\vec{i}$ - vector containing the indexes of the rows to be extracted.  
    *Return value*: a new matrix containing the rows of matrix *M* whose indexes are in vector $\vec{i}$.  
    *Notes*:    The rows are extracted in the order, specified in vector $\vec{i}$. It can be a result from the **order_rows** function.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**extract_rows**(*A*; \[1; 2; 1\])' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
1 & 2 & 3
\end{bmatrix}`$

  **extract_cols**(*M*; $\vec{j}$ )

    *Parameters*: *M* - matrix;  
$\vec{j}$ - vector containing the indexes of the columns to be extracted.  
    *Return value*: a new matrix containing the columns of *M* whose indexes are in vector $\vec{j}$.  
    *Notes*: The columns are extracted in the order, specified in vector $\vec{j}$. It can be a result from the **order_cols** function.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**extract_cols**(*A*; \[3; 2; 1\])' = $`\begin{bmatrix}
3 & 2 & 1 \\
6 & 5 & 4 \\
9 & 8 & 7
\end{bmatrix}`$

  **diag2vec**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: a vector containing the diagonal elements of *M*.  
    *Notes*: The matrix *M* is not required to be square.  
    *Example*: *A* = \[1; 2\|3; 4\|5; 6; 7\|8; 9; 10\]' = $`\begin{bmatrix}
1 & 2 & 0 \\
3 & 4 & 0 \\
5 & 6 & 7 \\
8 & 9 & 10
\end{bmatrix}`$

**diag2vec**(*A*)' = \[1 4 7\]

  **submatrix**(*M*; *i*1; *i*2; *j*1; *j*2)

    *Parameters*: *M* - matrix;  
*i*1 - starting row index;  
*i*2 - ending row index;  
*j*1 - starting column index;  
*j*2 - ending column index.  
    *Return value*: a new matrix containing the submatrix of *M* bounded by rows *i*1 to *i*2 and columns *j*1 to *j*2, inclusive.  
    *Notes*: Starting indexes can be greater than ending indexes.
However, the same part of the matrix is returned.
The result is always a general (rectangular) type of matrix, even if the source matrix is special.  
    *Example*: *A* = \[1;  2;  3;  4\| \_  
5; 6; 7; 8\| \_  
9; 10; 11; 12\| \_  
13; 14; 15; 16\]  
**submatrix**(*A*; 2; 3; 2; 4)' = $`\begin{bmatrix}
6 & 7 & 8 \\
10 & 11 & 12
\end{bmatrix}`$

#### Data functions

Data functions are not related to the structure of matrices but to the values of the elements.
The following functions are available for use:

  **sort_cols**(*M*; *i*)  
  **rsort_cols**(*M*; *i*)

    *Parameters*: *M* - the matrix to be sorted;  
*i* - the index of the row on which the sorting will be based.  
    *Return value*: a new matrix with the columns of *M*, sorted by the values in row *i*.  
    *Notes*: **sort_cols** sorts in ascending order, and **rsort_cols** - in descending order.
The original matrix is not modified.  
    *Example*: *A* = \[5; 2; 3\|4; 9; 1\|6; 8; 7\]' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$  
*B* = **sort_cols**(*A*; 2)' = $`\begin{bmatrix}
3 & 5 & 2 \\
1 & 4 & 9 \\
7 & 6 & 8
\end{bmatrix}`$  
*C* = **rsort_cols**(*A*; 2)' = $`\begin{bmatrix}
2 & 5 & 3 \\
9 & 4 & 1 \\
8 & 6 & 7
\end{bmatrix}`$  
*A*' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$ - the original matrix is unchanged.

  **sort_rows**(*M*; *j*)  
  **rsort_rows**(*M*; *j*)

    *Parameters*: *M* - the matrix to be sorted;  
*j* - the index of the column on which the sorting will be based.  
    *Return value*: A new matrix with the rows of *M*, sorted by values in column *j*.  
    *Notes*: **sort_rows** sorts in ascending order, and **rsort_rows** sorts in descending order.
The original matrix is not modified.  
    *Example*: *A* = \[5; 2; 3\|4; 9; 1\|6; 8; 7\]' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$  
*B* = **sort_rows**(*A*; 2)' = $`\begin{bmatrix}
5 & 2 & 3 \\
6 & 8 & 7 \\
4 & 9 & 1
\end{bmatrix}`$  
*C* = **rsort_rows**(*A*; 2)' = $`\begin{bmatrix}
4 & 9 & 1 \\
6 & 8 & 7 \\
5 & 2 & 3
\end{bmatrix}`$  
*A*' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$- the original matrix is unchanged.

  **order_cols**(*M*; *i*)  
  **revorder_cols**(*M*; *i*)

    *Parameters*: *M* - the matrix to be ordered;  
*i* - the index of the row on which the ordering will be based.  
    *Return value*: a vector containing the indexes of the columns of matrix *M* ordered by the values in row *i*.  
    *Notes*: **order_cols** returns the indexes in ascending order, and **revorder_cols** - in descending order.
The matrix is not modified.
Each index in the output vector *⃗j* shows which column in *M* should be placed at the current position to obtain a sorted sequence in row *i*. You can get the sorted matrix by calling **extract_cols** (*M* ; *⃗j* ).  
    *Example*: *A* = \[5; 2; 3\|4; 9; 1\|6; 8; 7\]' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$  
*b* = **order_cols**(*A*; 2)' = \[3 1 2\]  
*B* = **extract_cols**(*A*; *b*)' = $`\begin{bmatrix}
3 & 5 & 2 \\
1 & 4 & 9 \\
7 & 6 & 8
\end{bmatrix}`$  
*c* = **revorder_cols**(*A*; 2)' = \[2 1 3\]  
*C* = **extract_cols**(*A*; *c*)' = $`\begin{bmatrix}
2 & 5 & 3 \\
9 & 4 & 1 \\
8 & 6 & 7
\end{bmatrix}`$

  **order_rows**(*M*; *j*)  
  **revorder_rows**(*M*; *j*)

    *Parameters*: *M* - the matrix to be ordered;  
*j* - the index of the column on which the ordering will be based.  
    *Return value*: a vector containing the indexes of the rows of matrix *M* ordered by the values in column *j*.  
    *Notes*: **order_rows** returns the indexes in ascending order, and **revorder_rows** - in descending order.
The matrix is not modified.
Each index in the output vector *⃗i* shows which row in *M* should be placed at the current position to obtain a sorted sequence in column *j*. You can get the sorted matrix by calling **extract_rows** (*M* ; *⃗i* ).  
    *Example*: *A* = \[5; 2; 3\|4; 9; 1\|6; 8; 7\]' = $`\begin{bmatrix}
5 & 2 & 3 \\
4 & 9 & 1 \\
6 & 8 & 7
\end{bmatrix}`$  
*b* = **order_rows**(*A*; 2)' = \[1 3 2\]  
*B* = **extract_rows**(*A*; *b*)' = $`\begin{bmatrix}
5 & 2 & 3 \\
6 & 8 & 7 \\
4 & 9 & 1
\end{bmatrix}`$  
*c* = **revorder_rows**(*A*; 2)' = \[2 3 1\]  
*B* = **extract_rows**(*A*; *c*)' = $`\begin{bmatrix}
4 & 9 & 1 \\
6 & 8 & 7 \\
5 & 2 & 3
\end{bmatrix}`$

  **mcount**(*M*; *x*)

    *Parameters*: *M* - matrix;  
*x* - the value to count the occurrences of.  
    *Return value*: the number of occurrences of value *x* in matrix *M*.  
    *Example*: *A* = \[1; 0; 1\|2; 1; 2\|1; 3; 1\]' = $`\begin{bmatrix}
1 & 0 & 1 \\
2 & 1 & 2 \\
1 & 3 & 1
\end{bmatrix}`$  
*n* = **mcount**(*A*; 1)' = 5

  **msearch**(*M*; *x*; *i*; *j*)

    *Parameters*: *M* - matrix;  
*x* - the value to search for;  
*i* - starting row index;  
*j* - starting column index.

    *Return value*: a vector containing the row and column indexes of the first occurrence of *x* in matrix *M* after indexes *i* and *j*, inclusive.  
    *Notes*: The searching is performed row by row, consecutively from left to right.
If nothing is found, \[0 0\] is returned as result.  
    *Example*:   *A* = \[1; 2; 3\|1; 5; 6\|1; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
1 & 5 & 6 \\
1 & 8 & 9
\end{bmatrix}`$  
*b* = **msearch**(*A*; 1; 1; 1)' = \[1 1\]  
*c* = **msearch**(*A*; 1; 2; 2)' = \[3 1\]  
*d* = **msearch**(*A*; 4; 1; 1)' = \[0 0\]

  **mfind**(*M*; *x*)

    *Parameters*: *M* - matrix;  
*x* - the value to search for.  
    *Return value*: a two-row matrix containing the indexes of all elements in matrix *M* that are equal to *x*.  
    *Notes*: The top row in the result contains the row indexes, and the bottom row - the respective column indexes of the elements in *M* equal to *x*. If nothing is found, a 2×1 matrix with zeros is returned.  
    *Example*: *A* = \[1; 2; 3\|4; 1; 6\|1; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 1 & 6 \\
1 & 8 & 9
\end{bmatrix}`$  
*B* = **mfind**(*A*; 1)' = $`\begin{bmatrix}
1 & 2 & 3 \\
1 & 2 & 1
\end{bmatrix}`$  
*C* = **mfind**(*A*; 5)' = $`\begin{bmatrix}
0 \\
0
\end{bmatrix}`$

  **hlookup**(*M*; *x*; *i*1; *i*2)

    *Parameters*: *M* - the matrix in which to perform the lookup;  
*x* - the value to look for;  
*i*1 - the index of the row where to search for value *x*;  
*i*2 - the index of the row from which to return the corresponding values.  
    *Return value*: a vector containing the values from row *i*2 of matrix *M* for which the respective elements in row *i*1 are equal to *x*.  
    *Notes*: The values are collected consequently from left to right.
If nothing is found, an empty vector \[\] is returned.  
    *Example*: *A* = \[0; 1; 0; 1\|1; 2; 3; 4; 5\|6; 7; 8; 9; 10\]' = $`\begin{bmatrix}
0 & 1 & 0 & 1 & 0 \\
1 & 2 & 3 & 4 & 5 \\
6 & 7 & 8 & 9 & 10
\end{bmatrix}`$  
*b* = **hlookup**(*A*; 0; 1; 3)' = \[6 8 10\]  
*c* = **hlookup**(*A*; 2; 1; 3)' = \[\]

  **vlookup**(*M*; *x*; *j*1; *j*2)

    *Parameters*: *M* - the matrix in which to perform the lookup;  
*x* - the value to look for;  
*j*1 - the index of the column where to search for value *x*;  
*j*2 - the index of the column from which to return the values.  
    *Return value*: a vector containing the values from column *j*2 of matrix *M* for which the respective elements in column *j*1 are equal to *x*.  
    *Notes*: The values are collected consequently from top to bottom.
If nothing is found, an empty vector \[\] is returned.  
    *Example*: *A* = \[1; 2\|3; 4; 1\|5; 6\|7; 8; 1\|9; 10\]' = $`\begin{bmatrix}
1 & 2 & 0 \\
3 & 4 & 1 \\
5 & 6 & 0 \\
7 & 8 & 1 \\
9 & 10 & 0
\end{bmatrix}`$  
*b* = **vlookup**(*A*; 0; 3; 1)' = \[1 5 9\]  
*c* = **vlookup**(*A*; 1; 3; 2)' = \[4 8\]  
*d* = **vlookup**(*A*; 2; 3; 1)' = \[\]

The **find**, **hlookup** and **vlookup** functions have variations with suffixes.
Different suffixes refer to different comparison operators.
They replace the equality in the original functions while the rest of the behavior remains unchanged.
The possible suffixes are given in the table below:

|  |  |  |  |  |
|----|----|----|----|----|
| suffix | mfind | hlookup | vlookup | comparison operator |
| \_eq | **mfind_eq**(*M*; *x*) | **hlookup_eq**(*M*; *x*; *i*1; *i*2) | **vlookup_eq**(*M*; *x*; *i*1; *i*2) | = - equal |
| \_ne | **mfind_ne**(*M*; *x*) | **hlookup_ne**(*M*; *x*; *i*1; *i*2) | **vlookup_ne**(*M*; *x*; *i*1; *i*2) | ≠ - not equal |
| \_lt | **mfind_lt**(*M*; *x*) | **hlookup_lt**(*M*; *x*; *i*1; *i*2) | **vlookup_lt**(*M*; *x*; *i*1; *i*2) | \< - less than |
| \_le | **mfind_le**(*M*; *x*) | **hlookup_le**(*M*; *x*; *i*1; *i*2) | **vlookup_le**(*M*; *x*; *i*1; *i*2) | ≤ - less than or equal |
| \_gt | **mfind_gt**(*M*; *x*) | **hlookup_gt**(*M*; *x*; *i*1; *i*2) | **vlookup_gt**(*M*; *x*; *i*1; *i*2) | \> - greater than |
| \_ge | **mfind_ge**(*M*; *x*) | **hlookup_ge**(*M*; *x*; *i*1; *i*2) | **vlookup_ge**(*M*; *x*; *i*1; *i*2) | ≥ - greater than or equal |

#### Math functions

All standard scalar math functions accept matrix arguments as well.
The function is applied separately to all the elements in the input matrix, even if it is of a special type.
The results are returned in a corresponding output matrix.
It is always a general (rectangular) type, so the structure is not preserved.
For example:

  #rad  
  *M* = **diagonal**(3; *π*/2)' = $`\begin{bmatrix}
1.571 & 0 & 0 \\
0 & 1.571 & 0 \\
0 & 0 & 1.571
\end{bmatrix}`$  
  **cos**(*M*)' = $`\begin{bmatrix}
0 & 1 & 1 \\
1 & 0 & 1 \\
1 & 1 & 0
\end{bmatrix}`$

Calcpad also includes a lot of math functions that are specific for matrices, as follows:

  **hprod**(*A*; *B*)

    *Parameters*: *A* - first matrix;  
*B* - second matrix.  
    *Return value*: (matrix) the Hadamard product of matrices *A* and *B*.  
    *Notes*: Both matrices must be of the same size.
The Hadamard (a.k.a. Schur) product *C* = *A*⊙*B* is an element-wise product of two matrices.
The elements of the resulting matrix are obtained by the following equation:  
*C*ij = *A*ij *B*ij.
If both matrices are of equal type, the type is preserved in the output, otherwise, the returned matrix if of general type.  
    *Example*: *A* = \[1; 2\|3; 4\|5; 6\]' = $`\begin{bmatrix}
1 & 2 \\
3 & 4 \\
5 & 6
\end{bmatrix}`$  
*B* = \[9; 8\|7; 6\|5; 4\]' = $`\begin{bmatrix}
9 & 8 \\
7 & 6 \\
5 & 4
\end{bmatrix}`$  
*C* = **hprod**(*A*; *B*)' = $`\begin{bmatrix}
9 & 16 \\
21 & 24 \\
25 & 24
\end{bmatrix}`$

  **fprod**(*A*; *B*)

    *Parameters*: *A* - first matrix;  
*B* - second matrix.  
    *Return value*: (scalar) the Frobenius product of matrices *A* and *B*.  
    *Notes*: Both matrices must be of the same size.
The result is obtained by summing the products of the corresponding element pairs of the input matrices:

> 
> ``` math
> p = \sum_{i = 1}^{m}{\sum_{j = 1}^{n}{A_{ij}B_{ij}}}
> ```

    *Example*: *A* = \[1; 2\|3; 4\|5; 6\]' = $`\begin{bmatrix}
1 & 2 \\
3 & 4 \\
5 & 6
\end{bmatrix}`$  
*B* = \[9; 8\|7; 6\|5; 4\]' = $`\begin{bmatrix}
9 & 8 \\
7 & 6 \\
5 & 4
\end{bmatrix}`$  
*C* = **fprod**(*A*; *B*)' = 119

**kprod**(*A*; *B*)

    *Parameters*: *A* - first matrix;  
*B* - second matrix.  
    *Return value*: (matrix) the Kronecker product of matrices *A* and *B*.  
    *Notes*: If *A* is m×n and *B* is p×q matrix, the result is a mp×nq block matrix *C*, where each block is obtained by the equation: \[*C* \]ij = *A*ij *B*.  
    *Example*: *A* = \[1; 2\|3; 4\]' = $`\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}`$  
*B* = \[5; 6; 7\|8; 9; 10\]' = $`\begin{bmatrix}
5 & 6 & 7 \\
8 & 9 & 10
\end{bmatrix}`$  
*C* = **kprod**(*A*; *B*)' = $`\begin{bmatrix}
5 & 6 & 7 & 10 & 12 & 14 \\
8 & 9 & 10 & 16 & 18 & 20 \\
15 & 18 & 21 & 20 & 24 & 28 \\
24 & 27 & 30 & 32 & 36 & 40
\end{bmatrix}`$

  **mnorm_1**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: scalar representing the L1 (Manhattan, a.k.a. taxicab) norm of matrix *M*.  
    *Notes*: It is obtained as the maximum of all L1 column vector norms by the equation:

> 
> ``` math
> \left\| M \right\|_{1} = \max_{1 \leq j \leq n}\sum_{i = 1}^{m}\left| M_{ij} \right|
> ```

    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**mnorm_1**(*A*)' = 18

  **mnorm**(*M*) or **mnorm_2**(*M*)

    *Parameters*: *M* - an m×n matrix where m ≥ n.  
    *Return value*: scalar representing the L2 (spectral) norm of matrix *M*.  
    *Notes*: It is obtained as the maximum singular value of matrix *M*:  
\|\| *M* \|\| 2 = *σ*max (*M*).  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**mnorm_2**(*A*)' = 16.8481

  **mnorm_e**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: scalar representing the Frobenius (Euclidean) norm of matrix *M*.  
    *Notes*: It is similar to vector Euclidian norm, assuming that the matrix is linearized by row concatenation.
It calculated as the square root of sum of the squares of all elements, as follows:  
``` math
\left\| M \right\|_{e} = \sqrt{\sum_{i = 1}^{m}{\sum_{j = 1}^{n}M_{ij}^{2}}}
```

    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**mnorm_e**(*A*)' = 16.8819

  **mnorm_i**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: scalar representing the L∞ (infinity) norm of matrix *M*.  
    *Notes*: It is evaluated as the maximum of all L1 row vector norms by the equation:

> 
> ``` math
> \left\| M \right\|_{\infty} = \max_{1 \leq i \leq m}\sum_{j = 1}^{n}\left| M_{ij} \right|
> ```

    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**mnorm_i**(*A*)' = 24

  **cond_1**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (scalar) the condition number of *M* based on the L1 norm.  
    *Notes*: It is calculated by the equation: *κ*1(*M*) = \|\| *M* \|\| 1 · \|\| *M* -1 \|\| 1  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**cond_1**(*A*)' = 6.4852×1017

  **cond**(*M*) or **cond_2**(*M*)

    *Parameters*: *M* - an m×n matrix where m ≥ n.  
    *Return value*: (scalar) the condition number of *M* based on the L2 norm.  
    *Notes*: The condition number shows how sensitive is the matrix *A* for solving the

equation *A* $\vec{x}$ = $\vec{b}$ or inverting the matrix.
The higher is the number, the lower is the accuracy of the obtained solution.
In theory, singular matrices have infinite condition numbers.
However, in floating point environment, one can obtain very large, but finite number, due to floating point errors.
The condition number is calculated by the following expression:  
*κ*2(*M*) = *σ*max (*M*) / *σ*min (*M*)  
Since this is computationally expensive, the other functions can be used instead, providing similar values but at lower computational cost.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**cond_2**(*A*)' = 1.7159×1017

  **cond_e**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (scalar) the condition number of *M* based on the Frobenius norm.  
    *Notes*: It is calculated by the expression:  
*κ*e(*M*) = \|\| *M* \|\| e· \|\| *M* -1 \|\| e  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**cond_e**(*A*)' = 4.5618×1017

  **cond_i**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (scalar) the condition number of *M* based on the L∞ norm.  
    *Notes*: It is obtained by the equation:  
*κ*∞(*M* ) = \|\| *M* \|\| ∞· \|\| *M* -1 \|\| ∞  
    *Example*:   *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**cond_i**(*A*)' = 8.6469×1017

  **det**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (scalar) the determinant of matrix *M*.  
    *Notes*: To evaluate the result, the matrix is first decomposed to lower triangular (L) and upper triangular (U) matrices by LU factorization.
Then, the determinant is obtained as the product of the elements along the main diagonal of the U matrix.
Theoretically, for singular matrices, the determinant should be exactly zero.
However, it is not recommended to use this criterion in practice.
Due to floating point round-off errors, it can return a "small" but non-zero value.
It is better to use rank or condition number instead.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**det**(*A*)' = 6.6613×10-16

  **rank**(*M*)

    *Parameters*: *M* - an m×n matrix where m ≥ n.  
    *Return value*: (scalar) the rank of matrix *M*.  
    *Notes*: Rank represents the number of linearly independent rows in a matrix.
It is evaluated by performing an SVD decomposition of the matrix and counting the non-zero singular values.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**rank**(*A*)' = 2

  **trace**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (scalar) the trace of matrix *M*.  
    *Notes*: Trace is defined as the sum of the elements along the main diagonal of a square matrix.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**trace**(*A*)' = 15

  **transp**(*M*)

    *Parameters*: *M* - matrix.  
    *Return value*: (matrix) the transpose of *M*.  
    *Notes*: The transpose is obtained by swapping the rows and the columns of the matrix.
If *M* is symmetric, the transpose is equal to the matrix itself, so just a copy of *M* is returned.  
    *Example*: *A* = \[1; 2; 3\|4; 5; 6\|7; 8; 9\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}`$  
**transp**(*A*)' = $`\begin{bmatrix}
1 & 4 & 7 \\
2 & 5 & 8 \\
3 & 6 & 9
\end{bmatrix}`$

  **adj**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: the adjugate of matrix *M*.  
    *Notes*: The adjugate of a square matrix is the transpose of the cofactor matrix.
It is obtained by multiplying the inverse of *M* by the determinant of *M*:   
**adj**(*M* ) = *M* <sup>-1</sup> · \|*M* \|. However, this is not applicable when the matrix is singular.
In this case, if the size of the matrix is n ≤ 10, Laplace expansion is used: *A*<sub>ij</sub> = *C*<sub>ji</sub> = *M*<sub>ji</sub> · (-1)<sup> *i* + *j*</sup>. For n \> 10, it is reported that the matrix is singular instead, because Laplace expansion has a complexity of O(n!) and would take unreasonably long.

    *Example*:   *A* = \[1; 2\|3; 4\]' = $`\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}`$  
**adj**(*A*)' = $`\begin{bmatrix}
 -4 & 2 \\
3 & -1
\end{bmatrix}`$  
**det**(*A*)' = 2  
**inverse**(*A*)' = $`\begin{bmatrix}
 -2 & 1 \\
1.5 & -0.5
\end{bmatrix}`$

  **cofactor**(*A*)

    *Parameters*: *A* - square matrix.  
    *Return value*: the cofactor matrix of *A*.  
    *Notes*: The cofactor *C*ij is defined as the respective minor *M*ij is multiplied by  
(-1) *i* + *j*. The minor *M*ij represents the determinant of the submatrix, obtained by removing the *i*-th row and the *j*-th column.
In Calcpad, the cofactor matrix is calculated by transposing the adjugate: *C* = **adj**(*A* )T  
    *Example*:   **cofactor**(\[1; 2\|3; 4\])' = $`\begin{bmatrix}
 -4 & \ \ \ 3 \\
\ \ \ \ 2 & -1
\end{bmatrix}`$

  **eigenvals**(*M*; *n*<sub>e</sub>)

    *Parameters*: *M* - symmetric matrix;  
*n*<sub>e</sub> – the number of eigenvalues to extract (optional).  
    *Return value*: a vector containing the *n*<sub>e</sub> lowest (or largest) eigenvalues of matrix *M*.  
    *Notes*: If *n*<sub>e</sub> \> 0 the first *n*<sub>e</sub> lowest eigenvalues are returned in ascending order.  
If *n*<sub>e</sub> \< 0 the first *n*<sub>e</sub> largest eigenvalues are returned in descending order.  
If *n*<sub>e</sub> = 0 or omitted, all eigenvalues are returned in ascending order.  
If *M* is a high-performance symmetric matrix and the number of rows  
is \> 200 calculations are performed by using iterative symmetric Lanczos solver.
Otherwise, direct symmetric QL algorithm with implicit shifts is used.  
    *Example*: *A* = **copy**( \_  
\[4; 12; -16\| \_  
    12; 37; -43\| \_  
   -16; -43; 98\]; \_  
    **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
**eigenvals**(*A*)' = \[0.0188 15.5 123.48\]

  **eigenvecs**(*M*; *n*<sub>e</sub>)

    *Parameters*: *M* - symmetric matrix;  
*n*<sub>e</sub> – the number of eigenvectors to extract (optional).  
    *Return value*: a *n*<sub>e</sub>×*n* matrix which rows represent the eigenvectors of *M*.  
    *Notes*: The same rules as for **eigenvals**(*M*; *n*<sub>e</sub>) apply.  
    *Example*: *A* = **copy**( \_  
    \[4; 12; -16\| \_  
    12; 37; -43\| \_  
   -16; -43; 98\]; \_  
    **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
**eigenvecs**(*A*)' = $`\begin{bmatrix}
0.9634 & -0.2648 & 0.0411 \\
 -0.2127 & -0.849 & -0.4838 \\
 -0.163 & -0.4573 & 0.8742
\end{bmatrix}`$

  **eigen**(*M*; *n*<sub>e</sub>)

    *Parameters*: *M* - symmetric matrix;  
*n*<sub>e</sub> – the number of eigenvalues/vectors to extract (optional).  
    *Return value*: a *n*<sub>e</sub>×(*n* + 1) matrix were each row contains one eigenvalue, followed by the elements of the respective eigenvector of matrix *M*.  
    *Notes*: In case both are needed, this function is more efficient than calling **eigenvals**(*M*; *n*<sub>e</sub>) and **eigenvecs**(*M*; *n*<sub>e</sub>) separately.
The same rules as for **eigenvals**(*M*; *n*<sub>e</sub>) apply.

    *Example*: *A* = **copy**( \_  
    \[4; 12; -16\| \_  
    12; 37; -43\| \_  
   -16; -43; 98\]; \_  
    **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
**eigen**(*A*)' = $`\begin{bmatrix}
0.0188 & 0.9634 & -0.2648 & 0.0411 \\
15.504 & -0.2127 & -0.849 & -0.4838 \\
123.477 & -0.163 & -0.4573 & 0.8742
\end{bmatrix}`$

  **cholesky**(*M*)

    *Parameters*: *M* - symmetric, positive-definite matrix.  
    *Return value*: (upper triangular matrix) the Cholesky decomposition of *M*.  
    *Notes*: This kind of decomposition turns the matrix into a product of two triangular matrices: *M* = *L*·*L* T. The current function returns only the upper part - *L* T. Cholesky decomposition is faster and more stable than the respective LU decomposition of the same matrix.  
    *Example*: *A* = **copy**( \_  
    \[4; 12; -16\| \_  
    12; 37; -43\| \_  
   -16; -43; 98\]; \_  
    **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
*LT* = **cholesky**(*A*)' = $`\begin{bmatrix}
2 & 6 & -8 \\
0 & 1 & 5 \\
0 & 0 & 3
\end{bmatrix}`$ - the upper triangular matrix *L*T  
*L* = **transp**(*LT*)' = $`\begin{bmatrix}
2 & 0 & 0 \\
6 & 1 & 0 \\
 -8 & 5 & 3
\end{bmatrix}`$ - the lower triangular matrix *L*  
*L*\**LT*' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$ - check

  **lu**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (matrix) the LU decomposition of *M*.  
    *Notes*: The LU decomposition factors the matrix as a product of two matrices: lower triangular *L* and upper triangular *U* (*M* = *L*·*U* ). It does not require the matrix to be symmetric.
Since LU decomposition is not unique, there is an infinite number of solutions.
Here it is assumed that all elements along the main diagonal of *L* are equal to one.
The function returns both matrices *L* and *U*, packed in a single square matrix.
The elements along the main diagonal belong to *U*, since it is known that those of *L* are ones.
The solution is performed by using the Crout's algorithm with partial pivoting.
Instead of building the permutation matrix *P*, Calcpad internally creates a vector ⃗*ind* containing the indexes of the rows after reordering.  
If you need both matrices *L* and *U* separately, you can extract them as a Hadamard product of the combined matrix by the respective lower/upper triangular matrix.
After that, you have to reset the diagonal of *L* to ones.  
If the type of *M* is symmetric matrix, the LDLT decomposition is returned instead of LU.
It is similar to Cholesky decomposition but avoids taking square roots of diagonal elements.
For that reason, the matrix is not required to be positive-definite.
However, it makes it necessary to store the diagonal elements in a separate diagonal matrix *D*. Therefore, matrix *M* is represented as a product of three matrices:  
*M* = *L*·*D*·*L*T. They are also packed in a single square matrix.  
    *Example*: *A* = \[4; 12; -16\|12; 37; -43\|-16; -43; 98\]' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
*LU* = **lu**(*A*)' = $`\begin{bmatrix}
12 & 37 & -43 \\
 -1.333 & 6.333 & 40.667 \\
0.3333 & -0.05263 & 0.4737
\end{bmatrix}`$ - the combined matrix  
*ind*' = \[2 3 1\]  
*D* = **not**(**identity**(3))' = $`\begin{bmatrix}
0 & 1 & 1 \\
1 & 0 & 1 \\
1 & 1 & 0
\end{bmatrix}`$- the index permutation vector  
*L* = **hprod**(**mfill**(**ltriang**(3); 1); *LU*)^*D*' =  
$`\begin{bmatrix}
1 & 0 & 0 \\
 -1.333 & 1 & 0 \\
0.3333 & -0.05263 & 1
\end{bmatrix}`$ - extracts the lower triangular matrix  
*U* = **hprod**(**mfill**(**utriang**(3); 1); *LU*)' =  
$`\begin{bmatrix}
12 & 37 & -43 \\
0 & 6.333 & 40.667 \\
0 & 0 & 0.4737
\end{bmatrix}`$ - extracts the upper triangular matrix  
**extract_rows**(*L*\**U*; **order**(*ind*))' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$- check

  **qr**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: (matrix) the QR decomposition of matrix *M*.  
    *Notes*: As the name implies, the matrix is factored as a product (*M* = *Q*·*R* ) of an orthonormal matrix *Q* and upper triangular matrix *R*. The Householder's method is used for that purpose.
The algorithm is stable and does not need pivoting.
Both matrices are packed in a single n×2n block rectangular matrix \[Q,R\] and returned as a result.
You can each of the two matrices using the **submatrix** function.  
    *Example*: *A* = \[4; 12; -16\|12; 37; -43\|-16; -43; 98\]' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
*QR* = **qr**(*A*)' =  
$`\begin{bmatrix}
 -0.1961 & -0.1695 & 0.9658 & -20.396 & -57.854 & 105.314 \\
 -0.5884 & -0.7676 & -0.2542 & 0 & -3.858 & -24.853 \\
0.7845 & -0.6181 & 0.05083 & 0 & 0 & 0.4575
\end{bmatrix}`$ - the combined QR matrix  
*Q* = **submatrix**(*QR*; 1; 3; 1; 3)' =  
$`\begin{bmatrix}
 -0.1961 & -0.1695 & 0.9658 \\
 -0.5884 & -0.7676 & -0.2542 \\
0.7845 & -0.6181 & 0.05083
\end{bmatrix}`$ - extracts the Q matrix  
*R* = **submatrix**(*QR*; 1; 3; 4; 6)' =  
$`\begin{bmatrix}
 -20.396 & -57.854 & 105.314 \\
0 & -3.858 & -24.853 \\
0 & 0 & 0.4575
\end{bmatrix}`$ - extracts the R matrix  
*Q*\**R*' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$- check

  **svd**(*M*)

    *Parameters*: *M* - an m×n matrix, where m ≥ n.  
    *Return value*: the singular value decomposition (SVD) of matrix *M*.  
    *Notes*: The matrix is factored as a product of three matrices: *M* = *U*·*Σ*·*V* T, where *Σ* is a diagonal matrix containing the singular values of *M*, and *U* and *V* T are orthonormal matrices which columns represent the left and right singular vectors, respectively.
The result is returned as a single m×(2n + 1) matrix \[U, Σ, V\], where Σ is a single column containing all singular values.
They are sorted in descending order and the singular vectors are reordered respectively to match the corresponding singular values.
Note that the returned *V* T matrix is already transposed, so you do not have to do it again.  
Occasionally, some singular vectors may flip signs so that *U*·*Σ*·*V* T will not give *M* after multiplying the obtained matrices.
Sign ambiguity is a well- known and common problem of most SVD algorithms.
For symmetric matrices the singular values are equal to the absolute eigenvalues: *σ*i = \| *λ*i \|.  
    *Example*: *A* = \[4; 12; -16\|12; 37; -43\|-16; -43; 98\]' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
*SVD* = **svd**(*A*)' =  
$`\begin{bmatrix}
 -0.163 & 0.2127 & -0.9634 & 123.477 & -0.163 & -0.4573 & 0.8742 \\
 -0.4573 & 0.849 & 0.2648 & 15.504 & 0.2127 & 0.849 & 0.4838 \\
0.8742 & 0.4838 & -0.0411 & 0.0188 & -0.9634 & 0.2648 & -0.0411
\end{bmatrix}`$ - the combined matrix  
*U* = **submatrix**(*SVD*; 1; 3; 1; 3)' =  
$`\begin{bmatrix}
 -0.163 & 0.2127 & -0.9634 \\
 -0.4573 & 0.849 & 0.2648 \\
0.8742 & 0.4838 & -0.0411
\end{bmatrix}`$ - extracts the U matrix  
*V* = **submatrix**(*SVD*; 1; 3; 5; 7)' =  
$`\begin{bmatrix}
 -0.163 & -0.4573 & 0.8742 \\
0.2127 & 0.849 & 0.4838 \\
 -0.9634 & 0.26483 & -0.0411
\end{bmatrix}`$ - extracts the V matrix  
*σ* = **col**(*SVD*; 4)' = \[123.477  15.504  0.0188\] - extract singular values  
*Σ* = **vec2diag**(*σ*)' =  
$`\begin{bmatrix}
123.477 & 0 & 0 \\
0 & 15.504 & 0 \\
0 & 0 & 0.0188
\end{bmatrix}`$ - composes the singular value matrix

  **inverse**(*M*)

    *Parameters*: *M* - square matrix.  
    *Return value*: the inverse of matrix *M*.  
    *Notes*: The inverse is obtained by LU decomposition for non-symmetric matrices and LDLT decomposition for symmetric ones.
If the matrix is singular, the inverse does not exist.
If it is ill conditioned, the result will be distorted by large errors.
This is detected during the LU decomposition by watching for a zero or tiny pivot element.
If one is detected, an appropriate error message is returned, instead of erroneous solution.  
    *Example*: *A* = \[4; 12; -16\|12; 37; -43\|-16; -43; 98\]' = $`\begin{bmatrix}
4 & 12 & -16 \\
12 & 37 & -43 \\
 -16 & -43 & 98
\end{bmatrix}`$  
*B* = **inverse**(*A*)' =$`\begin{bmatrix}
49.361 & -13.556 & 2.111 \\
 -13.556 & 3.778 & -0.556 \\
2.111 & -0.556 & 0.111
\end{bmatrix}`$

*A*\**B*' = $`\begin{bmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 1
\end{bmatrix}`$ - check

  **lsolve**(*A*; $\vec{b}$)

    *Parameters*: *A* - a square matrix with the equation coefficients;

$\vec{b}$ - the right-hand side vector.  
    *Return value*: the solution vector $\vec{x}$ of the system of linear equations *A* $\vec{x}$ = $\vec{b}$.

    *Notes*: Calculations are performed by using LU decomposition for non-symmetric matrices and LDLT for symmetric.
That is why the matrix is not required to be positive-definite.
If *A* is singular or ill-conditioned, an error message is returned.  
    *Example*: *A* = \[8; 6; -4\|6; 12; -3\|-4; -3; 9\]' = $`\begin{bmatrix}
8 & 6 & -4 \\
6 & 12 & -3 \\
 -4 & -3 & 9
\end{bmatrix}`$  
*b* = \[10; 20; 30\]' = \[10 20 30\]  
*x* = **lsolve**(*A*; *b*)' = \[2.5 1.667 5\] - the solution vector  
*A*\**x*' = \[10 20 30\] – check

  **clsolve**(*A*; $\vec{b}$)

    *Parameters*: *A* - symmetric, positive-definite coefficient matrix;  
*b* - the right-hand side vector.  
    *Return value*: the solution vector $\vec{x}$ of the system of linear equations *A* $\vec{x}$ = $\vec{b}$ using Cholesky decomposition.  
    *Notes*: Cholesky decomposition is faster than LU and LDLT, so this function should be preferred over **lsolve** whenever the matrix is symmetric and positive- definite.  
    *Example*: *A* = **copy**(\[8; 6; -4\|6; 12; -3\|-4; -3; 9\]; \_  
    **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
8 & 6 & -4 \\
6 & 12 & -3 \\
 -4 & -3 & 9
\end{bmatrix}`$  
*b* = \[10; 20; 30\]' = \[10 20 30\]  
*x* = **clsolve**(*A*; *b*)' = \[2.5 1.667 5\] - the solution vector  
*A*\**x*' = \[10 20 30\] – check

  **slsolve**(*A*; $\vec{b}$)

    *Parameters*: *A* - high-performance symmetric, positive-definite coefficient matrix;  
*b* - high-performance the right-hand side vector.  
    *Return value*: the solution vector $\vec{x}$ of the system of linear equations *A* $\vec{x}$ = $\vec{b}$ using preconditioned conjugate gradient (PCG) method.  
    *Notes*: The PCG method is iterative and is faster than the direct Cholesky decomposition method.
Whenever you have larger systems with tens to hundreds of thousands equations it is recommended to use the **slsolve** function with high performance matrices and vectors.  
    *Example*: *A* = **copy**(\[8; 6; -4\|6; 12; -3\|-4; -3; 9\]; \_  
    **symmetric_hp**(3); 1; 1)' = $`\begin{bmatrix}
8 & 6 & -4 \\
6 & 12 & -3 \\
 -4 & -3 & 9
\end{bmatrix}`$  
*b* = **hp**(\[10; 20; 30\])' = \[10 20 30\]  
*x* = **slsolve**(*A*; *b*)' = \[2.5 1.667 5\] - the solution vector  
*A*\**x*' = \[10 20 30\] - check

  **msolve**(*A*; *B*)

    *Parameters*: *A* - a square matrix with the equation coefficients;  
*B* - the right-hand side matrix.

> *Return value*: the solution matrix *X* of the generalized matrix equation *AX* = *B*.
>
> *Notes*: Similar to **lsolve**, except that matrix *B* columns contain multiple right-hand side vectors and matrix *X* columns represent the respective solution vectors.
In this way, the function can solve multiple systems of linear equations in parallel.
The LU/LDLT decomposition of *A* is performed only once in the beginning and the result is reused for backsubstitution multiple times.
>
> *Example*: *A* = \[8; 6; -4\|6; 12; -3\|-4; -3; 9\]' = $`\begin{bmatrix}
> 8 & 6 & -4 \\
> 6 & 12 & -3 \\
>  - 4 & -3 & 9
> \end{bmatrix}`$  
> *B* = **join**<sub>cols</sub>(\[10; 20; 30\]; \[40; 50; 60\])' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}`$  
> *X* = **msolve**(*A*; *B*)' = $`\begin{bmatrix}
> 2.5 & 8.71 \\
> 1.67 & 2.67 \\
> 5 & 11.43
> \end{bmatrix}`$- the solution vector  
> *A*\**X* ' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}`$- check

  **cmsolve**(*A*; *B*)

> *Parameters*: *A* - symmetric, positive-definite coefficient matrix;  
> *B* - the right-hand side matrix.
>
> *Return value*: the solution matrix *X* of the generalized matrix equation *AX* = *B* using Cholesky decomposition.
>
> *Notes*: Similar to **clsolve**, having that *B* matrix columns contain multiple right-hand side vectors and *X* matrix columns represent the respective solution vectors.
In this way, the function can solve multiple systems of linear equations in parallel.
The Cholesky decomposition of *A* is performed only once in the beginning and the result is reused for backsubstitution multiple times.
>
> *Example*: *A* = **copy**(\[8; 6; -4\|6; 12; -3\|-4; -3; 9\]; \_  
>     **symmetric**(3); 1; 1)' = $`\begin{bmatrix}
> 8 & 6 & -4 \\
> 6 & 12 & -3 \\
>  - 4 & -3 & 9
> \end{bmatrix}`$  
> *B* = **join**<sub>cols</sub>(\[10; 20; 30\]; \[40; 50; 60\])' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}`$  
> *X* = **cmsolve**(*A*; *B*)' = $`\begin{bmatrix}
> 2.5 & 8.71 \\
> 1.67 & 2.67 \\
> 5 & 11.43
> \end{bmatrix}`$ - the solution vector  
> *A*\**X* ' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}\ `$ - check

**smsolve**(*A*; *B*)

> *Parameters*: *A* - high-performance symmetric, positive-definite coefficient matrix;  
> *B* - high-performance right-hand side matrix.
>
> *Return value*: the solution matrix *X* of the generalized matrix equation *AX* = *B* using preconditioned conjugate gradient (PCG) method.
>
> *Notes*: Similar to **slsolve**, having that *B* matrix columns contain multiple right-hand side vectors and *X* matrix columns represent the respective solution vectors.
>
> *Example*: *A* = **copy**(\[8; 6; -4\|6; 12; -3\|-4; -3; 9\]; \_  
>     **symmetric_hp**(3); 1; 1)' = $`\begin{bmatrix}
> 8 & 6 & -4 \\
> 6 & 12 & -3 \\
>  - 4 & -3 & 9
> \end{bmatrix}`$  
> *B* = **hp**(**join**<sub>cols</sub>(\[10; 20; 30\]; \[40; 50; 60\]))' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}`$  
> *X* = **smsolve**(*A*; *B*)' = $`\begin{bmatrix}
> 2.5 & 8.71 \\
> 1.67 & 2.67 \\
> 5 & 11.43
> \end{bmatrix}`$ - the solution vector  
> *A*\**X* ' = $`\begin{bmatrix}
> 10 & 40 \\
> 20 & 50 \\
> 30 & 60
> \end{bmatrix}\ `$ - check

  **fft**(*M*)

> *Parameters*: *M* - an hp matrix containing the input signal in time domain.
It must have one row for real only values or two rows for complex values.
The first row must contain the real part and the second row - the corresponding imaginary part.
>
> *Return value*: the fast Fourier transform of the input signal stored in *M*. Similar to the input, the real part of the output is stored in the first row and the imaginary part - in the second row.
>
> *Notes*: The fast Fourier transform is performed by using the classic Cooley-Turkey algorithm.
>
> *Example*: *A* = \[1; 2; 3; 4\|0\]' = $`\begin{bmatrix}
> 1 & 2 & 3 & 4 \\
> 0 & 0 & 0 & 0
> \end{bmatrix}`$  
> *B* = **fft**(*A*)' = $`\begin{bmatrix}
> 10 & -2 & -2 & -2 \\
> 0 & -2 & 0 & 2
> \end{bmatrix}`$

  **ift**(*M*)

> *Parameters*: *M* - an hp matrix containing the input signal in frequency domain.
It must have one row for real only values or two rows for complex values.
The first row must contain the real part and the second row - the corresponding imaginary part.
>
> *Return value*: the inverse Fourier transform of the input signal stored in *M* from frequency domain to time domain.
Similar to the input, the real part of the output is stored in the first row and the imaginary part - in the second row.
>
> *Notes*: The inverse Fourier transform is performed by using the classic Cooley-Turkey algorithm.
>
> *Example*: *A* = \[1; 2; 3; 4\|0\]' = $`\begin{bmatrix}
> 10 & -2 & -2 & -2 \\
> 0 & -2 & 0 & 2
> \end{bmatrix}`$  
> *B* = **ift**(*A*)' = $`\begin{bmatrix}
> 1 & 2 & 3 & 4 \\
> 0 & 0 & 0 & 0
> \end{bmatrix}`$

#### Aggregate and interpolation functions

All aggregate functions can work with matrices.
Since they are multivariate, each of them can accept a single matrix, but also a list of scalars, vectors and matrices, mixed in arbitrary order.
For example:

  *A* = \[0; 2\| 4; 8\]  
  *b* = \[5; 3; 1\]  
  **sum**(10; *A*; *b*; 11)' = 44

Interpolation functions behave similarly, when invoked with a mixed list of arguments.
In this case matrices are linearized by rows into the common array of scalars at the respective places.
Then the interpolation is executed over the entire array.
However, there is also a "matrix" version of these functions, that can perform double interpolation over a single matrix.
In this case you must specify exactly three arguments: the first two must be scalars (the interpolation variables) and the third one must be a matrix, as follows:

  **take**(*x*; *y*; *M*)

    *Parameters*: *x* - row index;  
*y* - column index;  
*M* - matrix.  
    *Return value*: (scalar) the element of matrix *M* at indexes *x* and *y*.  
    *Notes*: If *x* and *y* are not integer, they are rounded to the nearest integer.  
    *Example*: *A* = \[1; 2; 5\|3; 6; 15\|5; 10; 25\]' = $`\begin{bmatrix}
1 & 2 & 5 \\
3 & 6 & 15 \\
5 & 10 & 25
\end{bmatrix}`$  
**take**(2; 3; *A*)' = 15

  **line**(*x*; *y*; *M*)

    *Parameters*: *x* - interpolation variable across rows;  
*y* - interpolation variable across columns;  
*M* - matrix.  
    *Return value*: (scalar) the value obtained by double linear interpolation from the elements of matrix *M* based on the values *x* and *y*.  
    *Example*: *A* = \[1; 2; 5\|3; 6; 15\|5; 10; 25\]' = $`\begin{bmatrix}
1 & 2 & 5 \\
3 & 6 & 15 \\
5 & 10 & 25
\end{bmatrix}`$  
**line**(1.5; 2.5; *A*)' = 7

  **spline**(*x*; *y*; *M*)

    *Parameters*: *x* - interpolation variable across rows;  
*y* - interpolation variable across columns;  
*M* - matrix.  
    *Return value*: (scalar) the value obtained by double Hermite spline interpolation from the elements of matrix *M* based on the values *x* and *y*.  
    *Example*: *A* = \[1; 2; 5\|3; 6; 15\|5; 10; 25\]' = $`\begin{bmatrix}
1 & 2 & 5 \\
3 & 6 & 15 \\
5 & 10 & 25
\end{bmatrix}`$  
**spline**(1.5; 2.5; *A*)' = 6.625

You can use interpolation functions to plot matrix data, as in the example below:

  \$Map{**spline**(*x*; *y*; *A*) @ *x* = 1 : **n_rows**(*A*) & *y* = 1 : **n_cols**(*A*)}

A full list of the available aggregate and interpolation functions is provided earlier in this manual (see "Expressions/Functions" above).

#### Operators

All operators can be used with matrix operands.
Both matrices must be of the same sizes.
Operations are performed element-by-element, and the results are returned in an output matrix.
For example:

  *A* = \[0; 1; 2\|3; 4; 5\]' = $`\begin{bmatrix}
0 & 1 & 2 \\
3 & 4 & 5
\end{bmatrix}`$  
  *B* = \[11; 10; 9\|8; 7; 6\]' = $`\begin{bmatrix}
11 & 10 & 9 \\
8 & 7 & 6
\end{bmatrix}`$  
  *A* + *B*' = $`\begin{bmatrix}
11 & 11 & 11 \\
11 & 11 & 11
\end{bmatrix}`$

The only exception is multiplication operator "\*" which represents the standard matrix multiplication.
The elementwise (Hadamard or Schur) product is implemented in Calcpad as a function: **hprod**. Matrix multiplication *C*m×p = *A*m×n *B*n×p is defined so that each element *c*i j is obtained as the dot product of the *i*-th row of *A* and the *j*-th column of *B*:

``` math
c_{ij} = \sum_{k = 1}^{n}{a_{ik}b_{kj}}
```

For example:

  *A* = \[1; 2; 3\|4; 5; 6\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6
\end{bmatrix}`$  
  *B* = \[6; 5\|4; 3\|2; 1\]' = $`\begin{bmatrix}
6 & 5 \\
4 & 3 \\
2 & 1
\end{bmatrix}`$  
  *C* = *A*\**B*' = $`\begin{bmatrix}
20 & 14 \\
56 & 41
\end{bmatrix}`$

All binary operators are supported for mixed matrix-vector and vector-matrix operands.
In this case, the vector is treated as column matrix.
For example:

  *A* = \[1; 2; 3\|4; 5; 6\]' = $`\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6
\end{bmatrix}`$  
  *b* = \[6; 5; 4\]  
  *A*\**b*' = \[28 73\]

Matrix-scalar and scalar-matrix operators are also implemented in an element-wise manner.
The operation with the provided scalar is performed for each element and the result is returned as matrix.
For example:

  \[1; 2\|3; 4\]\*5' = $`\begin{bmatrix}
5 & 10 \\
15 & 20
\end{bmatrix}`$

### High performance vectors and matrices

High performance (hp) vectors and matrices were introduced in Calcpad version 7.3.0 with the purpose of solving larger engineering problems faster and with less memory consumption.
But this comes with a trade-off: all elements of an hp vector or matrix must have the same units.
This allows Calcpad to store and process the units only once for the whole vector/matrix and perform a lot of additional optimizations like SIMD vectorization of operations, application of more cache-friendly algorithms, etc.
All this results in dozens of times improvement in speed and reduces the required memory size more than twice, even if there are no units at all.

Hp vectors and matrices are initially created by special functions, similar to standard creational functions, but ending with “\_hp”, as follows:

Functions for creating hp vectors:

> **vector_hp**(*n*) - creates an empty hp vector with length *n*;
>
> **range_hp**(*x*1; *x*n; *s*) - creates an hp vector from a range of values.

Functions for creating hp matrices:

> **matrix_hp**(*m*; *n*) - creates an hp empty matrix with dimensions *m*⨯*n*;
>
> **identity_hp**(*n*) - creates an hp identity matrix with dimensions *n*⨯*n*;
>
> **diagonal_hp**(*n*; *d*) - creates an *n*⨯*n* hp diagonal matrix filled with value *d*;
>
> **column_hp**(*m*; *c*) - creates an *m*⨯1 hp column matrix filled with value *c*;
>
> **utriang_hp**(*n*) - creates an *n*⨯*n* hp upper triangular matrix;
>
> **ltriang_hp**(*n*) - creates an *n*⨯*n* hp lower triangular matrix;
>
> **symmetric_hp**(*n*) - creates an *n*⨯*n* hp symmetric matrix.

The function **hp**(*x*) converts any argument *x* to its high-performance equivalent.
It can be used together with the square brackets operator \[\] for initialization of vectors and matrices from a list of values.
For example:

> *a* = **hp**(\[1; 2; 4\]) will create a high-performance vector and…
>
> *A* = **hp**(\[1; 2; 3\|4; 5; 6\]) will create a high-performance matrix.

The conversion includes coping the values from the standard array to the hp one, so it must be used only for small arrays.
If the standard array contains different, but consistent units, they will be converted to the units of the first element.
If the units are not consistent, the conversion is not possible and error is returned instead.
For example:

  *a* = **hp**(\[1m; 20dm; 30cm\])‘ = \[1 m 2 m 0.3 m\]

  *a* = **hp**(\[1m; 20s; 30kg\])’ = Inconsistent units: "m, kg".

Any expression that contains only hp vectors/arrays will return also an hp type.
If the expression contains only standard vectors/arrays or mixed standard and hp, it will return a standard type.
To check if the type of *x* is a high-performance (hp) vector or matrix you can use the function **ishp**(*x*).

#### High performance symmetric solvers

Calcpad also includes advanced solvers for two of the most common matrix problems – solution of linear systems of equations and finding the eigenvalues and eigenvector of a matrix:

##### PCG symmetric linear solver

Direct methods using Cholesky and LDL<sup>T</sup> factorizations are suitable for small to medium sized matrices.
For larger matrices, the computational cost and solution time get too high for practical use because the asymptotic complexity of factorization is *O*(*n*<sup>3</sup>). In such cases, iterative solution methods are preferred.
They are much faster than direct ones, especially if the matrix is well conditioned.
One of the most popular of them is the preconditioned conjugate gradient (PCG) method.
Its complexity is $`O(m\sqrt{k})`$, where *m* is the number of nonzero elements and *k* is the condition number of the matrix.

In Calcpad, the PCG method is used in the following functions:

  **slsolve**(*A*; *b*) - solves the symmetric linear system of equations *Ax* ⃗ = *b⃗* ;

  **smsolve**(*A*; *B*) - solves the generalized symmetric matrix equation *AX* = *B*.

Since most engineering methods like FEM and finite differences use symmetric matrices, we put a lot of effort into improving this particular kind of problem.
If the matrix has banded or skyline structure, the algorithm takes advantage of that by storing and processing only the elements within the bandwidth.
You can achieve such structure and minimize the bandwidth by providing appropriate numbering for the joints of the FE model.

Iterative methods like PCG are approximate and the solution continues until a certain precision is achieved.
In Calcpad, it is specified by setting the variable *Tol*. Its default value is *Tol* = 10<sup>-6</sup> just like in MATLAB.
If the required precision is not reached for under 1000 iterations, no convergence is assumed, so the solution is stopped with an error message.
Preconditioning can often improve convergence by reducing the condition number *k*. In Calcpad, a simple Jacoby preconditioner is used for that purpose.

##### Symmetric Lanczos eigensolver

Similarly to the system of equations, the direct QL algorithm with implicit shifts we use for finding the eigenvalues and eigenvectors of matrices has a complexity of *O*(*n*<sup>3</sup>) which makes it suitable for small to medium sized problems.
In addition, it always finds all eigenvalues and eigenvectors, which is not required in most cases.
For example, in structural dynamics we usually need only the first of the most significant vibration frequencies and modes.
The Lanczos method is much more appropriate for that purpose.
It can find several of the extreme (smallest or largest) eigenvalues of a large matrix but much faster than the Implicit QL algorithm.
It has a time complexity of O(*k*<sup>2</sup>*m*), where *k* is the number of iterations and *m* is the number of nonzero elements of the matrix.
It is applied at the tridiagonalization step, replacing the Householder’s reflections method.

In Calcpad, it is used for the same functions as the QL method, when the size of the matrix is \> 200:

  **eigenvals**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvalues of matrix *M*;

  **eigenvecs**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvectors of matrix *M*;

  **eigen**(*M*; *n*<sub>e</sub>) - the first *n*<sub>e</sub> eigenvalues and eigenvectors of matrix *M*.

Argument *n*<sub>e</sub> is optional and can be omitted.
In this case or if *n*<sub>e</sub> = 0, all eigenvalues/vectors are returned.
If *n*<sub>e</sub> \< 0 the lowest eigenvalues are returned and if *n*<sub>e</sub> \> 0 - the largest ones.  
The maximum number of iterations is set to be <span class="mark">4</span>*n*<sub>e</sub> <span class="mark">+ 100</span>. So, if the size of the matrix is *n* \< 1000 and *n*<sub>e</sub> \> *n*/5 the QL method is used again.
This is because the Lanczos method is less accurate and when the number of iterations gets close to the matrix size, the performance is reduced to the one of the QL algorithm.
