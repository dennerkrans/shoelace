import { html, LitElement } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { emit } from '../../internal/event';
import { getTextContent } from '../../internal/slot';
import styles from './menu.styles';
import type SlMenuItem from '../../components/menu-item/menu-item';
import type { CSSResultGroup } from 'lit';
export interface MenuSelectEventDetail {
  item: SlMenuItem;
}

/**
 * @since 2.0
 * @status stable
 *
 * @slot - The menu's content, including menu items, menu labels, and dividers.
 *
 * @event {{ item: SlMenuItem }} sl-select - Emitted when a menu item is selected.
 *
 * @csspart base - The component's internal wrapper.
 */
@customElement('sl-menu')
export default class SlMenu extends LitElement {
  static styles: CSSResultGroup = styles;

  @query('.menu') menu: HTMLElement;
  @query('slot') defaultSlot: HTMLSlotElement;

  private typeToSelectString = '';
  private typeToSelectTimeout: number;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'menu');
  }

  getAllItems() {
    return [...this.defaultSlot.assignedElements({ flatten: true })].filter((el: HTMLElement) => {
      return el.getAttribute('role') === 'menuitem';
    }) as SlMenuItem[];
  }

  /**
   * @internal Gets the current menu item, which is the menu item that has `tabindex="0"` within the roving tab index.
   * The menu item may or may not have focus, but for keyboard interaction purposes it's considered the "active" item.
   */
  getCurrentItem() {
    return this.getAllItems().find(i => i.getAttribute('tabindex') === '0');
  }

  /**
   * @internal Sets the current menu item to the specified element. This sets `tabindex="0"` on the target element and
   * `tabindex="-1"` to all other items. This method must be called prior to setting focus on a menu item.
   */
  setCurrentItem(item: SlMenuItem) {
    const items = this.getAllItems();
    const activeItem = item ?? items[0];

    // Update tab indexes
    items.forEach(i => {
      i.setAttribute('tabindex', i === activeItem ? '0' : '-1');
    });
  }

  /**
   * Initiates type-to-select logic, which automatically selects an option based on what the user is currently typing.
   * The event passed will be used to append the appropriate characters to the internal query and the selection will be
   * updated. After a brief period, the internal query is cleared automatically. This is useful for enabling
   * type-to-select behavior when the menu doesn't have focus.
   */
  typeToSelect(event: KeyboardEvent) {
    const items = this.getAllItems();
    clearTimeout(this.typeToSelectTimeout);
    this.typeToSelectTimeout = window.setTimeout(() => (this.typeToSelectString = ''), 1000);

    if (event.key === 'Backspace') {
      if (event.metaKey || event.ctrlKey) {
        this.typeToSelectString = '';
      } else {
        this.typeToSelectString = this.typeToSelectString.slice(0, -1);
      }
    } else {
      this.typeToSelectString += event.key.toLowerCase();
    }

    for (const item of items) {
      const slot = item.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
      const label = getTextContent(slot).toLowerCase().trim();
      if (label.startsWith(this.typeToSelectString)) {
        this.setCurrentItem(item);

        // Set focus here to force the browser to show :focus-visible styles
        item.focus();
        break;
      }
    }
  }

  handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const item = target.closest('sl-menu-item');

    if (item?.disabled === false) {
      emit(this, 'sl-select', { detail: { item } });
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    // Make a selection when pressing enter
    if (event.key === 'Enter') {
      const item = this.getCurrentItem();
      event.preventDefault();

      // Simulate a click to support @click handlers on menu items that also work with the keyboard
      item?.click();
    }

    // Prevent scrolling when space is pressed
    if (event.key === ' ') {
      event.preventDefault();
    }

    // Move the selection when pressing down or up
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const items = this.getAllItems();
      const activeItem = this.getCurrentItem();
      let index = activeItem ? items.indexOf(activeItem) : 0;

      if (items.length > 0) {
        event.preventDefault();

        if (event.key === 'ArrowDown') {
          index++;
        } else if (event.key === 'ArrowUp') {
          index--;
        } else if (event.key === 'Home') {
          index = 0;
        } else if (event.key === 'End') {
          index = items.length - 1;
        }

        if (index < 0) {
          index = items.length - 1;
        }
        if (index > items.length - 1) {
          index = 0;
        }

        this.setCurrentItem(items[index]);
        items[index].focus();

        return;
      }
    }

    this.typeToSelect(event);
  }

  handleMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (target.getAttribute('role') === 'menuitem') {
      this.setCurrentItem(target as SlMenuItem);
    }
  }

  handleSlotChange() {
    const items = this.getAllItems();

    // Reset the roving tab index when the slotted items change
    if (items.length > 0) {
      this.setCurrentItem(items[0]);
    }
  }

  render() {
    return html`
      <div
        part="base"
        class="menu"
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sl-menu': SlMenu;
  }
}
