/**
 * Local form drafts and restore bindings.
 * Exclude password, file and hidden fields. Direct save accepts trusted app data only; remove private drafts after sign-out.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function createDrafts(storage) {
  return {
    save: (id, value) => storage.set('draft:' + id, { value, updatedAt: new Date().toISOString() }),
    load: id => storage.get('draft:' + id),
    remove: id => storage.remove('draft:' + id),
    bind(form, id) {
      const saved = storage.get('draft:' + id);
      if (saved?.value && typeof saved.value === 'object') for (const field of form.elements) if (field.name && !['password', 'file', 'hidden'].includes(field.type) && Object.hasOwn(saved.value, field.name)) { if (field.type === 'radio') field.checked = saved.value[field.name] === field.value; else if (field.type === 'checkbox') field.checked = Boolean(saved.value[field.name]); else field.value = saved.value[field.name]; }
      const handler = () => { const value = Object.create(null); for (const field of form.elements) if (field.name && !['password', 'file', 'hidden', 'submit', 'button'].includes(field.type)) { if (field.type === 'radio') { if (field.checked) value[field.name] = field.value; } else value[field.name] = field.type === 'checkbox' ? field.checked : field.value; } storage.set('draft:' + id, { value, updatedAt: new Date().toISOString() }); };
      form.addEventListener('input', handler);
      return () => form.removeEventListener('input', handler);
    }
  };
}
