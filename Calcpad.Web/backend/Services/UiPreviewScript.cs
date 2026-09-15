namespace Calcpad.Server.Services
{
    /// <summary>
    /// The client side half of the <c>#UI</c> feature: wires the controls <c>ExpressionParser</c>
    /// emitted, hydrates datagrids with jspreadsheet and posts each edit to the host as a
    /// <c>uiValueChange</c>. Emitted server side so all three hosts share one implementation.
    /// </summary>
    internal static class UiPreviewScript
    {
        public static string GetScriptTag() => ScriptTag;

        private const string ScriptTag = """
<script>
(function () {
    // The document is sandboxed inside the host, so the parent is the only way out. An exported
    // form opened on its own posts to a window with no listener, leaving it static.
    function send(msg) {
        try { window.parent.postMessage(msg, '*'); } catch (e) { }
    }

    function post(type, varName, newValue, sourceLine) {
        send({
            type: type, varName: varName, newValue: newValue, sourceLine: sourceLine,
            groupId: window.__calcpadGroupId
        });
    }

    function lineOf(el) {
        return parseInt(el.getAttribute('data-ui-line') || '0');
    }

    // The line wrapper carries data-ui-var too, so the classes pick out the control itself.
    var CONTROLS = '.calcpad-ui-input, .calcpad-ui-dropdown, .calcpad-ui-checkbox, .calcpad-ui-radio, .calcpad-ui-datagrid';
    // How long a datagrid waits for data entry to stop before it posts.
    var GRID_IDLE_MS = 400;

    // MIN_* are the floors a proportional shrink may not go below.
    var DEF_COL = 80, MIN_COL = 28, DEF_ROW_HDR = 50, MIN_ROW_HDR = 24, SINGLE_MIN = 80;
    var CHROME = 8, SCROLLBAR = 10, HDR_PAD = 12, MAX_GRID_H = 420;
    var measureCtx = null;
    var sheetsByKey = {};
    // Nothing is persisted until an edit is posted, so opening a document afresh never moves focus.
    var armed = false;

    // Assigning srcdoc does not leave this window standing and its opaque origin denies it
    // storage, so the host holds the state and seeds it back as __calcpadUiPosition.
    function postState(state) {
        send({ type: 'cpdUiState', state: state, groupId: window.__calcpadGroupId });
    }

    // Consumed once: a stale position must not steal focus when a document is merely opened.
    var pending = window.__calcpadUiPosition || null;
    window.__calcpadUiPosition = null;

    function saveState() {
        var state = {};
        var active = document.activeElement;
        var control = active && active.closest ? active.closest(CONTROLS) : null;
        var sheet = typeof jspreadsheet !== 'undefined' ? jspreadsheet.current : null;
        if (control && !control.classList.contains('calcpad-ui-datagrid')) {
            state.key = control.getAttribute('data-ui-var');
            if (active.setSelectionRange && active.type === 'text')
                state.caret = [active.selectionStart, active.selectionEnd];
        } else if (sheet && sheet.calcpadUiKey && sheet.selectedCell) {
            // A grid keeps its position in the library; jspreadsheet.current takes the keystrokes.
            state.key = sheet.calcpadUiKey;
            state.cell = [sheet.selectedCell[0], sheet.selectedCell[1], sheet.selectedCell[2], sheet.selectedCell[3]];
        }
        postState(state);
    }

    function restoreState() {
        if (!pending) return;
        if (pending.key && pending.cell)
            restoreCell(sheetsByKey[pending.key], pending.cell);
        else if (pending.key)
            restoreFocus(pending.key, pending.caret);
    }

    function restoreCell(sheet, cell) {
        if (!sheet) return;
        jspreadsheet.current = sheet;
        sheet.updateSelectionFromCoords(cell[0], cell[1], cell[2], cell[3]);
        var record = sheet.records && sheet.records[cell[1]] && sheet.records[cell[1]][cell[0]];
        if (record && record.element && record.element.scrollIntoView)
            record.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function restoreFocus(key, caret) {
        var target = null;
        document.querySelectorAll(CONTROLS).forEach(function (el) {
            if (!target && el.getAttribute('data-ui-var') === key) target = el;
        });
        if (target && target.tagName === 'SPAN')
            target = target.querySelector('input[type="radio"]:checked') || target.querySelector('input[type="radio"]');
        if (!target || !target.focus) return;

        target.focus({ preventScroll: true });
        if (!caret || !target.setSelectionRange) return;
        try { target.setSelectionRange(caret[0], caret[1]); } catch (e) { }
    }

    // The re-render lands long after the edit, so the position is rewritten until then.
    function trackPosition() {
        if (armed) saveState();
    }

    function change(el, value) {
        post('uiValueChange', el.getAttribute('data-ui-var'), value, lineOf(el));
        armed = true;
        // Committing moves focus on, so where to come back to settles on the next tick.
        setTimeout(saveState, 0);
    }

    document.addEventListener('focusin', trackPosition);
    document.addEventListener('mouseup', trackPosition);

    // The entered text replaces the right hand side, so anything the parser would reject turns
    // the line into an error - no exponent form, since MathParser reads the 'e' of 2.5e6 as a
    // unit. PARTIAL also passes the mid-typing states, which are never posted.
    var NUMBER = /^[-+\u2212]?(\d+\.?\d*|\.\d+)$/;
    var PARTIAL = /^[-+\u2212]?(\d+\.?\d*|\.\d*)?$/;
    // A number with a unit, mirroring UiSyntax.IsNumber + IsUnits.
    var UNIT_NAME = '[\\p{L}\u00b0%\u2030\u2031\u2032\u2033\u2127_]+';
    var UNIT_POW = '(?:\\s*\\^\\s*[-+\u2212]?\\d+(?:\\.\\d+)?)?';
    var UNIT_PART = UNIT_NAME + UNIT_POW;
    var VALUE = new RegExp(
        '^[-+\u2212]?(?:\\d+\\.?\\d*|\\.\\d+)' +
        '(?:\\s*' + UNIT_PART + '(?:\\s*[*/\u00b7\u00d7\u2219]\\s*' + UNIT_PART + ')*)?$', 'u');

    // Default edits the number and leaves the unit in the document; 'forceUnits: false' puts the
    // unit in the control; 'allowExpression' hands the right hand side over whole.
    function modeOf(el) {
        if (el.getAttribute('data-ui-allow-expression') === '1') return 'expression';
        return el.getAttribute('data-ui-force-units') === '0' ? 'value' : 'number';
    }

    function accepts(mode, text) {
        if (mode === 'expression') return text.length > 0;
        return (mode === 'value' ? VALUE : NUMBER).test(text);
    }

    document.querySelectorAll('.calcpad-ui-input').forEach(function (input) {
        var mode = modeOf(input);
        if (mode === 'number') input.setAttribute('inputmode', 'decimal');
        var typed = input.value;
        var committed = input.value;
        // Only the number-only mode can tell a mid-typing state from a wrong one.
        if (mode === 'number')
            input.addEventListener('input', function () {
                if (PARTIAL.test(input.value)) {
                    typed = input.value;
                    return;
                }
                var caret = input.selectionStart - (input.value.length - typed.length);
                input.value = typed;
                try { input.setSelectionRange(caret, caret); } catch (e) { }
            });
        input.addEventListener('change', function () {
            // '12.' passes as a number in the field, but not as a right hand side.
            var value = input.value.trim();
            if (mode !== 'expression') value = value.replace(/\.$/, '');
            if (!accepts(mode, value)) {
                input.value = committed;
                typed = committed;
                return;
            }
            input.value = value;
            committed = value;
            typed = value;
            change(input, value);
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') input.blur();
        });
    });

    document.querySelectorAll('.calcpad-ui-dropdown').forEach(function (select) {
        select.addEventListener('change', function () { change(select, select.value); });
    });

    document.querySelectorAll('.calcpad-ui-radio').forEach(function (group) {
        group.querySelectorAll('input[type="radio"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                if (radio.checked) change(group, radio.value);
            });
        });
    });

    document.querySelectorAll('.calcpad-ui-checkbox').forEach(function (cb) {
        cb.addEventListener('change', function () { change(cb, cb.checked ? '1' : '0'); });
    });

    hydrateGrids(document.querySelectorAll('.calcpad-ui-datagrid'));
    restoreState();

    function hydrateGrids(grids) {
        if (!grids.length) return;

        if (typeof jspreadsheet === 'undefined') {
            grids.forEach(function (container) {
                container.textContent = 'Datagrid library is not available.';
            });
            return;
        }

        grids.forEach(function (container) {
            var rows = parseInt(container.getAttribute('data-ui-rows') || '1');
            var cols = parseInt(container.getAttribute('data-ui-columns') || '1');
            var values = container.getAttribute('data-ui-values') || '';
            var mode = modeOf(container);
            // Present only when the cells hold numbers and the value carried units.
            var cellUnits = jsonAttr(container, 'data-ui-cell-units');

            // Calcpad literal shape: '|' separates rows, ';' separates cells within a row.
            var data;
            if (values) {
                data = values.split('|').map(function (row) { return row.split(';'); });
            } else {
                data = [];
                for (var r = 0; r < rows; r++) data.push(new Array(cols).fill('0'));
            }
            // A unit reaching a numeric cell is rejected on the next edit and takes the value
            // with it, so it is put aside here rather than shown.
            if (mode === 'number') cellUnits = stripUnits(data, cellUnits);

            var colHeaders = jsonAttr(container, 'data-ui-col-headers');
            var rowHeaders = jsonAttr(container, 'data-ui-row-headers');
            var layout = resolveWidths(container, data, cols, colHeaders);

            var columns = [];
            for (var c = 0; c < cols; c++) {
                var def = { width: layout.cols[c] };
                if (colHeaders && c < colHeaders.length) def.title = colHeaders[c];
                columns.push(def);
            }

            var worksheet = {
                data: data,
                minDimensions: [cols, rows],
                columns: columns,
                // The #UI directive sizes the grid, so resizing and annotating are taken out.
                allowInsertRow: false,
                allowManualInsertRow: false,
                allowDeleteRow: false,
                allowInsertColumn: false,
                allowManualInsertColumn: false,
                allowDeleteColumn: false,
                allowComments: false,
                // No tableWidth/tableHeight: they only fix .jss_content at a size of its own.
                tableOverflow: true
            };
            if (rowHeaders) {
                worksheet.rows = {};
                for (var i = 0; i < rowHeaders.length; i++) worksheet.rows[i] = { title: rowHeaders[i] };
            }

            var created = jspreadsheet(container, {
                worksheets: [worksheet],
                about: false,
                allowExport: false,
                onchange: emit,
                onpaste: emit,
                onselection: trackPosition,
                onblur: flushNow
            });
            var sheet = Array.isArray(created) ? created[0] : created;
            var key = container.getAttribute('data-ui-var');
            sheet.calcpadUiKey = key;
            sheetsByKey[key] = sheet;
            // Must stay synchronous: restoreState() paints the selection from live geometry.
            applyRowHeaderWidth(container, layout.rowHeader);
            capHeight(container, layout.width);
            showUnits(sheet, cellUnits);
            var idle = null;

            // Each committed cell would have the host rewrite the document on top of whatever
            // is typed next, so filling the grid in is treated as one edit.
            function emit() {
                if (idle) clearTimeout(idle);
                idle = setTimeout(flush, GRID_IDLE_MS);
            }

            function flush() {
                idle = null;
                // An open cell editor means the pause was only a slow typist.
                if (sheet.edition) {
                    emit();
                    return;
                }
                var grid = valuesOnly(sheet, sheet.getData ? sheet.getData() : [], mode);
                var cells = withUnits(grid, cellUnits);
                var literal = cells.length === 1 ?
                    '[' + cells[0].join('; ') + ']' :
                    '[' + cells.map(function (row) { return row.join('; '); }).join(' | ') + ']';
                change(container, literal);
            }

            function flushNow() {
                if (!idle) return;
                clearTimeout(idle);
                flush();
            }
        });
    }

    // Called before jspreadsheet() makes the container an inline-block: until then its content
    // box is the width the page allows.
    function availableWidth(container) {
        var w = container.clientWidth;
        if (!w && container.parentElement) w = container.parentElement.clientWidth;
        if (!w) w = document.body.clientWidth || document.documentElement.clientWidth;
        return Math.floor(w) || 640;
    }

    function measureText(container, text) {
        if (!text) return 0;
        if (!measureCtx) {
            try { measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { return 0; }
        }
        if (!measureCtx) return 0;
        var style = window.getComputedStyle(container);
        // The 'font' shorthand does not always serialise.
        measureCtx.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
        return Math.ceil(measureCtx.measureText(text).width);
    }

    function positive(n) {
        n = parseInt(n, 10);
        return isFinite(n) && n > 0 ? n : null;
    }

    // The declared total, in pixels or as a percentage of the line, never wider than the page.
    function targetWidth(container, page) {
        var raw = (container.getAttribute('data-ui-width') || '').trim();
        if (raw.slice(-1) === '%') {
            var percent = parseFloat(raw);
            return isFinite(percent) && percent > 0 ? Math.min(page, Math.round(page * percent / 100)) : null;
        }
        var px = positive(raw);
        return px === null ? null : Math.min(px, page);
    }

    // One factor with the drift settled on the widest, so declared widths are read as ratios.
    function fitColumns(cols, target) {
        var total = 0;
        for (var i = 0; i < cols.length; i++) total += cols[i];
        if (!total || !cols.length) return cols;

        var f = target / total;
        var out = cols.map(function (w) { return Math.max(MIN_COL, Math.floor(w * f)); });
        var sum = 0, widest = 0;
        for (var j = 0; j < out.length; j++) {
            sum += out[j];
            if (out[j] > out[widest]) widest = j;
        }
        out[widest] = Math.max(MIN_COL, out[widest] + target - sum);
        return out;
    }

    function resolveWidths(container, data, cols, colHeaders) {
        for (var r = 0; r < data.length; r++) cols = Math.max(cols, data[r].length);

        var page = availableWidth(container) - CHROME;
        if (data.length * 24 + 30 > MAX_GRID_H) page -= SCROLLBAR;

        var declared = jsonAttr(container, 'data-ui-column-widths') || [];
        var rowHeader = positive(container.getAttribute('data-ui-row-header-width')) || DEF_ROW_HDR;
        var w = [];
        for (var c = 0; c < cols; c++) w.push(positive(declared[c]) || DEF_COL);

        // A single column has no page to share, so it is sized to its header.
        if (cols === 1 && !positive(declared[0]))
            w[0] = Math.max(SINGLE_MIN, measureText(container, colHeaders && colHeaders[0]) + HDR_PAD);

        var target = targetWidth(container, page);

        var total = rowHeader;
        for (var i = 0; i < w.length; i++) total += w[i];
        // An undeclared total keeps its natural width, unless that runs off the page.
        if (target === null) {
            if (total <= page) return { rowHeader: rowHeader, cols: w, width: page };

            target = page;
        }
        // The row header is a width, not a ratio: it gives way only when nothing is left.
        var room = target - cols * MIN_COL;
        if (rowHeader > room) rowHeader = Math.max(MIN_ROW_HDR, room);
        return { rowHeader: rowHeader, cols: fitColumns(w, target - rowHeader), width: page };
    }

    // jspreadsheet hardcodes width="50" on the first <col> and offers no option for it.
    function applyRowHeaderWidth(container, width) {
        var col = container.querySelector('colgroup > col');
        if (!col) return;

        col.setAttribute('width', width);
        col.style.width = width + 'px';
    }

    // Measured, not predicted: wrapped rows are taller than the library's default. Set on
    // .jss_content, which is what the PDF pass already clears.
    function capHeight(container, width) {
        var content = container.querySelector('.jss_content');
        if (!content) return;

        if (content.scrollHeight > MAX_GRID_H) {
            content.style.maxHeight = MAX_GRID_H + 'px';
            content.style.overflowY = 'auto';
        }
        if (content.scrollWidth > width) {
            content.style.width = width + 'px';
            content.style.overflowX = 'auto';
        }
    }

    // Every cell becomes a matrix element, so one the mode rejects goes back to 0.
    function valuesOnly(sheet, grid, mode) {
        for (var r = 0; r < grid.length; r++) {
            for (var c = 0; c < grid[r].length; c++) {
                var cell = String(grid[r][c]).trim();
                if (accepts(mode, cell)) {
                    grid[r][c] = cell;
                    continue;
                }
                grid[r][c] = '0';
                if (sheet.setValueFromCoords) sheet.setValueFromCoords(c, r, '0');
            }
        }
        return grid;
    }

    // Mirrors SplitCell server side: the numeric prefix, then whatever unit follows it.
    function splitUnit(cell) {
        var s = String(cell), i = 0;
        while (i < s.length && '0123456789.-+−'.indexOf(s.charAt(i)) !== -1) ++i;
        return i === 0 ? [s, ''] : [s.slice(0, i), s.slice(i)];
    }

    // Takes any unit out of the cells and into the stash, so the grid edits numbers only.
    function stripUnits(data, cellUnits) {
        for (var r = 0; r < data.length; r++)
            for (var c = 0; c < data[r].length; c++) {
                var parts = splitUnit(data[r][c]);
                if (!parts[1]) continue;
                data[r][c] = parts[0];
                if (!cellUnits) cellUnits = data.map(function (row) { return row.map(function () { return ''; }); });
                if (!cellUnits[r]) cellUnits[r] = [];
                cellUnits[r][c] = parts[1];
            }
        return cellUnits;
    }

    // The seeded unit goes back on, so a grid of plain numbers still writes the document's units.
    function withUnits(grid, cellUnits) {
        if (!cellUnits) return grid;

        return grid.map(function (row, r) {
            return row.map(function (cell, c) {
                var unit = (cellUnits[r] && cellUnits[r][c]) || '';
                return unit ? cell + unit : cell;
            });
        });
    }

    // The unit is not in the cell, so it is shown on hover instead.
    function showUnits(sheet, cellUnits) {
        if (!cellUnits || !sheet.records) return;

        for (var r = 0; r < sheet.records.length; r++)
            for (var c = 0; c < sheet.records[r].length; c++) {
                var unit = cellUnits[r] && cellUnits[r][c];
                if (unit && sheet.records[r][c].element)
                    sheet.records[r][c].element.title = unit;
            }
    }

    function jsonAttr(el, name) {
        var value = el.getAttribute(name);
        if (!value) return null;
        try { return JSON.parse(value); } catch (e) { return null; }
    }
})();
</script>
""";
    }
}
