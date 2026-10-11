/**
 * Form registry: the single place that knows which inspection forms exist.
 * To add a form, create a definition file and list it below.
 */

const flatbed6 = require('./definitions/flatbed6');
const cargoVan78 = require('./definitions/cargoVan78');
const container78 = require('./definitions/container78');
const straightTruck78 = require('./definitions/straightTruck78');
const truckTrailer1718 = require('./definitions/truckTrailer1718');

const FORMS = Object.freeze([truckTrailer1718, container78, straightTruck78, cargoVan78, flatbed6]);

const formsById = new Map(FORMS.map((form) => [form.id, form]));

const getForm = (formId) => formsById.get(formId) || null;

const listForms = () => FORMS;

/**
 * The part of a definition the mobile app needs: everything except where
 * things are printed on the PDF.
 */
const toPublicForm = ({ id, label, title, version, checklist, fields }) => ({
  id,
  label,
  title,
  version,
  checklist,
  fields,
});

module.exports = { getForm, listForms, toPublicForm };
