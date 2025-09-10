import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { ProductConfig, compare_deep, get_products, slwgCheckMissingDeps, slwgRenderDepsErrorCard, SLWG_REQUIRED_CARDS, SlwgDep } from './helpers';

interface LovelaceRowConfig {
  entity?: string;
  type?: string;
}
type EntityList = Array<LovelaceRowConfig>;
type CardList = Array<unknown>;

class ShoppingListWithGrocyShoppingListCard extends LitElement {
  @property() _config;
  @property() hass: any;
  @property() card;
  @property() _missingDeps: SlwgDep[] = [];

  _entities: EntityList;
  _cardsEntities: CardList;
  _cardBuilt?: Promise<void>;
  _cardBuiltResolve?;

  static getStubConfig() {
    return {
      sort_by: ['friendly_name'],
      exclude: {},
      include: {},
      custom_buttons: [],
      collaspable_buttons_class: 'col',
      shopping_list_id: 1,
      icon: 'mdi:cart',
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error('No configuration.');
    }
    this._missingDeps = slwgCheckMissingDeps(SLWG_REQUIRED_CARDS);
    if (config.hasOwnProperty('use_collapsable_card')) {
      if (config.use_collapsable_card) {
        if (config.hasOwnProperty('tap_action')) {
          throw new Error('hold_action has to be defined only when use_collapsable_card is false');
        }
        if (config.hasOwnProperty('tap_action')) {
          throw new Error('tap_action has to be defined only when use_collapsable_card is false');
        }
        if (config.hasOwnProperty('double_tap_action')) {
          throw new Error('double_tap_action has to be defined only when use_collapsable_card is false');
        }
      } else {
        if (config.hasOwnProperty('custom_buttons')) {
          throw new Error('custom_buttons has to be defined only when use_collapsable_card is true');
        }
        if (config.hasOwnProperty('collaspable_buttons_class')) {
          throw new Error('collaspable_buttons_class has to be defined only when use_collapsable_card is true');
        }
      }
    }
    config = JSON.parse(JSON.stringify(config));
    config.sort_by = config.sort_by || ['friendly_name'];
    config.custom_buttons = config.custom_buttons || [];
    config.use_collapsable_card = config.hasOwnProperty('use_collapsable_card') ? config.use_collapsable_card : true;
    config.collaspable_buttons_class = config.collaspable_buttons_class || 'col';
    config.tap_action = config.tap_action || { action: 'none' };
    config.hold_action = config.hold_action || { action: 'none' };
    config.double_tap_action = config.double_tap_action || { action: 'none' };
    config.icon = config.icon || 'mdi:cart';

    this._config = config;

    this._cardBuilt = new Promise((resolve) => (this._cardBuiltResolve = resolve));

    queueMicrotask(() => this.update_all());
  }

  findAndReplace(object, search, replacement, results?, parents?) {
    let key;

    results = results || {};
    parents = parents || [''];

    if (typeof object === 'object') {
      for (key in object) {
        if (object.hasOwnProperty(key)) {
          if (typeof object[key] === 'string' && object[key] == search) {
            object[key] = replacement;
          }
          if (typeof object[key] === 'object') {
            this.findAndReplace(object[key], search, replacement, results, parents.concat(key));
          }
        }
      }
    }
  }

  async update_all() {
    if (this.card) this.card.hass = this.hass;

    const entities = await this.update_entities();
    this.update_card(entities);
  }

  async update_entities(): Promise<EntityList> {
    const states = this.hass.states;

    const entities: EntityList = [...[]];

    if (!this.hass) {
      return entities;
    }

    const productArray = get_products(states, this._config, true);

    Object.values(productArray).map((value) => {
      const entity = value[1] as ProductConfig;
      const tap_action = JSON.parse(JSON.stringify(this._config.tap_action));
      this.findAndReplace(tap_action, '[PRODUCT_ID]', entity.entity_id);
      const hold_action = JSON.parse(JSON.stringify(this._config.hold_action));
      this.findAndReplace(hold_action, '[PRODUCT_ID]', entity.entity_id);
      const double_tap_action = JSON.parse(JSON.stringify(this._config.double_tap_action));
      this.findAndReplace(double_tap_action, '[PRODUCT_ID]', entity.entity_id);
      let entityCardConfig = {
        type: 'custom:button-card',
        entity: entity.entity_id,
        icon: this._config.icon,
        tap_action: tap_action,
        hold_action: hold_action,
        double_tap_action: double_tap_action,
        styles: {
          grid: [
            { 'grid-template-rows': '1fr' },
            { 'grid-template-areas': "'i n qty_in_list'" },
            { 'grid-template-columns': 'min-content 1fr min-content' },
          ],
          card: [{ padding: 'calc(var(--bs-gutter-x) * 0.5)' }],
          icon: [{ padding: '8px' }, { width: '24px' }, { height: '24px' }],
          name: [
            { 'align-self': 'center' },
            { 'text-align': 'left' },
            { width: '100%' },
            { 'margin-left': '46px' },
            { 'margin-right': '38px' },
            { 'font-size': '1rem' },
            { 'white-space': 'nowrap' },
            { overflow: 'hidden' },
            { 'text-overflow': 'ellipsis' },
          ],
          custom_fields: {
            qty_in_list: [
              { 'align-self': 'center' },
              { 'justify-self': 'start' },
              { padding: 'calc(var(--bs-gutter-x) * 0.5)' },
              { 'padding-left': '8px' },
            ],
          },
        },
        custom_fields: {
          qty_in_list:
            "[[[ if ('list_" +
            this._config.shopping_list_id +
            "_qty' in entity.attributes) return `${entity.attributes.list_" +
            this._config.shopping_list_id +
            "_qty}`; else return '0'; ]]]",
        },
      };
      if (this._config.use_collapsable_card) {
        const cardConfig = [
          {
            type: 'custom:button-card',
            class: this._config.collaspable_buttons_class,
            icon: 'mdi:cart-minus',
            show_name: false,
            entity: entity.entity_id,
            tap_action: {
              action: 'call-service',
              service: 'shopping_list_with_grocy.remove_product',
              service_data: {
                product_id: entity.entity_id,
              },
            },
          },
          {
            type: 'custom:button-card',
            class: this._config.collaspable_buttons_class,
            icon: 'mdi:cart-plus',
            show_name: false,
            entity: entity.entity_id,
            tap_action: {
              action: 'call-service',
              service: 'shopping_list_with_grocy.add_product',
              service_data: {
                product_id: entity.entity_id,
              },
            },
          },
        ];
        if (this._config.custom_buttons) {
          const custom_buttons = JSON.parse(JSON.stringify(this._config.custom_buttons));
          this.findAndReplace(custom_buttons, '[PRODUCT_ID]', entity.entity_id);
          cardConfig.push(...custom_buttons);
        }
        entityCardConfig = {
          type: 'custom:collapsable-cards',
          title_card: {
            type: 'custom:button-card',
            entity: entity.entity_id,
            tap_action: { action: 'none' },
            icon: this._config.icon,
            styles: {
              grid: [
                { 'grid-template-rows': '1fr' },
                { 'grid-template-areas': "'i n qty_in_list'" },
                { 'grid-template-columns': 'min-content 1fr min-content' },
              ],
              card: [
                { padding: 'calc(var(--bs-gutter-x) * 0.5)' },
                {
                  'background-color': 'var( --ha-card-background, var(--card-background-color, white) )',
                },
              ],
              icon: [{ padding: '8px' }, { width: '24px' }, { height: '24px' }],
              name: [
                { 'align-self': 'center' },
                { 'text-align': 'left' },
                { width: '100%' },
                { 'margin-left': '46px' },
                { 'margin-right': '38px' },
                { 'font-size': '1rem' },
                { 'white-space': 'nowrap' },
                { overflow: 'hidden' },
                { 'text-overflow': 'ellipsis' },
              ],
              custom_fields: {
                qty_in_list: [
                  { 'align-self': 'center' },
                  { 'justify-self': 'start' },
                  { padding: 'calc(var(--bs-gutter-x) * 0.5)' },
                  { 'padding-left': '8px' },
                ],
              },
            },
            custom_fields: {
              qty_in_list:
                "[[[ if ('list_" +
                this._config.shopping_list_id +
                "_qty' in entity.attributes) return `${entity.attributes.list_" +
                this._config.shopping_list_id +
                "_qty}`; else return '0'; ]]]",
            },
          },
          cards: [
            {
              type: 'custom:bootstrap-grid-card',
              cards: [
                {
                  type: 'row',
                  cards: cardConfig,
                },
              ],
            },
          ],
        };
      }
      entities.push({
        ...{ entity: entity.entity_id.trim() },
        ...entityCardConfig,
      });
    });
    return entities;
  }

  async update_card(entities: EntityList) {
    if (this._entities && compare_deep(entities, this._entities)) return;
    this._cardsEntities = [];
    this._entities = entities;
    const cardConfig = {
      ['cards']: entities,
      ...{ type: 'vertical-stack' },
    };
    if (!this.card) {
      const helpers = await (window as any).loadCardHelpers();
      this.card = await helpers.createCardElement(cardConfig);
    } else {
      this.card.setConfig(cardConfig);
    }

    this._cardBuiltResolve?.();
    this.card.hass = this.hass;
    if ((this.card as any).requestUpdate) {
      await this.updateComplete;
      (this.card as any).requestUpdate();
    }
  }

  async updated(changedProperties) {
    if (changedProperties.has('_template') || (changedProperties.has('hass') && this.hass)) {
      queueMicrotask(() => this.update_all());
    }
  }

  createRenderRoot() {
    return this;
  }
  render() {
    if (this._missingDeps?.length) {
      return slwgRenderDepsErrorCard(this._missingDeps);
    }
    return html`${this.card}`;
  }

  async getCardSize() {
    let len = 0;
    await this._cardBuilt;
    if (this.card && this.card.getCardSize) len = await this.card.getCardSize();
    if (len === 1 && this._entities?.length) len = this._entities.length;
    return len || 5;
  }

  static get styles() {
    return css``;
  }
}
customElements.define('slwg-shopping-list-card', ShoppingListWithGrocyShoppingListCard);

window.customCards = window.customCards || []; // Create the list if it doesn't exist. Careful not to overwrite it
window.customCards.push({
  type: 'slwg-shopping-list-card',
  name: 'ShoppingListWithGrocy - Shopping List',
  description: 'A way to display shopping list from ShoppingListWithGrocy integration',
});
