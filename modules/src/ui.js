/**
 * Safe element creation, status messages, toasts and confirmation dialogs.
 * Render untrusted content as text. Allowlisted URL schemes and attributes do not replace server sanitization; pass i18n to localize dialogs.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import { createBottomSheet } from './bottom-sheet.js';
import { createI18n } from './i18n.js';
export function element(tag, { text, className, attributes = {}, on = {}, children = [] } = {}, doc = globalThis.document) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) { if (/^on/i.test(name) || name.toLowerCase() === 'srcdoc') throw new TypeError('Unsafe attribute'); if (['href', 'src', 'action', 'formaction'].includes(name.toLowerCase())) { const url = new URL(String(value), doc.baseURI || 'https://localhost/'); if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) && !(url.protocol === 'blob:' && name.toLowerCase() === 'src')) throw new TypeError('Unsafe URL'); } node.setAttribute(name, String(value)); }
  for (const [name, fn] of Object.entries(on)) node.addEventListener(name, fn);
  node.append(...children);
  return node;
}
export function createToast(container, { duration = 4000 } = {}) {
  container.setAttribute('role', 'status');
  let timer;
  return { show(message, error = false) { clearTimeout(timer); container.textContent = String(message); container.dataset.error = String(error); container.hidden = false; timer = setTimeout(() => { container.hidden = true; }, duration); }, hide() { clearTimeout(timer); container.hidden = true; } };
}
export function confirmDialog(message, { title, presentation = 'dialog', i18n = createI18n(), document: doc = globalThis.document } = {}) {
  return new Promise(resolve => {
    const dialog = element('dialog', { className: 'app-dialog' }, doc);
    let sheet, finishing = false;
    const finish = async value => { if (finishing) return; finishing = true; if (sheet) { await sheet.close(); sheet.destroy(); } else dialog.close(); dialog.remove(); resolve(value); };
    const heading = element('h2', { text: title ?? i18n.t('Confirmation'), attributes: { id: 'dialog-' + crypto.randomUUID() } }, doc);
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading, element('p', { text: message }, doc), element('button', { text: i18n.t('Cancel'), on: { click: () => finish(false) } }, doc), element('button', { text: i18n.t('Confirm'), className: 'primary', on: { click: () => finish(true) } }, doc));
    dialog.addEventListener('cancel', event => { if (presentation !== 'sheet') { event.preventDefault(); finish(false); } });
    doc.body.append(dialog);
    if (presentation === 'sheet') {
      dialog.classList.add('kit-sheet');
      const header=element('div',{className:'kit-sheet-header',attributes:{'data-sheet-drag':''}},doc);
      const close=element('button',{text:'×',className:'kit-close',attributes:{type:'button','data-sheet-close':'','aria-label':i18n.t('kitClose')}},doc);
      const buttons=[...dialog.querySelectorAll('button')],row=element('div',{className:'kit-actions kit-actions-pair'},doc);
      row.append(...buttons);header.append(heading,close);dialog.prepend(element('div',{attributes:{'data-sheet-handle':'','aria-hidden':'true'}},doc),header);dialog.append(row);
      heading.tabIndex = -1; heading.setAttribute('data-sheet-focus', ''); heading.setAttribute('autofocus', ''); sheet = createBottomSheet(dialog, { onDismiss: () => finish(false) }); sheet.open(); } else dialog.showModal();
  });
}
export function setStatus(node, state, message) { node.dataset.state = state; node.textContent = message; node.setAttribute('aria-busy', String(state === 'loading')); }
