/**
 * Form validation, dirty tracking and prevention of duplicate submissions.
 * Return the async operation from your handler. Reset dirty state only after successful persistence; native input constraints still apply.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function readForm(form) { const result = {}; for (const [key, value] of new FormData(form)) { if (Object.hasOwn(result, key)) result[key] = [].concat(result[key], value); else Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true }); } return result; }
export function bindForm(form, task, { onError = () => {}, onBusy = () => {} } = {}) {
  let busy = false;
  const handler = async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    const buttons = [...form.querySelectorAll('button, input[type="submit"]')];
    const states = buttons.map(button => button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    form.setAttribute('aria-busy', 'true'); onBusy(true);
    try { await task(readForm(form), form); } catch (error) { onError(error); }
    finally { busy = false; buttons.forEach((button, i) => { button.disabled = states[i]; }); form.removeAttribute('aria-busy'); onBusy(false); form.dispatchEvent(new Event('app:idle', { bubbles: true })); }
  };
  form.addEventListener('submit', handler);
  return () => form.removeEventListener('submit', handler);
}
export function trackDirty(form, onChange = () => {}) {
  let dirty = false;
  const handler = () => { if (!dirty) { dirty = true; onChange(true); } };
  form.addEventListener('input', handler);
  return { get dirty() { return dirty; }, reset() { dirty = false; onChange(false); }, destroy() { form.removeEventListener('input', handler); } };
}
