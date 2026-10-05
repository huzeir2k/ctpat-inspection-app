/**
 * defineForm() checks a form definition for internal consistency when the
 * server starts, so a typo in a definition fails loudly instead of producing a
 * misprinted compliance document.
 */

const PAGE = Object.freeze({ width: 612, height: 792 });

const fail = (formId, message) => {
  throw new Error(`Invalid form definition "${formId}": ${message}`);
};

const assertInPage = (formId, label, x, y) => {
  if (!(x >= 0 && x <= PAGE.width && y >= 0 && y <= PAGE.height)) {
    fail(formId, `${label} at (${x}, ${y}) is outside the page`);
  }
};

const pointsOf = (entry) => {
  switch (entry.kind) {
    case 'text':
    case 'check':
    case 'signature':
      return [[entry.x, entry.y]];
    case 'checkOptions':
      return Object.values(entry.options).map((p) => [p.x, p.y]);
    case 'circleOptions':
      return Object.values(entry.options).map((r) => [r.cx, r.cy]);
    default:
      return null;
  }
};

const defineForm = (definition) => {
  const { id, checklist, fields, layout } = definition;

  if (new Set(checklist.map((i) => i.id)).size !== checklist.length) {
    fail(id, 'duplicate checklist item ids');
  }
  if (new Set(fields.map((f) => f.key)).size !== fields.length) {
    fail(id, 'duplicate field keys');
  }
  if (layout.checklistRows.length !== checklist.length) {
    fail(id, `${checklist.length} checklist items but ${layout.checklistRows.length} layout rows`);
  }
  layout.checklistRows.forEach((y, i) => assertInPage(id, `checklist row ${i + 1}`, layout.checklistX, y));

  const fieldKeys = new Set(fields.map((f) => f.key));
  for (const field of fields) {
    const entry = layout.fields[field.key];
    if (!entry) fail(id, `field "${field.key}" has no layout entry`);

    const points = pointsOf(entry);
    if (!points) fail(id, `field "${field.key}" has unknown layout kind "${entry.kind}"`);
    points.forEach(([x, y]) => assertInPage(id, `field "${field.key}"`, x, y));

    if (field.type === 'choice') {
      const optionValues = field.options.map((o) => o.value).sort().join();
      const layoutValues = Object.keys(entry.options || {}).sort().join();
      if (optionValues !== layoutValues) {
        fail(id, `field "${field.key}" options (${optionValues}) do not match layout (${layoutValues})`);
      }
    }
    if (field.showWhen && !fieldKeys.has(field.showWhen.field)) {
      fail(id, `field "${field.key}" depends on unknown field "${field.showWhen.field}"`);
    }
  }
  for (const key of Object.keys(layout.fields)) {
    if (!fieldKeys.has(key)) fail(id, `layout entry "${key}" has no matching field`);
  }

  return Object.freeze(definition);
};

module.exports = { defineForm, PAGE };
