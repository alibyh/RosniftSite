# Marketplace table — filter & resize improvements

Short description of the changes made to `src/components/Marketplace.tsx` (and
`src/components/Marketplace.css` for the resize handle).

## 1. Excel-style cross-column filter awareness

Each column's filter dropdown now only lists values that exist in the rows
*after every other active filter is applied*. Picking "Класс МТР = X" shrinks
the options shown in every other column to only what's still visible. Internally
this is handled by a single `applyFilters(rows, skipColumnKey?)` function —
`skipColumnKey` is passed when computing a column's own dropdown options so
that column's filter doesn't collapse its own options.

## 2. Multi-select per non-numeric column

Text/code columns now use a multi-select Autocomplete with chips (Excel-style
checklist). Multiple values within one column OR together. Type to search
inside the dropdown (built into MUI Autocomplete). `limitTags={1}` keeps the
cell compact when many values are picked.

## 3. Numeric range filters

`Количество`, `Цена запаса`, and `Стоимость` now show two small inputs
(`Мин` / `Макс`) instead of a value picker. Empty = unbounded. Accepts
`1234.56` or `1 234,56`. Commits on blur or Enter.

## 4. Date column — Год / Месяц / День, behind a click

The `Дата поступления` filter cell renders as a compact summary
(e.g. `Все`, `2024`, `2024-05`, `2024-05-08`). Clicking it opens a popover
with three cascading dropdowns: Год → Месяц → День. Month is disabled until a
year is picked, day until a month. Each option list is also recomputed live
to only show values that exist after the other column filters are applied.
Date strings in `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`, etc., are all
parsed by a single helper.

## 5. Column resize bug fixes

- **Sort no longer fires on resize**: the click that bubbles to the
  `TableCell` after `mouseup` is suppressed via a `justResizedRef` flag
  (set on `mouseup` only when the pointer actually moved).
- **Better grab area / alignment**: the resize handle is now 10 px wide and
  positioned `right: -5px` so it straddles the cell border (was 4 px tucked
  inside the cell). A 2 px yellow indicator appears on hover and during drag.

## 6. Persistence

Column widths are now saved to `localStorage` under
`marketplace.columnWidths.v1` and merged over the defaults on load, so they
survive reload. To reset during dev:

```js
localStorage.removeItem('marketplace.columnWidths.v1');
```

## 7. Per-tab filter state

`Складские запасы` and `Мои запасы` keep their filters independently.
Switching tabs preserves each tab's column filters, range filters, and date
filter — they're stored as `Record<tabIndex, FilterState>` internally, with
thin wrapper setters that read/write the slot for the current `tabIndex`.
The date popover is also closed on tab switch.

## 8. Misc

- "Очистить все фильтры" and the active-filters count include the date and
  range filters, not just the multi-select column filters.
- The empty-state message and the page-reset effect both include all filter
  types so paging resets correctly when any filter changes.
